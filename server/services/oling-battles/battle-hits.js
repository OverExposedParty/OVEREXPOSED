const {
  DEFAULT_MARKER_DIRECTION,
  DEFAULT_MARKER_POSITION,
  HIT_DAMAGE,
  MAX_HIT_HISTORY
} = require('./constants');
const { getAiOpponent, getHumanMatchPlayer } = require('./battle-players');
const { recordBattleEvent } = require('./events');
const { getBattleMatch } = require('./match-lifecycle');

function resetBattleMatch(match) {
  match.players.forEach((player) => {
    player.currentHealth = player.maxHealth;
    player.lastActionAt = null;
    player.ready = false;
    player.stunUntil = null;
  });
  match.status = 'waiting';
  match.state.phase = 'waiting';
  match.state.countdownStartedAt = null;
  match.state.startedAt = null;
  match.state.endedAt = null;
  match.state.endReason = null;
  match.state.winnerAccountId = null;
  match.state.timeMultiplier = 1;
  match.state.hitHistory = [];
  match.state.marker = {
    direction: DEFAULT_MARKER_DIRECTION,
    isFullDisruption: false,
    position: DEFAULT_MARKER_POSITION,
    updatedAt: new Date()
  };
}

async function resolveBattleHitOnce({ models, account, matchCode, zone }) {
  const normalizedZone = String(zone || '').toLowerCase();
  if (!Object.hasOwn(HIT_DAMAGE, normalizedZone)) {
    const error = new Error('That battle hit zone is invalid.');
    error.status = 400;
    error.code = 'oling_battle_hit_zone_invalid';
    throw error;
  }

  const match = await getBattleMatch({ models, matchCode });
  if (!match) {
    const error = new Error('That Oling battle could not be found.');
    error.status = 404;
    error.code = 'oling_battle_not_found';
    throw error;
  }
  if (!['active', 'overtime'].includes(match.status)) {
    const error = new Error('That Oling battle is not active.');
    error.status = 409;
    error.code = 'oling_battle_not_active';
    throw error;
  }

  const attacker = match.players.find(
    (player) => String(player.accountId) === String(account._id)
  );
  if (!attacker) {
    const error = new Error('You are not part of that Oling battle.');
    error.status = 403;
    error.code = 'oling_battle_player_required';
    throw error;
  }

  const result =
    normalizedZone === 'critical'
      ? 'CRITICAL HIT'
      : normalizedZone === 'strike'
        ? Math.random() < 0.5
          ? 'HIT'
          : 'MISS'
        : 'STUN';
  const damage = result === 'MISS' ? 0 : HIT_DAMAGE[normalizedZone];
  const opponent = match.players.find(
    (player) => String(player.accountId) !== String(account._id)
  );
  if (!opponent) {
    const error = new Error('An opponent has not joined this battle.');
    error.status = 409;
    error.code = 'oling_battle_opponent_required';
    throw error;
  }
  const resolvedTarget = opponent;
  resolvedTarget.currentHealth = Math.max(
    0,
    Number(resolvedTarget.currentHealth || resolvedTarget.maxHealth) - damage
  );
  attacker.lastActionAt = new Date();

  const sequence = Number(match.state.hitHistory?.at?.(-1)?.sequence || 0) + 1;
  match.state.hitHistory.push({
    accountId: account._id,
    createdAt: new Date(),
    multiplier: Number(match.state.timeMultiplier) || 1,
    result,
    sequence,
    zone: normalizedZone
  });
  if (match.state.hitHistory.length > MAX_HIT_HISTORY) {
    match.state.hitHistory.splice(
      0,
      match.state.hitHistory.length - MAX_HIT_HISTORY
    );
  }

  const ended = resolvedTarget.currentHealth <= 0;
  const battleResult = {
    damage,
    ended,
    result,
    targetCurrentHealth: resolvedTarget.currentHealth,
    targetMaxHealth: resolvedTarget.maxHealth,
    targetSlot: opponent.slot,
    winnerAccountId: ended ? String(account._id) : null,
    zone: normalizedZone
  };

  if (ended) resetBattleMatch(match);
  await match.save();
  await recordBattleEvent(
    models,
    match,
    ended ? 'completed' : 'hit',
    account._id,
    battleResult
  );
  return { battleResult, match };
}

async function resolveBattleHit(options) {
  const maximumAttempts = 3;
  for (let attempt = 1; attempt <= maximumAttempts; attempt += 1) {
    try {
      return await resolveBattleHitOnce(options);
    } catch (error) {
      if (!isBattleSaveConflict(error) || attempt === maximumAttempts) {
        throw error;
      }
    }
  }

  const error = new Error('That battle hit could not resolve.');
  error.status = 409;
  error.code = 'oling_battle_hit_conflict';
  throw error;
}

async function resolveAiBattleHit({ models, account, matchCode, zone }) {
  const match = await getBattleMatch({ models, matchCode });
  if (!match) {
    const error = new Error('That Oling battle could not be found.');
    error.status = 404;
    error.code = 'oling_battle_not_found';
    throw error;
  }
  const humanPlayer = getHumanMatchPlayer(match, account);
  const aiPlayer = getAiOpponent(match, account);
  if (!humanPlayer || !aiPlayer) {
    const error = new Error('This battle does not have an AI opponent.');
    error.status = 409;
    error.code = 'oling_battle_ai_opponent_required';
    throw error;
  }

  return resolveBattleHit({
    models,
    account: { _id: aiPlayer.accountId },
    matchCode,
    zone
  });
}

module.exports = { resolveAiBattleHit, resolveBattleHit };
