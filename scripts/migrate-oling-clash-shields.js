require('dotenv').config();

const mongoose = require('mongoose');

const SHIELD_ABILITY_UPDATES = Object.freeze({
  'moss-canopy': Object.freeze({
    description:
      'Every second survived Draw, grant the most damaged living allied Oling 1 Shield.',
    handler: 'grant_shield_to_most_damaged_ally'
  }),
  'stone-harden': Object.freeze({
    description: 'Every second survived Draw, gain 1 Shield.',
    handler: 'grant_shield'
  })
});

function migrateAbilitySnapshot(ability) {
  const update = SHIELD_ABILITY_UPDATES[ability?.key];
  if (!update) return ability;
  return {
    ...ability,
    revision: 2,
    description: update.description,
    effects: (ability.effects || []).map((effect) => ({
      ...effect,
      mechanic:
        effect.mechanic === 'grant-armour' ? 'grant-shield' : effect.mechanic,
      handler: update.handler,
      parameters: { shieldCount: 1 }
    }))
  };
}

function migrateRulesetReference(ruleset) {
  if (!ruleset?.snapshot) return ruleset;
  const snapshot = ruleset.snapshot;
  const health = snapshot.health || {};
  const routing = snapshot.damage?.routing || {};
  const replaceLayer = (layer) => (layer === 'armour' ? 'shields' : layer);
  const { armourStacks: _armourStacks, ...remainingHealth } = health;

  return {
    ...ruleset,
    revision: ruleset.key === 'standard' ? 2 : ruleset.revision,
    snapshot: {
      ...snapshot,
      engineVersion: Math.max(3, Number(snapshot.engineVersion || 0)),
      health: {
        ...remainingHealth,
        layerOrder: (health.layerOrder || []).map(replaceLayer),
        shieldStacks: true,
        shieldCapacityUnits: 2
      },
      damage: {
        ...snapshot.damage,
        routing: Object.fromEntries(
          Object.entries(routing).map(([damageType, layers]) => [
            damageType,
            Array.isArray(layers) ? layers.map(replaceLayer) : layers
          ])
        )
      }
    }
  };
}

function migrateTeamOling(oling) {
  const legacyArmourUnits = Math.max(0, Number(oling?.armourUnits || 0));
  const existingShieldCount = Math.max(0, Number(oling?.shieldCount || 0));
  const { armourUnits: _armourUnits, ...remainingOling } = oling || {};
  return {
    ...remainingOling,
    shieldCount: Math.max(
      existingShieldCount,
      Math.ceil(legacyArmourUnits / 2)
    ),
    snapshot: oling?.snapshot
      ? {
          ...oling.snapshot,
          abilities: (oling.snapshot.abilities || []).map(
            migrateAbilitySnapshot
          )
        }
      : oling?.snapshot
  };
}

function migrateEventValue(value) {
  if (Array.isArray(value)) return value.map(migrateEventValue);
  if (!value || typeof value !== 'object') {
    return value === 'armour' ? 'shields' : value;
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return value;

  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => {
      if (key === 'armourUnits') {
        return ['shieldCount', Math.ceil(Math.max(0, Number(item || 0)) / 2)];
      }
      if (key === 'armourStacks') return ['shieldStacks', Boolean(item)];
      if (key === 'mechanic' && item === 'grant-armour') {
        return [key, 'grant-shield'];
      }
      return [key, migrateEventValue(item)];
    })
  );
}

function migrateClashDocument(document) {
  return {
    players: (document.players || []).map((player) => ({
      ...player,
      team: (player.team || []).map(migrateTeamOling)
    })),
    ruleset: migrateRulesetReference(document.ruleset),
    events: migrateEventValue(document.events || [])
  };
}

async function migrateCollection(database, collectionName, { apply }) {
  const collection = database.collection(collectionName);
  const operations = [];
  let scanned = 0;
  let wouldModify = 0;
  let modified = 0;

  async function flush() {
    if (!apply || operations.length === 0) return;
    const result = await collection.bulkWrite(operations.splice(0));
    modified += result.modifiedCount;
  }

  for await (const document of collection.find({})) {
    scanned += 1;
    const migrated = migrateClashDocument(document);
    const changed =
      JSON.stringify(migrated) !==
      JSON.stringify({
        players: document.players || [],
        ruleset: document.ruleset,
        events: document.events || []
      });
    if (!changed) continue;
    wouldModify += 1;
    operations.push({
      updateOne: {
        filter: { _id: document._id },
        update: { $set: migrated }
      }
    });
    if (operations.length >= 250) await flush();
  }

  await flush();
  return { collection: collectionName, scanned, wouldModify, modified };
}

function getOlingsUri() {
  if (process.env.MONGO_URI_OLINGS) return process.env.MONGO_URI_OLINGS;
  const baseUri = process.env.MONGO_URI_OVEREXPOSURE;
  if (!baseUri) throw new Error('Missing Olings MongoDB URI.');
  const parsedUri = new URL(baseUri);
  parsedUri.pathname = `/${process.env.MONGO_DB_OLINGS || 'olings'}`;
  return parsedUri.toString();
}

async function main() {
  const apply = process.argv.includes('--apply');
  const { olingsConnection } = require('../server/models');
  await olingsConnection.openUri(getOlingsUri(), {
    serverSelectionTimeoutMS: 15000
  });
  const results = [];
  for (const collectionName of [
    'oling-clash-matches',
    'oling-clash-archives'
  ]) {
    results.push(
      await migrateCollection(olingsConnection.db, collectionName, { apply })
    );
  }
  console.log(JSON.stringify({ apply, results }, null, 2));
}

if (require.main === module) {
  main()
    .catch((error) => {
      console.error(error.message || error);
      process.exitCode = 1;
    })
    .finally(async () => {
      const { olingsConnection } = require('../server/models');
      await olingsConnection.close().catch(() => {});
      await mongoose.disconnect();
    });
}

module.exports = {
  migrateAbilitySnapshot,
  migrateClashDocument,
  migrateEventValue,
  migrateRulesetReference,
  migrateTeamOling
};
