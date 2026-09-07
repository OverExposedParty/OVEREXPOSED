const {
  OLING_LAB_ACTIVE_LIMIT
} = require('../../../models/olings/oling-storage-contract');

function isOlingActive(oling) {
  return oling?.residency?.state !== 'stored';
}

function createStoredOlingError(action = 'using it') {
  const error = new Error(
    `Release this Oling from its pod before ${String(action || 'using it')}.`
  );
  error.status = 409;
  error.code = 'oling_stored';
  return error;
}

function createActiveOlingFilter(ownerId) {
  return {
    ownerId,
    'residency.state': { $ne: 'stored' }
  };
}

function getAvailableLabSlotFromOlings(olings) {
  const activeOlings = (Array.isArray(olings) ? olings : []).filter(
    isOlingActive
  );
  if (activeOlings.length >= OLING_LAB_ACTIVE_LIMIT) return null;

  const occupiedSlots = new Set(
    activeOlings
      .map((oling) => Number(oling?.residency?.labSlot))
      .filter(
        (slot) =>
          Number.isInteger(slot) && slot >= 1 && slot <= OLING_LAB_ACTIVE_LIMIT
      )
  );

  for (let slot = 1; slot <= OLING_LAB_ACTIVE_LIMIT; slot += 1) {
    if (!occupiedSlots.has(slot)) return slot;
  }
  return null;
}

function applySession(query, session) {
  return session && typeof query?.session === 'function'
    ? query.session(session)
    : query;
}

async function leanQuery(query) {
  return typeof query?.lean === 'function' ? query.lean() : query;
}

async function listActiveOlings({ PlayerOling, accountId, session = null }) {
  let query = PlayerOling.find(createActiveOlingFilter(accountId));
  if (typeof query?.sort === 'function') {
    query = query.sort({ 'residency.labSlot': 1, hatchedAt: 1 });
  }
  return (await leanQuery(applySession(query, session))) || [];
}

async function getOlingRoster({ PlayerOling, accountId, session = null }) {
  const olings = await listActiveOlings({ PlayerOling, accountId, session });
  const availableSlot = getAvailableLabSlotFromOlings(olings);

  return {
    limit: OLING_LAB_ACTIVE_LIMIT,
    activeCount: olings.length,
    availableSlots: Math.max(0, OLING_LAB_ACTIVE_LIMIT - olings.length),
    nextAvailableSlot: availableSlot,
    olings
  };
}

async function findAvailableLabSlot(options) {
  const roster = await getOlingRoster(options);
  return roster.nextAvailableSlot;
}

module.exports = {
  applySession,
  createActiveOlingFilter,
  createStoredOlingError,
  findAvailableLabSlot,
  getAvailableLabSlotFromOlings,
  getOlingRoster,
  isOlingActive,
  listActiveOlings
};
