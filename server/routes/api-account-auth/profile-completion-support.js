function createProfileCompletionSupport(context) {
  const {
    isDefaultOeIcon,
    unlockAchievementByKey,
    Achievement
  } = context;

  function escapeAccountRegex(value) {
    return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function isProfileCompletionReady(account) {
    if (!account) return false;

    const privacySettings = account.profile?.privacySettings || {};
    return Boolean(
      account.username &&
      account.email &&
      account.profile?.emailVerified &&
      account.profile?.accountStatus === 'active' &&
      account.profile?.oeIcon &&
      !isDefaultOeIcon(account.profile.oeIcon) &&
      privacySettings.profileVisibility &&
      typeof privacySettings.showGameStats === 'boolean' &&
      typeof privacySettings.showOnlineStatus === 'boolean' &&
      typeof privacySettings.allowFriendRequests === 'boolean'
    );
  }

  async function recordProfileCompletionAchievement(account, source) {
    if (!isProfileCompletionReady(account)) return null;

    return unlockAchievementByKey({
      Achievement,
      account,
      key: 'completionist',
      source,
      save: false
    });
  }

  return {
    escapeAccountRegex,
    isProfileCompletionReady,
    recordProfileCompletionAchievement
  };
}

module.exports = { createProfileCompletionSupport };
