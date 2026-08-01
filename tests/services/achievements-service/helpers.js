const test = require('node:test');
const assert = require('node:assert/strict');

const {
  incrementAchievementStat,
  recordAchievementCollectionItems,
  recordPackOwnershipAchievements,
  recordAchievementPlayDate,
  recordMostLikelyToResult,
  recordNeverHaveIEverResult,
  recordParanoiaResult,
  recordTruthOrDarePromptResult,
  unlockAchievementByKey
} = require('../../../server/services/achievements');

function createAchievementModel(achievement) {
  return {
    findOne(query) {
      return {
        async lean() {
          if (!achievement) return null;
          if (
            query.key !== achievement.key ||
            query.enabled !== achievement.enabled ||
            query.status !== achievement.status
          ) {
            return null;
          }
          return achievement;
        }
      };
    }
  };
}

function createThresholdAchievementModel(achievements) {
  return {
    find(query) {
      const matches = achievements.filter(
        (achievement) =>
          achievement.enabled === query.enabled &&
          achievement.status === query.status &&
          query.requirementType.$in.includes(achievement.requirementType) &&
          achievement.statKey === query.statKey &&
          achievement.requirementValue <= query.requirementValue.$lte
      );
      return {
        sort() {
          return {
            async lean() {
              return matches;
            }
          };
        }
      };
    },
    findOne(query) {
      return {
        async lean() {
          return (
            achievements.find(
              (achievement) =>
                achievement.key === query.key &&
                achievement.enabled === query.enabled &&
                achievement.status === query.status
            ) || null
          );
        }
      };
    }
  };
}

function createAccount(gameData = {}) {
  return {
    gameData,
    saveCalls: 0,
    markedPaths: [],
    markModified(path) {
      this.markedPaths.push(path);
    },
    async save() {
      this.saveCalls += 1;
    }
  };
}

module.exports = {
  test,
  assert,
  incrementAchievementStat,
  recordAchievementCollectionItems,
  recordPackOwnershipAchievements,
  recordAchievementPlayDate,
  recordMostLikelyToResult,
  recordNeverHaveIEverResult,
  recordParanoiaResult,
  recordTruthOrDarePromptResult,
  unlockAchievementByKey,
  createAchievementModel,
  createThresholdAchievementModel,
  createAccount
};
