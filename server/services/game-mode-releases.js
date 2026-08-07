const crypto = require('crypto');

const DEFAULT_GAME_MODE_VERSION = '1.0.0';
const HASH_IGNORED_KEYS = new Set(['_id', '__v', 'createdAt', 'updatedAt']);

function normalizeGamemode(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-');
}

function getRuntimeBuild(environment = process.env) {
  return String(
    environment.GAME_RUNTIME_BUILD ||
      environment.RENDER_GIT_COMMIT ||
      environment.VERCEL_GIT_COMMIT_SHA ||
      environment.GITHUB_SHA ||
      environment.WEBSITE_CACHE_VERSION ||
      'development'
  ).trim();
}

function normalizeForHash(value) {
  if (value === null || value === undefined) return value;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(normalizeForHash);
  if (typeof value !== 'object') return value;

  return Object.keys(value)
    .filter((key) => !HASH_IGNORED_KEYS.has(key))
    .sort()
    .reduce((normalized, key) => {
      normalized[key] = normalizeForHash(value[key]);
      return normalized;
    }, {});
}

function createContentHash(manifest) {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify(normalizeForHash(manifest)))
    .digest('hex');
}

function sortDocumentsForHash(documents) {
  return [...documents].sort((left, right) =>
    JSON.stringify(normalizeForHash(left)).localeCompare(
      JSON.stringify(normalizeForHash(right))
    )
  );
}

function createReleaseMetadata({
  gamemode,
  version = DEFAULT_GAME_MODE_VERSION,
  runtimeBuild = getRuntimeBuild(),
  manifest = {},
  capturedAt = new Date()
}) {
  const normalizedGamemode = normalizeGamemode(gamemode);
  const normalizedVersion = String(version || DEFAULT_GAME_MODE_VERSION).trim();
  const normalizedRuntimeBuild = String(runtimeBuild || 'development').trim();
  const contentHash = createContentHash({
    gamemode: normalizedGamemode,
    ...manifest
  });
  const releaseFingerprint = createContentHash({
    gamemode: normalizedGamemode,
    version: normalizedVersion,
    runtimeBuild: normalizedRuntimeBuild,
    contentHash
  }).slice(0, 16);

  return {
    version: normalizedVersion,
    releaseId: `${normalizedGamemode}@${normalizedVersion}+${releaseFingerprint}`,
    runtimeBuild: normalizedRuntimeBuild,
    contentHash,
    capturedAt
  };
}

function createReleaseMetadataFromContent({
  gamemode,
  gameMode,
  rules = [],
  packs = [],
  roles = [],
  runtimeBuild = getRuntimeBuild(),
  capturedAt = new Date()
}) {
  const version = gameMode?.version;
  const gameModeContent = { ...(gameMode || {}) };
  delete gameModeContent.version;
  delete gameModeContent.releaseHistory;

  return createReleaseMetadata({
    gamemode,
    version: version || DEFAULT_GAME_MODE_VERSION,
    runtimeBuild,
    capturedAt,
    manifest: {
      gameMode: gameModeContent,
      rules: sortDocumentsForHash(rules),
      packs: sortDocumentsForHash(packs),
      roles: sortDocumentsForHash(roles)
    }
  });
}

async function resolveLean(query) {
  if (!query) return null;
  return typeof query.lean === 'function' ? query.lean() : query;
}

async function findOneLean(model, filter) {
  if (typeof model?.findOne !== 'function') return null;
  return resolveLean(model.findOne(filter));
}

async function findManyLean(model, filter) {
  if (typeof model?.find !== 'function') return [];
  const result = await resolveLean(model.find(filter));
  return Array.isArray(result) ? result : [];
}

function createGameModeReleaseService({
  GameMode,
  GameRule,
  GamePack,
  GameRole,
  runtimeBuild = getRuntimeBuild()
} = {}) {
  async function resolveGameModeRelease({ gamemode }) {
    const normalizedGamemode = normalizeGamemode(gamemode);
    const [gameMode, rules, packs, roles] = await Promise.all([
      findOneLean(GameMode, { gameType: normalizedGamemode }),
      findManyLean(GameRule, {
        enabled: true,
        status: 'published',
        $or: [
          { gameType: normalizedGamemode },
          { scope: 'global', appliesTo: normalizedGamemode }
        ]
      }),
      findManyLean(GamePack, {
        gameType: normalizedGamemode,
        enabled: true,
        status: 'published'
      }),
      findManyLean(GameRole, {
        gameType: normalizedGamemode,
        enabled: true,
        status: 'published'
      })
    ]);

    return createReleaseMetadataFromContent({
      gamemode: normalizedGamemode,
      gameMode,
      runtimeBuild,
      rules,
      packs,
      roles
    });
  }

  return { resolveGameModeRelease };
}

module.exports = {
  DEFAULT_GAME_MODE_VERSION,
  createContentHash,
  createGameModeReleaseService,
  createReleaseMetadata,
  createReleaseMetadataFromContent,
  getRuntimeBuild,
  normalizeForHash,
  sortDocumentsForHash
};
