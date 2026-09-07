const {
  createOlingClashGameId
} = require('../../../models/olings/oling-clash-game-id');
const { recordClashEvent } = require('./events');
const { toPlainObject } = require('./match-view');
const { resetTagState } = require('./tag-economy');

function createClashArchiveSnapshot(
  matchDocument,
  completionStatus = 'completed'
) {
  const match = toPlainObject(matchDocument);
  const endedAt = match.endedAt || new Date();
  return {
    gameId: match.gameId,
    sourceMatchId: match._id,
    matchCode: match.matchCode,
    completionStatus,
    startedAt: match.startedAt || null,
    endedAt,
    winnerAccountId: match.winnerAccountId || null,
    endReason: match.endReason || null,
    roundsPlayed: Number(match.round || 0),
    ruleset: match.ruleset,
    statusDefinitions: match.statusDefinitions || [],
    players: match.players || [],
    finalState: {
      status: match.status,
      phase: match.phase,
      round: Number(match.round || 0),
      winnerAccountId: match.winnerAccountId || null,
      endReason: match.endReason || null
    },
    events: match.events || [],
    archivedAt: new Date()
  };
}

async function linkClashArchiveToAccounts(models, archive, completionStatus) {
  if (
    completionStatus !== 'completed' ||
    !archive?._id ||
    typeof models.Account?.updateMany !== 'function'
  ) {
    return;
  }
  const accountIds = (archive.players || [])
    .filter((player) => !player.isAi)
    .map((player) => player.accountId)
    .filter(Boolean);
  if (!accountIds.length) return;
  await models.Account.updateMany(
    { _id: { $in: accountIds } },
    { $addToSet: { 'gameData.matchHistory': archive._id } }
  );
}

async function archiveClashGame({
  models,
  match,
  completionStatus = 'completed'
}) {
  if (typeof models.OlingClashArchive?.findOneAndUpdate !== 'function') {
    throw new Error('Oling Clash archiving is unavailable.');
  }
  const snapshot = createClashArchiveSnapshot(match, completionStatus);
  const archive = await models.OlingClashArchive.findOneAndUpdate(
    { gameId: snapshot.gameId },
    { $setOnInsert: snapshot },
    {
      new: true,
      runValidators: true,
      setDefaultsOnInsert: true,
      upsert: true
    }
  );
  await linkClashArchiveToAccounts(models, archive, completionStatus);
  return archive;
}

function resetClashMatchForRematch(match) {
  const previousGameId = match.gameId;
  match.gameId = createOlingClashGameId();
  match.status = 'waiting';
  match.phase = 'waiting';
  match.phaseEndsAt = null;
  match.round = 0;
  match.startedAt = null;
  match.endedAt = null;
  match.winnerAccountId = null;
  match.endReason = null;
  match.events = [];
  match.stateRevision = 0;
  match.derivedStateVersion = 1;
  match.latestRoundResult = null;
  match.players.forEach((player) => {
    player.ready = Boolean(player.isAi);
    player.gameLoaded = false;
    player.rematchAccepted = Boolean(player.isAi);
    player.selection = null;
    player.selectionDraft = null;
    player.activeTeamSlot = 0;
    resetTagState(player, match);
    player.statuses = [];
    player.lastMoves = [];
    player.team.forEach((oling) => {
      oling.heartUnits = oling.maxHeartUnits;
      oling.overgrowthUnits = 0;
      oling.bloodUnits = 0;
      oling.pendingReclaimUnits = 0;
      oling.shieldCount = 0;
      oling.defeated = false;
      oling.abilityProgress = [];
      oling.removedPositiveStatuses = [];
      oling.statuses = [];
    });
  });
  return previousGameId;
}

async function archiveAndResetClash({ models, match, completionStatus }) {
  const archive = await archiveClashGame({ models, match, completionStatus });
  const previousGameId = resetClashMatchForRematch(match);
  recordClashEvent(match, 'created', {
    payload: {
      previousGameId,
      previousArchiveId: String(archive._id)
    }
  });
  await match.save();
  return archive;
}

module.exports = {
  archiveAndResetClash,
  archiveClashGame,
  createClashArchiveSnapshot,
  linkClashArchiveToAccounts,
  resetClashMatchForRematch
};
