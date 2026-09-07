require('dotenv').config();

const mongoose = require('mongoose');

const {
  MAX_EMBEDDED_EVENTS
} = require('../models/olings/oling-clash-match-schema');
const {
  createOlingClashGameId
} = require('../models/olings/oling-clash-game-id');
const {
  OlingClashArchive,
  OlingClashMatch,
  olingsConnection
} = require('../server/models');

const LEGACY_EVENT_COLLECTION = 'oling-clash-events';
const PRESERVED_EVENT_COLLECTION = 'oling-clash-events-legacy';

function convertLegacyEvent(event, sequence) {
  return {
    sequence,
    round: Number(event.round || 0),
    type: event.type,
    actorAccountId: null,
    actorSlot: event.actorSlot || null,
    damageSource: event.damageSource || null,
    damageType: event.damageType || null,
    visibility: event.visibility || 'public',
    payload: event.payload || {},
    createdAt: event.createdAt || new Date()
  };
}

function getDatabaseUri(baseUri, dbName) {
  const parsedUri = new URL(baseUri);
  parsedUri.pathname = `/${dbName}`;
  return parsedUri.toString();
}

async function collectionExists(database, name) {
  return database.listCollections({ name }, { nameOnly: true }).hasNext();
}

async function main() {
  const baseUri = process.env.MONGO_URI_OVEREXPOSURE;
  if (!process.env.MONGO_URI_OLINGS && !baseUri) {
    throw new Error(
      'Missing MONGO_URI_OLINGS or MONGO_URI_OVEREXPOSURE in environment.'
    );
  }
  const uri =
    process.env.MONGO_URI_OLINGS ||
    getDatabaseUri(baseUri, process.env.MONGO_DB_OLINGS || 'olings');
  await olingsConnection.openUri(uri, { serverSelectionTimeoutMS: 15000 });

  const database = olingsConnection.db;
  const hasLegacyEvents = await collectionExists(
    database,
    LEGACY_EVENT_COLLECTION
  );
  const legacyCollection = hasLegacyEvents
    ? database.collection(LEGACY_EVENT_COLLECTION)
    : null;
  const matches = await OlingClashMatch.find({}).lean();
  let embeddedEventCount = 0;

  for (const match of matches) {
    const legacyEvents = legacyCollection
      ? await legacyCollection
          .find({ matchId: match._id })
          .sort({ sequence: 1 })
          .limit(MAX_EMBEDDED_EVENTS)
          .toArray()
      : [];
    const embeddedEvents = legacyEvents.map((event, index) =>
      convertLegacyEvent(event, index + 1)
    );
    embeddedEventCount += embeddedEvents.length;
    await OlingClashMatch.updateOne(
      { _id: match._id },
      {
        $set: {
          gameId: match.gameId || createOlingClashGameId(),
          events:
            Array.isArray(match.events) && match.events.length
              ? match.events
              : embeddedEvents
        }
      },
      { runValidators: true }
    );
  }

  const legacyEventCount = legacyCollection
    ? await legacyCollection.countDocuments({})
    : 0;
  if (legacyCollection && legacyEventCount === 0) {
    await legacyCollection.drop();
  } else if (
    legacyCollection &&
    !(await collectionExists(database, PRESERVED_EVENT_COLLECTION))
  ) {
    await legacyCollection.rename(PRESERVED_EVENT_COLLECTION);
  }
  await Promise.all([
    OlingClashMatch.createIndexes(),
    OlingClashArchive.createIndexes()
  ]);

  console.log(
    JSON.stringify(
      {
        migratedMatches: matches.length,
        embeddedLegacyEvents: embeddedEventCount,
        preservedLegacyEvents: legacyEventCount,
        legacyCollection:
          legacyEventCount > 0 ? PRESERVED_EVENT_COLLECTION : null
      },
      null,
      2
    )
  );
}

if (require.main === module) {
  main()
    .catch((error) => {
      console.error(error.message || error);
      process.exitCode = 1;
    })
    .finally(async () => {
      await olingsConnection.close().catch(() => {});
      await mongoose.disconnect();
    });
}

module.exports = { convertLegacyEvent };
