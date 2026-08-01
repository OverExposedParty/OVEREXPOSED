const fs = require('fs/promises');
const path = require('path');
const {
  normalizeGameContentAccess,
  serializeGameContentAccess
} = require('./game-content-access');
const {
  filterAvailableContent,
  normalizeStoredAvailability,
  serializeAvailability
} = require('./game-content-availability');

const ROLES_ROOT = path.join(
  process.cwd(),
  'public',
  'json-files',
  'party-games',
  'roles'
);

const ROLE_STATUSES = new Set(['draft', 'published', 'archived']);
const ROLE_FACTIONS = new Set(['civilian', 'mafioso', 'neutral']);

function titleFromKey(key) {
  return String(key || '')
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function normalizeDescription(description) {
  if (description === null || description === undefined) return null;
  const normalized = String(description).trim();
  return normalized || null;
}

function normalizeRoleKey(key) {
  return String(key || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function normalizeFaction(faction) {
  const normalized = String(faction || '')
    .trim()
    .toLowerCase();
  if (normalized === 'neautral') return 'neutral';
  if (ROLE_FACTIONS.has(normalized)) return normalized;
  return null;
}

function normalizeInteger(value, fallback) {
  if (value === null || value === undefined || value === '') return fallback;
  const number = Number(value);
  return Number.isInteger(number) ? number : fallback;
}

function normalizeStatus(status, active) {
  const normalized = String(status || '')
    .trim()
    .toLowerCase();
  if (ROLE_STATUSES.has(normalized)) return normalized;
  return active === false ? 'draft' : 'published';
}

function normalizeSelection(rawRole = {}) {
  return {
    defaultCount: normalizeInteger(
      rawRole['role-default-count'] ?? rawRole.selection?.defaultCount,
      0
    ),
    increment: normalizeInteger(
      rawRole['role-increment'] ?? rawRole.selection?.increment,
      1
    ),
    minimum: normalizeInteger(
      rawRole['role-minimum'] ?? rawRole.selection?.minimum,
      0
    ),
    maximum: normalizeInteger(
      rawRole['role-maximum'] ?? rawRole.selection?.maximum,
      20
    ),
    fillRemaining: Boolean(
      rawRole['role-fill-remaining'] ?? rawRole.selection?.fillRemaining
    )
  };
}

function normalizeRoleFromJson(rawRole, gameType) {
  const key = normalizeRoleKey(rawRole['role-name'] ?? rawRole.key);
  const active = rawRole['role-active'] !== false;

  return {
    gameType: String(gameType || '')
      .trim()
      .toLowerCase(),
    key,
    title:
      String(rawRole['role-title'] ?? rawRole.title ?? '').trim() ||
      titleFromKey(key),
    description: normalizeDescription(
      rawRole['role-description'] ?? rawRole.description
    ),
    faction: normalizeFaction(
      rawRole['role-faction'] ?? rawRole.faction ?? rawRole['mafia-type']
    ),
    enabled: active,
    status: normalizeStatus(rawRole['role-status'] ?? rawRole.status, active),
    availability: normalizeStoredAvailability(rawRole.availability),
    access: normalizeGameContentAccess(rawRole.access),
    selection: normalizeSelection(rawRole),
    assets: {
      colour: String(
        rawRole['role-colour'] ?? rawRole.assets?.colour ?? ''
      ).trim(),
      secondaryColour: String(
        rawRole['role-secondary-colour'] ??
          rawRole.assets?.secondaryColour ??
          ''
      ).trim()
    },
    sortOrder: normalizeInteger(
      rawRole['role-sort-order'] ?? rawRole.sortOrder,
      0
    )
  };
}

function assertValidSelection(role) {
  const selection = role.selection || {};
  const integerFields = ['defaultCount', 'increment', 'minimum', 'maximum'];

  for (const field of integerFields) {
    if (!Number.isInteger(selection[field])) {
      throw new Error(`Role "${role.key}" ${field} must be an integer.`);
    }
  }

  if (selection.increment < 1) {
    throw new Error(`Role "${role.key}" increment must be at least 1.`);
  }
  if (selection.minimum < 0 || selection.maximum < selection.minimum) {
    throw new Error(`Role "${role.key}" has an invalid selection range.`);
  }
  if (
    selection.defaultCount < selection.minimum ||
    selection.defaultCount > selection.maximum
  ) {
    throw new Error(`Role "${role.key}" default count is outside its range.`);
  }
}

function assertValidRoleCatalog(roles, gameType) {
  const keys = new Set();
  let fillRemainingCount = 0;

  for (const role of roles) {
    if (!role.key) throw new Error(`A ${gameType} role is missing its key.`);
    if (keys.has(role.key)) {
      throw new Error(`Duplicate ${gameType} role key "${role.key}".`);
    }
    keys.add(role.key);

    if (!ROLE_FACTIONS.has(role.faction)) {
      throw new Error(`Role "${role.key}" has an invalid faction.`);
    }
    assertValidSelection(role);

    if (
      role.enabled &&
      role.status === 'published' &&
      role.selection?.fillRemaining
    ) {
      fillRemainingCount += 1;
    }
  }

  if (fillRemainingCount > 1) {
    throw new Error(
      `${gameType} has more than one published fill-remaining role.`
    );
  }

  return roles;
}

function serializeRoleForJson(role) {
  const selection = role.selection || {};
  const output = {
    'role-name': role.key,
    'role-title': String(role.title || titleFromKey(role.key)).trim(),
    'role-description': normalizeDescription(role.description),
    'role-faction': normalizeFaction(role.faction),
    'role-colour': role.assets?.colour || '',
    'role-secondary-colour': role.assets?.secondaryColour || '',
    'role-default-count': normalizeInteger(selection.defaultCount, 0),
    'role-increment': normalizeInteger(selection.increment, 1),
    'role-minimum': normalizeInteger(selection.minimum, 0),
    'role-maximum': normalizeInteger(selection.maximum, 20),
    'role-fill-remaining': Boolean(selection.fillRemaining),
    'role-sort-order': normalizeInteger(role.sortOrder, 0),
    'role-active': Boolean(role.enabled && role.status === 'published'),
    'role-status': normalizeStatus(role.status, role.enabled),
    availability: serializeAvailability(role.availability)
  };
  const access = serializeGameContentAccess(role.access);

  if (access) output.access = access;
  return output;
}

function serializeRoleForApi(role) {
  return serializeRoleForJson(role);
}

function getRoleAccess(role = {}) {
  return normalizeGameContentAccess(role.access);
}

async function readJsonFile(filePath) {
  return JSON.parse(await fs.readFile(filePath, 'utf8'));
}

async function getRolesFromJson(gameType) {
  const data = await readJsonFile(path.join(ROLES_ROOT, `${gameType}.json`));
  const roles = Array.isArray(data[`${gameType}-roles`])
    ? data[`${gameType}-roles`]
    : [];
  return assertValidRoleCatalog(
    roles
      .map((role) => normalizeRoleFromJson(role, gameType))
      .filter((role) => role.key),
    gameType
  );
}

async function importGameRolesFromJson(GameRole) {
  const files = await fs.readdir(ROLES_ROOT);
  const imported = [];

  for (const fileName of files.filter((file) => file.endsWith('.json'))) {
    const gameType = path.basename(fileName, '.json');
    const roles = await getRolesFromJson(gameType);

    for (const role of roles) {
      const importedRole = await GameRole.findOneAndUpdate(
        { gameType, key: role.key },
        { $set: role },
        { new: true, upsert: true, runValidators: true }
      );
      imported.push(importedRole);
    }
  }

  return imported;
}

async function exportGameRolesToJson(GameRole) {
  const roles = await GameRole.find({})
    .sort({ gameType: 1, sortOrder: 1, key: 1 })
    .lean();
  const byGameType = new Map();

  for (const role of roles) {
    if (!byGameType.has(role.gameType)) byGameType.set(role.gameType, []);
    byGameType.get(role.gameType).push(role);
  }

  await fs.mkdir(ROLES_ROOT, { recursive: true });

  for (const [gameType, gameRoles] of byGameType) {
    assertValidRoleCatalog(gameRoles, gameType);
    const serialized = gameRoles.map(serializeRoleForJson);
    await fs.writeFile(
      path.join(ROLES_ROOT, `${gameType}.json`),
      `${JSON.stringify({ [`${gameType}-roles`]: serialized }, null, 2)}\n`
    );
  }

  return roles;
}

async function getPublishedRoles(GameRole, gameType, options = {}) {
  try {
    const roles = await GameRole.find({
      gameType,
      enabled: true,
      status: 'published'
    })
      .sort({ sortOrder: 1, key: 1 })
      .lean();

    if (roles.length) {
      return assertValidRoleCatalog(
        filterAvailableContent(roles, options),
        gameType
      );
    }
  } catch (error) {
    console.warn(
      `Falling back to JSON game roles for "${gameType}":`,
      error.message || error
    );
  }

  try {
    const roles = await getRolesFromJson(gameType);
    return filterAvailableContent(
      roles.filter((role) => role.enabled && role.status === 'published'),
      options
    );
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.warn(
        `Unable to read JSON game roles for "${gameType}":`,
        error.message || error
      );
    }
    return [];
  }
}

module.exports = {
  assertValidRoleCatalog,
  exportGameRolesToJson,
  getPublishedRoles,
  getRoleAccess,
  importGameRolesFromJson,
  normalizeRoleFromJson,
  serializeRoleForApi,
  serializeRoleForJson
};
