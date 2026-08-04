const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const { JSDOM } = require('jsdom');

const scriptsDirectory = path.join(
  __dirname,
  '..',
  '..',
  'public',
  'scripts',
  'general'
);
const templatePath = path.join(
  __dirname,
  '..',
  '..',
  'public',
  'scripts',
  'html-templates',
  'core-template',
  'registry.js'
);
const soundScriptPath = path.join(scriptsDirectory, 'sound', 'sound.js');
const notificationSoundsDirectory = path.join(
  __dirname,
  '..',
  '..',
  'public',
  'sounds',
  'notifications'
);
const notificationSoundRegistrations = [
  ['notificationAttention', 'shared/attention.wav'],
  ['notificationSuccess', 'shared/success.wav'],
  ['notificationFailure', 'shared/failure.wav'],
  ['notificationSlideIn', 'shared/slide-in/default.wav'],
  ['notificationSlideOut', 'shared/slide-out/default.wav'],
  ['notificationPartyPositive', 'party-activity/positive.wav'],
  ['notificationPartyNeutral', 'party-activity/neutral.wav'],
  ['notificationPartyNegative', 'party-activity/negative.wav'],
  ['notificationAchievementLegendary', 'achievements/legendary.wav']
];
const navigationModule = 'popup-feed/popup-feed-navigation.js';
const featureModules = [
  ['popup-feed/popup-feed-achievements.js', 'createPopupFeedAchievements'],
  ['popup-feed/popup-feed-account-prompt.js', 'createPopupFeedAccountPrompt'],
  [
    'popup-feed/popup-feed-social-notifications.js',
    'createPopupFeedSocialNotifications'
  ],
  [
    'popup-feed/popup-feed-lobby-notifications.js',
    'createPopupFeedLobbyNotifications'
  ],
  [
    'popup-feed/popup-feed-oling-notifications.js',
    'createPopupFeedOlingNotifications'
  ]
];
const notificationComposer = [
  'popup-feed/popup-feed-notifications.js',
  'createPopupFeedNotifications'
];
const moduleFactories = [...featureModules, notificationComposer];

test('popup feed feature modules register their factories', () => {
  moduleFactories.forEach(([filename, factoryName]) => {
    const context = { window: {} };
    vm.runInNewContext(
      fs.readFileSync(path.join(scriptsDirectory, filename), 'utf8'),
      context,
      { filename }
    );

    assert.equal(typeof context.window[factoryName], 'function');
  });
});

test('popup feed navigation chooses destination-specific splash artwork', () => {
  const dom = new JSDOM('<!doctype html><body></body>', {
    runScripts: 'dangerously',
    url: 'https://overexposed.app/'
  });
  const { window } = dom;
  const transitions = [];

  try {
    window.transitionSplashScreen = (...args) => transitions.push(args);
    window.eval(
      fs.readFileSync(path.join(scriptsDirectory, navigationModule), 'utf8')
    );

    assert.equal(
      window.getPopupFeedSplashScreen(
        '/truth-or-dare/settings?partyCode=ABC-123'
      ),
      '/images/splash-screens/truth-or-dare-settings.png'
    );
    assert.equal(
      window.getPopupFeedSplashScreen('/truth-or-dare/ABC-123'),
      '/images/splash-screens/truth-or-dare.png'
    );
    assert.equal(
      window.getPopupFeedSplashScreen('/olings/lab'),
      '/images/splash-screens/overexposed.png'
    );
    assert.equal(window.navigateFromPopupFeed('https://example.com'), false);

    assert.equal(
      window.navigateFromPopupFeed('/truth-or-dare/settings?partyCode=ABC-123'),
      true
    );
    assert.deepEqual(transitions, [
      [
        '/truth-or-dare/settings?partyCode=ABC-123',
        '/images/splash-screens/truth-or-dare-settings.png'
      ]
    ]);
  } finally {
    dom.window.close();
  }
});

test('popup feed loads feature modules before the startup script', () => {
  const template = fs.readFileSync(templatePath, 'utf8');
  const startupIndex = template.indexOf(
    "'/scripts/general/popup-feed/popup-feed.js'"
  );

  assert.ok(startupIndex > -1);
  const navigationIndex = template.indexOf(
    `'/scripts/general/${navigationModule}'`
  );
  assert.ok(navigationIndex > -1);
  assert.ok(navigationIndex < startupIndex);
  moduleFactories.forEach(([filename]) => {
    const moduleIndex = template.indexOf(`'/scripts/general/${filename}'`);
    assert.ok(moduleIndex > -1);
    assert.ok(moduleIndex < startupIndex);
  });

  const notificationComposerIndex = template.indexOf(
    `'/scripts/general/${notificationComposer[0]}'`
  );
  featureModules.slice(2).forEach(([filename]) => {
    assert.ok(
      navigationIndex < template.indexOf(`'/scripts/general/${filename}'`)
    );
    assert.ok(
      template.indexOf(`'/scripts/general/${filename}'`) <
        notificationComposerIndex
    );
  });
});

test('semantic notification sounds are registered and load before popup startup', () => {
  const soundSource = fs.readFileSync(soundScriptPath, 'utf8');
  notificationSoundRegistrations.forEach(([soundKey, relativePath]) => {
    const publicPath = `/sounds/notifications/${relativePath}`;
    const escapedPublicPath = publicPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    assert.match(
      soundSource,
      new RegExp(`${soundKey}:\\s*\\{[\\s\\S]*?src:\\s*'${escapedPublicPath}'`)
    );
    assert.ok(
      fs.existsSync(
        path.join(notificationSoundsDirectory, ...relativePath.split('/'))
      ),
      `${relativePath} should exist`
    );
  });

  const registrySource = fs.readFileSync(templatePath, 'utf8');
  const context = {};
  vm.runInNewContext(
    `${registrySource}\nthis.coreScriptsForTest = coreScripts;`,
    context,
    { filename: templatePath }
  );

  assert.ok(
    context.coreScriptsForTest['/scripts/general/sound/sound.js'].zIndex <
      context.coreScriptsForTest['/scripts/general/popup-feed/popup-feed.js']
        .zIndex
  );
});

test('popup feed startup composes every feature factory', () => {
  const startup = fs.readFileSync(
    path.join(scriptsDirectory, 'popup-feed/popup-feed.js'),
    'utf8'
  );

  [
    'createPopupFeedAchievements',
    'createPopupFeedAccountPrompt',
    'createPopupFeedNotifications'
  ].forEach((factoryName) => {
    assert.match(startup, new RegExp(`window\\.${factoryName}`));
  });
});

test('popup feed startup initializes after its feature modules load', () => {
  const dom = new JSDOM('<!doctype html><body></body>', {
    runScripts: 'dangerously',
    url: 'https://overexposed.app/'
  });
  const { window } = dom;

  window.requestAnimationFrame = (callback) => {
    callback();
    return 1;
  };
  try {
    moduleFactories.forEach(([filename]) => {
      window.eval(
        fs.readFileSync(path.join(scriptsDirectory, filename), 'utf8')
      );
    });
    window.eval(
      fs.readFileSync(
        path.join(scriptsDirectory, 'popup-feed/popup-feed.js'),
        'utf8'
      )
    );

    assert.equal(typeof window.showAchievementPopup, 'function');
    assert.equal(typeof window.showAccountPromptPopup, 'function');
    assert.equal(typeof window.checkFriendNotifications, 'function');
  } finally {
    dom.window.close();
  }
});

test('shared popup feed configures entrance and exit sounds without blocking popups', async () => {
  const dom = new JSDOM('<!doctype html><body></body>', {
    runScripts: 'dangerously',
    url: 'https://overexposed.app/'
  });
  const { window } = dom;
  const playedSoundKeys = [];

  window.requestAnimationFrame = (callback) => {
    callback();
    return 1;
  };
  window.playSoundEffect = (key) => {
    playedSoundKeys.push(key);
    if (key === 'notificationFailure') {
      return Promise.reject(new Error('Audio playback blocked'));
    }
    throw new Error('Audio playback unavailable');
  };

  try {
    moduleFactories.forEach(([filename]) => {
      window.eval(
        fs.readFileSync(path.join(scriptsDirectory, filename), 'utf8')
      );
    });
    window.eval(
      fs.readFileSync(
        path.join(scriptsDirectory, 'popup-feed/popup-feed.js'),
        'utf8'
      )
    );

    const rejectedSoundPopup = window.document.createElement('div');
    const thrownSoundPopup = window.document.createElement('div');
    const defaultSoundPopup = window.document.createElement('div');
    const silentPopup = window.document.createElement('div');
    const fullySilentPopup = window.document.createElement('div');
    const customExitPopup = window.document.createElement('div');
    window.showOePopup(rejectedSoundPopup, {
      persist: true,
      soundKey: 'notificationFailure'
    });
    window.showOePopup(thrownSoundPopup, {
      persist: true,
      slideInSound: 'notificationSuccess'
    });
    window.showOePopup(defaultSoundPopup, { persist: true });
    window.showOePopup(silentPopup, { persist: true, sound: false });
    window.showOePopup(fullySilentPopup, {
      persist: true,
      slideInSound: 'none',
      slideOutSound: 'none'
    });
    window.showOePopup(customExitPopup, {
      persist: true,
      slideInSound: 'none',
      slideOutSound: 'customNotificationExit'
    });
    assert.equal(window.dismissOePopup(rejectedSoundPopup), true);
    assert.equal(window.dismissOePopup(rejectedSoundPopup), false);
    assert.equal(window.dismissOePopup(silentPopup), true);
    assert.equal(window.dismissOePopup(fullySilentPopup), true);
    assert.equal(window.dismissOePopup(customExitPopup), true);
    await new Promise((resolve) => window.setTimeout(resolve, 0));

    assert.deepEqual(playedSoundKeys, [
      'notificationFailure',
      'notificationSuccess',
      'notificationSlideIn',
      'notificationSlideOut',
      'notificationSlideOut',
      'customNotificationExit'
    ]);
    assert.equal(rejectedSoundPopup.parentElement?.id, 'oe-popup-feed');
    assert.equal(thrownSoundPopup.parentElement?.id, 'oe-popup-feed');
    assert.equal(silentPopup.parentElement?.id, 'oe-popup-feed');
  } finally {
    dom.window.close();
  }
});

test('popup feed plays the configured exit sound on automatic dismissal', async () => {
  const dom = new JSDOM('<!doctype html><body></body>', {
    runScripts: 'dangerously',
    url: 'https://overexposed.app/'
  });
  const { window } = dom;
  const playedSoundKeys = [];

  window.requestAnimationFrame = (callback) => {
    callback();
    return 1;
  };
  window.playSoundEffect = (key) => {
    playedSoundKeys.push(key);
    return Promise.resolve();
  };

  try {
    moduleFactories.forEach(([filename]) => {
      window.eval(
        fs.readFileSync(path.join(scriptsDirectory, filename), 'utf8')
      );
    });
    window.eval(
      fs.readFileSync(
        path.join(scriptsDirectory, 'popup-feed/popup-feed.js'),
        'utf8'
      )
    );

    const row = window.document.createElement('div');
    window.showOePopup(row, {
      duration: 5,
      slideInSound: 'none'
    });
    await new Promise((resolve) => window.setTimeout(resolve, 20));

    assert.deepEqual(playedSoundKeys, ['notificationSlideOut']);
    assert.equal(row.classList.contains('is-exiting'), true);
  } finally {
    dom.window.close();
  }
});

test('status popups update in place and can be dismissed by key', () => {
  const dom = new JSDOM('<!doctype html><body></body>', {
    runScripts: 'dangerously',
    url: 'https://overexposed.app/'
  });
  const { window } = dom;
  const avatarRenders = [];

  window.requestAnimationFrame = (callback) => {
    callback();
    return 1;
  };
  window.createUserIconPartyGames = (options) => {
    avatarRenders.push(options);
    const icon = window.document.createElement('span');
    icon.className = 'icon';
    options.container.appendChild(icon);
  };

  try {
    moduleFactories.forEach(([filename]) => {
      window.eval(
        fs.readFileSync(path.join(scriptsDirectory, filename), 'utf8')
      );
    });
    window.eval(
      fs.readFileSync(
        path.join(scriptsDirectory, 'popup-feed/popup-feed.js'),
        'utf8'
      )
    );

    const firstRow = window.showOeStatusPopup({
      key: 'game-start-blocked',
      label: 'Start blocked',
      title: "Can't start yet",
      messages: ['2 more players needed'],
      duration: 0,
      sound: false,
      avatar: {
        userId: 'host',
        userCustomisationString: 'host-icon',
        label: "Party Host's OE"
      }
    });
    const updatedRow = window.showOeStatusPopup({
      key: 'game-start-blocked',
      label: 'Start blocked',
      title: "Can't start yet",
      messages: ['1 more player needed', '1 player needs to ready up'],
      duration: 0,
      sound: false,
      avatar: {
        userId: 'host',
        userCustomisationString: 'updated-host-icon',
        label: "Party Host's OE"
      }
    });

    assert.equal(updatedRow, firstRow);
    assert.equal(
      window.document.querySelectorAll(
        '[data-popup-type="status"].oe-popup-row'
      ).length,
      1
    );
    assert.deepEqual(
      Array.from(updatedRow.querySelectorAll('li'), (item) => item.textContent),
      ['1 more player needed', '1 player needs to ready up']
    );
    assert.equal(updatedRow.classList.contains('has-avatar'), true);
    assert.equal(
      updatedRow
        .querySelector('.oe-status-popup-avatar')
        ?.getAttribute('aria-label'),
      "Party Host's OE"
    );
    assert.equal(avatarRenders.length, 2);
    assert.equal(avatarRenders[1].userCustomisationString, 'updated-host-icon');
    assert.equal(window.dismissOeStatusPopup('game-start-blocked'), true);
    assert.equal(updatedRow.classList.contains('is-exiting'), true);
  } finally {
    dom.window.close();
  }
});

test('email verification success popup uses the confirmed account and OE', () => {
  const dom = new JSDOM('<!doctype html><body></body>', {
    runScripts: 'dangerously',
    url: 'https://overexposed.app/'
  });
  const { window } = dom;
  const avatarRenders = [];

  window.requestAnimationFrame = (callback) => {
    callback();
    return 1;
  };
  window.fetch = async () => ({
    ok: true,
    json: async () => ({ data: { notifications: [] } })
  });
  window.localStorage.setItem(
    'oe-account',
    JSON.stringify({
      id: 'verified-account',
      username: 'Verified Player',
      oeIcon: '1000:1100:1200:1300'
    })
  );
  window.createUserIconPartyGames = (options) => {
    avatarRenders.push(options);
    const icon = window.document.createElement('span');
    icon.className = 'icon';
    options.container.appendChild(icon);
  };

  try {
    moduleFactories.forEach(([filename]) => {
      window.eval(
        fs.readFileSync(path.join(scriptsDirectory, filename), 'utf8')
      );
    });
    window.eval(
      fs.readFileSync(
        path.join(scriptsDirectory, 'popup-feed/popup-feed.js'),
        'utf8'
      )
    );

    const row = window.showEmailVerificationSuccessPopup();

    assert.equal(row.classList.contains('is-success'), true);
    assert.equal(row.classList.contains('has-avatar'), true);
    assert.equal(
      row.querySelector('.oe-status-popup-avatar')?.getAttribute('aria-label'),
      'Your OE'
    );
    assert.equal(avatarRenders.length, 1);
    assert.equal(avatarRenders[0].userId, 'verified-account');
    assert.equal(
      avatarRenders[0].userCustomisationString,
      '1000:1100:1200:1300'
    );
    assert.equal(
      row.querySelector('.oe-status-popup-label')?.textContent,
      'ACCOUNT READY'
    );
    assert.equal(
      row.querySelector('.oe-status-popup-title')?.textContent,
      'Email confirmed'
    );
    assert.equal(
      row.querySelector('.oe-status-popup-message')?.textContent,
      'You are signed in and ready to continue.'
    );
  } finally {
    dom.window.close();
  }
});

test('site update popup stays silent until it transitions to ready', async () => {
  const dom = new JSDOM('<!doctype html><body></body>', {
    runScripts: 'dangerously',
    url: 'https://overexposed.app/'
  });
  const { window } = dom;
  const scheduledTimeouts = new Map();
  const playedSoundKeys = [];
  let siteVersionState = 'current';

  window.WEBSITE_CACHE_VERSION = '1';
  window.requestAnimationFrame = (callback) => {
    callback();
    return 1;
  };
  window.setTimeout = (callback, delay) => {
    scheduledTimeouts.set(delay, callback);
    return scheduledTimeouts.size;
  };
  window.setInterval = () => 1;
  window.playSoundEffect = (key) => {
    playedSoundKeys.push(key);
    return Promise.resolve();
  };
  window.fetch = async (url) => {
    if (url !== '/api/site-version') {
      throw new Error(`Unexpected fetch: ${url}`);
    }
    if (siteVersionState === 'error') {
      throw new Error('Temporary version check failure');
    }
    return {
      ok: true,
      json: async () => ({
        success: true,
        websiteCacheVersion: siteVersionState === 'ready' ? '2' : '1'
      })
    };
  };

  try {
    moduleFactories.forEach(([filename]) => {
      window.eval(
        fs.readFileSync(path.join(scriptsDirectory, filename), 'utf8')
      );
    });
    window.eval(
      fs.readFileSync(
        path.join(scriptsDirectory, 'popup-feed/popup-feed.js'),
        'utf8'
      )
    );

    const checkSiteVersion = scheduledTimeouts.get(5000);
    assert.equal(typeof checkSiteVersion, 'function');

    await checkSiteVersion();
    siteVersionState = 'error';
    await checkSiteVersion();

    const updatePopup = window.document.querySelector(
      '[data-popup-type="site-update"]'
    );
    assert.equal(updatePopup?.dataset.updateState, 'updating');
    assert.deepEqual(playedSoundKeys, []);

    siteVersionState = 'ready';
    await checkSiteVersion();
    assert.equal(updatePopup?.dataset.updateState, 'ready');
    assert.deepEqual(playedSoundKeys, ['notificationAttention']);

    await checkSiteVersion();
    assert.deepEqual(playedSoundKeys, ['notificationAttention']);
  } finally {
    dom.window.close();
  }
});

test('achievement and Opal popups use their semantic reward sounds', async () => {
  const dom = new JSDOM('<!doctype html><body></body>', {
    runScripts: 'dangerously',
    url: 'https://overexposed.app/'
  });
  const { window } = dom;
  const popupCalls = [];
  const rarityKeys = [
    'common',
    'uncommon',
    'rare',
    'epic',
    'legendary',
    'secret'
  ];

  window.localStorage.setItem(
    'oe-account',
    JSON.stringify({ id: 'account-one', username: 'tester' })
  );
  window.fetch = async (url) => {
    if (url === '/json-files/achievements/rarities.json') {
      return {
        ok: true,
        json: async () =>
          Object.fromEntries(
            rarityKeys.map((rarity) => [rarity, { label: rarity }])
          )
      };
    }
    if (url === '/api/achievements') {
      return { ok: true, json: async () => ({ achievements: [] }) };
    }
    throw new Error(`Unexpected fetch: ${url}`);
  };

  try {
    window.eval(
      fs.readFileSync(
        path.join(scriptsDirectory, 'popup-feed/popup-feed-achievements.js'),
        'utf8'
      )
    );
    const achievements = window.createPopupFeedAchievements({
      showPopup(row, options) {
        popupCalls.push({ row, options });
        return row;
      }
    });

    for (const rarity of rarityKeys) {
      await achievements.showAchievementPopup({
        key: `test-${rarity}`,
        name: `${rarity} test`,
        rarity,
        rewardResults:
          rarity === 'epic'
            ? [
                { type: 'opals', amount: 35, granted: true },
                { type: 'xp', amount: 175, granted: true }
              ]
            : []
      });
    }
    achievements.showOpalRewardPopup({ amount: 25, balance: 100 });

    assert.deepEqual(
      popupCalls.map(({ options }) => options.slideInSound),
      [
        'notificationSuccess',
        'notificationSuccess',
        'notificationSuccess',
        'notificationSuccess',
        'notificationAchievementLegendary',
        'notificationAchievementLegendary',
        'notificationSuccess'
      ]
    );
    assert.equal(
      popupCalls[5].row.querySelector('.achievement-popup-label').textContent,
      'secret unlocked'
    );
    assert.equal(
      popupCalls[3].row.querySelector('.achievement-popup-rewards'),
      null
    );
    assert.equal(popupCalls[6].row.dataset.popupType, 'opal-reward');
  } finally {
    dom.window.close();
  }
});

test('social popups distinguish attention, success, and failure sounds', () => {
  const dom = new JSDOM('<!doctype html><body></body>', {
    runScripts: 'dangerously',
    url: 'https://overexposed.app/'
  });
  const { window } = dom;
  const popupCalls = [];

  try {
    window.eval(
      fs.readFileSync(
        path.join(
          scriptsDirectory,
          'popup-feed/popup-feed-social-notifications.js'
        ),
        'utf8'
      )
    );
    const social = window.createPopupFeedSocialNotifications({
      dismissPopup() {},
      getStoredAccountSafely: () => null,
      isSignedInAccount: () => false,
      showPopup(row, options) {
        popupCalls.push({ row, options });
        return row;
      }
    });

    [
      { type: 'friend_request', accountId: 'friend-request' },
      {
        type: 'session_invite',
        sessionType: 'party_game',
        accountId: 'party-invite'
      },
      {
        type: 'session_invite',
        sessionType: 'oling_battle',
        accountId: 'oling-invite'
      },
      { type: 'friend_accepted', accountId: 'friend-accepted' },
      {
        type: 'session_invite_accepted',
        accountId: 'invite-accepted'
      },
      {
        type: 'session_invite_declined',
        accountId: 'invite-declined'
      },
      {
        type: 'friend_online',
        accountId: 'friend-online'
      },
      {
        type: 'friend_joinable_session_started',
        accountId: 'joinable-session',
        modeName: 'Paranoia',
        lobbyPath: '/XYZ-789'
      }
    ].forEach((notification) => social.showFriendRequestPopup(notification));

    assert.deepEqual(
      popupCalls.map(({ options }) => options.slideInSound),
      [
        'notificationAttention',
        'notificationAttention',
        'notificationAttention',
        'notificationSuccess',
        'notificationSuccess',
        'notificationFailure',
        'notificationAttention',
        'notificationAttention'
      ]
    );
    assert.equal(
      popupCalls[4].row.querySelector('.friend-request-popup-message')
        .textContent,
      'Accepted your invite'
    );
    assert.equal(
      popupCalls[7].row.querySelector('.friend-request-popup-view').textContent,
      'Join'
    );
  } finally {
    dom.window.close();
  }
});

test('session invites and Olings notifications navigate through the splash helper', async () => {
  const dom = new JSDOM('<!doctype html><body></body>', {
    runScripts: 'dangerously',
    url: 'https://overexposed.app/'
  });
  const { window } = dom;
  const transitions = [];

  window.transitionSplashScreen = (...args) => transitions.push(args);
  window.fetch = async () => ({
    ok: true,
    json: async () => ({
      success: true,
      data: { lobbyPath: '/truth-or-dare/ABC-123' }
    })
  });

  try {
    [
      navigationModule,
      'popup-feed/popup-feed-social-notifications.js',
      'popup-feed/popup-feed-oling-notifications.js'
    ].forEach((filename) => {
      window.eval(
        fs.readFileSync(path.join(scriptsDirectory, filename), 'utf8')
      );
    });

    const showPopup = (row) => row;
    const social = window.createPopupFeedSocialNotifications({
      dismissPopup() {},
      getStoredAccountSafely: () => null,
      isSignedInAccount: () => false,
      showPopup
    });
    const olings = window.createPopupFeedOlingNotifications({
      getStoredAccountSafely: () => null,
      isSignedInAccount: () => false,
      showPopup
    });

    const invite = social.showFriendRequestPopup({
      type: 'session_invite',
      sessionType: 'party_game',
      accountId: '0123456789abcdef01234567'
    });
    invite.querySelector('.is-accept').click();
    await new Promise((resolve) => window.setTimeout(resolve, 0));

    const incubator = olings.showIncubatorReadyPopup({ eggName: 'Base egg' });
    incubator.click();

    assert.deepEqual(transitions, [
      ['/truth-or-dare/ABC-123', '/images/splash-screens/truth-or-dare.png'],
      ['/olings/lab', '/images/splash-screens/overexposed.png']
    ]);
  } finally {
    dom.window.close();
  }
});

test('party popups distinguish positive, neutral, and negative activity', () => {
  const dom = new JSDOM('<!doctype html><body></body>', {
    runScripts: 'dangerously',
    url: 'https://overexposed.app/'
  });
  const { window } = dom;
  const popupCalls = [];

  try {
    window.eval(
      fs.readFileSync(
        path.join(
          scriptsDirectory,
          'popup-feed/popup-feed-social-notifications.js'
        ),
        'utf8'
      )
    );
    const social = window.createPopupFeedSocialNotifications({
      dismissPopup() {},
      getStoredAccountSafely: () => null,
      isSignedInAccount: () => false,
      showPopup(row, options) {
        popupCalls.push({ row, options });
        return row;
      }
    });
    const partyTypes = [
      'party_player_joined',
      'party_player_reconnected',
      'party_player_left',
      'party_host_changed',
      'party_player_disconnected',
      'party_player_kicked',
      'party_disbanded'
    ];

    partyTypes.forEach((type, index) => {
      social.showPartyNotificationPopup({
        id: `party-notification-${index}`,
        type,
        actorUsername: `Player ${index}`
      });
    });

    assert.deepEqual(
      popupCalls.map(({ options }) => options.slideInSound),
      [
        'notificationPartyPositive',
        'notificationPartyPositive',
        'notificationPartyNeutral',
        'notificationPartyNeutral',
        'notificationPartyNegative',
        'gamemodeSettingsPlayerKicked',
        'notificationPartyNegative'
      ]
    );
  } finally {
    dom.window.close();
  }
});

test('live host lobby membership popups defer to their dedicated sounds', () => {
  const dom = new JSDOM('<!doctype html><body></body>', {
    runScripts: 'dangerously',
    url: 'https://overexposed.app/'
  });
  const { window } = dom;
  const popupCalls = [];

  try {
    window.shouldUseDedicatedGamemodeSettingsLobbyMembershipSound = (
      notification
    ) => notification.partyId === 'PARTY-1';
    window.eval(
      fs.readFileSync(
        path.join(
          scriptsDirectory,
          'popup-feed/popup-feed-social-notifications.js'
        ),
        'utf8'
      )
    );
    const social = window.createPopupFeedSocialNotifications({
      dismissPopup() {},
      getStoredAccountSafely: () => null,
      isSignedInAccount: () => false,
      showPopup(row, options) {
        popupCalls.push({ row, options });
        return row;
      }
    });

    ['party_player_joined', 'party_player_left'].forEach((type, index) => {
      social.showPartyNotificationPopup({
        id: `lobby-membership-${index}`,
        type,
        partyId: 'PARTY-1',
        actorUsername: `Player ${index}`
      });
    });

    assert.deepEqual(
      popupCalls.map(({ options }) => options.sound),
      [false, false]
    );
  } finally {
    dom.window.close();
  }
});

test('kick popups distinguish lobby and removed-player perspectives', () => {
  const dom = new JSDOM('<!doctype html><body></body>', {
    runScripts: 'dangerously',
    url: 'https://overexposed.app/'
  });
  const { window } = dom;
  const popupCalls = [];

  try {
    window.eval(
      fs.readFileSync(
        path.join(
          scriptsDirectory,
          'popup-feed/popup-feed-social-notifications.js'
        ),
        'utf8'
      )
    );
    const social = window.createPopupFeedSocialNotifications({
      dismissPopup() {},
      getStoredAccountSafely: () => null,
      isSignedInAccount: () => false,
      showPopup(row, options) {
        popupCalls.push({ row, options });
        return row;
      }
    });

    social.showPartyNotificationPopup({
      id: 'kick-lobby',
      type: 'party_player_kicked',
      perspective: 'lobby',
      actorUsername: 'Alex'
    });
    social.showPartyNotificationPopup({
      id: 'kick-player',
      type: 'party_player_kicked',
      perspective: 'removed-player',
      actorUsername: 'Party Host'
    });

    assert.deepEqual(
      popupCalls.map(
        ({ row }) =>
          row.querySelector('.friend-request-popup-message').textContent
      ),
      ['WAS REMOVED FROM THE PARTY', 'REMOVED YOU FROM THE PARTY']
    );
    assert.ok(
      popupCalls.every(
        ({ options }) => options.slideInSound === 'gamemodeSettingsPlayerKicked'
      )
    );
  } finally {
    dom.window.close();
  }
});

test('live and account copies of one kick notification render once', () => {
  const dom = new JSDOM('<!doctype html><body></body>', {
    runScripts: 'dangerously',
    url: 'https://overexposed.app/'
  });
  const { window } = dom;
  const shownRows = [];

  try {
    window.eval(
      fs.readFileSync(
        path.join(
          scriptsDirectory,
          'popup-feed/popup-feed-social-notifications.js'
        ),
        'utf8'
      )
    );
    const social = window.createPopupFeedSocialNotifications({
      dismissPopup() {},
      getStoredAccountSafely: () => null,
      isSignedInAccount: () => false,
      showPopup(row) {
        shownRows.push(row);
        return row;
      }
    });
    const sharedKick = {
      type: 'party_player_kicked',
      partyId: 'PARTY-ONE',
      actorAccountId: 'host-account',
      actorUsername: 'Party Host',
      suppressIfRecent: true
    };

    social.showPartyNotificationPopup({
      ...sharedKick,
      id: 'live:party_player_kicked:PARTY-ONE:host-account',
      perspective: 'removed-player'
    });
    social.showPartyNotificationPopup({
      ...sharedKick,
      id: '11111111-1111-4111-8111-111111111111'
    });

    assert.equal(shownRows.length, 1);
  } finally {
    dom.window.close();
  }
});

test('party popups render every distinct rapid connection occurrence', () => {
  const dom = new JSDOM('<!doctype html><body></body>', {
    runScripts: 'dangerously',
    url: 'https://overexposed.app/'
  });
  const { window } = dom;
  const shownRows = [];

  try {
    window.eval(
      fs.readFileSync(
        path.join(
          scriptsDirectory,
          'popup-feed/popup-feed-social-notifications.js'
        ),
        'utf8'
      )
    );
    const social = window.createPopupFeedSocialNotifications({
      dismissPopup() {},
      getStoredAccountSafely: () => null,
      isSignedInAccount: () => false,
      showPopup(row) {
        shownRows.push(row);
        return row;
      }
    });
    const connectionTypes = [
      'party_player_disconnected',
      'party_player_reconnected',
      'party_player_disconnected',
      'party_player_reconnected'
    ];

    connectionTypes.forEach((type, index) => {
      social.showPartyNotificationPopup({
        id: `party-connection-occurrence-${index + 1}`,
        type,
        partyId: 'PARTY-ONE',
        actorAccountId: 'player-one',
        actorUsername: 'Player One',
        createdAt: new Date(1_000 + index).toISOString(),
        suppressIfRecent: true
      });
    });

    assert.deepEqual(
      shownRows.map(
        (row) => row.querySelector('.friend-request-popup-message').textContent
      ),
      ['DISCONNECTED', 'RECONNECTED', 'DISCONNECTED', 'RECONNECTED']
    );
  } finally {
    dom.window.close();
  }
});

test('party connection sounds use a sliding cooldown per player and party', () => {
  const dom = new JSDOM('<!doctype html><body></body>', {
    runScripts: 'dangerously',
    url: 'https://overexposed.app/'
  });
  const { window } = dom;
  const popupCalls = [];
  let now = 1_000;

  window.Date.now = () => now;

  try {
    window.eval(
      fs.readFileSync(
        path.join(
          scriptsDirectory,
          'popup-feed/popup-feed-social-notifications.js'
        ),
        'utf8'
      )
    );
    const social = window.createPopupFeedSocialNotifications({
      dismissPopup() {},
      getStoredAccountSafely: () => null,
      isSignedInAccount: () => false,
      showPopup(row, options) {
        popupCalls.push({ row, options });
        return row;
      }
    });
    let occurrenceIndex = 0;
    const showConnectionOccurrence = ({
      type,
      partyId = 'PARTY-ONE',
      actorAccountId = 'player-one',
      actorUsername = actorAccountId
    }) => {
      occurrenceIndex += 1;
      social.showPartyNotificationPopup({
        id: `party-connection-sound-${occurrenceIndex}`,
        type,
        partyId,
        actorAccountId,
        actorUsername,
        suppressIfRecent: true
      });
    };

    [
      'party_player_disconnected',
      'party_player_reconnected',
      'party_player_disconnected',
      'party_player_reconnected'
    ].forEach((type) => showConnectionOccurrence({ type }));
    showConnectionOccurrence({
      type: 'party_player_disconnected',
      actorAccountId: 'player-two'
    });
    showConnectionOccurrence({
      type: 'party_player_reconnected',
      partyId: 'PARTY-TWO'
    });
    showConnectionOccurrence({
      type: 'party_player_disconnected',
      actorAccountId: '',
      actorUsername: 'Guest One'
    });
    showConnectionOccurrence({
      type: 'party_player_reconnected',
      actorAccountId: '',
      actorUsername: 'Guest One'
    });

    now += 44_999;
    showConnectionOccurrence({ type: 'party_player_disconnected' });
    now += 1;
    showConnectionOccurrence({ type: 'party_player_reconnected' });
    now += 45_000;
    showConnectionOccurrence({ type: 'party_player_disconnected' });

    social.clearSignedOutNotifications();
    showConnectionOccurrence({ type: 'party_player_reconnected' });

    assert.equal(popupCalls.length, 12);
    assert.deepEqual(
      popupCalls.map(({ options }) => options.sound !== false),
      [
        true,
        false,
        false,
        false,
        true,
        true,
        true,
        false,
        false,
        false,
        true,
        true
      ]
    );
  } finally {
    dom.window.close();
  }
});

test('reused live-only party IDs retain temporary semantic deduplication', () => {
  const dom = new JSDOM('<!doctype html><body></body>', {
    runScripts: 'dangerously',
    url: 'https://overexposed.app/'
  });
  const { window } = dom;
  const shownRows = [];
  let now = 1_000;

  window.Date.now = () => now;

  try {
    window.eval(
      fs.readFileSync(
        path.join(
          scriptsDirectory,
          'popup-feed/popup-feed-social-notifications.js'
        ),
        'utf8'
      )
    );
    const social = window.createPopupFeedSocialNotifications({
      dismissPopup() {},
      getStoredAccountSafely: () => null,
      isSignedInAccount: () => false,
      showPopup(row) {
        shownRows.push(row);
        return row;
      }
    });
    const notification = {
      id: 'live:party_host_changed:PARTY-ONE:player-one',
      type: 'party_host_changed',
      partyId: 'PARTY-ONE',
      actorAccountId: 'player-one',
      actorUsername: 'Player One',
      suppressIfRecent: true
    };

    social.showPartyNotificationPopup(notification);
    now += 1_000;
    social.showPartyNotificationPopup(notification);
    now += 60_001;
    social.showPartyNotificationPopup(notification);

    assert.equal(shownRows.length, 2);
  } finally {
    dom.window.close();
  }
});

test('live and polled copies of one party occurrence render once', async () => {
  const dom = new JSDOM('<!doctype html><body></body>', {
    runScripts: 'dangerously',
    url: 'https://overexposed.app/'
  });
  const { window } = dom;
  const shownRows = [];
  const acknowledgedIds = [];
  let now = 1_000;
  const notification = {
    id: '11111111-1111-4111-8111-111111111111',
    type: 'party_player_disconnected',
    partyId: 'PARTY-ONE',
    modeName: 'Truth or Dare',
    actorAccountId: 'player-one',
    actorUsername: 'Player One',
    createdAt: new Date(1_000).toISOString()
  };

  window.Date.now = () => now;
  window.fetch = async (url, options = {}) => {
    if (
      url === '/api/accounts/party-notifications' &&
      options.method === 'PATCH'
    ) {
      acknowledgedIds.push(...JSON.parse(options.body).notificationIds);
      return { ok: true, json: async () => ({ success: true }) };
    }
    if (url === '/api/accounts/party-notifications') {
      return {
        ok: true,
        json: async () => ({
          success: true,
          data: { notifications: [notification] }
        })
      };
    }
    throw new Error(`Unexpected fetch: ${url}`);
  };

  try {
    window.eval(
      fs.readFileSync(
        path.join(
          scriptsDirectory,
          'popup-feed/popup-feed-social-notifications.js'
        ),
        'utf8'
      )
    );
    const social = window.createPopupFeedSocialNotifications({
      dismissPopup() {},
      getStoredAccountSafely: () => ({ id: 'host-account' }),
      isSignedInAccount: () => true,
      showPopup(row) {
        shownRows.push(row);
        return row;
      }
    });

    social.showPartyNotificationPopup({
      ...notification,
      suppressIfRecent: true
    });
    now += 60_001;
    await social.checkPartyNotifications();

    assert.equal(shownRows.length, 1);
    assert.equal(
      shownRows[0].querySelector('.friend-request-popup-message').textContent,
      'DISCONNECTED'
    );
    assert.deepEqual(acknowledgedIds, [notification.id]);
  } finally {
    dom.window.close();
  }
});

test('polled and later live copies of one party occurrence render once', async () => {
  const dom = new JSDOM('<!doctype html><body></body>', {
    runScripts: 'dangerously',
    url: 'https://overexposed.app/'
  });
  const { window } = dom;
  const shownRows = [];
  const acknowledgedIds = [];
  let now = 1_000;
  const notification = {
    id: '22222222-2222-4222-8222-222222222222',
    type: 'party_player_reconnected',
    partyId: 'PARTY-ONE',
    modeName: 'Truth or Dare',
    actorAccountId: 'player-one',
    actorUsername: 'Player One',
    createdAt: new Date(1_000).toISOString()
  };

  window.Date.now = () => now;
  window.fetch = async (url, options = {}) => {
    if (
      url === '/api/accounts/party-notifications' &&
      options.method === 'PATCH'
    ) {
      acknowledgedIds.push(...JSON.parse(options.body).notificationIds);
      return { ok: true, json: async () => ({ success: true }) };
    }
    if (url === '/api/accounts/party-notifications') {
      return {
        ok: true,
        json: async () => ({
          success: true,
          data: { notifications: [notification] }
        })
      };
    }
    throw new Error(`Unexpected fetch: ${url}`);
  };

  try {
    window.eval(
      fs.readFileSync(
        path.join(
          scriptsDirectory,
          'popup-feed/popup-feed-social-notifications.js'
        ),
        'utf8'
      )
    );
    const social = window.createPopupFeedSocialNotifications({
      dismissPopup() {},
      getStoredAccountSafely: () => ({ id: 'host-account' }),
      isSignedInAccount: () => true,
      showPopup(row) {
        shownRows.push(row);
        return row;
      }
    });

    await social.checkPartyNotifications();
    now += 60_001;
    social.showPartyNotificationPopup({
      ...notification,
      suppressIfRecent: true
    });

    assert.equal(shownRows.length, 1);
    assert.equal(
      shownRows[0].querySelector('.friend-request-popup-message').textContent,
      'RECONNECTED'
    );
    assert.deepEqual(acknowledgedIds, [notification.id]);
  } finally {
    dom.window.close();
  }
});

test('incubator and active-lobby reminders use the attention sound', async () => {
  const dom = new JSDOM('<!doctype html><body></body>', {
    runScripts: 'dangerously',
    url: 'https://overexposed.app/'
  });
  const { window } = dom;
  const popupCalls = [];
  let activeSession = {
    type: 'party_game',
    key: 'truth-or-dare',
    code: 'ABC-123',
    modeName: 'Truth or Dare',
    lobbyPath: '/truth-or-dare/ABC-123',
    host: { username: 'Host' }
  };

  window.console.log = () => {};
  window.fetch = async () => ({
    ok: true,
    json: async () => ({
      success: true,
      data: { active: true, session: activeSession }
    })
  });

  try {
    [
      'popup-feed/popup-feed-oling-notifications.js',
      'popup-feed/popup-feed-lobby-notifications.js'
    ].forEach((filename) => {
      window.eval(
        fs.readFileSync(path.join(scriptsDirectory, filename), 'utf8')
      );
    });
    const showPopup = (row, options) => {
      popupCalls.push({ row, options });
      return row;
    };
    const olings = window.createPopupFeedOlingNotifications({
      getStoredAccountSafely: () => null,
      isSignedInAccount: () => false,
      showPopup
    });
    const lobby = window.createPopupFeedLobbyNotifications({
      dismissPopup() {},
      showPopup
    });

    olings.showIncubatorReadyPopup({ eggName: 'Base egg' });
    await lobby.checkActiveLobby();
    activeSession = {
      type: 'oling_battle',
      key: 'oling-battle',
      code: 'OLING-1',
      modeName: 'Oling Battle',
      lobbyPath: '/olings/battle/OLING-1',
      host: { username: 'Battler' }
    };
    await lobby.checkActiveLobby();

    assert.deepEqual(
      popupCalls.map(({ options }) => options.slideInSound),
      [
        'notificationAttention',
        'notificationAttention',
        'notificationAttention'
      ]
    );
    assert.deepEqual(
      popupCalls.map(({ row }) => row.dataset.popupType),
      ['incubator-ready', 'active-lobby', 'active-lobby']
    );
  } finally {
    dom.window.close();
  }
});

test('active-lobby return links use the host-specific direct settings path', async () => {
  const dom = new JSDOM('<!doctype html><body></body>', {
    runScripts: 'dangerously',
    url: 'https://overexposed.app/'
  });
  const { window } = dom;
  let popupRow = null;
  const transitions = [];

  window.console.log = () => {};
  window.transitionSplashScreen = (...args) => transitions.push(args);
  window.fetch = async () => ({
    ok: true,
    json: async () => ({
      success: true,
      data: {
        active: true,
        session: {
          type: 'party_game',
          key: 'truth-or-dare',
          code: 'ABC-123',
          modeName: 'Truth or Dare',
          isHost: true,
          lobbyPath: '/ABC-123',
          returnPath: '/truth-or-dare/settings?partyCode=ABC-123',
          host: { username: 'Host' }
        }
      }
    })
  });

  try {
    [navigationModule, 'popup-feed/popup-feed-lobby-notifications.js'].forEach(
      (filename) => {
        window.eval(
          fs.readFileSync(path.join(scriptsDirectory, filename), 'utf8')
        );
      }
    );
    const lobby = window.createPopupFeedLobbyNotifications({
      dismissPopup() {},
      showPopup(row) {
        popupRow = row;
        return row;
      }
    });

    await lobby.checkActiveLobby();

    const returnLink = popupRow.querySelector(
      '.friend-request-popup-view.is-return'
    );
    assert.equal(
      returnLink.dataset.returnPath,
      '/truth-or-dare/settings?partyCode=ABC-123'
    );
    returnLink.click();
    assert.deepEqual(transitions, [
      [
        '/truth-or-dare/settings?partyCode=ABC-123',
        '/images/splash-screens/truth-or-dare-settings.png'
      ]
    ]);
  } finally {
    dom.window.close();
  }
});

test('host lobby leave keeps clean game settings as the auth return path', async () => {
  const dom = new JSDOM('<!doctype html><body></body>', {
    runScripts: 'dangerously',
    url: 'https://overexposed.app/sign-in?returnTo=%2Ftruth-or-dare%2Fsettings%3FpartyCode%3DABC-123&splashScreen=%2Fimages%2Fsplash-screens%2Ftruth-or-dare-settings.png'
  });
  const { window } = dom;
  let popupRow = null;
  let active = true;
  const requests = [];
  window.console.log = () => {};
  window.sessionStorage.setItem(
    'oe-waiting-room-gamemode:ABC-123',
    'truth-or-dare'
  );
  window.fetch = async (url, options = {}) => {
    requests.push({ options, url });
    if (options.method === 'POST') {
      active = false;
      return {
        ok: true,
        json: async () => ({ success: true })
      };
    }
    return {
      ok: true,
      json: async () => ({
        success: true,
        data: {
          active,
          session: active
            ? {
                type: 'party_game',
                key: 'truth-or-dare',
                code: 'ABC-123',
                modeName: 'Truth or Dare',
                isHost: true,
                lobbyPath: '/ABC-123',
                returnPath: '/truth-or-dare/settings?partyCode=ABC-123',
                apiRoute: 'party-game-truth-or-dare',
                playerComputerId: 'host-device',
                host: { username: 'Host' }
              }
            : null
        }
      })
    };
  };

  try {
    window.eval(
      fs.readFileSync(
        path.join(
          scriptsDirectory,
          'popup-feed/popup-feed-lobby-notifications.js'
        ),
        'utf8'
      )
    );
    const lobby = window.createPopupFeedLobbyNotifications({
      dismissPopup(row) {
        row.remove();
      },
      showPopup(row) {
        popupRow = row;
        window.document.body.appendChild(row);
        return row;
      }
    });

    await lobby.checkActiveLobby();
    popupRow.querySelector('.friend-request-popup-view.is-decline').click();
    await new Promise((resolve) => window.setTimeout(resolve, 0));

    assert.equal(
      new URL(window.location.href).searchParams.get('returnTo'),
      '/truth-or-dare/settings'
    );
    assert.equal(
      window.sessionStorage.getItem('oe-waiting-room-gamemode:ABC-123'),
      null
    );
    const leaveRequest = requests.find(
      ({ options }) => options.method === 'POST'
    );
    assert.equal(leaveRequest.url, '/api/party-game-truth-or-dare/remove-user');
    assert.deepEqual(JSON.parse(leaveRequest.options.body), {
      partyId: 'ABC-123',
      computerIdToRemove: 'host-device',
      actorComputerId: 'host-device',
      exitIntent: 'main-menu'
    });
  } finally {
    dom.window.close();
  }
});

test('participant lobby leave removes its auth return path', async () => {
  const dom = new JSDOM('<!doctype html><body></body>', {
    runScripts: 'dangerously',
    url: 'https://overexposed.app/sign-in?returnTo=%2FABC-123&splashScreen=%2Fimages%2Fsplash-screens%2Ftruth-or-dare-settings.png'
  });
  const { window } = dom;
  let popupRow = null;
  let active = true;
  window.console.log = () => {};
  window.fetch = async (_url, options = {}) => {
    if (options.method === 'POST') {
      active = false;
      return {
        ok: true,
        json: async () => ({ success: true })
      };
    }
    return {
      ok: true,
      json: async () => ({
        success: true,
        data: {
          active,
          session: active
            ? {
                type: 'party_game',
                key: 'truth-or-dare',
                code: 'ABC-123',
                modeName: 'Truth or Dare',
                isHost: false,
                lobbyPath: '/ABC-123',
                returnPath: '/ABC-123',
                apiRoute: 'party-game-truth-or-dare',
                playerComputerId: 'participant-device',
                host: { username: 'Host' }
              }
            : null
        }
      })
    };
  };

  try {
    window.eval(
      fs.readFileSync(
        path.join(
          scriptsDirectory,
          'popup-feed/popup-feed-lobby-notifications.js'
        ),
        'utf8'
      )
    );
    const lobby = window.createPopupFeedLobbyNotifications({
      dismissPopup(row) {
        row.remove();
      },
      showPopup(row) {
        popupRow = row;
        window.document.body.appendChild(row);
        return row;
      }
    });

    await lobby.checkActiveLobby();
    popupRow.querySelector('.friend-request-popup-view.is-decline').click();
    await new Promise((resolve) => window.setTimeout(resolve, 0));

    const searchParams = new URL(window.location.href).searchParams;
    assert.equal(searchParams.get('returnTo'), null);
    assert.equal(
      searchParams.get('splashScreen'),
      '/images/splash-screens/truth-or-dare-settings.png'
    );
  } finally {
    dom.window.close();
  }
});

test('account prompt popup is silent', () => {
  const dom = new JSDOM('<!doctype html><body></body>', {
    runScripts: 'dangerously',
    url: 'https://overexposed.app/'
  });
  const { window } = dom;
  const popupCalls = [];

  try {
    window.eval(
      fs.readFileSync(
        path.join(scriptsDirectory, 'popup-feed/popup-feed-account-prompt.js'),
        'utf8'
      )
    );
    const accountPrompt = window.createPopupFeedAccountPrompt({
      dismissPopup() {},
      getStoredAccountSafely: () => null,
      isSignedInAccount: () => false,
      showPopup(row, options) {
        popupCalls.push({ row, options });
        return row;
      }
    });

    accountPrompt.showAccountPromptPopup({ force: true });

    assert.equal(popupCalls.length, 1);
    assert.equal(popupCalls[0].row.dataset.popupType, 'account-prompt');
    assert.equal(popupCalls[0].options.sound, false);
  } finally {
    dom.window.close();
  }
});

test('notification composer polls and acknowledges the unified inbox', async () => {
  const dom = new JSDOM('<!doctype html><body></body>');
  const context = { document: dom.window.document, window: {} };
  const requests = [];
  const dispatched = { friend: [], party: [], progression: [], system: [] };
  const notifications = [
    { id: 'friend-notification', category: 'social' },
    { id: 'party-notification', category: 'party' },
    { id: 'reward-notification', category: 'progression' },
    {
      id: 'system-notification',
      type: 'nsfw_pack_blocked',
      category: 'system',
      title: 'NSFW pack unavailable',
      body: 'Enable NSFW content in Settings to use this pack.'
    }
  ];

  context.window.createPopupFeedSocialNotifications = () => ({
    showFriendNotifications(items) {
      dispatched.friend.push(...items);
      return items.map((item) => item.id);
    },
    showPartyNotifications(items) {
      dispatched.party.push(...items);
      return items.map((item) => item.id);
    }
  });
  context.window.createPopupFeedLobbyNotifications = () => ({});
  context.window.createPopupFeedOlingNotifications = () => ({});
  context.fetch = async (url, options = {}) => {
    requests.push({ url, options });
    return {
      ok: true,
      json: async () =>
        options.method === 'PATCH'
          ? { success: true }
          : { success: true, notifications }
    };
  };

  vm.runInNewContext(
    fs.readFileSync(
      path.join(scriptsDirectory, 'popup-feed/popup-feed-notifications.js'),
      'utf8'
    ),
    context
  );
  const composer = context.window.createPopupFeedNotifications({
    dismissPopup() {},
    getStoredAccountSafely: () => ({ id: 'account-one' }),
    isSignedInAccount: () => true,
    showPopup(row) {
      dispatched.system.push(row.dataset.notificationId);
      return row;
    },
    async showAccountNotifications(items) {
      dispatched.progression.push(...items);
      return items.map((item) => item.id);
    }
  });

  await composer.checkNotifications();

  assert.deepEqual(
    requests.map(({ url }) => url),
    ['/api/accounts/notifications', '/api/accounts/notifications']
  );
  assert.deepEqual(
    JSON.parse(requests[1].options.body).notificationIds,
    notifications.map(({ id }) => id)
  );
  assert.deepEqual(
    {
      friend: dispatched.friend.map(({ id }) => id),
      party: dispatched.party.map(({ id }) => id),
      progression: dispatched.progression.map(({ id }) => id),
      system: dispatched.system
    },
    {
      friend: ['friend-notification'],
      party: ['party-notification'],
      progression: ['reward-notification'],
      system: ['system-notification']
    }
  );
  dom.window.close();
});

test('system notifications provide dismiss and open-settings actions', async () => {
  const dom = new JSDOM(
    '<!doctype html><body><input id="settings-nsfw"></body>',
    {
      runScripts: 'dangerously',
      url: 'https://overexposed.app/'
    }
  );
  const { window } = dom;
  const popupOptions = [];
  const dismissedRows = [];
  let settingsOpened = 0;
  let scrolled = false;

  try {
    window.createPopupFeedSocialNotifications = () => ({});
    window.createPopupFeedLobbyNotifications = () => ({});
    window.createPopupFeedOlingNotifications = () => ({});
    window.openAccountSettingsPanel = async () => {
      settingsOpened += 1;
      return true;
    };
    const nsfwSetting = window.document.getElementById('settings-nsfw');
    nsfwSetting.scrollIntoView = () => {
      scrolled = true;
    };

    window.eval(
      fs.readFileSync(
        path.join(scriptsDirectory, 'popup-feed/popup-feed-notifications.js'),
        'utf8'
      )
    );

    const composer = window.createPopupFeedNotifications({
      dismissPopup(row) {
        dismissedRows.push(row);
        row.remove();
      },
      getStoredAccountSafely: () => null,
      isSignedInAccount: () => false,
      showPopup(row, options) {
        popupOptions.push(options);
        window.document.body.appendChild(row);
        return row;
      },
      showAccountNotifications: async () => []
    });
    const notification = {
      key: 'nsfw-content-blocked',
      type: 'nsfw_pack_blocked',
      category: 'system',
      image: '/images/icons/difficulty/nsfw.svg',
      dismissWhenNsfwEnabled: true,
      label: 'SFW mode',
      title: 'NSFW pack unavailable',
      body: 'Enable NSFW content in Settings to use this pack.',
      action: {
        type: 'open_settings',
        target: 'settings-nsfw'
      }
    };

    const firstRow = composer.showSystemNotificationPopup(notification);
    const duplicateRow = composer.showSystemNotificationPopup(notification);

    assert.equal(firstRow, duplicateRow);
    assert.equal(popupOptions.length, 1);
    assert.equal(popupOptions[0].persist, true);
    assert.equal(popupOptions[0].slideInSound, 'notificationAttention');
    assert.equal(firstRow.classList.contains('is-refreshed'), true);
    assert.equal(
      firstRow.querySelector('.system-notification-popup-image img').src,
      'https://overexposed.app/images/icons/difficulty/nsfw.svg'
    );
    assert.equal(
      firstRow.querySelector('.system-notification-popup-title').textContent,
      'NSFW pack unavailable'
    );
    assert.deepEqual(
      [...firstRow.querySelectorAll('button')].map(
        (button) => button.textContent
      ),
      ['Dismiss', 'Open Settings']
    );

    const ruleRow = composer.showSystemNotificationPopup({
      ...notification,
      type: 'nsfw_game_rule_blocked',
      title: 'NSFW game rule unavailable',
      body: 'Enable NSFW content in Settings to use this game rule.'
    });

    assert.equal(ruleRow, firstRow);
    assert.equal(popupOptions.length, 1);
    assert.equal(
      ruleRow.querySelector('.system-notification-popup-title').textContent,
      'NSFW game rule unavailable'
    );
    assert.equal(
      ruleRow.querySelector('.system-notification-popup-message').textContent,
      'Enable NSFW content in Settings to use this game rule.'
    );

    firstRow.querySelector('.system-notification-popup-dismiss').click();
    assert.deepEqual(dismissedRows, [firstRow]);

    const settingsRow = composer.showSystemNotificationPopup(notification);
    settingsRow
      .querySelector('.system-notification-popup-open-settings')
      .click();
    await new Promise((resolve) => setImmediate(resolve));

    assert.equal(settingsOpened, 1);
    assert.equal(scrolled, true);
    assert.equal(window.document.activeElement, nsfwSetting);
    assert.deepEqual(dismissedRows, [firstRow]);
    assert.equal(settingsRow.isConnected, true);
    assert.equal(
      [...settingsRow.querySelectorAll('button')].every(
        (button) => button.disabled === false
      ),
      true
    );

    window.dispatchEvent(
      new window.CustomEvent('oe-nsfw-setting-changed', {
        detail: { enabled: false }
      })
    );
    assert.deepEqual(dismissedRows, [firstRow]);

    window.dispatchEvent(
      new window.CustomEvent('oe-nsfw-setting-changed', {
        detail: { enabled: true }
      })
    );
    assert.deepEqual(dismissedRows, [firstRow, settingsRow]);
  } finally {
    dom.window.close();
  }
});

test('live account event popups display immediately and ignore the polled copy', async () => {
  const dom = new JSDOM('<!doctype html><body></body>', {
    runScripts: 'dangerously',
    url: 'https://overexposed.app/'
  });
  const { window } = dom;
  const shownRows = [];
  const acknowledgedIds = [];
  const notifications = [
    {
      id: '11111111-1111-4111-8111-111111111111',
      type: 'achievement_unlocked',
      achievementKey: 'verified',
      rewardResults: [
        { type: 'opals', amount: 35, granted: true },
        { type: 'xp', amount: 175, granted: true }
      ]
    },
    {
      id: '22222222-2222-4222-8222-222222222222',
      type: 'opal_reward',
      amount: 35,
      balance: 45,
      label: 'Achievement reward',
      reason: 'Achievement unlocked: Verified',
      sourceType: 'achievement',
      sourceId: 'verified'
    }
  ];

  window.localStorage.setItem(
    'oe-account',
    JSON.stringify({ id: 'account-one', username: 'tester' })
  );
  window.fetch = async (url, options = {}) => {
    if (url === '/json-files/achievements/rarities.json') {
      return { ok: true, json: async () => ({}) };
    }
    if (url === '/api/achievements') {
      return {
        ok: true,
        json: async () => ({
          achievements: [
            {
              key: 'verified',
              name: 'Verified',
              description: 'Verified your account',
              rarity: 'common'
            }
          ]
        })
      };
    }
    if (
      url === '/api/accounts/me/notifications' &&
      options.method === 'PATCH'
    ) {
      acknowledgedIds.push(...JSON.parse(options.body).notificationIds);
      return { ok: true, json: async () => ({ success: true }) };
    }
    if (url === '/api/accounts/me/notifications') {
      return {
        ok: true,
        json: async () => ({ success: true, notifications })
      };
    }
    throw new Error(`Unexpected fetch: ${url}`);
  };

  try {
    window.eval(
      fs.readFileSync(
        path.join(scriptsDirectory, 'popup-feed/popup-feed-achievements.js'),
        'utf8'
      )
    );
    const accountEvents = window.createPopupFeedAchievements({
      showPopup(row) {
        shownRows.push(row);
        return row;
      }
    });

    await accountEvents.handleLiveAccountNotifications(notifications);
    assert.deepEqual(
      shownRows.map((row) => row.dataset.popupType),
      ['achievement']
    );
    assert.equal(
      shownRows[0].querySelector('.achievement-popup-rewards'),
      null
    );
    assert.deepEqual(
      acknowledgedIds,
      notifications.map(({ id }) => id)
    );

    await accountEvents.checkAccountNotifications();
    assert.equal(shownRows.length, 1);
  } finally {
    dom.window.close();
  }
});

test('confirmed party disband immediately clears the active lobby popup', async () => {
  const dom = new JSDOM('<!doctype html><body></body>', {
    runScripts: 'dangerously',
    url: 'https://overexposed.app/'
  });
  const { window } = dom;
  let active = true;
  const dismissedRows = [];
  window.console.log = () => {};
  window.fetch = async () => ({
    ok: true,
    json: async () => ({
      success: true,
      data: {
        active,
        session: active
          ? {
              type: 'party_game',
              key: 'truth-or-dare',
              code: 'ABC-123',
              modeName: 'Truth or Dare',
              lobbyPath: '/truth-or-dare/ABC-123',
              statusText: 'Waiting for players',
              isHost: true,
              host: { username: 'Host' }
            }
          : null
      }
    })
  });

  try {
    window.eval(
      fs.readFileSync(
        path.join(
          scriptsDirectory,
          'popup-feed/popup-feed-lobby-notifications.js'
        ),
        'utf8'
      )
    );
    const lobbyNotifications = window.createPopupFeedLobbyNotifications({
      showPopup(row) {
        window.document.body.appendChild(row);
        return row;
      },
      dismissPopup(row) {
        dismissedRows.push(row);
        row.remove();
      }
    });

    await lobbyNotifications.checkActiveLobby();
    assert.ok(
      window.document.querySelector('[data-popup-type="active-lobby"]')
    );

    active = false;
    window.dispatchEvent(
      new window.CustomEvent('oe-active-party-lobby-disbanded', {
        detail: { partyCode: 'ABC-123' }
      })
    );

    assert.equal(
      window.document.querySelector('[data-popup-type="active-lobby"]'),
      null
    );
    assert.equal(dismissedRows.length, 1);
    await new Promise((resolve) => window.setTimeout(resolve, 0));
  } finally {
    dom.window.close();
  }
});
