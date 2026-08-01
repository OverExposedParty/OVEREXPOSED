function createPartyUpsertRoute(context) {
  const {
    app,
    assertPartyUpdateBody,
    getServerRegion,
    PARTY_ID_PATTERN,
    PLAYER_TURN_ORDER_GAMEMODES,
    initializePlayerTurnOrder,
    assertOnlinePlayerRestrictions,
    recordPartyRouteError,
    getPartyPlayerId,
    isReservedPartyShell,
    getPartyRequestPrincipal,
    bindPlayerToPrincipal,
    assertPrincipalOwnsPlayer,
    preservePlayerBindings,
    assertNoActiveParticipantParty,
    acquireActivePartyOwnerLease,
    activateActivePartyOwnerLease,
    releaseActivePartyOwnerLeaseIfInactive,
    assertPartyConfigContentAccess,
    Account,
    GameRule,
    GamePack,
    GameRole,
    waitingRoomSchema
  } = context;

  function createUpsertPartyHandler({ route, model, logLabel, fields }) {
    app.post(route, async (req, res) => {
      let leaseAcquisition = null;
      let partyWriteCompleted = false;
      try {
        const bodyPartyId =
          typeof req.body?.partyId === 'string'
            ? req.body.partyId.trim().toUpperCase()
            : '';
        const queryPartyId =
          typeof req.query.partyCode === 'string'
            ? req.query.partyCode.trim().toUpperCase()
            : req.query.partyCode;
        const body = {
          ...req.body,
          partyId: PARTY_ID_PATTERN.test(bodyPartyId)
            ? bodyPartyId
            : queryPartyId
        };

        assertPartyUpdateBody(body, fields);
        const { partyId } = body;
        const principal = await getPartyRequestPrincipal(req, res);
        const escapedPartyId = partyId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const existingParty = await model
          .findOne({
            partyId: { $regex: `^${escapedPartyId}$`, $options: 'i' }
          })
          .select(
            '+players.identity.guestIdHash +players.identity.partyOwnerIdHash'
          )
          .lean();
        const isReservedShell = isReservedPartyShell(existingParty);

        // Build the update object dynamically from allowed fields
        const updateData = {};
        for (const field of fields) {
          if (body.hasOwnProperty(field)) {
            updateData[field] = body[field];
          }
        }
        updateData.partyId = partyId;

        if (fields.includes('session')) {
          updateData.session = {
            ...(existingParty?.session || {}),
            ...(updateData.session || {}),
            serverRegion:
              updateData.session?.serverRegion || (await getServerRegion())
          };
        }

        if (existingParty && !isReservedShell) {
          assertPrincipalOwnsPlayer(
            existingParty,
            existingParty.state?.hostComputerId,
            principal
          );

          if (Array.isArray(updateData.players)) {
            updateData.players = preservePlayerBindings(
              existingParty.players || [],
              updateData.players
            );
          }
        } else {
          if (typeof assertNoActiveParticipantParty === 'function') {
            await assertNoActiveParticipantParty(principal);
          }

          if (!Array.isArray(updateData.players)) {
            const error = new Error(
              'A new party must be created by its single host player.'
            );
            error.status = 400;
            error.code = 'party_create_host_invalid';
            throw error;
          }

          const hostComputerId = updateData.state?.hostComputerId;
          const hostPlayer = updateData.players.find(
            (player) =>
              String(getPartyPlayerId(player)) === String(hostComputerId)
          );

          if (
            !hostComputerId ||
            !hostPlayer ||
            updateData.players.length !== 1
          ) {
            const error = new Error(
              'A new party must be created by its single host player.'
            );
            error.status = 400;
            error.code = 'party_create_host_invalid';
            throw error;
          }

          bindPlayerToPrincipal(hostPlayer, principal);

          if (fields.includes('session') && principal.type === 'account') {
            updateData.session = {
              ...(updateData.session || {}),
              access: {
                ...(updateData.session?.access || {}),
                originalHostAccountId: principal.accountId,
                originalHostComputerId: hostComputerId,
                createdAt: updateData.session?.access?.createdAt || new Date()
              }
            };
          }

          leaseAcquisition = await acquireActivePartyOwnerLease({
            partyId,
            principal,
            gamemode: updateData.config?.gamemode
          });
        }

        if (
          updateData.config &&
          typeof assertPartyConfigContentAccess === 'function'
        ) {
          await assertPartyConfigContentAccess({
            config: {
              ...(existingParty?.config || {}),
              ...updateData.config
            },
            partyId,
            existingParty,
            principal,
            Account,
            WaitingRoom: waitingRoomSchema,
            GameRule,
            GamePack,
            GameRole
          });
        }

        if (
          existingParty &&
          !isReservedShell &&
          updateData.state &&
          typeof updateData.state === 'object'
        ) {
          updateData.state = {
            ...updateData.state,
            hostComputerId: existingParty.state?.hostComputerId ?? null,
            hostComputerIdList: Array.isArray(
              existingParty.state?.hostComputerIdList
            )
              ? existingParty.state.hostComputerIdList
              : [],
            playerTurnOrder: Array.isArray(updateData.state.playerTurnOrder)
              ? updateData.state.playerTurnOrder
              : Array.isArray(existingParty.state?.playerTurnOrder)
                ? existingParty.state.playerTurnOrder
                : []
          };
        }

        if (updateData.state?.isPlaying === true) {
          const gamemode =
            updateData.config?.gamemode ??
            existingParty?.config?.gamemode ??
            existingParty?.gamemode;
          const players = Array.isArray(updateData.players)
            ? updateData.players
            : Array.isArray(existingParty?.players)
              ? existingParty.players
              : [];

          if (
            PLAYER_TURN_ORDER_GAMEMODES.has(gamemode) &&
            (!Array.isArray(updateData.state.playerTurnOrder) ||
              updateData.state.playerTurnOrder.length === 0)
          ) {
            initializePlayerTurnOrder(updateData.state, players);
          }
        }

        if (
          updateData.state?.isPlaying === true &&
          body.bypassPlayerRestrictions !== true
        ) {
          const gamemode =
            updateData.config?.gamemode ??
            existingParty?.config?.gamemode ??
            existingParty?.gamemode;
          const players = Array.isArray(updateData.players)
            ? updateData.players
            : existingParty?.players;

          assertOnlinePlayerRestrictions({ gamemode, players });
        }

        const updated = await model.findOneAndUpdate(
          { partyId: existingParty?.partyId || partyId },
          updateData,
          {
            new: true,
            upsert: !existingParty || isReservedShell
          }
        );
        if (!updated) {
          const error = new Error(
            `${logLabel} changed while the update was being saved. Please try again.`
          );
          error.status = 409;
          error.code = 'party_update_conflict';
          throw error;
        }
        partyWriteCompleted = true;

        if (leaseAcquisition) {
          await activateActivePartyOwnerLease({
            partyId,
            releaseToken: leaseAcquisition.releaseToken,
            gamemode:
              updateData.config?.gamemode ?? existingParty?.config?.gamemode
          });
        }

        res.apiSuccess({
          message: `${logLabel} updated or created successfully`,
          updated
        });
      } catch (err) {
        if (
          leaseAcquisition?.acquired &&
          !partyWriteCompleted &&
          typeof releaseActivePartyOwnerLeaseIfInactive === 'function'
        ) {
          try {
            await releaseActivePartyOwnerLeaseIfInactive({
              partyId: leaseAcquisition.lease?.partyId,
              releaseToken: leaseAcquisition.releaseToken
            });
          } catch (releaseError) {
            console.error(
              `[REQ ${req.id}] Failed to release an unused party owner lease:`,
              releaseError
            );
          }
        }
        console.error(
          `[REQ ${req.id}] ❌ Error saving/updating ${logLabel.toLowerCase()}:`,
          err
        );
        const status = Number.isInteger(err.status) ? err.status : 500;
        await recordPartyRouteError({
          err,
          req,
          mainModel: model,
          waitingRoomModel: null,
          details: {
            status,
            code:
              typeof err.code === 'string' ? err.code : 'party_upsert_failed'
          }
        });
        res.apiError({
          status,
          code: typeof err.code === 'string' ? err.code : 'party_upsert_failed',
          message:
            err.message || `Failed to save/update ${logLabel.toLowerCase()}`,
          details: err.details
        });
      }
    });
  }

  return {
    createUpsertPartyHandler
  };
}

module.exports = {
  createPartyUpsertRoute
};
