function createPartyJoinRoute(context) {
  const {
    app,
    assertJoinPlayerBody,
    assertOnlinePlayerRestrictions,
    recordPartyRouteError,
    getPartyPlayerId,
    getPartyPlayerAccountId,
    getPartyNotificationModeName,
    getPartyNotificationActor,
    createTruthOrDareTimelineSeed,
    createNeverHaveIEverTimelineSeed,
    createWouldYouRatherTimelineSeed,
    createMostLikelyToTimelineSeed,
    createParanoiaTimelineSeed,
    createImposterTimelineSeed,
    queuePartyAccountNotification,
    getPartyRequestPrincipal,
    playerMatchesPrincipal,
    buildJoinPlayerFromBody,
    upsertPlayerInPartyDocument,
    withPartyJoinLock,
    cancelDisconnectGrace,
    rememberSocketPartyMembership,
    getPlayerConnectionSocketId,
    hasLivePartySocketId,
    isDisconnectedPartyPlayer,
    announcePartyPlayerReconnected,
    repairPartyHostForParty
  } = context;

  function createJoinUserHandler({
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
        assertJoinPlayerBody(body);
        const partyId = body.partyId;
        const principal = await getPartyRequestPrincipal(req, res);
        const incomingPlayer = buildJoinPlayerFromBody(body, principal);
        const incomingPlayerId = getPartyPlayerId(incomingPlayer);

        const result = await withPartyJoinLock(partyId, async () => {
          const existingParty = await mainModel
            .findOne({ partyId })
            .select(
              '+players.identity.guestIdHash +players.identity.partyOwnerIdHash'
            )
            .lean();
          const existingPlayer = existingParty?.players?.find(
            (player) =>
              String(getPartyPlayerId(player)) === String(incomingPlayerId)
          );
          const existingPlayerWasDisconnected =
            isDisconnectedPartyPlayer(existingPlayer);

          if (
            existingPlayer &&
            !playerMatchesPrincipal(existingPlayer, principal)
          ) {
            const error = new Error(
              'That player identity belongs to another session.'
            );
            error.status = 403;
            error.code = 'party_player_forbidden';
            throw error;
          }

          cancelDisconnectGrace(partyId, incomingPlayerId);
          const activeGamemode = existingParty?.config?.gamemode;
          const supportsActiveRoundJoin =
            existingParty?.state?.isPlaying === true &&
            [
              'truth-or-dare',
              'never-have-i-ever',
              'would-you-rather',
              'most-likely-to',
              'paranoia',
              'imposter'
            ].includes(activeGamemode);
          if (supportsActiveRoundJoin) {
            if (!existingPlayer) {
              assertOnlinePlayerRestrictions({
                gamemode: existingParty.config.gamemode,
                players: [...existingParty.players, incomingPlayer]
              });
            }

            let existingRoundParticipantIds = Array.isArray(
              existingParty.state?.roundParticipantIds
            )
              ? existingParty.state.roundParticipantIds
              : [];
            const hasParticipationState = existingParty.players.some(
              (player) =>
                player.state?.participationStatus &&
                player.state.participationStatus !== 'active'
            );
            if (
              existingRoundParticipantIds.length === 0 &&
              !hasParticipationState
            ) {
              existingRoundParticipantIds = existingParty.players
                .map((player) => getPartyPlayerId(player))
                .filter(Boolean);
              await mainModel.findOneAndUpdate(
                { partyId },
                {
                  $set: {
                    'state.roundParticipantIds': existingRoundParticipantIds
                  }
                }
              );
            }

            if (
              activeGamemode === 'truth-or-dare' &&
              (!Array.isArray(existingParty.state?.roundTimeline) ||
                existingParty.state.roundTimeline.length === 0)
            ) {
              const seededRoundTimeline =
                createTruthOrDareTimelineSeed(existingParty);
              existingParty.state.roundTimeline = seededRoundTimeline;
              await mainModel.findOneAndUpdate(
                { partyId },
                {
                  $set: {
                    'state.roundTimeline': seededRoundTimeline,
                    'state.lastPinged': new Date()
                  }
                }
              );
            }

            if (
              activeGamemode === 'never-have-i-ever' &&
              (!Array.isArray(existingParty.state?.roundTimeline) ||
                existingParty.state.roundTimeline.length === 0)
            ) {
              const seededRoundTimeline =
                createNeverHaveIEverTimelineSeed(existingParty);
              existingParty.state.roundTimeline = seededRoundTimeline;
              await mainModel.findOneAndUpdate(
                { partyId },
                {
                  $set: {
                    'state.roundTimeline': seededRoundTimeline,
                    'state.lastPinged': new Date()
                  }
                }
              );
            }

            if (
              activeGamemode === 'would-you-rather' &&
              (!Array.isArray(existingParty.state?.roundTimeline) ||
                existingParty.state.roundTimeline.length === 0)
            ) {
              const seededRoundTimeline =
                createWouldYouRatherTimelineSeed(existingParty);
              existingParty.state.roundTimeline = seededRoundTimeline;
              await mainModel.findOneAndUpdate(
                { partyId },
                {
                  $set: {
                    'state.roundTimeline': seededRoundTimeline,
                    'state.lastPinged': new Date()
                  }
                }
              );
            }

            if (
              activeGamemode === 'most-likely-to' &&
              (!Array.isArray(existingParty.state?.roundTimeline) ||
                existingParty.state.roundTimeline.length === 0)
            ) {
              const seededRoundTimeline =
                createMostLikelyToTimelineSeed(existingParty);
              existingParty.state.roundTimeline = seededRoundTimeline;
              await mainModel.findOneAndUpdate(
                { partyId },
                {
                  $set: {
                    'state.roundTimeline': seededRoundTimeline,
                    'state.lastPinged': new Date()
                  }
                }
              );
            }

            if (
              activeGamemode === 'paranoia' &&
              (!Array.isArray(existingParty.state?.roundTimeline) ||
                existingParty.state.roundTimeline.length === 0)
            ) {
              const seededRoundTimeline =
                createParanoiaTimelineSeed(existingParty);
              existingParty.state.roundTimeline = seededRoundTimeline;
              await mainModel.findOneAndUpdate(
                { partyId },
                {
                  $set: {
                    'state.roundTimeline': seededRoundTimeline,
                    'state.lastPinged': new Date()
                  }
                }
              );
            }

            if (
              activeGamemode === 'imposter' &&
              (!Array.isArray(existingParty.state?.roundTimeline) ||
                existingParty.state.roundTimeline.length === 0)
            ) {
              const seededRoundTimeline =
                createImposterTimelineSeed(existingParty);
              existingParty.state.roundTimeline = seededRoundTimeline;
              await mainModel.findOneAndUpdate(
                { partyId },
                {
                  $set: {
                    'state.roundTimeline': seededRoundTimeline,
                    'state.lastPinged': new Date()
                  }
                }
              );
            }

            const previousStatus =
              existingPlayer?.state?.participationStatus || 'active';
            const reconnectDeadline = new Date(
              existingPlayer?.state?.reconnectDeadline || 0
            ).getTime();
            const existingPlayerWasCurrentRoundParticipant =
              existingPlayer &&
              existingRoundParticipantIds.some(
                (playerId) => String(playerId) === String(incomingPlayerId)
              );
            const returnedWithinGrace =
              previousStatus === 'reconnecting' &&
              reconnectDeadline > Date.now() &&
              existingPlayerWasCurrentRoundParticipant;
            incomingPlayer.state.participationStatus = returnedWithinGrace
              ? 'active'
              : existingPlayer &&
                  previousStatus === 'active' &&
                  existingPlayerWasCurrentRoundParticipant
                ? 'active'
                : 'pending_next_round';
            incomingPlayer.state.reconnectDeadline = null;
          }

          const updatedMain = await upsertPlayerInPartyDocument(
            mainModel,
            partyId,
            incomingPlayer
          );

          if (!updatedMain) {
            return null;
          }

          const updatedWaitingRoom = await upsertPlayerInPartyDocument(
            waitingRoomModel,
            partyId,
            incomingPlayer
          );
          const socketId = getPlayerConnectionSocketId(incomingPlayer);

          rememberSocketPartyMembership({
            socketId,
            partyId,
            computerId: incomingPlayerId,
            mainModel,
            waitingRoomModel,
            logLabel
          });

          const repairedMain = await repairPartyHostForParty({
            partyId,
            mainModel,
            waitingRoomModel
          });

          const partyAfterJoin = repairedMain ?? updatedMain;
          const joiningAccountId = getPartyPlayerAccountId(incomingPlayer);
          if (existingPlayerWasDisconnected && hasLivePartySocketId(socketId)) {
            await announcePartyPlayerReconnected({
              partyId,
              party: partyAfterJoin,
              player: incomingPlayer,
              logLabel
            });
          }
          const hostComputerId = partyAfterJoin?.state?.hostComputerId;
          const hostPlayer = Array.isArray(partyAfterJoin?.players)
            ? partyAfterJoin.players.find(
                (player) =>
                  hostComputerId &&
                  String(getPartyPlayerId(player)) === String(hostComputerId)
              )
            : null;
          const hostAccountId = getPartyPlayerAccountId(hostPlayer);
          if (
            !existingPlayer &&
            hostAccountId &&
            String(hostAccountId) !== String(joiningAccountId || '')
          ) {
            await queuePartyAccountNotification({
              accountId: hostAccountId,
              type: 'party_player_joined',
              partyId,
              modeName: getPartyNotificationModeName(partyAfterJoin, logLabel),
              actor: getPartyNotificationActor(incomingPlayer)
            });
          }

          return {
            updatedMain: partyAfterJoin,
            updatedWaitingRoom
          };
        });

        if (!result) {
          return res.apiError({
            status: 404,
            code: 'party_not_found',
            message: 'Party not found'
          });
        }

        res.apiSuccess({
          message: `${logLabel} player joined or updated successfully`,
          updated: result.updatedMain,
          waitingRoom: result.updatedWaitingRoom
        });
      } catch (err) {
        console.error(
          `[REQ ${req.id}] ❌ Error joining/updating ${logLabel.toLowerCase()} player:`,
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
              typeof err.code === 'string' ? err.code : 'party_join_user_failed'
          }
        });
        res.apiError({
          status,
          code:
            typeof err.code === 'string' ? err.code : 'party_join_user_failed',
          message:
            err.message ||
            `Failed to join/update ${logLabel.toLowerCase()} player`
        });
      }
    });
  }

  return {
    createJoinUserHandler
  };
}

module.exports = {
  createPartyJoinRoute
};
