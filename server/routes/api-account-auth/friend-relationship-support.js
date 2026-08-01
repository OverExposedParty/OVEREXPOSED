function createFriendRelationshipSupport() {
  function getFriendRelationships(account) {
    if (!account.gameData) account.gameData = {};
    if (!Array.isArray(account.gameData.friendsAndBlockedUsers)) {
      account.gameData.friendsAndBlockedUsers = [];
    }
    return account.gameData.friendsAndBlockedUsers;
  }

  function findFriendRelationship(account, accountId) {
    return getFriendRelationships(account).find(
      (relationship) =>
        String(relationship.accountId?._id || relationship.accountId) ===
        String(accountId)
    );
  }

  function getAcceptedFriendCount(account) {
    return getFriendRelationships(account).filter(
      (relationship) => relationship.status === 'friends'
    ).length;
  }

  function removeFriendRelationship(account, accountId) {
    account.gameData.friendsAndBlockedUsers = getFriendRelationships(
      account
    ).filter(
      (relationship) =>
        String(relationship.accountId?._id || relationship.accountId) !==
        String(accountId)
    );
    account.markModified('gameData.friendsAndBlockedUsers');
  }

  function setFriendRelationship(account, accountId, status, options = {}) {
    removeFriendRelationship(account, accountId);
    account.gameData.friendsAndBlockedUsers.push({
      accountId,
      status,
      createdAt: new Date(),
      notificationType: options.notificationType || null,
      notificationLobbyPath: options.notificationLobbyPath || null,
      notificationSessionType: options.notificationSessionType || null,
      notificationSessionKey: options.notificationSessionKey || null,
      notificationSessionCode: options.notificationSessionCode || null,
      notificationDeliveredAt: options.notificationDeliveredAt || null
    });
    account.markModified('gameData.friendsAndBlockedUsers');
  }

  async function populateFriendRelationships(account) {
    await account.populate({
      path: 'gameData.friendsAndBlockedUsers.accountId',
      select:
        'username profile.oeIcon profile.lastLoginAt profile.privacySettings.showOnlineStatus analytics.lastSeenAt'
    });
    return account;
  }

  function clearSessionInvite(relationship) {
    relationship.notificationType = null;
    relationship.notificationLobbyPath = null;
    relationship.notificationSessionType = null;
    relationship.notificationSessionKey = null;
    relationship.notificationSessionCode = null;
    relationship.notificationDeliveredAt = null;
  }

  function getPartyNotifications(account) {
    if (!account.gameData) account.gameData = {};
    if (!Array.isArray(account.gameData.partyNotifications)) {
      account.gameData.partyNotifications = [];
    }
    return account.gameData.partyNotifications;
  }

  return {
    getFriendRelationships,
    findFriendRelationship,
    getAcceptedFriendCount,
    removeFriendRelationship,
    setFriendRelationship,
    populateFriendRelationships,
    clearSessionInvite,
    getPartyNotifications
  };
}

module.exports = { createFriendRelationshipSupport };
