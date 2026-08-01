const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const pagePath = path.join(__dirname, '../../public/pages/waiting-room.html');
const lateJoinPath = path.join(
  __dirname,
  '../../public/scripts/party-games/waiting-room/waiting-room-late-join.js'
);
const waitingRoomPath = path.join(
  __dirname,
  '../../public/scripts/party-games/waiting-room/waiting-room.js'
);
const waitingRoomActionsPath = path.join(
  __dirname,
  '../../public/scripts/party-games/waiting-room/waiting-room-actions.js'
);
const waitingRoomDataPath = path.join(
  __dirname,
  '../../public/scripts/party-games/waiting-room/waiting-room-data.js'
);

test('waiting room late-join module registers its factory', () => {
  const context = { window: {} };
  vm.runInNewContext(fs.readFileSync(lateJoinPath, 'utf8'), context, {
    filename: 'waiting-room-late-join.js'
  });

  assert.equal(
    typeof context.window.createWaitingRoomLateJoinBriefing,
    'function'
  );
});

test('waiting room support modules load before the entry script', () => {
  const page = fs.readFileSync(pagePath, 'utf8');
  const actionsIndex = page.indexOf(
    '"/scripts/party-games/waiting-room/waiting-room-actions.js"'
  );
  const dataIndex = page.indexOf(
    '"/scripts/party-games/waiting-room/waiting-room-data.js"'
  );
  const uiIndex = page.indexOf(
    '"/scripts/party-games/waiting-room/waiting-room-ui.js"'
  );
  const lateJoinIndex = page.indexOf(
    '"/scripts/party-games/waiting-room/waiting-room-late-join.js"'
  );
  const entryIndex = page.indexOf(
    '"/scripts/party-games/waiting-room/waiting-room.js"'
  );

  assert.ok(actionsIndex > -1);
  assert.ok(dataIndex > actionsIndex);
  assert.ok(uiIndex > dataIndex);
  assert.ok(lateJoinIndex > uiIndex);
  assert.ok(entryIndex > lateJoinIndex);
});

test('waiting room party-code copies use the social copy-link sound', () => {
  const actions = fs.readFileSync(waitingRoomActionsPath, 'utf8');

  assert.match(actions, /playSoundEffect\('socialCopyLink'\)/);
});

test('waiting room ready control uses its dedicated state sounds', () => {
  const entry = fs.readFileSync(waitingRoomPath, 'utf8');

  assert.match(entry, /src: '\/sounds\/gamemode-settings\/ready\.wav'/);
  assert.match(entry, /src: '\/sounds\/gamemode-settings\/unready\.wav'/);
  assert.match(entry, /readyButton\.dataset\.sound = 'none'/);
  assert.match(
    entry,
    /newReady \? WAITING_ROOM_READY_SOUND : WAITING_ROOM_UNREADY_SOUND/
  );
});

test('waiting room waits for the completed online API bootstrap', () => {
  const page = fs.readFileSync(pagePath, 'utf8');
  const entry = fs.readFileSync(waitingRoomPath, 'utf8');
  const onlineSettingsConfig = page.match(
    /"\/scripts\/party-games\/online\/online-settings\.js"\s*:\s*\{([^}]*)\}/
  );

  assert.ok(onlineSettingsConfig, 'online settings page entry');
  assert.doesNotMatch(onlineSettingsConfig[1], /addDataLoaded\s*:\s*true/);
  assert.match(entry, /OEReady\?\.waitFor/);
  assert.match(entry, /\['online-settings'\]/);
  assert.match(entry, /await waitForOnlineCore\(\)/);
});

test('waiting room entry composes the late-join briefing module', () => {
  const entry = fs.readFileSync(waitingRoomPath, 'utf8');

  assert.match(entry, /window\.createWaitingRoomLateJoinBriefing/);
  assert.match(
    entry,
    /waitingRoomLateJoinBriefing\.isActiveRoundLateJoinGamemode/
  );
  assert.match(entry, /waitingRoomLateJoinBriefing\.showActiveGameBriefing/);
});

test('waiting room remembers the gamemode for post-auth party recovery', () => {
  const storedValues = new Map();
  const context = {
    sessionStorage: {
      getItem: (key) => storedValues.get(key) || null,
      setItem: (key, value) => storedValues.set(key, value)
    }
  };
  vm.runInNewContext(fs.readFileSync(waitingRoomDataPath, 'utf8'), context, {
    filename: 'waiting-room-data.js'
  });

  assert.equal(
    context.rememberWaitingRoomGamemode('old-123', 'Truth Or Dare'),
    true
  );
  assert.equal(
    storedValues.get('oe-waiting-room-gamemode:OLD-123'),
    'truth-or-dare'
  );
  assert.equal(
    context.rememberWaitingRoomGamemode('not-a-party', 'truth-or-dare'),
    false
  );
});
