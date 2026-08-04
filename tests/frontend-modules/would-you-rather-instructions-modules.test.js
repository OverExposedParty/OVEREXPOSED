const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const wouldYouRatherDirectory = path.join(
  __dirname,
  '../../public/scripts/party-games/gamemode/online/would-you-rather'
);
const supportScripts = [
  'would-you-rather-online-instructions/phase-tools.js',
  'would-you-rather-online-instructions/round-actions.js',
  'would-you-rather-online-instructions/private-card.js',
  'would-you-rather-online-instructions/vote-flow.js',
  'would-you-rather-online-instructions/punishment-flow.js'
];
const publicHandlers = [
  'DisplayPrivateCard',
  'DisplayVoteResults',
  'WaitingForPlayer',
  'DisplayPunishmentToUser',
  'PunishmentOffer',
  'ChosePunishment',
  'UserSelectedForPunishment',
  'AnswerToUserDonePunishment',
  'GetVoteResults',
  'PartySkip',
  'SplitQuestion'
];

test('Would You Rather setup loads instruction modules before the compatibility facade', () => {
  const setup = fs.readFileSync(
    path.join(wouldYouRatherDirectory, 'would-you-rather-online-setup.js'),
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

test('Would You Rather instruction modules preserve their public handler contract', () => {
  const context = vm.createContext({ window: {} });

  supportScripts.forEach((scriptPath) => {
    vm.runInContext(
      fs.readFileSync(path.join(wouldYouRatherDirectory, scriptPath), 'utf8'),
      context,
      { filename: scriptPath }
    );
  });

  publicHandlers.forEach((handler) => {
    context.window[handler] = context[handler];
  });

  vm.runInContext(
    fs.readFileSync(
      path.join(
        wouldYouRatherDirectory,
        'would-you-rather-online-instructions.js'
      ),
      'utf8'
    ),
    context,
    { filename: 'would-you-rather-online-instructions.js' }
  );

  publicHandlers.forEach((handler) => {
    assert.equal(
      typeof context[handler],
      'function',
      `${handler} should remain public`
    );
  });
});

test('Would You Rather vote timer warning follows local confirmation state', () => {
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
        wouldYouRatherDirectory,
        'would-you-rather-online-instructions/phase-tools.js'
      ),
      'utf8'
    ),
    context,
    { filename: 'phase-tools.js' }
  );

  assert.equal(
    context.syncWouldYouRatherVoteTimerWarning(context.currentPartyData.state, {
      hasConfirmed: false
    }),
    true
  );
  assert.equal(
    context.syncWouldYouRatherVoteTimerWarning(context.currentPartyData.state, {
      hasConfirmed: true
    }),
    true
  );
  assert.equal(timerCalls.length, 2);
  assert.equal(timerCalls[0].action, 'start');
  assert.equal(timerCalls[0].options.deadline, 123456);
  assert.equal(
    timerCalls[0].options.timerId,
    'ABC-123:would-you-rather-vote:123456'
  );
  assert.equal(timerCalls[1].action, 'stop');
});

test('Would You Rather flow sounds follow deduplicated state transitions', async () => {
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
        wouldYouRatherDirectory,
        'would-you-rather-online-instructions/phase-tools.js'
      ),
      'utf8'
    ),
    context,
    { filename: 'phase-tools.js' }
  );

  await context.syncWouldYouRatherFlowSounds({}, 'DISPLAY_PRIVATE_CARD');
  await context.syncWouldYouRatherFlowSounds({}, 'DISPLAY_PRIVATE_CARD');
  assert.deepEqual(flowSounds, [], 'the initial state should be silent');

  await context.syncWouldYouRatherFlowSounds({}, 'DISPLAY_VOTE_RESULTS');
  await context.syncWouldYouRatherFlowSounds(
    { phase: 'would-you-rather-spin-odd-man-out' },
    'DISPLAY_VOTE_RESULTS'
  );
  await context.syncWouldYouRatherFlowSounds(
    {
      phase: 'would-you-rather-show-punishment',
      phaseData: {
        targetIds: ['player-1'],
        punishmentType: 'DRINK_WHEEL'
      }
    },
    'DISPLAY_VOTE_RESULTS'
  );
  await context.syncWouldYouRatherFlowSounds(
    {
      phase: 'would-you-rather-show-punishment',
      phaseData: {
        targetIds: ['player-1'],
        punishmentType: 'TAKE_A_SIP'
      }
    },
    'DISPLAY_VOTE_RESULTS'
  );

  context.currentPartyData.deck.currentCardIndex = 1;
  await context.syncWouldYouRatherFlowSounds({}, 'DISPLAY_PRIVATE_CARD');
  await context.syncWouldYouRatherFlowSounds(
    { phase: 'game-over' },
    'GAME_OVER'
  );

  assert.deepEqual(flowSounds, [
    {
      eventName: 'resultsReveal',
      eventId: 'ABC-123:would-you-rather:results:0'
    },
    {
      eventName: 'punishmentStart',
      eventId: 'ABC-123:would-you-rather:punishment:0'
    },
    {
      eventName: 'punishmentReveal',
      eventId:
        'ABC-123:would-you-rather:punishment-reveal:0:player-1:take_a_sip'
    },
    {
      eventName: 'roundStart',
      eventId: 'ABC-123:would-you-rather:round:1'
    },
    {
      eventName: 'gameComplete',
      eventId: 'ABC-123:would-you-rather:game-complete:1'
    }
  ]);
});

test('Would You Rather voting lifecycle starts and stops timer warnings', () => {
  const privateCard = fs.readFileSync(
    path.join(
      wouldYouRatherDirectory,
      'would-you-rather-online-instructions/private-card.js'
    ),
    'utf8'
  );
  const voteFlow = fs.readFileSync(
    path.join(
      wouldYouRatherDirectory,
      'would-you-rather-online-instructions/vote-flow.js'
    ),
    'utf8'
  );
  const setup = fs.readFileSync(
    path.join(wouldYouRatherDirectory, 'would-you-rather-online-setup.js'),
    'utf8'
  );
  const logic = fs.readFileSync(
    path.join(wouldYouRatherDirectory, 'would-you-rather-online-logic.js'),
    'utf8'
  );

  assert.match(
    privateCard,
    /syncWouldYouRatherVoteTimerWarning\(state, myState\)/
  );
  assert.match(voteFlow, /stopWouldYouRatherVoteTimerWarning\(\)/);
  assert.equal(
    setup.match(/stopWouldYouRatherVoteTimerWarning\(\)/g)?.length,
    2,
    'both vote buttons should stop the warning after submission'
  );
  assert.match(
    logic,
    /if \(!instructions\.includes\("DISPLAY_PRIVATE_CARD"\)\) \{\s+stopWouldYouRatherVoteTimerWarning\(\)/
  );
});
