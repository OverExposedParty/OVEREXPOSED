function toPlainObject(value) {
  if (value instanceof Map) return Object.fromEntries(value);
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return { ...value };
  }
  return {};
}

function createInvalidRoleCountsError(message, details = {}) {
  const error = new Error(message);
  error.status = 400;
  error.code = 'invalid_role_counts';
  error.details = details;
  return error;
}

function normalizeSubmittedCounts(value) {
  return toPlainObject(value);
}

function normalizeMafiaRoleCounts(config = {}, roles = []) {
  const rolesByKey = new Map(roles.map((role) => [role.key, role]));
  if (
    !Object.prototype.hasOwnProperty.call(config, 'roleCounts') ||
    config.roleCounts === null ||
    config.roleCounts === undefined
  ) {
    throw createInvalidRoleCountsError(
      'Mafia configuration requires roleCounts.',
      { field: 'roleCounts' }
    );
  }
  const source = normalizeSubmittedCounts(config.roleCounts);

  for (const key of Object.keys(source)) {
    if (!rolesByKey.has(key)) {
      throw createInvalidRoleCountsError(
        `Role "${key}" is not available for this game.`,
        { roleKey: key }
      );
    }
  }

  const roleCounts = {};
  for (const role of roles) {
    const rawCount = Object.prototype.hasOwnProperty.call(source, role.key)
      ? source[role.key]
      : (role.selection?.defaultCount ?? 0);
    const count = Number(rawCount);

    if (!Number.isInteger(count) || count < 0) {
      throw createInvalidRoleCountsError(
        `Role "${role.key}" count must be a non-negative integer.`,
        { roleKey: role.key, count: rawCount }
      );
    }

    const minimum = Number(role.selection?.minimum ?? 0);
    const maximum = Number(role.selection?.maximum ?? 20);
    if (count < minimum || count > maximum) {
      throw createInvalidRoleCountsError(
        `Role "${role.key}" count must be between ${minimum} and ${maximum}.`,
        { roleKey: role.key, count, minimum, maximum }
      );
    }

    roleCounts[role.key] = count;
  }

  return roleCounts;
}

module.exports = {
  createInvalidRoleCountsError,
  normalizeMafiaRoleCounts,
  toPlainObject
};
