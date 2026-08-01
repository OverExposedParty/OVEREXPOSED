const crypto = require('crypto');
const { normalizeMafiaRoleCounts } = require('./mafia-role-counts');
const {
  getMafiaRoleBehaviour
} = require('../game-engine/party-runtime/mafia-role-behaviours');

function createMafiaAssignmentError(message, code, details = {}) {
  const error = new Error(message);
  error.status = 400;
  error.code = code;
  error.details = details;
  return error;
}

function shuffleMafiaRoleKeys(roleKeys, randomInt = crypto.randomInt) {
  const shuffled = [...roleKeys];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(index + 1);
    [shuffled[index], shuffled[swapIndex]] = [
      shuffled[swapIndex],
      shuffled[index]
    ];
  }

  return shuffled;
}

function buildMafiaRoleAssignment({
  config = {},
  roles = [],
  playerCount,
  randomInt
}) {
  if (!Number.isInteger(playerCount) || playerCount <= 0) {
    throw createMafiaAssignmentError(
      'Mafia requires at least one player for role assignment.',
      'invalid_mafia_player_count',
      { playerCount }
    );
  }

  const fillRole = roles.find((role) => role.selection?.fillRemaining);
  if (!fillRole) {
    throw createMafiaAssignmentError(
      'The published Mafia role catalog needs a fill-remaining role.',
      'mafia_fill_role_missing'
    );
  }

  for (const role of roles) {
    if (!getMafiaRoleBehaviour(role.key)) {
      throw createMafiaAssignmentError(
        `Role "${role.key}" does not have a registered Mafia behavior.`,
        'mafia_role_behaviour_missing',
        { roleKey: role.key }
      );
    }
  }

  const roleCounts = normalizeMafiaRoleCounts(config, roles);
  const assignedRoleKeys = [];

  for (const role of roles) {
    if (role.selection?.fillRemaining) continue;
    const count = roleCounts[role.key] ?? 0;
    for (let index = 0; index < count; index += 1) {
      assignedRoleKeys.push(role.key);
    }
  }

  if (assignedRoleKeys.length > playerCount) {
    throw createMafiaAssignmentError(
      `Configured Mafia roles (${assignedRoleKeys.length}) exceed the player count (${playerCount}).`,
      'mafia_role_count_exceeds_players',
      {
        configuredRoleCount: assignedRoleKeys.length,
        playerCount
      }
    );
  }

  const fillRoleKey = fillRole.key;
  while (assignedRoleKeys.length < playerCount) {
    assignedRoleKeys.push(fillRoleKey);
  }

  return shuffleMafiaRoleKeys(assignedRoleKeys, randomInt);
}

module.exports = {
  buildMafiaRoleAssignment,
  createMafiaAssignmentError,
  shuffleMafiaRoleKeys
};
