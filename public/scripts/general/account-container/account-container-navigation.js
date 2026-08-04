function playAccountContainerSound(soundKey) {
  if (!soundKey || typeof window.playSoundEffect !== 'function') return;
  Promise.resolve(window.playSoundEffect(soundKey)).catch(() => {});
}

function createAccountSettingsOption({ id, label, hint }) {
  const option = document.createElement('div');
  option.className = 'settings-option account-settings-option';
  option.dataset.accountHint = hint || label;

  const labelElement = document.createElement('label');
  labelElement.setAttribute('for', id);
  labelElement.textContent = label;

  const switchLabel = document.createElement('label');
  switchLabel.className = 'toggle-switch';

  const input = document.createElement('input');
  input.type = 'checkbox';
  input.id = id;
  input.style.opacity = '0';

  const slider = document.createElement('span');
  slider.className = 'slider';

  switchLabel.append(input, slider);
  option.append(labelElement, switchLabel);
  return option;
}

function createAccountSettingsVolumeSlider({ id, label, hint }) {
  const option = document.createElement('div');
  option.className = 'settings-option account-settings-volume-option';
  option.dataset.accountHint = hint || `${label} volume`;

  const labelElement = document.createElement('label');
  labelElement.className = 'settings-volume-label';
  labelElement.setAttribute('for', id);
  labelElement.textContent = label;

  const controls = document.createElement('div');
  controls.className = 'settings-volume-control';

  const input = document.createElement('input');
  input.type = 'range';
  input.id = id;
  input.className = 'settings-volume-slider';
  input.min = '0';
  input.max = '100';
  input.step = '1';
  input.value = '100';
  input.dataset.accountHint = hint || `${label} volume`;

  const value = document.createElement('span');
  value.className = 'settings-volume-value';
  value.dataset.volumeValueFor = id;
  value.textContent = '100%';

  controls.append(input, value);
  option.append(labelElement, controls);
  return option;
}

function createAccountDebuggingControl({
  id,
  label,
  hint,
  type = 'text',
  options = []
}) {
  const option = document.createElement('div');
  option.className = 'settings-option account-settings-debug-option';
  option.dataset.accountHint = hint;

  const labelElement = document.createElement('label');
  labelElement.setAttribute('for', id);
  labelElement.textContent = label;

  let control;
  if (type === 'select') {
    control = document.createElement('select');
    options.forEach(({ value, label: optionLabel }) => {
      const selectOption = document.createElement('option');
      selectOption.value = value;
      selectOption.textContent = optionLabel;
      control.appendChild(selectOption);
    });
  } else {
    control = document.createElement('input');
    control.type = 'text';
    control.autocomplete = 'off';
    control.spellcheck = false;
    control.placeholder = 'off, all, or category';
  }

  control.id = id;
  control.className = 'account-settings-debug-control';
  control.dataset.accountHint = hint;
  option.append(labelElement, control);
  return option;
}

function createAccountDebuggingHistoryUsage() {
  const option = document.createElement('div');
  option.className =
    'settings-option account-settings-debug-option account-settings-debug-history';
  option.dataset.accountHint = 'Debug history retained on this device';

  const label = document.createElement('span');
  label.className = 'account-settings-debug-label';
  label.textContent = 'History';

  const usage = document.createElement('output');
  usage.id = 'settings-debug-history-usage';
  usage.className = 'account-settings-debug-usage';
  usage.setAttribute('aria-live', 'polite');
  usage.textContent = '0 / 0 entries';

  option.append(label, usage);
  return option;
}

let accountDebugStatusUnsubscribe = null;
let accountDebugFilterAutosuggestion = null;

function disconnectAccountDebugStatus() {
  if (typeof accountDebugStatusUnsubscribe === 'function') {
    accountDebugStatusUnsubscribe();
  }
  accountDebugFilterAutosuggestion?.destroy?.();
  accountDebugStatusUnsubscribe = null;
  accountDebugFilterAutosuggestion = null;
}

function syncAccountDebuggingStatus(root, status) {
  if (!status) return;

  const filterControl = root.querySelector('#settings-debug-filter');
  const levelControl = root.querySelector('#settings-debug-minimum-level');
  const historyUsage = root.querySelector('#settings-debug-history-usage');

  if (filterControl && filterControl.value !== status.filter) {
    filterControl.value = status.filter;
    filterControl.__oeInputAutosuggestionController?.sync?.();
  }
  if (levelControl && levelControl.value !== status.minimumLevel) {
    levelControl.value = status.minimumLevel;
  }
  if (historyUsage) {
    historyUsage.textContent = `${status.historySize} / ${status.historyLimit} entries`;
  }
}

function bindAccountDebuggingControls(root = document) {
  disconnectAccountDebugStatus();

  const filterControl = root.querySelector?.('#settings-debug-filter');
  const levelControl = root.querySelector?.('#settings-debug-minimum-level');
  const debugService = window.OEDebug;
  if (!filterControl || !levelControl || !debugService) return;

  const syncStatus = (status) => syncAccountDebuggingStatus(root, status);

  function commitFilter(filter) {
    const status = debugService.setFilter(filter);
    if (!status) {
      syncStatus(debugService.getStatus());
      if (typeof setAccountFooterHint === 'function') {
        setAccountFooterHint('Use off, all, or a dotted debug category');
      }
      return;
    }

    if (typeof setAccountFooterHint === 'function') {
      setAccountFooterHint(`Debug filter set to ${status.filter}`);
    }
  }

  if (window.OEInputAutosuggestions?.bind) {
    accountDebugFilterAutosuggestion = window.OEInputAutosuggestions.bind(
      filterControl,
      {
        suggestions: () => debugService.filterSuggestions || [],
        normalise: (value) =>
          String(value || '')
            .trim()
            .toLowerCase(),
        onCommit: commitFilter
      }
    );
  } else {
    filterControl.addEventListener('change', () => {
      commitFilter(filterControl.value);
    });
  }

  levelControl.addEventListener('change', () => {
    const status = debugService.setMinimumLevel(levelControl.value);
    if (!status) {
      syncStatus(debugService.getStatus());
      return;
    }

    if (typeof setAccountFooterHint === 'function') {
      setAccountFooterHint(`Minimum debug level set to ${status.minimumLevel}`);
    }
  });

  if (typeof debugService.subscribeStatus === 'function') {
    accountDebugStatusUnsubscribe = debugService.subscribeStatus(syncStatus);
  } else {
    syncStatus(debugService.getStatus());
  }
}

function createAccountSettingsSection(title, options) {
  const section = document.createElement('section');
  section.className = 'settings-section account-settings-section';
  section.dataset.settingsSection = title.toLowerCase();

  const heading = document.createElement('h3');
  heading.className = 'settings-section-title';
  heading.textContent = title;

  const optionList = document.createElement('div');
  optionList.className = 'settings-section-options';
  options.forEach((option) => optionList.appendChild(option));

  section.append(heading, optionList);
  return section;
}

function renderAccountSettingsPanel() {
  if (!accountExpandedContent) return;

  const contentSection = createAccountSettingsSection('Content', [
    createAccountSettingsOption({
      id: 'settings-nsfw',
      label: 'NSFW',
      hint: 'Toggle NSFW content'
    })
  ]);
  const audioSection = createAccountSettingsSection('Audio', [
    createAccountSettingsOption({
      id: 'settings-sound',
      label: 'Sound',
      hint: 'Toggle all sound'
    }),
    createAccountSettingsVolumeSlider({
      id: 'settings-sound-volume-master',
      label: 'Master',
      hint: 'Adjust master volume'
    }),
    createAccountSettingsVolumeSlider({
      id: 'settings-sound-volume-ui',
      label: 'UI',
      hint: 'Adjust UI sound volume'
    }),
    createAccountSettingsVolumeSlider({
      id: 'settings-sound-volume-game',
      label: 'Game',
      hint: 'Adjust game sound volume'
    }),
    createAccountSettingsVolumeSlider({
      id: 'settings-sound-volume-notifications',
      label: 'Notifications',
      hint: 'Adjust notification volume'
    })
  ]);

  const sections = [contentSection, audioSection];
  const account = getStoredAccount();
  const canAccessDeveloperSettings =
    typeof canAccountAccessSettingsConsole === 'function' &&
    canAccountAccessSettingsConsole(account);
  if (canAccessDeveloperSettings) {
    sections.push(
      createAccountSettingsSection('Developer', [
        createAccountSettingsOption({
          id: 'settings-console',
          label: 'Console',
          hint: 'Toggle developer console'
        })
      ]),
      createAccountSettingsSection('Advanced debugging', [
        createAccountDebuggingControl({
          id: 'settings-debug-filter',
          label: 'Filter',
          hint: 'Choose which debug messages appear in browser DevTools'
        }),
        createAccountDebuggingControl({
          id: 'settings-debug-minimum-level',
          label: 'Minimum level',
          hint: 'Choose the lowest severity shown in browser DevTools',
          type: 'select',
          options: [
            { value: 'debug', label: 'Debug' },
            { value: 'info', label: 'Info' },
            { value: 'warn', label: 'Warn' },
            { value: 'error', label: 'Error' }
          ]
        }),
        createAccountDebuggingHistoryUsage()
      ])
    );
  }

  accountExpandedContent.replaceChildren(...sections);

  if (typeof window.bindSettingsPreferenceControls === 'function') {
    window.bindSettingsPreferenceControls(accountExpandedContent);
  }
  if (typeof window.bindSettingsConsoleControl === 'function') {
    window.bindSettingsConsoleControl(accountExpandedContent);
  }
  bindAccountDebuggingControls(accountExpandedContent);
}

function renderAccountExpandedContent(action) {
  if (!accountExpandedContent) return;
  disconnectAccountDebugStatus();

  if (action === 'settings') {
    renderAccountSettingsPanel();
    return;
  }

  if (action === 'profile') {
    renderAccountProfilePanel();
    return;
  }

  if (action === 'security') {
    renderAccountSecurityPanel();
    return;
  }

  if (action === 'notifications') {
    renderAccountNotificationsPanel();
    return;
  }

  if (action === 'friends') {
    renderAccountFriendsPanel();
    return;
  }

  if (action === 'achievements') {
    renderAccountAchievementsPanel();
    return;
  }

  if (action === 'purchaseHistory') {
    renderAccountPurchaseHistoryPanel();
    return;
  }

  if (action === 'statistics') {
    renderAccountStatisticsPanel();
    return;
  }

  accountExpandedContent.replaceChildren(
    createAccountProfileRow('Status', 'Coming soon')
  );
}

async function sendAccountVerificationEmail(button) {
  button.disabled = true;
  const originalText = button.textContent;
  button.textContent = 'Sending...';

  try {
    const response = await fetch('/api/accounts/verify-email/request', {
      method: 'POST',
      credentials: 'same-origin'
    });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok || payload.success === false) {
      throw new Error(
        payload?.error?.message || 'Failed to send verification email'
      );
    }

    if (payload.account) {
      setAccountPreview(payload.account);
    }
    button.textContent = payload.message || 'Verification email sent.';
    playAccountContainerSound('accountEmailSent');
  } catch (error) {
    button.disabled = false;
    button.textContent = originalText;
    playAccountContainerSound('notificationFailure');
    console.warn(error);
  }
}

function linkAccountProvider(provider) {
  if (!accountSocialProviders.includes(provider)) return;

  const params = new URLSearchParams({
    mode: 'link',
    returnTo: getCurrentAccountReturnPath(),
    splashScreen: getCurrentAccountSplashScreen()
  });

  window.location.href = `/api/auth/${provider}/start?${params.toString()}`;
}

async function requestAccountEmailChange(button) {
  button.disabled = true;
  const originalTitle = button.title;
  button.title = 'Sending email change link';
  setAccountFooterHint('Sending email change link');

  try {
    const response = await fetch('/api/accounts/email-change/request', {
      method: 'POST',
      credentials: 'same-origin'
    });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok || payload.success === false) {
      throw new Error(
        payload?.error?.message || 'Failed to send email change link'
      );
    }

    const message = payload.message || 'Email change link sent';
    button.title = message;
    setAccountFooterHint(message);
    playAccountContainerSound('accountEmailSent');
  } catch (error) {
    button.disabled = false;
    button.title = originalTitle;
    setAccountFooterHint('Email change link failed');
    playAccountContainerSound('notificationFailure');
    console.warn(error);
  }
}

async function patchAccountPrivacySettings(button, settings) {
  button.disabled = true;
  const originalText = button.textContent;
  button.textContent = 'Saving...';

  try {
    const response = await fetch('/api/accounts/me/privacy-settings', {
      method: 'PATCH',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings)
    });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok || payload.success === false) {
      throw new Error(payload?.error?.message || 'Failed to save privacy');
    }

    if (payload.account) {
      setAccountPreview(payload.account);
      renderAccountProfilePanel();
    }
    setAccountFooterHint(payload.message || 'Privacy settings saved');
    playAccountContainerSound('uiSuccess');
  } catch (error) {
    button.disabled = false;
    button.textContent = originalText;
    setAccountFooterHint(error.message || 'Privacy settings failed');
    playAccountContainerSound('notificationFailure');
    console.warn(error);
  }
}

async function patchAccountMarketingConsent(button, accepted) {
  button.disabled = true;
  const originalText = button.textContent;
  button.textContent = 'Saving...';

  try {
    const response = await fetch('/api/accounts/me/marketing-consent', {
      method: 'PATCH',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accepted })
    });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok || payload.success === false) {
      throw new Error(
        payload?.error?.message || 'Failed to save marketing preference'
      );
    }

    if (payload.account) {
      setAccountPreview(payload.account);
      renderAccountProfilePanel();
    }
    setAccountFooterHint(payload.message || 'Marketing preference saved');
    playAccountContainerSound('uiSuccess');
  } catch (error) {
    button.disabled = false;
    button.textContent = originalText;
    setAccountFooterHint(error.message || 'Marketing preference failed');
    playAccountContainerSound('notificationFailure');
    console.warn(error);
  }
}

async function requestAccountDataExport(button) {
  button.disabled = true;
  const originalText = button.textContent;
  button.textContent = 'Requesting...';

  try {
    const response = await fetch('/api/accounts/me/data-export-requests', {
      method: 'POST',
      credentials: 'same-origin'
    });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok || payload.success === false) {
      throw new Error(
        payload?.error?.message || 'Failed to request data export'
      );
    }

    if (payload.account) {
      setAccountPreview(payload.account);
      renderAccountProfilePanel();
    }
    setAccountFooterHint(payload.message || 'Data export requested');
  } catch (error) {
    button.disabled = false;
    button.textContent = originalText;
    setAccountFooterHint(error.message || 'Data export failed');
    console.warn(error);
  }
}

async function requestAccountDeletion(button) {
  const confirmation = window.prompt(
    'Type DELETE to request account deletion.'
  );
  if (confirmation === null) return;

  button.disabled = true;
  const originalText = button.textContent;
  button.textContent = 'Requesting...';

  try {
    const response = await fetch('/api/accounts/me/deletion-requests', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirmation })
    });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok || payload.success === false) {
      throw new Error(payload?.error?.message || 'Failed to request deletion');
    }

    if (payload.account) {
      setAccountPreview(payload.account);
      renderAccountProfilePanel();
    }
    setAccountFooterHint(payload.message || 'Account deletion requested');
  } catch (error) {
    button.disabled = false;
    button.textContent = originalText;
    setAccountFooterHint(error.message || 'Deletion request failed');
    console.warn(error);
  }
}

function setAccountFooterAuthState(isLoggedIn) {
  if (!accountFooterAuthGrid) return;

  accountFooterAuthGrid.dataset.accountHint = isLoggedIn
    ? 'Sign out of your account'
    : 'Sign in to your account';
  accountFooterAuthGrid.setAttribute(
    'aria-label',
    isLoggedIn ? 'Sign out' : 'Sign in'
  );
  accountFooterAuthGrid.replaceChildren(
    createTrustedHtmlFragment(
      isLoggedIn ? accountFooterLogoutIconSvg : accountFooterLoginIconSvg
    )
  );
}

function getCurrentAccountReturnPath() {
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

function normaliseAccountSplashScreenPath(path) {
  return path?.startsWith('/images/splash-screens/') ? path : '';
}

function getAccountSplashScreenFromCss() {
  const splashScreenValue = getComputedStyle(document.documentElement)
    .getPropertyValue('--splashscreen')
    .trim();
  const splashScreenMatch = splashScreenValue.match(
    /url\(["']?([^"')]+)["']?\)/
  );

  return normaliseAccountSplashScreenPath(splashScreenMatch?.[1]);
}

function getAccountSplashScreenFromPreload() {
  const preload = document.querySelector(
    'link[rel="preload"][as="image"][href*="/images/splash-screens/"]'
  );

  return normaliseAccountSplashScreenPath(preload?.getAttribute('href'));
}

function getAccountSplashScreenFromPageImage() {
  const splashImage =
    document.querySelector('#splash-screen-container-static img') ||
    document.querySelector('#splash-screen-container img');

  return normaliseAccountSplashScreenPath(splashImage?.getAttribute('src'));
}

function getCurrentAccountSplashScreen() {
  return (
    getAccountSplashScreenFromCss() ||
    getAccountSplashScreenFromPreload() ||
    getAccountSplashScreenFromPageImage() ||
    '/images/splash-screens/overexposed.png'
  );
}

function redirectToLoginFromAccount() {
  const loginPath = `/sign-in?returnTo=${encodeURIComponent(
    getCurrentAccountReturnPath()
  )}&splashScreen=${encodeURIComponent(
    getCurrentAccountSplashScreen()
  )}&authEntryPoint=account_container`;

  if (typeof transitionSplashScreen === 'function') {
    transitionSplashScreen(loginPath, accountLoginSplashScreen);
    return;
  }

  window.location.href = loginPath;
}

function setAccountExpandedPanel(actionTitle = '', action = '') {
  if (!accountExpandedPanel || !accountExpandedTitle) return;

  clearAccountFooterHint();
  if (action !== 'achievements') pendingAccountAchievementKey = '';
  accountExpandedAction = actionTitle ? action : '';
  accountExpandedTitle.textContent = actionTitle;
  accountContainer?.classList.toggle(
    'has-expanded-action',
    Boolean(actionTitle)
  );

  if (actionTitle) {
    renderAccountExpandedContent(action);
  } else {
    disconnectAccountDebugStatus();
    accountExpandedContent?.replaceChildren();
  }

  if (typeof syncHeaderIconActiveStates === 'function') {
    syncHeaderIconActiveStates();
  }
}

function setAccountFooterHint(text = '') {
  accountFooterHintController?.setHint(text);
}

function clearAccountFooterHint() {
  accountFooterHintController?.clearHint();
}
