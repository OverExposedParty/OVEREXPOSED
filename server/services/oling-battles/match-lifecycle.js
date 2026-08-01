const {
  DEFAULT_MARKER_DIRECTION,
  DEFAULT_MARKER_POSITION
} = require('./constants');
const {
  assertMatchCode,
  generateUniqueMatchCode,
  normalizeMatchCode,
  normalizeMatchLengthSeconds
} = require('./match-codes');
const { snapshotBattleOling } = require('./battle-players');
const { recordBattleEvent } = require('./events');

async function createBattleMatch({
  models,
  account,
  olingId,
  matchLengthSeconds
}) {
  const { OlingBattleMatch } = models;
  const snapshot = await snapshotBattleOling(models, account, olingId);
  const matchCode = await generateUniqueMatchCode(OlingBattleMatch);
  const match = await OlingBattleMatch.create({
    matchCode,
    config: {
      matchLengthSeconds: normalizeMatchLengthSeconds(matchLengthSeconds)
    },
    players: [
      {
        ...snapshot.player,
        slot: 'player-one'
      }
    ],
    state: {
      marker: {
        direction: DEFAULT_MARKER_DIRECTION,
        isFullDisruption: false,
        position: DEFAULT_MARKER_POSITION,
        updatedAt: new Date()
      },
      phase: 'waiting',
      timeMultiplier: 1
    },
    status: 'waiting'
  });

  await recordBattleEvent(models, match, 'created', account._id, {
    olingId: String(olingId)
  });
  return match;
}

async function getBattleMatch({ models, matchCode }) {
  assertMatchCode(matchCode);
  return models.OlingBattleMatch.findOne({
    matchCode: normalizeMatchCode(matchCode)
  });
}

async function joinBattleMatch({ models, account, matchCode, olingId }) {
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

  const accountId = String(account._id);
  const existingPlayer = match.players.find(
    (player) => String(player.accountId) === accountId
  );
  if (existingPlayer) {
    existingPlayer.connected = true;
    existingPlayer.ready = false;
    match.players.forEach((player) => {
      player.ready = false;
    });
    match.status = 'waiting';
    match.state.phase = 'waiting';
    match.state.countdownStartedAt = null;
    await match.save();
    return match;
  }
  if (match.players.length >= 2) {
    const error = new Error('That Oling battle is full.');
    error.status = 409;
    error.code = 'oling_battle_full';
    throw error;
  }

  const snapshot = await snapshotBattleOling(models, account, olingId);
  match.players.push({
    ...snapshot.player,
    slot: match.players.some((player) => player.slot === 'player-one')
      ? 'player-two'
      : 'player-one'
  });
  match.players.forEach((player) => {
    player.ready = false;
  });
  match.status = 'waiting';
  match.state.phase = 'waiting';
  match.state.countdownStartedAt = null;
  await match.save();
  await recordBattleEvent(models, match, 'joined', account._id, {
    olingId: String(olingId)
  });
  return match;
}

async function readyBattlePlayer({ models, account, matchCode, ready = true }) {
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

  player.ready = Boolean(ready);
  const now = new Date();
  if (match.players.length === 2 && match.players.every((item) => item.ready)) {
    match.status = 'ready';
    match.state.phase = 'countdown';
    match.state.countdownStartedAt = match.state.countdownStartedAt || now;
  } else {
    match.status = 'waiting';
    match.state.phase = 'waiting';
    match.state.countdownStartedAt = null;
    match.state.startedAt = null;
  }
  await match.save();
  await recordBattleEvent(
    models,
    match,
    player.ready ? 'ready' : 'unready',
    account._id
  );
  return match;
}

async function startBattleMatch({ models, account, matchCode }) {
  const match = await getBattleMatch({ models, matchCode });
  if (!match) {
    const error = new Error('That Oling battle could not be found.');
    error.status = 404;
    error.code = 'oling_battle_not_found';
    throw error;
  }
  if (
    !match.players.some(
      (player) => String(player.accountId) === String(account._id)
    )
  ) {
    const error = new Error('You are not part of that Oling battle.');
    error.status = 403;
    error.code = 'oling_battle_player_required';
    throw error;
  }
  if (
    match.players.length !== 2 ||
    !match.players.every((player) => player.ready)
  ) {
    const error = new Error(
      'Both players must be ready before the battle starts.'
    );
    error.status = 409;
    error.code = 'oling_battle_players_not_ready';
    throw error;
  }

  const countdownStartedAt = new Date(
    match.state.countdownStartedAt || 0
  ).getTime();
  if (!countdownStartedAt || Date.now() - countdownStartedAt < 5000) {
    const error = new Error('The battle countdown is still running.');
    error.status = 409;
    error.code = 'oling_battle_countdown_active';
    throw error;
  }

  if (match.status !== 'active') {
    const now = new Date();
    match.status = 'active';
    match.state.phase = 'active';
    match.state.startedAt = now;
    match.state.marker.updatedAt = now;
    await match.save();
    await recordBattleEvent(models, match, 'started', account._id);
  }
  return match;
}

module.exports = {
  createBattleMatch,
  getBattleMatch,
  joinBattleMatch,
  readyBattlePlayer,
  startBattleMatch
};
