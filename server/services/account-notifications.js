const crypto = require('node:crypto');

const FRIEND_NOTIFICATION_TYPES = new Set([
  'friend_request',
  'friend_accepted',
  'session_invite',
  'session_invite_accepted',
  'session_invite_declined',
  'friend_joinable_session_started',
  'friend_online'
]);
const PARTY_NOTIFICATION_TYPES = new Set([
  'party_player_joined',
  'party_player_left',
  'party_player_kicked',
  'party_player_disconnected',
  'party_player_reconnected',
  'party_host_changed',
  'party_disbanded'
]);
const PROGRESSION_NOTIFICATION_TYPES = new Set([
  'achievement_unlocked',
  'opal_reward'
]);
const TOAST_ONLY_NOTIFICATION_TYPES = new Set([
  'session_invite_accepted',
  'session_invite_declined',
  'friend_joinable_session_started',
  'friend_online',
  ...PARTY_NOTIFICATION_TYPES
]);
const MAX_ACCOUNT_NOTIFICATIONS = 200;

function inferNotificationCategory(type) {
  if (FRIEND_NOTIFICATION_TYPES.has(type)) return 'social';
  if (PARTY_NOTIFICATION_TYPES.has(type)) return 'party';
  if (PROGRESSION_NOTIFICATION_TYPES.has(type)) return 'progression';
  return 'system';
}

function inferNotificationDelivery(type) {
  return TOAST_ONLY_NOTIFICATION_TYPES.has(type) ? 'toast' : 'both';
}

function getNotificationDelivery(notification) {
  return (
    notification?.delivery || inferNotificationDelivery(notification?.type)
  );
}

function getAccountNotifications(account) {
  if (!account.gameData) account.gameData = {};
  if (!Array.isArray(account.gameData.notifications)) {
    account.gameData.notifications = [];
  }
  return account.gameData.notifications;
}

function createAccountNotificationState() {
  return {
    notificationId: crypto.randomUUID(),
    notificationPending: true
  };
}

function queueAccountNotification(account, notification = {}) {
  if (!account || !notification.type) return null;

  const notifications = getAccountNotifications(account);
  const notificationId = String(
    notification.id || notification.notificationId || crypto.randomUUID()
  );
  const existing = notifications.find(
    (entry) => String(entry.notificationId || '') === notificationId
  );
  if (existing) return existing;

  const queued = {
    notificationId,
    type: notification.type,
    category:
      notification.category || inferNotificationCategory(notification.type),
    delivery:
      notification.delivery || inferNotificationDelivery(notification.type),
    actorAccountId: notification.actorAccountId || null,
    actorUsername: notification.actorUsername || null,
    actorOeIcon: notification.actorOeIcon || null,
    title: notification.title || null,
    body: notification.body || null,
    action: notification.action || null,
    metadata: notification.metadata || {},
    createdAt: notification.createdAt
      ? new Date(notification.createdAt)
      : new Date(),
    deliveredAt: notification.deliveredAt || null,
    readAt: notification.readAt || null,
    dismissedAt: notification.dismissedAt || null
  };
  notifications.push(queued);

  if (notifications.length > MAX_ACCOUNT_NOTIFICATIONS) {
    const removable = notifications
      .map((entry, index) => ({ entry, index }))
      .filter(
        ({ entry }) =>
          entry.readAt ||
          entry.dismissedAt ||
          (getNotificationDelivery(entry) === 'toast' && entry.deliveredAt)
      )
      .slice(0, notifications.length - MAX_ACCOUNT_NOTIFICATIONS)
      .map(({ index }) => index);
    for (let index = removable.length - 1; index >= 0; index -= 1) {
      notifications.splice(removable[index], 1);
    }
  }

  account.markModified?.('gameData.notifications');
  return queued;
}

function getNotificationTimestamp(notification) {
  return new Date(notification.createdAt || 0).getTime();
}

function isAchievementOpalNotification(notification) {
  if (notification?.type !== 'opal_reward') return false;
  const metadata =
    notification?.metadata?.toObject?.() || notification?.metadata || {};
  return String(metadata.sourceType || '').toLowerCase() === 'achievement';
}

function getOpalNotificationLabel(transaction) {
  if (transaction.sourceType === 'admin') return 'Admin Opal grant';
  if (transaction.sourceType === 'achievement') return 'Achievement reward';
  if (transaction.sourceType === 'game_reward') return 'Game reward';
  if (transaction.type === 'refund') return 'Opal refund';
  if (transaction.sourceType === 'daily_reward') return 'Daily Opal reward';
  return 'Opal reward';
}

function serializeAccountNotification(notification) {
  const metadata =
    notification?.metadata?.toObject?.() || notification?.metadata || {};
  return {
    ...metadata,
    id: String(notification.notificationId || ''),
    type: notification.type,
    category:
      notification.category || inferNotificationCategory(notification.type),
    delivery: getNotificationDelivery(notification),
    actorAccountId: notification.actorAccountId
      ? String(notification.actorAccountId?._id || notification.actorAccountId)
      : null,
    actorUsername: notification.actorUsername || null,
    actorOeIcon: notification.actorOeIcon || null,
    title: notification.title || null,
    body: notification.body || null,
    action: notification.action?.toObject?.() || notification.action || null,
    createdAt: notification.createdAt || null,
    deliveredAt: notification.deliveredAt || null,
    readAt: notification.readAt || null
  };
}

function serializeProgressionNotification(notification) {
  const serialized = serializeAccountNotification(notification);
  if (serialized.type === 'achievement_unlocked') {
    return {
      id: serialized.id,
      type: serialized.type,
      achievementKey: serialized.achievementKey,
      rewardStatus: serialized.rewardStatus,
      rewardResults: serialized.rewardResults,
      createdAt: serialized.createdAt
    };
  }
  return {
    id: serialized.id,
    type: serialized.type,
    amount: serialized.amount,
    balance: serialized.balance,
    label: serialized.label,
    reason: serialized.reason,
    sourceType: serialized.sourceType,
    sourceId: serialized.sourceId || null,
    createdAt: serialized.createdAt
  };
}

function getAccountNotificationIds(account) {
  return new Set(
    getAccountNotifications(account)
      .map((notification) => String(notification?.notificationId || ''))
      .filter(Boolean)
  );
}

function serializeQueuedProgressionNotifications(
  account,
  { excludeIds = [] } = {}
) {
  const excluded = new Set(Array.from(excludeIds, String));
  return getAccountNotifications(account)
    .filter(
      (notification) =>
        !notification.deliveredAt &&
        !notification.dismissedAt &&
        !isAchievementOpalNotification(notification) &&
        PROGRESSION_NOTIFICATION_TYPES.has(notification.type) &&
        !excluded.has(String(notification.notificationId || ''))
    )
    .map(serializeProgressionNotification);
}

function serializePendingNotifications(
  account,
  { categories = null, deliveries = null, types = null, limit = 20 } = {}
) {
  const categorySet = categories ? new Set(categories) : null;
  const deliverySet = deliveries ? new Set(deliveries) : null;
  const typeSet = types ? new Set(types) : null;
  return getAccountNotifications(account)
    .filter(
      (notification) =>
        !notification.deliveredAt &&
        !notification.dismissedAt &&
        !isAchievementOpalNotification(notification) &&
        (!categorySet || categorySet.has(notification.category)) &&
        (!deliverySet ||
          deliverySet.has(getNotificationDelivery(notification))) &&
        (!typeSet || typeSet.has(notification.type))
    )
    .slice()
    .sort(
      (left, right) =>
        getNotificationTimestamp(left) - getNotificationTimestamp(right)
    )
    .slice(0, Math.max(0, Math.trunc(Number(limit) || 0)))
    .map(serializeAccountNotification);
}

function serializeInboxNotifications(account, { limit = 50 } = {}) {
  return getAccountNotifications(account)
    .filter(
      (notification) =>
        !notification.dismissedAt &&
        !isAchievementOpalNotification(notification) &&
        getNotificationDelivery(notification) !== 'toast'
    )
    .slice()
    .sort(
      (left, right) =>
        getNotificationTimestamp(right) - getNotificationTimestamp(left)
    )
    .slice(0, Math.max(0, Math.trunc(Number(limit) || 0)))
    .map(serializeAccountNotification);
}

function countUnreadNotifications(account) {
  return getAccountNotifications(account).filter(
    (notification) =>
      !notification.readAt &&
      !notification.dismissedAt &&
      !isAchievementOpalNotification(notification) &&
      getNotificationDelivery(notification) !== 'toast'
  ).length;
}

function markNotificationsDelivered(
  account,
  notificationIds,
  deliveredAt = new Date()
) {
  const ids = new Set(
    (Array.isArray(notificationIds) ? notificationIds : []).map(String)
  );
  let updated = 0;
  getAccountNotifications(account).forEach((notification) => {
    if (
      notification.deliveredAt ||
      notification.dismissedAt ||
      !ids.has(String(notification.notificationId || ''))
    ) {
      return;
    }
    notification.deliveredAt = deliveredAt;
    if (getNotificationDelivery(notification) === 'toast') {
      notification.readAt ||= deliveredAt;
    }
    updated += 1;
  });
  if (updated) account.markModified?.('gameData.notifications');
  return updated;
}

function markNotificationsRead(account, notificationIds, readAt = new Date()) {
  const ids = new Set(
    (Array.isArray(notificationIds) ? notificationIds : []).map(String)
  );
  let updated = 0;
  getAccountNotifications(account).forEach((notification) => {
    if (
      notification.readAt ||
      notification.dismissedAt ||
      !ids.has(String(notification.notificationId || ''))
    ) {
      return;
    }
    notification.deliveredAt ||= readAt;
    notification.readAt = readAt;
    updated += 1;
  });
  if (updated) account.markModified?.('gameData.notifications');
  return updated;
}

function getPendingNotificationCount(account, notificationIds, action) {
  const ids = new Set(notificationIds.map(String));
  return getAccountNotifications(account).filter((notification) => {
    if (
      notification.dismissedAt ||
      !ids.has(String(notification.notificationId || ''))
    ) {
      return false;
    }
    return action === 'read' ? !notification.readAt : !notification.deliveredAt;
  }).length;
}

function buildAtomicNotificationUpdate(action, notificationIds, updatedAt) {
  const timestampField =
    action === 'read' ? '$$notification.readAt' : '$$notification.deliveredAt';
  const matchesNotification = {
    $and: [
      {
        $in: [{ $toString: '$$notification.notificationId' }, notificationIds]
      },
      {
        $eq: [{ $ifNull: ['$$notification.dismissedAt', null] }, null]
      },
      { $eq: [{ $ifNull: [timestampField, null] }, null] }
    ]
  };
  const isToastNotification = {
    $or: [
      { $eq: ['$$notification.delivery', 'toast'] },
      {
        $and: [
          {
            $eq: [{ $ifNull: ['$$notification.delivery', null] }, null]
          },
          {
            $in: ['$$notification.type', [...TOAST_ONLY_NOTIFICATION_TYPES]]
          }
        ]
      }
    ]
  };
  const updatedNotification =
    action === 'read'
      ? {
          $mergeObjects: [
            '$$notification',
            {
              deliveredAt: {
                $ifNull: ['$$notification.deliveredAt', updatedAt]
              },
              readAt: updatedAt
            }
          ]
        }
      : {
          $mergeObjects: [
            '$$notification',
            {
              deliveredAt: updatedAt,
              readAt: {
                $cond: [
                  isToastNotification,
                  { $ifNull: ['$$notification.readAt', updatedAt] },
                  { $ifNull: ['$$notification.readAt', null] }
                ]
              }
            }
          ]
        };

  return [
    {
      $set: {
        'gameData.notifications': {
          $map: {
            input: { $ifNull: ['$gameData.notifications', []] },
            as: 'notification',
            in: {
              $cond: [
                matchesNotification,
                updatedNotification,
                '$$notification'
              ]
            }
          }
        },
        __v: { $add: [{ $ifNull: ['$__v', 0] }, 1] }
      }
    }
  ];
}

async function persistNotificationsAtomically({
  Account,
  account,
  notificationIds,
  action,
  updatedAt = new Date()
} = {}) {
  if (!Account?.updateOne || !account?._id) return 0;

  const ids = [...new Set((notificationIds || []).map(String))];
  const normalizedAction = action === 'read' ? 'read' : 'delivered';
  const pendingCount = getPendingNotificationCount(
    account,
    ids,
    normalizedAction
  );
  if (!pendingCount) return 0;

  const timestampField = normalizedAction === 'read' ? 'readAt' : 'deliveredAt';
  const result = await Account.updateOne(
    {
      _id: account._id,
      'gameData.notifications': {
        $elemMatch: {
          notificationId: { $in: ids },
          dismissedAt: null,
          [timestampField]: null
        }
      }
    },
    buildAtomicNotificationUpdate(normalizedAction, ids, updatedAt)
  );
  const modifiedCount = Number(result?.modifiedCount ?? result?.nModified) || 0;
  return modifiedCount > 0 ? pendingCount : 0;
}

function persistNotificationsReadAtomically(options = {}) {
  return persistNotificationsAtomically({ ...options, action: 'read' });
}

function persistNotificationsDeliveredAtomically(options = {}) {
  return persistNotificationsAtomically({ ...options, action: 'delivered' });
}

async function persistNotificationsRead(
  account,
  notificationIds,
  readAt = new Date()
) {
  const updated = markNotificationsRead(account, notificationIds, readAt);
  if (updated) await account.save?.();
  return updated;
}

async function persistNotificationsDelivered(
  account,
  notificationIds,
  deliveredAt = new Date()
) {
  const updated = markNotificationsDelivered(
    account,
    notificationIds,
    deliveredAt
  );
  if (updated) await account.save?.();
  return updated;
}

function importLegacyProgressionNotifications(account) {
  let imported = 0;
  const achievements = Array.isArray(account?.gameData?.achievements)
    ? account.gameData.achievements
    : [];
  achievements.forEach((unlock) => {
    if (
      unlock?.type !== 'achievement' ||
      unlock.notificationPending !== true ||
      unlock.notifiedAt ||
      !unlock.notificationId
    ) {
      return;
    }
    queueAccountNotification(account, {
      id: unlock.notificationId,
      type: 'achievement_unlocked',
      createdAt: unlock.unlockedAt,
      metadata: {
        achievementKey: unlock.key,
        rewardStatus:
          unlock.rewardStatus || (unlock.rewardGranted ? 'granted' : 'none'),
        rewardResults: Array.isArray(unlock.rewardResults)
          ? unlock.rewardResults
          : []
      }
    });
    unlock.notificationPending = false;
    imported += 1;
  });

  const opalTransactions = Array.isArray(account?.gameData?.opalTransactions)
    ? account.gameData.opalTransactions
    : [];
  opalTransactions.forEach((transaction) => {
    if (
      transaction.notificationPending !== true ||
      transaction.notificationDeliveredAt ||
      !transaction.notificationId ||
      Number(transaction.amount) <= 0
    ) {
      return;
    }
    if (transaction.sourceType === 'achievement') {
      transaction.notificationPending = false;
      imported += 1;
      return;
    }
    queueAccountNotification(account, {
      id: transaction.notificationId,
      type: 'opal_reward',
      createdAt: transaction.createdAt,
      metadata: {
        amount: Math.trunc(Number(transaction.amount) || 0),
        balance: Math.max(0, Math.trunc(Number(transaction.balanceAfter) || 0)),
        label: getOpalNotificationLabel(transaction),
        reason:
          transaction.sourceType === 'admin'
            ? 'Opals added to your account'
            : transaction.reason || 'Added to your Opal balance',
        sourceType: transaction.sourceType || 'system',
        sourceId: transaction.sourceId || null
      }
    });
    transaction.notificationPending = false;
    imported += 1;
  });

  if (imported) {
    account.markModified?.('gameData.achievements');
    account.markModified?.('gameData.opalTransactions');
  }
  return imported;
}

function importLegacyPartyNotifications(account) {
  const legacy = Array.isArray(account?.gameData?.partyNotifications)
    ? account.gameData.partyNotifications
    : [];
  let imported = 0;
  legacy.forEach((notification) => {
    if (notification.deliveredAt || !notification.notificationId) return;
    queueAccountNotification(account, {
      id: notification.notificationId,
      type: notification.type,
      actorAccountId: notification.actorAccountId,
      actorUsername: notification.actorUsername,
      actorOeIcon: notification.actorOeIcon,
      createdAt: notification.createdAt,
      metadata: {
        partyId: notification.partyId || null,
        modeName: notification.modeName || null
      }
    });
    notification.deliveredAt = new Date();
    imported += 1;
  });
  if (imported) account.markModified?.('gameData.partyNotifications');
  return imported;
}

function getLegacyFriendNotificationType(relationship) {
  if (
    relationship.status === 'pending_received' &&
    (!relationship.notificationType ||
      relationship.notificationType === 'friend_request')
  ) {
    return 'friend_request';
  }
  if (
    relationship.status === 'friends' &&
    FRIEND_NOTIFICATION_TYPES.has(relationship.notificationType)
  ) {
    return relationship.notificationType;
  }
  return null;
}

function importLegacyFriendNotifications(account) {
  const relationships = Array.isArray(account?.gameData?.friendsAndBlockedUsers)
    ? account.gameData.friendsAndBlockedUsers
    : [];
  let imported = 0;
  relationships.forEach((relationship) => {
    const type = getLegacyFriendNotificationType(relationship);
    if (!type || relationship.notificationDeliveredAt) return;
    const actor = relationship.accountId;
    const actorAccountId = actor?._id || actor;
    if (!actorAccountId) return;
    const createdAt = relationship.createdAt || new Date();
    const legacyId = `friend:${type}:${actorAccountId}:${new Date(
      createdAt
    ).getTime()}`;
    queueAccountNotification(account, {
      id: legacyId,
      type,
      actorAccountId,
      actorUsername: actor?.username || null,
      actorOeIcon: actor?.profile?.oeIcon || null,
      createdAt,
      metadata: {
        accountId: String(actorAccountId),
        username: actor?.username || 'Player',
        oeIcon: actor?.profile?.oeIcon || null,
        lobbyPath: relationship.notificationLobbyPath || null,
        sessionType: relationship.notificationSessionType || null,
        sessionKey: relationship.notificationSessionKey || null,
        sessionCode: relationship.notificationSessionCode || null
      }
    });
    relationship.notificationDeliveredAt = new Date();
    imported += 1;
  });
  if (imported) {
    account.markModified?.('gameData.friendsAndBlockedUsers');
  }
  return imported;
}

function importLegacyNotifications(account) {
  return (
    importLegacyProgressionNotifications(account) +
    importLegacyPartyNotifications(account) +
    importLegacyFriendNotifications(account)
  );
}

function serializePendingAccountNotifications(account, limit = 20) {
  importLegacyProgressionNotifications(account);
  return serializePendingNotifications(account, {
    categories: ['progression'],
    deliveries: ['toast', 'both'],
    limit
  }).map((notification) =>
    notification.type === 'achievement_unlocked'
      ? {
          id: notification.id,
          type: notification.type,
          achievementKey: notification.achievementKey,
          rewardStatus: notification.rewardStatus,
          rewardResults: notification.rewardResults,
          createdAt: notification.createdAt
        }
      : {
          id: notification.id,
          type: notification.type,
          amount: notification.amount,
          balance: notification.balance,
          label: notification.label,
          reason: notification.reason,
          sourceType: notification.sourceType,
          sourceId: notification.sourceId || null,
          createdAt: notification.createdAt
        }
  );
}

function markAccountNotificationsDelivered(
  account,
  notificationIds,
  deliveredAt = new Date()
) {
  importLegacyProgressionNotifications(account);
  const updated = markNotificationsDelivered(
    account,
    notificationIds,
    deliveredAt
  );
  const ids = new Set(notificationIds.map(String));
  (account?.gameData?.achievements || []).forEach((unlock) => {
    if (!ids.has(String(unlock.notificationId || ''))) return;
    unlock.notificationPending = false;
    unlock.notifiedAt = deliveredAt;
    account.markModified?.('gameData.achievements');
  });
  (account?.gameData?.opalTransactions || []).forEach((transaction) => {
    if (!ids.has(String(transaction.notificationId || ''))) return;
    transaction.notificationPending = false;
    transaction.notificationDeliveredAt = deliveredAt;
    account.markModified?.('gameData.opalTransactions');
  });
  return updated;
}

async function persistAccountNotificationsDelivered(
  account,
  notificationIds,
  deliveredAt = new Date()
) {
  const updated = markAccountNotificationsDelivered(
    account,
    notificationIds,
    deliveredAt
  );
  if (updated) await account.save?.();
  return updated;
}

module.exports = {
  FRIEND_NOTIFICATION_TYPES,
  PARTY_NOTIFICATION_TYPES,
  PROGRESSION_NOTIFICATION_TYPES,
  TOAST_ONLY_NOTIFICATION_TYPES,
  countUnreadNotifications,
  createAccountNotificationState,
  getAccountNotificationIds,
  getAccountNotifications,
  importLegacyNotifications,
  importLegacyProgressionNotifications,
  inferNotificationCategory,
  inferNotificationDelivery,
  markAccountNotificationsDelivered,
  markNotificationsDelivered,
  markNotificationsRead,
  persistAccountNotificationsDelivered,
  persistNotificationsDeliveredAtomically,
  persistNotificationsDelivered,
  persistNotificationsReadAtomically,
  persistNotificationsRead,
  queueAccountNotification,
  serializeAccountNotification,
  serializeInboxNotifications,
  serializePendingAccountNotifications,
  serializePendingNotifications,
  serializeProgressionNotification,
  serializeQueuedProgressionNotifications
};
