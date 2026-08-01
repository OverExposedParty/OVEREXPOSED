const cssFilesHeader = [
  '/css/general/settings/settings.css',
  '/css/general/settings/account-achievements.css',
  '/css/general/help-hub/help-hub.css',
  '/css/general/tool-tip/tool-tip.css',
  '/css/general/warning-message/warning-message-style.css',
  '/css/general/report-container/report-container.css',
  '/css/general/popup-feed/popup-feed.css',
  '/css/general/notification-badge.css',
  '/css/general/oe-dialog/oe-dialog.css',
  '/css/party-games/side-buttons.css',
  '/css/general/rotate-device/rotate-device.css'
];

const coreScripts = {
  '/scripts/general/dom-and-const/dom-and-const.js': { zIndex: 0 },
  '/scripts/general/utils/utils.js': { zIndex: 0 },
  '/scripts/general/guest-identity/guest-identity.js': { zIndex: 0 },
  '/scripts/general/tool-tip/tool-tip.js': { zIndex: 0 },
  '/scripts/general/cookies/cookies.js': { zIndex: 1 },
  '/scripts/general/notifications/account-notification-state.js': {
    zIndex: 0.99
  },

  '/scripts/general/sound/sound.js': { zIndex: 0.5 },
  '/scripts/general/settings-and-links/achievement-events.js': { zIndex: 1.01 },
  '/scripts/general/settings-and-links/account-access.js': { zIndex: 1.02 },
  '/scripts/general/settings-and-links/sound-settings.js': { zIndex: 1.03 },
  '/scripts/general/settings-and-links/console-shell.js': { zIndex: 1.04 },
  '/scripts/general/settings-and-links/console-commands.js': { zIndex: 1.05 },
  '/scripts/general/settings-and-links/console-interactions.js': {
    zIndex: 1.06
  },
  '/scripts/general/settings-and-links/console-settings.js': { zIndex: 1.07 },
  '/scripts/general/settings-and-links/settings-and-links.js': { zIndex: 1.08 },
  '/scripts/general/help-hub/page-configs.js': { zIndex: 1 },
  '/scripts/general/help-hub/mode-configs.js': { zIndex: 1 },
  '/scripts/general/help-hub/topic-copy.js': { zIndex: 1 },
  '/scripts/general/help-hub/data.js': { zIndex: 1.09 },
  '/scripts/general/help-hub/content.js': { zIndex: 1.091 },
  '/scripts/general/help-hub/view.js': { zIndex: 1.092 },
  '/scripts/general/help-hub/help-hub.js': { zIndex: 1.093 },
  '/scripts/general/overlay-and-toggle/overlay-and-toggle.js': {
    zIndex: 1.094
  },
  '/scripts/general/input-autosuggestions/input-autosuggestions.js': {
    zIndex: 1.095
  },
  '/scripts/general/oe-dialog/oe-dialog.js': { addDataLoaded: true, zIndex: 0 },
  '/scripts/general/side-buttons/side-buttons.js': { zIndex: 1 },
  '/scripts/general/report-container/report-container.js': { zIndex: 1 },
  '/scripts/general/popup-feed/popup-feed-navigation.js': { zIndex: 1 },
  '/scripts/general/popup-feed/popup-feed-achievements.js': { zIndex: 1 },
  '/scripts/general/popup-feed/popup-feed-account-prompt.js': { zIndex: 1 },
  '/scripts/general/popup-feed/popup-feed-social-notifications.js': {
    zIndex: 1
  },
  '/scripts/general/popup-feed/popup-feed-lobby-notifications.js': {
    zIndex: 1
  },
  '/scripts/general/popup-feed/popup-feed-oling-notifications.js': {
    zIndex: 1
  },
  '/scripts/general/popup-feed/popup-feed-notifications.js': { zIndex: 1 },
  '/scripts/general/popup-feed/popup-feed.js': {
    addDataLoaded: true,
    zIndex: 1
  },
  '/scripts/general/account-footer-hints/account-footer-hints.js': {
    addDataLoaded: true,
    zIndex: 1
  },
  '/scripts/general/account-container/account-container-core.js': {
    zIndex: 1.1
  },
  '/scripts/general/account-container/account-container-profile.js': {
    zIndex: 1.2
  },
  '/scripts/general/account-container/account-container-security.js': {
    zIndex: 1.2
  },
  '/scripts/general/account-container/account-container-friends-rendering.js': {
    zIndex: 1.2
  },
  '/scripts/general/account-container/account-container-friends.js': {
    zIndex: 1.2
  },
  '/scripts/general/account-container/account-container-purchases.js': {
    zIndex: 1.2
  },
  '/scripts/general/account-container/account-container-achievements.js': {
    zIndex: 1.2
  },
  '/scripts/general/account-container/account-container-statistics.js': {
    zIndex: 1.2
  },
  '/scripts/general/account-container/account-container-notifications.js': {
    zIndex: 1.2
  },
  '/scripts/general/account-container/account-container-navigation.js': {
    zIndex: 1.2
  },
  '/scripts/general/account-container/account-container-customisation.js': {
    zIndex: 1.2
  },
  '/scripts/general/account-container/account-container.js': {
    addDataLoaded: true,
    zIndex: 1.3
  },
  '/scripts/general/header-init/header-init.js': { zIndex: 2 },
  '/scripts/general/observers/observers.js': { zIndex: 1 },
  '/scripts/general/google-analytics/google-analytics.js': { zIndex: 2 },
  '/scripts/general/rotate-device/rotate-device.js': { zIndex: 2 },

  '/scripts/general/template-ready/template-ready.js': { zIndex: 2 },
  '/scripts/olings/shared/oling-battle-overlay.js': { zIndex: 2 },
  '/scripts/general/online/lobby-player-list.js': {
    addDataLoaded: true,
    zIndex: 3
  },
  '/scripts/general/online/user-customisation-icon/state.js': {
    addDataLoaded: true,
    zIndex: 3.1
  },
  '/scripts/general/online/user-customisation-icon/data.js': {
    addDataLoaded: true,
    zIndex: 3.1
  },
  '/scripts/general/online/user-customisation-icon/avatar-rendering.js': {
    addDataLoaded: true,
    zIndex: 3.1
  },
  '/scripts/general/online/user-customisation-icon/social-actions.js': {
    addDataLoaded: true,
    zIndex: 3.1
  },
  '/scripts/general/online/user-customisation-icon/public-profile.js': {
    addDataLoaded: true,
    zIndex: 3.1
  },
  '/scripts/general/online/user-customisation-icon/action-menus.js': {
    addDataLoaded: true,
    zIndex: 3.1
  },
  '/scripts/general/online/user-customisation-icon/lobby-icons.js': {
    addDataLoaded: true,
    zIndex: 3.1
  },
  '/scripts/general/online/user-customisation-icon/utilities.js': {
    addDataLoaded: true,
    zIndex: 3.1
  },
  '/scripts/general/online/user-customisation-icon.js': {
    addDataLoaded: true,
    zIndex: 4
  },
  '/scripts/general/online/user-customisation-header.js': {
    addDataLoaded: true,
    zIndex: 5
  }
};
