const shared = require('./olings/shared');
const definitions = require('./olings/definitions');
const energy = require('./olings/energy');
const accountState = require('./olings/account-state');
const interactions = require('./olings/interactions');
const podCatalog = require('./olings/pod-catalog');
const residency = require('./olings/residency');
const storage = require('./olings/storage');
const storageDiagnostics = require('./olings/storage-diagnostics');

module.exports = {
  OLING_LAB_ACTIVE_LIMIT: shared.OLING_LAB_ACTIVE_LIMIT,
  OLING_LAYERS: shared.OLING_LAYERS,
  OLING_POD_RELEASE_OUTCOMES: shared.OLING_POD_RELEASE_OUTCOMES,
  OLING_RARITIES: shared.OLING_RARITIES,
  OLING_RESIDENCY_STATES: shared.OLING_RESIDENCY_STATES,
  OLING_MAX_ENERGY: shared.OLING_MAX_ENERGY,
  OLING_REST_DURATION_MS: shared.OLING_REST_DURATION_MS,
  ENERGY_RESTORE_THRESHOLDS: shared.ENERGY_RESTORE_THRESHOLDS,
  attachOlingBuildSetsToEggs: definitions.attachOlingBuildSetsToEggs,
  exportOlingConsumablesToJson: definitions.exportOlingConsumablesToJson,
  hatchOling: interactions.hatchOling,
  importOlingDefinitionsFromJson: definitions.importOlingDefinitionsFromJson,
  listOlingConsumables: definitions.listOlingConsumables,
  listOlingPodDefinitions: podCatalog.listOlingPodDefinitions,
  listPublishedOlingEggs: definitions.listPublishedOlingEggs,
  listPublishedOlingTraits: definitions.listPublishedOlingTraits,
  serializeHatchReceipt: definitions.serializeHatchReceipt,
  serializeOlingConsumable: definitions.serializeOlingConsumable,
  serializeOlingConsumableForJson: definitions.serializeOlingConsumableForJson,
  serializeOlingEgg: definitions.serializeOlingEgg,
  serializeOlingPodDefinition: podCatalog.serializeOlingPodDefinition,
  serializeOlingResidency: definitions.serializeOlingResidency,
  serializeOlingTrait: definitions.serializeOlingTrait,
  serializePlayerOling: definitions.serializePlayerOling,
  getOlingDefinitions: definitions.getOlingDefinitions,
  getOlingPodDefinition: podCatalog.getOlingPodDefinition,
  getOlingEnergy: energy.getOlingEnergy,
  getOlingRestDurationMs: energy.getOlingRestDurationMs,
  getOlingRestRemainingMs: energy.getOlingRestRemainingMs,
  getOlingEnergyStatus: energy.getOlingEnergyStatus,
  findAvailableLabSlot: residency.findAvailableLabSlot,
  getOlingRoster: residency.getOlingRoster,
  getOrCreateOlingState: accountState.getOrCreateOlingState,
  assignLegacyStoredOlingsToPodStorage:
    storage.assignLegacyStoredOlingsToPodStorage,
  getPodStorageContainers: storage.getPodStorageContainers,
  releaseOlingFromPod: storage.releaseOlingFromPod,
  recordOlingStorageDiagnostic: storageDiagnostics.recordOlingStorageDiagnostic,
  spendOlingEnergy: energy.spendOlingEnergy,
  storeOlingInPod: storage.storeOlingInPod,
  transferStoredOling: storage.transferStoredOling,
  useOlingConsumable: interactions.useOlingConsumable
};
