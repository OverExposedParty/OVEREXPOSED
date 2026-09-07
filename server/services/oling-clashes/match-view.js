const { normalizeTagState } = require('./tag-economy');

const CLASH_ACTIONS = new Set(['attack', 'draw', 'guard', 'skill']);

function toPlainObject(value) {
  return value?.toObject ? value.toObject() : value;
}

function getEventPayload(event) {
  return event?.payload?.payload || event?.payload || null;
}

function getMoveActivationStatus(result, playerSlot, outcome) {
  if (outcome === 'loss') return 'failed';

  const activationStatus = (result?.triggeredStatuses || []).find(
    (status) =>
      status?.playerSlot === playerSlot &&
      ['activation-suppressed', 'activation-replaced-with-junk'].includes(
        status.outcome
      )
  );
  if (activationStatus?.outcome === 'activation-suppressed') {
    return 'suppressed';
  }
  if (activationStatus) return 'blocked';

  const activations = (result?.activations || []).filter(
    (activation) => activation?.playerSlot === playerSlot
  );
  const abilityKeys = new Set(
    activations.map((activation) => activation?.abilityKey).filter(Boolean)
  );
  const effects = (result?.effects || []).filter(
    (effect) =>
      (effect?.playerSlot === playerSlot ||
        effect?.stolenFromPlayerSlot === playerSlot) &&
      (abilityKeys.has(effect?.abilityKey) ||
        abilityKeys.has(effect?.redirectedByAbilityKey))
  );

  if (
    effects.length > 0 &&
    effects.every(
      (effect) =>
        effect.outcome === 'effect-prevented' ||
        effect.status === 'prevented' ||
        ['blocked', 'warded'].includes(effect.statusResult)
    )
  ) {
    return 'blocked';
  }
  if (
    effects.length > 0 &&
    effects.every(
      (effect) => effect.status === 'progressed' && effect.triggered === false
    )
  ) {
    return 'progressed';
  }

  const inactiveStatuses = new Set([
    'condition-not-met',
    'no-effect',
    'no-target',
    'prevented',
    'progressed'
  ]);
  return effects.some(
    (effect) =>
      effect?.triggered !== false &&
      !inactiveStatuses.has(effect?.status) &&
      effect?.outcome !== 'effect-prevented' &&
      !['blocked', 'warded'].includes(effect?.statusResult)
  )
    ? 'activated'
    : 'revealed';
}

function getLatestRoundResult(events = []) {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];
    if (event?.type === 'round-resolved') return getEventPayload(event);
  }
  return null;
}

function getPlayerLastMoves(events = [], player = {}) {
  const moves = new Map();
  if (!player?.slot) return [];

  let activeTeamSlot = Number(player.activeTeamSlot);
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];
    const payload = getEventPayload(event);
    if (event?.type === 'replacement-selected') {
      if (payload?.playerSlot === player.slot) {
        activeTeamSlot = Number(payload.previousTeamSlot ?? activeTeamSlot);
      }
      continue;
    }
    if (event?.type !== 'round-resolved' || !payload) continue;

    const tag = (payload.tags || []).find(
      (candidate) => candidate?.playerSlot === player.slot
    );
    const playedTeamSlot = Number(tag?.previousTeamSlot ?? activeTeamSlot);
    const isDraw = payload.outcome === 'draw' || !payload.winnerSlot;
    const selectedAction = payload.actions?.[player.slot];
    const action = isDraw ? 'draw' : selectedAction;
    if (
      Number.isInteger(playedTeamSlot) &&
      CLASH_ACTIONS.has(action) &&
      !moves.has(playedTeamSlot)
    ) {
      const outcome = isDraw
        ? 'draw'
        : payload.winnerSlot === player.slot
          ? 'win'
          : 'loss';
      moves.set(playedTeamSlot, {
        teamSlot: playedTeamSlot,
        action,
        activationStatus: getMoveActivationStatus(
          payload,
          player.slot,
          outcome
        ),
        outcome,
        round: Number(payload.round || event.round || 1)
      });
    }
    activeTeamSlot = playedTeamSlot;
  }

  return [...moves.values()];
}

function serializeClashMatch(match, viewerAccountId = null, options = {}) {
  if (!match) return null;
  const includeEvents = options.includeEvents !== false;
  const canUseDerivedState = Number(match.derivedStateVersion || 0) >= 1;
  const plain = !includeEvents && canUseDerivedState ? match : toPlainObject(match);
  const viewerId = viewerAccountId ? String(viewerAccountId) : null;
  const hasDerivedState = Number(plain.derivedStateVersion || 0) >= 1;
  const sourceEvents =
    includeEvents || !hasDerivedState ? plain.events || [] : [];
  const events = sourceEvents.filter((event) => {
    if (event.visibility === 'public') return true;
    return (
      event.visibility === 'player' &&
      viewerId &&
      String(event.actorAccountId || '') === viewerId
    );
  });

  return {
    id: String(plain._id || plain.id || ''),
    gameId: plain.gameId || null,
    matchCode: plain.matchCode,
    status: plain.status,
    phase: plain.phase,
    phaseEndsAt: plain.phaseEndsAt || null,
    revision: Math.max(0, Number(plain.stateRevision || 0)),
    round: Number(plain.round || 0),
    ruleset: plain.ruleset,
    players: (plain.players || []).map((player) => {
      const isViewer = viewerId && String(player.accountId) === viewerId;
      const tagState = normalizeTagState(player, plain);
      return {
        accountId: String(player.accountId || ''),
        username: player.playerName || 'PLAYER',
        level: Number(player.playerLevel || 1),
        oeIcon: player.oeIcon || '0000:0100:0200:0300',
        slot: player.slot,
        connected: Boolean(player.connected),
        gameLoaded: Boolean(player.gameLoaded),
        isAi: Boolean(player.isAi),
        aiDifficulty: player.isAi ? Number(player.aiDifficulty || 0) : null,
        ready: Boolean(player.ready),
        rematchAccepted: Boolean(player.rematchAccepted),
        activeTeamSlot: Number(player.activeTeamSlot || 0),
        tagCharges: tagState.charges,
        tagRechargeProgress: tagState.rechargeProgress,
        statuses: player.statuses || [],
        lastMoves: hasDerivedState
          ? player.lastMoves || []
          : getPlayerLastMoves(events, player),
        selectionCommitted: Boolean(player.selection),
        selection: isViewer ? player.selection || null : null,
        selectionDraft: isViewer ? player.selectionDraft || null : null,
        team: player.team || []
      };
    }),
    winnerAccountId: plain.winnerAccountId
      ? String(plain.winnerAccountId)
      : null,
    endReason: plain.endReason || null,
    latestRoundResult: hasDerivedState
      ? plain.latestRoundResult || null
      : getLatestRoundResult(events),
    ...(includeEvents && { events }),
    startedAt: plain.startedAt || null,
    endedAt: plain.endedAt || null,
    createdAt: plain.createdAt,
    updatedAt: plain.updatedAt
  };
}

function serializeLiveClashMatch(match, viewerAccountId = null) {
  return serializeClashMatch(match, viewerAccountId, { includeEvents: false });
}

module.exports = {
  getLatestRoundResult,
  getMoveActivationStatus,
  getPlayerLastMoves,
  serializeClashMatch,
  serializeLiveClashMatch,
  toPlainObject
};
