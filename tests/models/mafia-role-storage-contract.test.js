const assert = require('node:assert/strict');
const test = require('node:test');

const ArchivedRoom = require('../../models/party-games/archived-room-schema');
const Mafia = require('../../models/party-games/party-game-mafia-schema');
const WaitingRoom = require('../../models/party-games/waiting-room-schema');

test('party room schemas use the definitive Mafia role storage contract', () => {
  assert.equal(WaitingRoom.schema.path('config.selectedRoles'), undefined);
  assert.ok(WaitingRoom.schema.path('config.roleCounts'));

  assert.equal(ArchivedRoom.schema.path('config.selectedRoles'), undefined);
  assert.ok(ArchivedRoom.schema.path('config.roleCounts'));

  assert.equal(Mafia.schema.path('players.state.role'), undefined);
  assert.ok(Mafia.schema.path('players.state.roleKey'));
  assert.ok(Mafia.schema.path('config.roleCounts'));
});
