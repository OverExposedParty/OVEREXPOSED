function shouldDisbandPartyForExit({
  exitIntent,
  isSelfRemoval,
  actorComputerId,
  hostComputerId
}) {
  return Boolean(
    exitIntent === 'main-menu' &&
    isSelfRemoval &&
    hostComputerId &&
    String(actorComputerId) === String(hostComputerId)
  );
}

function createPartyExitRoutes(context) {
  const {
    app,
    io,
    partyGameChatLogSchema,
    assertPartyId,
    assertDisconnectPlayerBody,
    assertRemovePlayerBody,
    parseBeaconBody,
    recordPartyRouteError,
    cloneSerializable,
    getPartyPlayerId,
    getPartyPlayerAccountId,
    shouldUseDisconnectGrace,
    formatPartyModeName,
    getPartyNotificationModeName,
    getPartyNotificationActor,
    queuePartyAccountNotification,
    getPartyRequestPrincipal,
    assertPrincipalOwnsPlayer,
    withoutGuestHashes,
    withPartyJoinLock,
    forgetSocketPartyMembership,
    getPlayerConnectionSocketId,
    getConnectedPartyPlayers,
    unlockLastOneStandingForRemainingPlayer,
    createLivePartyNotification,
    emitPartyHostChanged,
    repairPartyHost,
    disconnectPartyPlayer,
    beginTruthOrDareDisconnectGrace,
    getActivePartyOwnerLeaseReleaseToken,
    releaseActivePartyOwnerLeaseIfInactive
  } = context;

  async function deletePartySession({
    session,
    partyId,
    mainModel,
    waitingRoomModel,
    logLabel
  }) {
    const hostComputerId = session.state?.hostComputerId ?? null;
    const partySnapshot = withoutGuestHashes(session);
    const hostPlayer = session.players.find(
      (player) =>
        hostComputerId &&
        String(getPartyPlayerId(player)) === String(hostComputerId)
    );
    const hostPlayerSnapshot = hostPlayer?.toObject
      ? hostPlayer.toObject()
      : cloneSerializable(hostPlayer);
    const remainingPlayers = session.players
      .filter(
        (player) => String(getPartyPlayerId(player)) !== String(hostComputerId)
      )
      .map((player) =>
        player?.toObject ? player.toObject() : cloneSerializable(player)
      );
    let leaseReleaseToken = null;

    if (typeof getActivePartyOwnerLeaseReleaseToken === 'function') {
      try {
        leaseReleaseToken = await getActivePartyOwnerLeaseReleaseToken(partyId);
      } catch (error) {
        console.error(
          `Failed to capture the owner lease for party ${partyId}:`,
          error
        );
      }
    }

    // Remove the waiting-room projection first. If it fails, the authoritative
    // game room remains available so the host can safely retry the disband.
    await waitingRoomModel.deleteOne({ partyId });
    const deletedMain = await mainModel.deleteOne({ partyId });

    if (deletedMain && deletedMain.deletedCount === 0) {
      const error = new Error(`${logLabel} not found`);
      error.status = 404;
      error.code = 'party_not_found';
      throw error;
    }

    if (
      leaseReleaseToken &&
      typeof releaseActivePartyOwnerLeaseIfInactive === 'function'
    ) {
      try {
        await releaseActivePartyOwnerLeaseIfInactive({
          partyId,
          releaseToken: leaseReleaseToken
        });
      } catch (error) {
        console.error(
          `Failed to release the owner lease for disbanded party ${partyId}:`,
          error
        );
      }
    }

    try {
      await partyGameChatLogSchema.deleteMany({ partyId });
    } catch (error) {
      console.error(
        `Failed to delete chat for disbanded party ${partyId}:`,
        error
      );
    }

    session.players.forEach((player) => {
      forgetSocketPartyMembership(
        getPlayerConnectionSocketId(player),
        partyId,
        getPartyPlayerId(player)
      );
    });

    return {
      disbanded: true,
      modeName: getPartyNotificationModeName(session, logLabel),
      hostPlayer: hostPlayerSnapshot,
      party: partySnapshot,
      remainingPlayers
    };
  }

  async function announcePartyDisbanded({ result, partyId, logLabel }) {
    const actor = getPartyNotificationActor(result.hostPlayer);
    const recipientAccountIds = [
      ...new Set(
        result.remainingPlayers
          .map((player) => getPartyPlayerAccountId(player))
          .filter(Boolean)
          .map(String)
      )
    ];

    const notificationResults = await Promise.allSettled(
      recipientAccountIds.map((accountId) =>
        queuePartyAccountNotification({
          accountId,
          type: 'party_disbanded',
          partyId,
          modeName: result.modeName || formatPartyModeName(logLabel),
          actor
        })
      )
    );
    notificationResults.forEach((notificationResult) => {
      if (notificationResult.status === 'rejected') {
        console.error(
          `Failed to queue disband notification for party ${partyId}:`,
          notificationResult.reason
        );
      }
    });

    try {
      io.to(partyId).emit('party-deleted', {
        partyCode: partyId,
        notification: createLivePartyNotification({
          type: 'party_disbanded',
          partyId,
          party: result.party,
          player: result.hostPlayer,
          logLabel
        })
      });

      const clientsInRoom = io.sockets.adapter.rooms.get(partyId);
      if (clientsInRoom) {
        for (const clientId of clientsInRoom) {
          io.sockets.sockets.get(clientId)?.leave(partyId);
        }
      }
    } catch (error) {
      console.error(`Failed to broadcast disbanded party ${partyId}:`, error);
    }
  }

  function createDisbandPartyHandler({
    route,
    mainModel,
    waitingRoomModel,
    logLabel,
    method = 'post'
  }) {
    app[method](route, async (req, res) => {
      let partyId = null;
      try {
        const body = req.body == null ? {} : parseBeaconBody(req.body);
        partyId = body.partyCode ?? body.partyId ?? req.query?.partyCode;
        assertPartyId(
          partyId,
          body.partyCode || req.query?.partyCode ? 'partyCode' : 'partyId'
        );
        const principal = await getPartyRequestPrincipal(req, res);

        const result = await withPartyJoinLock(partyId, async () => {
          const session = await mainModel
            .findOne({ partyId })
            .select(
              '+players.identity.guestIdHash +players.identity.partyOwnerIdHash'
            );
          if (!session) {
            return { status: 404, error: `${logLabel} not found` };
          }

          const hostComputerId = session.state?.hostComputerId ?? null;
          assertPrincipalOwnsPlayer(session, hostComputerId, principal);

          return deletePartySession({
            session,
            partyId,
            mainModel,
            waitingRoomModel,
            logLabel
          });
        });

        if (result?.error) {
          return res.apiError({
            status: result.status,
            code: 'party_disband_failed',
            message: result.error
          });
        }

        await announcePartyDisbanded({ result, partyId, logLabel });
        return res.apiSuccess({
          message: `${logLabel} disbanded successfully`,
          partyCode: partyId
        });
      } catch (err) {
        const status = Number.isInteger(err.status) ? err.status : 500;
        await recordPartyRouteError({
          err,
          req,
          mainModel,
          waitingRoomModel,
          details: {
            status,
            code:
              typeof err.code === 'string' ? err.code : 'party_disband_failed'
          }
        });
        return res.apiError({
          status,
          code:
            typeof err.code === 'string' ? err.code : 'party_disband_failed',
          message: err.message || `Failed to disband ${logLabel.toLowerCase()}`
        });
      }
    });
  }

  function createRemoveUserHandler({
    route,
    mainModel,
    waitingRoomModel,
    logLabel
  }) {
    app.post(route, async (req, res) => {
      try {
        const body = parseBeaconBody(req.body);
        assertRemovePlayerBody(body);
        const principal = await getPartyRequestPrincipal(req, res);
        const { partyId, computerIdToRemove } = body;
        const actorComputerId = body.actorComputerId ?? body.actorId ?? null;
        const actorSocketId = body.actorSocketId ?? body.socketId ?? null;
        const exitIntent = body.exitIntent ?? null;

        const result = await withPartyJoinLock(partyId, async () => {
          // --- Remove from session ---
          const session = await mainModel
            .findOne({ partyId: partyId })
            .select(
              '+players.identity.guestIdHash +players.identity.partyOwnerIdHash'
            );
          if (!session) {
            return { status: 404, error: `${logLabel} not found` };
          }

          assertPrincipalOwnsPlayer(session, actorComputerId, principal);

          const isSelfRemoval =
            String(actorComputerId) === String(computerIdToRemove);
          const hostComputerId = session.state?.hostComputerId ?? null;
          let actorPlayerSnapshot = null;

          if (!isSelfRemoval) {
            const hostComputerId = session.state?.hostComputerId ?? null;
            const actorPlayer = session.players.find(
              (player) =>
                String(getPartyPlayerId(player)) === String(actorComputerId)
            );
            actorPlayerSnapshot = actorPlayer?.toObject
              ? actorPlayer.toObject()
              : cloneSerializable(actorPlayer);
            const actorCurrentSocketId =
              actorPlayer?.connection?.socketId ?? null;
            const actorSocketMatches =
              !actorSocketId ||
              !actorCurrentSocketId ||
              String(actorCurrentSocketId) === String(actorSocketId);

            if (
              !hostComputerId ||
              String(actorComputerId) !== String(hostComputerId) ||
              !actorSocketMatches
            ) {
              return {
                status: 403,
                error: 'Only the host can remove another player from the party'
              };
            }
          }

          const removedPlayer = session.players.find(
            (player) =>
              String(getPartyPlayerId(player)) === String(computerIdToRemove)
          );
          const removedPlayerSnapshot = removedPlayer?.toObject
            ? removedPlayer.toObject()
            : cloneSerializable(removedPlayer);
          const removedSocketId = getPlayerConnectionSocketId(removedPlayer);
          const shouldDisband = shouldDisbandPartyForExit({
            exitIntent,
            isSelfRemoval,
            actorComputerId,
            hostComputerId
          });

          if (shouldDisband) {
            return deletePartySession({
              session,
              partyId,
              mainModel,
              waitingRoomModel,
              logLabel
            });
          }

          const originalCount = session.players.length;
          const connectedBefore = getConnectedPartyPlayers(
            Array.isArray(session.players) ? session.players : []
          ).length;
          session.players = session.players.filter(
            (player) =>
              String(getPartyPlayerId(player)) !== String(computerIdToRemove)
          );

          if (session.players.length === originalCount) {
            return { status: 400, error: 'Computer ID not found in session' };
          }

          const chatLogSession = await partyGameChatLogSchema.findOne({
            partyId
          });
          const hostRepair = await repairPartyHost({
            session,
            waitingRoomModel,
            chatLogSession,
            ignoreComputerId: computerIdToRemove
          });

          await session.save();
          if (connectedBefore > 1) {
            await unlockLastOneStandingForRemainingPlayer(session);
          }
          if (chatLogSession) {
            await chatLogSession.save();
          }

          // --- Remove from waiting room (if exists) ---
          const waitingRoom = await waitingRoomModel
            .findOne({
              partyId: partyId
            })
            .select(
              '+players.identity.guestIdHash +players.identity.partyOwnerIdHash'
            );
          if (waitingRoom) {
            const originalWaitingCount = waitingRoom.players.length;
            waitingRoom.players = waitingRoom.players.filter(
              (player) =>
                String(getPartyPlayerId(player)) !== String(computerIdToRemove)
            );

            if (waitingRoom.players.length !== originalWaitingCount) {
              if (waitingRoom.state) {
                waitingRoom.state.hostComputerId =
                  session.state?.hostComputerId ?? null;
                waitingRoom.state.hostComputerIdList =
                  session.state?.hostComputerIdList ?? [];
                waitingRoom.state.lastPinged = new Date();
              }
              await waitingRoom.save();
            }
          }

          forgetSocketPartyMembership(
            removedSocketId,
            partyId,
            computerIdToRemove
          );
          return {
            isSelfRemoval,
            modeName: getPartyNotificationModeName(session, logLabel),
            removedPlayer: removedPlayerSnapshot,
            removedSocketId,
            actorPlayer: actorPlayerSnapshot,
            hostRepair,
            updatedParty: withoutGuestHashes(session)
          };
        });

        if (result?.error) {
          await recordPartyRouteError({
            err: new Error(result.error),
            req,
            mainModel,
            waitingRoomModel,
            details: {
              status: result.status,
              code: 'party_remove_user_failed'
            }
          });
          return res.apiError({
            status: result.status,
            code: 'party_remove_user_failed',
            message: result.error
          });
        }

        const removedSocketId = result?.removedSocketId;

        if (result?.disbanded) {
          await announcePartyDisbanded({ result, partyId, logLabel });

          return res.apiSuccess({
            message: `${logLabel} disbanded successfully`
          });
        }

        if (!result?.isSelfRemoval) {
          const removedAccountId = getPartyPlayerAccountId(
            result?.removedPlayer
          );
          if (removedAccountId) {
            await queuePartyAccountNotification({
              accountId: removedAccountId,
              type: 'party_player_kicked',
              partyId,
              modeName: result?.modeName || formatPartyModeName(logLabel),
              actor: getPartyNotificationActor(result?.actorPlayer)
            });
          }
        }

        if (result?.isSelfRemoval && result?.removedPlayer) {
          io.to(partyId).emit('user-left', {
            socketId: removedSocketId,
            computerId: computerIdToRemove,
            username:
              result.removedPlayer.identity?.username ||
              result.removedPlayer.username,
            notification: createLivePartyNotification({
              type: 'party_player_left',
              partyId,
              party: result.updatedParty,
              player: result.removedPlayer,
              logLabel
            })
          });
        }

        if (removedSocketId && removedSocketId !== 'DISCONNECTED') {
          const removedSocket = io.sockets.sockets.get(removedSocketId);

          if (removedSocket) {
            if (!result?.isSelfRemoval) {
              removedSocket.emit('kicked-from-party', {
                partyCode: partyId,
                notification: {
                  ...createLivePartyNotification({
                    type: 'party_player_kicked',
                    partyId,
                    party: result.updatedParty,
                    player: result.actorPlayer || result.removedPlayer,
                    logLabel
                  }),
                  perspective: 'removed-player'
                }
              });
            }
            removedSocket.leave(partyId);
          }

        }

        if (!result?.isSelfRemoval) {
          io.to(partyId).emit('user-kicked', {
            socketId: removedSocketId,
            computerId: computerIdToRemove,
            username:
              result.removedPlayer?.identity?.username ||
              result.removedPlayer?.username,
            notification: {
              ...createLivePartyNotification({
                type: 'party_player_kicked',
                partyId,
                party: result.updatedParty,
                player: result.removedPlayer,
                logLabel
              }),
              perspective: 'lobby'
            }
          });
        }

        if (result?.hostRepair?.hostChanged) {
          emitPartyHostChanged({
            partyId,
            party: result.updatedParty,
            previousHostId: result.hostRepair.previousHostId,
            newHostPlayer: result.hostRepair.newHostPlayer,
            logLabel
          });
        }

        res.apiSuccess({
          message:
            'User removed successfully from session and waiting room (if present)'
        });
      } catch (err) {
        console.error(
          `[REQ ${req.id}] ❌ Error removing user from ${logLabel.toLowerCase()}:`,
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
                : 'party_remove_user_internal_error'
          }
        });
        res.apiError({
          status,
          code:
            typeof err.code === 'string'
              ? err.code
              : 'party_remove_user_internal_error',
          message: err.message || 'Internal server error'
        });
      }
    });
  }

  function createDisconnectUserHandler({
    route,
    mainModel,
    waitingRoomModel,
    logLabel
  }) {
    app.post(route, async (req, res) => {
      try {
        const body = parseBeaconBody(req.body);
        assertDisconnectPlayerBody(body);
        const { partyId, computerId, partyCode } = body;
        const actualPartyId = partyId || partyCode;
        const principal = await getPartyRequestPrincipal(req, res);
        const party = await mainModel
          .findOne({ partyId: actualPartyId })
          .select(
            '+players.identity.guestIdHash +players.identity.partyOwnerIdHash'
          )
          .lean();
        assertPrincipalOwnsPlayer(party, computerId, principal);

        const shouldUseGrace = shouldUseDisconnectGrace(party);
        const disconnectArgs = {
          partyId: actualPartyId,
          computerId,
          mainModel,
          waitingRoomModel,
          logLabel,
          socketId: body.socketId ?? body.actorSocketId ?? null
        };
        const updated = shouldUseGrace
          ? await beginTruthOrDareDisconnectGrace(disconnectArgs)
          : await disconnectPartyPlayer({
              ...disconnectArgs,
              writeChat: true
            });

        if (!updated) {
          await recordPartyRouteError({
            err: new Error(`${logLabel} or player not found`),
            req,
            mainModel,
            waitingRoomModel,
            details: {
              status: 404,
              code: 'party_or_player_not_found'
            }
          });
          return res.apiError({
            status: 404,
            code: 'party_or_player_not_found',
            message: `${logLabel} or player not found`
          });
        }

        res.apiSuccess({
          message:
            'Socket ID reset successfully in session and waiting room (if present)',
          updated
        });
      } catch (err) {
        console.error(
          `[REQ ${req.id}] ❌ Error resetting socket ID for ${logLabel.toLowerCase()}:`,
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
                : 'party_disconnect_user_internal_error'
          }
        });
        res.apiError({
          status,
          code:
            typeof err.code === 'string'
              ? err.code
              : 'party_disconnect_user_internal_error',
          message: err.message || 'Internal server error'
        });
      }
    });
  }

  return {
    createDisbandPartyHandler,
    createRemoveUserHandler,
    createDisconnectUserHandler
  };
}

module.exports = {
  createPartyExitRoutes,
  shouldDisbandPartyForExit
};
