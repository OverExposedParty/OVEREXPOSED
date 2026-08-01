require('dotenv').config();

const mongoose = require('mongoose');

const {
  OlingBuildSet,
  OlingEgg,
  olingsConnection
} = require('../server/models');

function getDatabaseUri(baseUri, dbName) {
  const parsedUri = new URL(baseUri);
  parsedUri.pathname = `/${dbName}`;
  return parsedUri.toString();
}

async function main() {
  const keys = process.argv
    .slice(2)
    .map((key) =>
      String(key || '')
        .trim()
        .toLowerCase()
    )
    .filter(Boolean);
  if (!keys.length) {
    throw new Error('Pass at least one build set key to delete.');
  }

  const baseUri = process.env.MONGO_URI_OVEREXPOSURE;
  const olingsUri =
    process.env.MONGO_URI_OLINGS ||
    getDatabaseUri(baseUri, process.env.MONGO_DB_OLINGS || 'olings');

  await olingsConnection.openUri(olingsUri, {
    serverSelectionTimeoutMS: 15000
  });

  const deleted = await OlingBuildSet.deleteMany({ key: { $in: keys } });
  await OlingEgg.updateMany(
    { setKeys: { $in: keys } },
    { $pull: { setKeys: { $in: keys } } }
  );

  const baseEgg = await OlingEgg.findOne({ key: 'base-egg' }).lean();
  const remainingBuildSets = await OlingBuildSet.find({})
    .sort({ collection: 1, rarity: 1, key: 1 })
    .select({ key: 1, name: 1, collection: 1, status: 1 })
    .lean();

  console.log(
    JSON.stringify(
      {
        deletedCount: deleted.deletedCount,
        deletedKeys: keys,
        baseEggSetKeys: baseEgg?.setKeys || [],
        remainingBuildSets: remainingBuildSets.map((set) => ({
          key: set.key,
          name: set.name,
          collection: set.collection,
          status: set.status
        }))
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
