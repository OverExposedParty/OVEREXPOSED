const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const scriptsDirectory = path.join(
  __dirname,
  '../../public/scripts/party-games/gamemode/online/general'
);
const pageDirectory = path.join(__dirname, '../../public/pages/party-games');
const facadePath = path.join(
  scriptsDirectory,
  'party-games-online-instructions.js'
);
const supportScripts = [
  ['party-games-online-instructions/session.js', 'bootstrapOnlineGamePage'],
  ['party-games-online-instructions/actions.js', 'SendInstruction'],
  ['party-games-online-instructions/ui.js', 'DisplayCard'],
  ['party-games-online-instructions/waiting-room.js', 'AddUserIcons']
];
const onlinePages = [
  'truth-or-dare/truth-or-dare-online-page.html',
  'never-have-i-ever/never-have-i-ever-online-page.html',
  'most-likely-to/most-likely-to-online-page.html',
  'paranoia/paranoia-online-page.html',
  'would-you-rather/would-you-rather-online-page.html',
  'imposter/imposter-online-page.html',
  'mafia/mafia-online-page.html'
];

test('online instructions modules load before the compatibility facade', () => {
  onlinePages.forEach((pageName) => {
    const page = fs.readFileSync(path.join(pageDirectory, pageName), 'utf8');
    const facadeIndex = page.indexOf(
      '/scripts/party-games/gamemode/online/general/party-games-online-instructions.js'
    );

    assert.ok(facadeIndex > -1, `${pageName} should load the facade`);
    supportScripts.forEach(([scriptPath]) => {
      assert.ok(
        page.indexOf(
          `/scripts/party-games/gamemode/online/general/${scriptPath}`
        ) < facadeIndex,
        `${pageName} should load ${scriptPath} before the facade`
      );
    });
  });
});

test('online instructions modules preserve shared browser helpers', () => {
  const context = vm.createContext({ window: {} });

  supportScripts.forEach(([scriptPath, functionName]) => {
    vm.runInContext(
      fs.readFileSync(path.join(scriptsDirectory, scriptPath), 'utf8'),
      context,
      { filename: scriptPath }
    );
    assert.equal(typeof context[functionName], 'function');
  });
  assert.equal(typeof context.window.bootstrapOnlineGamePage, 'function');
});

test('online instructions facade owns shared rule state', () => {
  const facade = fs.readFileSync(facadePath, 'utf8');

  assert.match(facade, /let gameRules = \{\};/);
  assert.match(facade, /let partyRulesSettings;/);
  assert.match(facade, /const resultTimerDuration = 5000;/);
});

test('shared question resets are submitted only by the authoritative host', async () => {
  let actionCalls = 0;
  let isHost = false;
  const context = vm.createContext({
    currentPartyData: {},
    isAuthoritativePartyHost: () => isHost,
    performOnlinePartyAction: async () => {
      actionCalls += 1;
      return { partyId: 'ABC-123' };
    },
    window: {}
  });
  const actionsPath = path.join(
    scriptsDirectory,
    'party-games-online-instructions/actions.js'
  );

  vm.runInContext(fs.readFileSync(actionsPath, 'utf8'), context, {
    filename: actionsPath
  });

  assert.equal(await context.ResetQuestion({}), null);
  assert.equal(actionCalls, 0);

  isHost = true;
  const updatedParty = await context.ResetQuestion({});

  assert.equal(actionCalls, 1);
  assert.equal(updatedParty.partyId, 'ABC-123');
  assert.equal(context.currentPartyData.partyId, 'ABC-123');
});

test('waiting players hear only new confirmations from other players', async () => {
  const playedSounds = [];
  const icons = [
    'local-player',
    'already-confirmed-player',
    'other-player'
  ].map((userId) => {
    const classes = new Set();
    return {
      dataset: { userId },
      classList: {
        add(className) {
          classes.add(className);
        },
        contains(className) {
          return classes.has(className);
        },
        remove(className) {
          classes.delete(className);
        },
        toggle(className, force) {
          if (force) classes.add(className);
          else classes.delete(className);
        }
      }
    };
  });
  let waitingContainerVisible = false;
  const waitingForPlayersContainer = {
    classList: {
      contains(className) {
        return className === 'is-visible' && waitingContainerVisible;
      }
    }
  };
  const context = vm.createContext({
    Promise,
    currentPartyData: {},
    deviceId: 'local-player',
    getPartyState: () => ({}),
    getPlayerIcon: () => '',
    getPlayerId: (player) => player.id,
    getPlayerState: (player) => player.state,
    isContainerVisible: (container) =>
      container.classList.contains('is-visible'),
    waitingForPlayersContainer,
    waitingForPlayersIconContainer: {
      querySelectorAll: () => icons
    },
    window: {
      PartyGameSounds: {
        play(eventName) {
          playedSounds.push(eventName);
          return Promise.resolve();
        }
      }
    }
  });
  const waitingRoomPath = path.join(
    scriptsDirectory,
    'party-games-online-instructions/waiting-room.js'
  );

  vm.runInContext(fs.readFileSync(waitingRoomPath, 'utf8'), context, {
    filename: waitingRoomPath
  });

  const players = [
    { id: 'local-player', state: { hasConfirmed: false } },
    { id: 'already-confirmed-player', state: { hasConfirmed: false } },
    { id: 'other-player', state: { hasConfirmed: false } }
  ];

  context.SetWaitingForPlayersIconStates(players, true);
  players[1].state.hasConfirmed = true;
  context.SetWaitingForPlayersIconStates(players, true);
  waitingContainerVisible = true;
  context.SetWaitingForPlayersIconStates(players, true);
  players[0].state.hasConfirmed = true;
  context.SetWaitingForPlayersIconStates(players, true);
  players[2].state.hasConfirmed = true;
  context.SetWaitingForPlayersIconStates(players, true);
  context.SetWaitingForPlayersIconStates(players, true);
  await Promise.resolve();

  assert.deepEqual(playedSounds, ['playerConfirmed']);
});
