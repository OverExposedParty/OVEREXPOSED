const test = require('node:test');
const assert = require('node:assert/strict');

const {
  getOlingAdventureEnergyCost,
  getOlingBedRestDurationMs,
  getOlingEnergy,
  getOlingRestDurationMs,
  getOlingRestRemainingMs
} = require('../../server/services/olings');

test('Oling rest durations follow the placed bed rarity', () => {
  assert.equal(getOlingRestDurationMs('common'), 10 * 60 * 60 * 1000);
  assert.equal(getOlingRestDurationMs('uncommon'), 8 * 60 * 60 * 1000);
  assert.equal(getOlingRestDurationMs('rare'), 6 * 60 * 60 * 1000);
  assert.equal(getOlingRestDurationMs('epic'), 4.5 * 60 * 60 * 1000);
  assert.equal(getOlingRestDurationMs('legendary'), 3 * 60 * 60 * 1000);
  assert.equal(getOlingRestDurationMs('mythic'), 2 * 60 * 60 * 1000);
});

test('Lazy Olings recover 15 percent faster in the same bed', () => {
  assert.equal(
    getOlingBedRestDurationMs('uncommon', 'lazy'),
    8 * 60 * 60 * 1000 * 0.85
  );
  assert.equal(
    getOlingBedRestDurationMs('uncommon', 'curious'),
    8 * 60 * 60 * 1000
  );
});

test('Energetic Olings spend 15 percent less energy on adventures', () => {
  assert.equal(getOlingAdventureEnergyCost(10, 'energetic'), 8.5);
  assert.equal(getOlingAdventureEnergyCost(15, 'energetic'), 12.75);
  assert.equal(getOlingAdventureEnergyCost(10, 'lazy'), 10);
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
