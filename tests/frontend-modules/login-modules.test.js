const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const { JSDOM } = require('jsdom');
const { renderLoginPage } = require('../../server/services/page-assets-login');

const root = path.resolve(__dirname, '..', '..');
const modulePaths = [
  'public/scripts/auth/login/legal-dialog.js',
  'public/scripts/auth/login/auth-ui.js',
  'public/scripts/auth/login/auth-session.js',
  'public/scripts/auth/login/auth-submissions.js'
];

test('login support modules register their composition factories', () => {
  const context = vm.createContext({ window: {} });

  modulePaths.forEach((relativePath) => {
    vm.runInContext(
      fs.readFileSync(path.join(root, relativePath), 'utf8'),
      context,
      { filename: relativePath }
    );
  });

  [
    'createLoginLegalDialog',
    'createLoginAuthUi',
    'createLoginAuthSession',
    'createLoginAuthSubmissions'
  ].forEach((factoryName) => {
    assert.equal(typeof context.window[factoryName], 'function');
  });
});

test('login preserves the local guest customisation before applying the account icon', () => {
  const sessionPath = path.join(
    root,
    'public/scripts/auth/login/auth-session.js'
  );
  const dom = new JSDOM('', {
    runScripts: 'outside-only',
    url: 'https://overexposed.test/sign-in'
  });
  const guestCustomisation = JSON.stringify({
    colourSlotId: 'guest-colour',
    headSlotId: 'guest-head',
    eyesSlotId: 'guest-eyes',
    mouthSlotId: 'guest-mouth'
  });
  dom.window.localStorage.setItem('oe-guest', 'true');
  dom.window.localStorage.setItem('user-customisation', guestCustomisation);
  dom.window.eval(fs.readFileSync(sessionPath, 'utf8'));
  const session = dom.window.createLoginAuthSession({
    defaultOeIcon: '0000:0100:0200:0300',
    setAuthStatus() {}
  });

  session.storeAccount({
    id: 'account-one',
    oeIcon: 'account-colour:account-head:account-eyes:account-mouth'
  });

  assert.equal(
    dom.window.localStorage.getItem('oe-guest-customisation'),
    guestCustomisation
  );
  dom.window.close();
});

test('login page loads support modules before its coordinator', () => {
  const page = renderLoginPage();
  const coordinatorIndex = page.indexOf("'/scripts/auth/login/login.js'");

  assert.ok(coordinatorIndex >= 0);
  modulePaths.forEach((relativePath) => {
    const publicPath = `/${relativePath.replace(/^public\//, '')}`;
    const moduleIndex = page.indexOf(`'${publicPath}'`);

    assert.ok(moduleIndex >= 0, `${publicPath} should be registered`);
    assert.ok(
      moduleIndex < coordinatorIndex,
      `${publicPath} should load first`
    );
  });
});

test('login session preserves safe return paths and rejects unsafe redirects', () => {
  const sessionPath = path.join(
    root,
    'public/scripts/auth/login/auth-session.js'
  );
  const safeDom = new JSDOM('', {
    runScripts: 'outside-only',
    url: 'https://overexposed.test/sign-in?returnTo=%2Folings%2Flab%3Ftab%3Dbuild'
  });

  safeDom.window.eval(fs.readFileSync(sessionPath, 'utf8'));
  const safeSession = safeDom.window.createLoginAuthSession({
    defaultOeIcon: '0000:0100:0200:0300',
    setAuthStatus() {}
  });
  assert.equal(safeSession.getReturnToPath(), '/olings/lab?tab=build');
  safeDom.window.close();

  const unsafeDom = new JSDOM('', {
    runScripts: 'outside-only',
    url: 'https://overexposed.test/sign-in?returnTo=https%3A%2F%2Fevil.example%2F'
  });

  unsafeDom.window.eval(fs.readFileSync(sessionPath, 'utf8'));
  const unsafeSession = unsafeDom.window.createLoginAuthSession({
    defaultOeIcon: '0000:0100:0200:0300',
    setAuthStatus() {}
  });
  assert.equal(unsafeSession.getReturnToPath(), '');
  unsafeDom.window.close();
});

test('login resumes a remembered lobby through game settings', () => {
  const sessionPath = path.join(
    root,
    'public/scripts/auth/login/auth-session.js'
  );
  const dom = new JSDOM('', {
    runScripts: 'outside-only',
    url: 'https://overexposed.test/sign-in?returnTo=%2Fold-123'
  });
  dom.window.sessionStorage.setItem(
    'oe-waiting-room-gamemode:OLD-123',
    'truth-or-dare'
  );
  dom.window.eval(fs.readFileSync(sessionPath, 'utf8'));
  const session = dom.window.createLoginAuthSession({
    defaultOeIcon: '0000:0100:0200:0300',
    setAuthStatus() {}
  });

  assert.equal(
    session.getReturnToPath(),
    '/truth-or-dare/settings?partyCode=OLD-123'
  );
  dom.window.close();
});

test('OAuth success pauses its redirect while an active-party conflict is shown', () => {
  const sessionPath = path.join(
    root,
    'public/scripts/auth/login/auth-session.js'
  );
  const dom = new JSDOM('', {
    runScripts: 'outside-only',
    url: 'https://overexposed.test/sign-in?auth=success&provider=google&activePartyCode=OLD-123&activePartyGamemode=truth-or-dare&returnTo=%2Foe-panel'
  });
  const navigations = [];
  let openedConflict = null;
  dom.window.transitionSplashScreen = (destination) => {
    navigations.push(destination);
  };
  dom.window.ActivePartyConflictDialog = {
    openFromError(conflict, options) {
      openedConflict = { conflict, options };
      return true;
    }
  };

  dom.window.eval(fs.readFileSync(sessionPath, 'utf8'));
  const session = dom.window.createLoginAuthSession({
    defaultOeIcon: '0000:0100:0200:0300',
    setAuthStatus() {}
  });

  session.showOAuthRedirectStatus();

  assert.equal(openedConflict.conflict.code, 'party_owner_active_party_exists');
  assert.equal(openedConflict.conflict.partyCode, 'OLD-123');
  assert.equal(openedConflict.conflict.gamemode, 'truth-or-dare');
  assert.equal(openedConflict.options.source, 'account-link');
  assert.deepEqual(navigations, []);
  const remainingParams = new URL(dom.window.location.href).searchParams;
  assert.equal(remainingParams.get('activePartyCode'), null);
  assert.equal(remainingParams.get('activePartyGamemode'), null);
  assert.equal(remainingParams.get('returnTo'), '/oe-panel');

  openedConflict.options.onDismiss();
  assert.deepEqual(navigations, ['/oe-panel']);
  dom.window.close();
});

test('email login defers its normal redirect when the conflict dialog opens', async () => {
  const context = vm.createContext({ window: {} });
  const submissionsPath = path.join(
    root,
    'public/scripts/auth/login/auth-submissions.js'
  );
  vm.runInContext(fs.readFileSync(submissionsPath, 'utf8'), context, {
    filename: 'auth-submissions.js'
  });

  const redirects = [];
  const shownConflicts = [];
  const account = { username: 'owner' };
  const activePartyConflict = {
    code: 'party_owner_active_party_exists',
    partyCode: 'OLD-123',
    lobbyPath: '/OLD-123'
  };
  const session = {
    getFormData: () => ({ identifier: 'OWNER', password: 'password' }),
    getLocalOeIcon: () => '0000:0100:0200:0300',
    postJson: async () => ({ account, activePartyConflict }),
    redirectAfterLogin: (value) => redirects.push(value),
    showActivePartyConflict: (conflict, options) => {
      shownConflicts.push({ conflict, options });
      return true;
    },
    storeAccount() {}
  };
  const ui = {
    setAuthStatus() {},
    setSubmitting() {}
  };
  const submissions = context.window.createLoginAuthSubmissions({
    session,
    ui
  });

  await submissions.handleLoginSubmit({
    preventDefault() {},
    currentTarget: {}
  });

  assert.equal(shownConflicts.length, 1);
  assert.equal(shownConflicts[0].conflict, activePartyConflict);
  assert.equal(shownConflicts[0].options.account, account);
  assert.equal(
    typeof shownConflicts[0].options.navigationOptions.beforeNavigate?.then,
    'function'
  );
  assert.deepEqual(redirects, []);
});

test('email login gates navigation until its success sound finishes', async () => {
  const listeners = new Map();
  const source = {
    ended: false,
    addEventListener(eventName, listener) {
      listeners.set(eventName, listener);
    },
    removeEventListener(eventName, listener) {
      if (listeners.get(eventName) === listener) listeners.delete(eventName);
    }
  };
  const context = vm.createContext({
    window: {
      clearTimeout() {},
      playSoundEffect(soundKey) {
        return Promise.resolve(
          soundKey === 'notificationSuccess' ? { source } : null
        );
      },
      setTimeout() {
        return 1;
      }
    }
  });
  const submissionsPath = path.join(
    root,
    'public/scripts/auth/login/auth-submissions.js'
  );
  vm.runInContext(fs.readFileSync(submissionsPath, 'utf8'), context, {
    filename: 'auth-submissions.js'
  });

  let navigationOptions = null;
  const account = { username: 'owner' };
  const session = {
    getFormData: () => ({ identifier: 'owner', password: 'password' }),
    getLocalOeIcon: () => '0000:0100:0200:0300',
    postJson: async () => ({ account }),
    redirectAfterLogin(_account, options) {
      navigationOptions = options;
    },
    showActivePartyConflict: () => false,
    storeAccount() {}
  };
  const ui = {
    setAuthStatus() {},
    setSubmitting() {}
  };
  const submissions = context.window.createLoginAuthSubmissions({
    session,
    ui
  });

  await submissions.handleLoginSubmit({
    preventDefault() {},
    currentTarget: {}
  });
  await Promise.resolve();

  let navigationReleased = false;
  navigationOptions.beforeNavigate.then(() => {
    navigationReleased = true;
  });
  await Promise.resolve();
  assert.equal(navigationReleased, false);

  source.ended = true;
  listeners.get('ended')();
  await navigationOptions.beforeNavigate;
  assert.equal(navigationReleased, true);
});

test('signup plays the account-created cue after the account is ready', async () => {
  const playedSounds = [];
  const context = vm.createContext({
    document: {
      getElementById: () => ({ checked: true })
    },
    window: {
      playSoundEffect(soundKey) {
        playedSounds.push(soundKey);
        return Promise.resolve();
      }
    }
  });
  const submissionsPath = path.join(
    root,
    'public/scripts/auth/login/auth-submissions.js'
  );
  vm.runInContext(fs.readFileSync(submissionsPath, 'utf8'), context, {
    filename: 'auth-submissions.js'
  });

  let requestCount = 0;
  const session = {
    getFormData: () => ({
      username: 'owner',
      email: 'owner@example.com',
      password: 'password',
      confirmPassword: 'password',
      terms: 'on'
    }),
    getLocalOeIcon: () => '0000:0100:0200:0300',
    getReturnToPath: () => '',
    postJson: async () => {
      requestCount += 1;
      return requestCount === 1 ? {} : { account: { username: 'owner' } };
    },
    redirectAfterLogin() {},
    showActivePartyConflict: () => false,
    storeAccount() {}
  };
  const ui = {
    setAuthStatus() {},
    setSubmitting() {}
  };
  const submissions = context.window.createLoginAuthSubmissions({
    session,
    ui
  });

  await submissions.handleSignupSubmit({
    preventDefault() {},
    currentTarget: {}
  });

  assert.deepEqual(playedSounds, ['uiSelect', 'accountCreated']);
});

test('password reset request plays the email-sent cue on success', async () => {
  const playedSounds = [];
  const context = vm.createContext({
    window: {
      playSoundEffect(soundKey) {
        playedSounds.push(soundKey);
        return Promise.resolve();
      }
    }
  });
  const submissionsPath = path.join(
    root,
    'public/scripts/auth/login/auth-submissions.js'
  );
  vm.runInContext(fs.readFileSync(submissionsPath, 'utf8'), context, {
    filename: 'auth-submissions.js'
  });

  const form = { reset() {} };
  const session = {
    getFormData: () => ({ identifier: 'owner@example.com' }),
    postJson: async () => ({ message: 'Check your email.' })
  };
  const ui = {
    setAuthStatus() {},
    setSubmitting() {},
    updateSubmitButtonState() {}
  };
  const submissions = context.window.createLoginAuthSubmissions({
    session,
    ui
  });

  await submissions.handlePasswordResetRequestSubmit({
    preventDefault() {},
    currentTarget: form
  });

  assert.deepEqual(playedSounds, ['uiSelect', 'accountEmailSent']);
});

test('legal reading milestones and agreement play one semantic cue each', async () => {
  const dom = new JSDOM(
    `<!doctype html>
      <body>
        <input id="signup-terms" type="checkbox">
        <button type="button" data-legal-open="terms">Terms</button>
        <dialog id="auth-legal-dialog">
          <button id="legal-tab-terms" role="tab" data-legal-tab="terms">Terms</button>
          <button id="legal-tab-privacy" role="tab" data-legal-tab="privacy">Privacy</button>
          <div id="auth-legal-content"></div>
          <span id="auth-legal-version"></span>
          <button id="auth-legal-dialog-agree" type="button" disabled>Agree</button>
        </dialog>
      </body>`,
    {
      runScripts: 'outside-only',
      url: 'https://overexposed.test/sign-in'
    }
  );
  const legalDialog = dom.window.document.getElementById('auth-legal-dialog');
  const legalContent = dom.window.document.getElementById('auth-legal-content');
  const legalVersion = dom.window.document.getElementById('auth-legal-version');
  const agreeButton = dom.window.document.getElementById(
    'auth-legal-dialog-agree'
  );
  const playedSounds = [];
  const playedOptions = [];

  legalDialog.showModal = function showModal() {
    this.setAttribute('open', '');
  };
  legalDialog.close = function close() {
    this.removeAttribute('open');
    this.dispatchEvent(new dom.window.Event('close'));
  };
  Object.defineProperties(legalContent, {
    clientHeight: { configurable: true, value: 100 },
    scrollHeight: { configurable: true, value: 200 },
    scrollTop: { configurable: true, value: 0, writable: true }
  });
  dom.window.requestAnimationFrame = () => 0;
  dom.window.playSoundEffect = (soundKey, options) => {
    playedSounds.push(soundKey);
    playedOptions.push(options);
    return Promise.resolve();
  };
  dom.window.fetch = async () => ({
    ok: true,
    json: async () => [
      {
        sectionID: 'last-updated',
        subHeading: 'Last updated',
        text: '11 July 2026.'
      }
    ]
  });

  const legalDialogPath = path.join(
    root,
    'public/scripts/auth/login/legal-dialog.js'
  );
  dom.window.eval(fs.readFileSync(legalDialogPath, 'utf8'));
  const legal = dom.window.createLoginLegalDialog({
    legalDialog,
    legalContent,
    legalVersion
  });
  legal.initialiseLegalDialog();
  await new Promise((resolve) => setImmediate(resolve));

  dom.window.document.querySelector('[data-legal-open]').click();
  playedSounds.length = 0;

  legalContent.scrollTop = 100;
  legalContent.dispatchEvent(new dom.window.Event('scroll'));
  legalContent.dispatchEvent(new dom.window.Event('scroll'));
  assert.deepEqual(playedSounds, ['uiToggleEnabled']);

  dom.window.document.querySelector('[data-legal-tab="privacy"]').click();
  legalContent.scrollTop = 100;
  legalContent.dispatchEvent(new dom.window.Event('scroll'));
  assert.deepEqual(playedSounds, ['uiToggleEnabled', 'uiToggleEnabled']);
  assert.equal(agreeButton.disabled, false);

  playedSounds.length = 0;
  playedOptions.length = 0;
  agreeButton.click();
  assert.deepEqual(playedSounds, ['uiSuccess']);
  assert.equal(playedOptions.length, 1);
  assert.equal(playedOptions[0].priority, 'confirmation');
  assert.equal(playedOptions[0].interruptible, false);
  assert.equal(legalDialog.open, false);
  dom.window.close();
});
