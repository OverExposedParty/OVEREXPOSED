const DELIVERABLE_FRIEND_NOTIFICATION_TYPES = [
  'friend_accepted',
  'session_invite_declined'
];

function isDeliverableFriendNotification(relationship) {
  if (relationship.notificationDeliveredAt) return false;

  if (
    relationship.status === 'pending_received' &&
    (!relationship.notificationType ||
      relationship.notificationType === 'friend_request')
  ) {
    return true;
  }

  return (
    relationship.status === 'friends' &&
    DELIVERABLE_FRIEND_NOTIFICATION_TYPES.includes(
      relationship.notificationType
    )
  );
}

function parseFriendNotificationAccountIds(accountIds = []) {
  if (!Array.isArray(accountIds)) return [];

  return [...new Set(accountIds.map((value) => String(value || '')))]
    .filter((value) => /^[a-f0-9]{24}$/i.test(value))
    .slice(0, 20);
}

function serializeFriendNotification(relationship, session, defaultOeIcon) {
  return {
    accountId: relationship.accountId._id.toString(),
    username: relationship.accountId.username || 'Player',
    oeIcon: relationship.accountId.profile?.oeIcon || defaultOeIcon,
    type:
      relationship.notificationType ||
      (relationship.status === 'pending_received' ? 'friend_request' : null),
    createdAt: relationship.createdAt || null,
    lobbyPath: session?.lobbyPath || null,
    sessionType: session?.type || null,
    sessionKey: session?.key || null,
    primaryColour: session?.primaryColour || null,
    secondaryColour: session?.secondaryColour || null
  };
}

function markFriendNotificationsDelivered(
  relationships,
  accountIds,
  deliveredAt = new Date()
) {
  let updated = 0;

  relationships.forEach((relationship) => {
    const relatedId = String(
      relationship.accountId?._id || relationship.accountId || ''
    );
    if (
      !isDeliverableFriendNotification(relationship) ||
      !accountIds.includes(relatedId)
    ) {
      return;
    }

    relationship.notificationDeliveredAt = deliveredAt;
    updated += 1;
  });

  return updated;
}

module.exports = {
  isDeliverableFriendNotification,
  markFriendNotificationsDelivered,
  parseFriendNotificationAccountIds,
  serializeFriendNotification
};
