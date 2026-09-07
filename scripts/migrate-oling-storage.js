require('dotenv').config();

const mongoose = require('mongoose');

const {
  Account,
  OlingState,
  PlayerOling,
  accountsConnection
} = require('../server/models');
const {
  OLING_LAB_ACTIVE_LIMIT,
  OLING_POD_RELEASE_OUTCOMES
} = require('../models/olings/oling-storage-contract');
const {
  getOlingPodDefinition
} = require('../server/services/olings/pod-catalog');

const DEFAULT_POD_KEY = 'oling_pod';

function getDatabaseUri(baseUri, dbName) {
  const parsedUri = new URL(baseUri);
  parsedUri.pathname = `/${dbName}`;
  return parsedUri.toString();
}

function toPlain(value) {
  return value?.toObject?.({ depopulate: true }) || value || {};
}

function normalizeKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase();
}

function normalizePodInventory(items) {
  const merged = new Map();
  (Array.isArray(items) ? items : []).forEach((item) => {
    const plain = toPlain(item);
    const key = normalizeKey(plain.key);
    const quantity = Math.max(0, Math.floor(Number(plain.quantity) || 0));
    if (!key || quantity < 1) return;
    const existing = merged.get(key);
    if (existing) {
      existing.quantity += quantity;
      return;
    }
    merged.set(key, {
      ...plain,
      key,
      rarity: normalizeKey(plain.rarity) || 'common',
      quantity,
      metadata:
        plain.metadata && typeof plain.metadata === 'object'
          ? plain.metadata
          : {}
    });
  });
  return [...merged.values()];
}

function getCanonicalPodInventory(account, olingState) {
  const sources = [
    account?.olings?.pods,
    olingState?.inventory?.pods,
    account?.gameData?.olingInventory?.pods
  ];
  const source = sources.find((items) => Array.isArray(items));
  return normalizePodInventory(source || []);
}

function isValidStoredPod(pod) {
  return Boolean(
    normalizeKey(pod?.key) &&
    Number.isInteger(Number(pod?.definitionRevision)) &&
    Number(pod.definitionRevision) > 0 &&
    OLING_POD_RELEASE_OUTCOMES.includes(normalizeKey(pod?.releaseOutcome)) &&
    pod?.storedAt
  );
}

function createStoredResidency(oling, now) {
  const definition = getOlingPodDefinition(DEFAULT_POD_KEY);
  return {
    state: 'stored',
    labSlot: null,
    pod: {
      key: definition.key,
      definitionRevision: definition.revision,
      releaseOutcome: definition.lifecycle.onRelease,
      storedAt: oling?.residency?.pod?.storedAt || oling?.hatchedAt || now
    }
  };
}

function getOlingId(oling) {
  return String(oling?._id || oling?.id || '');
}

function buildOlingResidencyPlan({
  olings,
  activeAdventureOlingId = null,
  now = new Date()
}) {
  const list = Array.isArray(olings) ? olings : [];
  const adventureId = String(activeAdventureOlingId || '');
  const stored = [];
  const active = [];

  list.forEach((oling, index) => {
    const isAdventuring = getOlingId(oling) === adventureId;
    if (oling?.residency?.state === 'stored' && !isAdventuring) {
      stored.push({ oling, index });
    } else {
      active.push({ oling, index });
    }
  });

  active.sort((left, right) => {
    const leftAdventure = getOlingId(left.oling) === adventureId ? 1 : 0;
    const rightAdventure = getOlingId(right.oling) === adventureId ? 1 : 0;
    if (leftAdventure !== rightAdventure) return rightAdventure - leftAdventure;
    const leftSlot = Number(left.oling?.residency?.labSlot);
    const rightSlot = Number(right.oling?.residency?.labSlot);
    const leftHasSlot =
      Number.isInteger(leftSlot) &&
      leftSlot >= 1 &&
      leftSlot <= OLING_LAB_ACTIVE_LIMIT;
    const rightHasSlot =
      Number.isInteger(rightSlot) &&
      rightSlot >= 1 &&
      rightSlot <= OLING_LAB_ACTIVE_LIMIT;
    if (leftHasSlot !== rightHasSlot) return rightHasSlot - leftHasSlot;
    if (leftHasSlot && leftSlot !== rightSlot) return leftSlot - rightSlot;
    return left.index - right.index;
  });

  const occupiedSlots = new Set();
  const updates = [];
  let overflowStored = 0;
  let repairedStored = 0;

  active.forEach(({ oling }, index) => {
    if (index >= OLING_LAB_ACTIVE_LIMIT) {
      overflowStored += 1;
      updates.push({
        olingId: oling?._id || oling?.id,
        residency: createStoredResidency(oling, now),
        wake: true
      });
      return;
    }

    const preferredSlot = Number(oling?.residency?.labSlot);
    let labSlot =
      Number.isInteger(preferredSlot) &&
      preferredSlot >= 1 &&
      preferredSlot <= OLING_LAB_ACTIVE_LIMIT &&
      !occupiedSlots.has(preferredSlot)
        ? preferredSlot
        : null;
    if (!labSlot) {
      for (let slot = 1; slot <= OLING_LAB_ACTIVE_LIMIT; slot += 1) {
        if (occupiedSlots.has(slot)) continue;
        labSlot = slot;
        break;
      }
    }
    occupiedSlots.add(labSlot);
    updates.push({
      olingId: oling?._id || oling?.id,
      residency: { state: 'active', labSlot, pod: null },
      wake: false
    });
  });

  stored.forEach(({ oling }) => {
    const residency = isValidStoredPod(oling?.residency?.pod)
      ? {
          state: 'stored',
          labSlot: null,
          pod: toPlain(oling.residency.pod)
        }
      : createStoredResidency(oling, now);
    if (!isValidStoredPod(oling?.residency?.pod)) repairedStored += 1;
    updates.push({
      olingId: oling?._id || oling?.id,
      residency,
      wake: Boolean(oling?.care?.isSleeping)
    });
  });

  return {
    updates,
    activeCount: Math.min(active.length, OLING_LAB_ACTIVE_LIMIT),
    storedCount: stored.length + overflowStored,
    overflowStored,
    repairedStored
  };
}

function buildAccountStorageBackfill({
  account,
  olingState,
  olings,
  now = new Date()
}) {
  return {
    pods: getCanonicalPodInventory(account, olingState),
    roster: buildOlingResidencyPlan({
      olings,
      activeAdventureOlingId: account?.olings?.adventures?.active?.olingId,
      now
    })
  };
}

async function applyAccountStorageBackfill({ account, plan }) {
  await accountsConnection.transaction(async (session) => {
    await Account.updateOne(
      { _id: account._id },
      { $set: { 'olings.pods': plan.pods } },
      { session, runValidators: false }
    );
    await OlingState.updateOne(
      { ownerId: account._id },
      {
        $set: { 'inventory.pods': plan.pods },
        $setOnInsert: { ownerId: account._id }
      },
      { upsert: true, session, runValidators: false }
    );

    await PlayerOling.updateMany(
      { ownerId: account._id, 'residency.state': { $ne: 'stored' } },
      { $set: { 'residency.labSlot': null } },
      { session, runValidators: false }
    );

    if (plan.roster.updates.length) {
      await PlayerOling.bulkWrite(
        plan.roster.updates.map((update) => {
          const set = { residency: update.residency };
          if (update.wake) {
            set['care.isSleeping'] = false;
            set['care.sleepBedPlacedId'] = null;
            set['care.sleepBedSlotId'] = null;
          }
          return {
            updateOne: {
              filter: { _id: update.olingId, ownerId: account._id },
              update: { $set: set }
            }
          };
        }),
        { ordered: true, session }
      );
    }
  });
}

async function main() {
  const apply = process.argv.includes('--apply');
  const baseUri = process.env.MONGO_URI_OVEREXPOSURE;
  if (!process.env.MONGO_URI_ACCOUNTS && !baseUri) {
    throw new Error(
      'Missing MONGO_URI_ACCOUNTS or MONGO_URI_OVEREXPOSURE environment variable.'
    );
  }

  const accountsUri =
    process.env.MONGO_URI_ACCOUNTS ||
    getDatabaseUri(baseUri, process.env.MONGO_DB_ACCOUNTS || 'accounts');
  await accountsConnection.openUri(accountsUri, {
    serverSelectionTimeoutMS: 15000
  });

  const totals = {
    mode: apply ? 'apply' : 'dry-run',
    accounts: 0,
    activeOlings: 0,
    storedOlings: 0,
    overflowStored: 0,
    repairedStored: 0,
    emptyPods: 0
  };
  const cursor = Account.find({})
    .select(
      '_id olings.pods olings.adventures.active gameData.olingInventory.pods'
    )
    .lean()
    .cursor();

  for await (const account of cursor) {
    const [olingState, olings] = await Promise.all([
      OlingState.findOne({ ownerId: account._id }).lean(),
      PlayerOling.find({ ownerId: account._id })
        .sort({ hatchedAt: 1, _id: 1 })
        .lean()
    ]);
    const plan = buildAccountStorageBackfill({ account, olingState, olings });
    totals.accounts += 1;
    totals.activeOlings += plan.roster.activeCount;
    totals.storedOlings += plan.roster.storedCount;
    totals.overflowStored += plan.roster.overflowStored;
    totals.repairedStored += plan.roster.repairedStored;
    totals.emptyPods += plan.pods.reduce(
      (sum, pod) => sum + Number(pod.quantity || 0),
      0
    );
    if (apply) await applyAccountStorageBackfill({ account, plan });
  }

  if (apply) await PlayerOling.createIndexes();
  console.log(JSON.stringify(totals, null, 2));
  if (!apply) {
    console.log('Dry run only. Re-run with --apply to write these changes.');
  }
}

if (require.main === module) {
  main()
    .catch((error) => {
      console.error(error.message || error);
      process.exitCode = 1;
    })
    .finally(async () => {
      await accountsConnection.close().catch(() => {});
      await mongoose.disconnect().catch(() => {});
    });
}

module.exports = {
  DEFAULT_POD_KEY,
  applyAccountStorageBackfill,
  buildAccountStorageBackfill,
  buildOlingResidencyPlan,
  createStoredResidency,
  getCanonicalPodInventory,
  getDatabaseUri,
  isValidStoredPod,
  main,
  normalizePodInventory
};
