const shared = require('./olings/shared');
const definitions = require('./olings/definitions');
const energy = require('./olings/energy');
const accountState = require('./olings/account-state');
const interactions = require('./olings/interactions');

module.exports = {
  OLING_LAYERS: shared.OLING_LAYERS,
  OLING_RARITIES: shared.OLING_RARITIES,
  OLING_MAX_ENERGY: shared.OLING_MAX_ENERGY,
  OLING_REST_DURATION_MS: shared.OLING_REST_DURATION_MS,
  ENERGY_RESTORE_THRESHOLDS: shared.ENERGY_RESTORE_THRESHOLDS,
  attachOlingBuildSetsToEggs: definitions.attachOlingBuildSetsToEggs,
  exportOlingConsumablesToJson: definitions.exportOlingConsumablesToJson,
  hatchOling: interactions.hatchOling,
  importOlingDefinitionsFromJson: definitions.importOlingDefinitionsFromJson,
  listOlingConsumables: definitions.listOlingConsumables,
  listOlingPersonalities: definitions.listOlingPersonalities,
  listPublishedOlingEggs: definitions.listPublishedOlingEggs,
  listPublishedOlingPersonalities: definitions.listPublishedOlingPersonalities,
  listPublishedOlingTraits: definitions.listPublishedOlingTraits,
  serializeHatchReceipt: definitions.serializeHatchReceipt,
  serializeOlingConsumable: definitions.serializeOlingConsumable,
  serializeOlingConsumableForJson: definitions.serializeOlingConsumableForJson,
  serializeOlingEgg: definitions.serializeOlingEgg,
  serializeOlingPersonality: definitions.serializeOlingPersonality,
  serializeOlingTrait: definitions.serializeOlingTrait,
  serializePlayerOling: definitions.serializePlayerOling,
  getOlingDefinitions: definitions.getOlingDefinitions,
  getOlingAdventureEnergyCost: energy.getOlingAdventureEnergyCost,
  getOlingBedRestDurationMs: energy.getOlingBedRestDurationMs,
  getOlingEnergy: energy.getOlingEnergy,
  getOlingRestDurationMs: energy.getOlingRestDurationMs,
  getOlingRestRemainingMs: energy.getOlingRestRemainingMs,
  getOlingEnergyStatus: energy.getOlingEnergyStatus,
  getOrCreateOlingState: accountState.getOrCreateOlingState,
  spendOlingEnergy: energy.spendOlingEnergy,
  awardOlingXp: energy.awardOlingXp,
  useOlingConsumable: interactions.useOlingConsumable
};
