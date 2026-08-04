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
  'player-board/profile-panel.js',
  'player-board/action-menu.js',
  'player-board/renderer.js',
  'player-board/bindings.js'
];

test('Mafia player board support modules register before the facade', () => {
  const context = { window: {} };

  supportScripts.forEach((scriptPath) => {
    vm.runInNewContext(
      fs.readFileSync(path.join(mafiaDirectory, scriptPath), 'utf8'),
      context,
      { filename: scriptPath }
    );
  });

  assert.equal(
    typeof context.window.createMafiaPlayerBoardProfilePanel,
    'function'
  );
  assert.equal(
    typeof context.window.createMafiaPlayerBoardActionMenu,
    'function'
  );
  assert.equal(
    typeof context.window.createMafiaPlayerBoardRenderer,
    'function'
  );
  assert.equal(typeof context.window.bindMafiaPlayerBoardEvents, 'function');
});

test('Mafia online startup loads player board modules before the facade', () => {
  const startup = fs.readFileSync(
    path.join(mafiaDirectory, 'mafia-online.js'),
    'utf8'
  );
  const facadeIndex = startup.indexOf(
    '/scripts/party-games/gamemode/online/mafia/mafia-online-player-board.js'
  );

  assert.ok(facadeIndex > -1);
  supportScripts.forEach((scriptPath) => {
    const supportIndex = startup.indexOf(
      `/scripts/party-games/gamemode/online/mafia/${scriptPath}`
    );
    assert.ok(supportIndex > -1, `${scriptPath} should be loaded`);
    assert.ok(supportIndex < facadeIndex, `${scriptPath} should load first`);
  });
});
