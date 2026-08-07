const assert = require('node:assert/strict');
const test = require('node:test');

const {
  createGameModeReleaseService,
  createReleaseMetadata,
  createReleaseMetadataFromContent,
  getRuntimeBuild
} = require('../../server/services/game-mode-releases');

function createQuery(value) {
  return {
    async lean() {
      return structuredClone(value);
    }
  };
}

test('release metadata is deterministic and changes with content or build', () => {
  const base = {
    gamemode: 'truth-or-dare',
    version: '2.1.0',
    runtimeBuild: 'commit-one',
    manifest: { rules: [{ key: 'rounds', maximumValue: 20 }] },
    capturedAt: new Date('2026-08-06T12:00:00.000Z')
  };
  const first = createReleaseMetadata(base);
  const same = createReleaseMetadata(base);
  const contentChange = createReleaseMetadata({
    ...base,
    manifest: { rules: [{ key: 'rounds', maximumValue: 30 }] }
  });
  const buildChange = createReleaseMetadata({
    ...base,
    runtimeBuild: 'commit-two'
  });

  assert.equal(first.version, '2.1.0');
  assert.equal(first.runtimeBuild, 'commit-one');
  assert.equal(first.releaseId, same.releaseId);
  assert.equal(first.contentHash, same.contentHash);
  assert.notEqual(first.contentHash, contentChange.contentHash);
  assert.notEqual(first.releaseId, contentChange.releaseId);
  assert.notEqual(first.releaseId, buildChange.releaseId);
});

test('release resolver fingerprints published game content independent of query order', async () => {
  let reverseResults = false;
  const rules = [
    { key: 'rounds', title: 'Rounds', enabled: true },
    { key: 'timer', title: 'Timer', enabled: true }
  ];
  const service = createGameModeReleaseService({
    GameMode: {
      findOne() {
        return createQuery({ gameType: 'paranoia', version: '3.0.0' });
      }
    },
    GameRule: {
      find() {
        return createQuery(reverseResults ? [...rules].reverse() : rules);
      }
    },
    runtimeBuild: 'build-123'
  });

  const first = await service.resolveGameModeRelease({ gamemode: 'paranoia' });
  reverseResults = true;
  const second = await service.resolveGameModeRelease({ gamemode: 'paranoia' });

  assert.equal(first.version, '3.0.0');
  assert.equal(first.runtimeBuild, 'build-123');
  assert.equal(first.contentHash, second.contentHash);
  assert.equal(first.releaseId, second.releaseId);
});

test('runtime build prefers an immutable deployment commit', () => {
  assert.equal(
    getRuntimeBuild({
      GAME_RUNTIME_BUILD: '',
      RENDER_GIT_COMMIT: 'render-commit',
      WEBSITE_CACHE_VERSION: 'cache-version'
    }),
    'render-commit'
  );
});

test('semantic version and release history do not alter the content hash', () => {
  const content = {
    gamemode: 'paranoia',
    runtimeBuild: 'build-one',
    rules: [{ key: 'rounds', maximumValue: 20 }]
  };
  const first = createReleaseMetadataFromContent({
    ...content,
    gameMode: { gameType: 'paranoia', version: '1.0.0', releaseHistory: [] }
  });
  const second = createReleaseMetadataFromContent({
    ...content,
    gameMode: {
      gameType: 'paranoia',
      version: '1.1.0',
      releaseHistory: [{ version: '1.1.0', releaseNote: 'Version bump' }]
    }
  });

  assert.equal(first.contentHash, second.contentHash);
  assert.notEqual(first.releaseId, second.releaseId);
});
