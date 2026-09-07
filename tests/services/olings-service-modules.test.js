const assert = require('node:assert/strict');
const test = require('node:test');

const olings = require('../../server/services/olings');
const definitions = require('../../server/services/olings/definitions');
const energy = require('../../server/services/olings/energy');
const accountState = require('../../server/services/olings/account-state');
const interactions = require('../../server/services/olings/interactions');
const storage = require('../../server/services/olings/storage');
const storageDiagnostics = require('../../server/services/olings/storage-diagnostics');
const rarityPalette = require('../../public/json-files/olings/rarities.json');

const expectedExports = [
  'ENERGY_RESTORE_THRESHOLDS',
  'OLING_LAB_ACTIVE_LIMIT',
  'OLING_LAYERS',
  'OLING_MAX_ENERGY',
  'OLING_POD_RELEASE_OUTCOMES',
  'OLING_RARITIES',
  'OLING_RESIDENCY_STATES',
  'OLING_REST_DURATION_MS',
  'assignLegacyStoredOlingsToPodStorage',
  'attachOlingBuildSetsToEggs',
  'exportOlingConsumablesToJson',
  'findAvailableLabSlot',
  'getOlingDefinitions',
  'getOlingEnergy',
  'getOlingEnergyStatus',
  'getOlingPodDefinition',
  'getOlingRoster',
  'getOlingRestDurationMs',
  'getOlingRestRemainingMs',
  'getOrCreateOlingState',
  'getPodStorageContainers',
  'hatchOling',
  'importOlingDefinitionsFromJson',
  'listOlingConsumables',
  'listOlingPodDefinitions',
  'listPublishedOlingEggs',
  'listPublishedOlingTraits',
  'releaseOlingFromPod',
  'recordOlingStorageDiagnostic',
  'serializeHatchReceipt',
  'serializeOlingConsumable',
  'serializeOlingConsumableForJson',
  'serializeOlingEgg',
  'serializeOlingPodDefinition',
  'serializeOlingResidency',
  'serializeOlingTrait',
  'serializePlayerOling',
  'spendOlingEnergy',
  'storeOlingInPod',
  'transferStoredOling',
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
  assert.equal(
    olings.getOrCreateOlingState,
    accountState.getOrCreateOlingState
  );
  assert.equal(olings.hatchOling, interactions.hatchOling);
  assert.equal(olings.transferStoredOling, storage.transferStoredOling);
  assert.equal(
    olings.recordOlingStorageDiagnostic,
    storageDiagnostics.recordOlingStorageDiagnostic
  );
});
