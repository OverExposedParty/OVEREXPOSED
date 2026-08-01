const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const truthOrDareDirectory = path.join(
  __dirname,
  '../../public/scripts/party-games/gamemode/online/truth-or-dare'
);
const supportScripts = [
  'truth-or-dare-online-instructions/phase-tools.js',
  'truth-or-dare-online-instructions/prompt-flow.js',
  'truth-or-dare-online-instructions/punishment-flow.js',
  'truth-or-dare-online-instructions/answer-flow.js',
  'truth-or-dare-online-instructions/round-actions.js'
];
const publicHandlers = [
  'DisplaySelectQuestionType',
  'DisplayPublicCard',
  'ChoosingPunishment',
  'DisplayPromptHeist',
  'UserSelectedForPunishment',
  'DisplayPunishmentToUser',
  'UserHasPassed',
  'DisplayCompleteQuestion',
  'ResetTruthOrDareQuestion',
  'PartySkip'
];

test('Truth or Dare setup loads instruction modules before the compatibility facade', () => {
  const setup = fs.readFileSync(
    path.join(truthOrDareDirectory, 'truth-or-dare-online-setup.js'),
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

test('Truth or Dare instruction modules preserve their public handler contract', () => {
  const context = vm.createContext({ window: {} });

  supportScripts.forEach((scriptPath) => {
    vm.runInContext(
      fs.readFileSync(path.join(truthOrDareDirectory, scriptPath), 'utf8'),
      context,
      { filename: scriptPath }
    );
  });

  publicHandlers.forEach((handler) => {
    context.window[handler] = context[handler];
  });

  vm.runInContext(
    fs.readFileSync(path.join(truthOrDareDirectory, 'truth-or-dare-online-instructions.js'), 'utf8'),
    context,
    { filename: 'truth-or-dare-online-instructions.js' }
  );

  publicHandlers.forEach((handler) => {
    assert.equal(typeof context[handler], 'function', `${handler} should remain public`);
  });
});

test('Truth or Dare retires written answers and redirects legacy instructions', () => {
  const logicSource = fs.readFileSync(
    path.join(truthOrDareDirectory, 'truth-or-dare-online-logic.js'),
    'utf8'
  );
  const settings = JSON.parse(
    fs.readFileSync(
      path.join(
        __dirname,
        '../../public/json-files/party-games/settings/truth-or-dare.json'
      ),
      'utf8'
    )
  );
  const selectedUserTemplate = fs.readFileSync(
    path.join(
      __dirname,
      '../../public/html-templates/online/party-games/selected-user-containers/truth-or-dare-template.html'
    ),
    'utf8'
  );
  const onlinePage = fs.readFileSync(
    path.join(
      __dirname,
      '../../public/pages/party-games/truth-or-dare/truth-or-dare-online-page.html'
    ),
    'utf8'
  );
  const context = vm.createContext({
    currentPartyData: { state: {} },
    getPartyState: (party) => party.state,
    getUserInstructions: () => 'DISPLAY_CONFIRM_INPUT'
  });

  vm.runInContext(logicSource, context, {
    filename: 'truth-or-dare-online-logic.js'
  });

  assert.deepEqual(
    settings['truth-or-dare-settings'].map((rule) => rule['settings-name']),
    ['prompt-heist', 'rounds', 'drink-wheel', 'take-a-shot']
  );
  assert.doesNotMatch(selectedUserTemplate, /answer-question-container|textarea/);
  assert.doesNotMatch(onlinePage, /answer-view/);
  assert.equal(
    context.getTruthOrDareInstructionFallback(),
    'DISPLAY_COMPLETE_QUESTION'
  );
});

test('Truth or Dare timer warning follows local action ownership', () => {
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
        truthOrDareDirectory,
        'truth-or-dare-online-instructions/phase-tools.js'
      ),
      'utf8'
    ),
    context,
    { filename: 'phase-tools.js' }
  );

  assert.equal(
    context.syncTruthOrDareTimerWarning(
      context.currentPartyData.state,
      true,
      'select-question-type'
    ),
    true
  );
  assert.equal(
    context.syncTruthOrDareTimerWarning(
      context.currentPartyData.state,
      false,
      'select-question-type'
    ),
    true
  );
  assert.equal(
    context.syncTruthOrDareTimerWarning(
      context.currentPartyData.state,
      true,
      'prompt-heist'
    ),
    true
  );

  assert.equal(timerCalls.length, 3);
  assert.equal(timerCalls[0].action, 'start');
  assert.equal(
    timerCalls[0].options.timerId,
    'ABC-123:truth-or-dare-select-question-type:123456'
  );
  assert.equal(timerCalls[0].options.playExpiredSound, true);
  assert.equal(timerCalls[1].action, 'stop');
  assert.equal(timerCalls[2].action, 'start');
  assert.equal(
    timerCalls[2].options.timerId,
    'ABC-123:truth-or-dare-prompt-heist:123456'
  );
  assert.equal(timerCalls[2].options.playExpiredSound, false);
});

test('Truth or Dare flow sounds follow deduplicated state transitions', async () => {
  const flowSounds = [];
  const context = vm.createContext({
    currentPartyData: {
      partyId: 'ABC-123',
      deck: {
        currentCardIndex: 0,
        currentCardSecondIndex: 0,
        questionType: 'truth'
      },
      players: [
        { identity: { computerId: 'player-1' } },
        { identity: { computerId: 'player-2' } }
      ],
      state: {}
    },
    deviceId: 'player-2',
    getPlayerId(player) {
      return player?.identity?.computerId ?? player?.computerId ?? null;
    },
    partyCode: 'ABC-123',
    window: {
      PartyGameSounds: {
        playOnce(eventName, options) {
          flowSounds.push({
            kind: 'single',
            eventName,
            eventId: options.eventId
          });
          return Promise.resolve();
        },
        playSequence(eventNames, options) {
          flowSounds.push({
            kind: 'sequence',
            eventNames: [...eventNames],
            options: {
              priority: options.priority,
              conflictPolicy: options.conflictPolicy,
              interruptible: options.interruptible
            }
          });
          return Promise.resolve();
        }
      }
    }
  });

  vm.runInContext(
    fs.readFileSync(
      path.join(
        truthOrDareDirectory,
        'truth-or-dare-online-instructions/phase-tools.js'
      ),
      'utf8'
    ),
    context,
    { filename: 'phase-tools.js' }
  );

  await context.syncTruthOrDareFlowSounds({}, 'DISPLAY_SELECT_QUESTION_TYPE');
  await context.syncTruthOrDareFlowSounds({}, 'DISPLAY_SELECT_QUESTION_TYPE');
  assert.deepEqual(flowSounds, [], 'the initial state should be silent');

  context.currentPartyData.deck.currentCardIndex = 1;
  await context.syncTruthOrDareFlowSounds({}, 'DISPLAY_PUBLIC_CARD');
  await context.syncTruthOrDareFlowSounds({}, 'DISPLAY_COMPLETE_QUESTION');
  await context.syncTruthOrDareFlowSounds(
    { phase: 'truth-or-dare-prompt-heist' },
    'DISPLAY_PUBLIC_CARD'
  );
  await context.syncTruthOrDareFlowSounds(
    { phase: 'truth-or-dare-choose-punishment' },
    'DISPLAY_PUBLIC_CARD'
  );
  await context.syncTruthOrDareFlowSounds(
    {
      phase: 'truth-or-dare-show-punishment',
      phaseData: {
        targetId: 'player-2',
        punishmentType: 'DRINK_WHEEL'
      }
    },
    'DISPLAY_SHOW_PUNISHMENT'
  );
  await context.syncTruthOrDareFlowSounds(
    {
      phase: 'truth-or-dare-show-punishment',
      phaseData: {
        targetId: 'player-2',
        punishmentType: '2_SIPS'
      }
    },
    'DISPLAY_SHOW_PUNISHMENT'
  );
  await context.syncTruthOrDareFlowSounds(
    { playerTurn: 0 },
    'DISPLAY_SELECT_QUESTION_TYPE'
  );
  await context.syncTruthOrDareFlowSounds(
    { playerTurn: 1 },
    'DISPLAY_SELECT_QUESTION_TYPE'
  );
  await context.syncTruthOrDareFlowSounds(
    { phase: 'game-over', playerTurn: 1 },
    'GAME_OVER'
  );

  assert.deepEqual(flowSounds, [
    {
      kind: 'sequence',
      eventNames: [
        'actionConfirmed',
        'truthSelected'
      ],
      options: {
        priority: 'voice',
        conflictPolicy: 'queue-latest',
        interruptible: false
      }
    },
    {
      kind: 'single',
      eventName: 'actionConfirmed',
      eventId: 'ABC-123:truth-or-dare:complete-prompt:1-0-0'
    },
    {
      kind: 'single',
      eventName: 'actionConfirmed',
      eventId: 'ABC-123:truth-or-dare:prompt-heist:1-0-0'
    },
    {
      kind: 'single',
      eventName: 'punishmentStart',
      eventId: 'ABC-123:truth-or-dare:choose-punishment:1-0-0'
    },
    {
      kind: 'single',
      eventName: 'punishmentReveal',
      eventId:
        'ABC-123:truth-or-dare:punishment-reveal:1-0-0:player-2:2_sips'
    },
    {
      kind: 'single',
      eventName: 'roundStart',
      eventId: 'ABC-123:truth-or-dare:round:1-0-0'
    },
    {
      kind: 'sequence',
      eventNames: [
        'roundStart',
        'yourTurn'
      ],
      options: {
        priority: 'phase',
        conflictPolicy: 'queue-latest',
        interruptible: false
      }
    },
    {
      kind: 'sequence',
      eventNames: [
        'gameComplete',
        'gameOver'
      ],
      options: {
        priority: 'critical',
        conflictPolicy: 'interrupt',
        interruptible: false
      }
    }
  ]);
});

test('Truth or Dare only adds the your-turn cue for the active player', async () => {
  const flowSounds = [];
  const context = vm.createContext({
    currentPartyData: {
      partyId: 'ABC-123',
      deck: {
        currentCardIndex: 0,
        currentCardSecondIndex: 0
      },
      players: [
        { identity: { computerId: 'player-1' } },
        { identity: { computerId: 'player-2' } }
      ]
    },
    deviceId: 'player-2',
    getPlayerId(player) {
      return player?.identity?.computerId ?? player?.computerId ?? null;
    },
    partyCode: 'ABC-123',
    window: {
      PartyGameSounds: {
        playOnce(eventName, options) {
          flowSounds.push({
            kind: 'single',
            eventName,
            eventId: options.eventId
          });
          return Promise.resolve();
        },
        playSequence(eventNames) {
          flowSounds.push({
            kind: 'sequence',
            eventNames: [...eventNames]
          });
          return Promise.resolve();
        }
      }
    }
  });

  vm.runInContext(
    fs.readFileSync(
      path.join(
        truthOrDareDirectory,
        'truth-or-dare-online-instructions/phase-tools.js'
      ),
      'utf8'
    ),
    context,
    { filename: 'phase-tools.js' }
  );

  await context.syncTruthOrDareFlowSounds(
    { playerTurn: 0 },
    'DISPLAY_PUBLIC_CARD'
  );
  await context.syncTruthOrDareFlowSounds(
    { playerTurn: 0 },
    'DISPLAY_SELECT_QUESTION_TYPE'
  );

  context.currentPartyData.deck.currentCardIndex = 1;
  await context.syncTruthOrDareFlowSounds(
    { playerTurn: 1 },
    'DISPLAY_SELECT_QUESTION_TYPE'
  );

  assert.deepEqual(flowSounds, [
    {
      kind: 'single',
      eventName: 'roundStart',
      eventId: 'ABC-123:truth-or-dare:round:0-0-0'
    },
    {
      kind: 'sequence',
      eventNames: [
        'roundStart',
        'yourTurn'
      ]
    }
  ]);
});

test('Truth or Dare punishment text does not duplicate the action verb', () => {
  const context = vm.createContext({
    currentPartyData: {},
    window: {}
  });

  vm.runInContext(
    fs.readFileSync(
      path.join(
        truthOrDareDirectory,
        'truth-or-dare-online-instructions/phase-tools.js'
      ),
      'utf8'
    ),
    context,
    { filename: 'phase-tools.js' }
  );

  assert.equal(
    context.formatTruthOrDarePunishmentText('TAKE_A_SHOT'),
    'Take a shot.'
  );
  assert.equal(
    context.formatTruthOrDarePunishmentText('2_SIPS'),
    'Take 2 sips.'
  );
  assert.equal(
    context.formatTruthOrDarePunishmentText('DOWN_IT'),
    'Down it!'
  );
});

test('Truth or Dare question type confirmation uses an atomic voice sequence', async () => {
  const playedSequences = [];
  const context = vm.createContext({
    window: {
      PartyGameSounds: {
        playSequence(eventNames, options) {
          playedSequences.push({ eventNames, options });
          return Promise.resolve({ stop() {} });
        }
      }
    }
  });

  vm.runInContext(
    fs.readFileSync(
      path.join(
        truthOrDareDirectory,
        'truth-or-dare-online-instructions/phase-tools.js'
      ),
      'utf8'
    ),
    context,
    { filename: 'phase-tools.js' }
  );

  await context.playTruthOrDareQuestionTypeConfirmation('truth');
  await context.playTruthOrDareQuestionTypeConfirmation('dare');
  assert.deepEqual(playedSequences.map(({ eventNames }) => [...eventNames]), [
    ['actionConfirmed', 'truthSelected'],
    ['actionConfirmed', 'dareSelected']
  ]);
  playedSequences.forEach(({ options }) => {
    assert.equal(options.priority, 'voice');
    assert.equal(options.conflictPolicy, 'queue-latest');
    assert.equal(options.interruptible, false);
  });
});

test('Truth or Dare game over plays completion before its spoken game-over cue', async () => {
  const playedSequences = [];
  const context = vm.createContext({
    window: {
      PartyGameSounds: {
        playSequence(eventNames, options) {
          playedSequences.push({ eventNames, options });
          return Promise.resolve({ stop() {} });
        }
      }
    }
  });

  vm.runInContext(
    fs.readFileSync(
      path.join(
        truthOrDareDirectory,
        'truth-or-dare-online-instructions/phase-tools.js'
      ),
      'utf8'
    ),
    context,
    { filename: 'phase-tools.js' }
  );

  await context.playTruthOrDareGameOverSequence();

  assert.equal(playedSequences.length, 1);
  assert.deepEqual(
    [...playedSequences[0].eventNames],
    ['gameComplete', 'gameOver']
  );
  assert.equal(playedSequences[0].options.priority, 'critical');
  assert.equal(playedSequences[0].options.conflictPolicy, 'interrupt');
  assert.equal(playedSequences[0].options.interruptible, false);
  assert.equal(playedSequences[0].options.forceInterrupt, true);
  assert.equal(playedSequences[0].options.clearQueue, true);
});

test('Truth or Dare contextual audio controls suppress generic selection sounds', () => {
  const selectedUserTemplate = fs.readFileSync(
    path.join(
      __dirname,
      '../../public/html-templates/online/party-games/selected-user-containers/truth-or-dare-template.html'
    ),
    'utf8'
  );
  const page = fs.readFileSync(
    path.join(
      __dirname,
      '../../public/pages/party-games/truth-or-dare/truth-or-dare-online-page.html'
    ),
    'utf8'
  );

  assert.match(
    selectedUserTemplate,
    /id="truth"[^>]*data-sound="none"/
  );
  assert.match(
    selectedUserTemplate,
    /id="dare"[^>]*data-sound="none"/
  );
  assert.match(
    page,
    /id="answer"[^>]*data-sound="none"/
  );
});

test('Truth or Dare action lifecycle manages timer warnings', () => {
  const promptFlow = fs.readFileSync(
    path.join(
      truthOrDareDirectory,
      'truth-or-dare-online-instructions/prompt-flow.js'
    ),
    'utf8'
  );
  const answerFlow = fs.readFileSync(
    path.join(
      truthOrDareDirectory,
      'truth-or-dare-online-instructions/answer-flow.js'
    ),
    'utf8'
  );
  const punishmentFlow = fs.readFileSync(
    path.join(
      truthOrDareDirectory,
      'truth-or-dare-online-instructions/punishment-flow.js'
    ),
    'utf8'
  );
  const setup = fs.readFileSync(
    path.join(truthOrDareDirectory, 'truth-or-dare-online-setup.js'),
    'utf8'
  );
  const logic = fs.readFileSync(
    path.join(truthOrDareDirectory, 'truth-or-dare-online-logic.js'),
    'utf8'
  );

  assert.match(promptFlow, /syncTruthOrDareTimerWarning\([\s\S]*?'select-question-type'\s*\)/);
  assert.match(promptFlow, /syncTruthOrDareTimerWarning\([\s\S]*?'answer-or-pass'\s*\)/);
  assert.match(promptFlow, /syncTruthOrDareTimerWarning\([\s\S]*?'prompt-heist'\s*\)/);
  assert.match(answerFlow, /syncTruthOrDareTimerWarning\([\s\S]*?'complete-prompt'\s*\)/);
  assert.match(
    punishmentFlow,
    /syncTruthOrDareTimerWarning\([\s\S]*?'choose-punishment'\s*\)/
  );
  assert.match(
    punishmentFlow,
    /syncTruthOrDareTimerWarning\([\s\S]*?'perform-punishment'\s*\)/
  );
  assert.match(setup, /async function syncTruthOrDareActionAndRender/);
  assert.match(setup, /stopTruthOrDareTimerWarning\(\)/);
  assert.match(
    setup,
    /selectQuestionTypeButtonTruth\.addEventListener\('click', async \(\) => \{[\s\S]*?syncTruthOrDareActionAndRender\(updatedParty\);\s*\}\);/
  );
  assert.match(
    setup,
    /selectQuestionTypeButtonDare\.addEventListener\('click', async \(\) => \{[\s\S]*?syncTruthOrDareActionAndRender\(updatedParty\);\s*\}\);/
  );
  assert.doesNotMatch(setup, /playTruthOrDareQuestionTypeConfirmation/);
  assert.match(
    setup,
    /gameContainerPublicButtonAnswer\.addEventListener\('click', async \(\) => \{[\s\S]*?action: 'truth-or-dare-start-prompt'[\s\S]*?syncTruthOrDareActionAndRender\(updatedParty\);\s*\}\);/
  );
  assert.doesNotMatch(setup, /playActionConfirmation/);
  assert.doesNotMatch(setup, /DISPLAY_(?:CONFIRM_INPUT|ANSWER_CARD)/);
  assert.doesNotMatch(answerFlow, /Display(?:ConfirmInput|AnswerCard)/);
  assert.match(
    setup,
    /async function passTruthOrDarePrompt\(\)[\s\S]*?syncTruthOrDareActionAndRender\(updatedParty\);\s*\}/
  );
  assert.match(logic, /phaseOwnsActionTimer/);
  assert.match(logic, /instructionOwnsActionTimer/);
});
