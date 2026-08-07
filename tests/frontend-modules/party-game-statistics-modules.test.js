const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const { JSDOM } = require('jsdom');

const scriptsDirectory = path.join(
  __dirname,
  '../../public/scripts/party-games/gamemode/online/general'
);
const pageDirectory = path.join(__dirname, '../../public/pages/party-games');
const facadePath = path.join(scriptsDirectory, 'party-game-statistics.js');
const rewardsPath = path.join(
  scriptsDirectory,
  'party-game-statistics/rewards.js'
);
const scoreImpactPath = path.join(
  scriptsDirectory,
  'party-game-statistics/score-impact.js'
);
const templatePath = path.join(
  __dirname,
  '../../public/html-templates/party-games/party-game-statistics.html'
);
const supportScripts = [
  ['party-game-statistics/rewards.js', 'renderPartyGameRewards'],
  ['party-game-statistics/scoreboard.js', 'renderPartyGameScoreboard'],
  ['party-game-statistics/score-impact.js', 'ShowPartyGameScoreImpact']
];
const onlinePages = [
  'truth-or-dare/truth-or-dare-online-page.html',
  'never-have-i-ever/never-have-i-ever-online-page.html',
  'most-likely-to/most-likely-to-online-page.html',
  'paranoia/paranoia-online-page.html',
  'would-you-rather/would-you-rather-online-page.html',
  'imposter/imposter-online-page.html',
  'mafia/mafia-online-page.html'
];

test('game-over actions clearly separate replay from changing settings', () => {
  const template = fs.readFileSync(templatePath, 'utf8');

  assert.match(
    template,
    /id="statistics-replay-game"[^>]*>PLAY AGAIN<\/button>/
  );
  assert.match(
    template,
    /id="statistics-game-settings"[^>]*>CHANGE SETTINGS<\/button>/
  );
  assert.match(
    template,
    /id="statistics-change-game"[^>]*>CHANGE GAME<\/button>/
  );
  assert.match(template, /id="statistics-main-menu"[^>]*>MAIN MENU<\/button>/);
});

function createScoreImpactChange({ id, delta, score = 10, accountId = null }) {
  return {
    id,
    player: {
      identity: {
        computerId: id,
        accountId,
        username: id,
        userIcon: '0000:0100:0200:0300'
      },
      state: { score }
    },
    username: id,
    score,
    previousScore: score - delta,
    delta,
    previousRank: 2,
    currentRank: 1,
    rankDelta: 1
  };
}

function createScoreImpactHarness(currentDeviceId = 'viewer') {
  const dom = new JSDOM('<div id="score-impact-feed"></div>');
  const soundKeys = [];
  const popupCalls = [];

  dom.window.playSoundEffect = (soundKey) => {
    soundKeys.push(soundKey);
    return Promise.resolve();
  };
  dom.window.showOePopup = (row, options) => {
    popupCalls.push({ row, options });
  };

  const context = vm.createContext({
    window: dom.window,
    document: dom.window.document,
    deviceId: currentDeviceId,
    scoreImpactFeed: dom.window.document.querySelector('#score-impact-feed'),
    partyGameScoreImpactTimeouts: new Set(),
    getBlankPartyGameStatisticIconPath: () => '',
    getPlayerIcon: (player) => player?.identity?.userIcon || '',
    requestAnimationFrame: (callback) => callback(),
    setTimeout,
    clearTimeout
  });

  vm.runInContext(fs.readFileSync(scoreImpactPath, 'utf8'), context, {
    filename: 'party-game-statistics/score-impact.js'
  });

  return { context, popupCalls, soundKeys };
}

test('score impact stays silent for the current guest player', () => {
  const { context, popupCalls, soundKeys } = createScoreImpactHarness();

  context.ShowPartyGameScoreImpact([
    createScoreImpactChange({ id: 'other-player', delta: 8, score: 18 }),
    createScoreImpactChange({ id: 'viewer', delta: 3, score: 13 })
  ]);

  assert.deepEqual(soundKeys, []);
  assert.equal(popupCalls.length, 2);
  assert.ok(popupCalls.every(({ options }) => options.sound === false));
});

test('score impact stays silent for the current account player', () => {
  const { context, popupCalls, soundKeys } = createScoreImpactHarness();

  context.ShowPartyGameScoreImpact([
    createScoreImpactChange({
      id: 'viewer',
      delta: -4,
      score: 6,
      accountId: '64f000000000000000000001'
    }),
    createScoreImpactChange({ id: 'other-player', delta: -2, score: 8 })
  ]);

  assert.deepEqual(soundKeys, []);
  assert.equal(popupCalls.length, 2);
  assert.ok(popupCalls.every(({ options }) => options.sound === false));
});

test('score impact stays silent when only other players change', () => {
  const { context, popupCalls, soundKeys } = createScoreImpactHarness();

  context.ShowPartyGameScoreImpact([
    createScoreImpactChange({ id: 'player-one', delta: 5, score: 15 }),
    createScoreImpactChange({ id: 'player-two', delta: -3, score: 7 })
  ]);

  assert.deepEqual(soundKeys, []);
  assert.equal(popupCalls.length, 2);
  assert.ok(popupCalls.every(({ options }) => options.sound === false));
});

test('score impact stays silent even when batching prunes the current player row', () => {
  const { context, popupCalls, soundKeys } = createScoreImpactHarness();
  const changes = [
    createScoreImpactChange({ id: 'player-one', delta: 10, score: 20 }),
    createScoreImpactChange({ id: 'player-two', delta: 9, score: 19 }),
    createScoreImpactChange({ id: 'player-three', delta: 8, score: 18 }),
    createScoreImpactChange({ id: 'player-four', delta: 7, score: 17 }),
    createScoreImpactChange({ id: 'player-five', delta: 6, score: 16 }),
    createScoreImpactChange({ id: 'player-six', delta: 5, score: 15 }),
    createScoreImpactChange({ id: 'viewer', delta: 1, score: 11 })
  ];

  context.ShowPartyGameScoreImpact(changes);

  assert.deepEqual(soundKeys, []);
  assert.equal(popupCalls.length, 4);
  assert.ok(popupCalls.every(({ options }) => options.sound === false));
  assert.equal(
    popupCalls.some(({ row }) => row.querySelector('[data-user-id="viewer"]')),
    false
  );
});

test('party game statistics support modules load before the facade', () => {
  onlinePages.forEach((pageName) => {
    const page = fs.readFileSync(path.join(pageDirectory, pageName), 'utf8');
    const facadeIndex = page.indexOf(
      '/scripts/party-games/gamemode/online/general/party-game-statistics.js'
    );

    assert.ok(facadeIndex > -1, `${pageName} should load the facade`);
    supportScripts.forEach(([scriptPath]) => {
      assert.ok(
        page.indexOf(
          `/scripts/party-games/gamemode/online/general/${scriptPath}`
        ) < facadeIndex,
        `${pageName} should load ${scriptPath} before the facade`
      );
    });
  });
});

test('party game statistics support modules preserve their browser helpers', () => {
  const context = vm.createContext({ window: {} });

  supportScripts.forEach(([scriptPath, functionName]) => {
    vm.runInContext(
      fs.readFileSync(path.join(scriptsDirectory, scriptPath), 'utf8'),
      context,
      { filename: scriptPath }
    );
    assert.equal(typeof context[functionName], 'function');
  });
  assert.equal(typeof context.renderPartyGameXp, 'function');
});

test('game-over tabs separate Opals and XP', () => {
  const dom = new JSDOM(fs.readFileSync(templatePath, 'utf8'));
  const { document } = dom.window;

  assert.equal(
    document.querySelector('#game-over-opals-tab').textContent,
    'OPALS'
  );
  assert.equal(document.querySelector('#game-over-xp-tab').textContent, 'XP');
  assert.ok(document.querySelector('#game-over-opals-panel'));
  assert.ok(document.querySelector('#game-over-xp-panel'));
});

test('XP game-over panel renders the supplied reward data', () => {
  const dom = new JSDOM(fs.readFileSync(templatePath, 'utf8'));
  const { document } = dom.window;
  const context = vm.createContext({
    window: dom.window,
    document,
    currentPartyData: {
      players: [
        {
          identity: {
            computerId: 'player-one',
            accountId: '64f000000000000000000001'
          }
        }
      ]
    },
    deviceId: 'player-one',
    getPlayerId: (player) => player.identity.computerId,
    partyGameXpEmpty: document.querySelector('#game-over-xp-empty'),
    partyGameXpEmptyReason: document.querySelector(
      '#game-over-xp-empty-reason'
    ),
    partyGameXpLevelRow: document.querySelector('#game-over-xp-level-row'),
    partyGameXpCurrentLevel: document.querySelector(
      '#game-over-xp-current-level'
    ),
    partyGameXpLevelUp: document.querySelector('#game-over-xp-level-up'),
    partyGameXpLevelBefore: document.querySelector(
      '#game-over-xp-level-before'
    ),
    partyGameXpLevelAfter: document.querySelector('#game-over-xp-level-after'),
    partyGameXpProgress: document.querySelector('#game-over-xp-progress'),
    partyGameXpProgressText: document.querySelector(
      '#game-over-xp-progress-text'
    ),
    partyGameXpProgressTrack: document.querySelector(
      '#game-over-xp-progress-track'
    ),
    partyGameXpProgressFill: document.querySelector(
      '#game-over-xp-progress-fill'
    ),
    partyGameXpTotalRow: document.querySelector('#game-over-xp-total-row'),
    partyGameXpTotal: document.querySelector('#game-over-xp-total')
  });
  vm.runInContext(fs.readFileSync(rewardsPath, 'utf8'), context, {
    filename: 'party-game-statistics/rewards.js'
  });

  context.renderPartyGameXp({
    eligible: true,
    xp: {
      grantedTotal: 25,
      progression: {
        levelBefore: 1,
        levelAfter: 2,
        levelledUp: true,
        currentLevelXp: 15,
        xpRequiredForNextLevel: 600
      }
    }
  });

  assert.equal(
    document.querySelector('#game-over-xp-current-level').textContent,
    '2'
  );
  assert.equal(document.querySelector('#game-over-xp-level-up').hidden, false);
  assert.equal(
    document.querySelector('#game-over-xp-level-before').textContent,
    '1'
  );
  assert.equal(
    document.querySelector('#game-over-xp-level-after').textContent,
    '2'
  );
  assert.equal(
    document.querySelector('#game-over-xp-progress-text').textContent,
    '15 / 600 XP'
  );
  assert.equal(
    document.querySelector('#game-over-xp-progress-fill').style.width,
    '2.5%'
  );
  assert.equal(
    document
      .querySelector('#game-over-xp-progress-track')
      .getAttribute('aria-valuenow'),
    '15'
  );
  assert.equal(
    document.querySelector('#game-over-xp-total').textContent,
    '25xp'
  );
});

test('XP game-over panel hides level up when the player stays on the same level', () => {
  const dom = new JSDOM(fs.readFileSync(templatePath, 'utf8'));
  const { document } = dom.window;
  const context = vm.createContext({
    window: dom.window,
    document,
    currentPartyData: {
      players: [
        {
          identity: {
            computerId: 'player-one',
            accountId: '64f000000000000000000001'
          }
        }
      ]
    },
    deviceId: 'player-one',
    getPlayerId: (player) => player.identity.computerId,
    partyGameXpEmpty: document.querySelector('#game-over-xp-empty'),
    partyGameXpEmptyReason: document.querySelector(
      '#game-over-xp-empty-reason'
    ),
    partyGameXpLevelRow: document.querySelector('#game-over-xp-level-row'),
    partyGameXpCurrentLevel: document.querySelector(
      '#game-over-xp-current-level'
    ),
    partyGameXpLevelUp: document.querySelector('#game-over-xp-level-up'),
    partyGameXpLevelBefore: document.querySelector(
      '#game-over-xp-level-before'
    ),
    partyGameXpLevelAfter: document.querySelector('#game-over-xp-level-after'),
    partyGameXpProgress: document.querySelector('#game-over-xp-progress'),
    partyGameXpProgressText: document.querySelector(
      '#game-over-xp-progress-text'
    ),
    partyGameXpProgressTrack: document.querySelector(
      '#game-over-xp-progress-track'
    ),
    partyGameXpProgressFill: document.querySelector(
      '#game-over-xp-progress-fill'
    ),
    partyGameXpTotalRow: document.querySelector('#game-over-xp-total-row'),
    partyGameXpTotal: document.querySelector('#game-over-xp-total')
  });
  vm.runInContext(fs.readFileSync(rewardsPath, 'utf8'), context, {
    filename: 'party-game-statistics/rewards.js'
  });

  context.renderPartyGameXp({
    eligible: true,
    xp: {
      grantedTotal: 25,
      progression: {
        levelBefore: 2,
        levelAfter: 2,
        levelledUp: false,
        currentLevelXp: 215,
        xpRequiredForNextLevel: 600
      }
    }
  });

  assert.equal(document.querySelector('#game-over-xp-level-up').hidden, true);
  assert.equal(
    document.querySelector('#game-over-xp-level-up').style.display,
    'none'
  );
});

test('party game statistics facade keeps public lifecycle entry points', () => {
  const facade = fs.readFileSync(facadePath, 'utf8');

  [
    'SetPartyGameStatistics',
    'UpdatePartyGameStatistics',
    'SetPartyGameStatisticsGameOver'
  ].forEach((functionName) => {
    assert.match(facade, new RegExp(`function ${functionName}\\(`));
  });
  assert.doesNotMatch(facade, /function CreatePartyGameStatisticsButton\(/);
  assert.match(
    facade,
    /RemoveUserFromParty\(deviceId, \{ exitIntent: 'main-menu' \}\)/
  );
});
