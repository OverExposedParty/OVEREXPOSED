(function () {
  const counts = {
    accountNotifications: 0,
    friendChatUnread: 0
  };
  let inboxNotifications = [];

  function normaliseCount(value) {
    return Math.max(0, Math.trunc(Number(value) || 0));
  }

  function getSnapshot() {
    return {
      counts: { ...counts },
      inboxNotifications: inboxNotifications.slice(),
      totalUnread: counts.accountNotifications + counts.friendChatUnread
    };
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
    notifications = []
  } = {}) {
    counts.accountNotifications = normaliseCount(unreadCount);
    inboxNotifications = Array.isArray(notifications)
      ? notifications.slice()
      : [];
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
