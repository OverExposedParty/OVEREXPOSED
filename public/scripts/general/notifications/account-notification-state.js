(function () {
  const counts = {
    accountNotifications: 0,
    friendChatUnread: 0
  };
  const accountMenuCounts = {
    notifications: 0,
    friends: 0,
    achievements: 0,
    profile: 0,
    statistics: 0
  };
  let inboxNotifications = [];

  function normaliseCount(value) {
    return Math.max(0, Math.trunc(Number(value) || 0));
  }

  function getSnapshot() {
    return {
      counts: { ...counts },
      menuCounts: {
        ...accountMenuCounts,
        notifications: counts.accountNotifications,
        friends: accountMenuCounts.friends + counts.friendChatUnread
      },
      inboxNotifications: inboxNotifications.slice(),
      totalUnread: counts.accountNotifications + counts.friendChatUnread
    };
  }

  function getNotificationMenuDestination(notification = {}) {
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

  function deriveAccountMenuCounts(notifications) {
    const derived = {
      notifications: 0,
      friends: 0,
      achievements: 0,
      profile: 0,
      statistics: 0
    };

    notifications.forEach((notification) => {
      if (!notification || notification.readAt) return;
      derived.notifications += 1;
      const destination = getNotificationMenuDestination(notification);
      if (destination && Object.hasOwn(derived, destination)) {
        derived[destination] += 1;
      }
    });
    return derived;
  }

  function setAccountMenuCounts(unreadCount, unreadMenuCounts) {
    const fallback = deriveAccountMenuCounts(inboxNotifications);
    Object.keys(accountMenuCounts).forEach((key) => {
      accountMenuCounts[key] = normaliseCount(
        unreadMenuCounts && Object.hasOwn(unreadMenuCounts, key)
          ? unreadMenuCounts[key]
          : fallback[key]
      );
    });
    accountMenuCounts.notifications = normaliseCount(unreadCount);
  }

  function emitChange() {
    window.dispatchEvent(
      new CustomEvent('oe-notification-count-changed', {
        detail: getSnapshot()
      })
    );
  }

  function setAccountNotifications({
    unreadCount = 0,
    unreadMenuCounts = null,
    notifications = []
  } = {}) {
    counts.accountNotifications = normaliseCount(unreadCount);
    inboxNotifications = Array.isArray(notifications)
      ? notifications.slice()
      : [];
    setAccountMenuCounts(unreadCount, unreadMenuCounts);
    emitChange();
    return getSnapshot();
  }

  function setFriendChatUnreadCount(unreadCount = 0) {
    counts.friendChatUnread = normaliseCount(unreadCount);
    emitChange();
    return getSnapshot();
  }

  function clear() {
    counts.accountNotifications = 0;
    counts.friendChatUnread = 0;
    Object.keys(accountMenuCounts).forEach((key) => {
      accountMenuCounts[key] = 0;
    });
    inboxNotifications = [];
    emitChange();
  }

  window.OEAccountNotificationState = {
    clear,
    getSnapshot,
    setAccountNotifications,
    setFriendChatUnreadCount
  };

  window.addEventListener('oe-account-state-changed', (event) => {
    if (!event.detail?.account) clear();
  });

  if (typeof SetScriptLoaded === 'function') {
    SetScriptLoaded(
      '/scripts/general/notifications/account-notification-state.js'
    );
  }
})();
