const {
  OLING_POD_RELEASE_OUTCOMES
} = require('../../../models/olings/oling-storage-contract');
const { getOlingPodDefinition } = require('./pod-catalog');
const { OlingLabItems } = require('../../routes/api-olings/lab-catalog');
const {
  applySession,
  findAvailableLabSlot,
  getOlingRoster,
  isOlingActive
} = require('./residency');
const { normalizeKey } = require('./shared');

const OLING_STORAGE_SLOT_RETRIES = 3;
const ACTIVE_LAB_SLOT_INDEX_NAME = 'owner_active_oling_lab_slot';

class OlingStorageError extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = 'OlingStorageError';
    this.status = status;
    this.code = code;
  }

  toApiError() {
    return { status: this.status, code: this.code, message: this.message };
  }
}

function storageError(status, code, message) {
  return new OlingStorageError(status, code, message);
}

function toPlainItem(item) {
  return item?.toObject?.({ depopulate: true }) || { ...(item || {}) };
}

function normalizePodInventory(items) {
  return (Array.isArray(items) ? items : [])
    .map((item) => ({
      ...toPlainItem(item),
      key: normalizeKey(item?.key),
      quantity: Math.max(0, Math.floor(Number(item?.quantity) || 0))
    }))
    .filter((item) => item.key && item.quantity > 0);
}

function normalizePlacedId(value) {
  return String(value || '')
    .trim()
    .slice(0, 80);
}

function resolveLab(account, olingState) {
  if (Array.isArray(olingState?.lab?.placedItems)) return olingState.lab;
  if (Array.isArray(account?.olings?.lab?.placedItems)) {
    return account.olings.lab;
  }
  return null;
}

function getPodStorageContainers(account, olingState) {
  return (resolveLab(account, olingState)?.placedItems || []).flatMap(
    (placed) => {
      const definition = OlingLabItems[placed?.itemId];
      const capacity = Number(definition?.podStorage?.capacity);
      const placedId = normalizePlacedId(placed?.placedId);
      return placedId && Number.isInteger(capacity) && capacity > 0
        ? [{ placedId, itemId: definition.id, capacity }]
        : [];
    }
  );
}

function requirePodStorageContainer(account, olingState, placedId) {
  const normalizedPlacedId = normalizePlacedId(placedId);
  if (!normalizedPlacedId) {
    throw storageError(
      400,
      'oling_pod_storage_required',
      'Choose a Pod Rack before storing this Oling.'
    );
  }
  const container = getPodStorageContainers(account, olingState).find(
    (item) => item.placedId === normalizedPlacedId
  );
  if (!container) {
    throw storageError(
      404,
      'oling_pod_storage_not_found',
      'That Pod Rack is not placed in your lab.'
    );
  }
  return container;
}

async function listStoredOlings(models, accountId, session) {
  let query = models.PlayerOling.find({
    ownerId: accountId,
    'residency.state': 'stored'
  });
  return (await resolveQuery(query, session, { lean: true })) || [];
}

async function requireAvailablePodStorageSpace({
  models,
  accountId,
  container,
  session,
  excludeOlingId = null
}) {
  const storedOlings = await listStoredOlings(models, accountId, session);
  const occupied = storedOlings.filter(
    (oling) =>
      normalizePlacedId(oling?.residency?.pod?.containerPlacedId) ===
        container.placedId &&
      (!excludeOlingId || String(oling?._id) !== String(excludeOlingId))
  ).length;
  if (occupied >= container.capacity) {
    throw storageError(
      409,
      'oling_pod_storage_full',
      `This Pod Rack is full (${occupied}/${container.capacity}).`
    );
  }
  return occupied;
}

function resolvePodInventory(account, olingState) {
  const accountPods = normalizePodInventory(account?.olings?.pods);
  return accountPods.length
    ? accountPods
    : normalizePodInventory(olingState?.inventory?.pods);
}

function decrementPodInventory(items, podKey, now) {
  let decremented = false;
  const nextItems = normalizePodInventory(items)
    .map((item) => {
      if (decremented || item.key !== podKey || item.quantity < 1) return item;
      decremented = true;
      return { ...item, quantity: item.quantity - 1, lastUpdatedAt: now };
    })
    .filter((item) => item.quantity > 0);
  return { decremented, items: nextItems };
}

function incrementPodInventory(items, podKey, definition, now) {
  const nextItems = normalizePodInventory(items);
  const existing = nextItems.find((item) => item.key === podKey);
  if (existing) {
    existing.quantity += 1;
    existing.lastUpdatedAt = now;
    return nextItems;
  }

  nextItems.push({
    key: podKey,
    rarity: definition?.rarity || 'common',
    quantity: 1,
    acquiredAt: now,
    lastUpdatedAt: now,
    metadata: {}
  });
  return nextItems;
}

async function resolveQuery(query, session, { lean = false } = {}) {
  const scopedQuery = applySession(query, session);
  return lean && typeof scopedQuery?.lean === 'function'
    ? scopedQuery.lean()
    : scopedQuery;
}

function setDocumentPath(document, path, value) {
  if (typeof document?.set === 'function') {
    document.set(path, value);
    return;
  }
  const segments = path.split('.');
  let target = document;
  segments.slice(0, -1).forEach((segment) => {
    target[segment] ||= {};
    target = target[segment];
  });
  target[segments.at(-1)] = value;
}

async function saveDocument(
  document,
  session,
  { validateBeforeSave = false } = {}
) {
  if (typeof document?.save !== 'function') return document;
  return document.save({ session, validateBeforeSave });
}

async function loadStorageState(models, accountId, olingId, session) {
  // MongoDB transactions do not support parallel operations on one session.
  const account = await resolveQuery(
    models.Account.findById(accountId),
    session
  );
  const olingState = await resolveQuery(
    models.OlingState.findOne({ ownerId: accountId }),
    session
  );
  const oling = await resolveQuery(
    models.PlayerOling.findOne({ _id: olingId, ownerId: accountId }),
    session
  );

  if (!account) {
    throw storageError(
      404,
      'account_not_found',
      'That account could not be found.'
    );
  }
  if (!oling) {
    throw storageError(
      404,
      'player_oling_not_found',
      'That Oling could not be found.'
    );
  }

  return { account, olingState, oling };
}

async function persistPodInventory({
  models,
  account,
  accountId,
  pods,
  session
}) {
  if (typeof models.Account?.updateOne === 'function') {
    await models.Account.updateOne(
      { _id: accountId },
      { $set: { 'olings.pods': pods } },
      { session, runValidators: false }
    );
    setDocumentPath(account, 'olings.pods', pods);
  } else {
    setDocumentPath(account, 'olings.pods', pods);
    account.markModified?.('olings.pods');
    await saveDocument(account, session);
  }

  await models.OlingState.updateOne(
    { ownerId: accountId },
    {
      $set: { 'inventory.pods': pods },
      $setOnInsert: { ownerId: accountId }
    },
    { upsert: true, session, runValidators: false }
  );
}

function getStorageConnection(models) {
  const connection = models?.PlayerOling?.db;
  if (!connection || typeof connection.transaction !== 'function') {
    throw new TypeError('Oling storage requires a transactional connection.');
  }

  for (const model of [models.Account, models.OlingState]) {
    if (model?.db && model.db !== connection) {
      throw new TypeError(
        'Oling storage models must use the same MongoDB connection.'
      );
    }
  }
  return connection;
}

function isActiveLabSlotDuplicate(error) {
  return Boolean(
    error?.code === 11000 &&
    (error?.keyPattern?.['residency.labSlot'] ||
      String(error?.message || '').includes(ACTIVE_LAB_SLOT_INDEX_NAME))
  );
}

async function runStorageTransaction(models, operation) {
  const connection = getStorageConnection(models);
  for (let attempt = 0; attempt < OLING_STORAGE_SLOT_RETRIES; attempt += 1) {
    try {
      return await connection.transaction(operation);
    } catch (error) {
      if (!isActiveLabSlotDuplicate(error)) throw error;
      if (attempt === OLING_STORAGE_SLOT_RETRIES - 1) {
        throw storageError(
          409,
          'oling_lab_roster_conflict',
          'The available Oling lab slot was claimed. Please try again.'
        );
      }
    }
  }
  return null;
}

async function performStoreOlingInPod({
  models,
  accountId,
  olingId,
  podKey,
  containerPlacedId,
  now,
  session
}) {
  const definition = getOlingPodDefinition(podKey);
  if (!definition) {
    throw storageError(
      400,
      'oling_pod_invalid',
      'That Oling Pod is unavailable.'
    );
  }

  const { account, olingState, oling } = await loadStorageState(
    models,
    accountId,
    olingId,
    session
  );
  if (!isOlingActive(oling)) {
    throw storageError(
      409,
      'oling_already_stored',
      'That Oling is already stored.'
    );
  }
  if (
    String(account.olings?.adventures?.active?.olingId || '') ===
    String(oling._id || olingId)
  ) {
    throw storageError(
      409,
      'oling_storage_adventuring',
      'An adventuring Oling cannot be stored.'
    );
  }
  if (oling.care?.isSleeping) {
    throw storageError(
      409,
      'oling_storage_sleeping',
      'Wake this Oling before storing it.'
    );
  }

  const container = requirePodStorageContainer(
    account,
    olingState,
    containerPlacedId
  );
  await requireAvailablePodStorageSpace({
    models,
    accountId,
    container,
    session
  });

  const inventoryChange = decrementPodInventory(
    resolvePodInventory(account, olingState),
    definition.key,
    now
  );
  if (!inventoryChange.decremented) {
    throw storageError(
      409,
      'oling_pod_not_owned',
      'You do not have an empty Oling Pod of that type.'
    );
  }

  await persistPodInventory({
    models,
    account,
    accountId,
    pods: inventoryChange.items,
    session
  });
  setDocumentPath(oling, 'residency', {
    state: 'stored',
    labSlot: null,
    pod: {
      key: definition.key,
      definitionRevision: definition.revision,
      releaseOutcome: definition.lifecycle.onRelease,
      storedAt: now,
      containerPlacedId: container.placedId
    }
  });
  await saveDocument(oling, session, { validateBeforeSave: true });

  return {
    account,
    oling,
    pod: {
      key: definition.key,
      definitionRevision: definition.revision,
      releaseOutcome: definition.lifecycle.onRelease,
      containerPlacedId: container.placedId,
      quantityAfter:
        inventoryChange.items.find((item) => item.key === definition.key)
          ?.quantity || 0
    },
    roster: await getOlingRoster({
      PlayerOling: models.PlayerOling,
      accountId,
      session
    })
  };
}

async function performReleaseOlingFromPod({
  models,
  accountId,
  olingId,
  now,
  session
}) {
  const { account, olingState, oling } = await loadStorageState(
    models,
    accountId,
    olingId,
    session
  );
  if (isOlingActive(oling)) {
    throw storageError(
      409,
      'oling_not_stored',
      'That Oling is not currently stored.'
    );
  }

  const storedPod = oling.residency?.pod;
  const podKey = normalizeKey(storedPod?.key);
  const releaseOutcome = normalizeKey(storedPod?.releaseOutcome);
  if (!podKey || !OLING_POD_RELEASE_OUTCOMES.includes(releaseOutcome)) {
    throw storageError(
      409,
      'oling_stored_pod_invalid',
      'That stored Oling has invalid pod information.'
    );
  }

  const labSlot = await findAvailableLabSlot({
    PlayerOling: models.PlayerOling,
    accountId,
    session
  });
  if (!labSlot) {
    throw storageError(
      409,
      'oling_lab_roster_full',
      'Your Oling lab already has 6 active Olings.'
    );
  }

  let pods = resolvePodInventory(account, olingState);
  const returnedToInventory = releaseOutcome === 'return-to-inventory';
  if (returnedToInventory) {
    pods = incrementPodInventory(
      pods,
      podKey,
      getOlingPodDefinition(podKey),
      now
    );
    await persistPodInventory({ models, account, accountId, pods, session });
  }

  setDocumentPath(oling, 'residency', {
    state: 'active',
    labSlot,
    pod: null
  });
  await saveDocument(oling, session, { validateBeforeSave: true });

  return {
    account,
    oling,
    labSlot,
    pod: {
      key: podKey,
      releaseOutcome,
      destroyed: !returnedToInventory,
      returnedToInventory,
      quantityAfter: pods.find((item) => item.key === podKey)?.quantity || 0
    },
    roster: await getOlingRoster({
      PlayerOling: models.PlayerOling,
      accountId,
      session
    })
  };
}

async function executeStorageOperation(models, operation) {
  try {
    return await runStorageTransaction(models, operation);
  } catch (error) {
    if (error instanceof OlingStorageError) {
      return { error: error.toApiError() };
    }
    throw error;
  }
}

async function performTransferStoredOling({
  models,
  accountId,
  olingId,
  containerPlacedId,
  now,
  session
}) {
  const { account, olingState, oling } = await loadStorageState(
    models,
    accountId,
    olingId,
    session
  );
  if (isOlingActive(oling)) {
    throw storageError(
      409,
      'oling_not_stored',
      'That Oling is not currently stored.'
    );
  }
  const container = requirePodStorageContainer(
    account,
    olingState,
    containerPlacedId
  );
  const currentPlacedId = normalizePlacedId(
    oling.residency?.pod?.containerPlacedId
  );
  if (currentPlacedId === container.placedId) {
    throw storageError(
      409,
      'oling_pod_storage_unchanged',
      'That Oling is already stored in this Pod Rack.'
    );
  }
  await requireAvailablePodStorageSpace({
    models,
    accountId,
    container,
    session,
    excludeOlingId: olingId
  });

  await models.OlingState.updateOne(
    { ownerId: accountId },
    { $set: { 'metadata.podStorageUpdatedAt': now } },
    { upsert: true, session, runValidators: false }
  );
  setDocumentPath(oling, 'residency.pod.containerPlacedId', container.placedId);
  await saveDocument(oling, session, { validateBeforeSave: true });

  return {
    account,
    oling,
    pod: {
      key: normalizeKey(oling.residency?.pod?.key),
      releaseOutcome: normalizeKey(oling.residency?.pod?.releaseOutcome),
      containerPlacedId: container.placedId
    },
    roster: await getOlingRoster({
      PlayerOling: models.PlayerOling,
      accountId,
      session
    })
  };
}

async function assignLegacyStoredOlingsToPodStorage({
  models,
  accountId,
  account,
  olingState,
  now = new Date()
}) {
  const containers = getPodStorageContainers(account, olingState);
  if (!containers.length) return { assigned: 0, unassigned: 0 };
  const olings = await listStoredOlings(models, accountId, null);
  const validContainerIds = new Set(containers.map((item) => item.placedId));
  const occupied = new Map(containers.map((item) => [item.placedId, 0]));
  olings.forEach((oling) => {
    const placedId = normalizePlacedId(
      oling?.residency?.pod?.containerPlacedId
    );
    if (validContainerIds.has(placedId)) {
      occupied.set(placedId, (occupied.get(placedId) || 0) + 1);
    }
  });

  let assigned = 0;
  let unassigned = 0;
  for (const oling of olings) {
    const currentPlacedId = normalizePlacedId(
      oling?.residency?.pod?.containerPlacedId
    );
    if (validContainerIds.has(currentPlacedId)) continue;
    const destination = containers.find(
      (item) => (occupied.get(item.placedId) || 0) < item.capacity
    );
    if (!destination) {
      unassigned += 1;
      continue;
    }
    await models.PlayerOling.updateOne(
      { _id: oling._id, ownerId: accountId },
      {
        $set: {
          'residency.pod.containerPlacedId': destination.placedId,
          'metadata.podStorageMigratedAt': now
        }
      },
      { runValidators: false }
    );
    setDocumentPath(
      oling,
      'residency.pod.containerPlacedId',
      destination.placedId
    );
    occupied.set(
      destination.placedId,
      (occupied.get(destination.placedId) || 0) + 1
    );
    assigned += 1;
  }
  return { assigned, unassigned };
}

async function storeOlingInPod({
  models,
  accountId,
  olingId,
  podKey,
  containerPlacedId,
  now = new Date()
}) {
  return executeStorageOperation(models, (session) =>
    performStoreOlingInPod({
      models,
      accountId,
      olingId,
      podKey,
      containerPlacedId,
      now,
      session
    })
  );
}

async function transferStoredOling({
  models,
  accountId,
  olingId,
  containerPlacedId,
  now = new Date()
}) {
  return executeStorageOperation(models, (session) =>
    performTransferStoredOling({
      models,
      accountId,
      olingId,
      containerPlacedId,
      now,
      session
    })
  );
}

async function releaseOlingFromPod({
  models,
  accountId,
  olingId,
  now = new Date()
}) {
  return executeStorageOperation(models, (session) =>
    performReleaseOlingFromPod({
      models,
      accountId,
      olingId,
      now,
      session
    })
  );
}

module.exports = {
  ACTIVE_LAB_SLOT_INDEX_NAME,
  OLING_STORAGE_SLOT_RETRIES,
  OlingStorageError,
  decrementPodInventory,
  incrementPodInventory,
  isActiveLabSlotDuplicate,
  normalizePodInventory,
  assignLegacyStoredOlingsToPodStorage,
  getPodStorageContainers,
  releaseOlingFromPod,
  resolvePodInventory,
  runStorageTransaction,
  storeOlingInPod,
  transferStoredOling
};
