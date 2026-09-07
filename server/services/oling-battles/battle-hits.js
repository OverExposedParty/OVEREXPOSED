const { HIT_DAMAGE } = require('./constants');
const { archiveAndResetBattle } = require('./archives');
const { getAiOpponent, getHumanMatchPlayer } = require('./battle-players');
const { recordBattleEvent } = require('./events');
const { getBattleMatch } = require('./match-lifecycle');

function isBattleSaveConflict(error) {
  return (
    error?.name === 'VersionError' ||
    error?.code === 'VERSION_CONFLICT' ||
    (Number(error?.status) === 409 &&
      error?.code === 'document_version_conflict')
  );
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

  if (ended) {
    match.status = 'completed';
    match.state.phase = 'complete';
    match.state.endedAt = new Date();
    match.state.endReason = 'knockout';
    match.state.winnerAccountId = account._id;
    await recordBattleEvent(
      models,
      match,
      'completed',
      account._id,
      battleResult
    );
    await archiveAndResetBattle({
      models,
      match,
      completionStatus: 'completed'
    });
  } else {
    await recordBattleEvent(models, match, 'hit', account._id, battleResult);
    await match.save();
  }
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
