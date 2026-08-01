const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const partySocketPath = path.join(
  __dirname,
  '..',
  '..',
  'public',
  'scripts',
  'party-games',
  'online',
  'party-socket.js'
);

function createPartySocketSandbox() {
  const handlers = new Map();
  const popups = [];
  const liveAccountNotificationBatches = [];
  let kickedStateCount = 0;
  let notificationCheckCount = 0;
  const context = {
    console,
    debugLog() {},
    deviceId: 'current-player',
    document: {
      getElementById() {
        return null;
      }
    },
    setTimeout,
    clearTimeout,
    socket: {
      id: 'current-socket',
      emit() {},
      off() {},
      on(eventName, handler) {
        handlers.set(eventName, handler);
      }
    },
    window: null
  };
  context.window = context;
  context.addEventListener = () => {};
  context.checkPartyNotifications = () => {
    notificationCheckCount += 1;
  };
  context.OESessionStatusPrompts = {
    showKicked() {
      kickedStateCount += 1;
    }
  };
  context.setInterval = () => 1;
  context.clearInterval = () => {};
  context.showPartyNotificationPopup = (notification) => {
    popups.push({ ...notification });
  };
  context.handleLiveAccountNotifications = (notifications) => {
    liveAccountNotificationBatches.push(notifications);
  };
  context.setTimeout = (callback) => {
    callback();
    return 1;
  };

  const sandbox = vm.createContext(context);
  vm.runInContext(fs.readFileSync(partySocketPath, 'utf8'), sandbox, {
    filename: 'party-socket.js'
  });

  return {
    handlers,
    liveAccountNotificationBatches,
    popups,
    sandbox,
    getKickedStateCount: () => kickedStateCount,
    getNotificationCheckCount: () => notificationCheckCount
  };
}

test('progression socket notifications are handed to the popup feed immediately', () => {
  const { handlers, liveAccountNotificationBatches } =
    createPartySocketSandbox();
  const notifications = [
    {
      id: 'achievement-notification',
      type: 'achievement_unlocked',
      achievementKey: 'first-steps'
    }
  ];

  handlers.get('account-progression-notifications')({ notifications });

  assert.deepEqual(JSON.parse(JSON.stringify(liveAccountNotificationBatches)), [
    notifications
  ]);
});

test('confirmed kicks notify every remaining lobby client', () => {
  const { handlers, popups } = createPartySocketSandbox();
  const notification = {
    id: 'live:party_player_kicked:PARTY-1:kicked-player',
    type: 'party_player_kicked',
    partyId: 'PARTY-1',
    perspective: 'lobby',
    actorUsername: 'Alex'
  };

  handlers.get('user-kicked')({
    socketId: 'kicked-socket',
    computerId: 'kicked-player',
    notification
  });

  assert.equal(popups.length, 1);
  assert.deepEqual(popups[0], {
    ...notification,
    suppressIfRecent: true
  });
});

test('the removed player receives their kick notification and kicked state', () => {
  const { getKickedStateCount, getNotificationCheckCount, handlers, popups } =
    createPartySocketSandbox();
  const notification = {
    id: 'live:party_player_kicked:PARTY-1:host-player',
    type: 'party_player_kicked',
    partyId: 'PARTY-1',
    perspective: 'removed-player',
    actorUsername: 'Party Host'
  };

  handlers.get('kicked-from-party')({
    partyCode: 'PARTY-1',
    notification
  });

  assert.equal(getKickedStateCount(), 1);
  assert.equal(getNotificationCheckCount(), 1);
  assert.deepEqual(popups[0], {
    ...notification,
    suppressIfRecent: true
  });
});

test('kick socket handlers remain silent without a confirmed notification', () => {
  const { handlers, popups } = createPartySocketSandbox();

  handlers.get('user-kicked')({
    socketId: 'current-socket',
    computerId: 'current-player'
  });

  assert.deepEqual(popups, []);
});

test('voluntary leave events trigger the host lobby sound for another player', () => {
  const { handlers, popups, sandbox } = createPartySocketSandbox();
  let leftSoundCount = 0;
  sandbox.playGamemodeSettingsPlayerLeftSound = () => {
    leftSoundCount += 1;
  };

  handlers.get('user-left')({
    socketId: 'departing-socket',
    computerId: 'departing-player',
    notification: {
      id: 'live:party_player_left:PARTY-1:departing-player',
      type: 'party_player_left'
    }
  });
  handlers.get('user-left')({
    socketId: 'current-socket',
    computerId: 'current-player'
  });

  assert.equal(leftSoundCount, 1);
  assert.equal(popups.length, 1);
});

test('gameplay pages ignore waiting-room projection updates after game over', async () => {
  const { handlers, sandbox } = createPartySocketSandbox();
  let statisticsUpdateCount = 0;

  sandbox.isPlaying = false;
  sandbox.isCurrentOnlineGamemodePartyRoute = () => true;
  sandbox.updatePartyGameStatisticsEndGameButtonState = () => {
    statisticsUpdateCount += 1;
  };

  await handlers.get('party-updated')({
    source: 'waiting-room',
    emittedPartyCode: {
      partyId: 'ABC-123',
      config: { gamemode: 'truth-or-dare' },
      state: {
        isPlaying: false,
        phase: 'lobby',
        hostComputerId: 'current-player'
      },
      players: []
    }
  });

  assert.equal(statisticsUpdateCount, 0);
});
