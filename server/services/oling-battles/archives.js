const {
  createOlingBattleGameId
} = require('../../../models/olings/oling-battle-game-id');
const {
  DEFAULT_MARKER_DIRECTION,
  DEFAULT_MARKER_POSITION
} = require('./constants');
const { recordBattleEvent } = require('./events');

function toPlainObject(value) {
  if (!value) return {};
  return value.toObject ? value.toObject() : value;
}

function createBattleArchiveSnapshot(
  matchDocument,
  completionStatus = 'completed'
) {
  const match = toPlainObject(matchDocument);
  const endedAt = match.state?.endedAt || new Date();

  return {
    gameId: match.gameId,
    sourceMatchId: match._id,
    matchCode: match.matchCode,
    completionStatus,
    startedAt: match.state?.startedAt || null,
    endedAt,
    winnerAccountId: match.state?.winnerAccountId || null,
    endReason: match.state?.endReason || null,
    config: match.config || {},
    players: Array.isArray(match.players) ? match.players : [],
    finalState: match.state || {},
    events: Array.isArray(match.events) ? match.events : [],
    archivedAt: new Date()
  };
}

async function linkArchiveToAccounts(models, archive, completionStatus) {
  if (
    completionStatus !== 'completed' ||
    !archive?._id ||
    typeof models.Account?.updateMany !== 'function'
  ) {
    return;
  }

  const accountIds = (archive.players || [])
    .filter((player) => !player.isAi && player.accountId)
    .map((player) => player.accountId);
  if (accountIds.length === 0) return;

  await models.Account.updateMany(
    { _id: { $in: accountIds } },
    { $addToSet: { 'gameData.matchHistory': archive._id } }
  );
}

async function archiveBattleGame({
  models,
  match,
  completionStatus = 'completed'
}) {
  const { OlingBattleArchive } = models;
  if (typeof OlingBattleArchive?.findOneAndUpdate !== 'function') {
    throw new Error('Oling Battle archiving is unavailable.');
  }

  const snapshot = createBattleArchiveSnapshot(match, completionStatus);
  const archive = await OlingBattleArchive.findOneAndUpdate(
    { gameId: snapshot.gameId },
    { $setOnInsert: snapshot },
    {
      new: true,
      runValidators: true,
      setDefaultsOnInsert: true,
      upsert: true
    }
  );
  await linkArchiveToAccounts(models, archive, completionStatus);
  return archive;
}

function resetBattleMatchForRematch(match) {
  const previousGameId = match.gameId;
  match.gameId = createOlingBattleGameId();
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
  match.state.marker = {
    direction: DEFAULT_MARKER_DIRECTION,
    isFullDisruption: false,
    position: DEFAULT_MARKER_POSITION,
    updatedAt: new Date()
  };
  match.events = [];
  return previousGameId;
}

async function archiveAndResetBattle({ models, match, completionStatus }) {
  const archive = await archiveBattleGame({
    models,
    match,
    completionStatus
  });
  const previousGameId = resetBattleMatchForRematch(match);
  await recordBattleEvent(models, match, 'created', null, {
    previousGameId,
    previousArchiveId: String(archive._id)
  });
  await match.save();
  return archive;
}

module.exports = {
  archiveAndResetBattle,
  archiveBattleGame,
  createBattleArchiveSnapshot,
  linkArchiveToAccounts,
  resetBattleMatchForRematch
};
