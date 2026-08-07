const accountButtonContainer = document.querySelector(
  '.account-button-container'
);
const accountPreviewEditButton = document.getElementById(
  'account-preview-edit-button'
);
const accountPreviewRandomiseButton = document.getElementById(
  'account-preview-randomise-button'
);
const accountOpalBalanceButton = document.getElementById(
  'account-opal-balance-button'
);
const accountOpalBalanceValue = document.getElementById(
  'account-opal-balance-value'
);
const accountFooterGridButtons = document.querySelectorAll(
  '.account-footer-grid'
);
const accountFooterAuthGrid = document.getElementById('footer-grid-1');
const accountFooterSaveGrid = document.getElementById('footer-grid-2');
const accountFooterHintController = window.createAccountFooterHintController?.({
  container: document.getElementById('account-container'),
  hintGrid: accountFooterSaveGrid,
  defaultLabel: 'Footer grid 2'
});
const accountSubtitle = document.getElementById('account-subtitle');
const accountLevelBadge = document.getElementById('account-level-badge');
const accountPreviewIcon = document.getElementById('account-preview-icon');
const accountExpandedPanel = document.getElementById('account-expanded-panel');
const accountExpandedTitle = document.getElementById('account-expanded-title');
const accountExpandedContent = document.getElementById(
  'account-expanded-content'
);
const accountExpandedBackButton = document.getElementById(
  'account-expanded-back-button'
);

const accountPreviewBlankCustomisation = {
  colour: '/images/user-customisation/colour/blank/blank-colour.svg',
  headSlot: '/images/user-customisation/head-slot/blank/no-head-slot.svg',
  eyesSlot: '/images/user-customisation/eyes-slot/blank/no-eyes-slot.svg',
  mouthSlot: '/images/user-customisation/mouth-slot/blank/no-mouth-slot.svg'
};

const accountActionRoutes = {
  notifications: 'NOTIFICATIONS',
  profile: 'PROFILE',
  friends: 'FRIENDS',
  achievements: 'ACHIEVEMENTS',
  statistics: 'STATISTICS'
};
const accountActionHints = {
  notifications: 'View your notifications',
  profile: 'View and manage your account details',
  friends: 'Open your friends list',
  achievements: 'View your unlocked achievements',
  statistics: 'View your account statistics'
};

const accountCustomisationSlotConfig = [
  { key: 'headSlot', storageKey: 'headSlotId', packSlot: 'head-slot' },
  { key: 'colour', storageKey: 'colourSlotId', packSlot: 'colour' },
  { key: 'eyesSlot', storageKey: 'eyesSlotId', packSlot: 'eyes-slot' },
  { key: 'mouthSlot', storageKey: 'mouthSlotId', packSlot: 'mouth-slot' }
];

const accountFooterLoginIconSvg =
  '<svg class="account-footer-login-icon" viewBox="0 0 296 256" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"><path d="M16 0h176v80h-32V32H48v192h112v-48h32v80H16V0Zm280 112v32H144v32l-64-48 64-48v32h152Z" /></svg>';
const accountFooterLogoutIconSvg =
  '<svg class="account-footer-logout-icon" viewBox="0 0 296 256" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"><path d="M16 0h176v80h-24V24H40v208h128v-56h24v80H16V0Zm112 104h112V80l56 48-56 48v-24H128v-48Z" /></svg>';
const accountLoginSplashScreen = '/images/splash-screens/overexposed.png';
const accountDefaultOeIcon = '0000:0100:0200:0300';
const accountSocialProviders = ['google', 'discord'];
const accountFriendTabs = [
  { id: 'friends', label: 'Friends' },
  { id: 'requests', label: 'Request' },
  { id: 'blocked', label: 'Block' }
];
const accountFriendTabStatusMap = {
  friends: ['friends'],
  requests: ['pending_received', 'pending_sent'],
  blocked: ['blocked']
};
const accountPurchaseTabs = [
  { id: 'all', label: 'All' },
  { id: 'orders', label: 'Orders' },
  { id: 'unlocks', label: 'Unlocks' }
];
const accountAchievementsConfigPath = '/api/achievements';
const accountAchievementRaritiesPath = '/json-files/achievements/rarities.json';
const accountExposedAchievementKeys = new Set(['is-anyone-home']);
const accountSocialProviderIcons = {
  google:
    '<svg class="account-profile-provider-icon account-profile-provider-icon-google" viewBox="0 0 2400 2400" aria-hidden="true" focusable="false"><path d="M2214.55,1224.55c0-72.73-6.55-142.64-18.73-209.09h-995.82v407.27h569.09c-24.55,132.27-99.27,244.09-211.36,319.09v264.55h342.73c200.45-184.55,314.09-456.36,314.09-781.82Z"/><path d="M1200,2269.09c286.91,0,527.73-95,703.64-258.18l-342.73-264.55c-95,63.64-216.36,101.36-360.91,101.36-277.27,0-512.27-187.27-596.36-439.09h-354.55v275c174.55,346.36,533.18,585.45,950.91,585.45Z"/><path d="M605.91,1396.82c-21.36-64.09-33.18-132.55-33.18-202.73s11.82-138.64,33.18-202.73v-273.64h-354.55c-72.27,144.55-113.18,307.73-113.18,476.36s40.91,331.82,113.18,476.36l354.55-273.64Z"/><path d="M1200,554.09c155.73,0,295.45,53.64,405.45,158.73l304.55-304.55c-184.09-171.82-423.18-277.73-710-277.73-415.45,0-774.09,237.73-948.64,584.09l354.55,273.64c83.64-250.73,317.73-434.18,594.09-434.18Z"/></svg>',
  discord:
    '<svg class="account-profile-provider-icon" viewBox="0 0 2400 2400" aria-hidden="true" focusable="false"><path d="M1894.19,555.56c-129.46-60.57-267.89-104.59-412.62-129.66-17.77,32.13-38.54,75.36-52.86,109.74-153.84-23.14-306.27-23.14-457.29,0-14.31-34.38-35.55-77.6-53.48-109.74-144.88,25.07-283.47,69.25-412.93,129.98C243.89,950.48,173.1,1335.28,208.49,1714.62c173.19,129.34,341.04,207.91,506.05,259.32,40.74-56.07,77.08-115.68,108.38-178.5-59.62-22.65-116.72-50.61-170.68-83.06,14.31-10.6,28.32-21.69,41.84-33.1,329.08,153.92,686.64,153.92,1011.8,0,13.69,11.41,27.68,22.49,41.84,33.1-54.11,32.61-111.37,60.57-170.99,83.23,31.3,62.66,67.48,122.43,108.38,178.5,165.17-51.41,333.18-129.98,506.37-259.48,41.53-439.75-70.94-821.01-297.31-1159.06ZM867.76,1481.33c-98.79,0-179.8-92.22-179.8-204.53s79.28-204.69,179.8-204.69,181.53,92.22,179.8,204.69c.16,112.31-79.28,204.53-179.8,204.53ZM1532.23,1481.33c-98.79,0-179.8-92.22-179.8-204.53s79.28-204.69,179.8-204.69,181.53,92.22,179.8,204.69c0,112.31-79.28,204.53-179.8,204.53Z"/></svg>',
  snapchat:
    '<svg class="account-profile-provider-icon" viewBox="0 0 2400 2400" aria-hidden="true" focusable="false"><path d="M1221.38,230.51c284.08,0,511.99,230.46,509.83,514.55-.85,111.24-1.69,220.87-2.35,308.09,8.01,2.11,25.84,6.23,47.39,6.23,19.24,0,41.46-3.29,62.31-14.24,28.83-14.57,54.65-25.24,79.01-25.24,21.1,0,41.1,8.01,61.01,28.45,42.87,44.01-3.06,85.63-72.88,112.83-65.02,25.61-166.04,51.22-169.09,136.04,23.23,103.23,91.2,213.67,220.09,312.09,106.77,82.73,175.94,89.77,211.78,89.77,3.69,0,7.02-.08,10-.15,3.2,0,6.01-.06,8.43-.06,6.05,0,9.63.41,10.75,3.27,3.88,16.8,16.97,83.22-108.1,114.43-124.28,32.01-148.93,10.4-174.23,75.23-25.3,64.82-16.71,92.82-47.92,92.82-20.85,0-114.56-18.06-196.78-18.06-37.68,0-72.95,3.79-97.68,14.86-76.29,34.4-197.43,179.25-376.75,188.05-178.39-8.8-297.32-153.65-373.08-188.05-24.57-11.08-59.77-14.86-97.45-14.86-82.22,0-176.21,18.06-197.06,18.06-31.21,0-22.2-28-46.51-92.82-24.32-64.83-50.09-43.21-173.88-75.23-123.8-31.21-109.69-97.63-105.56-114.43.57-2.77,3.81-3.62,9.45-3.62,2.52,0,5.52.17,8.98.42,2.98.07,6.32.15,10.01.15,35.84,0,105.2-7.06,213.95-89.77,130.39-98.43,200.05-208.86,224.85-312.09-1.76-84.83-102.39-110.43-167.02-136.04-70.21-27.21-114.7-68.82-71.16-112.83,20.22-20.43,40.35-28.45,61.46-28.45,24.35,0,50.01,10.67,78.61,25.24,20.68,10.95,42.85,14.24,62.1,14.24,21.53,0,39.43-4.12,47.48-6.23.66-87.23,1.5-196.86,2.35-308.09,2.17-284.09,233.59-514.55,517.67-514.55h20.01Z"/></svg>',
  apple:
    '<svg class="account-profile-provider-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M18.71,19.5c-.83,1.24-1.71,2.45-3.05,2.47-1.34,.03-1.77-.79-3.29-.79-1.53,0-2,.77-3.27,.82-1.31,.05-2.3-1.32-3.14-2.53-1.71-2.47-3.02-7.02-1.26-10.08,.87-1.52,2.43-2.48,4.12-2.51,1.28-.02,2.5,.87,3.29,.87,.78,0,2.26-1.07,3.81-.91,.65,.03,2.47,.26,3.64,1.98-.09,.06-2.17,1.27-2.15,3.81,.03,3.04,2.67,4.05,2.7,4.06-.03,.07-.43,1.44-1.4,2.81ZM13,3.5c.73-.83,1.94-1.46,2.94-1.5,.13,1.17-.34,2.35-1.04,3.19-.69,.85-1.83,1.51-2.95,1.42-.15-1.15,.41-2.36,1.05-3.11Z"/></svg>'
};
const accountEditIconSvg =
  '<svg class="account-profile-edit-icon" viewBox="0 0 1441 1441" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"><path d="M0 191h730v105H105v1040h1041V712h105v729H0V191Z"/><path fill-rule="evenodd" clip-rule="evenodd" d="M633 588 1220 1l221 221-587 587-302 81 81-302Zm119 28 75 75 467-469-74-74-468 468Zm-54 100-10 28 29-8-19-20Z"/></svg>';

let accountPreviewCustomisationLookup = null;
let accountCustomisationSlots = null;
let accountCustomisationDraft = null;
let accountCustomisationEditMode = false;
let accountIsLoggedIn = false;
let accountExpandedAction = '';
let pendingAccountOeCustomisationRequest = null;
let accountOeSaveInProgress = false;
let accountOeCustomisationCloseLocked = false;
let accountActiveGameModesPromise = null;
let accountOeEditingDisabled = false;
let accountAchievementsPromise = null;
let accountAchievementRaritiesPromise = null;
let accountAchievementRewardCatalog = new Map();
let pendingAccountAchievementKey = '';
let accountFriendSearchQuery = '';
let accountInviteSessionActive = false;
let accountCommerceEnabled = false;

function hasAccountCommerceAccess(account) {
  return Boolean(account);
}

function isOnlineGamePage() {
  return Boolean(
    document.querySelector(
      '#placeholder-card-container[data-online="true"], #placeholder-gamemode-addons-container[data-online="true"]'
    )
  );
}

function setAccountOeEditingDisabled(isDisabled) {
  accountOeEditingDisabled = isDisabled;
  accountContainer?.classList.toggle('is-oe-edit-disabled', isDisabled);

  if (!accountPreviewEditButton) return;

  accountPreviewEditButton.classList.toggle('disabled', isDisabled);
  accountPreviewEditButton.setAttribute(
    'aria-disabled',
    isDisabled ? 'true' : 'false'
  );
  accountPreviewEditButton.setAttribute('tabindex', isDisabled ? '-1' : '0');
  accountPreviewEditButton.dataset.accountHint = isDisabled
    ? 'OE editing is disabled during online games'
    : accountCustomisationEditMode
      ? 'Close OE editor'
      : 'Edit OE';
}

function getStoredAccount() {
  try {
    return JSON.parse(localStorage.getItem('oe-account')) || null;
  } catch {
    return null;
  }
}

function getLocalAccountCustomisationString() {
  const customisation = loadSavedAccountCustomisation();
  return createAccountCustomisationString(customisation);
}

function parseAccountCustomisationString(customisationString) {
  if (typeof customisationString !== 'string') return null;

  const [colourSlotId, headSlotId, eyesSlotId, mouthSlotId] =
    customisationString.split(':');
  if (!colourSlotId || !headSlotId || !eyesSlotId || !mouthSlotId) return null;

  return { colourSlotId, headSlotId, eyesSlotId, mouthSlotId };
}

function isAccountDefaultOeIcon(oeIcon) {
  return (
    !parseAccountCustomisationString(oeIcon) || oeIcon === accountDefaultOeIcon
  );
}

function getCurrentAccountOeIconString() {
  const customisation = loadSavedAccountCustomisation();
  return createAccountCustomisationString(customisation);
}

function closeAccountContainer() {
  if (!accountContainer) return;
  if (accountOeCustomisationCloseLocked) return;

  hideContainer(accountContainer);
  removeElementIfExists(settingsElementClassArray, accountContainer);

  if (!anyElementExists()) {
    toggleOverlay(false);
  }

  if (typeof syncHeaderIconActiveStates === 'function') {
    syncHeaderIconActiveStates();
  }
}

function setAccountOeCustomisationCloseLocked(isLocked) {
  accountOeCustomisationCloseLocked = isLocked;

  if (!accountContainer) return;

  accountContainer.classList.toggle('is-close-locked', isLocked);
  accountContainer.dataset.preventContainerClose = isLocked ? 'true' : 'false';
  if (isLocked) {
    accountContainer.setAttribute('aria-describedby', 'account-subtitle');
  } else {
    accountContainer.removeAttribute('aria-describedby');
  }
}

async function openAccountOeCustomisationEditor() {
  if (accountOeEditingDisabled) return false;
  if (!accountContainer) return false;

  removeAllElements(settingsElementClassArray, { sound: false });
  addElementIfNotExists(settingsElementClassArray, accountContainer);
  showContainer(accountContainer);
  toggleOverlay(true);

  if (typeof syncHeaderIconActiveStates === 'function') {
    syncHeaderIconActiveStates();
  }

  if (typeof refreshAccountPreview === 'function') {
    await refreshAccountPreview();
  }

  await setAccountCustomisationEditMode(true);
  return true;
}

function finishAccountOeCustomisationRequest(result) {
  if (!pendingAccountOeCustomisationRequest) return;

  const request = pendingAccountOeCustomisationRequest;
  pendingAccountOeCustomisationRequest = null;
  setAccountOeCustomisationCloseLocked(false);

  if (request.closeOnSave && result?.saved) {
    closeAccountContainer();
  }

  request.resolve(result);
}

function hasAccountCookieConsentDecision() {
  return localStorage.getItem('cookie-consent') !== null;
}

function waitForAccountCookieConsentDecision() {
  if (hasAccountCookieConsentDecision()) return Promise.resolve();

  if (typeof window.waitForCookieConsentDecision === 'function') {
    return window.waitForCookieConsentDecision();
  }

  return new Promise((resolve) => {
    const finish = () => {
      if (!hasAccountCookieConsentDecision()) return;

      window.removeEventListener('oe-cookie-consent-decision', finish);
      window.removeEventListener('storage', finish);
      resolve();
    };

    window.addEventListener('oe-cookie-consent-decision', finish);
    window.addEventListener('storage', finish);
  });
}

async function requestAccountOeCustomisation({
  requireNonDefault = true,
  closeOnSave = true,
  preventClose = false
} = {}) {
  await waitForAccountCookieConsentDecision();

  const currentIcon = getCurrentAccountOeIconString();

  if (accountOeEditingDisabled) {
    return { saved: false, icon: currentIcon, skipped: false, disabled: true };
  }

  if (requireNonDefault && !isAccountDefaultOeIcon(currentIcon)) {
    return { saved: false, icon: currentIcon, skipped: true };
  }

  if (pendingAccountOeCustomisationRequest) {
    return pendingAccountOeCustomisationRequest.promise;
  }

  setAccountOeCustomisationCloseLocked(preventClose);

  const opened = await openAccountOeCustomisationEditor();
  if (!opened) {
    setAccountOeCustomisationCloseLocked(false);
    return { saved: false, icon: currentIcon, skipped: false };
  }

  let resolveRequest;
  const promise = new Promise((resolve) => {
    resolveRequest = resolve;
  });

  pendingAccountOeCustomisationRequest = {
    closeOnSave,
    preventClose,
    resolve: resolveRequest,
    promise
  };

  return promise;
}

function saveAccountToLocalStorage(account) {
  if (!account) return;

  if (
    !localStorage.getItem('oe-account') &&
    localStorage.getItem('oe-guest') === 'true'
  ) {
    const guestCustomisation = localStorage.getItem('user-customisation');
    if (guestCustomisation) {
      localStorage.setItem('oe-guest-customisation', guestCustomisation);
    }
  }

  localStorage.removeItem('oe-guest');
  localStorage.setItem('oe-account', JSON.stringify(account));
}

function applyAccountOeIcon(account) {
  if (isAccountDefaultOeIcon(account?.oeIcon)) return;

  const customisation = parseAccountCustomisationString(account?.oeIcon);
  if (!customisation) return;

  localStorage.setItem('user-customisation', JSON.stringify(customisation));
}

function createAccountActionContainer({ id, action, label, primary = false }) {
  const container = document.createElement('div');
  container.className = primary
    ? 'account-action-container primary'
    : 'account-action-container';
  container.id = id;
  container.dataset.accountAction = action;
  container.dataset.accountHint = accountActionHints[action] || label;
  container.setAttribute('role', 'button');
  container.setAttribute('tabindex', accountIsLoggedIn ? '0' : '-1');
  container.setAttribute('aria-disabled', accountIsLoggedIn ? 'false' : 'true');
  container.classList.toggle('disabled', !accountIsLoggedIn);

  const labelElement = document.createElement('span');
  labelElement.className = 'account-action-label';
  labelElement.textContent = label;

  const badge = document.createElement('span');
  badge.className =
    'notification-count-badge account-action-notification-badge';
  badge.hidden = true;
  badge.setAttribute('aria-hidden', 'true');

  container.dataset.accountLabel = label;
  container.append(labelElement, badge);

  return container;
}

function formatAccountActionNotificationCount(count) {
  return count > 9 ? '9+' : String(count);
}

function updateAccountActionNotificationBadges(snapshot) {
  const state =
    snapshot || window.OEAccountNotificationState?.getSnapshot?.() || {};
  const menuCounts = state.menuCounts || {};

  accountButtonContainer
    ?.querySelectorAll('.account-action-container[data-account-action]')
    .forEach((actionButton) => {
      const action = actionButton.dataset.accountAction;
      const count = Math.max(0, Math.trunc(Number(menuCounts[action]) || 0));
      const badge = actionButton.querySelector(
        '.account-action-notification-badge'
      );
      if (!badge) return;

      const previousCount = Math.max(
        0,
        Math.trunc(Number(badge.dataset.notificationCount) || 0)
      );
      badge.textContent = count
        ? formatAccountActionNotificationCount(count)
        : '';
      badge.hidden = count === 0;
      badge.dataset.notificationCount = String(count);

      const label = actionButton.dataset.accountLabel || action;
      actionButton.setAttribute(
        'aria-label',
        count
          ? `${label}, ${count} unread notification${count === 1 ? '' : 's'}`
          : label
      );

      if (count > previousCount) {
        badge.classList.remove('is-increasing');
        badge.getBoundingClientRect();
        badge.classList.add('is-increasing');
      }
    });
}

function renderAccountActionMenu() {
  if (!accountButtonContainer) return;

  accountButtonContainer.replaceChildren(
    createAccountActionContainer({
      id: 'account-notifications-button',
      action: 'notifications',
      label: 'NOTIFICATIONS',
      primary: true
    }),
    createAccountActionContainer({
      id: 'account-profile-button',
      action: 'profile',
      label: 'PROFILE'
    }),
    createAccountActionContainer({
      id: 'account-friends-button',
      action: 'friends',
      label: 'FRIENDS'
    }),
    createAccountActionContainer({
      id: 'account-achievements-button',
      action: 'achievements',
      label: 'ACHIEVEMENTS'
    }),
    createAccountActionContainer({
      id: 'account-statistics-button',
      action: 'statistics',
      label: 'STATISTICS'
    })
  );
  updateAccountActionNotificationBadges();
}

function setAccountActionButtonsDisabled(isDisabled) {
  accountButtonContainer
    ?.querySelectorAll('.account-action-container')
    .forEach((actionButton) => {
      actionButton.classList.toggle('disabled', isDisabled);
      actionButton.setAttribute('aria-disabled', isDisabled ? 'true' : 'false');
      actionButton.setAttribute('tabindex', isDisabled ? '-1' : '0');
    });
}

function formatAccountDate(value) {
  if (!value) return '-';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';

  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

function formatAccountNumber(value) {
  return new Intl.NumberFormat().format(Number(value) || 0);
}

function getAccountLevel(account) {
  return Math.max(1, Number(account?.gameData?.level) || 1);
}

function setAccountLevelBadge(account) {
  if (!accountLevelBadge) return;

  accountLevelBadge.hidden = !account;
  if (!account) return;

  const level = formatAccountNumber(getAccountLevel(account));
  accountLevelBadge.replaceChildren();
  const label = document.createElement('span');
  label.className = 'account-level-label';
  label.textContent = 'LVL';
  const number = document.createElement('span');
  number.className = 'account-level-number';
  number.textContent = level;
  accountLevelBadge.append(label, number);
  accountLevelBadge.setAttribute('aria-label', `Level ${level}`);
}

function getAccountOpalBalance(account) {
  return Math.max(0, Number(account?.gameData?.opals?.balance) || 0);
}

function setAccountOpalBalance(account) {
  const balance = getAccountOpalBalance(account);

  if (accountOpalBalanceButton) {
    accountOpalBalanceButton.hidden = !account || !accountCommerceEnabled;
  }

  if (accountOpalBalanceValue) {
    accountOpalBalanceValue.textContent = formatAccountNumber(balance);
  }

  if (accountOpalBalanceButton) {
    accountOpalBalanceButton.setAttribute(
      'aria-label',
      `${formatAccountNumber(balance)} Opals`
    );
  }
}

function formatAccountPercent(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '0%';
  return `${Math.max(0, Math.round(number))}%`;
}

function formatAccountRatioPercent(numerator, denominator) {
  const total = Number(denominator) || 0;
  if (total <= 0) return '0%';
  return formatAccountPercent(((Number(numerator) || 0) / total) * 100);
}

function formatAccountProvider(provider) {
  const labels = {
    email: 'Email',
    google: 'Google',
    discord: 'Discord',
    snapchat: 'Snapchat',
    apple: 'Apple'
  };

  return labels[provider] || String(provider || '').toUpperCase();
}

function formatAccountSettingLabel(value) {
  return String(value || '-')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getAccountDisplayName(account) {
  if (!account) {
    const guestName =
      typeof window.getOeGuestDisplayName === 'function'
        ? window.getOeGuestDisplayName()
        : 'guest';
    return `Playing as ${guestName}`;
  }

  const suffix =
    account.accountStatus === 'pending_verification'
      ? ' (pending verification)'
      : '';

  return `${account.username || 'Account'}${suffix}`;
}
