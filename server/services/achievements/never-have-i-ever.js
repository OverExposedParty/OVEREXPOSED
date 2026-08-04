const {
  unlockAchievementByKey,
  unlockEligibleStatAchievements
} = require('./unlocking');

async function recordNeverHaveIEverResult({
  Achievement,
  account,
  result,
  save = true
} = {}) {
  if (!Achievement || !account || !result) return [];
  if (
    !['never-have-i-ever-round', 'never-have-i-ever-game-complete'].includes(
      result.type
    )
  ) {
    return [];
  }

  const accountId = String(account._id || '');
  const playerAccounts = Array.isArray(result.playerAccounts)
    ? result.playerAccounts
    : [];
  const playerByAccountId = new Map(
    playerAccounts.map(({ accountId: id, playerId }) => [
      String(id),
      String(playerId)
    ])
  );
  const playerId = playerByAccountId.get(accountId);
  if (!playerId) return [];

  account.gameData ||= {};
  account.gameData.achievementStats ||= {};
  const stats = account.gameData.achievementStats;
  const unlocked = [];
  const unlock = async (key, progressAtUnlock = 1) => {
    const achievement = await unlockAchievementByKey({
      Achievement,
      account,
      key,
      source: 'never-have-i-ever',
      progressAtUnlock,
      save: false
    });
    if (achievement) unlocked.push(achievement);
  };

  if (result.type === 'never-have-i-ever-game-complete') {
    if (
      Number(result.playerCount) >= 10 &&
      stats.neverHaveIEverVotedHaveThisSession !== true
    ) {
      await unlock('are-you-real');
      await unlock('saint');
    }
    if (save) await account.save();
    return unlocked;
  }

  const votes = Array.isArray(result.votes) ? result.votes : [];
  const ownVote = votes.find(
    ({ playerId: voterId }) => String(voterId) === playerId
  );
  const voteCount = votes.length;
  const haveCount = Number(result.haveCount) || 0;
  const haveNotCount = Number(result.haveNotCount) || 0;
  const majorityVote =
    haveCount === haveNotCount ? null : haveCount > haveNotCount;
  const unlockedStatKeys = [];

  if (ownVote?.vote === true) {
    stats.neverHaveIEverVotedHaveThisSession = true;
    stats.beenThere = (Number(stats.beenThere) || 0) + 1;
    stats.tooHonest = (Number(stats.tooHonest) || 0) + 1;
    unlockedStatKeys.push('beenThere', 'tooHonest');
  } else if (ownVote?.vote === false) {
    stats.innocentUntilProvenOtherwise =
      (Number(stats.innocentUntilProvenOtherwise) || 0) + 1;
    stats.tooHonest = 0;
    unlockedStatKeys.push('innocentUntilProvenOtherwise');
  }

  if (majorityVote !== null && ownVote?.vote === majorityVote) {
    stats.relatable = (Number(stats.relatable) || 0) + 1;
    unlockedStatKeys.push('relatable');
  }

  if (voteCount >= 4 && haveCount === voteCount) {
    await unlock('group-confession', voteCount);
  }
  if (voteCount >= 4 && haveNotCount === voteCount) {
    await unlock('not-a-single-soul', voteCount);
  }
  if (haveNotCount === 1 && ownVote?.vote === false) {
    await unlock('pure-as-snow');
  }
  for (const statKey of unlockedStatKeys) {
    const newlyUnlocked = await unlockEligibleStatAchievements({
      Achievement,
      account,
      statKey,
      value: Number(stats[statKey]) || 0,
      source: 'never-have-i-ever'
    });
    unlocked.push(...newlyUnlocked);
  }

  account.markModified?.('gameData.achievementStats');
  if (save) await account.save();
  return unlocked;
}

module.exports = { recordNeverHaveIEverResult };
