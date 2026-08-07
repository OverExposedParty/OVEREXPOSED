const DEFAULT_AUTH_TRANSITION_LEASE_MS = 5 * 60 * 1000;
const DEFAULT_AUTH_TRANSITION_MAX_MS = 20 * 60 * 1000;

function createPartyAuthTransitionRoutes(context) {
  const {
    app,
    io,
    crypto,
    assertPartyId,
    recordPartyRouteError,
    getPartyPlayerId,
    getPartyRequestPrincipal,
    assertPrincipalOwnsPlayer,
    withoutGuestHashes,
    withPartyJoinLock,
    disconnectPartyPlayer,
    forgetSocketPartyMembership,
    getPlayerConnectionSocketId,
    createLivePartyNotification,
    AUTH_TRANSITION_LEASE_MS = DEFAULT_AUTH_TRANSITION_LEASE_MS,
    AUTH_TRANSITION_MAX_MS = DEFAULT_AUTH_TRANSITION_MAX_MS
  } = context;
  const transitionsById = new Map();
  const transitionIdsByPlayer = new Map();

  function getPlayerKey(partyId, computerId) {
    return `${String(partyId).toUpperCase()}:${String(computerId)}`;
  }

  function clearTransition(transition) {
    if (!transition) return;
    if (transition.timer) clearTimeout(transition.timer);
    transitionsById.delete(transition.id);
    const playerKey = getPlayerKey(transition.partyId, transition.computerId);
    if (transitionIdsByPlayer.get(playerKey) === transition.id) {
      transitionIdsByPlayer.delete(playerKey);
    }
  }

  function cancelAuthTransitionForPlayer(partyId, computerId) {
    const transitionId = transitionIdsByPlayer.get(
      getPlayerKey(partyId, computerId)
    );
    const transition = transitionId ? transitionsById.get(transitionId) : null;
    clearTransition(transition);
    return Boolean(transition);
  }

  function hasAuthTransitionForPlayer(partyId, computerId) {
    const transitionId = transitionIdsByPlayer.get(
      getPlayerKey(partyId, computerId)
    );
    return Boolean(transitionId && transitionsById.has(transitionId));
  }

  function getTransition(body = {}) {
    const transition = transitionsById.get(String(body.transitionId || ''));
    if (
      !transition ||
      transition.expiring === true ||
      String(transition.token) !== String(body.token || '') ||
      String(transition.partyId).toUpperCase() !==
        String(body.partyId || '').toUpperCase() ||
      String(transition.computerId) !== String(body.computerId || '')
    ) {
      return null;
    }
    return transition;
  }

  async function updateTransitionReconnectState(transition) {
    return withPartyJoinLock(transition.partyId, async () => {
      if (transitionsById.get(transition.id) !== transition) return false;

      const reconnectDeadline = new Date(transition.expiresAt);
      const now = new Date();
      const session = await transition.mainModel
        .findOne({ partyId: transition.partyId })
        .select(
          '+players.identity.guestIdHash +players.identity.partyOwnerIdHash'
        );
      const player = session?.players?.find(
        (entry) =>
          String(getPartyPlayerId(entry)) === String(transition.computerId)
      );
      if (!session || !player) return false;

      player.state ||= {};
      if (player.state.participationStatus !== 'pending_next_round') {
        player.state.participationStatus = 'reconnecting';
        player.state.reconnectDeadline = reconnectDeadline;
      }
      player.connection ||= {};
      player.connection.lastPing = now;
      if (session.state) session.state.lastPinged = now;
      await session.save();

      if (transition.waitingRoomModel) {
        const waitingRoom = await transition.waitingRoomModel
          .findOne({ partyId: transition.partyId })
          .select(
            '+players.identity.guestIdHash +players.identity.partyOwnerIdHash'
          );
        const waitingPlayer = waitingRoom?.players?.find(
          (entry) =>
            String(getPartyPlayerId(entry)) === String(transition.computerId)
        );
        if (waitingPlayer) {
          waitingPlayer.state ||= {};
          if (
            waitingPlayer.state.participationStatus !== 'pending_next_round'
          ) {
            waitingPlayer.state.participationStatus = 'reconnecting';
            waitingPlayer.state.reconnectDeadline = reconnectDeadline;
          }
          waitingPlayer.connection ||= {};
          waitingPlayer.connection.lastPing = now;
          if (waitingRoom.state) waitingRoom.state.lastPinged = now;
          await waitingRoom.save();
        }
      }

      return true;
    });
  }

  async function completeTransitionReconnectState(transition) {
    return withPartyJoinLock(transition.partyId, async () => {
      if (
        transitionsById.get(transition.id) !== transition ||
        transition.expiring === true
      ) {
        return null;
      }

      const now = new Date();
      const session = await transition.mainModel
        .findOne({ partyId: transition.partyId })
        .select(
          '+players.identity.guestIdHash +players.identity.partyOwnerIdHash'
        );
      const player = session?.players?.find(
        (entry) =>
          String(getPartyPlayerId(entry)) === String(transition.computerId)
      );
      if (!session || !player) return null;

      player.state ||= {};
      if (player.state.participationStatus === 'reconnecting') {
        player.state.participationStatus = 'active';
      }
      player.state.reconnectDeadline = null;
      player.connection ||= {};
      player.connection.lastPing = now;
      if (session.state) session.state.lastPinged = now;
      await session.save();

      let waitingRoom = null;
      if (transition.waitingRoomModel) {
        waitingRoom = await transition.waitingRoomModel
          .findOne({ partyId: transition.partyId })
          .select(
            '+players.identity.guestIdHash +players.identity.partyOwnerIdHash'
          );
        const waitingPlayer = waitingRoom?.players?.find(
          (entry) =>
            String(getPartyPlayerId(entry)) === String(transition.computerId)
        );
        if (waitingPlayer) {
          waitingPlayer.state ||= {};
          if (waitingPlayer.state.participationStatus === 'reconnecting') {
            waitingPlayer.state.participationStatus = 'active';
          }
          waitingPlayer.state.reconnectDeadline = null;
          waitingPlayer.connection ||= {};
          waitingPlayer.connection.lastPing = now;
          if (waitingRoom.state) waitingRoom.state.lastPinged = now;
          await waitingRoom.save();
        }
      }

      clearTransition(transition);
      return {
        updated: withoutGuestHashes(session),
        waitingRoom: waitingRoom ? withoutGuestHashes(waitingRoom) : null
      };
    });
  }

  async function removeExpiredLobbyPlayer(transition) {
    const {
      partyId,
      computerId,
      socketId,
      mainModel,
      waitingRoomModel,
      logLabel
    } = transition;

    const result = await withPartyJoinLock(partyId, async () => {
      if (transitionsById.get(transition.id) !== transition) return null;
      const session = await mainModel
        .findOne({ partyId })
        .select(
          '+players.identity.guestIdHash +players.identity.partyOwnerIdHash'
        );
      if (!session) return null;

      const isLobby =
        session.state?.isPlaying === false && session.state?.phase === 'lobby';
      if (!isLobby) return { partyStarted: true };

      const hostComputerId = session.state?.hostComputerId ?? null;
      if (String(hostComputerId || '') === String(computerId)) return null;

      const removedPlayer = session.players.find(
        (player) => String(getPartyPlayerId(player)) === String(computerId)
      );
      if (!removedPlayer) return null;

      const removedPlayerSnapshot = removedPlayer?.toObject
        ? removedPlayer.toObject()
        : structuredClone(removedPlayer);
      const removedSocketId = getPlayerConnectionSocketId(removedPlayer);
      session.players = session.players.filter(
        (player) => String(getPartyPlayerId(player)) !== String(computerId)
      );
      if (session.state) session.state.lastPinged = new Date();
      await session.save();

      if (waitingRoomModel) {
        const waitingRoom = await waitingRoomModel
          .findOne({ partyId })
          .select(
            '+players.identity.guestIdHash +players.identity.partyOwnerIdHash'
          );
        if (waitingRoom) {
          const previousCount = waitingRoom.players.length;
          waitingRoom.players = waitingRoom.players.filter(
            (player) => String(getPartyPlayerId(player)) !== String(computerId)
          );
          if (waitingRoom.players.length !== previousCount) {
            if (waitingRoom.state) waitingRoom.state.lastPinged = new Date();
            await waitingRoom.save();
          }
        }
      }

      forgetSocketPartyMembership(
        removedSocketId || socketId,
        partyId,
        computerId
      );
      return {
        removedPlayer: removedPlayerSnapshot,
        removedSocketId,
        updatedParty: withoutGuestHashes(session)
      };
    });

    if (!result) return;
    if (result.partyStarted) {
      await disconnectPartyPlayer({
        partyId,
        computerId,
        mainModel,
        waitingRoomModel,
        logLabel,
        socketId,
        writeChat: true
      });
      return;
    }

    io.to(partyId).emit('user-left', {
      socketId: result.removedSocketId,
      computerId,
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

    if (result.removedSocketId && result.removedSocketId !== 'DISCONNECTED') {
      io.sockets.sockets.get(result.removedSocketId)?.leave(partyId);
    }
  }

  function scheduleTransitionExpiry(transition) {
    if (transition.timer) clearTimeout(transition.timer);
    const delay = Math.max(0, transition.expiresAt - Date.now());
    transition.timer = setTimeout(async () => {
      if (transitionsById.get(transition.id) !== transition) return;
      if (Date.now() < transition.expiresAt) {
        scheduleTransitionExpiry(transition);
        return;
      }
      transition.expiring = true;
      try {
        await removeExpiredLobbyPlayer(transition);
      } catch (error) {
        console.error(
          `Failed to expire auth transition for ${transition.computerId} in ${transition.partyId}:`,
          error
        );
      } finally {
        clearTransition(transition);
      }
    }, delay);
    transition.timer.unref?.();
  }

  function sendTransitionError(res, status, code, message) {
    return res.apiError({ status, code, message });
  }

  function createAuthTransitionHandlers({
    route,
    mainModel,
    waitingRoomModel,
    logLabel
  }) {
    app.post(`${route}/begin`, async (req, res) => {
      try {
        const partyId = req.body?.partyId || req.query?.partyCode;
        const computerId = req.body?.computerId;
        assertPartyId(partyId);
        if (!computerId) {
          return sendTransitionError(
            res,
            400,
            'party_auth_transition_player_required',
            'A party player is required.'
          );
        }

        const principal = await getPartyRequestPrincipal(req, res);
        const party = await mainModel
          .findOne({ partyId })
          .select(
            '+players.identity.guestIdHash +players.identity.partyOwnerIdHash'
          );
        if (!party) {
          return sendTransitionError(
            res,
            404,
            'party_not_found',
            `${logLabel} not found`
          );
        }
        assertPrincipalOwnsPlayer(party, computerId, principal);

        const player = party.players.find(
          (entry) => String(getPartyPlayerId(entry)) === String(computerId)
        );
        const isLobby =
          party.state?.isPlaying === false && party.state?.phase === 'lobby';
        const isGameSession =
          party.state?.isPlaying === true || party.state?.phase === 'game-over';
        const isHost =
          String(party.state?.hostComputerId || '') === String(computerId);
        if (!player || (!isLobby && !isGameSession) || (isLobby && isHost)) {
          return sendTransitionError(
            res,
            409,
            'party_auth_transition_unavailable',
            'This player cannot start an authentication transition.'
          );
        }

        cancelAuthTransitionForPlayer(partyId, computerId);
        const now = Date.now();
        const transition = {
          id: crypto.randomUUID(),
          token: crypto.randomBytes(32).toString('base64url'),
          partyId: String(partyId).toUpperCase(),
          computerId: String(computerId),
          socketId: req.body?.socketId || null,
          mainModel,
          waitingRoomModel,
          logLabel,
          hardExpiresAt: now + AUTH_TRANSITION_MAX_MS,
          expiresAt: now + AUTH_TRANSITION_LEASE_MS,
          expiring: false,
          timer: null
        };
        transitionsById.set(transition.id, transition);
        transitionIdsByPlayer.set(
          getPlayerKey(partyId, computerId),
          transition.id
        );
        const reconnectStateUpdated =
          await updateTransitionReconnectState(transition);
        if (!reconnectStateUpdated) {
          clearTransition(transition);
          return sendTransitionError(
            res,
            409,
            'party_auth_transition_unavailable',
            'This player is no longer available for authentication.'
          );
        }
        io.to(partyId).emit('user-authenticating', {
          socketId: getPlayerConnectionSocketId(player),
          computerId: String(computerId),
          username: player.identity?.username || player.username || 'Player',
          notification: createLivePartyNotification({
            type: 'party_player_signing_in',
            partyId,
            party,
            player,
            logLabel
          })
        });
        scheduleTransitionExpiry(transition);

        return res.apiSuccess({
          transitionId: transition.id,
          token: transition.token,
          expiresAt: new Date(transition.expiresAt).toISOString(),
          hardExpiresAt: new Date(transition.hardExpiresAt).toISOString()
        });
      } catch (error) {
        const status = Number.isInteger(error.status) ? error.status : 500;
        await recordPartyRouteError({
          err: error,
          req,
          mainModel,
          waitingRoomModel,
          details: { status, code: 'party_auth_transition_begin_failed' }
        });
        return sendTransitionError(
          res,
          status,
          error.code || 'party_auth_transition_begin_failed',
          error.message || 'Failed to begin the authentication transition.'
        );
      }
    });

    app.post(`${route}/heartbeat`, async (req, res) => {
      const transition = getTransition(req.body);
      if (!transition) {
        return sendTransitionError(
          res,
          404,
          'party_auth_transition_not_found',
          'The authentication transition has expired.'
        );
      }

      const now = Date.now();
      if (now >= transition.hardExpiresAt) {
        transition.expiresAt = now;
        transition.expiring = true;
        void removeExpiredLobbyPlayer(transition)
          .catch((error) => {
            console.error(
              'Failed to expire an authentication transition:',
              error
            );
          })
          .finally(() => clearTransition(transition));
        return sendTransitionError(
          res,
          410,
          'party_auth_transition_expired',
          'The authentication transition has reached its time limit.'
        );
      }

      transition.expiresAt = Math.min(
        now + AUTH_TRANSITION_LEASE_MS,
        transition.hardExpiresAt
      );
      const reconnectStateUpdated =
        await updateTransitionReconnectState(transition);
      if (!reconnectStateUpdated) {
        clearTransition(transition);
        return sendTransitionError(
          res,
          404,
          'party_auth_transition_not_found',
          'The party player is no longer available.'
        );
      }
      scheduleTransitionExpiry(transition);
      return res.apiSuccess({
        expiresAt: new Date(transition.expiresAt).toISOString(),
        hardExpiresAt: new Date(transition.hardExpiresAt).toISOString()
      });
    });

    app.post(`${route}/complete`, async (req, res) => {
      try {
        const transition = getTransition(req.body);
        if (!transition) {
          return sendTransitionError(
            res,
            404,
            'party_auth_transition_not_found',
            'The authentication transition has expired.'
          );
        }

        const completedState = await completeTransitionReconnectState(
          transition
        );
        if (!completedState) {
          clearTransition(transition);
          return sendTransitionError(
            res,
            404,
            'party_auth_transition_not_found',
            'The party player is no longer available.'
          );
        }

        return res.apiSuccess({ completed: true, ...completedState });
      } catch (error) {
        const status = Number.isInteger(error.status) ? error.status : 500;
        await recordPartyRouteError({
          err: error,
          req,
          mainModel,
          waitingRoomModel,
          details: { status, code: 'party_auth_transition_complete_failed' }
        });
        return sendTransitionError(
          res,
          status,
          error.code || 'party_auth_transition_complete_failed',
          error.message || 'Failed to complete the authentication transition.'
        );
      }
    });
  }

  return {
    cancelAuthTransitionForPlayer,
    createAuthTransitionHandlers,
    hasAuthTransitionForPlayer
  };
}

module.exports = {
  DEFAULT_AUTH_TRANSITION_LEASE_MS,
  DEFAULT_AUTH_TRANSITION_MAX_MS,
  createPartyAuthTransitionRoutes
};
