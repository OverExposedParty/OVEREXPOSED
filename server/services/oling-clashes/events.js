const {
  MAX_EMBEDDED_EVENTS
} = require('../../../models/olings/oling-clash-match-schema');
const {
  getLatestRoundResult,
  getPlayerLastMoves,
  serializeLiveClashMatch
} = require('./match-view');

const MAX_CACHED_LIVE_MATCHES = 256;

function refreshDerivedState(match, eventType, payload) {
  const hadDerivedState = Number(match.derivedStateVersion || 0) >= 1;
  match.derivedStateVersion = 1;
  if (eventType === 'round-resolved') {
    match.latestRoundResult = payload;
  } else if (!hadDerivedState) {
    match.latestRoundResult = getLatestRoundResult(match.events);
  }
  if (
    !hadDerivedState ||
    ['round-resolved', 'replacement-selected'].includes(eventType)
  ) {
    match.players?.forEach((player) => {
      player.lastMoves = getPlayerLastMoves(match.events, player);
    });
  }
}

function normalizeSnapshot(snapshot) {
  return JSON.parse(JSON.stringify(snapshot));
}

function isPatchableObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function createSnapshotPatch(previous, next) {
  const changes = [];
  const removed = [];

  function visit(before, after, path) {
    if (JSON.stringify(before) === JSON.stringify(after)) return;
    if (!isPatchableObject(before) || !isPatchableObject(after)) {
      changes.push({ path, value: after });
      return;
    }
    const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
    keys.forEach((key) => {
      const nextPath = [...path, key];
      if (!Object.prototype.hasOwnProperty.call(after, key)) {
        removed.push(nextPath);
      } else {
        visit(before[key], after[key], nextPath);
      }
    });
  }

  visit(previous, next, []);
  return { changes, removed };
}

function getSnapshotCache(runtime) {
  if (!runtime) return null;
  if (!runtime.olingClashSnapshotCache) {
    runtime.olingClashSnapshotCache = new Map();
  }
  return runtime.olingClashSnapshotCache;
}

function cacheSnapshot(cache, matchCode, snapshot) {
  if (!cache) return;
  cache.delete(matchCode);
  cache.set(matchCode, snapshot);
  while (cache.size > MAX_CACHED_LIVE_MATCHES) {
    cache.delete(cache.keys().next().value);
  }
}

function recordClashEvent(match, type, options = {}) {
  if (!match) throw new TypeError('An Oling Clash match is required.');
  if (!Array.isArray(match.events)) match.events = [];
  if (match.events.length >= MAX_EMBEDDED_EVENTS) {
    const error = new Error('That Oling Clash event log is full.');
    error.status = 409;
    error.code = 'oling_clash_event_limit_reached';
    throw error;
  }

  const actor = options.accountId
    ? match.players?.find(
        (player) => String(player.accountId) === String(options.accountId)
      )
    : null;
  match.events.push({
    sequence: Number(match.events.at(-1)?.sequence || 0) + 1,
    round: Number(options.round ?? match.round ?? 0),
    type,
    actorAccountId: options.accountId || null,
    actorSlot: options.actorSlot || actor?.slot || null,
    damageSource: options.damageSource || null,
    damageType: options.damageType || null,
    visibility: options.visibility || 'public',
    payload: options.payload || {}
  });
  match.stateRevision = Math.max(0, Number(match.stateRevision || 0)) + 1;
  refreshDerivedState(match, type, options.payload || {});
  return match.events.at(-1);
}

function emitClashUpdate(runtime, match, eventType = 'oling-clash:state') {
  const serialized = normalizeSnapshot(serializeLiveClashMatch(match));
  const cache = getSnapshotCache(runtime);
  const previous = cache?.get(match.matchCode) || null;
  let payload = serialized;
  if (
    previous &&
    previous.gameId === serialized.gameId &&
    Number(serialized.revision) > Number(previous.revision)
  ) {
    const patch = createSnapshotPatch(previous, serialized);
    const candidate = {
      type: 'patch',
      matchCode: serialized.matchCode,
      gameId: serialized.gameId,
      baseRevision: Number(previous.revision || 0),
      revision: Number(serialized.revision || 0),
      ...patch
    };
    if (JSON.stringify(candidate).length < JSON.stringify(serialized).length) {
      payload = candidate;
    }
  }
  cacheSnapshot(cache, match.matchCode, serialized);
  runtime?.olingClashDeadlineCoordinator?.sync?.(match);
  runtime?.io?.to?.(match.matchCode)?.emit?.(eventType, payload);
  return serialized;
}

module.exports = {
  createSnapshotPatch,
  emitClashUpdate,
  recordClashEvent
};
