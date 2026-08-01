const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const GAMEMODE_SETTINGS_SCRIPTS = [
  'game-settings-buttons.js',
  'gamemode-settings-availability.js',
  'gamemode-settings-controls.js',
  'gamemode-settings-restrictions.js',
  'gamemode-settings-start.js',
  'gamemode-settings-sync.js',
  'gamemode-settings.js'
];

const PUBLIC_DIR = path.join(__dirname, '..', '..', 'public');
const SCRIPTS_DIR = path.join(
  PUBLIC_DIR,
  'scripts',
  'party-games',
  'gamemode-settings'
);
const TEMPLATE_HTML = fs.readFileSync(
  path.join(PUBLIC_DIR, 'html-templates', 'gamemode-settings.html'),
  'utf8'
);
const QR_CODE_TEMPLATE_SCRIPT = path.join(
  PUBLIC_DIR,
  'scripts',
  'html-templates',
  'gamemode-settings',
  'qr-code-container-template.js'
);
const UTILS_SOURCE = fs.readFileSync(
  path.join(PUBLIC_DIR, 'scripts', 'general', 'utils', 'utils.js'),
  'utf8'
);

function createTestDOM() {
  const html = `<!DOCTYPE html>
<html>
  <body>
    <button id="packs-settings" class="settings-tab active">Packs</button>
    <button id="rules-settings" class="settings-tab">Rules</button>
    <button id="online-settings" class="settings-tab disabled">Online</button>

    <div id="gamemode-settings-placeholder" data-template="mafia"></div>

    <div class="packs-container">
      <div class="button-container"></div>
    </div>
    <div class="rules-settings-container">
      <div class="button-container"></div>
    </div>
    <div class="online-game-settings-container"></div>

    <button class="start-game-button" id="mafia">Start Game</button>
    <button class="start-game-warning-button">Warning</button>
    <div id="overlay"></div>
    <div id="qr-code-container-placeholder"></div>
    <div id="party-code"></div>
    <button id="party-code-copy-button"></button>
    <button id="qr-code-button"></button>
    <div class="user-count">(0/8)</div>
    <div class="warning-box"></div>
  </body>
</html>`;

  const dom = new JSDOM(html, {
    url: 'https://example.com/mafia/settings/',
    runScripts: 'dangerously',
    resources: 'usable',
    pretendToBeVisual: true
  });
  const { window } = dom;

  window.console = console;
  window.requestAnimationFrame =
    window.requestAnimationFrame || ((cb) => window.setTimeout(cb, 0));
  window.cancelAnimationFrame =
    window.cancelAnimationFrame || window.clearTimeout;
  window.performance = window.performance || { now: () => Date.now() };

  window.debugLog = () => {};
  window.debugWarn = () => {};
  window.SetScriptLoaded = () => {};
  window.LoadStylesheet = () => null;
  window.CreateDifficultyImages = () => {};
  window.SetButtonStyle = () => {};
  window.FetchHelpContainer = () => {};
  window.toggleUserCustomisationIcon = () => {};
  window.ToggleOnlineMode = async () => true;
  window.registeredSoundDefinitions = {};
  window.OEAudio = {
    register(definitions) {
      Object.assign(window.registeredSoundDefinitions, definitions);
      return Promise.resolve();
    },
    stopLane() {}
  };
  window.copyTextToClipboard = async () => true;
  window.flashButtonHoverState = () => {};
  window.addElementIfNotExists = () => {};
  window.showContainer = () => {};
  window.hideContainer = () => {};
  window.toggleOverlay = () => {};
  window.playSoundEffect = () => {};
  window.playInteractionSound = () => {};
  window.showOeStatusPopup = () => null;
  window.dismissOeStatusPopup = () => false;
  window.startOnlinePartyGame = async () => {};
  window.refreshOnlinePlayerCountRestrictions = async () => true;
  window.transitionSplashScreen = () => {};
  window.removeElementIfNotExists = () => {};
  window.isContainerVisible = () => false;
  window.ResetActivePacks = () => {};
  window.GetAnyPackActive = () => false;
  window.debugWarn = () => {};
  window.addElementIfNotExists = () => {};
  window.removeElementIfExists = () => {};
  window.isContainerVisible = () => false;
  window.setTooltipSelectedState = () => {};

  const packsContainer = window.document.querySelector('.packs-container');
  const rulesContainer = window.document.querySelector(
    '.rules-settings-container'
  );
  const onlineSettingsContainer = window.document.querySelector(
    '.online-game-settings-container'
  );

  window.packsContainer = packsContainer;
  window.rulesContainer = rulesContainer;
  window.onlineSettingsContainer = onlineSettingsContainer;
  window.placeholderGamemodeSettings = window.document.getElementById(
    'gamemode-settings-placeholder'
  );
  window.userCount = window.document.querySelector('.user-count');
  window.startGameButton = window.document.querySelector('.start-game-button');
  window.warningBox = window.document.querySelector('.warning-box');
  window.warningStartButton = window.document.querySelector(
    '.start-game-warning-button'
  );
  window.inputPartyCode = window.document.getElementById('party-code');
  window.copyPartyCodeButton = window.document.getElementById(
    'party-code-copy-button'
  );
  window.qrCodeButton = window.document.getElementById('qr-code-button');
  window.partyGameMode = 'mafia';
  window.partyCode = '';
  window.loadingPage = false;
  window.currentPartyData = {};
  window.gamemodeSelectedPacks = [];
  window.gamemodeSettings = {};
  window.gamemodeRoleCounts = {};
  window.allUsersReady = false;
  window.onlinePlayerCountRestrictionsMet = true;
  window.localStorage.setItem('settings-nsfw', 'false');
  window.isNsfwContentEnabled = () =>
    window.localStorage.getItem('settings-nsfw') === 'true';
  window.nsfwButtons = [];
  window.gameRulesNsfwButtons = [];
  window.elementClassArray = [];

  window.fetch = async (input) => {
    const url = String(input);
    window.requestedUrls ||= [];
    window.requestedUrls.push(url);
    if (url.endsWith('/html-templates/gamemode-settings.html')) {
      return {
        ok: true,
        text: async () => TEMPLATE_HTML
      };
    }
    if (url.includes('/api/party-game-packs/mafia')) {
      return {
        ok: true,
        json: async () => ({ 'mafia-packs': [] })
      };
    }

    if (url.includes('/api/party-game-roles/mafia')) {
      return {
        ok: true,
        json: async () => ({
          'mafia-roles': [
            {
              'role-name': 'civilian',
              'role-title': 'Civilian',
              'role-description': null,
              'role-faction': 'civilian',
              'role-default-count': 0,
              'role-increment': 1,
              'role-minimum': 0,
              'role-maximum': 20,
              'role-fill-remaining': true,
              'role-active': true
            },
            {
              'role-name': 'mafioso',
              'role-title': 'Mafioso',
              'role-description': 'HIDDEN ROLE DESCRIPTION',
              'role-faction': 'mafioso',
              'role-default-count': 1,
              'role-increment': 1,
              'role-minimum': 0,
              'role-maximum': 15,
              'role-fill-remaining': false,
              'role-active': true
            }
          ]
        })
      };
    }

    if (url.includes('/json-files/party-games/packs/mafia.json')) {
      return {
        ok: true,
        json: async () => ({ 'mafia-packs': [] })
      };
    }

    if (url.includes('/api/party-game-rules/mafia')) {
      return {
        ok: true,
        json: async () => ({ 'mafia-settings': [] })
      };
    }

    if (url.includes('/json-files/party-games/settings/mafia.json')) {
      return {
        ok: true,
        json: async () => ({ 'mafia-settings': [] })
      };
    }

    if (url.includes('/json-files/party-games/settings/online-global.json')) {
      return {
        ok: true,
        json: async () => ({})
      };
    }

    if (url.includes('/json-files/party-games/settings/shared-addons.json')) {
      return {
        ok: true,
        json: async () => ({})
      };
    }

    return {
      ok: true,
      json: async () => ({}),
      text: async () => ''
    };
  };

  window.OEReady = (() => {
    const tasks = new Map();

    return {
      register(name, task) {
        if (!name) {
          throw new Error('OEReady task name is required.');
        }
        const promise = Promise.resolve().then(() => {
          if (typeof task === 'function') {
            return task();
          }
          return task;
        });
        tasks.set(name, promise);
        return promise;
      },

      async waitFor(names = null, { timeoutMs = 2000 } = {}) {
        const selectedNames = Array.isArray(names) ? names : [...tasks.keys()];

        if (selectedNames.length === 0) {
          return;
        }

        const promises = selectedNames.map((name) => {
          if (!tasks.has(name)) {
            return Promise.reject(
              new Error(`OEReady task was not registered: ${name}`)
            );
          }
          return tasks.get(name);
        });

        return Promise.race([
          Promise.all(promises),
          new Promise((_, reject) =>
            window.setTimeout(
              () =>
                reject(
                  new Error(`OEReady waitFor timed out after ${timeoutMs}ms`)
                ),
              timeoutMs
            )
          )
        ]);
      },

      debugState() {
        return Object.fromEntries(tasks.entries());
      }
    };
  })();

  window.LocalStorageObserver = class {
    constructor() {
      this.listeners = [];
      this.originalSetItem = window.localStorage.setItem.bind(
        window.localStorage
      );
      this.originalGetItem = window.localStorage.getItem.bind(
        window.localStorage
      );
      window.localStorage.setItem = (key, value) => {
        const oldValue = this.originalGetItem(key);
        this.originalSetItem(key, value);
        this.notifyListeners(key, oldValue, value);
      };
    }

    addListener(callback) {
      this.listeners.push(callback);
    }

    notifyListeners(key, oldValue, newValue) {
      this.listeners.forEach((listener) => listener(key, oldValue, newValue));
    }
  };

  return window;
}

function loadHelperScript(scriptName, window) {
  const scriptPath = path.join(SCRIPTS_DIR, scriptName);
  const scriptSource = fs.readFileSync(scriptPath, 'utf8');
  window.eval(scriptSource);
}

async function loadScriptInDom(scriptName, timeoutMs = 2000) {
  const scriptPath = path.join(SCRIPTS_DIR, scriptName);
  const scriptSource = fs.readFileSync(scriptPath, 'utf8');
  const window = createTestDOM();

  loadHelperScript('gamemode-settings-start.js', window);

  const evaluationPromise = Promise.resolve().then(() => {
    window.eval(scriptSource);
  });

  const waitPromise = window.OEReady.waitFor(null, { timeoutMs });

  return Promise.race([
    Promise.all([evaluationPromise, waitPromise]),
    new Promise((_, reject) =>
      window.setTimeout(
        () =>
          reject(
            new Error(
              `Script ${scriptName} did not finish within ${timeoutMs}ms`
            )
          ),
        timeoutMs
      )
    )
  ]);
}

for (const scriptName of GAMEMODE_SETTINGS_SCRIPTS) {
  test(`gamemode settings script ${scriptName} initializes without hanging`, async () => {
    await loadScriptInDom(scriptName, 2000);
  });
}

test('gamemode settings startup suite reports the first hanging script', async () => {
  const hungScripts = [];

  for (const scriptName of GAMEMODE_SETTINGS_SCRIPTS) {
    try {
      await loadScriptInDom(scriptName, 2000);
    } catch (error) {
      hungScripts.push({ scriptName, error: error.message });
    }
  }

  assert.equal(
    hungScripts.length,
    0,
    `The following gamemode settings scripts failed to initialize within timeout: ${hungScripts
      .map((entry) => `${entry.scriptName}: ${entry.error}`)
      .join('; ')}`
  );
});

test('waiting-room content requests include the party code', async () => {
  const window = createTestDOM();
  window.partyCode = 'ABC-123';

  loadHelperScript('game-settings-buttons.js', window);
  await window.OEReady.waitFor(['game-settings-buttons']);

  assert.ok(
    window.requestedUrls.includes(
      '/api/party-game-roles/mafia?partyCode=ABC-123'
    )
  );
  assert.ok(
    window.requestedUrls.includes(
      '/api/party-game-rules/mafia?partyCode=ABC-123'
    )
  );
});

test('Mafia roles render count controls without rendering descriptions', async () => {
  const window = createTestDOM();

  loadHelperScript('game-settings-buttons.js', window);
  await window.OEReady.waitFor(['game-settings-buttons']);

  const roleControls = window.document.querySelectorAll(
    '.increment-container.role'
  );
  assert.equal(roleControls.length, 1);
  assert.equal(roleControls[0].dataset.key, 'mafioso');
  assert.match(roleControls[0].textContent, /Mafioso/);
  assert.doesNotMatch(
    window.document.body.textContent,
    /HIDDEN ROLE DESCRIPTION/
  );
  assert.equal(
    window.requestedUrls.some((url) =>
      url.includes('/api/party-game-packs/mafia')
    ),
    false
  );
});

test('all-ready sound requires a non-host ready-up and the minimum player count', () => {
  const window = createTestDOM();
  const playedSounds = [];
  window.playSoundEffect = (soundKey) => playedSounds.push(soundKey);
  window.deviceId = 'host';
  window.hostDeviceId = 'host';
  window.partyGamesInformation = {
    mafia: {
      playerCountRestrictions: {
        minPlayers: 3,
        maxPlayers: 8
      }
    }
  };

  loadHelperScript('gamemode-settings-restrictions.js', window);

  assert.equal(
    window.registeredSoundDefinitions.gamemodeSettingsReadyToStart.src,
    '/sounds/gamemode-settings/ready-to-start.wav'
  );

  const createParty = (guestStates, partyId = 'PARTY-1') => ({
    partyId,
    state: { hostComputerId: 'host' },
    players: [
      {
        identity: { computerId: 'host' },
        state: { isReady: true }
      },
      ...guestStates.map(([computerId, isReady]) => ({
        identity: { computerId },
        state: { isReady }
      }))
    ]
  });

  window.syncGamemodeSettingsReadySound(
    createParty([
      ['guest-1', false],
      ['guest-2', true]
    ]),
    { initializeOnly: true }
  );
  window.syncGamemodeSettingsReadySound(
    createParty([
      ['guest-1', true],
      ['guest-2', true]
    ])
  );
  window.syncGamemodeSettingsReadySound(
    createParty([
      ['guest-1', true],
      ['guest-2', true]
    ])
  );

  assert.deepEqual(playedSounds, ['gamemodeSettingsReadyToStart']);

  window.syncGamemodeSettingsReadySound(
    createParty([
      ['guest-1', false],
      ['guest-2', true]
    ])
  );
  window.syncGamemodeSettingsReadySound(createParty([['guest-2', true]]));

  assert.deepEqual(playedSounds, ['gamemodeSettingsReadyToStart']);

  window.syncGamemodeSettingsReadySound(
    createParty([['guest-1', false]], 'PARTY-2')
  );
  window.syncGamemodeSettingsReadySound(
    createParty([['guest-1', true]], 'PARTY-2')
  );

  assert.deepEqual(playedSounds, ['gamemodeSettingsReadyToStart']);
});

test('host lobby membership sounds distinguish joins from voluntary leaves', () => {
  const window = createTestDOM();
  const playedSounds = [];
  window.playSoundEffect = (soundKey) => playedSounds.push(soundKey);
  window.deviceId = 'host';
  window.hostDeviceId = 'host';
  window.partyGameMode = 'mafia';
  window.partyGamesInformation = {
    mafia: {
      playerCountRestrictions: {
        minPlayers: 1,
        maxPlayers: 8
      }
    }
  };

  loadHelperScript('gamemode-settings-restrictions.js', window);

  assert.equal(
    window.registeredSoundDefinitions.gamemodeSettingsPlayerJoined.src,
    '/sounds/gamemode-settings/player-joined.wav'
  );
  assert.equal(
    window.registeredSoundDefinitions.gamemodeSettingsPlayerLeft.src,
    '/sounds/gamemode-settings/player-left.wav'
  );

  const createParty = (guestIds, partyId = 'PARTY-1') => ({
    partyId,
    state: { hostComputerId: 'host' },
    players: [
      {
        identity: { computerId: 'host' },
        state: { isReady: true }
      },
      ...guestIds.map((computerId) => ({
        identity: { computerId },
        state: { isReady: false }
      }))
    ]
  });

  window.syncGamemodeSettingsReadySound(createParty(['guest-1']), {
    initializeOnly: true
  });
  window.syncGamemodeSettingsReadySound(
    createParty(['guest-1', 'guest-2'])
  );
  window.syncGamemodeSettingsReadySound(createParty(['guest-1']));
  window.syncGamemodeSettingsReadySound(
    createParty(['guest-1', 'guest-3'], 'PARTY-2')
  );

  assert.deepEqual(playedSounds, ['gamemodeSettingsPlayerJoined']);

  window.currentPartyData = createParty(['guest-1']);
  window.playGamemodeSettingsPlayerLeftSound();
  window.deviceId = 'guest-1';
  window.playGamemodeSettingsPlayerLeftSound();

  assert.deepEqual(playedSounds, [
    'gamemodeSettingsPlayerJoined',
    'gamemodeSettingsPlayerLeft'
  ]);
});

test('copying the party code uses the social copy-link sound', async () => {
  const window = createTestDOM();
  const copiedValues = [];
  const playedSounds = [];
  window.inputPartyCode.value = 'PARTY-1';
  window.copyTextToClipboard = async (value) => {
    copiedValues.push(value);
    return true;
  };
  window.playSoundEffect = (soundKey) => playedSounds.push(soundKey);

  loadHelperScript('gamemode-settings-start.js', window);
  window.bindGamemodeSettingsActions();
  window.copyPartyCodeButton.click();
  await new Promise((resolve) => setImmediate(resolve));

  assert.deepEqual(copiedValues, ['https://example.com/PARTY-1']);
  assert.deepEqual(playedSounds, ['socialCopyLink']);
});

test('party QR visibility changes use container open and close sounds', async () => {
  const window = createTestDOM();
  const playedSounds = [];
  window.partyCode = 'PARTY-1';
  window.partyUserCount = 2;
  window.partyGamesInformation = {
    mafia: {
      playerCountRestrictions: {
        maxPlayers: 8
      }
    }
  };
  window.showContainer = (element) => element.classList.add('is-visible');
  window.hideContainer = (element) => element.classList.remove('is-visible');
  window.isContainerVisible = (element) =>
    Boolean(element?.classList.contains('is-visible'));
  window.playSoundEffect = (soundKey) => playedSounds.push(soundKey);
  window.fetch = async () => ({
    ok: true,
    text: async () => '<div class="join-party-qr-code-container"></div>'
  });
  window.eval(UTILS_SOURCE);
  window.syncOverlayStack = () => {
    const activeContainer = window.elementClassArray
      .slice()
      .sort(
        (left, right) =>
          Number(right.dataset.overlayStackOrder || 0) -
          Number(left.dataset.overlayStackOrder || 0)
      )[0];
    window.elementClassArray.forEach((element) => {
      window.toggleContainerVisibility(element, element === activeContainer);
    });
  };

  window.eval(fs.readFileSync(QR_CODE_TEMPLATE_SCRIPT, 'utf8'));
  await window.OEReady.waitFor(['qr-code-container-template']);

  window.togglePartyQrCode(true, window.partyCode);
  window.togglePartyQrCode(true, window.partyCode);
  window.togglePartyQrCode(false, window.partyCode);
  window.togglePartyQrCode(false, window.partyCode);

  assert.deepEqual(playedSounds, ['containerOpen', 'containerClose']);
});

test('online start countdown plays each cue, cancels on click, and starts once', async () => {
  const window = createTestDOM();
  const timers = new Map();
  const playedSounds = [];
  const stoppedLanes = [];
  let nextTimerId = 1;
  let onlineStarts = 0;

  window.setTimeout = (callback) => {
    const timerId = nextTimerId++;
    timers.set(timerId, callback);
    return timerId;
  };
  window.clearTimeout = (timerId) => timers.delete(timerId);
  window.playSoundEffect = (soundKey) => {
    playedSounds.push(soundKey);
    return Promise.resolve(null);
  };
  window.OEAudio.stopLane = (lane) => stoppedLanes.push(lane);
  window.startOnlinePartyGame = async () => {
    onlineStarts += 1;
  };
  window.partyCode = 'PARTY-1';
  window.allUsersReady = true;

  const runNextTimer = async () => {
    const nextTimer = timers.entries().next().value;
    assert.ok(nextTimer, 'expected a pending countdown timer');
    const [timerId, callback] = nextTimer;
    timers.delete(timerId);
    callback();
    await Promise.resolve();
    await Promise.resolve();
  };

  loadHelperScript('gamemode-settings-start.js', window);
  window.bindGamemodeSettingsActions();

  assert.equal(
    window.registeredSoundDefinitions.gamemodeSettingsCountdownFive.src,
    '/sounds/gamemode-settings/countdown/five.wav'
  );
  assert.equal(
    window.registeredSoundDefinitions.gamemodeSettingsStartBlocked.src,
    '/sounds/gamemode-settings/start-blocked.wav'
  );

  window.startGameButton.click();
  assert.equal(window.startGameButton.textContent, 'STARTING IN 5');
  assert.equal(window.isGamemodeStartCountdownActive(), true);
  assert.deepEqual(playedSounds, ['gamemodeSettingsCountdownFive']);

  window.startGameButton.click();
  assert.equal(window.startGameButton.textContent, 'Start Game');
  assert.equal(window.isGamemodeStartCountdownActive(), false);
  assert.equal(timers.size, 0);
  assert.deepEqual(stoppedLanes, ['gamemode-settings-countdown']);
  assert.deepEqual(playedSounds, [
    'gamemodeSettingsCountdownFive',
    'gamemodeSettingsStartBlocked'
  ]);
  assert.equal(onlineStarts, 0);

  window.startGameButton.click();
  for (let tick = 0; tick < 5; tick += 1) {
    await runNextTimer();
  }

  assert.deepEqual(playedSounds.slice(-5), [
    'gamemodeSettingsCountdownFive',
    'gamemodeSettingsCountdownFour',
    'gamemodeSettingsCountdownThree',
    'gamemodeSettingsCountdownTwo',
    'gamemodeSettingsCountdownOne'
  ]);
  assert.equal(window.isGamemodeStartCountdownActive(), false);
  assert.equal(window.startGameButton.textContent, 'Start Game');
  assert.equal(onlineStarts, 1);
});

test('NSFW countdown uses its warning button and outside click cancels it', () => {
  const window = createTestDOM();
  const playedSounds = [];
  const nsfwPack = window.document.createElement('button');
  nsfwPack.className = 'active nsfw';
  window.nsfwButtons.push(nsfwPack);
  window.partyCode = 'PARTY-1';
  window.allUsersReady = true;
  window.currentPartyData = {
    state: { hostComputerId: 'host' },
    players: [
      {
        identity: { computerId: 'host' },
        state: { isReady: true }
      },
      {
        identity: { computerId: 'guest' },
        state: { isReady: true }
      }
    ]
  };
  window.playSoundEffect = (soundKey) => playedSounds.push(soundKey);

  loadHelperScript('gamemode-settings-start.js', window);
  window.bindGamemodeSettingsActions();

  window.startGameButton.click();
  assert.equal(window.isGamemodeStartCountdownActive(), false);

  window.warningStartButton.click();
  assert.equal(window.warningStartButton.textContent, 'STARTING IN 5');
  assert.equal(window.isGamemodeStartCountdownActive(), true);

  window.document.getElementById('overlay').click();
  assert.equal(window.warningStartButton.textContent, 'Warning');
  assert.equal(window.isGamemodeStartCountdownActive(), false);
  assert.deepEqual(playedSounds.slice(-2), [
    'gamemodeSettingsCountdownFive',
    'gamemodeSettingsStartBlocked'
  ]);
});

test('online start countdown cancels when lobby eligibility is lost', () => {
  const window = createTestDOM();
  const playedSounds = [];
  window.partyCode = 'PARTY-1';
  window.allUsersReady = true;
  window.currentPartyData = {
    state: { hostComputerId: 'host' },
    players: [
      {
        identity: { computerId: 'host' },
        state: { isReady: true }
      },
      {
        identity: { computerId: 'guest' },
        state: { isReady: true }
      }
    ]
  };
  window.playSoundEffect = (soundKey) => playedSounds.push(soundKey);
  window.partyGamesInformation = {
    mafia: {
      playerCountRestrictions: {
        minPlayers: 2,
        maxPlayers: 8
      }
    }
  };

  loadHelperScript('gamemode-settings-start.js', window);
  loadHelperScript('gamemode-settings-restrictions.js', window);
  window.bindGamemodeSettingsActions();

  window.startGameButton.click();
  assert.equal(window.isGamemodeStartCountdownActive(), true);

  window.allUsersReady = false;
  window.updateStartGameButton(false);

  assert.equal(window.isGamemodeStartCountdownActive(), false);
  assert.equal(window.startGameButton.textContent, 'Start Game');
  assert.equal(playedSounds.at(-1), 'gamemodeSettingsStartBlocked');
});

test('blocked online start attempt plays feedback without starting a countdown', () => {
  const window = createTestDOM();
  const playedSounds = [];
  const statusPopups = [];
  window.partyCode = 'PARTY-1';
  window.allUsersReady = false;
  window.currentPartyData = {
    state: { hostComputerId: 'host' },
    players: [
      {
        identity: {
          computerId: 'host',
          username: 'Party Host',
          userIcon: 'host-colour:host-head:host-eyes:host-mouth'
        },
        state: { isReady: true }
      }
    ]
  };
  window.playSoundEffect = (soundKey) => playedSounds.push(soundKey);
  window.showOeStatusPopup = (options) => statusPopups.push(options);
  window.partyGamesInformation = {
    mafia: {
      playerCountRestrictions: {
        minPlayers: 2,
        maxPlayers: 8
      }
    }
  };

  loadHelperScript('gamemode-settings-start.js', window);
  loadHelperScript('gamemode-settings-restrictions.js', window);
  window.bindGamemodeSettingsActions();
  window.updateStartGameButton(false);

  assert.equal(
    window.startGameButton.classList.contains('start-blocked-feedback'),
    true
  );
  assert.equal(window.startGameButton.getAttribute('aria-disabled'), 'true');
  assert.equal(window.startGameButton.style.pointerEvents, 'auto');

  window.startGameButton.click();

  assert.deepEqual(playedSounds, ['gamemodeSettingsStartBlocked']);
  assert.equal(statusPopups.length, 1);
  assert.equal(statusPopups[0].key, 'game-start-blocked');
  assert.equal(statusPopups[0].title, "Can't start yet");
  assert.deepEqual(Array.from(statusPopups[0].messages), [
    '1 more player needed'
  ]);
  assert.deepEqual(
    {
      userId: statusPopups[0].avatar.userId,
      userCustomisationString:
        statusPopups[0].avatar.userCustomisationString,
      label: statusPopups[0].avatar.label
    },
    {
      userId: 'host',
      userCustomisationString:
        'host-colour:host-head:host-eyes:host-mouth',
      label: "Party Host's OE"
    }
  );
  assert.equal(window.isGamemodeStartCountdownActive(), false);
});

test('SFW mode sends blocked NSFW packs to the notification system', async () => {
  const window = createTestDOM();
  const notifications = [];
  const packsContent = window.document.createElement('div');
  const packButton = window.document.createElement('button');

  packsContent.className = 'packs-content-container';
  packButton.className = 'button-toggle pack nsfw';
  packButton.dataset.key = 'after-dark';
  packsContent.appendChild(packButton);
  window.placeholderGamemodeSettings.appendChild(packsContent);
  window.packButtons = [packButton];
  window.nsfwButtons = [packButton];
  window.gameRulesNsfwButtons = [];
  window.onlingSettingsButtons = [];
  window.offlineSettingsButtons = [];
  window.partyGamesInformation = { mafia: { forceOnline: false } };
  window.UpdateSettings = () => {};
  window.showSystemNotificationPopup = (notification) => {
    notifications.push(notification);
  };

  loadHelperScript('gamemode-settings-availability.js', window);
  loadHelperScript('gamemode-settings-controls.js', window);

  await window.SetGamemodeButtons();
  window.SetGameSettingsButtons();
  packButton.click();

  assert.equal(packButton.disabled, false);
  assert.equal(packButton.getAttribute('aria-disabled'), 'true');
  assert.equal(packButton.classList.contains('disabled'), true);
  assert.equal(packButton.classList.contains('active'), false);
  assert.equal(window.localStorage.getItem('after-dark'), 'false');
  assert.equal(notifications.length, 1);
  assert.deepEqual(
    {
      key: notifications[0].key,
      type: notifications[0].type,
      category: notifications[0].category,
      image: notifications[0].image,
      dismissWhenNsfwEnabled: notifications[0].dismissWhenNsfwEnabled,
      title: notifications[0].title,
      body: notifications[0].body,
      action: {
        type: notifications[0].action.type,
        target: notifications[0].action.target
      }
    },
    {
      key: 'nsfw-content-blocked',
      type: 'nsfw_pack_blocked',
      category: 'system',
      image: '/images/icons/difficulty/nsfw.svg',
      dismissWhenNsfwEnabled: true,
      title: 'NSFW pack unavailable',
      body: 'Enable NSFW content in Settings to use this pack.',
      action: {
        type: 'open_settings',
        target: 'settings-nsfw'
      }
    }
  );
});

test('NSFW setting events refresh pack availability from current storage', async () => {
  const window = createTestDOM();
  const packButton = window.document.createElement('button');

  packButton.className = 'button-toggle pack nsfw';
  packButton.dataset.key = 'after-dark';
  window.nsfwButtons = [packButton];
  window.gameRulesNsfwButtons = [];
  window.onlingSettingsButtons = [];
  window.offlineSettingsButtons = [];
  window.partyGamesInformation = { mafia: { forceOnline: false } };

  loadHelperScript('gamemode-settings-availability.js', window);

  await window.SetGamemodeButtons();
  assert.equal(packButton.getAttribute('aria-disabled'), 'true');

  window.localStorage.setItem('settings-nsfw', 'true');
  window.dispatchEvent(
    new window.CustomEvent('oe-nsfw-setting-changed', {
      detail: { enabled: true, changed: true }
    })
  );
  await new Promise((resolve) => window.setTimeout(resolve, 0));

  assert.equal(packButton.hasAttribute('aria-disabled'), false);
  assert.equal(packButton.classList.contains('disabled'), false);

  window.localStorage.setItem('settings-nsfw', 'false');
  window.dispatchEvent(
    new window.CustomEvent('oe-nsfw-setting-changed', {
      detail: { enabled: false, changed: true }
    })
  );
  await new Promise((resolve) => window.setTimeout(resolve, 0));

  assert.equal(packButton.getAttribute('aria-disabled'), 'true');
  assert.equal(packButton.classList.contains('disabled'), true);
});

test('SFW mode blocks NSFW game rules and explains how to enable them', async () => {
  const window = createTestDOM();
  const notifications = [];
  const rulesContent = window.document.createElement('div');
  const ruleButton = window.document.createElement('button');

  rulesContent.className = 'rules-content-container';
  ruleButton.className = 'button-toggle game-settings-pack nsfw';
  ruleButton.dataset.key = 'adult-prompts';
  rulesContent.appendChild(ruleButton);
  window.placeholderGamemodeSettings.appendChild(rulesContent);
  window.packButtons = [];
  window.nsfwButtons = [];
  window.gameRulesNsfwButtons = [ruleButton];
  window.onlingSettingsButtons = [];
  window.offlineSettingsButtons = [];
  window.partyGamesInformation = { mafia: { forceOnline: false } };
  window.UpdateSettings = () => {};
  window.showSystemNotificationPopup = (notification) => {
    notifications.push(notification);
  };

  loadHelperScript('gamemode-settings-availability.js', window);
  loadHelperScript('gamemode-settings-controls.js', window);

  await window.SetGamemodeButtons();
  window.SetGameSettingsButtons();
  ruleButton.click();

  assert.equal(ruleButton.disabled, false);
  assert.equal(ruleButton.getAttribute('aria-disabled'), 'true');
  assert.equal(ruleButton.classList.contains('disabled'), true);
  assert.equal(ruleButton.classList.contains('active'), false);
  assert.equal(window.localStorage.getItem('adult-prompts'), 'false');
  assert.equal(notifications.length, 1);
  assert.deepEqual(
    {
      key: notifications[0].key,
      type: notifications[0].type,
      image: notifications[0].image,
      dismissWhenNsfwEnabled: notifications[0].dismissWhenNsfwEnabled,
      title: notifications[0].title,
      body: notifications[0].body,
      action: {
        type: notifications[0].action.type,
        target: notifications[0].action.target
      }
    },
    {
      key: 'nsfw-content-blocked',
      type: 'nsfw_game_rule_blocked',
      image: '/images/icons/difficulty/nsfw.svg',
      dismissWhenNsfwEnabled: true,
      title: 'NSFW game rule unavailable',
      body: 'Enable NSFW content in Settings to use this game rule.',
      action: {
        type: 'open_settings',
        target: 'settings-nsfw'
      }
    }
  );
});

test('blocked NSFW increment rules cannot change through their child buttons', async () => {
  const window = createTestDOM();
  const notifications = [];
  const incrementRule = window.document.createElement('div');
  const incrementButton = window.document.createElement('button');
  let value = 30;

  incrementRule.className = 'increment-container setting nsfw';
  incrementRule.dataset.key = 'adult-round-time';
  incrementButton.className = 'count-btn increment';
  incrementButton.addEventListener('click', () => {
    value += 30;
  });
  incrementRule.appendChild(incrementButton);
  window.placeholderGamemodeSettings.appendChild(incrementRule);
  window.nsfwButtons = [];
  window.gameRulesNsfwButtons = [incrementRule];
  window.onlingSettingsButtons = [];
  window.offlineSettingsButtons = [];
  window.partyGamesInformation = { mafia: { forceOnline: false } };
  window.showSystemNotificationPopup = (notification) => {
    notifications.push(notification);
  };

  loadHelperScript('gamemode-settings-availability.js', window);
  await window.SetGamemodeButtons();
  incrementButton.click();

  assert.equal(value, 30);
  assert.equal(incrementRule.getAttribute('aria-disabled'), 'true');
  assert.equal(incrementRule.classList.contains('disabled'), true);
  assert.equal(notifications.length, 1);
  assert.equal(notifications[0].type, 'nsfw_game_rule_blocked');
});

test('settings CSS keeps SFW-blocked NSFW controls clickable for feedback', () => {
  const source = fs.readFileSync(
    path.join(
      PUBLIC_DIR,
      'css',
      'party-games',
      'gamemode-settings-page-styles.css'
    ),
    'utf8'
  );

  assert.match(
    source,
    /\.nsfw\.disabled\[aria-disabled='true'\]\s*\{[\s\S]*?pointer-events:\s*auto\s*!important;/
  );
});

test('online start blockers are structured from party, readiness, and pack state', () => {
  const window = createTestDOM();
  const packButton = window.document.createElement('button');
  window.packButtons = [packButton];
  window.partyCode = 'PARTY-1';
  window.partyGamesInformation = {
    mafia: {
      playerCountRestrictions: {
        minPlayers: 3,
        maxPlayers: 8
      }
    }
  };
  window.currentPartyData = {
    state: { hostComputerId: 'host' },
    players: [
      {
        identity: { computerId: 'host' },
        state: { isReady: true }
      },
      {
        identity: { computerId: 'guest' },
        state: { isReady: false }
      }
    ]
  };

  loadHelperScript('gamemode-settings-restrictions.js', window);

  assert.deepEqual(
    Array.from(window.getStartGameBlockers(false), (blocker) => ({
      id: blocker.id,
      message: blocker.message
    })),
    [
      { id: 'player-count', message: '1 more player needed' },
      { id: 'player-readiness', message: '1 player needs to ready up' },
      { id: 'selected-packs', message: 'Select at least one pack' }
    ]
  );
});

test('online start eligibility tolerates party data not existing yet', () => {
  const window = createTestDOM();
  window.partyCode = 'PARTY-1';
  window.allUsersReady = false;
  delete window.currentPartyData;
  window.partyGamesInformation = {
    mafia: {
      playerCountRestrictions: {
        minPlayers: 3,
        maxPlayers: 8
      }
    }
  };

  loadHelperScript('gamemode-settings-restrictions.js', window);

  assert.doesNotThrow(() => window.updateStartGameButton(false));
  assert.deepEqual(
    Array.from(window.getStartGameBlockers(false), (blocker) => blocker.id),
    ['player-readiness']
  );
  assert.equal(window.startGameButton.classList.contains('disabled'), true);
});
