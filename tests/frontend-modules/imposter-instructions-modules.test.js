const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const imposterDirectory = path.join(
  __dirname,
  '../../public/scripts/party-games/gamemode/online/imposter'
);
const supportScripts = [
  'imposter-online-instructions/phase-tools.js',
  'imposter-online-instructions/answer-flow.js',
  'imposter-online-instructions/vote-flow.js',
  'imposter-online-instructions/punishment-flow.js',
  'imposter-online-instructions/round-actions.js'
];
const publicHandlers = [
  'DisplayStartTimer',
  'renderCurrentImposterInstructionFromState',
  'DisplayAnswerContainer',
  'DisplayPrivateCard',
  'DisplayVoteResults',
  'DisplayVoteResultsPartTwo',
  'DisplayPunishmentToUser',
  'ResetImposterQuestion',
  'PartySkip'
];

test('Imposter setup loads instruction modules before the compatibility facade', () => {
  const setup = fs.readFileSync(
    path.join(imposterDirectory, 'imposter-online-setup.js'),
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

test('Imposter instruction modules preserve their public handler contract', () => {
  const context = vm.createContext({ window: {} });

  supportScripts.forEach((scriptPath) => {
    vm.runInContext(
      fs.readFileSync(path.join(imposterDirectory, scriptPath), 'utf8'),
      context,
      { filename: scriptPath }
    );
  });

  publicHandlers.forEach((handler) => {
    context.window[handler] = context[handler];
  });

  vm.runInContext(
    fs.readFileSync(
      path.join(imposterDirectory, 'imposter-online-instructions.js'),
      'utf8'
    ),
    context,
    { filename: 'imposter-online-instructions.js' }
  );

  publicHandlers.forEach((handler) => {
    assert.equal(
      typeof context[handler],
      'function',
      `${handler} should remain public`
    );
  });
});

test('Imposter round resets are submitted only by the authoritative host', async () => {
  let actionCalls = 0;
  let clearCalls = 0;
  let isHost = false;
  const context = vm.createContext({
    ClearIcons() {
      clearCalls += 1;
    },
    currentPartyData: {},
    getTimeLimit: () => 120,
    isAuthoritativePartyHost: () => isHost,
    performOnlinePartyAction: async () => {
      actionCalls += 1;
      return { partyId: 'ABC-123' };
    },
    resetGamemodeInstruction: 'DISPLAY_START_TIMER',
    stopImposterTimerWarning() {},
    window: {}
  });
  const roundActionsPath = path.join(
    imposterDirectory,
    'imposter-online-instructions/round-actions.js'
  );

  vm.runInContext(fs.readFileSync(roundActionsPath, 'utf8'), context, {
    filename: roundActionsPath
  });

  assert.equal(await context.ResetImposterQuestion(), null);
  assert.equal(actionCalls, 0);
  assert.equal(clearCalls, 0);

  isHost = true;
  const updatedParty = await context.ResetImposterQuestion();

  assert.equal(actionCalls, 1);
  assert.equal(clearCalls, 1);
  assert.equal(updatedParty.partyId, 'ABC-123');
});

test('Imposter timer warning follows local action ownership', () => {
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
        imposterDirectory,
        'imposter-online-instructions/phase-tools.js'
      ),
      'utf8'
    ),
    context,
    { filename: 'phase-tools.js' }
  );

  assert.equal(
    context.syncImposterTimerWarning(
      context.currentPartyData.state,
      true,
      'confirm-prompt'
    ),
    true
  );
  assert.equal(
    context.syncImposterTimerWarning(
      context.currentPartyData.state,
      false,
      'confirm-prompt'
    ),
    true
  );
  assert.equal(
    context.syncImposterTimerWarning(
      context.currentPartyData.state,
      true,
      'answer-turn'
    ),
    true
  );

  assert.equal(timerCalls.length, 3);
  assert.equal(timerCalls[0].action, 'start');
  assert.equal(
    timerCalls[0].options.timerId,
    'ABC-123:imposter-confirm-prompt:123456'
  );
  assert.equal(timerCalls[1].action, 'stop');
  assert.equal(timerCalls[2].action, 'start');
  assert.equal(
    timerCalls[2].options.timerId,
    'ABC-123:imposter-answer-turn:123456'
  );
});

test('Imposter flow sounds follow local and deduplicated state transitions', async () => {
  const flowSounds = [];
  const context = vm.createContext({
    currentPartyData: {
      partyId: 'ABC-123',
      deck: { currentCardIndex: 0 },
      players: [{ id: 'player-one' }, { id: 'player-two' }],
      state: {}
    },
    deviceId: 'player-one',
    getPlayerId(player) {
      return player?.id ?? null;
    },
    getHighestVoteValue() {
      return 0;
    },
    GetHighestVoted() {
      return [];
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
        imposterDirectory,
        'imposter-online-instructions/phase-tools.js'
      ),
      'utf8'
    ),
    context,
    { filename: 'phase-tools.js' }
  );

  await context.syncImposterFlowSounds({}, 'DISPLAY_START_TIMER');
  await context.syncImposterFlowSounds({}, 'DISPLAY_START_TIMER');
  assert.deepEqual(flowSounds, [], 'the initial state should be silent');

  await context.syncImposterFlowSounds(
    { speakingRound: 0, speakingPlayerTurn: 0 },
    'DISPLAY_ANSWER_CONTAINER'
  );
  await context.syncImposterFlowSounds(
    { speakingRound: 0, speakingPlayerTurn: 0 },
    'DISPLAY_ANSWER_CONTAINER'
  );
  await context.syncImposterFlowSounds(
    { speakingRound: 0, speakingPlayerTurn: 1 },
    'DISPLAY_ANSWER_CONTAINER'
  );
  await context.syncImposterFlowSounds({}, 'DISPLAY_VOTE_RESULTS');
  await context.syncImposterFlowSounds({}, 'DISPLAY_VOTE_RESULTS_PART_TWO');
  await context.syncImposterFlowSounds(
    { phase: 'imposter-choose-punishment' },
    'DISPLAY_VOTE_RESULTS_PART_TWO'
  );
  await context.syncImposterFlowSounds(
    {
      phase: 'imposter-show-punishment',
      phaseData: {
        targetId: 'player-2',
        punishmentType: 'DRINK_WHEEL'
      }
    },
    'DISPLAY_VOTE_RESULTS_PART_TWO'
  );
  await context.syncImposterFlowSounds(
    {
      phase: 'imposter-show-punishment',
      phaseData: {
        targetId: 'player-2',
        punishmentType: 'TAKE_A_SHOT'
      }
    },
    'DISPLAY_VOTE_RESULTS_PART_TWO'
  );

  context.currentPartyData.deck.currentCardIndex = 1;
  await context.syncImposterFlowSounds({}, 'DISPLAY_START_TIMER');
  await context.syncImposterFlowSounds({ phase: 'game-over' }, 'GAME_OVER');

  assert.deepEqual(flowSounds, [
    {
      eventName: 'yourTurn',
      eventId: 'ABC-123:imposter:speaking-turn:0:0:0'
    },
    {
      eventName: 'resultsReveal',
      eventId: 'ABC-123:imposter:results:0'
    },
    {
      eventName: 'imposterWins',
      eventId: 'ABC-123:imposter:vote-outcome:0:wins'
    },
    {
      eventName: 'punishmentStart',
      eventId: 'ABC-123:imposter:punishment:0'
    },
    {
      eventName: 'punishmentReveal',
      eventId: 'ABC-123:imposter:punishment-reveal:0:player-2:take_a_shot'
    },
    {
      eventName: 'roundStart',
      eventId: 'ABC-123:imposter:round:1'
    },
    {
      eventName: 'gameComplete',
      eventId: 'ABC-123:imposter:game-complete:1'
    }
  ]);
});

test('Imposter vote outcome sounds match the displayed result', () => {
  let highestVotedIds = ['player-one'];
  const context = vm.createContext({
    currentPartyData: {
      partyId: 'ABC-123',
      deck: { currentCardIndex: 2 },
      players: [{ id: 'player-one' }, { id: 'player-two' }],
      state: { playerTurn: 0 }
    },
    deviceId: 'player-two',
    getHighestVoteValue() {
      return 1;
    },
    GetHighestVoted() {
      return highestVotedIds;
    },
    getPartyState(party) {
      return party.state;
    },
    getPlayerId(player) {
      return player?.id ?? null;
    },
    partyCode: 'ABC-123',
    window: {}
  });

  vm.runInContext(
    fs.readFileSync(
      path.join(
        imposterDirectory,
        'imposter-online-instructions/phase-tools.js'
      ),
      'utf8'
    ),
    context,
    { filename: 'phase-tools.js' }
  );

  assert.deepEqual(
    {
      eventName: context.getImposterFlowSoundEvent(
        context.currentPartyData.state,
        'DISPLAY_VOTE_RESULTS_PART_TWO'
      ).eventName,
      found: context.getImposterVoteOutcome().found
    },
    { eventName: 'imposterFound', found: true }
  );

  highestVotedIds = ['player-two'];

  assert.deepEqual(
    {
      eventName: context.getImposterFlowSoundEvent(
        context.currentPartyData.state,
        'DISPLAY_VOTE_RESULTS_PART_TWO'
      ).eventName,
      found: context.getImposterVoteOutcome().found
    },
    { eventName: 'imposterWins', found: false }
  );
});

test('Imposter action lifecycle manages timer warnings', () => {
  const phaseTools = fs.readFileSync(
    path.join(imposterDirectory, 'imposter-online-instructions/phase-tools.js'),
    'utf8'
  );
  const answerFlow = fs.readFileSync(
    path.join(imposterDirectory, 'imposter-online-instructions/answer-flow.js'),
    'utf8'
  );
  const voteFlow = fs.readFileSync(
    path.join(imposterDirectory, 'imposter-online-instructions/vote-flow.js'),
    'utf8'
  );
  const punishmentFlow = fs.readFileSync(
    path.join(
      imposterDirectory,
      'imposter-online-instructions/punishment-flow.js'
    ),
    'utf8'
  );
  const setup = fs.readFileSync(
    path.join(imposterDirectory, 'imposter-online-setup.js'),
    'utf8'
  );
  const logic = fs.readFileSync(
    path.join(imposterDirectory, 'imposter-online-logic.js'),
    'utf8'
  );

  assert.match(
    answerFlow,
    /syncImposterTimerWarning\([\s\S]*?'confirm-prompt'\s*\)/
  );
  assert.match(
    answerFlow,
    /syncImposterTimerWarning\([\s\S]*?'answer-turn'\s*\)/
  );
  assert.match(answerFlow, /syncImposterTimerWarning\([\s\S]*?'vote'\s*\)/);
  assert.match(
    phaseTools,
    /syncImposterPunishmentTimerWarning\(state, 'choose-punishment'\)/
  );
  assert.match(
    punishmentFlow,
    /syncImposterPunishmentTimerWarning\(state, 'perform-punishment'\)/
  );
  assert.ok(
    (setup.match(/stopImposterTimerWarning\(\)/g)?.length || 0) >= 5,
    'prompt, answer, vote, punishment selection, and completion should stop warnings'
  );
  assert.match(voteFlow, /stopImposterTimerWarning\(\)/);
  assert.match(
    logic,
    /syncImposterInstructionSounds\(state, userInstructions\)/
  );
});
