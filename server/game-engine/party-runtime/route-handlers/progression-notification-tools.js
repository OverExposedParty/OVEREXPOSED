function createPartyProgressionNotificationTools(context) {
  const { io, debugWarn, getPartyPlayerAccountId } = context;

  function getPlayerAccountId(player) {
    return (
      getPartyPlayerAccountId?.(player) ||
      player?.identity?.accountId ||
      player?.accountId ||
      null
    );
  }

  function getPlayerSocketId(player) {
    return player?.connection?.socketId ?? player?.socketId ?? null;
  }

  function emitPartyProgressionNotifications({
    partyId,
    players = [],
    deliveries = []
  } = {}) {
    if (!io || !Array.isArray(players) || !Array.isArray(deliveries)) return 0;

    const notificationsByAccount = new Map();
    deliveries.forEach(({ accountId, notifications }) => {
      const normalizedAccountId = String(accountId || '');
      if (!normalizedAccountId || !Array.isArray(notifications)) return;
      const accountNotifications =
        notificationsByAccount.get(normalizedAccountId) || new Map();
      notifications.forEach((notification) => {
        const notificationId = String(notification?.id || '');
        if (notificationId)
          accountNotifications.set(notificationId, notification);
      });
      notificationsByAccount.set(normalizedAccountId, accountNotifications);
    });

    let emitted = 0;
    notificationsByAccount.forEach((notifications, accountId) => {
      if (!notifications.size) return;
      const socketIds = new Set(
        players
          .filter(
            (player) => String(getPlayerAccountId(player) || '') === accountId
          )
          .map(getPlayerSocketId)
          .filter((socketId) => socketId && socketId !== 'DISCONNECTED')
      );

      socketIds.forEach((socketId) => {
        const socket = io.sockets?.sockets?.get?.(socketId);
        if (!socket) return;
        if (partyId && socket.rooms?.has && !socket.rooms.has(partyId)) return;
        try {
          io.to(socketId).emit('account-progression-notifications', {
            notifications: [...notifications.values()]
          });
          emitted += 1;
        } catch (error) {
          debugWarn?.(
            `Failed to emit progression notifications to socket ${socketId}: ${error.message}`
          );
        }
      });
    });

    return emitted;
  }

  return { emitPartyProgressionNotifications };
}

module.exports = { createPartyProgressionNotificationTools };
