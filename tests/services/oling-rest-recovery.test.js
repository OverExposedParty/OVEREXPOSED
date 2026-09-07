const test = require('node:test');
const assert = require('node:assert/strict');

const {
  applyConsumableEffectToOling,
  getOlingEnergy,
  getOlingRestDurationMs,
  getOlingRestRemainingMs
} = require('../../server/services/olings/energy');

test('Oling rest durations follow the placed bed rarity', () => {
  assert.equal(getOlingRestDurationMs('common'), 10 * 60 * 60 * 1000);
  assert.equal(getOlingRestDurationMs('uncommon'), 8 * 60 * 60 * 1000);
  assert.equal(getOlingRestDurationMs('rare'), 6 * 60 * 60 * 1000);
  assert.equal(getOlingRestDurationMs('epic'), 4.5 * 60 * 60 * 1000);
  assert.equal(getOlingRestDurationMs('legendary'), 3 * 60 * 60 * 1000);
  assert.equal(getOlingRestDurationMs('mythic'), 2 * 60 * 60 * 1000);
});

test('sleep restores missing energy linearly using the saved bed duration', () => {
  const startedAt = Date.parse('2026-06-21T12:00:00.000Z');
  const durationMs = getOlingRestDurationMs('uncommon');
  const oling = {
    care: {
      energy: 25,
      isSleeping: true,
      sleepUpdatedAt: new Date(startedAt),
      sleepBedRarity: 'uncommon',
      sleepDurationMs: durationMs
    }
  };

  assert.equal(getOlingEnergy(oling, startedAt + durationMs / 2), 75);
  assert.equal(
    getOlingRestRemainingMs(oling, startedAt + durationMs / 2),
    durationMs / 4
  );
  assert.equal(getOlingEnergy(oling, startedAt + durationMs), 100);
});

test('Oling consumables no longer apply legacy XP effects', () => {
  const writes = [];
  const oling = {
    level: 3,
    xp: 90,
    set(path, value) {
      writes.push([path, value]);
    }
  };

  applyConsumableEffectToOling(oling, {
    effect: { type: 'xp', amount: 25 }
  });

  assert.deepEqual(writes, []);
});

test('O-Juice restores an Oling to 75 Energy without reducing higher Energy', () => {
  const consumable = {
    key: 'o-juice',
    effect: { type: 'energy', restoreToEnergy: 75 }
  };

  for (const [startingEnergy, expectedEnergy] of [
    [20, 75],
    [90, 90]
  ]) {
    const writes = [];
    const oling = {
      care: { energy: startingEnergy },
      set(path, value) {
        writes.push([path, value]);
      }
    };

    applyConsumableEffectToOling(oling, consumable);
    assert.deepEqual(writes[0], ['care.energy', expectedEnergy]);
  }
});
