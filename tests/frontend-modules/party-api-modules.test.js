const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const onlineDirectory = path.join(
  __dirname,
  '../../public/scripts/party-games/online'
);
const onlineSettingsPath = path.join(onlineDirectory, 'online-settings.js');
const facadePath = path.join(onlineDirectory, 'party-api.js');
const partyDataPath = path.join(onlineDirectory, 'party-api/party-data.js');
const partySyncPath = path.join(onlineDirectory, 'party-core/sync.js');
const supportScripts = [
  'party-api/party-data.js',
  'party-api/actions.js',
  'party-api/players.js',
  'party-api/account-link.js'
];

test('party API support modules load before the compatibility facade', () => {
  const settingsSource = fs.readFileSync(onlineSettingsPath, 'utf8');
  const facadeIndex = settingsSource.indexOf(
    "'/scripts/party-games/online/party-api.js'"
  );
  const supportIndexes = supportScripts.map((scriptPath) =>
    settingsSource.indexOf(`'/scripts/party-games/online/${scriptPath}'`)
  );

  assert.ok(facadeIndex > -1);
  assert.ok(supportIndexes.every((index) => index > -1));
  assert.ok(supportIndexes.every((index) => index < facadeIndex));
  assert.ok(
    supportIndexes.every(
      (index, moduleIndex) =>
        moduleIndex === 0 || index > supportIndexes[moduleIndex - 1]
    )
  );
});

test('party API facade preserves the shared browser helpers', () => {
  const context = {
    Blob: class Blob {},
    console: { error() {}, log() {}, warn() {} },
    debugLog() {},
    deviceId: 'device-1',
    fetch: async () => ({ json: async () => ({}) }),
    hostDeviceId: null,
    hostedParty: false,
    isPlaying: false,
    navigator: { sendBeacon() {} },
    partyCode: 'ABC-123',
    postToBothEndpoints() {},
    sessionPartyType: 'party-games',
    socket: { emit() {} },
    waitingForHost: false,
    window: null
  };
  context.window = context;
  context.addEventListener = () => {};

  const sandbox = vm.createContext(context);
  supportScripts.forEach((scriptPath) => {
    vm.runInContext(
      fs.readFileSync(path.join(onlineDirectory, scriptPath), 'utf8'),
      sandbox,
      { filename: scriptPath }
    );
  });
  vm.runInContext(fs.readFileSync(facadePath, 'utf8'), sandbox, {
    filename: 'party-api.js'
  });

  [
    'GetCurrentPartyData',
    'UpdateUserPartyData',
    'addUserToParty',
    'performOnlinePartyAction',
    'ReplayOnlinePartyGame',
    'DeleteParty',
    'linkCurrentPartyPlayerToAccount',
    'continueCurrentPartyPlayerAsGuest'
  ].forEach((functionName) => {
    assert.equal(typeof sandbox[functionName], 'function', functionName);
  });
});

test('replay action sends the finished game id and adopts the new session', async () => {
  const requests = [];
  const updatedParty = {
    partyId: 'ABC-123',
    session: { gameId: `MLT-${'B'.repeat(32)}` },
    config: { gamemode: 'most-likely-to' },
    state: { isPlaying: true }
  };
  const context = {
    console: { error() {}, log() {}, warn() {} },
    currentPartyData: {
      partyId: 'ABC-123',
      session: { gameId: `MLT-${'A'.repeat(32)}` }
    },
    deviceId: 'host-device',
    fetch: async (url, options) => {
      requests.push({ url, options });
      return {
        ok: true,
        async json() {
          return { updated: updatedParty };
        }
      };
    },
    isPlaying: false,
    partyCode: 'ABC-123',
    sessionPartyType: 'party-game-most-likely-to',
    socket: { id: 'socket-one' },
    window: null,
    PartyApiPartyData: {
      requireOnlinePartyId(value) {
        return value;
      }
    }
  };
  context.window = context;
  const sandbox = vm.createContext(context);
  vm.runInContext(
    fs.readFileSync(path.join(onlineDirectory, 'party-api/actions.js'), 'utf8'),
    sandbox,
    { filename: 'party-api/actions.js' }
  );

  const result = await sandbox.PartyApiActions.ReplayOnlinePartyGame();
  const requestBody = JSON.parse(requests[0].options.body);

  assert.equal(requestBody.action, 'replay-game');
  assert.equal(requestBody.payload.expectedGameId, `MLT-${'A'.repeat(32)}`);
  assert.equal(result.session.gameId, `MLT-${'B'.repeat(32)}`);
  assert.equal(sandbox.currentPartyData.session.gameId, result.session.gameId);
});

test('all-users-ready check excludes the host by identity instead of array position', async () => {
  const context = {
    console: { error() {}, log() {}, warn() {} },
    debugLog() {},
    fetch: async () => ({
      json: async () => [
        {
          state: { hostComputerId: 'host-device' },
          players: [
            {
              identity: { computerId: 'guest-one' },
              state: { isReady: true }
            },
            {
              identity: { computerId: 'host-device' },
              state: { isReady: false }
            },
            {
              identity: { computerId: 'guest-two' },
              state: { isReady: true }
            }
          ]
        }
      ]
    }),
    partyCode: 'ABC-123',
    PartyApiActions: { performOnlinePartyAction() {} },
    PartyApiPartyData: {
      getExistingPartyData() {},
      requireOnlinePartyId(value) {
        return value;
      }
    },
    sessionPartyType: 'party-game-truth-or-dare',
    window: null
  };
  context.window = context;

  const sandbox = vm.createContext(context);
  vm.runInContext(
    fs.readFileSync(path.join(onlineDirectory, 'party-api/players.js'), 'utf8'),
    sandbox,
    { filename: 'party-api/players.js' }
  );

  assert.equal(await sandbox.PartyApiPlayers.GetAllUsersReady(), true);
});

test('ready updates report whether the player patch succeeded', async () => {
  let responseOk = true;
  const context = {
    console: { error() {}, log() {}, warn() {} },
    currentPartyData: null,
    fetch: async () => ({
      ok: responseOk,
      status: responseOk ? 200 : 500,
      json: async () => ({})
    }),
    PartyApiActions: { performOnlinePartyAction() {} },
    PartyApiPartyData: {
      getExistingPartyData() {},
      requireOnlinePartyId(value) {
        return value;
      }
    },
    sessionPartyType: 'party-game-truth-or-dare',
    window: null
  };
  context.window = context;

  const sandbox = vm.createContext(context);
  vm.runInContext(
    fs.readFileSync(path.join(onlineDirectory, 'party-api/players.js'), 'utf8'),
    sandbox,
    { filename: 'party-api/players.js' }
  );

  assert.equal(
    await sandbox.PartyApiPlayers.UpdateUserReady({
      partyId: 'ABC-123',
      computerId: 'guest-one',
      newReady: true
    }),
    true
  );

  responseOk = false;
  assert.equal(
    await sandbox.PartyApiPlayers.UpdateUserReady({
      partyId: 'ABC-123',
      computerId: 'guest-one',
      newReady: false
    }),
    false
  );
});

test('existing-player socket refresh explicitly completes an auth transition', async () => {
  const lifecycle = [];
  const context = {
    console: { error() {}, log() {}, warn() {} },
    currentPartyData: null,
    fetch: async () => ({
      ok: true,
      status: 200,
      json: async () => {
        lifecycle.push('player-patched');
        return { updated: { partyId: 'ABC-123' } };
      }
    }),
    PartyApiActions: { performOnlinePartyAction() {} },
    PartyApiPartyData: {
      getExistingPartyData() {},
      requireOnlinePartyId(value) {
        return value;
      }
    },
    PartyAuthTransition: {
      async completeCurrentPartyAuthTransition() {
        lifecycle.push('transition-completed');
        return true;
      }
    },
    sessionPartyType: 'party-game-truth-or-dare',
    window: null
  };
  context.window = context;

  const sandbox = vm.createContext(context);
  vm.runInContext(
    fs.readFileSync(path.join(onlineDirectory, 'party-api/players.js'), 'utf8'),
    sandbox,
    { filename: 'party-api/players.js' }
  );

  await sandbox.PartyApiPlayers.UpdateUserPartyData({
    partyId: 'ABC-123',
    computerId: 'guest-device',
    newUserSocketId: 'returning-socket'
  });

  assert.deepEqual(lifecycle, ['player-patched', 'transition-completed']);
});

test('account logout continues the active lobby player with the guest profile', async () => {
  const requests = [];
  const eventListeners = new Map();
  const context = {
    console: { error() {}, log() {}, warn() {} },
    currentPartyData: {
      partyId: 'ABC-123',
      players: [
        {
          identity: {
            computerId: 'host-device',
            accountId: 'account-one',
            username: 'Account Name'
          }
        }
      ]
    },
    deviceId: 'host-device',
    fetch: async (url, options) => {
      requests.push({ url, options });
      return {
        ok: true,
        json: async () => ({
          success: true,
          updated: {
            partyId: 'ABC-123',
            players: [
              {
                identity: {
                  computerId: 'host-device',
                  accountId: null,
                  username: 'OE12345678',
                  userIcon: 'guest-icon'
                }
              }
            ]
          }
        })
      };
    },
    getStoredUserIconString: () => 'guest-icon',
    partyCode: 'ABC-123',
    resolveOnlineUsername: async () => 'OE12345678',
    sessionPartyType: 'party-game-truth-or-dare',
    window: null
  };
  context.window = context;
  context.addEventListener = (type, listener) => {
    eventListeners.set(type, listener);
  };
  const sandbox = vm.createContext(context);
  ['party-api/party-data.js', 'party-api/account-link.js'].forEach(
    (scriptPath) => {
      vm.runInContext(
        fs.readFileSync(path.join(onlineDirectory, scriptPath), 'utf8'),
        sandbox,
        { filename: scriptPath }
      );
    }
  );
  sandbox.PartyApiAccountLink.bindPartyAccountLinkListener();

  await eventListeners.get('oe-account-state-changed')({
    detail: { isLoggedIn: false }
  });

  assert.equal(requests.length, 1);
  assert.equal(
    requests[0].url,
    '/api/party-game-truth-or-dare/continue-player-as-guest?partyCode=ABC-123'
  );
  const body = JSON.parse(requests[0].options.body);
  assert.equal(body.computerId, 'host-device');
  assert.equal(body.newUsername, 'OE12345678');
  assert.equal(body.newUserIcon, 'guest-icon');
  assert.equal(sandbox.currentPartyData.players[0].identity.accountId, null);
});

function createDeletePartySandbox(fetchImpl) {
  const dispatchedEvents = [];
  const clearedChat = [];
  const context = {
    console: { error() {}, log() {}, warn() {} },
    currentPartyData: { partyId: 'ABC-123' },
    CustomEvent: class CustomEvent {
      constructor(type, options = {}) {
        this.type = type;
        this.detail = options.detail;
      }
    },
    debugLog() {},
    deviceId: 'host-device',
    fetch: fetchImpl,
    hostDeviceId: 'host-device',
    hostedParty: true,
    isPlaying: false,
    partyCode: 'ABC-123',
    postToBothEndpoints() {},
    sessionPartyType: 'party-game-truth-or-dare',
    socket: { emit() {} },
    waitingForHost: false,
    window: null
  };
  context.window = context;
  context.onlinePartyTeardownInProgress = false;
  context.PartyChat = { clearMessages: () => clearedChat.push(true) };
  context.removeOnlineSettingsPartyCodeFromUrl = () => {};
  context.dispatchEvent = (event) => dispatchedEvents.push(event);
  context.addEventListener = () => {};

  const sandbox = vm.createContext(context);
  supportScripts.forEach((scriptPath) => {
    vm.runInContext(
      fs.readFileSync(path.join(onlineDirectory, scriptPath), 'utf8'),
      sandbox,
      { filename: scriptPath }
    );
  });

  return { sandbox, dispatchedEvents, clearedChat };
}

test('DeleteParty waits for server confirmation before clearing local state', async () => {
  const requests = [];
  const { sandbox, dispatchedEvents, clearedChat } = createDeletePartySandbox(
    async (url, options) => {
      requests.push({ url, options });
      return {
        ok: true,
        json: async () => ({
          success: true,
          data: { partyCode: 'ABC-123' }
        })
      };
    }
  );

  await sandbox.PartyApiPlayers.DeleteParty();

  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, '/api/party-game-truth-or-dare/delete');
  assert.equal(requests[0].options.method, 'POST');
  assert.equal(requests[0].options.keepalive, true);
  assert.equal(sandbox.partyCode, null);
  assert.equal(sandbox.currentPartyData, null);
  assert.equal(sandbox.hostedParty, false);
  assert.equal(clearedChat.length, 1);
  assert.equal(dispatchedEvents.length, 1);
  assert.equal(dispatchedEvents[0].type, 'oe-active-party-lobby-disbanded');
});

test('DeleteParty preserves the active party when server deletion fails', async () => {
  const { sandbox, dispatchedEvents, clearedChat } = createDeletePartySandbox(
    async () => ({
      ok: false,
      json: async () => ({
        success: false,
        error: { message: 'Database deletion failed' }
      })
    })
  );

  await assert.rejects(
    sandbox.PartyApiPlayers.DeleteParty(),
    /Database deletion failed/
  );

  assert.equal(sandbox.partyCode, 'ABC-123');
  assert.equal(sandbox.currentPartyData.partyId, 'ABC-123');
  assert.equal(sandbox.hostedParty, true);
  assert.equal(sandbox.onlinePartyTeardownInProgress, false);
  assert.equal(clearedChat.length, 0);
  assert.equal(dispatchedEvents.length, 0);
});

test('UpdateUserPartyData surfaces the structured server error message', async () => {
  const { sandbox } = createDeletePartySandbox(async () => ({
    ok: false,
    status: 400,
    json: async () => ({
      success: false,
      error: {
        code: 'missing_computer_id',
        message: 'computerId is required',
        details: { field: 'computerId' }
      }
    })
  }));

  await assert.rejects(
    sandbox.PartyApiPlayers.UpdateUserPartyData({
      partyId: 'ABC-123',
      computerId: null
    }),
    (error) => {
      assert.equal(error.message, 'computerId is required');
      assert.equal(error.code, 'missing_computer_id');
      assert.equal(error.status, 400);
      assert.equal(error.details.field, 'computerId');
      return true;
    }
  );
});

test('account linking shows an active-party conflict even in silent mode', async () => {
  const shownConflicts = [];
  const requests = [];
  const eventListeners = new Map();
  const context = {
    console: { error() {}, log() {}, warn() {} },
    debugLog() {},
    deviceId: 'guest-device',
    fetch: async (url) => {
      requests.push(url);
      return {
        ok: false,
        status: 409,
        json: async () => ({
          success: false,
          error: {
            code: 'party_owner_active_party_exists',
            message: 'This account already owns an active party',
            details: {
              partyCode: 'OLD-123',
              lobbyPath: '/OLD-123'
            }
          }
        })
      };
    },
    partyCode: 'NEW-456',
    sessionPartyType: 'party-games',
    window: null
  };
  context.window = context;
  context.addEventListener = (type, listener) => {
    eventListeners.set(type, listener);
  };
  context.ActivePartyConflictDialog = {
    openFromError(value, options) {
      shownConflicts.push({ value, options });
      return true;
    }
  };
  const sandbox = vm.createContext(context);
  ['party-api/party-data.js', 'party-api/account-link.js'].forEach(
    (scriptPath) => {
      vm.runInContext(
        fs.readFileSync(path.join(onlineDirectory, scriptPath), 'utf8'),
        sandbox,
        { filename: scriptPath }
      );
    }
  );
  sandbox.PartyApiAccountLink.bindPartyAccountLinkListener();

  const result =
    await sandbox.PartyApiAccountLink.linkCurrentPartyPlayerToAccount();
  await sandbox.PartyApiAccountLink.linkCurrentPartyPlayerToAccount();

  assert.equal(result, null);
  assert.equal(requests.length, 2);
  assert.equal(shownConflicts.length, 1);
  assert.equal(
    shownConflicts[0].value.error.code,
    'party_owner_active_party_exists'
  );
  assert.equal(shownConflicts[0].options.source, 'account-link');

  eventListeners.get('oe-account-state-changed')({
    detail: { isLoggedIn: false }
  });
  await sandbox.PartyApiAccountLink.linkCurrentPartyPlayerToAccount();
  assert.equal(shownConflicts.length, 2);

  await sandbox.PartyApiAccountLink.linkCurrentPartyPlayerToAccount({
    partyId: 'NEW-789'
  });
  assert.equal(shownConflicts.length, 3);

  await sandbox.PartyApiAccountLink.linkCurrentPartyPlayerToAccount({
    accountId: 'account-two',
    partyId: 'NEW-789'
  });
  assert.equal(shownConflicts.length, 4);
});

test('account linking reconciles an already signed-in player when binding', async () => {
  const requests = [];
  const context = {
    console: { error() {}, log() {}, warn() {} },
    currentPartyData: null,
    deviceId: 'guest-device',
    fetch: async (url, options) => {
      requests.push({ url, options });
      return {
        ok: true,
        status: 200,
        json: async () => ({ success: true, linked: true })
      };
    },
    localStorage: {
      getItem(key) {
        return key === 'oe-account'
          ? JSON.stringify({ id: 'account-one' })
          : null;
      }
    },
    partyCode: 'ABC-123',
    sessionPartyType: 'party-game-truth-or-dare',
    window: null
  };
  context.window = context;
  context.addEventListener = () => {};
  const sandbox = vm.createContext(context);
  ['party-api/party-data.js', 'party-api/account-link.js'].forEach(
    (scriptPath) => {
      vm.runInContext(
        fs.readFileSync(path.join(onlineDirectory, scriptPath), 'utf8'),
        sandbox,
        { filename: scriptPath }
      );
    }
  );

  sandbox.PartyApiAccountLink.bindPartyAccountLinkListener();
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(requests.length, 1);
  assert.equal(
    requests[0].url,
    '/api/party-game-truth-or-dare/link-player-account?partyCode=ABC-123'
  );
  assert.deepEqual(JSON.parse(requests[0].options.body), {
    partyId: 'ABC-123',
    computerId: 'guest-device'
  });
});

test('account-link replacement ends the old party and retries the current link', async () => {
  const requests = [];
  const endedParties = [];
  let conflictOptions = null;
  const context = {
    console: { error() {}, log() {}, warn() {} },
    currentPartyData: {
      players: [{ identity: { computerId: 'guest-device' } }]
    },
    deviceId: 'guest-device',
    fetch: async (url) => {
      requests.push(url);
      if (requests.length === 1) {
        return {
          ok: false,
          status: 409,
          json: async () => ({
            success: false,
            error: {
              code: 'party_owner_active_party_exists',
              details: {
                partyCode: 'OLD-123',
                gamemode: 'truth-or-dare',
                apiRoute: 'party-game-truth-or-dare'
              }
            }
          })
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          linked: true,
          updated: { players: [{ identity: { accountId: 'account-one' } }] }
        })
      };
    },
    localStorage: {
      getItem: () => JSON.stringify({ id: 'account-one' })
    },
    partyCode: 'NEW-456',
    sessionPartyType: 'party-game-truth-or-dare',
    window: null
  };
  context.window = context;
  context.addEventListener = () => {};
  context.ActivePartyConflictDialog = {
    async endOwnedParty(party) {
      endedParties.push(party);
    },
    openFromError(_value, options) {
      conflictOptions = options;
      return true;
    }
  };
  const sandbox = vm.createContext(context);
  ['party-api/party-data.js', 'party-api/account-link.js'].forEach(
    (scriptPath) => {
      vm.runInContext(
        fs.readFileSync(path.join(onlineDirectory, scriptPath), 'utf8'),
        sandbox,
        { filename: scriptPath }
      );
    }
  );

  const firstResult =
    await sandbox.PartyApiAccountLink.linkCurrentPartyPlayerToAccount();
  assert.equal(firstResult, null);
  assert.equal(typeof conflictOptions.onContinue, 'function');

  const linked = await conflictOptions.onContinue({
    partyCode: 'OLD-123',
    gamemode: 'Truth Or Dare',
    apiRoute: 'party-game-truth-or-dare'
  });

  assert.deepEqual(endedParties, [
    {
      partyCode: 'OLD-123',
      gamemode: 'Truth Or Dare',
      apiRoute: 'party-game-truth-or-dare'
    }
  ]);
  assert.equal(requests.length, 2);
  assert.match(requests[1], /NEW-456/);
  assert.equal(linked.linked, true);
  assert.equal(
    context.currentPartyData.players[0].identity.accountId,
    'account-one'
  );
});

test('party-code reservation preserves active-party conflict metadata', async () => {
  const requests = [];
  const conflictDetails = {
    partyCode: 'OLD-123',
    lobbyPath: '/OLD-123',
    gamemode: 'truth-or-dare'
  };
  const context = {
    fetch: async (url, options) => {
      requests.push({ url, options });
      return {
        ok: false,
        status: 409,
        json: async () => ({
          success: false,
          requestId: 'request-conflict-1',
          error: {
            code: 'party_owner_active_party_exists',
            message: 'You already own an active party.',
            details: conflictDetails
          }
        })
      };
    },
    partyCode: '',
    window: null
  };
  context.window = context;
  const sandbox = vm.createContext(context);
  vm.runInContext(fs.readFileSync(partyDataPath, 'utf8'), sandbox, {
    filename: 'party-api/party-data.js'
  });

  await assert.rejects(
    sandbox.PartyApiPartyData.reserveUniquePartyCode(),
    (error) => {
      assert.equal(error.message, 'You already own an active party.');
      assert.equal(error.code, 'party_owner_active_party_exists');
      assert.equal(error.status, 409);
      assert.equal(error.requestId, 'request-conflict-1');
      assert.equal(error.details.partyCode, 'OLD-123');
      assert.equal(error.details.lobbyPath, '/OLD-123');
      assert.equal(error.details.gamemode, 'truth-or-dare');
      return true;
    }
  );

  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, '/api/party-code/reserve');
  assert.equal(requests[0].options.method, 'POST');
});

test('dual-endpoint posts preserve structured API error metadata', async () => {
  const requests = [];
  const context = vm.createContext({
    console: { error() {}, warn() {} },
    fetch: async (url) => {
      requests.push(url);
      return {
        ok: false,
        status: 409,
        json: async () => ({
          success: false,
          requestId: 'request-conflict-2',
          error: {
            code: 'party_owner_active_party_exists',
            message: 'You already own an active party.',
            details: {
              partyCode: 'OLD-123',
              lobbyPath: '/OLD-123'
            }
          }
        })
      };
    }
  });
  vm.runInContext(fs.readFileSync(partySyncPath, 'utf8'), context, {
    filename: 'party-core/sync.js'
  });

  await assert.rejects(
    context.postToBothEndpoints(
      { partyId: 'NEW-456' },
      '/api/party-game-truth-or-dare',
      '/api/waiting-room'
    ),
    (error) => {
      assert.equal(error.message, 'You already own an active party.');
      assert.equal(error.code, 'party_owner_active_party_exists');
      assert.equal(error.status, 409);
      assert.equal(error.requestId, 'request-conflict-2');
      assert.equal(error.details.partyCode, 'OLD-123');
      assert.equal(error.details.lobbyPath, '/OLD-123');
      return true;
    }
  );

  assert.deepEqual(requests, ['/api/party-game-truth-or-dare']);
});

test('dual-endpoint posts mirror the server-assigned session to the waiting room', async () => {
  const requests = [];
  const serverSession = {
    gameId: 'TOD-0123456789ABCDEFFEDCBA9876543210',
    createdAt: '2026-08-06T12:00:00.000Z'
  };
  const context = vm.createContext({
    console: { error() {}, warn() {} },
    fetch: async (url, options) => {
      requests.push({ url, body: JSON.parse(options.body) });
      return {
        ok: true,
        status: 200,
        json: async () => ({ updated: { session: serverSession } })
      };
    }
  });
  vm.runInContext(fs.readFileSync(partySyncPath, 'utf8'), context, {
    filename: 'party-core/sync.js'
  });

  await context.postToBothEndpoints(
    {
      partyId: 'NEW-456',
      session: { createdAt: 'client-time' }
    },
    '/api/party-game-truth-or-dare',
    '/api/waiting-room'
  );

  assert.equal(requests.length, 2);
  assert.deepEqual(requests[0].body.session, { createdAt: 'client-time' });
  assert.deepEqual(requests[1].body.session, serverSession);
});
