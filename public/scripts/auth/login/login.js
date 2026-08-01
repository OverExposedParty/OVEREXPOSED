(function initialiseLoginPage() {
  const authModeButtons = document.querySelectorAll('[data-auth-mode]');
  const authForms = document.querySelectorAll('[data-auth-form]');
  const authStatus = document.getElementById('auth-status');
  const authTitle = document.getElementById('auth-title');
  const authTitleText = document.getElementById('auth-title-text');
  const socialAuthButtons = document.querySelectorAll('[data-social-provider]');
  const passwordToggleButtons = document.querySelectorAll(
    '[data-password-toggle]'
  );
  const lowercaseInputs = document.querySelectorAll('[data-lowercase]');
  const continueAsGuestButton = document.getElementById(
    'continue-as-guest-button'
  );
  const forgotPasswordButton = document.getElementById(
    'forgot-password-button'
  );
  const backToLoginButton = document.getElementById('back-to-login-button');
  const legalDialog = document.getElementById('auth-legal-dialog');
  const legalContent = document.getElementById('auth-legal-content');
  const legalVersion = document.getElementById('auth-legal-version');
  const defaultOeIcon = '0000:0100:0200:0300';
  const requiredFactories = [
    'createLoginAuthSession',
    'createLoginAuthSubmissions',
    'createLoginAuthUi',
    'createLoginLegalDialog'
  ];
  const missingFactories = requiredFactories.filter(
    (factoryName) => typeof window[factoryName] !== 'function'
  );

  if (missingFactories.length) {
    console.error('Login modules did not load:', missingFactories);
    SetScriptLoaded('/scripts/auth/login/login.js');
    return;
  }

  const ui = window.createLoginAuthUi({
    authForms,
    authModeButtons,
    authStatus,
    authTitle,
    authTitleText
  });
  const session = window.createLoginAuthSession({
    defaultOeIcon,
    setAuthStatus: ui.setAuthStatus
  });
  const submissions = window.createLoginAuthSubmissions({ session, ui });
  const legal = window.createLoginLegalDialog({
    legalDialog,
    legalContent,
    legalVersion
  });

  function playLoginSound(soundKey) {
    if (!soundKey || typeof window.playSoundEffect !== 'function') return;
    Promise.resolve(window.playSoundEffect(soundKey)).catch(() => {});
  }

  authModeButtons.forEach((button) => {
    button.addEventListener('click', () =>
      ui.setAuthMode(button.dataset.authMode)
    );
  });
  submissions.bindSocialAuthButtons(socialAuthButtons);
  passwordToggleButtons.forEach(ui.initialisePasswordToggle);
  lowercaseInputs.forEach((input) => {
    input.addEventListener('input', () => {
      input.value = input.value.toLowerCase();
    });
  });
  document
    .getElementById('login-form')
    ?.addEventListener('submit', submissions.handleLoginSubmit);
  document
    .getElementById('signup-form')
    ?.addEventListener('submit', submissions.handleSignupSubmit);
  document
    .getElementById('password-reset-request-form')
    ?.addEventListener('submit', submissions.handlePasswordResetRequestSubmit);
  continueAsGuestButton?.addEventListener('click', session.continueAsGuest);
  forgotPasswordButton?.addEventListener('click', () => {
    ui.setAuthMode('reset');
    playLoginSound('uiNext');
  });
  backToLoginButton?.addEventListener('click', () => {
    ui.setAuthMode('login');
    playLoginSound('uiPrevious');
  });
  authForms.forEach(ui.initialiseSubmitButtonState);

  const authTitleResizeObserver =
    typeof ResizeObserver === 'function'
      ? new ResizeObserver(ui.fitAuthTitleToWidth)
      : null;
  if (authTitle?.parentElement)
    authTitleResizeObserver?.observe(authTitle.parentElement);

  window.addEventListener('resize', ui.fitAuthTitleToWidth);
  document.fonts?.ready
    .then(ui.fitAuthTitleToWidth)
    .catch(ui.fitAuthTitleToWidth);
  ui.fitAuthTitleToWidth();
  legal.initialiseLegalDialog();
  session.showOAuthRedirectStatus();

  const initialAuthMode = new URLSearchParams(window.location.search).get(
    'mode'
  );
  if (['signup', 'reset'].includes(initialAuthMode))
    ui.setAuthMode(initialAuthMode);

  SetScriptLoaded('/scripts/auth/login/login.js');
})();
