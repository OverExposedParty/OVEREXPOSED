const assert = require('node:assert/strict');
const test = require('node:test');

const olings = require('../../server/services/olings');
const definitions = require('../../server/services/olings/definitions');
const energy = require('../../server/services/olings/energy');
const accountState = require('../../server/services/olings/account-state');
const interactions = require('../../server/services/olings/interactions');
const rarityPalette = require('../../public/json-files/olings/rarities.json');

const expectedExports = [
  'ENERGY_RESTORE_THRESHOLDS',
  'OLING_LAYERS',
  'OLING_MAX_ENERGY',
  'OLING_RARITIES',
  'OLING_REST_DURATION_MS',
  'attachOlingBuildSetsToEggs',
  'awardOlingXp',
  'exportOlingConsumablesToJson',
  'getOlingAdventureEnergyCost',
  'getOlingBedRestDurationMs',
  'getOlingDefinitions',
  'getOlingEnergy',
  'getOlingEnergyStatus',
  'getOlingRestDurationMs',
  'getOlingRestRemainingMs',
  'getOrCreateOlingState',
  'hatchOling',
  'importOlingDefinitionsFromJson',
  'listOlingConsumables',
  'listOlingPersonalities',
  'listPublishedOlingEggs',
  'listPublishedOlingPersonalities',
  'listPublishedOlingTraits',
  'serializeHatchReceipt',
  'serializeOlingConsumable',
  'serializeOlingConsumableForJson',
  'serializeOlingEgg',
  'serializeOlingPersonality',
  'serializeOlingTrait',
  'serializePlayerOling',
  'spendOlingEnergy',
  'useOlingConsumable'
];

test('Oling rarity palette covers every Oling rarity', () => {
  assert.deepEqual(Object.keys(rarityPalette), olings.OLING_RARITIES);
});

test('Oling service facade preserves its public contract', () => {
  assert.deepEqual(Object.keys(olings).sort(), expectedExports.sort());
});

test('Oling service facade delegates to focused modules', () => {
  assert.equal(olings.serializePlayerOling, definitions.serializePlayerOling);
  assert.equal(olings.getOlingEnergy, energy.getOlingEnergy);
  assert.equal(olings.getOrCreateOlingState, accountState.getOrCreateOlingState);
  assert.equal(olings.hatchOling, interactions.hatchOling);
});
