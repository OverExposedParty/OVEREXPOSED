const { snapshotBattleOling } = require('./battle-players');
const { recordBattleEvent } = require('./events');
const { getBattleMatch } = require('./match-lifecycle');

async function selectBattlePlayerOling({
  models,
  account,
  matchCode,
  olingId
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

  const player = match.players.find(
    (item) => String(item.accountId) === String(account._id)
  );
  if (!player) {
    const error = new Error('You are not part of that Oling battle.');
    error.status = 403;
    error.code = 'oling_battle_player_required';
    throw error;
  }

  const snapshot = await snapshotBattleOling(models, account, olingId);
  const slot = player.slot;
  Object.assign(player, snapshot.player, {
    connected: true,
    ready: false,
    slot
  });
  match.status = match.players.length === 2 ? 'ready' : 'waiting';
  await match.save();
  await recordBattleEvent(models, match, 'oling-selected', account._id, {
    olingId: String(olingId)
  });
  return match;
}

async function leaveBattleMatch({ models, account, matchCode }) {
  const match = await getBattleMatch({ models, matchCode });
  if (!match) {
    const error = new Error('That Oling battle could not be found.');
    error.status = 404;
    error.code = 'oling_battle_not_found';
    throw error;
  }

  const player = match.players.find(
    (item) => String(item.accountId) === String(account._id)
  );
  if (!player) {
    const error = new Error('You are not part of that Oling battle.');
    error.status = 403;
    error.code = 'oling_battle_player_required';
    throw error;
  }

  player.connected = false;
  player.ready = false;
  if (['active', 'overtime'].includes(match.status)) {
    const opponent = match.players.find(
      (item) => String(item.accountId) !== String(account._id)
    );
    match.status = 'completed';
    match.state.phase = 'complete';
    match.state.endedAt = new Date();
    match.state.endReason = 'surrender';
    match.state.winnerAccountId = opponent?.accountId || null;
  } else if (match.players.every((item) => !item.connected)) {
    match.status = 'abandoned';
    match.state.phase = 'complete';
    match.state.endedAt = new Date();
    match.state.endReason = 'abandoned';
  } else {
    match.players.forEach((item) => {
      item.ready = false;
    });
    match.status = 'waiting';
    match.state.phase = 'waiting';
    match.state.countdownStartedAt = null;
  }

  await match.save();
  await recordBattleEvent(models, match, 'left', account._id);
  return match;
}

async function kickBattleOpponent({ models, account, matchCode }) {
  const match = await getBattleMatch({ models, matchCode });
  if (!match) {
    const error = new Error('That Oling battle could not be found.');
    error.status = 404;
    error.code = 'oling_battle_not_found';
    throw error;
  }
  if (!['waiting', 'ready'].includes(match.status)) {
    const error = new Error(
      'Players can only be kicked before the battle starts.'
    );
    error.status = 409;
    error.code = 'oling_battle_already_started';
    throw error;
  }

  const hostPlayer = match.players.find(
    (item) =>
      item.slot === 'player-one' &&
      String(item.accountId) === String(account._id)
  );
  if (!hostPlayer) {
    const error = new Error(
      'Only the host can kick players from this Oling battle.'
    );
    error.status = 403;
    error.code = 'oling_battle_host_required';
    throw error;
  }

  const opponentPlayer = match.players.find(
    (item) => item.slot !== 'player-one' && item.connected !== false
  );
  if (!opponentPlayer) {
    const error = new Error(
      'There is no opponent to kick from this Oling battle.'
    );
    error.status = 404;
    error.code = 'oling_battle_opponent_not_found';
    throw error;
  }

  match.players = match.players.filter(
    (item) => String(item.accountId) !== String(opponentPlayer.accountId)
  );
  match.players.forEach((item) => {
    item.ready = false;
  });
  match.status = 'waiting';
  match.state.phase = 'waiting';
  match.state.countdownStartedAt = null;

  await match.save();
  await recordBattleEvent(models, match, 'kicked', account._id, {
    kickedAccountId: String(opponentPlayer.accountId)
  });
  return match;
}

module.exports = {
  kickBattleOpponent,
  leaveBattleMatch,
  selectBattlePlayerOling
};
