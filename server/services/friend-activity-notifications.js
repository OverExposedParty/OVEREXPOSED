const {
  getAccountNotifications,
  queueAccountNotification
} = require('./account-notifications');

const FRIEND_ONLINE_WINDOW_MS = 5 * 60 * 1000;
const FRIEND_ONLINE_NOTIFICATION_COOLDOWN_MS = 6 * 60 * 60 * 1000;
const FRIEND_SESSION_CHECK_INTERVAL_MS = 60 * 1000;
const MAX_FRIEND_SESSION_CHECKS_PER_POLL = 5;

function getRelatedAccount(relationship) {
  const account = relationship?.accountId;
  return account && typeof account === 'object' && account._id ? account : null;
}

function getRelatedAccountId(relationship) {
  return String(relationship?.accountId?._id || relationship?.accountId || '');
}

function getFriendNotificationStates(account) {
  account.gameData ||= {};
  if (!Array.isArray(account.gameData.friendNotificationStates)) {
    account.gameData.friendNotificationStates = [];
  }
  return account.gameData.friendNotificationStates;
}

function getOrCreateFriendState(account, accountId) {
  const states = getFriendNotificationStates(account);
  let state = states.find(
    (entry) => String(entry.accountId?._id || entry.accountId) === accountId
  );
  if (state) return { created: false, state };

  state = {
    accountId,
    presenceInitialized: false,
    wasOnline: false,
    lastPresenceObservedAt: null,
    lastOnlineNotifiedAt: null,
    sessionInitialized: false,
    sessionFingerprint: null,
    lastSessionCheckedAt: null,
    lastSessionNotifiedAt: null
  };
  states.push(state);
  return { created: true, state };
}

function isFriendOnline(friend, now) {
  const lastSeenAt =
    friend?.analytics?.lastSeenAt || friend?.profile?.lastLoginAt || null;
  const lastSeenTime = new Date(lastSeenAt || 0).getTime();
  return (
    Number.isFinite(lastSeenTime) &&
    lastSeenTime >= now.getTime() - FRIEND_ONLINE_WINDOW_MS
  );
}

function getSessionFingerprint(session) {
  const type = session?.type || session?.sessionType;
  const key = session?.key || session?.sessionKey || '';
  const code = session?.code || session?.sessionCode;
  if (!type || !code) return null;
  return `${type}:${key}:${code}`;
}

function getActorMetadata(friend, accountId, defaultOeIcon) {
  return {
    actorAccountId: accountId,
    actorUsername: friend.username || 'Player',
    actorOeIcon: friend.profile?.oeIcon || defaultOeIcon,
    metadata: {
      accountId,
      username: friend.username || 'Player',
      oeIcon: friend.profile?.oeIcon || defaultOeIcon
    }
  };
}

function dismissPendingFriendNotifications(
  account,
  { accountId, type, keepSessionFingerprint = undefined, dismissedAt }
) {
  let dismissed = 0;
  getAccountNotifications(account).forEach((notification) => {
    if (
      notification.type !== type ||
      notification.deliveredAt ||
      notification.dismissedAt ||
      String(notification.actorAccountId || '') !== accountId
    ) {
      return;
    }
    if (
      keepSessionFingerprint !== undefined &&
      getSessionFingerprint(notification.metadata) === keepSessionFingerprint
    ) {
      return;
    }
    notification.dismissedAt = dismissedAt;
    notification.deliveredAt = dismissedAt;
    dismissed += 1;
  });
  if (dismissed) account.markModified?.('gameData.notifications');
  return dismissed;
}

function syncFriendPresence({
  account,
  relationship,
  state,
  now,
  defaultOeIcon
}) {
  const friend = getRelatedAccount(relationship);
  if (!friend) return { changed: false, queued: 0 };

  const showOnlineStatus =
    friend.profile?.privacySettings?.showOnlineStatus !== false;
  if (!showOnlineStatus) {
    dismissPendingFriendNotifications(account, {
      accountId: getRelatedAccountId(relationship),
      type: 'friend_online',
      dismissedAt: now
    });
    if (!state.presenceInitialized && !state.wasOnline) {
      return { changed: false, queued: 0 };
    }
    state.presenceInitialized = false;
    state.wasOnline = false;
    state.lastPresenceObservedAt = now;
    return { changed: true, queued: 0 };
  }

  const online = isFriendOnline(friend, now);
  if (!state.presenceInitialized) {
    state.presenceInitialized = true;
    state.wasOnline = online;
    state.lastPresenceObservedAt = now;
    return { changed: true, queued: 0 };
  }
  if (online === state.wasOnline) {
    return { changed: false, queued: 0 };
  }

  let queued = 0;
  if (!online) {
    dismissPendingFriendNotifications(account, {
      accountId: getRelatedAccountId(relationship),
      type: 'friend_online',
      dismissedAt: now
    });
  }
  const lastNotifiedTime = new Date(state.lastOnlineNotifiedAt || 0).getTime();
  const cooldownPassed =
    !lastNotifiedTime ||
    now.getTime() - lastNotifiedTime >= FRIEND_ONLINE_NOTIFICATION_COOLDOWN_MS;
  if (online && cooldownPassed) {
    const accountId = getRelatedAccountId(relationship);
    queueAccountNotification(account, {
      type: 'friend_online',
      ...getActorMetadata(friend, accountId, defaultOeIcon),
      createdAt: now
    });
    state.lastOnlineNotifiedAt = now;
    queued = 1;
  }

  state.wasOnline = online;
  state.lastPresenceObservedAt = now;
  return { changed: true, queued };
}

async function syncFriendSession({
  account,
  relationship,
  state,
  now,
  defaultOeIcon,
  getAccountInviteSession,
  decorateInviteSession
}) {
  const friend = getRelatedAccount(relationship);
  const accountId = getRelatedAccountId(relationship);
  if (!friend || !accountId) return 0;

  const rawSession = await getAccountInviteSession(accountId);
  const session = decorateInviteSession(rawSession);
  const fingerprint = getSessionFingerprint(session);
  state.lastSessionCheckedAt = now;

  if (!state.sessionInitialized) {
    state.sessionInitialized = true;
    state.sessionFingerprint = fingerprint;
    return 0;
  }

  let queued = 0;
  dismissPendingFriendNotifications(account, {
    accountId,
    type: 'friend_joinable_session_started',
    keepSessionFingerprint: fingerprint,
    dismissedAt: now
  });
  if (fingerprint && fingerprint !== state.sessionFingerprint) {
    const actor = getActorMetadata(friend, accountId, defaultOeIcon);
    queueAccountNotification(account, {
      type: 'friend_joinable_session_started',
      ...actor,
      action: {
        type: 'open_session',
        path: session.lobbyPath
      },
      metadata: {
        ...actor.metadata,
        lobbyPath: session.lobbyPath,
        sessionType: session.type,
        sessionKey: session.key,
        sessionCode: session.code,
        modeName: session.modeName || null,
        primaryColour: session.primaryColour || null,
        secondaryColour: session.secondaryColour || null
      },
      createdAt: now
    });
    state.lastSessionNotifiedAt = now;
    queued = 1;
  }

  state.sessionFingerprint = fingerprint;
  return queued;
}

async function syncFriendActivityNotifications({
  account,
  getAccountInviteSession,
  decorateInviteSession,
  defaultOeIcon,
  now = new Date()
}) {
  if (
    !account ||
    typeof getAccountInviteSession !== 'function' ||
    typeof decorateInviteSession !== 'function'
  ) {
    return { changed: false, queued: 0 };
  }

  const relationships = Array.isArray(account.gameData?.friendsAndBlockedUsers)
    ? account.gameData.friendsAndBlockedUsers.filter(
        (relationship) =>
          relationship.status === 'friends' && getRelatedAccount(relationship)
      )
    : [];
  const friendIds = new Set(relationships.map(getRelatedAccountId));
  const states = getFriendNotificationStates(account);
  const retainedStates = states.filter((state) =>
    friendIds.has(String(state.accountId?._id || state.accountId))
  );
  let changed = retainedStates.length !== states.length;
  if (changed) {
    account.gameData.friendNotificationStates = retainedStates;
  }

  let queued = 0;
  const relationshipsWithState = relationships.map((relationship) => {
    const result = getOrCreateFriendState(
      account,
      getRelatedAccountId(relationship)
    );
    changed ||= result.created;
    const presence = syncFriendPresence({
      account,
      relationship,
      state: result.state,
      now,
      defaultOeIcon
    });
    changed ||= presence.changed;
    queued += presence.queued;
    return { relationship, state: result.state };
  });

  const dueSessionChecks = relationshipsWithState
    .filter(({ state }) => {
      const checkedAt = new Date(state.lastSessionCheckedAt || 0).getTime();
      return (
        !checkedAt ||
        now.getTime() - checkedAt >= FRIEND_SESSION_CHECK_INTERVAL_MS
      );
    })
    .sort(
      (left, right) =>
        new Date(left.state.lastSessionCheckedAt || 0).getTime() -
        new Date(right.state.lastSessionCheckedAt || 0).getTime()
    )
    .slice(0, MAX_FRIEND_SESSION_CHECKS_PER_POLL);

  for (const { relationship, state } of dueSessionChecks) {
    queued += await syncFriendSession({
      account,
      relationship,
      state,
      now,
      defaultOeIcon,
      getAccountInviteSession,
      decorateInviteSession
    });
    changed = true;
  }

  if (changed) {
    account.markModified?.('gameData.friendNotificationStates');
  }
  return { changed, queued };
}

module.exports = {
  FRIEND_ONLINE_NOTIFICATION_COOLDOWN_MS,
  FRIEND_ONLINE_WINDOW_MS,
  FRIEND_SESSION_CHECK_INTERVAL_MS,
  MAX_FRIEND_SESSION_CHECKS_PER_POLL,
  getSessionFingerprint,
  isFriendOnline,
  syncFriendActivityNotifications
};
