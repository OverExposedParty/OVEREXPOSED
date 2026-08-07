const { createPartyActionStatEventTools } = require('./action-stat-events');
const { getPublishedRoles } = require('../../../services/game-roles');
const {
  buildMafiaRoleAssignment
} = require('../../../services/mafia-role-assignment');
const {
  pruneUnavailablePartyContent
} = require('../../../services/game-content-availability');

async function createPartyReplaySnapshot({
  party,
  actorId,
  gameId,
  gameModeRelease,
  shuffleSeed,
  applyPartyActionToSnapshot,
  hasDeck,
  socketId,
  prepareLobbySnapshot
}) {
  const lobbySnapshot = applyPartyActionToSnapshot({
    party,
    action: 'return-to-lobby',
    actorId,
    payload: {
      nextGameId: gameId,
      nextGameModeRelease: gameModeRelease,
      socketId
    },
    hasDeck
  });

  lobbySnapshot.config = lobbySnapshot.config || {};
  lobbySnapshot.config.shuffleSeed = shuffleSeed;
  await prepareLobbySnapshot?.(lobbySnapshot);

  return applyPartyActionToSnapshot({
    party: lobbySnapshot,
    action: 'start-game',
    actorId,
    payload: { socketId },
    hasDeck
  });
}

function createPartyActionRoute(context) {
  const {
    app,
    Account,
    Achievement,
    partyGameEventSchema,
    partyGameRewardClaimSchema,
    assertPartyActionBody,
    applyPartyActionToSnapshot,
    recordPartyRouteError,
    incrementAchievementStat,
    recordAchievementCollectionItems,
    recordAchievementPlayDate,
    recordMostLikelyToResult,
    recordNeverHaveIEverResult,
    recordParanoiaResult,
    recordTruthOrDarePromptResult,
    unlockAchievementByKey,
    grantPartyGameRewards,
    getPartyRequestPrincipal,
    assertPrincipalOwnsPlayer,
    unlockEligiblePartyAchievements,
    emitPartyProgressionNotifications,
    GameRole,
    GamePack,
    GameRule,
    assertPartyConfigContentAccess,
    archiveRoomSnapshot,
    reservePartyGameSession,
    activatePartyGameSession,
    completePartyGameSession,
    releasePartyGameSession,
    io,
    crypto
  } = context;
  const { applyPartyAccountStatEvents } = createPartyActionStatEventTools({
    Account,
    Achievement,
    partyGameEventSchema,
    incrementAchievementStat,
    recordAchievementCollectionItems,
    recordAchievementPlayDate,
    recordMostLikelyToResult,
    recordNeverHaveIEverResult,
    recordParanoiaResult,
    recordTruthOrDarePromptResult,
    unlockAchievementByKey,
    unlockEligiblePartyAchievements
  });

  function createPartyActionHandler({
    route,
    mainModel,
    waitingRoomModel,
    logLabel,
    hasDeck
  }) {
    app.post(`${route}/action`, async (req, res) => {
      let gameSessionReservation = null;
      let partyTransitionCommitted = false;
      try {
        const body = {
          ...req.body,
          partyId: req.body?.partyId || req.query.partyCode
        };
        assertPartyActionBody(body);
        const {
          partyId,
          action,
          actorId,
          payload: requestedPayload = {}
        } = body;
        let payload = requestedPayload;
        const startsNextGame = ['return-to-lobby', 'replay-game'].includes(
          action
        );
        const principal = await getPartyRequestPrincipal(req, res);

        const existingParty = await mainModel
          .findOne({ partyId })
          .select(
            '+players.identity.guestIdHash +players.identity.partyOwnerIdHash'
          )
          .lean();
        if (!existingParty) {
          await recordPartyRouteError({
            err: new Error(`${logLabel} not found`),
            req,
            mainModel,
            waitingRoomModel,
            details: {
              partyId,
              status: 404,
              code: 'party_not_found',
              action
            }
          });
          return res.apiError({
            status: 404,
            code: 'party_not_found',
            message: `${logLabel} not found`
          });
        }

        assertPrincipalOwnsPlayer(existingParty, actorId, principal);

        if (
          action === 'replay-game' &&
          String(requestedPayload.expectedGameId) !==
            String(existingParty.session?.gameId || '')
        ) {
          const error = new Error(
            'This game has already changed. Reload the latest party state.'
          );
          error.status = 409;
          error.code = 'party_replay_stale_session';
          throw error;
        }

        if (
          startsNextGame &&
          existingParty.state?.phase === 'game-over' &&
          typeof archiveRoomSnapshot === 'function'
        ) {
          const archived = await archiveRoomSnapshot({
            roomDocument: existingParty,
            endedAt: existingParty.session?.endedAt
          });
          if (!archived) {
            const error = new Error(
              `Failed to archive ${logLabel.toLowerCase()} before starting the next game`
            );
            error.status = 500;
            error.code = 'party_archive_failed';
            throw error;
          }
        }

        if (
          ['start-game', 'mafia-start-game'].includes(action) &&
          typeof assertPartyConfigContentAccess === 'function'
        ) {
          await assertPartyConfigContentAccess({
            config: existingParty.config || {},
            partyId,
            existingParty,
            principal,
            Account,
            WaitingRoom: waitingRoomModel,
            GameRule,
            GamePack,
            GameRole
          });
        }

        if (action === 'mafia-start-game') {
          const roles = await getPublishedRoles(GameRole, 'mafia');
          payload = {
            ...requestedPayload,
            assignedRoleKeys: buildMafiaRoleAssignment({
              config: existingParty.config || {},
              roles,
              playerCount: existingParty.players?.length || 0
            })
          };
        }

        if (startsNextGame) {
          gameSessionReservation = await reservePartyGameSession({
            partyId,
            gamemode: existingParty.config?.gamemode || existingParty.gamemode
          });
          payload = {
            ...payload,
            nextGameId: gameSessionReservation.gameId
          };
        }

        let updatedPartySnapshot;
        if (action === 'replay-game') {
          updatedPartySnapshot = await createPartyReplaySnapshot({
            party: existingParty,
            actorId,
            gameId: gameSessionReservation.gameId,
            gameModeRelease: gameSessionReservation.gameModeRelease,
            shuffleSeed:
              typeof crypto.randomInt === 'function'
                ? crypto.randomInt(0, 256)
                : crypto.randomBytes(1)[0],
            applyPartyActionToSnapshot,
            hasDeck,
            socketId: payload.socketId,
            prepareLobbySnapshot: async (lobbySnapshot) => {
              await pruneUnavailablePartyContent({
                config: lobbySnapshot.config,
                GamePack,
                GameRule,
                GameRole
              });
              if (typeof assertPartyConfigContentAccess === 'function') {
                await assertPartyConfigContentAccess({
                  config: lobbySnapshot.config,
                  partyId,
                  existingParty: lobbySnapshot,
                  principal,
                  Account,
                  WaitingRoom: waitingRoomModel,
                  GameRule,
                  GamePack,
                  GameRole
                });
              }
            }
          });
        } else {
          updatedPartySnapshot = applyPartyActionToSnapshot({
            party: existingParty,
            action,
            actorId,
            payload,
            hasDeck
          });
        }

        if (action === 'return-to-lobby') {
          await pruneUnavailablePartyContent({
            config: updatedPartySnapshot.config,
            GamePack,
            GameRule,
            GameRole
          });
        }

        const updateData = {
          session: updatedPartySnapshot.session,
          config: updatedPartySnapshot.config,
          state: updatedPartySnapshot.state,
          players: updatedPartySnapshot.players
        };

        if (hasDeck) {
          updateData.deck = updatedPartySnapshot.deck;
        }

        const updateFilter = { partyId };
        if (startsNextGame) {
          updateFilter['state.phase'] = 'game-over';
          if (existingParty.session?.gameId) {
            updateFilter['session.gameId'] = existingParty.session.gameId;
          }
        } else {
          updateFilter['state.phase'] = {
            $nin: ['game-over', 'switching-game']
          };
        }

        let updatedParty = await mainModel.findOneAndUpdate(
          updateFilter,
          updateData,
          { new: true }
        );
        const actionApplied = Boolean(updatedParty);
        partyTransitionCommitted = startsNextGame && actionApplied;
        const gameJustEnded =
          actionApplied &&
          existingParty.state?.phase !== 'game-over' &&
          updatedParty?.state?.phase === 'game-over';

        // An end-game request may have won the race after this action read its
        // snapshot. In that case, preserve and return the terminal state rather
        // than allowing this stale action to revive the gameplay cycle.
        if (!updatedParty) {
          updatedParty = await mainModel.findOne({ partyId });
        }

        if (gameSessionReservation) {
          if (actionApplied) {
            try {
              await activatePartyGameSession(gameSessionReservation);
            } catch (error) {
              console.error(
                `[REQ ${req.id}] Failed to activate game session ${gameSessionReservation.gameId}:`,
                error
              );
            }
          } else {
            await releasePartyGameSession(gameSessionReservation);
            gameSessionReservation = null;
          }
        }

        if (action === 'replay-game' && actionApplied) {
          try {
            await completePartyGameSession({
              gameId: existingParty.session?.gameId,
              partyId
            });
          } catch (error) {
            console.error(
              `[REQ ${req.id}] Failed to complete replayed game session ${existingParty.session?.gameId}:`,
              error
            );
          }
        }

        if (!updatedParty) {
          const error = new Error(`${logLabel} not found`);
          error.status = 404;
          error.code = 'party_not_found';
          throw error;
        }

        if (actionApplied) {
          const progressionDeliveries = await applyPartyAccountStatEvents(
            updatedPartySnapshot.__accountStatEvents,
            {
              partyId,
              action,
              eventId: payload.eventId,
              gameId: updatedPartySnapshot.session?.gameId,
              playSequence: updatedPartySnapshot.session?.playSequence,
              phase: existingParty.state?.phase,
              playerTurn: existingParty.state?.playerTurn
            }
          );
          emitPartyProgressionNotifications?.({
            partyId,
            players: updatedPartySnapshot.players,
            deliveries: progressionDeliveries
          });
        }

        if (gameJustEnded || action === 'end-game') {
          const rewardSummaries = await grantPartyGameRewards({
            Account,
            PartyGameRewardClaim: partyGameRewardClaimSchema,
            party: updatedParty.toObject?.() || updatedParty
          });
          const phaseData =
            updatedParty.state?.phaseData &&
            typeof updatedParty.state.phaseData === 'object'
              ? updatedParty.state.phaseData
              : {};
          updatedParty.state.phaseData = {
            ...phaseData,
            rewardSummaries
          };
          updatedParty.markModified?.('state.phaseData');
          updatedParty = await updatedParty.save();
        }

        if (
          (gameJustEnded || action === 'end-game') &&
          updatedParty.state?.phase === 'game-over' &&
          typeof archiveRoomSnapshot === 'function'
        ) {
          const archived = await archiveRoomSnapshot({
            roomDocument: updatedParty,
            endedAt: updatedParty.session?.endedAt
          });
          if (!archived) {
            const error = new Error(
              `Failed to archive completed ${logLabel.toLowerCase()}`
            );
            error.status = 500;
            error.code = 'party_archive_failed';
            throw error;
          }
          try {
            await completePartyGameSession({
              gameId: updatedParty.session?.gameId,
              partyId
            });
          } catch (error) {
            console.error(
              `[REQ ${req.id}] Failed to complete game session ${updatedParty.session?.gameId}:`,
              error
            );
          }
        }

        await waitingRoomModel.findOneAndUpdate(
          { partyId },
          {
            session: updatedParty.session,
            config: updatedParty.config,
            state: updatedParty.state,
            players: updatedParty.players
          },
          {
            new: true,
            upsert: true
          }
        );

        let transition;
        if (action === 'replay-game' && actionApplied) {
          transition = {
            partyId,
            gamemode:
              updatedParty.config?.gamemode || updatedParty.gamemode || null,
            gameId: updatedParty.session?.gameId || null,
            hostComputerId: updatedParty.state?.hostComputerId || null
          };
          io?.to?.(partyId)?.emit('party-game-replayed', transition);
        }

        res.apiSuccess({
          message: `${logLabel} action applied successfully`,
          updated: updatedParty,
          ...(transition ? { transition } : {})
        });
      } catch (err) {
        if (
          gameSessionReservation &&
          !partyTransitionCommitted &&
          typeof releasePartyGameSession === 'function'
        ) {
          try {
            await releasePartyGameSession(gameSessionReservation);
          } catch (releaseError) {
            console.error(
              `[REQ ${req.id}] Failed to release unused game session ${gameSessionReservation.gameId}:`,
              releaseError
            );
          }
        }
        const status = Number.isInteger(err.status) ? err.status : 500;
        console.error(
          `[REQ ${req.id}] ❌ Error applying ${logLabel.toLowerCase()} action:`,
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
                : 'party_action_apply_failed'
          }
        });
        res.apiError({
          status,
          code:
            typeof err.code === 'string'
              ? err.code
              : 'party_action_apply_failed',
          message:
            err.message || `Failed to apply ${logLabel.toLowerCase()} action`
        });
      }
    });
  }

  return {
    createPartyActionHandler
  };
}

module.exports = {
  createPartyReplaySnapshot,
  createPartyActionRoute
};
