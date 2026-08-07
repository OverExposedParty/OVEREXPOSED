const assert = require('node:assert/strict');
const test = require('node:test');

const {
  bumpSemanticVersion,
  registerOePanelGameModeRoutes
} = require('../../server/routes/api-oe-panel-party-games/game-mode-routes');
const {
  countRoomVersions,
  createArchivedVersionBreakdown,
  formatVersionCounts,
  formatVersionErrorRates
} = require('../../server/routes/api-oe-panel-party-games/party-room-routes');

function createLeanQuery(value) {
  return {
    async lean() {
      return structuredClone(value);
    }
  };
}

test('semantic game-mode versions support guarded release bumps', () => {
  assert.equal(bumpSemanticVersion('1.2.3', 'patch'), '1.2.4');
  assert.equal(bumpSemanticVersion('1.2.3', 'minor'), '1.3.0');
  assert.equal(bumpSemanticVersion('1.2.3', 'major'), '2.0.0');
  assert.equal(bumpSemanticVersion('invalid', 'patch'), null);
  assert.equal(bumpSemanticVersion('1.2.3', 'unknown'), null);
});

test('release health helpers keep legacy and versioned room cohorts separate', () => {
  const activeVersions = countRoomVersions(
    [
      { gamemode: 'paranoia', gameModeVersion: '2.0.0' },
      { gamemode: 'paranoia', gameModeVersion: '2.0.0' },
      { gamemode: 'paranoia', gameModeVersion: 'Legacy' },
      { gamemode: 'mafia', gameModeVersion: '1.0.0' }
    ],
    'paranoia'
  );
  const archivedVersions = createArchivedVersionBreakdown(
    [
      {
        _id: { gamemode: 'paranoia', version: '2.0.0' },
        rooms: 10,
        roomsWithErrors: 2
      },
      {
        _id: { gamemode: 'paranoia', version: 'Legacy' },
        rooms: 4,
        roomsWithErrors: 1
      }
    ],
    'paranoia'
  );

  assert.equal(formatVersionCounts(activeVersions), 'v2.0.0: 2, Legacy: 1');
  assert.equal(
    formatVersionErrorRates(archivedVersions),
    'v2.0.0: 20%, Legacy: 25%'
  );
});

test('game-mode release route bumps atomically and records its release note', async () => {
  let handler;
  let savedUpdate;
  const adminLogs = [];
  const currentGameMode = {
    gameType: 'paranoia',
    name: 'Paranoia',
    version: '2.4.1'
  };
  const context = {
    app: {
      patch(path, callback) {
        assert.equal(path, '/api/oe-panel/game-modes/:gameType/version');
        handler = callback;
      },
      post() {}
    },
    async requireOePanelAccount() {
      return {
        _id: '64f000000000000000000001',
        username: 'release-admin'
      };
    },
    requireOePanelPermission(_account, _res, permission) {
      assert.equal(permission, 'party_games.release');
      return true;
    },
    GameMode: {
      findOne() {
        return createLeanQuery(currentGameMode);
      },
      findOneAndUpdate(filter, update) {
        assert.deepEqual(filter, {
          gameType: 'paranoia',
          version: '2.4.1'
        });
        savedUpdate = update;
        return createLeanQuery({ ...currentGameMode, version: '2.5.0' });
      }
    },
    AdminLog: {},
    async createAdminLog(_model, _account, entry) {
      adminLogs.push(entry);
    },
    formatPartyGameLabel: (value) => value
  };
  registerOePanelGameModeRoutes(context);

  let result;
  await handler(
    {
      id: 'release-test',
      params: { gameType: 'paranoia' },
      body: {
        bump: 'minor',
        expectedVersion: '2.4.1',
        releaseNote: 'Adds the revised voting flow.'
      }
    },
    {
      apiSuccess(payload) {
        result = payload;
      },
      apiError(payload) {
        assert.fail(payload.message);
      }
    }
  );

  assert.equal(savedUpdate.$set.version, '2.5.0');
  assert.equal(
    savedUpdate.$push.releaseHistory.releaseNote,
    'Adds the revised voting flow.'
  );
  assert.equal(adminLogs[0].metadata.bumpType, 'minor');
  assert.equal(result.data.row.configuredVersion, 'v2.5.0');
});
