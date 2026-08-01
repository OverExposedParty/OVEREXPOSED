const { unlockEligibleStatAchievements } = require('./unlocking');

async function recordTruthOrDarePromptResult({
  Achievement,
  account,
  result,
  isNsfw = false,
  save = true
} = {}) {
  if (!Achievement || !account) return [];
  if (!['truth', 'dare', 'skip'].includes(result)) return [];

  account.gameData ||= {};
  account.gameData.achievementStats ||= {};
  const stats = account.gameData.achievementStats;
  const changedStatKeys = new Set();
  const incrementStat = (statKey, amount = 1) => {
    stats[statKey] = (Number(stats[statKey]) || 0) + amount;
    changedStatKeys.add(statKey);
  };
  let unlockStatKeys = [];

  if (result === 'skip') {
    incrementStat('promptsSkipped');
    incrementStat('fineILlDoItMyself');
    stats.truthOrDareNoSkipStreak = 0;
    stats.truthOrDareTruthStreak = 0;
    stats.truthOrDareDareStreak = 0;
    unlockStatKeys = ['promptsSkipped', 'fineILlDoItMyself'];
  } else {
    stats.fineILlDoItMyself = 0;
    incrementStat('truthOrDareNoSkipStreak');
    if (result === 'truth') {
      incrementStat('truthsCompleted');
      incrementStat('truthOrDareTruthStreak');
      stats.truthOrDareDareStreak = 0;
      unlockStatKeys = [
        'truthsCompleted',
        'truthOrDareTruthStreak',
        'truthOrDareNoSkipStreak'
      ];
    } else {
      incrementStat('daresCompleted');
      incrementStat('truthOrDareDareStreak');
      stats.truthOrDareTruthStreak = 0;
      unlockStatKeys = [
        'daresCompleted',
        'truthOrDareDareStreak',
        'truthOrDareNoSkipStreak'
      ];
      if (isNsfw) {
        incrementStat('noFear');
        unlockStatKeys.push('noFear');
      }
    }
  }
  account.markModified?.('gameData.achievementStats');

  const unlocked = [];
  for (const statKey of unlockStatKeys.filter((key) => changedStatKeys.has(key))) {
    const newlyUnlocked = await unlockEligibleStatAchievements({
      Achievement,
      account,
      statKey,
      value: Number(stats[statKey]) || 0,
      source: 'truth-or-dare-prompt'
    });
    unlocked.push(...newlyUnlocked);
  }

  if (save) await account.save();
  return unlocked;
}

module.exports = { recordTruthOrDarePromptResult };
