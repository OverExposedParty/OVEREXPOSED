const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const createOlingClashDebug = require('../../public/scripts/olings/clash/game/debug');
const createOlingClashResolution = require('../../public/scripts/olings/clash/game/resolution');

const commandRegistrySource = fs.readFileSync(
  path.join(
    __dirname,
    '../../public/scripts/general/commands/command-registry.js'
  ),
  'utf8'
);
const olingCommandsSource = fs.readFileSync(
  path.join(
    __dirname,
    '../../public/scripts/general/commands/oling-commands.js'
  ),
  'utf8'
);

function createOling(name) {
  return {
    effects: [],
    health: {
      bloodUnits: 0,
      heartUnits: 6,
      maxHeartUnits: 6,
      overgrowthUnits: 0,
      shieldCount: 0
    },
    name
  };
}

function createDebugOptions(overrides = {}) {
  const state = {
    phase: 'choose-action',
    round: 1,
    selections: { localAction: null },
    teams: {
      local: [createOling('Mossy'), createOling('Pebble'), createOling('Ember')],
      opponent: [createOling('Fang'), createOling('Scrap'), createOling('Moss')]
    },
    winner: null
  };
  const stateModel = {
    state,
    swapActive(side, slot) {
      [state.teams[side][0], state.teams[side][slot]] = [
        state.teams[side][slot],
        state.teams[side][0]
      ];
      return state.teams[side][0];
    }
  };
  return {
    getPendingAction: () => 'attack',
    isOnline: () => false,
    render: () => {},
    resolution: createOlingClashResolution(),
    stateModel,
    ...overrides
  };
}

test('Clash debug health commands use human-readable half-Heart values', () => {
  const options = createDebugOptions();
  const debug = createOlingClashDebug(options);

  debug.setHealth('local', 'active', 1.5);
  debug.setOvergrowth('local', 'active', 0.5);
  debug.setShield('local', 'active', 2);

  assert.equal(options.stateModel.state.teams.local[0].health.heartUnits, 3);
  assert.equal(
    options.stateModel.state.teams.local[0].health.overgrowthUnits,
    1
  );
  assert.equal(options.stateModel.state.teams.local[0].health.shieldCount, 2);
  assert.throws(
    () => debug.setHealth('local', 'active', 0.25),
    /half-Heart increments/
  );
});

test('Clash debug snapshots restore state and pause the game', () => {
  let pauseCount = 0;
  const options = createDebugOptions({
    pause: () => {
      pauseCount += 1;
      return true;
    }
  });
  const debug = createOlingClashDebug(options);

  debug.saveSnapshot('before-hit');
  debug.damage('opponent', 'active', 1);
  assert.equal(options.stateModel.state.teams.opponent[0].health.heartUnits, 4);

  debug.restoreSnapshot('before-hit');
  assert.equal(options.stateModel.state.teams.opponent[0].health.heartUnits, 6);
  assert.equal(pauseCount, 1);
});

test('Clash debug refuses mutations in online matches', () => {
  const debug = createOlingClashDebug(
    createDebugOptions({ isOnline: () => true })
  );

  assert.throws(
    () => debug.setShield('local', 'active', 1),
    /disabled during online matches/
  );
  assert.equal(debug.getStatus().online, true);
});

test('/oling clash routes commands to the active Clash debug controller', async () => {
  const calls = [];
  const context = {
    console,
    Date,
    fetch: async () => ({ ok: true, json: async () => ({}) }),
    localStorage: { getItem: () => null },
    window: null
  };
  context.window = context;
  context.OlingClashDebug = {
    getStatus: () => ({
      online: false,
      paused: true,
      phase: 'choose-action',
      round: 3,
      selectedAction: 'guard',
      speed: 1,
      winner: null
    }),
    select: (action) => {
      calls.push(['select', action]);
      return action;
    }
  };
  vm.runInNewContext(commandRegistrySource, context, {
    filename: 'command-registry.js'
  });
  vm.runInNewContext(olingCommandsSource, context, {
    filename: 'oling-commands.js'
  });
  const messages = [];
  const run = (command) =>
    context.OverexposedCommands.runCommand(command, {
      isAdmin: true,
      pageType: 'overexposure',
      writeConsoleMessage: (_name, message, eventType) => {
        messages.push({ eventType, message });
      }
    });

  await run('/oling clash select attack');
  await run('/oling clash status');

  assert.deepEqual(calls, [['select', 'attack']]);
  assert.equal(messages[0].message, 'Selected ATTACK.');
  assert.match(messages[1].message, /Round: 3; phase: choose-action; paused/);
});

test('Clash console suggestions include tutorial and snapshot commands', async () => {
  const context = {
    console,
    Date,
    fetch: async () => ({ ok: true, json: async () => ({}) }),
    localStorage: { getItem: () => null },
    window: null
  };
  context.window = context;
  vm.runInNewContext(commandRegistrySource, context);
  vm.runInNewContext(olingCommandsSource, context);

  const suggestions =
    await context.OverexposedCommands.getCommandSuggestionsAsync(
      'overexposure'
    );

  assert.ok(suggestions.includes('/oling clash tutorial step 12'));
  assert.ok(suggestions.includes('/oling clash snapshot save before-tag'));
});
