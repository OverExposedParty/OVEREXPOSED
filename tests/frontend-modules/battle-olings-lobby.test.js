const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const lobbyPath = path.join(
  __dirname,
  '../../public/scripts/olings/battle/battle-olings-lobby.js'
);
const demoOlingsPath = path.join(
  __dirname,
  '../../public/scripts/olings/battle/battle-olings-demo-olings.js'
);
const pagePath = path.join(
  __dirname,
  '../../public/pages/olings/battle-olings.html'
);
const lobbyModulePaths = [
  ['context.js', 'createOlingBattleLobbyContext'],
  ['visuals.js', 'createOlingBattleLobbyVisuals'],
  ['controls.js', 'createOlingBattleLobbyControls'],
  ['api.js', 'createOlingBattleLobbyApi'],
  ['match-sync.js', 'createOlingBattleLobbyMatchSync']
];
const battleModulePaths = [
  ['audio.js', 'createOlingBattleAudio'],
  ['layout.js', 'createOlingBattleLayout'],
  ['timing.js', 'createOlingBattleTiming'],
  ['interaction.js', 'createOlingBattleInteraction']
];

test('Oling battle lobby registers its initializer factory', () => {
  const context = { window: {} };
  vm.runInNewContext(fs.readFileSync(lobbyPath, 'utf8'), context, {
    filename: 'battle-olings-lobby.js'
  });

  assert.equal(typeof context.window.createOlingBattleLobby, 'function');
});

test('Oling battle lobby support modules register before the facade', () => {
  const context = { window: {} };

  for (const [filename, factoryName] of lobbyModulePaths) {
    const modulePath = path.join(
      __dirname,
      '../../public/scripts/olings/battle/lobby',
      filename
    );
    vm.runInNewContext(fs.readFileSync(modulePath, 'utf8'), context, {
      filename
    });
    assert.equal(typeof context.window[factoryName], 'function');
  }

  vm.runInNewContext(fs.readFileSync(lobbyPath, 'utf8'), context, {
    filename: 'battle-olings-lobby.js'
  });
  assert.equal(
    typeof context.window.createOlingBattleLobby({}).initializeLobbyTestMode,
    'function'
  );
});

test('Oling battle demo Oling catalog registers its factory', () => {
  const context = { window: {} };
  vm.runInNewContext(fs.readFileSync(demoOlingsPath, 'utf8'), context, {
    filename: 'battle-olings-demo-olings.js'
  });

  assert.equal(typeof context.window.getOlingBattleDemoOlings, 'function');
  assert.ok(context.window.getOlingBattleDemoOlings().length > 0);
});

test('Oling battle modules load before battle startup in dependency order', () => {
  const page = fs.readFileSync(pagePath, 'utf8');
  const demoOlingsIndex = page.indexOf(
    "'/scripts/olings/battle/battle-olings-demo-olings.js'"
  );
  const lobbyModuleIndexes = lobbyModulePaths.map(([filename]) =>
    page.indexOf(`'/scripts/olings/battle/lobby/${filename}'`)
  );
  const lobbyIndex = page.indexOf(
    "'/scripts/olings/battle/battle-olings-lobby.js'"
  );
  const battleModuleIndexes = battleModulePaths.map(([filename]) =>
    page.indexOf(`'/scripts/olings/battle/runtime/${filename}'`)
  );
  const startupIndex = page.indexOf(
    "'/scripts/olings/battle/battle-olings.js'"
  );

  assert.ok(demoOlingsIndex > -1);
  assert.ok(lobbyModuleIndexes.every((index) => index > demoOlingsIndex));
  assert.ok(lobbyModuleIndexes.every((index) => index < lobbyIndex));
  assert.ok(
    lobbyModuleIndexes.every(
      (index, moduleIndex) =>
        moduleIndex === 0 || index > lobbyModuleIndexes[moduleIndex - 1]
    )
  );
  assert.ok(lobbyIndex > -1);
  assert.ok(lobbyIndex > demoOlingsIndex);
  assert.ok(battleModuleIndexes.every((index) => index > lobbyIndex));
  assert.ok(battleModuleIndexes.every((index) => index < startupIndex));
  assert.ok(
    battleModuleIndexes.every(
      (index, moduleIndex) =>
        moduleIndex === 0 || index > battleModuleIndexes[moduleIndex - 1]
    )
  );
  assert.ok(startupIndex > lobbyIndex);
});
