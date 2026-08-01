const { createPartySocketStateTools } = require('./socket-tools/state-tools');
const {
  createPartyHostRepairTools
} = require('./socket-tools/host-repair-tools');
const {
  createPartyDisconnectTools
} = require('./socket-tools/disconnect-tools');
const {
  getAccountNotificationIds,
  serializeQueuedProgressionNotifications
} = require('../../../services/account-notifications');

function createPartySocketTools(context) {
  const {
    io,
    Account,
    Achievement,
    partyGameChatLogSchema,
    getPartyPlayerId,
    getPartyPlayerAccountId,
    unlockAchievementByKey,
    getPartyNotificationModeName,
    getPartyNotificationActor,
    createPartyNotificationOccurrence,
    queuePartyAccountNotification,
    withoutGuestHashes,
    emitPartyProgressionNotifications
  } = context;
  const stateTools = createPartySocketStateTools({ io });
  const { getPlayerConnectionSocketId, getConnectedPartyPlayers } = stateTools;

  async function announcePartyPlayerReconnected({
    partyId,
    party,
    player,
    logLabel
  }) {
    if (!partyId || !party || !player) return;

    const playerId = getPartyPlayerId(player);
    const username =
      player?.identity?.username || player?.username || 'A player';

    const chatLogSession = await partyGameChatLogSchema.findOneAndUpdate(
      { partyId },
      {
        $push: {
          chat: {
            username: '[CONSOLE]',
            message: `${username} has reconnected.`,
            eventType: 'connect'
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

    const hostComputerId = party?.state?.hostComputerId;
    const hostPlayer = Array.isArray(party?.players)
      ? party.players.find(
          (candidate) =>
            hostComputerId &&
            String(getPartyPlayerId(candidate)) === String(hostComputerId)
        )
      : null;
    const hostAccountId = getPartyPlayerAccountId(hostPlayer);
    const reconnectingAccountId = getPartyPlayerAccountId(player);
    const actor = getPartyNotificationActor(player);
    const notification = createPartyNotificationOccurrence({
      type: 'party_player_reconnected',
      partyId,
      modeName: getPartyNotificationModeName(party, logLabel),
      actor
    });

    io.to(partyId).emit('user-reconnected', {
      computerId: playerId,
      socketId: getPlayerConnectionSocketId(player),
      username,
      notification
    });

    if (
      hostAccountId &&
      String(hostAccountId) !== String(reconnectingAccountId || '')
    ) {
      queuePartyAccountNotification({
        accountId: hostAccountId,
        notification
      });
    }
  }

  async function unlockLastOneStandingForRemainingPlayer(session) {
    if (session?.state?.isPlaying !== true) return;

    const connectedPlayers = getConnectedPartyPlayers(
      Array.isArray(session.players) ? session.players : []
    );
    if (connectedPlayers.length !== 1) return;

    const accountId = getPartyPlayerAccountId(connectedPlayers[0]);
    if (!accountId) return;

    const account = await Account.findById(accountId);
    if (!account) return;
    const existingNotificationIds = getAccountNotificationIds(account);

    await unlockAchievementByKey({
      Achievement,
      account,
      key: 'last-one-standing',
      source: 'last-one-standing'
    });
    const notifications = serializeQueuedProgressionNotifications(account, {
      excludeIds: existingNotificationIds
    });
    emitPartyProgressionNotifications?.({
      partyId: session.partyId,
      players: session.players,
      deliveries: notifications.length
        ? [{ accountId: String(accountId), notifications }]
        : []
    });
  }

  const hostRepairTools = createPartyHostRepairTools({
    io,
    getPartyPlayerId,
    getPartyNotificationActor,
    getPartyNotificationModeName,
    withoutGuestHashes,
    isSocketIdActive: stateTools.isSocketIdActive,
    getPlayerConnectionSocketId
  });
  const disconnectTools = createPartyDisconnectTools({
    ...context,
    ...stateTools,
    ...hostRepairTools,
    unlockLastOneStandingForRemainingPlayer
  });

  return {
    ...stateTools,
    announcePartyPlayerReconnected,
    unlockLastOneStandingForRemainingPlayer,
    ...hostRepairTools,
    ...disconnectTools
  };
}

module.exports = { createPartySocketTools };
