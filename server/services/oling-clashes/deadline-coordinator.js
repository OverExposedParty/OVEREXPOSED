const { emitClashUpdate } = require('./events');
const { serializeLiveClashMatch } = require('./match-view');
const { finalizeExpiredClashSelections } = require('./selections');
const { parseClashTimestamp } = require('./timing');

const MAX_TIMEOUT_MS = 2_147_000_000;

function resolveQuery(query) {
  return typeof query?.exec === 'function' ? query.exec() : query;
}

function createOlingClashDeadlineCoordinator({
  models,
  runtime,
  intervalMs = 15_000,
  now = Date.now,
  random = Math.random,
  finalize = finalizeExpiredClashSelections,
  setInterval: scheduleRecovery = setInterval,
  clearInterval: cancelRecovery = clearInterval,
  setTimeout: scheduleDeadline = setTimeout,
  clearTimeout: cancelDeadline = clearTimeout,
  onError = (error) =>
    console.error('Failed to finalize expired Oling Clash selections:', error)
} = {}) {
  let intervalId = null;
  let sweepPending = false;
  let reconcilePending = false;
  const deadlineTimers = new Map();
  const finalizingCodes = new Set();

  async function findExpiredMatches() {
    if (typeof models?.OlingClashMatch?.find !== 'function') return [];
    let query = models.OlingClashMatch.find({
      status: 'active',
      phase: 'selection',
      phaseEndsAt: { $lte: new Date(Number(now())) }
    });
    if (typeof query?.select === 'function') query = query.select('matchCode');
    if (typeof query?.lean === 'function') query = query.lean();
    const matches = await resolveQuery(query);
    return Array.isArray(matches) ? matches : [];
  }

  async function findScheduledMatches() {
    if (typeof models?.OlingClashMatch?.find !== 'function') return [];
    let query = models.OlingClashMatch.find({
      status: 'active',
      phase: 'selection',
      phaseEndsAt: { $ne: null }
    });
    if (typeof query?.select === 'function') {
      query = query.select('matchCode status phase phaseEndsAt');
    }
    if (typeof query?.lean === 'function') query = query.lean();
    const matches = await resolveQuery(query);
    return Array.isArray(matches) ? matches : [];
  }

  function clearScheduledMatch(matchCode) {
    const normalized = String(matchCode || '').toUpperCase();
    const scheduled = deadlineTimers.get(normalized);
    if (!scheduled) return false;
    cancelDeadline(scheduled.id);
    deadlineTimers.delete(normalized);
    return true;
  }

  function broadcast(result) {
    const match = result?.match;
    if (!result?.finalized || !match?.matchCode) return false;
    if (result.roundResult) {
      runtime?.io?.to?.(match.matchCode)?.emit?.('oling-clash:round-resolved', {
        gameId: result.archive?.gameId || match.gameId,
        archiveId: result.archive?._id ? String(result.archive._id) : null,
        completed: Boolean(result.archive),
        match: result.resolvedMatch
          ? serializeLiveClashMatch(result.resolvedMatch)
          : null,
        result: result.roundResult
      });
    }
    emitClashUpdate(runtime, match, 'oling-clash:round');
    return true;
  }

  async function finalizeMatch(matchCode) {
    const normalized = String(matchCode || '').toUpperCase();
    if (!normalized || finalizingCodes.has(normalized)) return null;
    finalizingCodes.add(normalized);
    try {
      const result = await finalize({
        models,
        matchCode: normalized,
        now,
        random
      });
      if (result?.finalized) broadcast(result);
      return result;
    } catch (error) {
      onError(error, { matchCode: normalized });
      return null;
    } finally {
      finalizingCodes.delete(normalized);
    }
  }

  function sync(match) {
    const matchCode = String(match?.matchCode || '').toUpperCase();
    if (!matchCode) return false;
    const deadline = parseClashTimestamp(match?.phaseEndsAt);
    if (
      match.status !== 'active' ||
      match.phase !== 'selection' ||
      !Number.isFinite(deadline)
    ) {
      clearScheduledMatch(matchCode);
      return false;
    }

    const existing = deadlineTimers.get(matchCode);
    if (existing?.deadline === deadline) return true;
    clearScheduledMatch(matchCode);
    const delay = Math.min(
      MAX_TIMEOUT_MS,
      Math.max(0, deadline - Number(now()))
    );
    const id = scheduleDeadline(() => {
      deadlineTimers.delete(matchCode);
      void finalizeMatch(matchCode);
    }, delay);
    id?.unref?.();
    deadlineTimers.set(matchCode, { deadline, id });
    return true;
  }

  async function sweep() {
    if (sweepPending) return [];
    sweepPending = true;
    try {
      const expiredMatches = await findExpiredMatches();
      const results = [];
      for (const expiredMatch of expiredMatches) {
        const result = await finalizeMatch(expiredMatch.matchCode);
        if (result) results.push(result);
      }
      return results;
    } finally {
      sweepPending = false;
    }
  }

  async function reconcile() {
    if (reconcilePending) return [];
    reconcilePending = true;
    try {
      const matches = await findScheduledMatches();
      const activeCodes = new Set();
      matches.forEach((match) => {
        activeCodes.add(String(match.matchCode || '').toUpperCase());
        sync(match);
      });
      for (const matchCode of deadlineTimers.keys()) {
        if (!activeCodes.has(matchCode)) clearScheduledMatch(matchCode);
      }
      return matches;
    } catch (error) {
      onError(error);
      return [];
    } finally {
      reconcilePending = false;
    }
  }

  function start() {
    if (intervalId !== null) return intervalId;
    void reconcile();
    intervalId = scheduleRecovery(
      () => void reconcile(),
      Math.max(1_000, intervalMs)
    );
    intervalId?.unref?.();
    return intervalId;
  }

  function stop() {
    const wasRunning = intervalId !== null || deadlineTimers.size > 0;
    if (intervalId !== null) cancelRecovery(intervalId);
    intervalId = null;
    for (const matchCode of [...deadlineTimers.keys()]) {
      clearScheduledMatch(matchCode);
    }
    return wasRunning;
  }

  return {
    findExpiredMatches,
    findScheduledMatches,
    isRunning: () => intervalId !== null,
    reconcile,
    start,
    stop,
    sweep,
    sync
  };
}

module.exports = { createOlingClashDeadlineCoordinator };
