const ACCOUNT_XP_RULES = Object.freeze({
  baseXpPerLevel: 500,
  xpIncreasePerLevel: 100
});

function toNonNegativeInteger(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || numericValue <= 0) return 0;
  return Math.min(Number.MAX_SAFE_INTEGER, Math.floor(numericValue));
}

function toAccountLevel(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || numericValue < 1) return 1;
  return Math.min(Number.MAX_SAFE_INTEGER, Math.floor(numericValue));
}

function xpRequiredForNextLevel(level) {
  const currentLevel = toAccountLevel(level);
  return (
    ACCOUNT_XP_RULES.baseXpPerLevel +
    (currentLevel - 1) * ACCOUNT_XP_RULES.xpIncreasePerLevel
  );
}

function xpAtStartOfLevel(level) {
  const currentLevel = toAccountLevel(level);
  if (currentLevel <= 1) return 0;

  return (
    (currentLevel - 1) * ACCOUNT_XP_RULES.baseXpPerLevel +
    (ACCOUNT_XP_RULES.xpIncreasePerLevel *
      (currentLevel - 2) *
      (currentLevel - 1)) /
      2
  );
}

function getLevelFromLifetimeXp(lifetimeXp) {
  const safeLifetimeXp = toNonNegativeInteger(lifetimeXp);
  let lowerLevel = 1;
  let upperLevel = 2;

  while (xpAtStartOfLevel(upperLevel) <= safeLifetimeXp) {
    lowerLevel = upperLevel;
    upperLevel *= 2;
  }

  while (lowerLevel + 1 < upperLevel) {
    const middleLevel = Math.floor((lowerLevel + upperLevel) / 2);
    if (xpAtStartOfLevel(middleLevel) <= safeLifetimeXp) {
      lowerLevel = middleLevel;
    } else {
      upperLevel = middleLevel;
    }
  }

  return lowerLevel;
}

function getAccountXpProgress(lifetimeXp) {
  const safeLifetimeXp = toNonNegativeInteger(lifetimeXp);
  const currentLevel = getLevelFromLifetimeXp(safeLifetimeXp);
  const levelStartXp = xpAtStartOfLevel(currentLevel);
  const currentLevelXp = safeLifetimeXp - levelStartXp;
  const nextLevelRequirement = xpRequiredForNextLevel(currentLevel);

  return {
    lifetimeXp: safeLifetimeXp,
    currentLevel,
    levelStartXp,
    currentLevelXp,
    xpRequiredForNextLevel: nextLevelRequirement,
    xpRemaining: Math.max(0, nextLevelRequirement - currentLevelXp),
    currentLevelProgress: Math.min(1, currentLevelXp / nextLevelRequirement)
  };
}

function applyAccountXp(account, amount = 0) {
  if (!account || typeof account !== 'object') {
    throw new TypeError('An account is required to apply XP.');
  }

  account.gameData ||= {};

  const before = getAccountXpProgress(account.gameData.xp);
  const requestedXp = toNonNegativeInteger(amount);
  const xpAfter = Math.min(
    Number.MAX_SAFE_INTEGER,
    before.lifetimeXp + requestedXp
  );
  const xpAdded = xpAfter - before.lifetimeXp;
  const after = getAccountXpProgress(xpAfter);

  account.gameData.xp = after.lifetimeXp;
  account.gameData.level = after.currentLevel;

  return {
    xpBefore: before.lifetimeXp,
    xpAdded,
    xpAfter: after.lifetimeXp,
    levelBefore: before.currentLevel,
    levelAfter: after.currentLevel,
    levelsGained: Math.max(0, after.currentLevel - before.currentLevel),
    levelledUp: after.currentLevel > before.currentLevel,
    currentLevelXp: after.currentLevelXp,
    xpRequiredForNextLevel: after.xpRequiredForNextLevel,
    xpRemaining: after.xpRemaining,
    currentLevelProgress: after.currentLevelProgress
  };
}

module.exports = {
  ACCOUNT_XP_RULES,
  applyAccountXp,
  getAccountXpProgress,
  getLevelFromLifetimeXp,
  xpAtStartOfLevel,
  xpRequiredForNextLevel
};
