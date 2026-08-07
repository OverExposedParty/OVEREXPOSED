const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const repositoryDirectory = path.join(__dirname, '..', '..');
const onlineDirectory = path.join(
  repositoryDirectory,
  'public/scripts/party-games/online'
);
const supportScripts = [
  'online-game-settings/active-lobby.js',
  'online-game-settings/session-profile.js',
  'online-game-settings/party-existence.js',
  'online-game-settings/toggle-online-mode.js',
  'online-game-settings/hosted-party-resume.js'
];
const settingsPages = [
  'imposter/imposter-settings-page.html',
  'mafia/mafia-settings-page.html',
  'most-likely-to/most-likely-to-settings-page.html',
  'never-have-i-ever/never-have-i-ever-settings-page.html',
  'paranoia/paranoia-settings-page.html',
  'truth-or-dare/truth-or-dare-settings-page.html',
  'would-you-rather/would-you-rather-settings-page.html'
];

test('online game settings support modules load before the compatibility facade', () => {
  settingsPages.forEach((settingsPage) => {
    const page = fs.readFileSync(
      path.join(repositoryDirectory, 'public/pages/party-games', settingsPage),
      'utf8'
    );
    const facadeIndex = page.indexOf(
      '"/scripts/party-games/online/online-game-settings.js"'
    );
    let previousIndex = -1;

    assert.ok(facadeIndex > -1, `${settingsPage} should configure the facade`);
    supportScripts.forEach((scriptPath) => {
      const index = page.indexOf(`/scripts/party-games/online/${scriptPath}`);
      assert.ok(
        index > previousIndex,
        `${scriptPath} should load in dependency order`
      );
      assert.ok(
        index < facadeIndex,
        `${scriptPath} should load before the facade`
      );
      previousIndex = index;
    });
  });
});

test('online game settings modules preserve their public handler contract', () => {
  const context = vm.createContext({
    window: { addEventListener: () => {}, currentOnlineShuffleSeed: null }
  });

  supportScripts.forEach((scriptPath) => {
    vm.runInContext(
      fs.readFileSync(path.join(onlineDirectory, scriptPath), 'utf8'),
      context,
      { filename: scriptPath }
    );
  });

  [
    'refreshActivePartyLobbyLock',
    'ToggleOnlineMode',
    'resetOnlineSettingsAfterMissingParty',
    'resumeHostedOnlinePartyFromUrl'
  ].forEach((handler) => {
    assert.equal(
      typeof context[handler],
      'function',
      `${handler} should remain public`
    );
  });
});

test('hosted settings do not resume a party without a resolvable host player', async () => {
  const resetReasons = [];
  let playerPatchAttempted = false;
  const context = vm.createContext({
    fetchedPacks: {},
    fetchedSettings: {},
    formatPackName: (value) => value,
    getExistingPartyData: async () => [
      {
        config: { gamemode: 'truth-or-dare' },
        players: [],
        session: { access: { originalHostAccountId: 'account-one' } },
        state: { hostComputerId: null, isPlaying: false, phase: 'lobby' }
      }
    ],
    getHostedOnlineSettingsAccess: async () => ({
      hostPlayer: null,
      hostComputerId: null,
      isHost: true
    }),
    partyCode: 'ABC-123',
    partyGameMode: 'truth-or-dare',
    resetOnlineSettingsAfterMissingParty: async (reason) => {
      resetReasons.push(reason);
    },
    UpdateUserPartyData: async () => {
      playerPatchAttempted = true;
    },
    window: {
      inputPartyCode: {},
      SetGamemodeButtons() {}
    }
  });

  vm.runInContext(
    fs.readFileSync(
      path.join(onlineDirectory, 'online-game-settings/hosted-party-resume.js'),
      'utf8'
    ),
    context,
    { filename: 'hosted-party-resume.js' }
  );

  assert.equal(await context.resumeHostedOnlinePartyFromUrl(), false);
  assert.deepEqual(resetReasons, ['resume-party-host-missing']);
  assert.equal(playerPatchAttempted, false);
});

test('active lobby membership can be left through the authenticated self-removal route', async () => {
  const requests = [];
  const events = [];
  const onlineButton = {
    disabled: false,
    title: '',
    classList: {
      remove() {},
      contains() {
        return false;
      }
    },
    setAttribute() {}
  };
  const context = vm.createContext({
    CustomEvent: class CustomEvent {
      constructor(type, options) {
        this.type = type;
        this.detail = options?.detail;
      }
    },
    SetButtonStyle() {},
    fetch: async (url, options) => {
      requests.push({ options, url });
      return {
        ok: true,
        status: 200,
        json: async () => ({ success: true })
      };
    },
    onlineButton,
    partyCode: '',
    partyGameMode: 'truth-or-dare',
    window: null
  });
  context.window = context;
  context.addEventListener = () => {};
  context.dispatchEvent = (event) => events.push(event);

  vm.runInContext(
    fs.readFileSync(
      path.join(onlineDirectory, 'online-game-settings/active-lobby.js'),
      'utf8'
    ),
    context,
    { filename: 'online-game-settings/active-lobby.js' }
  );

  await context.leaveActivePartyLobby({
    partyCode: 'ABC-123',
    apiRoute: 'party-game-truth-or-dare',
    playerComputerId: 'player-device'
  });

  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, '/api/party-game-truth-or-dare/remove-user');
  assert.deepEqual(JSON.parse(requests[0].options.body), {
    partyId: 'ABC-123',
    computerIdToRemove: 'player-device',
    actorComputerId: 'player-device',
    exitIntent: 'create-party'
  });
  assert.equal(events[0].type, 'oe-active-party-lobby-left');
  assert.equal(events[0].detail.partyCode, 'ABC-123');

  await context.endActiveOwnedParty({
    partyCode: 'DEF-456',
    gamemode: 'truth-or-dare'
  });

  assert.equal(requests[1].url, '/api/party-game-truth-or-dare/delete');
  assert.deepEqual(JSON.parse(requests[1].options.body), {
    partyCode: 'DEF-456'
  });
  assert.equal(events[1].type, 'oe-active-party-lobby-disbanded');
  assert.equal(events[1].detail.partyCode, 'DEF-456');
});

function createToggleConflictSandbox(
  reservationError,
  { withDialog = true } = {}
) {
  const dialogCalls = [];
  const onlineTabMutations = [];
  const context = {
    debugLog() {},
    deviceId: 'host-device',
    hostedParty: false,
    hostDeviceId: null,
    onlineSettingsTab: {
      classList: {
        remove(className) {
          onlineTabMutations.push(className);
        }
      }
    },
    partyCode: '',
    refreshActivePartyLobbyLock: async () => true,
    reserveUniquePartyCode: async () => {
      throw reservationError;
    },
    window: null
  };
  context.window = context;
  context.onlinePartyTeardownInProgress = true;
  if (withDialog) {
    context.ActivePartyConflictDialog = {
      openFromError(error, options) {
        dialogCalls.push({ error, options });
        return true;
      }
    };
  }

  const sandbox = vm.createContext(context);
  vm.runInContext(
    fs.readFileSync(
      path.join(onlineDirectory, 'online-game-settings/toggle-online-mode.js'),
      'utf8'
    ),
    sandbox,
    { filename: 'online-game-settings/toggle-online-mode.js' }
  );

  return { dialogCalls, onlineTabMutations, sandbox };
}

function createToggleLifecycleSandbox({
  deleteParty = async () => {},
  initialPartyCode = '',
  updateOnlineParty = async () => {}
} = {}) {
  const events = [];
  const playedInteractionSounds = [];
  const playedSounds = [];
  const registeredSounds = {};
  const classList = {
    add() {},
    remove() {}
  };
  const context = {
    DeleteParty: async (deletedPartyCode) => {
      events.push('delete:start');
      await deleteParty(deletedPartyCode);
      context.partyCode = '';
      events.push('delete:complete');
    },
    OEAudio: {
      register(definitions) {
        Object.assign(registeredSounds, definitions);
        return Promise.resolve();
      }
    },
    PartyChatReady: Promise.resolve({
      async sendMessage() {},
      displayLogs() {},
      setAvailable() {}
    }),
    SetGamemodeButtons() {},
    UpdateSettings: async () => {},
    allUsersReady: undefined,
    clearActivePartyLobbyLock() {},
    clearPlayerCountRestrictionError() {},
    currentOnlineShuffleSeed: null,
    currentPartyData: null,
    debugLog() {},
    deviceId: 'host-device',
    document: {
      querySelectorAll: () => []
    },
    gamemodeSelectedPacks: [],
    gamemodeSettings: {},
    getStoredUserIconString: () => 'host-icon',
    hideContainer() {},
    hostDeviceId: null,
    hostedParty: false,
    inputPartyCode: { value: initialPartyCode },
    joinParty: async () => {},
    onlineSettingsContainer: {},
    onlineSettingsTab: { classList },
    onlineUsername: '',
    packsContainer: {},
    packsSettingsTab: { classList },
    partyCode: initialPartyCode,
    partyGameMode: 'truth-or-dare',
    playSoundEffect(soundKey) {
      events.push(`sound:${soundKey}`);
      playedSounds.push(soundKey);
    },
    playInteractionSound(intent) {
      events.push(`interaction:${intent}`);
      playedInteractionSounds.push(intent);
    },
    promptOnlineHostForCustomOeIcon() {},
    refreshActivePartyLobbyLock: async () => true,
    removeOnlineSettingsPartyCodeFromUrl() {},
    reserveUniquePartyCode: async () => 'NEW-123',
    resolveOnlineUsername: async () => 'Host',
    rulesContainer: {},
    rulesSettingsTab: { classList },
    setOnlineSettingsPartyCodeInUrl() {},
    showContainer() {},
    socket: { id: 'socket-one' },
    startOnlinePartyExpiryMonitor() {},
    stopOnlinePartyExpiryMonitor() {},
    suppressActiveLobbyLockForDeletedParty() {},
    toggleUserCustomisationIcon() {},
    updateOnlineParty: async (party) => {
      events.push('create:start');
      const result = await updateOnlineParty(party);
      events.push('create:complete');
      return result;
    },
    updateStartGameButton() {},
    window: null
  };
  context.window = context;

  const sandbox = vm.createContext(context);
  vm.runInContext(
    fs.readFileSync(
      path.join(onlineDirectory, 'online-game-settings/toggle-online-mode.js'),
      'utf8'
    ),
    sandbox,
    { filename: 'online-game-settings/toggle-online-mode.js' }
  );

  return {
    events,
    playedInteractionSounds,
    playedSounds,
    registeredSounds,
    sandbox
  };
}

test('online party creation shows the shared dialog before committing host state', async () => {
  const conflict = new Error('You already own an active party.');
  conflict.code = 'party_owner_active_party_exists';
  conflict.details = { partyCode: 'OLD-123', lobbyPath: '/OLD-123' };
  const { dialogCalls, onlineTabMutations, sandbox } =
    createToggleConflictSandbox(conflict);
  sandbox.endActiveOwnedParty = async () => true;

  const enabled = await sandbox.ToggleOnlineMode(true);

  assert.equal(enabled, false);
  assert.equal(dialogCalls.length, 1);
  assert.equal(dialogCalls[0].error, conflict);
  assert.equal(dialogCalls[0].options.source, 'party-creation');
  assert.equal(typeof dialogCalls[0].options.onEndAndCreate, 'function');
  assert.equal(sandbox.partyCode, '');
  assert.equal(sandbox.hostedParty, false);
  assert.equal(sandbox.hostDeviceId, null);
  assert.equal(sandbox.onlinePartyTeardownInProgress, true);
  assert.deepEqual(onlineTabMutations, []);
});

test('participant conflict offers the authenticated leave-and-create action', async () => {
  const conflict = new Error('You are already in an active party.');
  conflict.code = 'party_participant_active_party_exists';
  conflict.details = {
    partyCode: 'OLD-123',
    apiRoute: 'party-game-truth-or-dare',
    playerComputerId: 'player-device'
  };
  const { dialogCalls, sandbox } = createToggleConflictSandbox(conflict);
  sandbox.leaveActivePartyLobby = async () => true;

  const enabled = await sandbox.ToggleOnlineMode(true);

  assert.equal(enabled, false);
  assert.equal(dialogCalls.length, 1);
  assert.equal(dialogCalls[0].error, conflict);
  assert.equal(typeof dialogCalls[0].options.onLeaveAndCreate, 'function');
});

test('online party creation rethrows non-conflict reservation failures', async () => {
  const reservationFailure = new Error('Reservation service unavailable.');
  reservationFailure.code = 'party_code_reserve_failed';
  const { dialogCalls, sandbox } =
    createToggleConflictSandbox(reservationFailure);

  await assert.rejects(
    sandbox.ToggleOnlineMode(true),
    (error) => error === reservationFailure
  );
  assert.equal(dialogCalls.length, 0);
});

test('online party creation rethrows a conflict when dialog support is unavailable', async () => {
  const conflict = new Error('You already own an active party.');
  conflict.code = 'party_owner_active_party_exists';
  const { sandbox } = createToggleConflictSandbox(conflict, {
    withDialog: false
  });

  await assert.rejects(
    sandbox.ToggleOnlineMode(true),
    (error) => error === conflict
  );
});

test('online lobby lifecycle sounds follow confirmed creation and deletion', async () => {
  const created = createToggleLifecycleSandbox();
  const progressValues = [];

  assert.equal(
    created.registeredSounds.gamemodeSettingsOnlineLobbyCreated.src,
    '/sounds/gamemode-settings/online-lobby-created.wav'
  );
  assert.equal(
    created.registeredSounds.gamemodeSettingsOnlineLobbyDeleted.src,
    '/sounds/gamemode-settings/online-lobby-deleted.mp3'
  );

  assert.equal(
    await created.sandbox.ToggleOnlineMode(true, {
      onProgress({ value }) {
        progressValues.push(value);
      },
      async onProgressComplete() {
        created.events.push('progress:complete');
      }
    }),
    true
  );
  assert.deepEqual(progressValues, [10, 30, 42, 55, 70, 82, 94, 100]);
  assert.deepEqual(created.events.slice(0, 4), [
    'create:start',
    'create:complete',
    'progress:complete',
    'sound:gamemodeSettingsOnlineLobbyCreated'
  ]);
  assert.deepEqual(created.playedSounds, [
    'gamemodeSettingsOnlineLobbyCreated'
  ]);

  const deleted = createToggleLifecycleSandbox({
    initialPartyCode: 'OLD-123'
  });

  assert.equal(await deleted.sandbox.ToggleOnlineMode(false), true);
  assert.deepEqual(deleted.events.slice(0, 3), [
    'delete:start',
    'delete:complete',
    'sound:gamemodeSettingsOnlineLobbyDeleted'
  ]);
  assert.deepEqual(deleted.playedSounds, [
    'gamemodeSettingsOnlineLobbyDeleted'
  ]);
});

test('online party creation adopts the server-assigned game id', async () => {
  let creationPayload = null;
  const serverGameId = 'TOD-0123456789ABCDEFFEDCBA9876543210';
  const created = createToggleLifecycleSandbox({
    updateOnlineParty: async (payload) => {
      creationPayload = payload;
      return {
        primary: {
          updated: {
            ...payload,
            session: {
              ...payload.session,
              gameId: serverGameId
            }
          }
        }
      };
    }
  });

  assert.equal(await created.sandbox.ToggleOnlineMode(true), true);
  assert.equal(creationPayload.session.gameId, undefined);
  assert.equal(created.sandbox.currentPartyData.session.gameId, serverGameId);
});

test('online lobby failures use the UI error sound while no-op toggles stay silent', async () => {
  const creationError = new Error('Party write failed.');
  const failedCreation = createToggleLifecycleSandbox({
    updateOnlineParty: async () => {
      throw creationError;
    }
  });

  await assert.rejects(
    failedCreation.sandbox.ToggleOnlineMode(true),
    (error) => error === creationError
  );
  assert.deepEqual(failedCreation.playedSounds, []);
  assert.deepEqual(failedCreation.playedInteractionSounds, ['error']);

  const deletionError = new Error('Party deletion failed.');
  const failedDeletion = createToggleLifecycleSandbox({
    deleteParty: async () => {
      throw deletionError;
    },
    initialPartyCode: 'OLD-123'
  });

  await assert.rejects(
    failedDeletion.sandbox.ToggleOnlineMode(false),
    (error) => error === deletionError
  );
  assert.deepEqual(failedDeletion.playedSounds, []);
  assert.deepEqual(failedDeletion.playedInteractionSounds, ['error']);

  const existingLobby = createToggleLifecycleSandbox({
    initialPartyCode: 'OLD-123'
  });
  assert.equal(await existingLobby.sandbox.ToggleOnlineMode(true), true);
  assert.deepEqual(existingLobby.playedSounds, []);
  assert.deepEqual(existingLobby.playedInteractionSounds, []);

  const missingLobby = createToggleLifecycleSandbox();
  assert.equal(await missingLobby.sandbox.ToggleOnlineMode(false), true);
  assert.deepEqual(missingLobby.playedSounds, []);
  assert.deepEqual(missingLobby.playedInteractionSounds, []);
});
