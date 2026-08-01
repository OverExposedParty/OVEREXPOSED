require('dotenv').config();

const fs = require('fs/promises');
const mongoose = require('mongoose');

const {
  OlingBuildSet,
  OlingEgg,
  OlingPersonality,
  OlingTrait,
  olingsConnection
} = require('../server/models');

function getDatabaseUri(baseUri, dbName) {
  const parsedUri = new URL(baseUri);
  parsedUri.pathname = `/${dbName}`;
  return parsedUri.toString();
}

async function readJson(path) {
  return JSON.parse(await fs.readFile(path, 'utf8'));
}

async function main() {
  const baseUri = process.env.MONGO_URI_OVEREXPOSURE;
  const olingsUri =
    process.env.MONGO_URI_OLINGS ||
    getDatabaseUri(baseUri, process.env.MONGO_DB_OLINGS || 'olings');

  await olingsConnection.openUri(olingsUri, {
    serverSelectionTimeoutMS: 15000
  });

  const [{ eggs = [] }, { traits = [] }, { personalities = [] }] =
    await Promise.all([
      readJson('public/json-files/olings/eggs.json'),
      readJson('public/json-files/olings/traits.json'),
      readJson('public/json-files/olings/personalities.json')
    ]);

  for (const trait of traits) {
    await OlingTrait.findOneAndUpdate(
      { key: trait.key },
      { $set: trait },
      { new: true, runValidators: true, upsert: true }
    );
  }

  for (const personality of personalities) {
    await OlingPersonality.findOneAndUpdate(
      { key: personality.key },
      { $set: personality },
      { new: true, runValidators: true, upsert: true }
    );
  }

  for (const egg of eggs) {
    const setKeys = [];

    for (const set of egg.sets || []) {
      setKeys.push(set.key);
      await OlingBuildSet.findOneAndUpdate(
        { key: set.key },
        {
          $set: {
            ...set,
            collection: egg.collection || 'base',
            status: set.status || 'published',
            enabled: set.enabled !== false
          }
        },
        { new: true, runValidators: true, upsert: true }
      );
    }

    const { sets, pools, ...eggPayload } = egg;
    await OlingEgg.findOneAndUpdate(
      { key: egg.key },
      {
        $set: {
          ...eggPayload,
          setKeys: [...new Set(setKeys)]
        },
        $unset: { sets: '', pools: '' }
      },
      { new: true, runValidators: true, upsert: true }
    );
  }

  const moss = await OlingBuildSet.findOne({ key: 'moss' }).lean();
  const baseEgg = await OlingEgg.findOne({ key: 'base-egg' }).lean();

  console.log(
    JSON.stringify(
      {
        syncedTraits: traits.length,
        syncedEggs: eggs.length,
        syncedPersonalities: personalities.length,
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
