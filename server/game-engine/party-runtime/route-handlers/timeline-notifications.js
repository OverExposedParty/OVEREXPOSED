const {
  queueAccountNotification
} = require('../../../services/account-notifications');

function createPartyTimelineNotificationTools({ Account, crypto }) {
  function createPartyNotificationId() {
    if (typeof crypto?.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    if (typeof crypto?.randomBytes === 'function') {
      return `${Date.now()}:${crypto.randomBytes(8).toString('hex')}`;
    }
    return `${Date.now()}:${Math.random().toString(16).slice(2)}`;
  }

  function createPartyNotificationOccurrence({
    id = null,
    type,
    partyId,
    modeName,
    actor,
    createdAt = null
  }) {
    return {
      id: id || createPartyNotificationId(),
      type,
      partyId,
      modeName,
      actorAccountId: actor?.accountId || null,
      actorUsername: actor?.username || 'Player',
      actorOeIcon: actor?.oeIcon || null,
      createdAt: createdAt ? new Date(createdAt) : new Date()
    };
  }

  async function queuePartyAccountNotification({
    accountId,
    notification = null,
    type,
    partyId,
    modeName,
    actor
  }) {
    const notificationType = notification?.type || type;
    if (!Account || !accountId || !notificationType) return;

    try {
      const occurrence = createPartyNotificationOccurrence({
        id: notification?.id,
        type: notificationType,
        partyId: notification?.partyId || partyId,
        modeName: notification?.modeName || modeName,
        actor: notification
          ? {
              accountId: notification.actorAccountId,
              username: notification.actorUsername,
              oeIcon: notification.actorOeIcon
            }
          : actor,
        createdAt: notification?.createdAt
      });
      const account = await Account.findById(accountId);
      if (!account) return;
      queueAccountNotification(account, {
        id: occurrence.id,
        type: occurrence.type,
        actorAccountId: occurrence.actorAccountId,
        actorUsername: occurrence.actorUsername,
        actorOeIcon: occurrence.actorOeIcon,
        createdAt: occurrence.createdAt,
        metadata: {
          partyId: occurrence.partyId,
          modeName: occurrence.modeName
        }
      });
      await account.save();
      return occurrence;
    } catch (error) {
      console.error('Failed to queue party account notification:', error);
    }
  }

  return {
    createPartyNotificationOccurrence,
    queuePartyAccountNotification
  };
}

module.exports = { createPartyTimelineNotificationTools };
