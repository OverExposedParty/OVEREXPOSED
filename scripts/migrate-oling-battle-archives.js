require('dotenv').config();

const mongoose = require('mongoose');

const {
  MAX_EMBEDDED_EVENTS
} = require('../models/olings/oling-battle-match-schema');
const {
  createOlingBattleGameId
} = require('../models/olings/oling-battle-game-id');
const {
  OlingBattleArchive,
  OlingBattleMatch,
  olingsConnection
} = require('../server/models');

const LEGACY_EVENT_COLLECTION = 'oling-battle-events';
const PRESERVED_EVENT_COLLECTION = 'oling-battle-events-legacy';
const FINISHED_STATUSES = new Set(['completed', 'abandoned']);

function getCurrentLegacyEventSegment(events, matchStatus) {
  const orderedEvents = [...events].sort(
    (left, right) => Number(left.sequence || 0) - Number(right.sequence || 0)
  );
  const completionIndexes = orderedEvents
    .map((event, index) =>
      ['completed', 'abandoned', 'lobby-closed'].includes(event.type)
        ? index
        : -1
    )
    .filter((index) => index >= 0);

  let startIndex = 0;
  if (completionIndexes.length > 0) {
    const latestCompletionIndex = completionIndexes.at(-1);
    if (FINISHED_STATUSES.has(matchStatus)) {
      startIndex = completionIndexes.at(-2) + 1 || 0;
    } else {
      startIndex = latestCompletionIndex + 1;
    }
  }

  return orderedEvents.slice(startIndex).slice(-MAX_EMBEDDED_EVENTS);
}

function convertLegacyEvent(event, sequence) {
  return {
    sequence,
    type: event.type,
    actorAccountId: event.accountId || null,
    actorSlot: null,
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

async function preserveLegacyCollection(database, legacyEventCount) {
  if (!(await collectionExists(database, LEGACY_EVENT_COLLECTION))) return;

  if (legacyEventCount === 0) {
    await database.collection(LEGACY_EVENT_COLLECTION).drop();
    return;
  }

  if (await collectionExists(database, PRESERVED_EVENT_COLLECTION)) return;
  await database
    .collection(LEGACY_EVENT_COLLECTION)
    .rename(PRESERVED_EVENT_COLLECTION);
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
  const matches = await OlingBattleMatch.find({}).lean();
  let embeddedEventCount = 0;

  for (const match of matches) {
    const legacyEvents = legacyCollection
      ? await legacyCollection.find({ matchId: match._id }).toArray()
      : [];
    const currentEvents = getCurrentLegacyEventSegment(
      legacyEvents,
      match.status
    ).map((event, index) => convertLegacyEvent(event, index + 1));
    embeddedEventCount += currentEvents.length;

    await OlingBattleMatch.updateOne(
      { _id: match._id },
      {
        $set: {
          gameId: match.gameId || createOlingBattleGameId(),
          events:
            Array.isArray(match.events) && match.events.length > 0
              ? match.events
              : currentEvents
        },
        $unset: { 'state.hitHistory': '' }
      },
      { runValidators: true, strict: false }
    );
  }

  const legacyEventCount = legacyCollection
    ? await legacyCollection.countDocuments({})
    : 0;
  await preserveLegacyCollection(database, legacyEventCount);
  await Promise.all([
    OlingBattleMatch.createIndexes(),
    OlingBattleArchive.createIndexes()
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

module.exports = {
  convertLegacyEvent,
  getCurrentLegacyEventSegment
};
