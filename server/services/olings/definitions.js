const buildSets = require('./definitions/build-sets');
const serializers = require('./definitions/serializers');
const catalog = require('./definitions/catalog');
const sync = require('./definitions/sync');

module.exports = {
  attachOlingBuildSetsToEggs: buildSets.attachOlingBuildSetsToEggs,
  exportOlingConsumablesToJson: sync.exportOlingConsumablesToJson,
  importOlingDefinitionsFromJson: sync.importOlingDefinitionsFromJson,
  listOlingConsumables: catalog.listOlingConsumables,
  listPublishedOlingEggs: catalog.listPublishedOlingEggs,
  listPublishedOlingTraits: catalog.listPublishedOlingTraits,
  serializeHatchReceipt: serializers.serializeHatchReceipt,
  serializeOlingConsumable: serializers.serializeOlingConsumable,
  serializeOlingConsumableForJson: serializers.serializeOlingConsumableForJson,
  serializeOlingEgg: serializers.serializeOlingEgg,
  serializeOlingResidency: serializers.serializeOlingResidency,
  serializeOlingTrait: serializers.serializeOlingTrait,
  serializePlayerOling: serializers.serializePlayerOling,
  getOlingDefinitions: catalog.getOlingDefinitions,
  getOlingConsumableByKey: catalog.getOlingConsumableByKey,
  getLayerPool: buildSets.getLayerPool,
  getRollableOlingRarityOdds: buildSets.getRollableOlingRarityOdds,
  rollWeightedKey: buildSets.rollWeightedKey,
  pickRandom: buildSets.pickRandom
};
