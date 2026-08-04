const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const paranoiaDirectory = path.join(
  __dirname,
  '../../public/scripts/party-games/gamemode/online/paranoia'
);
const supportScripts = [
  'paranoia-online-instructions/phase-tools.js',
  'paranoia-online-instructions/question-flow.js',
  'paranoia-online-instructions/punishment-flow.js',
  'paranoia-online-instructions/round-actions.js'
];
const publicHandlers = [
  'NextQuestion',
  'DisplayPrivateCard',
  'DisplayPunishmentToUser',
  'PunishmentOffer',
  'UserHasPassed',
  'HasUserDonePunishment',
  'ChosePunishment',
  'UserSelectedForPunishment',
  'ChoosingPunishment',
  'DisplayDualStackCard',
  'ResetParanoiaQuestion',
  'PartySkip'
];

test('Paranoia setup loads instruction modules before the compatibility facade', () => {
  const setup = fs.readFileSync(
    path.join(paranoiaDirectory, 'paranoia-online-setup.js'),
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

test('Paranoia instruction modules preserve their public handler contract', () => {
  const context = vm.createContext({ window: {} });

  supportScripts.forEach((scriptPath) => {
    vm.runInContext(
      fs.readFileSync(path.join(paranoiaDirectory, scriptPath), 'utf8'),
      context,
      { filename: scriptPath }
    );
  });

  publicHandlers.forEach((handler) => {
    context.window[handler] = context[handler];
  });

  vm.runInContext(
    fs.readFileSync(
      path.join(paranoiaDirectory, 'paranoia-online-instructions.js'),
      'utf8'
    ),
    context,
    { filename: 'paranoia-online-instructions.js' }
  );

  publicHandlers.forEach((handler) => {
    assert.equal(
      typeof context[handler],
      'function',
      `${handler} should remain public`
    );
  });
});

test('Paranoia timer warning follows local action ownership', () => {
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
        paranoiaDirectory,
        'paranoia-online-instructions/phase-tools.js'
      ),
      'utf8'
    ),
    context,
    { filename: 'phase-tools.js' }
  );

  assert.equal(
    context.syncParanoiaTimerWarning(
      context.currentPartyData.state,
      true,
      'select-target'
    ),
    true
  );
  assert.equal(
    context.syncParanoiaTimerWarning(
      context.currentPartyData.state,
      false,
      'select-target'
    ),
    true
  );
  assert.equal(
    context.syncParanoiaTimerWarning(
      context.currentPartyData.state,
      true,
      'confirm-punishment'
    ),
    true
  );

  assert.equal(timerCalls.length, 3);
  assert.equal(timerCalls[0].action, 'start');
  assert.equal(
    timerCalls[0].options.timerId,
    'ABC-123:paranoia-select-target:123456'
  );
  assert.equal(timerCalls[1].action, 'stop');
  assert.equal(timerCalls[2].action, 'start');
  assert.equal(
    timerCalls[2].options.timerId,
    'ABC-123:paranoia-confirm-punishment:123456'
  );
});

test('Paranoia flow sounds follow deduplicated state transitions', async () => {
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
        paranoiaDirectory,
        'paranoia-online-instructions/phase-tools.js'
      ),
      'utf8'
    ),
    context,
    { filename: 'phase-tools.js' }
  );

  await context.syncParanoiaFlowSounds({}, 'DISPLAY_PRIVATE_CARD:READING_CARD');
  await context.syncParanoiaFlowSounds(
    {},
    'DISPLAY_PRIVATE_CARD:CHOOSE_PLAYER'
  );
  assert.deepEqual(flowSounds, [], 'the initial state should be silent');

  await context.syncParanoiaFlowSounds(
    { phase: 'paranoia-choose-punishment' },
    'DISPLAY_PRIVATE_CARD:CHOOSE_PLAYER'
  );
  await context.syncParanoiaFlowSounds(
    {
      phase: 'paranoia-show-punishment',
      phaseData: {
        targetId: 'player-2',
        punishmentType: 'DRINK_WHEEL'
      }
    },
    'DISPLAY_PUNISHMENT_TO_USER'
  );
  await context.syncParanoiaFlowSounds(
    {
      phase: 'paranoia-show-punishment',
      phaseData: {
        targetId: 'player-2',
        punishmentType: 'TAKE_2_SIPS'
      }
    },
    'DISPLAY_PUNISHMENT_TO_USER'
  );
  await context.syncParanoiaFlowSounds(
    {},
    'USER_HAS_PASSED:USER_PASSED_PUNISHMENT'
  );
  await context.syncParanoiaFlowSounds(
    { phase: 'paranoia-show-punishment' },
    'DISPLAY_DUAL_STACK_CARD'
  );

  context.currentPartyData.deck.currentCardIndex = 1;
  await context.syncParanoiaFlowSounds({}, 'DISPLAY_PRIVATE_CARD:READING_CARD');
  await context.syncParanoiaFlowSounds({ phase: 'game-over' }, 'GAME_OVER');

  assert.deepEqual(flowSounds, [
    {
      eventName: 'punishmentStart',
      eventId: 'ABC-123:paranoia:punishment:0'
    },
    {
      eventName: 'punishmentReveal',
      eventId: 'ABC-123:paranoia:punishment-reveal:0:player-2:take_2_sips'
    },
    {
      eventName: 'playerPassed',
      eventId: 'ABC-123:paranoia:player-passed:0'
    },
    {
      eventName: 'resultsReveal',
      eventId: 'ABC-123:paranoia:reveal:0'
    },
    {
      eventName: 'roundStart',
      eventId: 'ABC-123:paranoia:round:1'
    },
    {
      eventName: 'gameComplete',
      eventId: 'ABC-123:paranoia:game-complete:1'
    }
  ]);
});

test('Paranoia action lifecycle manages timer warnings', () => {
  const questionFlow = fs.readFileSync(
    path.join(
      paranoiaDirectory,
      'paranoia-online-instructions/question-flow.js'
    ),
    'utf8'
  );
  const punishmentFlow = fs.readFileSync(
    path.join(
      paranoiaDirectory,
      'paranoia-online-instructions/punishment-flow.js'
    ),
    'utf8'
  );
  const eventListeners = fs.readFileSync(
    path.join(paranoiaDirectory, 'paranoia-online-event-listeners.js'),
    'utf8'
  );
  const logic = fs.readFileSync(
    path.join(paranoiaDirectory, 'paranoia-online-logic.js'),
    'utf8'
  );

  assert.match(
    questionFlow,
    /syncParanoiaTimerWarning\([\s\S]*?'select-target'\s*\)/
  );
  assert.match(questionFlow, /syncParanoiaTimerWarning\([\s\S]*?'reveal'\s*\)/);
  assert.match(
    punishmentFlow,
    /syncParanoiaTimerWarning\([\s\S]*?'choose-punishment'\s*\)/
  );
  assert.match(
    punishmentFlow,
    /syncParanoiaTimerWarning\([\s\S]*?'perform-punishment'\s*\)/
  );
  assert.match(
    punishmentFlow,
    /syncParanoiaTimerWarning\([\s\S]*?'confirm-punishment'\s*\)/
  );
  assert.ok(
    (eventListeners.match(/stopParanoiaTimerWarning\(\)/g)?.length || 0) >= 7,
    'target, reveal, punishment, pass, completion, and vote submissions should stop warnings'
  );
  assert.match(logic, /phaseOwnsActionTimer/);
  assert.match(logic, /instructionOwnsActionTimer/);
});
