const assert = require('node:assert/strict');
const test = require('node:test');

const {
  MAFIA_ACTION_KEYS,
  MAFIA_ROLE_BEHAVIOURS,
  getMafiaActionExecutorKey,
  getMafiaAvailableActionKeys,
  getMafiaRoleActionKeys,
  getMafiaRoleTeamKey,
  mafiaRoleHasAction
} = require('../../server/game-engine/party-runtime/mafia-role-behaviours');
const { getPublishedRoles } = require('../../server/services/game-roles');

test('Inspector has a stable inspect-player action that temporarily runs Civilian Watch', () => {
  assert.deepEqual(getMafiaRoleActionKeys('inspector', 'night'), [
    MAFIA_ACTION_KEYS.INSPECT_PLAYER
  ]);
  assert.equal(
    getMafiaActionExecutorKey(MAFIA_ACTION_KEYS.INSPECT_PLAYER),
    MAFIA_ACTION_KEYS.CIVILIAN_WATCH
  );
  assert.equal(
    mafiaRoleHasAction('inspector', 'night', MAFIA_ACTION_KEYS.MAFIA_KILL_VOTE),
    false
  );
});

test('civilian-faction roles without special actions share Civilian Watch', () => {
  assert.deepEqual(getMafiaRoleActionKeys('civilian', 'night'), [
    MAFIA_ACTION_KEYS.CIVILIAN_WATCH
  ]);
  assert.deepEqual(getMafiaRoleActionKeys('mayor', 'night'), [
    MAFIA_ACTION_KEYS.CIVILIAN_WATCH
  ]);
});

test('Mafioso and Godfather share the Mafia kill vote action', () => {
  assert.deepEqual(getMafiaRoleActionKeys('mafioso', 'night'), [
    MAFIA_ACTION_KEYS.MAFIA_KILL_VOTE
  ]);
  assert.deepEqual(getMafiaRoleActionKeys('godfather', 'night'), [
    MAFIA_ACTION_KEYS.MAFIA_KILL_VOTE
  ]);
});

test('canonical role keys resolve their gameplay teams', () => {
  assert.equal(getMafiaRoleTeamKey('inspector'), 'town');
  assert.equal(getMafiaRoleTeamKey('godfather'), 'mafia');
  assert.equal(getMafiaRoleTeamKey('serial-killer'), 'neutral');
});

test('day voting is phase behaviour available to every role', () => {
  for (const roleKey of Object.keys(MAFIA_ROLE_BEHAVIOURS)) {
    assert.ok(
      getMafiaAvailableActionKeys(roleKey, 'day').includes(
        MAFIA_ACTION_KEYS.TOWN_VOTE
      )
    );
  }
});

test('role behaviour lookups require exact canonical keys', () => {
  assert.equal(getMafiaRoleTeamKey('serial-killer'), 'neutral');
  assert.equal(getMafiaRoleTeamKey('serial killer'), null);
  assert.equal(getMafiaRoleTeamKey('mafia-civilian'), null);
  assert.equal(getMafiaRoleTeamKey(' Inspector '), null);
});

test('every migrated Mafia role has a code-owned behaviour entry', async () => {
  const GameRole = {
    find() {
      return {
        sort() {
          return {
            lean: async () => []
          };
        }
      };
    }
  };

  const publishedRoles = await getPublishedRoles(GameRole, 'mafia');

  for (const role of publishedRoles) {
    assert.ok(MAFIA_ROLE_BEHAVIOURS[role.key], role.key);
  }
});
