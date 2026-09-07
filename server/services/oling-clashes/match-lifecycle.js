const {
  assertMatchCode,
  generateUniqueMatchCode,
  normalizeMatchCode
} = require('./match-codes');
const { recordClashEvent } = require('./events');
const {
  getCurrentClashContent,
  hydrateClashAbilitySnapshots,
  snapshotClashTeam
} = require('./snapshots');
const { getSelectionDeadline } = require('./timing');
const { createInitialTagState, resetTagState } = require('./tag-economy');
const { createActiveOlingFilter } = require('../olings/residency');

function createRequestError(message, status, code) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

function getClashPlayerIdentity(account) {
  const level = Number(account?.gameData?.level);
  return {
    playerName:
      account?.profile?.displayName ||
      account?.username ||
      account?.email ||
      'PLAYER',
    playerLevel: Number.isFinite(level) && level > 0 ? Math.floor(level) : 1,
    oeIcon: account?.profile?.oeIcon || '0000:0100:0200:0300'
  };
}

async function assertClashPlayerEligible(models, account) {
  const ownedOlingCount = await models.PlayerOling.countDocuments({
    ...createActiveOlingFilter(account._id)
  });
  if (ownedOlingCount < 3) {
    const error = createRequestError(
      'You need at least 3 Olings to enter an Oling Clash.',
      409,
      'oling_clash_three_olings_required'
    );
    error.details = { ownedOlingCount, requiredOlingCount: 3 };
    throw error;
  }
  return ownedOlingCount;
}

async function getClashMatch({ models, matchCode }) {
  assertMatchCode(matchCode);
  const match = await models.OlingClashMatch.findOne({
    matchCode: normalizeMatchCode(matchCode)
  });
  return hydrateClashAbilitySnapshots(models, match);
}

function getClashPlayer(match, account) {
  return match.players.find(
    (player) => String(player.accountId) === String(account._id)
  );
}

function isClashReadyToStart(match) {
  const host = match?.players?.find((player) => player.slot === 'player-one');
  const opponent = match?.players?.find(
    (player) => player.slot === 'player-two'
  );
  return Boolean(
    host?.team?.length === 3 && opponent?.team?.length === 3 && opponent.ready
  );
}

async function createClashMatch({
  models,
  account,
  olingIds,
  rulesetKey = 'standard'
}) {
  await assertClashPlayerEligible(models, account);
  const content = await getCurrentClashContent(models, rulesetKey);
  const team = Array.isArray(olingIds)
    ? await snapshotClashTeam(models, account, olingIds, content.ruleset)
    : [];
  const matchCode = await generateUniqueMatchCode(models.OlingClashMatch);
  const match = await models.OlingClashMatch.create({
    matchCode,
    status: 'waiting',
    phase: 'waiting',
    phaseEndsAt: null,
    round: 0,
    ruleset: content.ruleset,
    statusDefinitions: content.statusDefinitions,
    players: [
      {
        accountId: account._id,
        ...getClashPlayerIdentity(account),
        slot: 'player-one',
        connected: true,
        ready: false,
        activeTeamSlot: 0,
        ...createInitialTagState(content.ruleset),
        statuses: [],
        team
      }
    ]
  });
  recordClashEvent(match, 'created', {
    accountId: account._id,
    payload: { olingIds: team.map((oling) => String(oling.playerOlingId)) }
  });
  await match.save();
  return match;
}

async function joinClashMatch({
  models,
  account,
  matchCode,
  olingIds,
  retryCount = 0
}) {
  const match = await getClashMatch({ models, matchCode });
  if (!match) {
    throw createRequestError(
      'That Oling Clash could not be found.',
      404,
      'oling_clash_not_found'
    );
  }
  const existing = getClashPlayer(match, account);
  if (existing) {
    existing.connected = true;
    await match.save();
    return match;
  }
  if (!['waiting', 'ready'].includes(match.status)) {
    throw createRequestError(
      'That Oling Clash has already started.',
      409,
      'oling_clash_already_started'
    );
  }
  if (match.players.length >= 2) {
    throw createRequestError(
      'That Oling Clash is full.',
      409,
      'oling_clash_full'
    );
  }
  await assertClashPlayerEligible(models, account);
  const team = Array.isArray(olingIds)
    ? await snapshotClashTeam(models, account, olingIds, match.ruleset)
    : [];
  match.players.push({
    accountId: account._id,
    ...getClashPlayerIdentity(account),
    slot: match.players.some((player) => player.slot === 'player-one')
      ? 'player-two'
      : 'player-one',
    connected: true,
    ready: false,
    activeTeamSlot: 0,
    ...createInitialTagState(match.ruleset),
    statuses: [],
    team
  });
  match.players.forEach((player) => {
    player.ready = false;
  });
  match.status = 'waiting';
  match.phase = 'waiting';
  match.phaseEndsAt = null;
  recordClashEvent(match, 'joined', {
    accountId: account._id,
    payload: { olingIds: team.map((oling) => String(oling.playerOlingId)) }
  });
  try {
    await match.save();
  } catch (error) {
    if (error?.name === 'VersionError' && retryCount < 2) {
      return joinClashMatch({
        models,
        account,
        matchCode,
        olingIds,
        retryCount: retryCount + 1
      });
    }
    throw error;
  }
  return match;
}

async function updateClashTeam({ models, account, matchCode, olingIds }) {
  const match = await getClashMatch({ models, matchCode });
  if (!match) {
    throw createRequestError(
      'That Oling Clash could not be found.',
      404,
      'oling_clash_not_found'
    );
  }
  if (!['waiting', 'ready'].includes(match.status)) {
    throw createRequestError(
      'Teams cannot be changed after a Clash starts.',
      409,
      'oling_clash_team_locked'
    );
  }
  const player = getClashPlayer(match, account);
  if (!player) {
    throw createRequestError(
      'You are not part of that Oling Clash.',
      403,
      'oling_clash_player_required'
    );
  }
  player.team = await snapshotClashTeam(
    models,
    account,
    olingIds,
    match.ruleset
  );
  match.players.forEach((item) => {
    item.ready = Boolean(item.isAi);
    item.rematchAccepted = Boolean(item.isAi);
  });
  match.status = isClashReadyToStart(match) ? 'ready' : 'waiting';
  match.phase = 'waiting';
  match.phaseEndsAt = null;
  recordClashEvent(match, 'team-updated', {
    accountId: account._id,
    payload: { olingIds: olingIds.map(String) }
  });
  await match.save();
  return match;
}

async function readyClashPlayer({
  models,
  account,
  matchCode,
  ready = true,
  retryCount = 0
}) {
  const match = await getClashMatch({ models, matchCode });
  if (!match) {
    throw createRequestError(
      'That Oling Clash could not be found.',
      404,
      'oling_clash_not_found'
    );
  }
  if (!['waiting', 'ready'].includes(match.status)) {
    throw createRequestError(
      'That Oling Clash has already started.',
      409,
      'oling_clash_already_started'
    );
  }
  const player = getClashPlayer(match, account);
  if (!player) {
    throw createRequestError(
      'You are not part of that Oling Clash.',
      403,
      'oling_clash_player_required'
    );
  }
  if (player.team.length !== 3) {
    throw createRequestError(
      'Select 3 Olings before readying up.',
      409,
      'oling_clash_team_required'
    );
  }
  player.ready = Boolean(ready);
  match.status = isClashReadyToStart(match) ? 'ready' : 'waiting';
  match.phase = 'waiting';
  match.phaseEndsAt = null;
  recordClashEvent(match, player.ready ? 'ready' : 'unready', {
    accountId: account._id
  });
  try {
    await match.save();
  } catch (error) {
    if (error?.name === 'VersionError' && retryCount < 2) {
      return readyClashPlayer({
        models,
        account,
        matchCode,
        ready,
        retryCount: retryCount + 1
      });
    }
    throw error;
  }
  return match;
}

async function requestClashRematch({
  models,
  account,
  matchCode,
  accepted = true,
  retryCount = 0
}) {
  const match = await getClashMatch({ models, matchCode });
  if (!match) {
    throw createRequestError(
      'That Oling Clash could not be found.',
      404,
      'oling_clash_not_found'
    );
  }
  if (!['waiting', 'ready'].includes(match.status)) {
    throw createRequestError(
      'That Oling Clash is not waiting for a rematch.',
      409,
      'oling_clash_rematch_unavailable'
    );
  }
  const player = getClashPlayer(match, account);
  if (!player || player.isAi) {
    throw createRequestError(
      'You are not part of that Oling Clash.',
      403,
      'oling_clash_player_required'
    );
  }
  if (
    accepted &&
    (match.players.length !== 2 ||
      match.players.some((item) => item.team.length !== 3))
  ) {
    throw createRequestError(
      'Both players need complete teams before starting a rematch.',
      409,
      'oling_clash_team_required'
    );
  }

  if (accepted) player.rematchAccepted = true;
  else {
    match.players.forEach((item) => {
      item.rematchAccepted = Boolean(item.isAi);
    });
  }
  recordClashEvent(
    match,
    player.rematchAccepted ? 'rematch-accepted' : 'rematch-declined',
    { accountId: account._id }
  );
  const rematchReady = match.players.every(
    (item) => item.isAi || item.rematchAccepted
  );
  if (rematchReady) {
    match.status = 'active';
    match.phase = 'starting';
    match.phaseEndsAt = null;
    match.round = 0;
    match.startedAt = null;
    match.players.forEach((item) => {
      item.selection = null;
      item.selectionDraft = null;
      item.gameLoaded = Boolean(item.isAi);
      item.rematchAccepted = Boolean(item.isAi);
      resetTagState(item, match);
    });
    recordClashEvent(match, 'starting', {
      accountId: account._id,
      round: 0,
      payload: { rematch: true }
    });
  }
  try {
    await match.save();
  } catch (error) {
    if (error?.name === 'VersionError' && retryCount < 2) {
      return requestClashRematch({
        models,
        account,
        matchCode,
        accepted,
        retryCount: retryCount + 1
      });
    }
    throw error;
  }
  return match;
}

async function startClashMatch({ models, account, matchCode }) {
  const match = await getClashMatch({ models, matchCode });
  if (!match) {
    throw createRequestError(
      'That Oling Clash could not be found.',
      404,
      'oling_clash_not_found'
    );
  }
  const player = getClashPlayer(match, account);
  if (!player) {
    throw createRequestError(
      'You are not part of that Oling Clash.',
      403,
      'oling_clash_player_required'
    );
  }
  if (player.slot !== 'player-one' || player.isAi) {
    throw createRequestError(
      'Only the Clash host can start the match.',
      403,
      'oling_clash_host_required'
    );
  }
  if (!isClashReadyToStart(match)) {
    throw createRequestError(
      'The opponent must ready up before the Clash starts.',
      409,
      'oling_clash_players_not_ready'
    );
  }
  if (match.status !== 'active') {
    match.status = 'active';
    match.phase = 'starting';
    match.phaseEndsAt = null;
    match.round = 0;
    match.startedAt = null;
    match.players.forEach((player) => {
      player.selection = null;
      player.selectionDraft = null;
      player.gameLoaded = Boolean(player.isAi);
      resetTagState(player, match);
    });
    recordClashEvent(match, 'starting', {
      accountId: account._id,
      round: 0
    });
    await match.save();
  }
  return match;
}

async function markClashPlayerLoaded({
  models,
  account,
  matchCode,
  retryCount = 0
}) {
  const match = await getClashMatch({ models, matchCode });
  if (!match) {
    throw createRequestError(
      'That Oling Clash could not be found.',
      404,
      'oling_clash_not_found'
    );
  }
  const player = getClashPlayer(match, account);
  if (!player || player.isAi) {
    throw createRequestError(
      'You are not part of that Oling Clash.',
      403,
      'oling_clash_player_required'
    );
  }
  if (match.status !== 'active') {
    throw createRequestError(
      'That Oling Clash has not started.',
      409,
      'oling_clash_not_active'
    );
  }
  if (match.phase !== 'starting') return match;

  if (!player.gameLoaded) {
    player.gameLoaded = true;
    recordClashEvent(match, 'game-loaded', { accountId: account._id });
  }
  if (match.players.every((item) => item.isAi || item.gameLoaded)) {
    match.phase = 'selection';
    match.phaseEndsAt = getSelectionDeadline();
    match.round = 1;
    match.startedAt = new Date();
    recordClashEvent(match, 'started', { accountId: account._id, round: 1 });
  }
  try {
    await match.save();
  } catch (error) {
    if (error?.name === 'VersionError' && retryCount < 2) {
      return markClashPlayerLoaded({
        models,
        account,
        matchCode,
        retryCount: retryCount + 1
      });
    }
    throw error;
  }
  return match;
}

module.exports = {
  assertClashPlayerEligible,
  createClashMatch,
  createRequestError,
  getClashMatch,
  getClashPlayer,
  getClashPlayerIdentity,
  isClashReadyToStart,
  joinClashMatch,
  markClashPlayerLoaded,
  readyClashPlayer,
  requestClashRematch,
  startClashMatch,
  updateClashTeam
};
