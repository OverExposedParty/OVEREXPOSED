const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');

const { serializeAchievementForJson } = require('./achievements');
const { serializeGameModeForJson } = require('./game-modes');
const {
  serializePackMetadataForJson,
  serializePackQuestionsForJson
} = require('./game-packs');
const { serializeRuleForApi } = require('./game-rules');
const { serializeRoleForJson } = require('./game-roles');
const { serializeOlingConsumableForJson } = require('./olings');

const JSON_ROOT = path.join(process.cwd(), 'public', 'json-files');
const SYNC_ACTIONS = {
  'party-game-modes': {
    endpoint: '/api/oe-panel/game-modes/export',
    successMessage: 'Party game modes exported to JSON.',
    refreshKeys: ['system', 'partyRooms']
  },
  'party-game-packs': {
    endpoint: '/api/oe-panel/game-packs/export',
    successMessage: 'Party game packs exported to JSON.',
    refreshKeys: ['system', 'partyRooms']
  },
  'party-game-rules': {
    endpoint: '/api/oe-panel/game-rules/export',
    successMessage: 'Party game rules exported to JSON.',
    refreshKeys: ['system', 'partyRooms']
  },
  achievements: {
    endpoint: '/api/oe-panel/achievements/export',
    successMessage: 'Achievements exported to JSON.',
    refreshKeys: ['system', 'achievements']
  },
  'oling-consumables': {
    endpoint: '/api/oe-panel/olings/consumables/export',
    successMessage: 'oLing consumables exported to JSON.',
    refreshKeys: ['system', 'olings']
  }
};

function sortObject(value) {
  if (Array.isArray(value)) return value.map(sortObject);
  if (!value || typeof value !== 'object') return value;

  return Object.keys(value)
    .sort()
    .reduce((sorted, key) => {
      sorted[key] = sortObject(value[key]);
      return sorted;
    }, {});
}

function stableHash(value) {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify(sortObject(value)))
    .digest('hex');
}

async function readJsonIfPresent(filePath) {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

function createAlert(result) {
  const fileText =
    result.files.length === 1
      ? result.files[0]
      : `${result.files.length} files`;
  const syncAction = SYNC_ACTIONS[result.id] || {};

  return {
    id: `content-sync-${result.id}`,
    title: `${result.label} JSON backup is out of sync`,
    severity: 'warning',
    area: result.area,
    detail: `The database is the source of truth. Export ${result.label} to refresh ${fileText}.`,
    target: result.id,
    syncEndpoint: syncAction.endpoint || null,
    syncConfirmMessage: `Export ${result.label} from the database to JSON now?`,
    syncSuccessMessage:
      syncAction.successMessage || `${result.label} exported to JSON.`,
    syncRefreshKeys: syncAction.refreshKeys || ['system']
  };
}

function createUnavailableAlert(result) {
  return {
    id: `content-sync-${result.id}-unavailable`,
    title: `${result.label} sync check could not run`,
    severity: 'medium',
    area: result.area,
    detail: result.error || 'The database or JSON backup could not be read.',
    target: result.id
  };
}

async function compareSingleFile({ id, label, area, filePath, getExpected }) {
  const expected = await getExpected();
  const actual = await readJsonIfPresent(filePath);

  return {
    id,
    label,
    area,
    files: [path.relative(process.cwd(), filePath)],
    status:
      actual && stableHash(actual) === stableHash(expected)
        ? 'synced'
        : 'out_of_sync'
  };
}

async function compareGamePacks(GamePack) {
  if (!GamePack) {
    return {
      id: 'party-game-packs',
      label: 'Party game packs',
      area: 'Party Games',
      files: [],
      status: 'unavailable',
      error: 'GamePack model is not available.'
    };
  }

  const packs = await GamePack.find({}).sort({ gameType: 1, slug: 1 }).lean();
  const comparisons = [];
  const packsByGameType = new Map();

  for (const pack of packs) {
    if (!packsByGameType.has(pack.gameType)) {
      packsByGameType.set(pack.gameType, []);
    }
    packsByGameType.get(pack.gameType).push(pack);

    const filePath = path.join(
      JSON_ROOT,
      'party-games',
      'questions',
      pack.gameType,
      `${pack.slug}.json`
    );
    comparisons.push({
      filePath,
      expected: serializePackQuestionsForJson(pack),
      actual: await readJsonIfPresent(filePath)
    });
  }

  for (const [gameType, gamePacks] of packsByGameType) {
    const filePath = path.join(
      JSON_ROOT,
      'party-games',
      'packs',
      `${gameType}.json`
    );
    comparisons.push({
      filePath,
      expected: {
        [`${gameType}-packs`]: gamePacks.map(serializePackMetadataForJson)
      },
      actual: await readJsonIfPresent(filePath)
    });
  }

  const mismatched = comparisons.filter(
    ({ actual, expected }) =>
      !actual || stableHash(actual) !== stableHash(expected)
  );

  return {
    id: 'party-game-packs',
    label: 'Party game packs',
    area: 'Party Games',
    files: comparisons.map(({ filePath }) =>
      path.relative(process.cwd(), filePath)
    ),
    status: mismatched.length ? 'out_of_sync' : 'synced',
    mismatchedFiles: mismatched.map(({ filePath }) =>
      path.relative(process.cwd(), filePath)
    )
  };
}

async function compareGameRules(GameRule) {
  if (!GameRule) {
    return {
      id: 'party-game-rules',
      label: 'Party game rules',
      area: 'Party Games',
      files: [],
      status: 'unavailable',
      error: 'GameRule model is not available.'
    };
  }

  const rules = await GameRule.find({}).sort({ gameType: 1, key: 1 }).lean();
  const rulesByGameType = new Map();

  for (const rule of rules) {
    if (!rulesByGameType.has(rule.gameType)) {
      rulesByGameType.set(rule.gameType, []);
    }
    rulesByGameType.get(rule.gameType).push(rule);
  }

  const comparisons = [];
  for (const [gameType, gameRules] of rulesByGameType) {
    const firstRule = gameRules[0] || {};
    const serializedRules = gameRules.map(serializeRuleForApi);
    const filePath = path.join(
      JSON_ROOT,
      'party-games',
      'settings',
      `${gameType}.json`
    );
    const expected =
      firstRule.scope === 'global'
        ? {
            scope: firstRule.scope,
            'applies-to': Array.isArray(firstRule.appliesTo)
              ? firstRule.appliesTo
              : [],
            settings: serializedRules
          }
        : { [`${gameType}-settings`]: serializedRules };

    comparisons.push({
      filePath,
      expected,
      actual: await readJsonIfPresent(filePath)
    });
  }

  const mismatched = comparisons.filter(
    ({ actual, expected }) =>
      !actual || stableHash(actual) !== stableHash(expected)
  );

  return {
    id: 'party-game-rules',
    label: 'Party game rules',
    area: 'Party Games',
    files: comparisons.map(({ filePath }) =>
      path.relative(process.cwd(), filePath)
    ),
    status: mismatched.length ? 'out_of_sync' : 'synced',
    mismatchedFiles: mismatched.map(({ filePath }) =>
      path.relative(process.cwd(), filePath)
    )
  };
}

async function compareGameRoles(GameRole) {
  if (!GameRole) {
    return {
      id: 'party-game-roles',
      label: 'Party game roles',
      area: 'Party Games',
      files: [],
      status: 'unavailable',
      error: 'GameRole model is not available.'
    };
  }

  const roles = await GameRole.find({})
    .sort({ gameType: 1, sortOrder: 1, key: 1 })
    .lean();
  const rolesByGameType = new Map();

  for (const role of roles) {
    if (!rolesByGameType.has(role.gameType)) {
      rolesByGameType.set(role.gameType, []);
    }
    rolesByGameType.get(role.gameType).push(role);
  }

  const comparisons = [];
  for (const [gameType, gameRoles] of rolesByGameType) {
    const filePath = path.join(
      JSON_ROOT,
      'party-games',
      'roles',
      `${gameType}.json`
    );
    comparisons.push({
      filePath,
      expected: {
        [`${gameType}-roles`]: gameRoles.map(serializeRoleForJson)
      },
      actual: await readJsonIfPresent(filePath)
    });
  }

  const mismatched = comparisons.filter(
    ({ actual, expected }) =>
      !actual || stableHash(actual) !== stableHash(expected)
  );

  return {
    id: 'party-game-roles',
    label: 'Party game roles',
    area: 'Party Games',
    files: comparisons.map(({ filePath }) =>
      path.relative(process.cwd(), filePath)
    ),
    status: mismatched.length ? 'out_of_sync' : 'synced',
    mismatchedFiles: mismatched.map(({ filePath }) =>
      path.relative(process.cwd(), filePath)
    )
  };
}

async function runCheck(check) {
  try {
    return await check();
  } catch (error) {
    return {
      id: check.id,
      label: check.label,
      area: check.area,
      files: [],
      status: 'unavailable',
      error: error.message || String(error)
    };
  }
}

async function getContentSyncHealth(models = {}) {
  const checks = [
    Object.assign(
      () =>
        compareSingleFile({
          id: 'party-game-modes',
          label: 'Party game modes',
          area: 'Party Games',
          filePath: path.join(
            JSON_ROOT,
            'party-games',
            'gamemodes',
            'gamemodes.json'
          ),
          getExpected: async () => {
            const gameModes = await models.GameMode.find({})
              .sort({ sortOrder: 1, gameType: 1 })
              .lean();
            return gameModes.map(serializeGameModeForJson);
          }
        }),
      {
        id: 'party-game-modes',
        label: 'Party game modes',
        area: 'Party Games'
      }
    ),
    Object.assign(() => compareGamePacks(models.GamePack), {
      id: 'party-game-packs',
      label: 'Party game packs',
      area: 'Party Games'
    }),
    Object.assign(() => compareGameRules(models.GameRule), {
      id: 'party-game-rules',
      label: 'Party game rules',
      area: 'Party Games'
    }),
    Object.assign(() => compareGameRoles(models.GameRole), {
      id: 'party-game-roles',
      label: 'Party game roles',
      area: 'Party Games'
    }),
    Object.assign(
      () =>
        compareSingleFile({
          id: 'achievements',
          label: 'Achievements',
          area: 'Achievements',
          filePath: path.join(JSON_ROOT, 'achievements', 'achievements.json'),
          getExpected: async () => {
            const achievements = await models.Achievement.find({})
              .sort({ category: 1, sortOrder: 1, key: 1 })
              .lean();
            return {
              achievements: achievements.map(serializeAchievementForJson)
            };
          }
        }),
      {
        id: 'achievements',
        label: 'Achievements',
        area: 'Achievements'
      }
    ),
    Object.assign(
      () =>
        compareSingleFile({
          id: 'oling-consumables',
          label: 'oLing consumables',
          area: 'oLings',
          filePath: path.join(JSON_ROOT, 'olings', 'consumables.json'),
          getExpected: async () => {
            const consumables = await models.OlingConsumable.find({})
              .sort({ category: 1, subcategory: 1, key: 1 })
              .lean();
            return {
              consumables: consumables
                .map(serializeOlingConsumableForJson)
                .filter(Boolean)
            };
          }
        }),
      {
        id: 'oling-consumables',
        label: 'oLing consumables',
        area: 'oLings'
      }
    )
  ];

  const results = await Promise.all(checks.map(runCheck));
  const alerts = results
    .filter((result) => result.status === 'out_of_sync')
    .map(createAlert)
    .concat(
      results
        .filter((result) => result.status === 'unavailable')
        .map(createUnavailableAlert)
    );

  return {
    checkedAt: new Date().toISOString(),
    stats: {
      total: results.length,
      synced: results.filter((result) => result.status === 'synced').length,
      outOfSync: results.filter((result) => result.status === 'out_of_sync')
        .length,
      unavailable: results.filter((result) => result.status === 'unavailable')
        .length
    },
    results,
    alerts
  };
}

module.exports = {
  getContentSyncHealth
};
