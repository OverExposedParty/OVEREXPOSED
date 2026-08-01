const {
  unlockResolvedAchievement
} = require('../../../services/achievements/unlocking');

function createPartyAchievementTools(context) {
  const { Achievement, getPublishedAchievements } = context;

  function getPathValue(value, path) {
    return String(path || '')
      .split('.')
      .filter(Boolean)
      .reduce((current, key) => current?.[key], value);
  }

  const PARTY_ACHIEVEMENT_STAT_PATHS = {
    sherlock: 'stats.correctImposterVotes',
    'been-there': 'stats.haveVotes',
    'innocent-until-proven-otherwise': 'stats.haveNotVotes',
    relatable: 'stats.majorityVotes',
    'too-honest': 'stats.currentHaveStreak',
    'spill-it': 'stats.revealsTriggered',
    'secret-keeper': 'stats.revealsSurvived',
    'why-me': 'stats.timesSelectedByOthers',
    'on-their-mind': 'stats.timesSelectedByOthers',
    'living-rent-free': 'stats.timesSelectedByOthers',
    'usual-suspect': 'stats.timesSelectedByOthers',
    'public-enemy': 'stats.timesSelectedByOthers',
    'fine-i-ll-do-it-myself': 'stats.promptHeists',
    'tiny-hesitation': 'stats.truthsSkipped',
    'cold-feet': 'stats.truthsSkipped',
    'hard-pass': 'stats.truthsSkipped',
    'not-today': 'stats.truthsSkipped',
    'professional-dodger': 'stats.truthsSkipped',
    contrarian: 'stats.minorityPicks',
    'lucky-guess': 'stats.majorityPicks',
    'majority-rules': 'stats.majorityPicks',
    'crowd-reader': 'stats.majorityPicks',
    'room-whisperer': 'stats.majorityPicks'
  };

  async function unlockEligiblePartyAchievements(account, gameStats, event) {
    if (!Achievement || !account || !gameStats) return;

    const achievements = await getPublishedAchievements(Achievement, {
      gamemode: event.gameMode,
      requirementType: { $in: ['stat_threshold', 'per_game_stat_threshold'] }
    });
    const unlocked = new Set(
      (account.gameData?.achievements || []).map((entry) => entry.key)
    );

    for (const achievement of achievements) {
      if (unlocked.has(achievement.key)) continue;
      const prefix = `gameData.perGameStats.${event.gameMode}.`;
      const configuredPath = String(achievement.statPath || '');
      const statPath = configuredPath.startsWith(prefix)
        ? configuredPath.slice(prefix.length)
        : PARTY_ACHIEVEMENT_STAT_PATHS[achievement.key];
      if (!statPath) continue;
      const value = Number(getPathValue(gameStats, statPath));
      if (!Number.isFinite(value) || value < achievement.requirementValue)
        continue;

      const result = await unlockResolvedAchievement({
        account,
        achievement,
        source: 'party-game',
        gamemode: event.gameMode,
        partyId: event.partyId,
        progressAtUnlock: value,
        save: false
      });
      if (result) unlocked.add(achievement.key);
    }
  }

  return {
    getPathValue,
    PARTY_ACHIEVEMENT_STAT_PATHS,
    unlockEligiblePartyAchievements
  };
}

module.exports = {
  createPartyAchievementTools
};
