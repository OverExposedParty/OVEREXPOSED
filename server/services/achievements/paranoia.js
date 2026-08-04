const { normalizeString } = require('./normalization');
const { unlockAchievementByKey } = require('./unlocking');
const { incrementAchievementStat } = require('./progress');

async function recordParanoiaResult({
  Achievement,
  account,
  result,
  partyId,
  save = true
} = {}) {
  if (!Achievement || !account || !result) return [];
  if (
    ![
      'paranoia-target-selected',
      'paranoia-punishment-denied',
      'paranoia-game-complete'
    ].includes(result.type)
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
  const accountByPlayerId = new Map(
    playerAccounts.map(({ accountId: id, playerId }) => [
      String(playerId),
      String(id)
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
      source: 'paranoia',
      progressAtUnlock,
      save: false
    });
    if (achievement) unlocked.push(achievement);
  };

  if (result.type === 'paranoia-punishment-denied') {
    if (String(result.targetPlayerId || '') === playerId) {
      await unlock('pinocchio-s-doppelganger');
    }
    if (save) await account.save();
    return unlocked;
  }

  if (result.type === 'paranoia-game-complete') {
    const pickedCounts = result.pickedCountsByPlayerId || {};
    const ownPickedCount = Number(pickedCounts[playerId]) || 0;
    const maxPickedCount = Math.max(
      0,
      ...Object.values(pickedCounts).map((value) => Number(value) || 0)
    );
    const scoreByPlayerId = new Map(
      playerAccounts.map(({ playerId: id, score }) => [
        String(id),
        Number(score) || 0
      ])
    );
    const maxScore = Math.max(0, ...scoreByPlayerId.values());
    const ownScore = Number(scoreByPlayerId.get(playerId)) || 0;

    if (ownPickedCount > 0 && ownPickedCount === maxPickedCount) {
      const newlyUnlocked = await incrementAchievementStat({
        Achievement,
        account,
        statKey: 'theUsualSuspect',
        source: 'paranoia-most-picked-game',
        save: false
      });
      unlocked.push(...newlyUnlocked);
      if (ownScore === maxScore) await unlock('thick-skin', ownScore);
    }

    if (save) await account.save();
    return unlocked;
  }

  const selectorPlayerId = String(result.selectorPlayerId || '');
  const targetPlayerId = String(result.targetPlayerId || '');
  const isSelector = selectorPlayerId === playerId;
  const isTarget = targetPlayerId === playerId;
  const sessionKey = normalizeString(partyId, 'party');

  if (stats.paranoiaSessionId !== sessionKey) {
    stats.paranoiaSessionId = sessionKey;
    stats.paranoiaTargetPickCounts = {};
  }
  stats.paranoiaTargetPickCounts =
    stats.paranoiaTargetPickCounts &&
    typeof stats.paranoiaTargetPickCounts === 'object'
      ? stats.paranoiaTargetPickCounts
      : {};

  if (isSelector && targetPlayerId) {
    const previousTargetAccountId = stats.paranoiaLastPickedByAccountId || null;
    if (previousTargetAccountId === accountByPlayerId.get(targetPlayerId)) {
      await unlock('revenge-pick');
    }

    stats.paranoiaTargetPickCounts[targetPlayerId] =
      (Number(stats.paranoiaTargetPickCounts[targetPlayerId]) || 0) + 1;
    const mostPicksInSession = Math.max(
      0,
      ...Object.values(stats.paranoiaTargetPickCounts).map(Number)
    );
    if (mostPicksInSession >= 10) {
      const newlyUnlocked = await incrementAchievementStat({
        Achievement,
        account,
        statKey: 'vendetta',
        amount: Math.max(0, mostPicksInSession - (Number(stats.vendetta) || 0)),
        source: 'paranoia-repeat-target',
        save: false
      });
      unlocked.push(...newlyUnlocked);
    }
  }

  if (isTarget) {
    const selectorAccountId = accountByPlayerId.get(selectorPlayerId) || null;
    if (stats.paranoiaLastSelectorAccountId === selectorAccountId) {
      await unlock('not-you-again');
    }
    stats.publicEnemyNumberOne = (Number(stats.publicEnemyNumberOne) || 0) + 1;
    if (Number(stats.publicEnemyNumberOne) >= 5) {
      await unlock('public-enemy-number-one', stats.publicEnemyNumberOne);
    }
    stats.paranoiaLastSelectorAccountId = selectorAccountId;
  } else {
    stats.publicEnemyNumberOne = 0;
  }

  if (isSelector) {
    stats.paranoiaLastPickedByAccountId =
      accountByPlayerId.get(targetPlayerId) || null;
  }

  account.markModified?.('gameData.achievementStats');
  if (save) await account.save();
  return unlocked;
}

module.exports = { recordParanoiaResult };
