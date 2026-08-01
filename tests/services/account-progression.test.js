const test = require('node:test');
const assert = require('node:assert/strict');

const {
  ACCOUNT_XP_RULES,
  applyAccountXp,
  getAccountXpProgress,
  getLevelFromLifetimeXp,
  xpAtStartOfLevel,
  xpRequiredForNextLevel
} = require('../../server/services/account-progression');

test('account XP rules preserve the agreed level curve', () => {
  assert.deepEqual(ACCOUNT_XP_RULES, {
    baseXpPerLevel: 500,
    xpIncreasePerLevel: 100
  });
  assert.equal(xpAtStartOfLevel(1), 0);
  assert.equal(xpAtStartOfLevel(2), 500);
  assert.equal(xpAtStartOfLevel(3), 1100);
  assert.equal(xpAtStartOfLevel(5), 2600);
  assert.equal(xpAtStartOfLevel(10), 8100);
  assert.equal(xpAtStartOfLevel(100), 534600);
  assert.equal(xpRequiredForNextLevel(1), 500);
  assert.equal(xpRequiredForNextLevel(5), 900);
  assert.equal(xpRequiredForNextLevel(100), 10400);
});

test('account level boundaries are derived from lifetime XP', () => {
  assert.equal(getLevelFromLifetimeXp(0), 1);
  assert.equal(getLevelFromLifetimeXp(499), 1);
  assert.equal(getLevelFromLifetimeXp(500), 2);
  assert.equal(getLevelFromLifetimeXp(1099), 2);
  assert.equal(getLevelFromLifetimeXp(1100), 3);
  assert.equal(getLevelFromLifetimeXp(534600), 100);
});

test('account XP progress reports progress within the current level', () => {
  assert.deepEqual(getAccountXpProgress(500), {
    lifetimeXp: 500,
    currentLevel: 2,
    levelStartXp: 500,
    currentLevelXp: 0,
    xpRequiredForNextLevel: 600,
    xpRemaining: 600,
    currentLevelProgress: 0
  });

  assert.deepEqual(getAccountXpProgress(800), {
    lifetimeXp: 800,
    currentLevel: 2,
    levelStartXp: 500,
    currentLevelXp: 300,
    xpRequiredForNextLevel: 600,
    xpRemaining: 300,
    currentLevelProgress: 0.5
  });
});

test('applying account XP supports multiple level gains in one grant', () => {
  const account = {
    gameData: {
      level: 99,
      xp: 450
    }
  };

  const result = applyAccountXp(account, 700);

  assert.deepEqual(result, {
    xpBefore: 450,
    xpAdded: 700,
    xpAfter: 1150,
    levelBefore: 1,
    levelAfter: 3,
    levelsGained: 2,
    levelledUp: true,
    currentLevelXp: 50,
    xpRequiredForNextLevel: 700,
    xpRemaining: 650,
    currentLevelProgress: 1 / 14
  });
  assert.equal(account.gameData.xp, 1150);
  assert.equal(account.gameData.level, 3);
});

test('applying zero XP repairs a stale stored level from lifetime XP', () => {
  const account = { gameData: { level: 1, xp: 2600 } };

  const result = applyAccountXp(account, 0);

  assert.equal(result.xpAdded, 0);
  assert.equal(result.levelBefore, 5);
  assert.equal(result.levelAfter, 5);
  assert.equal(result.levelledUp, false);
  assert.equal(account.gameData.level, 5);
});

test('account XP inputs are safely normalised', () => {
  assert.deepEqual(getAccountXpProgress(-100), {
    lifetimeXp: 0,
    currentLevel: 1,
    levelStartXp: 0,
    currentLevelXp: 0,
    xpRequiredForNextLevel: 500,
    xpRemaining: 500,
    currentLevelProgress: 0
  });

  const account = { gameData: { xp: 10 } };
  const result = applyAccountXp(account, -25);
  assert.equal(result.xpAdded, 0);
  assert.equal(account.gameData.xp, 10);
  assert.equal(account.gameData.level, 1);
});
