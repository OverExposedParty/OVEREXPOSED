const accountNotificationPresentation = {
  friend_request: {
    label: 'Friends',
    title: 'New friend request',
    body: (notification) =>
      `${notification.username || notification.actorUsername || 'A player'} wants to add you`
  },
  friend_accepted: {
    label: 'Friends',
    title: 'Friend request accepted',
    body: (notification) =>
      `${notification.username || notification.actorUsername || 'A player'} is now your friend`
  },
  session_invite: {
    label: 'Invite',
    title: 'Session invitation',
    body: (notification) =>
      `${notification.username || notification.actorUsername || 'A player'} invited you to join`
  },
  session_invite_accepted: {
    label: 'Invite',
    title: 'Invitation accepted',
    body: (notification) =>
      `${notification.username || notification.actorUsername || 'A player'} accepted your invitation`
  },
  session_invite_declined: {
    label: 'Invite',
    title: 'Invitation declined',
    body: (notification) =>
      `${notification.username || notification.actorUsername || 'A player'} declined your invitation`
  },
  friend_joinable_session_started: {
    label: 'Friends',
    title: 'Joinable session started',
    body: (notification) =>
      `${notification.username || notification.actorUsername || 'A friend'} started a session`
  },
  friend_online: {
    label: 'Friends',
    title: 'Friend online',
    body: (notification) =>
      `${notification.username || notification.actorUsername || 'A friend'} is online now`
  },
  party_player_joined: {
    label: 'Party',
    title: 'Player joined',
    body: (notification) =>
      `${notification.actorUsername || 'A player'} joined your party`
  },
  party_player_left: {
    label: 'Party',
    title: 'Player left',
    body: (notification) =>
      `${notification.actorUsername || 'A player'} left your party`
  },
  party_player_kicked: {
    label: 'Party',
    title: 'Player removed',
    body: (notification) =>
      `${notification.actorUsername || 'A player'} was removed from your party`
  },
  party_player_disconnected: {
    label: 'Party',
    title: 'Player disconnected',
    body: (notification) =>
      `${notification.actorUsername || 'A player'} disconnected`
  },
  party_player_reconnected: {
    label: 'Party',
    title: 'Player reconnected',
    body: (notification) =>
      `${notification.actorUsername || 'A player'} reconnected`
  },
  party_host_changed: {
    label: 'Party',
    title: 'New party host',
    body: (notification) =>
      `${notification.actorUsername || 'A player'} is now the host`
  },
  party_disbanded: {
    label: 'Party',
    title: 'Party ended',
    body: () => 'The party has been disbanded'
  },
  achievement_unlocked: {
    label: 'Achievement',
    title: 'Achievement unlocked',
    body: () => 'You unlocked a new achievement'
  },
  opal_reward: {
    label: 'Opals',
    title: 'Opals received',
    body: (notification) =>
      notification.reason ||
      `${formatAccountNumber(notification.amount)} Opals were added`
  }
};

function getAccountNotificationOeIcon(notification = {}) {
  return String(notification.oeIcon || notification.actorOeIcon || '').trim();
}

function shouldShowAccountNotificationOe(notification = {}) {
  return Boolean(
    getAccountNotificationOeIcon(notification) ||
    notification.category === 'social' ||
    String(notification.type || '').startsWith('friend_')
  );
}

function getAccountNotificationAchievementBorderPath(rarityKey) {
  const normalizedRarity = String(rarityKey || 'common')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  const borderKey =
    normalizedRarity === 'secret' ? 'exposed' : normalizedRarity;
  return `/images/achievements/borders/${borderKey || 'common'}.svg`;
}

function createAccountNotificationAchievementVisual(
  notification,
  achievementsByKey
) {
  const achievementKey = String(notification.achievementKey || '')
    .trim()
    .toLowerCase();
  const achievement = achievementsByKey?.get(achievementKey) || {};
  const visual = document.createElement('span');
  visual.className = 'account-notification-visual is-achievement';
  visual.setAttribute('aria-hidden', 'true');

  const icon = document.createElement('img');
  icon.className = 'account-notification-achievement-icon';
  icon.src = achievement.image || '/images/icons/help-icon.svg';
  icon.alt = '';

  const border = document.createElement('img');
  border.className = 'account-notification-achievement-border';
  border.src =
    achievement.border ||
    getAccountNotificationAchievementBorderPath(achievement.rarity || 'common');
  border.alt = '';

  visual.append(icon, border);
  return visual;
}

function createAccountNotificationOeVisual(notification, customisationLookup) {
  const visual = document.createElement('span');
  visual.className = 'account-notification-visual is-oe';
  visual.setAttribute('aria-hidden', 'true');

  const customisation = parseAccountCustomisationString(
    getAccountNotificationOeIcon(notification) || accountDefaultOeIcon
  );
  const iconParts =
    customisation && customisationLookup
      ? getCustomisationFileStackFromIds(customisation, customisationLookup)
      : null;

  if (iconParts) {
    visual.appendChild(createAccountPreviewImageStack(iconParts));
  } else {
    visual.classList.add('has-fallback');
    visual.textContent = 'OE';
  }
  return visual;
}

function createAccountNotificationFallbackVisual(notification, copy) {
  const visual = document.createElement('span');
  visual.className = 'account-notification-visual is-fallback';
  visual.setAttribute('aria-hidden', 'true');

  if (notification.type === 'opal_reward') {
    const icon = document.createElement('img');
    icon.className = 'account-notification-fallback-icon';
    icon.src = '/images/icons/currency/opal.svg';
    icon.alt = '';
    visual.appendChild(icon);
    return visual;
  }

  visual.textContent = String(copy.label || 'OE')
    .replace(/[^a-z0-9]/gi, '')
    .slice(0, 2)
    .toUpperCase();
  return visual;
}

function createAccountNotificationVisual(notification, copy, visualData = {}) {
  if (notification.type === 'achievement_unlocked') {
    return createAccountNotificationAchievementVisual(
      notification,
      visualData.achievementsByKey
    );
  }
  if (shouldShowAccountNotificationOe(notification)) {
    return createAccountNotificationOeVisual(
      notification,
      visualData.customisationLookup
    );
  }
  return createAccountNotificationFallbackVisual(notification, copy);
}

async function loadAccountNotificationVisualData(notifications) {
  const needsAchievements = notifications.some(
    (notification) => notification.type === 'achievement_unlocked'
  );
  const needsCustomisation = notifications.some((notification) =>
    shouldShowAccountNotificationOe(notification)
  );

  const [achievements, customisationData] = await Promise.all([
    needsAchievements && typeof loadAccountAchievements === 'function'
      ? loadAccountAchievements().catch(() => [])
      : [],
    needsCustomisation && typeof loadAccountCustomisationData === 'function'
      ? loadAccountCustomisationData().catch(() => null)
      : null
  ]);

  return {
    achievementsByKey: new Map(
      achievements.map((achievement) => [
        String(achievement.key || '')
          .trim()
          .toLowerCase(),
        achievement
      ])
    ),
    customisationLookup: customisationData?.lookup || null
  };
}

function getAccountNotificationCopy(notification = {}) {
  const presentation = accountNotificationPresentation[notification.type] || {};
  return {
    label:
      presentation.label ||
      String(notification.category || 'Notification').toUpperCase(),
    title: notification.title || presentation.title || 'Notification',
    body:
      notification.body ||
      (typeof presentation.body === 'function'
        ? presentation.body(notification)
        : 'You have a new notification')
  };
}

function getAccountNotificationAction(notification = {}) {
  if (notification.type === 'friend_request') {
    return { action: 'friend-requests', label: 'View' };
  }
  if (notification.type === 'achievement_unlocked') {
    return {
      action: 'achievements',
      achievementKey: String(notification.achievementKey || '')
        .trim()
        .toLowerCase(),
      label: 'View'
    };
  }
  if (
    notification.type === 'session_invite' &&
    /^\/[a-zA-Z0-9/?&=_-]+$/.test(notification.lobbyPath || '')
  ) {
    return {
      action: 'navigate',
      label: 'Join',
      path: notification.lobbyPath
    };
  }
  if (notification.action?.type === 'open_settings') {
    return { action: 'settings', label: 'Settings' };
  }
  const accountId = notification.accountId || notification.actorAccountId || '';
  if (notification.category === 'social' && /^[a-f0-9]{24}$/i.test(accountId)) {
    return {
      accountId,
      action: 'public-profile',
      label: 'Profile'
    };
  }
  return null;
}

function createAccountNotificationCard(notification = {}, visualData = {}) {
  const copy = getAccountNotificationCopy(notification);
  const card = document.createElement('article');
  card.className = 'account-notification-card';
  card.classList.toggle('is-unread', !notification.readAt);
  card.dataset.notificationId = String(notification.id || '');

  const visual = createAccountNotificationVisual(
    notification,
    copy,
    visualData
  );

  const content = document.createElement('span');
  content.className = 'account-notification-content';

  const meta = document.createElement('span');
  meta.className = 'account-notification-meta';
  meta.textContent = copy.label;

  const title = document.createElement('strong');
  title.className = 'account-notification-title';
  title.textContent = copy.title;

  const body = document.createElement('span');
  body.className = 'account-notification-body';
  body.textContent = copy.body;

  const time = document.createElement('time');
  time.className = 'account-notification-time';
  time.dateTime = notification.createdAt || '';
  time.textContent = formatAccountDate(notification.createdAt);

  content.append(meta, title, body, time);
  card.append(visual, content);

  const notificationAction = getAccountNotificationAction(notification);
  if (notificationAction) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'account-notification-action';
    button.textContent = notificationAction.label;
    button.dataset.notificationAction = notificationAction.action;
    if (notificationAction.accountId) {
      button.dataset.accountId = notificationAction.accountId;
    }
    if (notificationAction.achievementKey) {
      button.dataset.achievementKey = notificationAction.achievementKey;
    }
    if (notificationAction.path) {
      button.dataset.path = notificationAction.path;
    }
    card.appendChild(button);
  }

  return card;
}

function getAccountNotificationMenuDestination(notification = {}) {
  if (notification.menuDestination) return notification.menuDestination;
  if (
    notification.type === 'friend_request' ||
    notification.type === 'friend_accepted'
  ) {
    return 'friends';
  }
  if (notification.type === 'achievement_unlocked') return 'achievements';
  return null;
}

async function markAccountNotificationsRead(notifications, unreadIds) {
  if (!unreadIds.length) return;

  try {
    const response = await fetch('/api/accounts/notifications', {
      method: 'PATCH',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'read',
        notificationIds: unreadIds
      })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload?.success === false) {
      throw new Error(
        payload?.error?.message || 'Failed to mark notifications as read'
      );
    }

    const readAt = new Date().toISOString();
    const latestNotifications =
      window.OEAccountNotificationState?.getSnapshot?.()?.inboxNotifications ||
      notifications;
    latestNotifications.forEach((notification) => {
      if (unreadIds.includes(String(notification.id))) {
        notification.readAt = readAt;
      }
    });
    if (typeof accountExpandedContent !== 'undefined') {
      accountExpandedContent
        ?.querySelectorAll('.account-notification-card.is-unread')
        .forEach((card) => card.classList.remove('is-unread'));
    }
    window.OEAccountNotificationState?.setAccountNotifications({
      notifications: latestNotifications,
      unreadCount: payload?.data?.unreadCount ?? payload?.unreadCount ?? 0,
      unreadMenuCounts:
        payload?.data?.unreadMenuCounts ?? payload?.unreadMenuCounts ?? null
    });
    return true;
  } catch (error) {
    setAccountFooterHint('Notifications could not be marked as read');
    console.warn(error);
    return false;
  }
}

async function markAccountNotificationCardsRead(notifications) {
  const unreadIds = notifications
    .filter((notification) => !notification.readAt && notification.id)
    .map((notification) => String(notification.id));
  return markAccountNotificationsRead(notifications, unreadIds);
}

async function markAccountNotificationDestinationRead(
  destination,
  { types = null } = {}
) {
  const notifications =
    window.OEAccountNotificationState?.getSnapshot?.()?.inboxNotifications ||
    [];
  const typeSet = Array.isArray(types) ? new Set(types) : null;
  const unreadIds = notifications
    .filter(
      (notification) =>
        !notification.readAt &&
        notification.id &&
        getAccountNotificationMenuDestination(notification) === destination &&
        (!typeSet || typeSet.has(notification.type))
    )
    .map((notification) => String(notification.id));
  return markAccountNotificationsRead(notifications, unreadIds);
}

async function renderAccountNotificationsPanel() {
  if (!accountExpandedContent) return;

  const loading = document.createElement('p');
  loading.className = 'account-notification-status';
  loading.textContent = 'Loading notifications...';
  accountExpandedContent.replaceChildren(loading);

  try {
    const response = await fetch('/api/accounts/notifications', {
      cache: 'no-store',
      credentials: 'same-origin'
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload?.success === false) {
      throw new Error(
        payload?.error?.message || 'Failed to load notifications'
      );
    }
    if (accountExpandedAction !== 'notifications') return;

    const notifications = Array.isArray(payload?.data?.inboxNotifications)
      ? payload.data.inboxNotifications
      : Array.isArray(payload?.inboxNotifications)
        ? payload.inboxNotifications
        : [];
    const unreadCount = payload?.data?.unreadCount ?? payload?.unreadCount ?? 0;
    const unreadMenuCounts =
      payload?.data?.unreadMenuCounts ?? payload?.unreadMenuCounts ?? null;
    window.OEAccountNotificationState?.setAccountNotifications({
      notifications,
      unreadCount,
      unreadMenuCounts
    });

    if (!notifications.length) {
      const empty = document.createElement('p');
      empty.className = 'account-notification-status';
      empty.textContent = 'You have no notifications yet.';
      accountExpandedContent.replaceChildren(empty);
      return;
    }

    const visualData = await loadAccountNotificationVisualData(notifications);
    if (accountExpandedAction !== 'notifications') return;

    const list = document.createElement('div');
    list.className = 'account-notification-list';
    notifications.forEach((notification) => {
      list.appendChild(createAccountNotificationCard(notification, visualData));
    });
    accountExpandedContent.replaceChildren(list);
    await markAccountNotificationCardsRead(notifications);
  } catch (error) {
    if (accountExpandedAction !== 'notifications') return;
    const failure = document.createElement('p');
    failure.className =
      'account-notification-status account-notification-error';
    failure.textContent = 'Notifications could not be loaded.';
    accountExpandedContent.replaceChildren(failure);
    console.warn(error);
  }
}
