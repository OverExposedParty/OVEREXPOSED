const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const mostLikelyToDirectory = path.join(
  __dirname,
  '../../public/scripts/party-games/gamemode/online/most-likely-to'
);
const supportScripts = [
  'most-likely-to-online-instructions/phase-tools.js',
  'most-likely-to-online-instructions/vote-flow.js',
  'most-likely-to-online-instructions/punishment-flow.js',
  'most-likely-to-online-instructions/round-actions.js'
];
const publicHandlers = [
  'DisplayPrivateCard',
  'DisplayVoteResults',
  'TieBreakerPunishmentOffer',
  'WaitingForPlayer',
  'DisplayPunishmentToUser',
  'ChoosingPunishment',
  'ChosePunishment',
  'PartySkip'
];

test('Most Likely To setup loads instruction modules before the compatibility facade', () => {
  const setup = fs.readFileSync(
    path.join(mostLikelyToDirectory, 'most-likely-to-online-setup.js'),
    'utf8'
  );
  let previousIndex = -1;

  supportScripts.forEach((scriptPath) => {
    const index = setup.indexOf(scriptPath);
    assert.ok(
      index > previousIndex,
      `${scriptPath} should load in dependency order`
    );
    previousIndex = index;
  });

  assert.ok(
    setup.indexOf(
      '`${instructionsBasePath}/${cardContainerGamemode}-online-instructions.js`'
    ) > previousIndex,
    'the facade should load after every support module'
  );
});

test('Most Likely To instruction modules preserve their public handler contract', () => {
  const context = vm.createContext({ window: {} });

  supportScripts.forEach((scriptPath) => {
    vm.runInContext(
      fs.readFileSync(path.join(mostLikelyToDirectory, scriptPath), 'utf8'),
      context,
      { filename: scriptPath }
    );
  });

  publicHandlers.forEach((handler) => {
    context.window[handler] = context[handler];
  });

  vm.runInContext(
    fs.readFileSync(
      path.join(mostLikelyToDirectory, 'most-likely-to-online-instructions.js'),
      'utf8'
    ),
    context,
    { filename: 'most-likely-to-online-instructions.js' }
  );

  publicHandlers.forEach((handler) => {
    assert.equal(
      typeof context[handler],
      'function',
      `${handler} should remain public`
    );
  });
});

test('Most Likely To timer warning follows local action ownership', () => {
  const timerCalls = [];
  const context = vm.createContext({
    currentPartyData: {
      partyId: 'ABC-123',
      state: { timer: 123456 }
    },
    getPartyState(party) {
      return party.state;
    },
    partyCode: 'ABC-123',
    window: {
      PartyGameSounds: {
        startTimerWarning(options) {
          timerCalls.push({ action: 'start', options });
          return true;
        },
        stopTimerWarning() {
          timerCalls.push({ action: 'stop' });
          return true;
        }
      }
    }
  });

  vm.runInContext(
    fs.readFileSync(
      path.join(
        mostLikelyToDirectory,
        'most-likely-to-online-instructions/phase-tools.js'
      ),
      'utf8'
    ),
    context,
    { filename: 'phase-tools.js' }
  );

  assert.equal(
    context.syncMostLikelyToTimerWarning(
      context.currentPartyData.state,
      true,
      'vote'
    ),
    true
  );
  assert.equal(
    context.syncMostLikelyToTimerWarning(
      context.currentPartyData.state,
      false,
      'vote'
    ),
    true
  );
  assert.equal(
    context.syncMostLikelyToTimerWarning(
      context.currentPartyData.state,
      true,
      'tiebreaker'
    ),
    true
  );

  assert.equal(timerCalls.length, 3);
  assert.equal(timerCalls[0].action, 'start');
  assert.equal(
    timerCalls[0].options.timerId,
    'ABC-123:most-likely-to-vote:123456'
  );
  assert.equal(timerCalls[1].action, 'stop');
  assert.equal(timerCalls[2].action, 'start');
  assert.equal(
    timerCalls[2].options.timerId,
    'ABC-123:most-likely-to-tiebreaker:123456'
  );
});

test('Most Likely To flow sounds follow deduplicated state transitions', async () => {
  const flowSounds = [];
  const context = vm.createContext({
    currentPartyData: {
      partyId: 'ABC-123',
      deck: { currentCardIndex: 0 },
      state: {}
    },
    partyCode: 'ABC-123',
    window: {
      PartyGameSounds: {
        playOnce(eventName, options) {
          flowSounds.push({ eventName, eventId: options.eventId });
          return Promise.resolve();
        }
      }
    }
  });

  vm.runInContext(
    fs.readFileSync(
      path.join(
        mostLikelyToDirectory,
        'most-likely-to-online-instructions/phase-tools.js'
      ),
      'utf8'
    ),
    context,
    { filename: 'phase-tools.js' }
  );

  await context.syncMostLikelyToFlowSounds({}, 'DISPLAY_PRIVATE_CARD');
  await context.syncMostLikelyToFlowSounds({}, 'DISPLAY_PRIVATE_CARD');
  assert.deepEqual(flowSounds, [], 'the initial state should be silent');

  await context.syncMostLikelyToFlowSounds({}, 'DISPLAY_VOTE_RESULTS');
  await context.syncMostLikelyToFlowSounds(
    { phase: 'most-likely-to-tiebreaker' },
    'DISPLAY_VOTE_RESULTS'
  );
  await context.syncMostLikelyToFlowSounds(
    { phase: 'most-likely-to-choose-punishment' },
    'DISPLAY_VOTE_RESULTS'
  );
  await context.syncMostLikelyToFlowSounds(
    {
      phase: 'most-likely-to-show-punishment',
      phaseData: {
        targetId: 'player-2',
        punishmentType: 'MOST_LIKELY_TO_DRINK_WHEEL'
      }
    },
    'DISPLAY_VOTE_RESULTS'
  );
  await context.syncMostLikelyToFlowSounds(
    {
      phase: 'most-likely-to-show-punishment',
      phaseData: {
        targetId: 'player-2',
        punishmentType: 'TAKE_3_SIPS'
      }
    },
    'DISPLAY_VOTE_RESULTS'
  );

  context.currentPartyData.deck.currentCardIndex = 1;
  await context.syncMostLikelyToFlowSounds({}, 'DISPLAY_PRIVATE_CARD');
  await context.syncMostLikelyToFlowSounds({ phase: 'game-over' }, 'GAME_OVER');

  assert.deepEqual(flowSounds, [
    {
      eventName: 'resultsReveal',
      eventId: 'ABC-123:most-likely-to:results:0'
    },
    {
      eventName: 'punishmentStart',
      eventId: 'ABC-123:most-likely-to:punishment:0'
    },
    {
      eventName: 'punishmentReveal',
      eventId: 'ABC-123:most-likely-to:punishment-reveal:0:player-2:take_3_sips'
    },
    {
      eventName: 'roundStart',
      eventId: 'ABC-123:most-likely-to:round:1'
    },
    {
      eventName: 'gameComplete',
      eventId: 'ABC-123:most-likely-to:game-complete:1'
    }
  ]);
});

test('Most Likely To action lifecycle manages timer warnings', () => {
  const voteFlow = fs.readFileSync(
    path.join(
      mostLikelyToDirectory,
      'most-likely-to-online-instructions/vote-flow.js'
    ),
    'utf8'
  );
  const punishmentFlow = fs.readFileSync(
    path.join(
      mostLikelyToDirectory,
      'most-likely-to-online-instructions/punishment-flow.js'
    ),
    'utf8'
  );
  const setup = fs.readFileSync(
    path.join(mostLikelyToDirectory, 'most-likely-to-online-setup.js'),
    'utf8'
  );
  const logic = fs.readFileSync(
    path.join(mostLikelyToDirectory, 'most-likely-to-online-logic.js'),
    'utf8'
  );

  assert.match(voteFlow, /syncMostLikelyToTimerWarning\([\s\S]*?'vote'\s*\)/);
  assert.match(
    voteFlow,
    /syncMostLikelyToTimerWarning\([\s\S]*?'tiebreaker'\s*\)/
  );
  assert.match(
    punishmentFlow,
    /syncMostLikelyToTimerWarning\([\s\S]*?'choose-punishment'\s*\)/
  );
  assert.ok(
    (setup.match(/stopMostLikelyToTimerWarning\(\)/g)?.length || 0) >= 4,
    'vote, tiebreaker, pass, and punishment submissions should stop warnings'
  );
  assert.match(logic, /phaseOwnsActionTimer/);
});
