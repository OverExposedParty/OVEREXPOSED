function createPartyPlayerUpdateRoutes(context) {
  const {
    app,
    Account,
    partyGameRewardClaimSchema,
    assertPatchPlayerBody,
    recordPartyRouteError,
    getPartyPlayerId,
    grantPendingPartyGameReward,
    getPartyRequestPrincipal,
    playerMatchesPrincipal,
    playerMatchesGuestPrincipal,
    getPartyGuestPrincipalFromRequest,
    assertPrincipalOwnsPlayer,
    withoutGuestHashes,
    buildPlayerPatchFromBody,
    patchPlayerInPartyDocument,
    withPartyJoinLock,
    rememberSocketPartyMembership,
    hasLivePartySocketId,
    isDisconnectedPartyPlayer,
    announcePartyPlayerReconnected,
    repairPartyHostForParty,
    attachAccountToPartyOwnerLease,
    cancelAuthTransitionForPlayer,
    hasAuthTransitionForPlayer
  } = context;

  function createPatchPlayerHandler({
    route,
    mainModel,
    waitingRoomModel,
    logLabel
  }) {
    app.post(route, async (req, res) => {
      try {
        const body = {
          ...req.body,
          partyId: req.body?.partyId || req.query.partyCode
        };
        assertPatchPlayerBody(body);
        const principal = await getPartyRequestPrincipal(req, res);
        const partyId = body.partyId;
        const computerId =
          body.computerId ??
          body.newComputerId ??
          body.identity?.computerId ??
          body.identityPatch?.computerId;
        const playerPatch = buildPlayerPatchFromBody(body);
        delete playerPatch['players.$.identity.accountId'];
        delete playerPatch['players.$.identity.guestIdHash'];
        delete playerPatch['players.$.identity.partyOwnerIdHash'];
        const nextSocketId = playerPatch['players.$.connection.socketId'];

        const { updatedMain, updatedWaitingRoom } = await withPartyJoinLock(
          partyId,
          async () => {
            const existingParty = await mainModel
              .findOne({ partyId })
              .select(
                '+players.identity.guestIdHash +players.identity.partyOwnerIdHash'
              )
              .lean();
            const existingPlayer = existingParty?.players?.find(
              (player) =>
                String(getPartyPlayerId(player)) === String(computerId)
            );
            const existingPlayerWasDisconnected =
              isDisconnectedPartyPlayer(existingPlayer);
            assertPrincipalOwnsPlayer(existingParty, computerId, principal);

            const [patchedMain, patchedWaitingRoom] = await Promise.all([
              patchPlayerInPartyDocument(
                mainModel,
                partyId,
                computerId,
                playerPatch
              ),
              patchPlayerInPartyDocument(
                waitingRoomModel,
                partyId,
                computerId,
                playerPatch
              )
            ]);

            if (nextSocketId) {
              rememberSocketPartyMembership({
                socketId: nextSocketId,
                partyId,
                computerId,
                mainModel,
                waitingRoomModel,
                logLabel
              });
            }
            const repairedMain = await repairPartyHostForParty({
              partyId,
              mainModel,
              waitingRoomModel
            });
            const partyAfterPatch = repairedMain ?? patchedMain;

            if (
              existingPlayerWasDisconnected &&
              hasLivePartySocketId(nextSocketId)
            ) {
              const reconnectingPlayer = Array.isArray(partyAfterPatch?.players)
                ? partyAfterPatch.players.find(
                    (player) =>
                      String(getPartyPlayerId(player)) === String(computerId)
                  )
                : existingPlayer;
              await announcePartyPlayerReconnected({
                partyId,
                party: partyAfterPatch,
                player: reconnectingPlayer,
                logLabel
              });
            }

            return {
              updatedMain: partyAfterPatch,
              updatedWaitingRoom: patchedWaitingRoom
            };
          }
        );

        if (!updatedMain) {
          return res.apiError({
            status: 404,
            code: 'party_player_not_found',
            message: `${logLabel} player not found`
          });
        }

        res.apiSuccess({
          message: `${logLabel} player patched successfully`,
          updated: updatedMain,
          waitingRoom: updatedWaitingRoom
        });
      } catch (err) {
        console.error(
          `[REQ ${req.id}] ❌ Error patching ${logLabel.toLowerCase()} player:`,
          err
        );
        const status = Number.isInteger(err.status) ? err.status : 500;
        await recordPartyRouteError({
          err,
          req,
          mainModel,
          waitingRoomModel,
          details: {
            status,
            code:
              typeof err.code === 'string'
                ? err.code
                : 'party_patch_player_failed'
          }
        });
        res.apiError({
          status,
          code:
            typeof err.code === 'string'
              ? err.code
              : 'party_patch_player_failed',
          message:
            err.message || `Failed to patch ${logLabel.toLowerCase()} player`
        });
      }
    });
  }

  function createLinkPlayerAccountHandler({
    route,
    mainModel,
    waitingRoomModel,
    logLabel
  }) {
    app.post(route, async (req, res) => {
      try {
        const body = {
          ...req.body,
          partyId: req.body?.partyId || req.query.partyCode
        };
        assertPatchPlayerBody(body);

        const accountPrincipal = await getPartyRequestPrincipal(req, res);
        if (accountPrincipal.type !== 'account') {
          return res.apiError({
            status: 401,
            code: 'account_required',
            message: 'Sign in to claim this player reward.'
          });
        }

        const guestPrincipal = getPartyGuestPrincipalFromRequest(req);
        if (!guestPrincipal) {
          return res.apiError({
            status: 403,
            code: 'guest_session_required',
            message: 'This guest player could not be verified.'
          });
        }

        const partyId = body.partyId;
        const computerId =
          body.computerId ??
          body.newComputerId ??
          body.identity?.computerId ??
          body.identityPatch?.computerId;
        const now = new Date();

        const result = await withPartyJoinLock(partyId, async () => {
          const existingParty = await mainModel
            .findOne({ partyId })
            .select('+players.identity.guestIdHash');

          if (!existingParty) {
            return {
              status: 404,
              code: 'party_not_found',
              message: `${logLabel} not found`
            };
          }

          const existingPlayer = existingParty.players?.find(
            (player) => String(getPartyPlayerId(player)) === String(computerId)
          );

          if (!existingPlayer) {
            return {
              status: 404,
              code: 'party_player_not_found',
              message: `${logLabel} player not found`
            };
          }

          const alreadyLinked = Boolean(existingPlayer.identity?.accountId);
          if (alreadyLinked) {
            const linkedAccountId = String(existingPlayer.identity.accountId);
            if (linkedAccountId !== accountPrincipal.accountId) {
              return {
                status: 403,
                code: 'party_player_account_locked',
                message: 'This player is already linked to another account.'
              };
            }
          } else if (
            !playerMatchesGuestPrincipal(existingPlayer, guestPrincipal)
          ) {
            return {
              status: 403,
              code: 'party_player_forbidden',
              message: 'This guest player belongs to another session.'
            };
          }

          if (typeof attachAccountToPartyOwnerLease === 'function') {
            const leaseLinkResult = await attachAccountToPartyOwnerLease({
              partyOwnerIdHash: accountPrincipal.partyOwnerIdHash,
              accountId: accountPrincipal.accountId
            });
            if (leaseLinkResult?.conflict) {
              return {
                status: 409,
                code: 'party_owner_active_party_exists',
                message:
                  'This account already owns another active party. Disband it before linking this party.',
                details: {
                  partyCode: leaseLinkResult.partyId || null,
                  lobbyPath: leaseLinkResult.partyId
                    ? `/${leaseLinkResult.partyId}`
                    : '/',
                  ...(leaseLinkResult.gamemode
                    ? { gamemode: leaseLinkResult.gamemode }
                    : {}),
                  ...(leaseLinkResult.apiRoute
                    ? { apiRoute: leaseLinkResult.apiRoute }
                    : {})
                }
              };
            }
          }

          const completesAuthTransition =
            typeof hasAuthTransitionForPlayer === 'function' &&
            hasAuthTransitionForPlayer(partyId, computerId);
          const authTransitionPatch = completesAuthTransition
            ? {
                'players.$.state.participationStatus': 'active',
                'players.$.state.reconnectDeadline': null,
                'state.lastPinged': now
              }
            : null;

          if (alreadyLinked) {
            if (authTransitionPatch) {
              const [updatedMain, updatedWaitingRoom] = await Promise.all([
                patchPlayerInPartyDocument(
                  mainModel,
                  partyId,
                  computerId,
                  authTransitionPatch
                ),
                patchPlayerInPartyDocument(
                  waitingRoomModel,
                  partyId,
                  computerId,
                  authTransitionPatch
                )
              ]);
              if (updatedMain) {
                cancelAuthTransitionForPlayer?.(partyId, computerId);
              }
              return {
                updatedMain,
                waitingRoom: updatedWaitingRoom,
                linked: false,
                alreadyLinked: true
              };
            }
            return {
              updatedMain: withoutGuestHashes(existingParty),
              waitingRoom: null,
              linked: false,
              alreadyLinked: true
            };
          }

          const linkPatch = {
            'players.$.identity.accountId': accountPrincipal.accountId,
            'players.$.identity.partyOwnerIdHash':
              accountPrincipal.partyOwnerIdHash,
            'players.$.identity.accountLinkedAt': now,
            'players.$.identity.accountLinkSource': 'guest_claim',
            'players.$.identity.guestIdHash': null,
            'state.lastPinged': now,
            ...(authTransitionPatch || {})
          };

          const [updatedMain, updatedWaitingRoom] = await Promise.all([
            patchPlayerInPartyDocument(
              mainModel,
              partyId,
              computerId,
              linkPatch
            ),
            patchPlayerInPartyDocument(
              waitingRoomModel,
              partyId,
              computerId,
              linkPatch
            )
          ]);

          if (completesAuthTransition && updatedMain) {
            cancelAuthTransitionForPlayer?.(partyId, computerId);
          }

          return {
            updatedMain,
            waitingRoom: updatedWaitingRoom,
            linked: true,
            alreadyLinked: false
          };
        });

        if (result.status) {
          return res.apiError({
            status: result.status,
            code: result.code,
            message: result.message,
            details: result.details
          });
        }

        let rewardSummaries = null;
        let claimedReward = null;
        const updatedParty = result.updatedMain;
        if (updatedParty?.state?.phase === 'game-over') {
          const grantResult = await grantPendingPartyGameReward({
            Account,
            PartyGameRewardClaim: partyGameRewardClaimSchema,
            party: updatedParty,
            playerId: computerId,
            accountId: accountPrincipal.accountId
          });
          rewardSummaries = grantResult?.summaries || null;
          claimedReward = grantResult?.summary || null;

          if (rewardSummaries) {
            const phaseData =
              updatedParty.state?.phaseData &&
              typeof updatedParty.state.phaseData === 'object'
                ? updatedParty.state.phaseData
                : {};
            const savedMain = await mainModel
              .findOneAndUpdate(
                { partyId },
                {
                  $set: {
                    'state.phaseData': {
                      ...phaseData,
                      rewardSummaries
                    }
                  }
                },
                { new: true }
              )
              .lean();
            await waitingRoomModel.findOneAndUpdate(
              { partyId },
              {
                $set: {
                  'state.phaseData': {
                    ...phaseData,
                    rewardSummaries
                  }
                }
              }
            );
            result.updatedMain = savedMain || updatedParty;
          }
        }

        res.apiSuccess({
          message: result.linked
            ? 'Player linked to account.'
            : 'Player already linked to this account.',
          linked: result.linked,
          alreadyLinked: result.alreadyLinked,
          updated: result.updatedMain,
          waitingRoom: result.waitingRoom,
          rewardSummaries,
          claimedReward
        });
      } catch (err) {
        const status = Number.isInteger(err.status) ? err.status : 500;
        console.error(
          `[REQ ${req.id}] ❌ Error linking ${logLabel.toLowerCase()} player account:`,
          err
        );
        await recordPartyRouteError({
          err,
          req,
          mainModel,
          waitingRoomModel,
          details: {
            status,
            code:
              typeof err.code === 'string'
                ? err.code
                : 'party_link_player_account_failed'
          }
        });
        res.apiError({
          status,
          code:
            typeof err.code === 'string'
              ? err.code
              : 'party_link_player_account_failed',
          message:
            err.message || `Failed to link ${logLabel.toLowerCase()} player`
        });
      }
    });
  }

  function createContinuePlayerAsGuestHandler({
    route,
    mainModel,
    waitingRoomModel,
    logLabel
  }) {
    app.post(route, async (req, res) => {
      try {
        const body = {
          ...req.body,
          partyId: req.body?.partyId || req.query.partyCode
        };
        assertPatchPlayerBody(body);

        const guestPrincipal = await getPartyRequestPrincipal(req, res);
        if (guestPrincipal.type !== 'guest') {
          return res.apiError({
            status: 409,
            code: 'guest_session_required',
            message: 'Log out before continuing this player as a guest.'
          });
        }

        const partyId = body.partyId;
        const computerId =
          body.computerId ??
          body.newComputerId ??
          body.identity?.computerId ??
          body.identityPatch?.computerId;
        const now = new Date();

        const result = await withPartyJoinLock(partyId, async () => {
          const existingParty = await mainModel
            .findOne({ partyId })
            .select(
              '+players.identity.guestIdHash +players.identity.partyOwnerIdHash'
            )
            .lean();

          if (!existingParty) {
            return {
              status: 404,
              code: 'party_not_found',
              message: `${logLabel} not found`
            };
          }

          const existingPlayer = existingParty.players?.find(
            (player) => String(getPartyPlayerId(player)) === String(computerId)
          );
          if (!existingPlayer) {
            return {
              status: 404,
              code: 'party_player_not_found',
              message: `${logLabel} player not found`
            };
          }

          if (!playerMatchesPrincipal(existingPlayer, guestPrincipal)) {
            return {
              status: 403,
              code: 'party_player_forbidden',
              message: 'This player belongs to another browser.'
            };
          }

          const guestPatch = {
            'players.$.identity.accountId': null,
            'players.$.identity.guestIdHash': guestPrincipal.guestIdHash,
            'players.$.identity.partyOwnerIdHash':
              guestPrincipal.partyOwnerIdHash,
            'players.$.identity.accountLinkedAt': null,
            'players.$.identity.accountLinkSource': 'logout_to_guest',
            'players.$.identity.username':
              body.username ??
              body.newUsername ??
              body.identity?.username ??
              existingPlayer.identity?.username,
            'players.$.identity.userIcon':
              body.userIcon ??
              body.newUserIcon ??
              body.identity?.userIcon ??
              existingPlayer.identity?.userIcon,
            'players.$.connection.lastPing': now,
            'state.lastPinged': now
          };

          const [updatedMain, updatedWaitingRoom] = await Promise.all([
            patchPlayerInPartyDocument(
              mainModel,
              partyId,
              computerId,
              guestPatch
            ),
            patchPlayerInPartyDocument(
              waitingRoomModel,
              partyId,
              computerId,
              guestPatch
            )
          ]);

          return { updatedMain, updatedWaitingRoom };
        });

        if (result.status) {
          return res.apiError({
            status: result.status,
            code: result.code,
            message: result.message
          });
        }

        return res.apiSuccess({
          message: 'Player is now continuing as a guest.',
          updated: result.updatedMain,
          waitingRoom: result.updatedWaitingRoom
        });
      } catch (err) {
        const status = Number.isInteger(err.status) ? err.status : 500;
        console.error(
          `[REQ ${req.id}] ❌ Error continuing ${logLabel.toLowerCase()} player as guest:`,
          err
        );
        await recordPartyRouteError({
          err,
          req,
          mainModel,
          waitingRoomModel,
          details: {
            status,
            code:
              typeof err.code === 'string'
                ? err.code
                : 'party_continue_as_guest_failed'
          }
        });
        return res.apiError({
          status,
          code:
            typeof err.code === 'string'
              ? err.code
              : 'party_continue_as_guest_failed',
          message:
            err.message ||
            `Failed to continue ${logLabel.toLowerCase()} player as guest`
        });
      }
    });
  }

  return {
    createPatchPlayerHandler,
    createLinkPlayerAccountHandler,
    createContinuePlayerAsGuestHandler
  };
}

module.exports = {
  createPartyPlayerUpdateRoutes
};
