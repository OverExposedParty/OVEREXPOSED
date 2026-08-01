const buildSets = require('./definitions/build-sets');
const serializers = require('./definitions/serializers');
const catalog = require('./definitions/catalog');
const sync = require('./definitions/sync');

module.exports = {
  attachOlingBuildSetsToEggs: buildSets.attachOlingBuildSetsToEggs,
  exportOlingConsumablesToJson: sync.exportOlingConsumablesToJson,
  importOlingDefinitionsFromJson: sync.importOlingDefinitionsFromJson,
  listOlingConsumables: catalog.listOlingConsumables,
  listOlingPersonalities: catalog.listOlingPersonalities,
  listPublishedOlingEggs: catalog.listPublishedOlingEggs,
  listPublishedOlingPersonalities: catalog.listPublishedOlingPersonalities,
  listPublishedOlingTraits: catalog.listPublishedOlingTraits,
  serializeHatchReceipt: serializers.serializeHatchReceipt,
  serializeOlingConsumable: serializers.serializeOlingConsumable,
  serializeOlingConsumableForJson: serializers.serializeOlingConsumableForJson,
  serializeOlingEgg: serializers.serializeOlingEgg,
  serializeOlingPersonality: serializers.serializeOlingPersonality,
  serializeOlingTrait: serializers.serializeOlingTrait,
  serializePlayerOling: serializers.serializePlayerOling,
  getOlingDefinitions: catalog.getOlingDefinitions,
  getOlingConsumableByKey: catalog.getOlingConsumableByKey,
  getLayerPool: buildSets.getLayerPool,
  getRollableOlingRarityOdds: buildSets.getRollableOlingRarityOdds,
  rollWeightedKey: buildSets.rollWeightedKey,
  pickRandom: buildSets.pickRandom
};
