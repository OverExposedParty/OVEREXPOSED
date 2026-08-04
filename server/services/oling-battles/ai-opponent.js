const { DEFAULT_AI_DIFFICULTY } = require('./constants');
const {
  clampDifficulty,
  createAiBattlePlayer,
  getAiOpponent,
  getHumanMatchPlayer
} = require('./battle-players');
const { recordBattleEvent } = require('./events');
const { getBattleMatch } = require('./match-lifecycle');

async function addAiBattleOpponent({
  models,
  account,
  matchCode,
  difficulty = DEFAULT_AI_DIFFICULTY
}) {
  const match = await getBattleMatch({ models, matchCode });
  if (!match) {
    const error = new Error('That Oling battle could not be found.');
    error.status = 404;
    error.code = 'oling_battle_not_found';
    throw error;
  }
  if (!['waiting', 'ready'].includes(match.status)) {
    const error = new Error('That Oling battle has already started.');
    error.status = 409;
    error.code = 'oling_battle_already_started';
    throw error;
  }

  const humanPlayer = getHumanMatchPlayer(match, account);
  if (!humanPlayer) {
    const error = new Error('You are not part of that Oling battle.');
    error.status = 403;
    error.code = 'oling_battle_player_required';
    throw error;
  }

  const existingAi = getAiOpponent(match, account);
  if (existingAi) {
    const replacement = await createAiBattlePlayer(
      models,
      existingAi.slot,
      difficulty
    );
    Object.assign(existingAi, replacement);
  } else {
    const nonAiOpponent = match.players.find(
      (item) => !item.isAi && String(item.accountId) !== String(account._id)
    );
    if (nonAiOpponent) {
      const error = new Error('This battle already has a human opponent.');
      error.status = 409;
      error.code = 'oling_battle_human_opponent_exists';
      throw error;
    }
    if (match.players.length >= 2) {
      const error = new Error('That Oling battle is full.');
      error.status = 409;
      error.code = 'oling_battle_full';
      throw error;
    }
    const slot = match.players.some((player) => player.slot === 'player-one')
      ? 'player-two'
      : 'player-one';
    match.players.push(await createAiBattlePlayer(models, slot, difficulty));
  }

  humanPlayer.ready = false;
  match.status = 'waiting';
  match.state.phase = 'waiting';
  match.state.countdownStartedAt = null;
  match.state.startedAt = null;
  await match.save();
  await recordBattleEvent(models, match, 'ai-joined', account._id, {
    difficulty: clampDifficulty(difficulty)
  });
  return match;
}

module.exports = { addAiBattleOpponent };
