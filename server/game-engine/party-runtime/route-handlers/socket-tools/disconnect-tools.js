function createPartyDisconnectTools({
  io,
  partyGameChatLogSchema,
  debugWarn,
  getPartyPlayerId,
  getPartyPlayerAccountId,
  getPartyNotificationModeName,
  getPartyNotificationActor,
  createPartyNotificationOccurrence,
  queuePartyAccountNotification,
  withoutGuestHashes,
  withPartyJoinLock,
  getDisconnectGraceKey,
  cancelDisconnectGrace,
  forgetSocketPartyMembership,
  getPlayerConnectionSocketId,
  getConnectedPartyPlayers,
  socketPartyMemberships,
  disconnectGraceTimers,
  DISCONNECT_GRACE_PERIOD_MS,
  repairPartyHost,
  emitPartyHostChanged,
  unlockLastOneStandingForRemainingPlayer
}) {
  async function disconnectPartyPlayer({
    partyId,
    computerId,
    mainModel,
    waitingRoomModel,
    logLabel,
    socketId = null,
    writeChat = true,
    emitLiveNotification = true,
    notificationOccurrence = null
  }) {
    return withPartyJoinLock(partyId, async () => {
      const session = await mainModel
        .findOne({ partyId })
        .select('+players.identity.guestIdHash');
      if (!session) {
        debugWarn(
          `Unable to disconnect ${computerId}; ${logLabel} ${partyId} was not found.`
        );
        return null;
      }

      const player = session.players.find(
        (partyPlayer) =>
          String(getPartyPlayerId(partyPlayer)) === String(computerId)
      );

      if (!player) {
        debugWarn(
          `Unable to disconnect ${computerId}; player was not found in ${logLabel} ${partyId}.`
        );
        return null;
      }

      const currentSocketId = getPlayerConnectionSocketId(player);
      if (currentSocketId === 'DISCONNECTED') {
        forgetSocketPartyMembership(socketId, partyId, computerId);
        return session.toObject ? session.toObject() : session;
      }

      if (
        socketId &&
        currentSocketId &&
        currentSocketId !== 'DISCONNECTED' &&
        String(currentSocketId) !== String(socketId)
      ) {
        forgetSocketPartyMembership(socketId, partyId, computerId);
        return session.toObject ? session.toObject() : session;
      }

      const connectedBefore = getConnectedPartyPlayers(
        Array.isArray(session.players) ? session.players : []
      ).length;

      if (!player.connection) {
        player.connection = {};
      }
      const previousParticipationStatus =
        player.state?.participationStatus || 'active';
      const wasPendingNextRound =
        previousParticipationStatus === 'pending_next_round';
      player.connection.socketId = 'DISCONNECTED';
      player.connection.lastPing = new Date();
      player.socketId = 'DISCONNECTED';
      if (player.state) {
        player.state.participationStatus = wasPendingNextRound
          ? 'pending_next_round'
          : 'disconnected';
        player.state.reconnectDeadline = null;
      }

      if (session.state) {
        if (
          !wasPendingNextRound &&
          Array.isArray(session.state.roundParticipantIds)
        ) {
          session.state.roundParticipantIds =
            session.state.roundParticipantIds.filter(
              (playerId) => String(playerId) !== String(computerId)
            );
        }
        if (
          !wasPendingNextRound &&
          Array.isArray(session.state.playerTurnOrder)
        ) {
          const previousOrder = session.state.playerTurnOrder;
          const previousTurn = Number(session.state.playerTurn) || 0;
          const currentTurnId = previousOrder.length
            ? previousOrder[
                ((previousTurn % previousOrder.length) + previousOrder.length) %
                  previousOrder.length
              ]
            : null;
          session.state.playerTurnOrder = session.state.playerTurnOrder.filter(
            (playerId) => String(playerId) !== String(computerId)
          );
          if (session.state.playerTurnOrder.length > 0) {
            const preservedTurnIndex = session.state.playerTurnOrder.findIndex(
              (playerId) => String(playerId) === String(currentTurnId)
            );
            session.state.playerTurn =
              preservedTurnIndex >= 0
                ? preservedTurnIndex
                : previousTurn % session.state.playerTurnOrder.length;
          } else {
            session.state.playerTurn = 0;
          }
        }
        session.state.lastPinged = new Date();
      } else {
        session.lastPinged = new Date();
      }

      const waitingRoomSession = waitingRoomModel
        ? await waitingRoomModel
            .findOne({ partyId })
            .select('+players.identity.guestIdHash')
        : null;
      if (waitingRoomSession) {
        const waitingPlayer = waitingRoomSession.players.find(
          (partyPlayer) =>
            String(getPartyPlayerId(partyPlayer)) === String(computerId)
        );
        if (waitingPlayer) {
          if (!waitingPlayer.connection) {
            waitingPlayer.connection = {};
          }
          waitingPlayer.connection.socketId = 'DISCONNECTED';
          waitingPlayer.connection.lastPing = new Date();
          waitingPlayer.socketId = 'DISCONNECTED';
          if (waitingPlayer.state) {
            waitingPlayer.state.participationStatus = wasPendingNextRound
              ? 'pending_next_round'
              : 'disconnected';
            waitingPlayer.state.reconnectDeadline = null;
          }
          waitingRoomSession.state = waitingRoomSession.state || {
            isPlaying: Boolean(session.state?.isPlaying)
          };
          waitingRoomSession.state.lastPinged = new Date();
          await waitingRoomSession.save();
        }
      }

      const chatLogSession = writeChat
        ? await partyGameChatLogSchema.findOne({ partyId })
        : null;

      if (chatLogSession) {
        chatLogSession.chat.push({
          username: '[CONSOLE]',
          message: `${player.identity?.username || player.username || 'A player'} has been disconnected.`,
          eventType: 'disconnect'
        });
      }

      const hostRepair = await repairPartyHost({
        session,
        waitingRoomModel,
        chatLogSession,
        ignoreComputerId: computerId
      });

      const disconnectedAccountId = getPartyPlayerAccountId(player);
      const actor = getPartyNotificationActor(player);
      const disconnectNotification =
        notificationOccurrence ||
        createPartyNotificationOccurrence({
          type: 'party_player_disconnected',
          partyId,
          modeName: getPartyNotificationModeName(session, logLabel),
          actor
        });
      const notificationHost = Array.isArray(session.players)
        ? session.players.find(
            (candidate) =>
              session.state?.hostComputerId &&
              String(getPartyPlayerId(candidate)) ===
                String(session.state.hostComputerId)
          )
        : null;
      const notificationHostAccountId =
        getPartyPlayerAccountId(notificationHost);
      if (
        notificationHostAccountId &&
        String(notificationHostAccountId) !==
          String(disconnectedAccountId || '')
      ) {
        queuePartyAccountNotification({
          accountId: notificationHostAccountId,
          notification: disconnectNotification
        });
      }

      await session.save();
      if (connectedBefore > 1) {
        await unlockLastOneStandingForRemainingPlayer(session);
      }
      if (chatLogSession) {
        await chatLogSession.save();
        io.to(partyId).emit('chat-updated', {
          type: 'update',
          chatLog: chatLogSession,
          documentKey: partyId
        });
      }

      forgetSocketPartyMembership(currentSocketId, partyId, computerId);
      if (socketId && socketId !== currentSocketId) {
        forgetSocketPartyMembership(socketId, partyId, computerId);
      }

      if (emitLiveNotification) {
        io.to(partyId).emit('user-disconnected', {
          computerId,
          socketId: currentSocketId,
          username: actor.username,
          notification: disconnectNotification
        });
      }
      if (hostRepair?.hostChanged) {
        emitPartyHostChanged({
          partyId,
          party: session,
          previousHostId: hostRepair.previousHostId,
          newHostPlayer: hostRepair.newHostPlayer,
          logLabel
        });
      }

      return withoutGuestHashes(session);
    });
  }

  async function beginTruthOrDareDisconnectGrace({
    partyId,
    computerId,
    mainModel,
    waitingRoomModel,
    logLabel,
    socketId = null
  }) {
    const graceKey = getDisconnectGraceKey(partyId, computerId);
    cancelDisconnectGrace(partyId, computerId);

    const result = await withPartyJoinLock(partyId, async () => {
      const session = await mainModel
        .findOne({ partyId })
        .select('+players.identity.guestIdHash');
      if (!session) return null;

      const player = session.players.find(
        (entry) => String(getPartyPlayerId(entry)) === String(computerId)
      );
      if (!player) return null;

      const currentSocketId = getPlayerConnectionSocketId(player);
      if (
        socketId &&
        currentSocketId &&
        currentSocketId !== 'DISCONNECTED' &&
        String(socketId) !== String(currentSocketId)
      ) {
        return { party: withoutGuestHashes(session), shouldSchedule: false };
      }

      if (player.state?.participationStatus === 'pending_next_round') {
        if (!player.connection) {
          player.connection = {};
        }
        player.connection.socketId = 'DISCONNECTED';
        player.connection.lastPing = new Date();
        player.socketId = 'DISCONNECTED';
        player.state.reconnectDeadline = null;
        session.state.lastPinged = new Date();
        await session.save();

        if (waitingRoomModel) {
          await waitingRoomModel.findOneAndUpdate(
            {
              partyId,
              'players.identity.computerId': computerId
            },
            {
              $set: {
                'players.$.connection.socketId': 'DISCONNECTED',
                'players.$.connection.lastPing': new Date(),
                'players.$.socketId': 'DISCONNECTED',
                'players.$.state.participationStatus': 'pending_next_round',
                'players.$.state.reconnectDeadline': null,
                'state.lastPinged': new Date()
              }
            }
          );
        }

        return { party: withoutGuestHashes(session), shouldSchedule: false };
      }

      const reconnectDeadline = new Date(
        Date.now() + DISCONNECT_GRACE_PERIOD_MS
      );
      player.state ||= {};
      player.state.participationStatus = 'reconnecting';
      player.state.reconnectDeadline = reconnectDeadline;
      session.state.lastPinged = new Date();
      await session.save();

      if (waitingRoomModel) {
        await waitingRoomModel.findOneAndUpdate(
          {
            partyId,
            'players.identity.computerId': computerId
          },
          {
            $set: {
              'players.$.state.participationStatus': 'reconnecting',
              'players.$.state.reconnectDeadline': reconnectDeadline,
              'state.lastPinged': new Date()
            }
          }
        );
      }

      const actor = getPartyNotificationActor(player);
      const disconnectNotification = createPartyNotificationOccurrence({
        type: 'party_player_disconnected',
        partyId,
        modeName: getPartyNotificationModeName(session, logLabel),
        actor
      });
      const chatLogSession = await partyGameChatLogSchema.findOneAndUpdate(
        { partyId },
        {
          $push: {
            chat: {
              username: '[CONSOLE]',
              message: `${actor.username || 'A player'} has been disconnected.`,
              eventType: 'disconnect'
            }
          },
          $set: { lastPinged: new Date() },
          $setOnInsert: { partyId }
        },
        { new: true, upsert: true }
      );
      io.to(partyId).emit('chat-updated', {
        type: 'update',
        chatLog: chatLogSession,
        documentKey: partyId
      });
      io.to(partyId).emit('user-disconnected', {
        computerId,
        socketId: getPlayerConnectionSocketId(player),
        username: actor.username,
        notification: disconnectNotification
      });

      return {
        party: withoutGuestHashes(session),
        shouldSchedule: true,
        notification: disconnectNotification
      };
    });

    if (!result) return null;
    if (!result.shouldSchedule) return result.party;

    const timer = setTimeout(async () => {
      disconnectGraceTimers.delete(graceKey);
      try {
        await disconnectPartyPlayer({
          partyId,
          computerId,
          mainModel,
          waitingRoomModel,
          logLabel,
          socketId,
          writeChat: false,
          emitLiveNotification: false,
          notificationOccurrence: result.notification
        });
      } catch (error) {
        debugWarn(
          `Failed to expire disconnect grace for ${computerId} in ${partyId}: ${error.message}`
        );
      }
    }, DISCONNECT_GRACE_PERIOD_MS);
    timer.unref?.();
    disconnectGraceTimers.set(graceKey, timer);
    return result.party;
  }

  async function disconnectSocketPartyMemberships(socketId) {
    // A Socket.IO connection also closes during normal full-page navigation.
    // Do not transfer party ownership or mark a player disconnected here: the
    // page's explicit exit beacon handles real departures, while the next page
    // refreshes its socket ID after navigation.
    socketPartyMemberships.delete(socketId);
  }

  return {
    disconnectPartyPlayer,
    beginTruthOrDareDisconnectGrace,
    disconnectSocketPartyMemberships
  };
}

module.exports = { createPartyDisconnectTools };
