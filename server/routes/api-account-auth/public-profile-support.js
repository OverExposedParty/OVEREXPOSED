function createPublicProfileSupport(context, { findFriendRelationship }) {
  const { defaultOeIcon } = context;

  function hasPublicProfileAccess(targetAccount, viewerAccount) {
    const visibility =
      targetAccount.profile?.privacySettings?.profileVisibility || 'public';

    if (visibility === 'public') return true;
    if (!viewerAccount) return false;
    if (String(targetAccount._id) === String(viewerAccount._id)) return true;
    if (visibility === 'private') return false;

    const relationships = Array.isArray(
      targetAccount.gameData?.friendsAndBlockedUsers
    )
      ? targetAccount.gameData.friendsAndBlockedUsers
      : [];

    return relationships.some(
      (relationship) =>
        relationship.status === 'friends' &&
        String(relationship.accountId) === String(viewerAccount._id)
    );
  }

  function getPublicProfileRelationship(account, viewerAccount) {
    if (!viewerAccount) {
      return {
        status: 'signed_out',
        allowFriendRequests:
          account.profile?.privacySettings?.allowFriendRequests !== false,
        canSendFriendRequest: false
      };
    }

    if (String(account._id) === String(viewerAccount._id)) {
      return {
        status: 'self',
        allowFriendRequests: false,
        canSendFriendRequest: false
      };
    }

    const relationship = findFriendRelationship(viewerAccount, account._id);
    const status = relationship?.status || 'not_friends';
    const allowFriendRequests =
      account.profile?.privacySettings?.allowFriendRequests !== false;

    return {
      status,
      allowFriendRequests,
      canSendFriendRequest: status === 'not_friends' && allowFriendRequests
    };
  }

  function serializePublicAccountProfile(account, viewerAccount = null) {
    const privacySettings = account.profile?.privacySettings || {};
    const showGameStats = privacySettings.showGameStats !== false;
    const showOnlineStatus = privacySettings.showOnlineStatus !== false;
    const achievements = Array.isArray(account.gameData?.achievements)
      ? account.gameData.achievements
      : [];
    const unlockedAchievements = achievements.filter(
      (achievement) => achievement.unlockedAt
    );
    const olings = Array.isArray(account.olings?.olings)
      ? account.olings.olings
      : [];

    return {
      id: account._id.toString(),
      username: account.username,
      displayName: account.profile?.displayName || account.username,
      oeIcon: account.profile?.oeIcon || defaultOeIcon,
      joinedAt: account.createdAt || null,
      onlineStatus: showOnlineStatus ? 'Online' : null,
      stats: showGameStats
        ? {
            level: account.gameData?.level || 1,
            xp: account.gameData?.xp || 0,
            gamesPlayed: account.gameData?.gamesPlayed || 0,
            roundsPlayed: account.gameData?.roundsPlayed || 0,
            lastActiveGameMode: account.gameData?.lastActiveGameMode || null,
            achievementsUnlocked: unlockedAchievements.length
          }
        : null,
      achievements: unlockedAchievements.map((achievement) => ({
        key: achievement.key,
        rarity: achievement.metadata?.rarity || null,
        unlockedAt: achievement.unlockedAt || null
      })),
      relationship: getPublicProfileRelationship(account, viewerAccount),
      olings: {
        total: olings.length
      }
    };
  }

  return {
    hasPublicProfileAccess,
    getPublicProfileRelationship,
    serializePublicAccountProfile
  };
}

module.exports = { createPublicProfileSupport };
