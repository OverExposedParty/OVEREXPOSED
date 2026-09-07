require('dotenv').config();

const mongoose = require('mongoose');

const {
  OlingEgg,
  OlingBuildSet,
  OlingClashAbility,
  OlingClashStatus,
  OlingClashArchive,
  OlingClashMatch,
  OlingClashRuleset,
  OlingBattleArchive,
  OlingBattleMatch,
  OlingConsumable,
  OlingHatchReceipt,
  OlingTrait,
  olingsConnection
} = require('../server/models');
const { importOlingDefinitionsFromJson } = require('../server/services/olings');

function getDatabaseUri(baseUri, dbName) {
  try {
    const parsedUri = new URL(baseUri);
    parsedUri.pathname = `/${dbName}`;
    return parsedUri.toString();
  } catch (error) {
    console.warn(
      `Could not derive "${dbName}" MongoDB URI from base URI:`,
      error.message || error
    );
    return baseUri;
  }
}

async function main() {
  const baseUri = process.env.MONGO_URI_OVEREXPOSURE;

  if (!process.env.MONGO_URI_OLINGS && !baseUri) {
    throw new Error(
      'Missing MONGO_URI_OLINGS or MONGO_URI_OVEREXPOSURE in environment.'
    );
  }

  const olingsUri =
    process.env.MONGO_URI_OLINGS ||
    getDatabaseUri(baseUri, process.env.MONGO_DB_OLINGS || 'olings');

  await olingsConnection.openUri(olingsUri);

  await Promise.all([
    OlingTrait.createIndexes(),
    OlingEgg.createIndexes(),
    OlingBuildSet.createIndexes(),
    OlingBattleMatch.createIndexes(),
    OlingBattleArchive.createIndexes(),
    OlingClashAbility.createIndexes(),
    OlingClashStatus.createIndexes(),
    OlingClashRuleset.createIndexes(),
    OlingClashMatch.createIndexes(),
    OlingClashArchive.createIndexes(),
    OlingConsumable.createIndexes(),
    OlingHatchReceipt.createIndexes()
  ]);

  const imported = await importOlingDefinitionsFromJson({
    OlingTrait,
    OlingEgg,
    OlingBuildSet,
    OlingConsumable,
    OlingClashAbility,
    OlingClashRuleset,
    OlingClashStatus
  });

  console.log(
    `Imported ${imported.traits.length} Oling traits, ` +
      `${imported.buildSets.length} build sets, ` +
      `${imported.eggs.length} eggs, and ` +
      `${imported.consumables.length} consumables, ` +
      `${imported.clashAbilities.length} Clash abilities, ` +
      `${imported.clashRulesets.length} Clash rulesets, and ` +
      `${imported.clashStatuses.length} Clash statuses.`
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
