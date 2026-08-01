const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const neverHaveIEverDirectory = path.join(
  __dirname,
  '../../public/scripts/party-games/gamemode/online/never-have-i-ever'
);
const supportScripts = [
  'never-have-i-ever-online-instructions/phase-tools.js',
  'never-have-i-ever-online-instructions/private-card.js',
  'never-have-i-ever-online-instructions/vote-flow.js',
  'never-have-i-ever-online-instructions/punishment-flow.js',
  'never-have-i-ever-online-instructions/round-actions.js'
];
const publicHandlers = [
  'DisplayPrivateCard',
  'DisplayVoteResults',
  'ChosePunishment',
  'WaitingForPlayer',
  'DisplayPunishmentToUser',
  'PunishmentOffer',
  'UserSelectedForPunishment',
  'AnswerToUserDonePunishment',
  'GetVoteResults',
  'PartySkip'
];

test('Never Have I Ever setup loads instruction modules before the compatibility facade', () => {
  const setup = fs.readFileSync(
    path.join(neverHaveIEverDirectory, 'never-have-i-ever-online-setup.js'),
    'utf8'
  );
  let previousIndex = -1;

  supportScripts.forEach((scriptPath) => {
    const index = setup.indexOf(scriptPath);
    assert.ok(index > previousIndex, `${scriptPath} should load in dependency order`);
    previousIndex = index;
  });

  assert.ok(
    setup.indexOf('`${instructionsBasePath}/${cardContainerGamemode}-online-instructions.js`') > previousIndex,
    'the facade should load after every support module'
  );
});

test('Never Have I Ever instruction modules preserve their public handler contract', () => {
  const context = vm.createContext({ window: {} });

  supportScripts.forEach((scriptPath) => {
    vm.runInContext(
      fs.readFileSync(path.join(neverHaveIEverDirectory, scriptPath), 'utf8'),
      context,
      { filename: scriptPath }
    );
  });

  publicHandlers.forEach((handler) => {
    context.window[handler] = context[handler];
  });

  vm.runInContext(
    fs.readFileSync(path.join(neverHaveIEverDirectory, 'never-have-i-ever-online-instructions.js'), 'utf8'),
    context,
    { filename: 'never-have-i-ever-online-instructions.js' }
  );

  publicHandlers.forEach((handler) => {
    assert.equal(typeof context[handler], 'function', `${handler} should remain public`);
  });
});

test('Never Have I Ever vote timer warning follows local confirmation state', () => {
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
        neverHaveIEverDirectory,
        'never-have-i-ever-online-instructions/phase-tools.js'
      ),
      'utf8'
    ),
    context,
    { filename: 'phase-tools.js' }
  );

  assert.equal(
    context.syncNeverHaveIEverVoteTimerWarning(
      context.currentPartyData.state,
      { hasConfirmed: false }
    ),
    true
  );
  assert.equal(
    context.syncNeverHaveIEverVoteTimerWarning(
      context.currentPartyData.state,
      { hasConfirmed: true }
    ),
    true
  );
  assert.equal(timerCalls.length, 2);
  assert.equal(timerCalls[0].action, 'start');
  assert.equal(timerCalls[0].options.deadline, 123456);
  assert.equal(
    timerCalls[0].options.timerId,
    'ABC-123:never-have-i-ever-vote:123456'
  );
  assert.equal(timerCalls[1].action, 'stop');
});

test('Never Have I Ever flow sounds follow deduplicated state transitions', async () => {
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
        neverHaveIEverDirectory,
        'never-have-i-ever-online-instructions/phase-tools.js'
      ),
      'utf8'
    ),
    context,
    { filename: 'phase-tools.js' }
  );

  await context.syncNeverHaveIEverFlowSounds({}, 'DISPLAY_PRIVATE_CARD');
  await context.syncNeverHaveIEverFlowSounds({}, 'DISPLAY_PRIVATE_CARD');
  assert.deepEqual(flowSounds, [], 'the initial state should be silent');

  await context.syncNeverHaveIEverFlowSounds({}, 'DISPLAY_VOTE_RESULTS');
  await context.syncNeverHaveIEverFlowSounds(
    { phase: 'never-have-i-ever-spin-odd-man-out' },
    'DISPLAY_VOTE_RESULTS'
  );
  await context.syncNeverHaveIEverFlowSounds(
    {
      phase: 'never-have-i-ever-show-punishment',
      phaseData: {
        targetIds: ['player-1'],
        punishmentType: 'DRINK_WHEEL'
      }
    },
    'DISPLAY_VOTE_RESULTS'
  );
  await context.syncNeverHaveIEverFlowSounds(
    {
      phase: 'never-have-i-ever-show-punishment',
      phaseData: {
        targetIds: ['player-1'],
        punishmentType: 'TAKE_A_SIP'
      }
    },
    'DISPLAY_VOTE_RESULTS'
  );

  context.currentPartyData.deck.currentCardIndex = 1;
  await context.syncNeverHaveIEverFlowSounds({}, 'DISPLAY_PRIVATE_CARD');
  await context.syncNeverHaveIEverFlowSounds(
    { phase: 'game-over' },
    'GAME_OVER'
  );

  assert.deepEqual(flowSounds, [
    {
      eventName: 'resultsReveal',
      eventId: 'ABC-123:never-have-i-ever:results:0'
    },
    {
      eventName: 'punishmentStart',
      eventId: 'ABC-123:never-have-i-ever:punishment:0'
    },
    {
      eventName: 'punishmentReveal',
      eventId:
        'ABC-123:never-have-i-ever:punishment-reveal:0:player-1:take_a_sip'
    },
    {
      eventName: 'roundStart',
      eventId: 'ABC-123:never-have-i-ever:round:1'
    },
    {
      eventName: 'gameComplete',
      eventId: 'ABC-123:never-have-i-ever:game-complete:1'
    }
  ]);
});

test('Never Have I Ever voting lifecycle starts and stops timer warnings', () => {
  const privateCard = fs.readFileSync(
    path.join(
      neverHaveIEverDirectory,
      'never-have-i-ever-online-instructions/private-card.js'
    ),
    'utf8'
  );
  const voteFlow = fs.readFileSync(
    path.join(
      neverHaveIEverDirectory,
      'never-have-i-ever-online-instructions/vote-flow.js'
    ),
    'utf8'
  );
  const setup = fs.readFileSync(
    path.join(neverHaveIEverDirectory, 'never-have-i-ever-online-setup.js'),
    'utf8'
  );
  const logic = fs.readFileSync(
    path.join(neverHaveIEverDirectory, 'never-have-i-ever-online-logic.js'),
    'utf8'
  );

  assert.match(privateCard, /syncNeverHaveIEverVoteTimerWarning\(state, \{ hasConfirmed \}\)/);
  assert.match(voteFlow, /stopNeverHaveIEverVoteTimerWarning\(\)/);
  assert.equal(
    setup.match(/stopNeverHaveIEverVoteTimerWarning\(\)/g)?.length,
    2,
    'both vote buttons should stop the warning after submission'
  );
  assert.match(
    logic,
    /if \(!String\(instructions \|\| ''\)\.includes\("DISPLAY_PRIVATE_CARD"\)\) \{\s+stopNeverHaveIEverVoteTimerWarning\(\)/
  );
});
