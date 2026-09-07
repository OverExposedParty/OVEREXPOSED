const OLING_LAB_VISIBILITIES = Object.freeze([
  'public',
  'private',
  'friends-only'
]);

function normalizeOlingLabVisibility(value) {
  const visibility = String(value || '')
    .trim()
    .toLowerCase();
  return OLING_LAB_VISIBILITIES.includes(visibility) ? visibility : 'private';
}

function escapeRegExp(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function findOlingLabAccountByUsername(Account, username) {
  const normalizedUsername = String(username || '')
    .trim()
    .replace(/^@+/, '');
  if (!normalizedUsername || !Account?.findOne) return null;

  return Account.findOne({
    username: {
      $regex: `^${escapeRegExp(normalizedUsername)}$`,
      $options: 'i'
    },
    'profile.accountStatus': { $nin: ['suspended', 'banned', 'deleted'] }
  });
}

function isOlingLabFriend(targetAccount, viewerAccount) {
  if (!targetAccount?._id || !viewerAccount?._id) return false;
  const relationships = Array.isArray(
    targetAccount.gameData?.friendsAndBlockedUsers
  )
    ? targetAccount.gameData.friendsAndBlockedUsers
    : [];

  return relationships.some(
    (relationship) =>
      relationship?.status === 'friends' &&
      String(relationship.accountId?._id || relationship.accountId || '') ===
        String(viewerAccount._id)
  );
}

function getOlingLabAccess(targetAccount, viewerAccount = null) {
  if (!targetAccount) {
    return { allowed: false, reason: 'oling_lab_not_found' };
  }

  const visibility = normalizeOlingLabVisibility(
    targetAccount.olings?.lab?.visibility
  );
  const targetUsername = targetAccount.username || null;
  const isOwner =
    Boolean(viewerAccount?._id) &&
    String(targetAccount._id) === String(viewerAccount._id);

  if (isOwner || visibility === 'public') {
    return { allowed: true, isOwner, targetUsername, visibility };
  }
  if (
    visibility === 'friends-only' &&
    isOlingLabFriend(targetAccount, viewerAccount)
  ) {
    return { allowed: true, isOwner: false, targetUsername, visibility };
  }

  return {
    allowed: false,
    isOwner: false,
    reason:
      visibility === 'friends-only'
        ? 'oling_lab_friends_only'
        : 'oling_lab_private',
    showSignIn: !viewerAccount,
    targetUsername,
    visibility
  };
}

module.exports = {
  OLING_LAB_VISIBILITIES,
  findOlingLabAccountByUsername,
  getOlingLabAccess,
  isOlingLabFriend,
  normalizeOlingLabVisibility
};
