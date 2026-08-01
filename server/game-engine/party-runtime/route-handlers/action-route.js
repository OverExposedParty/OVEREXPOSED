const { createPartyActionStatEventTools } = require('./action-stat-events');
const { getPublishedRoles } = require('../../../services/game-roles');
const {
  buildMafiaRoleAssignment
} = require('../../../services/mafia-role-assignment');
const {
  pruneUnavailablePartyContent
} = require('../../../services/game-content-availability');

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
    assertPartyConfigContentAccess
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

        const updatedPartySnapshot = applyPartyActionToSnapshot({
          party: existingParty,
          action,
          actorId,
          payload,
          hasDeck
        });

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
        if (action !== 'end-game' && action !== 'return-to-lobby') {
          updateFilter['state.phase'] = { $ne: 'game-over' };
        }

        let updatedParty = await mainModel.findOneAndUpdate(
          updateFilter,
          updateData,
          { new: true }
        );
        const actionApplied = Boolean(updatedParty);
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

        if (gameJustEnded) {
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

        await waitingRoomModel.findOneAndUpdate(
          { partyId },
          {
            session: updatedParty.session,
            config: updatedParty.config,
            state: updatedParty.state,
            players: updatedPartySnapshot.players
          },
          {
            new: true,
            upsert: true
          }
        );

        res.apiSuccess({
          message: `${logLabel} action applied successfully`,
          updated: updatedParty
        });
      } catch (err) {
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
  createPartyActionRoute
};
