const { archiveAndResetClash, archiveClashGame } = require('./archives');
const { recordClashEvent } = require('./events');
const { toPlainObject } = require('./match-view');
const {
  createRequestError,
  getClashMatch,
  getClashPlayer
} = require('./match-lifecycle');

function cloneMatch(match) {
  return JSON.parse(JSON.stringify(toPlainObject(match)));
}

async function forfeitClashMatch({ models, account, matchCode }) {
  const match = await getClashMatch({ models, matchCode });
  if (!match) {
    throw createRequestError(
      'That Oling Clash could not be found.',
      404,
      'oling_clash_not_found'
    );
  }
  if (match.status !== 'active') {
    throw createRequestError(
      'That Oling Clash is no longer active.',
      409,
      'oling_clash_forfeit_unavailable'
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
  const opponent = match.players.find((item) => item.slot !== player.slot);
  if (!opponent) {
    throw createRequestError(
      'There is no opponent to award this Clash to.',
      409,
      'oling_clash_opponent_required'
    );
  }

  match.status = 'completed';
  match.phase = 'complete';
  match.phaseEndsAt = null;
  match.endedAt = new Date();
  match.winnerAccountId = opponent.accountId || null;
  match.endReason = 'surrender';
  match.players.forEach((item) => {
    item.selection = null;
    item.selectionDraft = null;
  });
  recordClashEvent(match, 'surrendered', {
    accountId: account._id,
    round: match.round,
    payload: {
      forfeitedPlayerSlot: player.slot,
      winnerSlot: opponent.slot
    }
  });

  const resolvedMatch = cloneMatch(match);
  const forfeitResult = {
    defeatedPlayerSlots: [player.slot],
    endReason: 'surrender',
    forfeitedPlayerSlot: player.slot,
    round: match.round,
    winnerSlot: opponent.slot
  };
  const archive = await archiveAndResetClash({
    models,
    match,
    completionStatus: 'completed'
  });
  return { archive, forfeitResult, match, resolvedMatch };
}

async function leaveClashMatch({ models, account, matchCode }) {
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

  let archive = null;
  if (['active'].includes(match.status)) {
    const opponent = match.players.find((item) => item.slot !== player.slot);
    match.status = 'completed';
    match.phase = 'complete';
    match.endedAt = new Date();
    match.winnerAccountId = opponent?.accountId || null;
    match.endReason = 'surrender';
    match.players.forEach((item) => {
      item.selection = null;
      item.selectionDraft = null;
    });
    recordClashEvent(match, 'surrendered', { accountId: account._id });
    archive = await archiveAndResetClash({
      models,
      match,
      completionStatus: 'completed'
    });
  }

  match.players = match.players.filter(
    (item) => String(item.accountId) !== String(account._id)
  );
  if (!match.players.some((item) => !item.isAi)) {
    match.players = [];
  }
  match.players.forEach((item) => {
    item.ready = false;
  });
  match.status = 'waiting';
  match.phase = 'waiting';
  if (match.players.length === 0) {
    if (!archive) {
      match.status = 'abandoned';
      match.phase = 'complete';
      match.endedAt = new Date();
      match.endReason = 'abandoned';
      recordClashEvent(match, 'lobby-closed', { accountId: account._id });
      archive = await archiveClashGame({
        models,
        match,
        completionStatus: 'lobby-closed'
      });
    }
    await models.OlingClashMatch.deleteOne({ _id: match._id });
    return { archive, deleted: true, match: null };
  }
  recordClashEvent(match, 'left', { accountId: account._id });
  await match.save();
  return { archive, deleted: false, match };
}

module.exports = { forfeitClashMatch, leaveClashMatch };
