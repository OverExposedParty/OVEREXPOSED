const { normalizeString } = require('./normalization');
const { unlockAchievementByKey } = require('./unlocking');
const { incrementAchievementStat } = require('./progress');

async function recordMostLikelyToResult({
  Achievement,
  account,
  result,
  partyId,
  save = true
} = {}) {
  if (!Achievement || !account || !result) return [];
  if (!['most-likely-to-round', 'most-likely-to-outcome'].includes(result.type)) {
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
  const accountByPlayerId = new Map(
    playerAccounts.map(({ accountId: id, playerId }) => [
      String(playerId),
      String(id)
    ])
  );
  const playerId = playerByAccountId.get(accountId);
  if (!playerId) return [];

  const votes = Array.isArray(result.votes) ? result.votes : [];
  const votesReceived = votes.filter(
    ({ vote }) => String(vote) === playerId
  );
  const ownVote = votes.find(({ playerId: voterId }) => String(voterId) === playerId);
  const winnerPlayerId = result.winnerPlayerId
    ? String(result.winnerPlayerId)
    : null;
  const unlocked = [];
  account.gameData ||= {};
  account.gameData.achievementStats ||= {};
  const stats = account.gameData.achievementStats;

  const unlock = async (key, progressAtUnlock = 1) => {
    const achievement = await unlockAchievementByKey({
      Achievement,
      account,
      key,
      source: 'most-likely-to',
      progressAtUnlock,
      save: false
    });
    if (achievement) unlocked.push(achievement);
  };

  const recordWinnerAchievements = async () => {
    if (!winnerPlayerId) return;

    if (
      winnerPlayerId === playerId &&
      stats.mostLikelyToWinnerAfterZeroPreviousEligible === true
    ) {
      await unlock('unexpected-winner');
    }

    if (String(ownVote?.vote || '') === winnerPlayerId) {
      const newlyUnlocked = await incrementAchievementStat({
        Achievement,
        account,
        statKey: 'tasteMaker',
        source: 'most-likely-to-winning-vote',
        save: false
      });
      unlocked.push(...newlyUnlocked);
    }

    if (winnerPlayerId === playerId && String(ownVote?.vote || '') === playerId) {
      await unlock('self-aware');
    }
  };

  if (result.type === 'most-likely-to-outcome') {
    await recordWinnerAchievements();
    stats.mostLikelyToWinnerAfterZeroPreviousEligible = false;
    account.markModified?.('gameData.achievementStats');
    if (save) await account.save();
    return unlocked;
  }

  const receivedCount = votesReceived.length;
  const voterCounts =
    stats.mostLikelyToVotesByVoter &&
    typeof stats.mostLikelyToVotesByVoter === 'object'
      ? stats.mostLikelyToVotesByVoter
      : {};
  votesReceived.forEach(({ playerId: voterId }) => {
    const voterKey =
      accountByPlayerId.get(String(voterId)) ||
      `${normalizeString(partyId, 'party')}:${String(voterId)}`;
    voterCounts[voterKey] = (Number(voterCounts[voterKey]) || 0) + 1;
  });
  stats.mostLikelyToVotesByVoter = voterCounts;
  const sameVoterMaximum = Math.max(0, ...Object.values(voterCounts).map(Number));
  if (sameVoterMaximum >= 5) await unlock('not-my-name-again', sameVoterMaximum);

  const currentNomineeStreak = Number(stats.serialNominee) || 0;
  const nextNomineeStreak = receivedCount > 0 ? currentNomineeStreak + 1 : 0;
  stats.serialNominee = nextNomineeStreak;
  if (nextNomineeStreak >= 10) await unlock('serial-nominee', nextNomineeStreak);

  const sessionKey = normalizeString(partyId, 'party');
  if (stats.mostLikelyToSessionId !== sessionKey) {
    stats.mostLikelyToSessionId = sessionKey;
    stats.mostLikelyToVotedPlayerIds = [];
  }
  const votedPlayerIds = new Set(
    Array.isArray(stats.mostLikelyToVotedPlayerIds)
      ? stats.mostLikelyToVotedPlayerIds.map(String)
      : []
  );
  if (ownVote?.vote) votedPlayerIds.add(String(ownVote.vote));
  stats.mostLikelyToVotedPlayerIds = [...votedPlayerIds];
  const activePlayerIds = playerAccounts.map(({ playerId: id }) => String(id));
  if (
    activePlayerIds.length > 0 &&
    activePlayerIds.every((id) => votedPlayerIds.has(id))
  ) {
    await unlock('everyone-gets-it', votedPlayerIds.size);
  }

  if (result.isTie === true) await unlock('split-decision');
  if (votes.length >= 3 && receivedCount === votes.length) {
    await unlock('main-character', receivedCount);
    await unlock('unanimous-mvp', receivedCount);
  }
  if (
    String(ownVote?.vote || '') === playerId &&
    receivedCount === 1
  ) {
    await unlock('well-this-is-awkward');
  }

  stats.mostLikelyToWinnerAfterZeroPreviousEligible =
    stats.mostLikelyToHadPreviousRound === true &&
    Number(stats.mostLikelyToPreviousVotesReceived) === 0;
  await recordWinnerAchievements();
  if (winnerPlayerId) {
    stats.mostLikelyToWinnerAfterZeroPreviousEligible = false;
  }
  stats.mostLikelyToPreviousVotesReceived = receivedCount;
  stats.mostLikelyToHadPreviousRound = true;
  account.markModified?.('gameData.achievementStats');

  if (save) await account.save();
  return unlocked;
}

module.exports = { recordMostLikelyToResult };
