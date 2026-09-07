const assert = require('node:assert/strict');
const test = require('node:test');
const mongoose = require('mongoose');

const OlingClashMatch = require('../../models/olings/oling-clash-match-schema');
const {
  advanceAbilityCadence
} = require('../../server/services/oling-clashes/ability-cadence');

test('a newly created Mongoose cadence entry advances on its first use', () => {
  const match = new OlingClashMatch({
    players: [
      {
        accountId: new mongoose.Types.ObjectId(),
        slot: 'player-one',
        team: [{ teamSlot: 0, abilityProgress: [] }]
      }
    ]
  });
  const oling = match.players[0].team[0];
  const ability = {
    key: 'stone-harden',
    revision: 2,
    cadence: { every: 2, mode: 'cumulative' }
  };

  const first = advanceAbilityCadence(oling, ability);
  const second = advanceAbilityCadence(oling, ability);

  assert.equal(first.beforeActivationCount, 0);
  assert.equal(first.afterActivationCount, 1);
  assert.equal(first.triggered, false);
  assert.equal(second.beforeActivationCount, 1);
  assert.equal(second.afterActivationCount, 0);
  assert.equal(second.triggered, true);
  assert.equal(oling.abilityProgress[0].activationCount, 0);
});
