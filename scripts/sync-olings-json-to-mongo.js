require('dotenv').config();

const mongoose = require('mongoose');

const {
  OlingBuildSet,
  OlingClashAbility,
  OlingClashRuleset,
  OlingClashStatus,
  OlingConsumable,
  OlingEgg,
  OlingTrait,
  olingsConnection
} = require('../server/models');
const { importOlingDefinitionsFromJson } = require('../server/services/olings');

function getDatabaseUri(baseUri, dbName) {
  const parsedUri = new URL(baseUri);
  parsedUri.pathname = `/${dbName}`;
  return parsedUri.toString();
}

async function main() {
  const baseUri = process.env.MONGO_URI_OVEREXPOSURE;
  const olingsUri =
    process.env.MONGO_URI_OLINGS ||
    getDatabaseUri(baseUri, process.env.MONGO_DB_OLINGS || 'olings');

  await olingsConnection.openUri(olingsUri, {
    serverSelectionTimeoutMS: 15000
  });

  const imported = await importOlingDefinitionsFromJson({
    OlingTrait,
    OlingEgg,
    OlingBuildSet,
    OlingConsumable,
    OlingClashAbility,
    OlingClashRuleset,
    OlingClashStatus
  });

  const moss = await OlingBuildSet.findOne({ key: 'moss' }).lean();
  const baseEgg = await OlingEgg.findOne({ key: 'base-egg' }).lean();

  console.log(
    JSON.stringify(
      {
        syncedTraits: imported.traits.length,
        syncedEggs: imported.eggs.length,
        syncedConsumables: imported.consumables.length,
        syncedClashAbilities: imported.clashAbilities.length,
        syncedClashRulesets: imported.clashRulesets.length,
        syncedClashStatuses: imported.clashStatuses.length,
        moss: moss
          ? {
              key: moss.key,
              name: moss.name,
              collection: moss.collection,
              status: moss.status
            }
          : null,
        baseEggSetKeys: baseEgg?.setKeys || []
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error(error.message || error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await olingsConnection.close().catch(() => {});
    await mongoose.disconnect();
  });
