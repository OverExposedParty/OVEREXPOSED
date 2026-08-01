const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const mafiaDirectory = path.join(
  __dirname,
  '../../public/scripts/party-games/gamemode/online/mafia'
);
const supportScripts = [
  'mafia-online-instructions/phase-tools.js',
  'mafia-online-instructions/night-flow.js',
  'mafia-online-instructions/day-flow.js',
  'mafia-online-instructions/display-state.js'
];
const publicHandlers = [
  'DisplayRole',
  'DisplayNightPhase',
  'DisplayNightPhasePartTwo',
  'DisplayPlayerKilled',
  'DisplayPlayerKilledPartTwo',
  'DisplayDayPhaseDiscussion',
  'DisplayDayPhaseVote',
  'DisplayDayPhaseVotePartTwo',
  'DisplayTownVote',
  'DisplayTownVotePartTwo',
  'DisplayGameOver',
  'DisplayPlayerDeadPLayerBoard'
];

test('Mafia setup loads instruction modules before the compatibility facade', () => {
  const setup = fs.readFileSync(
    path.join(mafiaDirectory, 'mafia-online-setup.js'),
    'utf8'
  );
  let previousIndex = -1;

  supportScripts.forEach((scriptPath) => {
    const index = setup.indexOf(scriptPath);
    assert.ok(index > previousIndex, `${scriptPath} should load in dependency order`);
    previousIndex = index;
  });

  assert.ok(
    setup.indexOf('`${instructionsBasePath}/${placeHolderSelectedUser.dataset.template}-online-instructions.js`') > previousIndex,
    'the facade should load after every support module'
  );
});

test('Mafia instruction modules preserve their public handler contract', () => {
  const context = vm.createContext({ window: {}, gameRules: {} });

  supportScripts.forEach((scriptPath) => {
    vm.runInContext(
      fs.readFileSync(path.join(mafiaDirectory, scriptPath), 'utf8'),
      context,
      { filename: scriptPath }
    );
  });

  publicHandlers.forEach((handler) => {
    context.window[handler] = context[handler];
  });

  vm.runInContext(
    fs.readFileSync(path.join(mafiaDirectory, 'mafia-online-instructions.js'), 'utf8'),
    context,
    { filename: 'mafia-online-instructions.js' }
  );

  publicHandlers.forEach((handler) => {
    assert.equal(typeof context[handler], 'function', `${handler} should remain public`);
  });
});

test('Mafia elimination flows parse instructions before scheduling host actions', () => {
  const nightFlow = fs.readFileSync(
    path.join(mafiaDirectory, 'mafia-online-instructions/night-flow.js'),
    'utf8'
  );
  const dayFlow = fs.readFileSync(
    path.join(mafiaDirectory, 'mafia-online-instructions/day-flow.js'),
    'utf8'
  );

  const playerKilledStart = nightFlow.indexOf('async function DisplayPlayerKilled');
  const townVoteStart = dayFlow.indexOf('async function DisplayTownVote');

  assert.ok(
    nightFlow.indexOf('const parsedInstructions = parseInstruction(instruction);', playerKilledStart) <
      nightFlow.indexOf('await scheduleMafiaHostAction', playerKilledStart),
    'player-killed flow should parse the instruction before scheduling its host action'
  );
  assert.ok(
    dayFlow.indexOf('const parsedInstructions = parseInstruction(instruction);', townVoteStart) <
      dayFlow.indexOf('await scheduleMafiaHostAction', townVoteStart),
    'town-vote flow should parse the instruction before scheduling its host action'
  );
});

test('Mafia timer warning follows living-player action ownership', () => {
  const timerCalls = [];
  const context = vm.createContext({
    currentPartyData: {
      partyId: 'ABC-123',
      state: { timer: 123456 }
    },
    gameRules: {},
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
        mafiaDirectory,
        'mafia-online-instructions/phase-tools.js'
      ),
      'utf8'
    ),
    context,
    { filename: 'phase-tools.js' }
  );

  assert.equal(
    context.syncMafiaTimerWarning(
      context.currentPartyData.state,
      true,
      'night-action'
    ),
    true
  );
  assert.equal(
    context.syncMafiaTimerWarning(
      context.currentPartyData.state,
      false,
      'night-action'
    ),
    true
  );
  assert.equal(
    context.syncMafiaTimerWarning(
      context.currentPartyData.state,
      true,
      'day-vote'
    ),
    true
  );

  assert.equal(timerCalls.length, 3);
  assert.equal(timerCalls[0].action, 'start');
  assert.equal(
    timerCalls[0].options.timerId,
    'ABC-123:mafia-night-action:123456'
  );
  assert.equal(timerCalls[1].action, 'stop');
  assert.equal(timerCalls[2].action, 'start');
  assert.equal(
    timerCalls[2].options.timerId,
    'ABC-123:mafia-day-vote:123456'
  );
});

test('Mafia flow sounds follow deduplicated day and night transitions', async () => {
  const flowSounds = [];
  const context = vm.createContext({
    currentPartyData: {
      partyId: 'ABC-123',
      state: {}
    },
    gameRules: {},
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
        mafiaDirectory,
        'mafia-online-instructions/phase-tools.js'
      ),
      'utf8'
    ),
    context,
    { filename: 'phase-tools.js' }
  );

  await context.syncMafiaFlowSounds({}, 'DISPLAY_ROLE');
  await context.syncMafiaFlowSounds({}, 'DISPLAY_ROLE');
  assert.deepEqual(flowSounds, [], 'the initial state should be silent');

  await context.syncMafiaFlowSounds(
    { completedRounds: 0 },
    'DISPLAY_NIGHT_PHASE'
  );
  await context.syncMafiaFlowSounds(
    { completedRounds: 0 },
    'DISPLAY_NIGHT_PHASE:PART_TWO'
  );
  await context.syncMafiaFlowSounds(
    { completedRounds: 0 },
    'DISPLAY_PLAYER_KILLED:player-two'
  );
  await context.syncMafiaFlowSounds(
    { completedRounds: 0 },
    'DISPLAY_DAY_PHASE_DISCUSSION'
  );
  await context.syncMafiaFlowSounds(
    { completedRounds: 0 },
    'DISPLAY_DAY_PHASE_VOTE'
  );
  await context.syncMafiaFlowSounds(
    { completedRounds: 0 },
    'DISPLAY_TOWN_VOTE:player-three'
  );
  await context.syncMafiaFlowSounds(
    { completedRounds: 1 },
    'DISPLAY_NIGHT_PHASE'
  );
  await context.syncMafiaFlowSounds(
    { completedRounds: 1 },
    'DISPLAY_GAMEOVER:CIVILIAN'
  );

  assert.deepEqual(flowSounds, [
    {
      eventName: 'roundStart',
      eventId: 'ABC-123:mafia:night:0'
    },
    {
      eventName: 'resultsReveal',
      eventId: 'ABC-123:mafia:night-result:0'
    },
    {
      eventName: 'roundStart',
      eventId: 'ABC-123:mafia:day:0'
    },
    {
      eventName: 'resultsReveal',
      eventId: 'ABC-123:mafia:day-result:0'
    },
    {
      eventName: 'roundStart',
      eventId: 'ABC-123:mafia:night:1'
    },
    {
      eventName: 'gameComplete',
      eventId: 'ABC-123:mafia:game-complete:1'
    }
  ]);
});

test('Mafia action lifecycle manages timer warnings', () => {
  const nightFlow = fs.readFileSync(
    path.join(mafiaDirectory, 'mafia-online-instructions/night-flow.js'),
    'utf8'
  );
  const dayFlow = fs.readFileSync(
    path.join(mafiaDirectory, 'mafia-online-instructions/day-flow.js'),
    'utf8'
  );
  const displayState = fs.readFileSync(
    path.join(mafiaDirectory, 'mafia-online-instructions/display-state.js'),
    'utf8'
  );
  const setup = fs.readFileSync(
    path.join(mafiaDirectory, 'mafia-online-setup.js'),
    'utf8'
  );

  assert.match(nightFlow, /syncMafiaTimerWarning\([\s\S]*?'night-action'\s*\)/);
  assert.match(dayFlow, /syncMafiaTimerWarning\([\s\S]*?'day-discussion'\s*\)/);
  assert.match(dayFlow, /syncMafiaTimerWarning\([\s\S]*?'day-vote'\s*\)/);
  assert.ok(
    (setup.match(/stopMafiaTimerWarning\(\)/g)?.length || 0) >= 3,
    'night vote, day vote, and empty instruction states should stop warnings'
  );
  assert.match(setup, /syncMafiaInstructionSounds\(state, instructions\)/);
  assert.match(displayState, /async function DisplayGameOver[\s\S]*?stopMafiaTimerWarning\(\)/);
});
