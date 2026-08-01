const { normalizeString } = require('./normalization');
const {
  shouldTrackStandardAccountProgress
} = require('../../../models/content/standard-account-content');
const {
  unlockAchievementByKey,
  unlockEligibleStatAchievements
} = require('./unlocking');

async function incrementAchievementStat({
  Achievement,
  account,
  statKey,
  amount = 1,
  source = 'stat-threshold',
  save = true
} = {}) {
  const normalizedStatKey = normalizeString(statKey);
  const increment = Number(amount);
  if (
    !Achievement ||
    !account ||
    !normalizedStatKey ||
    !Number.isFinite(increment) ||
    increment === 0
  ) {
    return [];
  }

  account.gameData ||= {};
  account.gameData.achievementStats ||= {};
  const currentValue =
    Number(account.gameData.achievementStats[normalizedStatKey]) || 0;
  const nextValue = Math.max(0, currentValue + increment);
  account.gameData.achievementStats[normalizedStatKey] = nextValue;
  account.markModified?.('gameData.achievementStats');

  const unlocked = await unlockEligibleStatAchievements({
    Achievement,
    account,
    statKey: normalizedStatKey,
    value: nextValue,
    source
  });

  if (save) await account.save();
  return unlocked;
}

async function recordAchievementCollectionItems({
  Achievement,
  account,
  statKey,
  items = [],
  source = 'collection',
  save = true
} = {}) {
  const normalizedStatKey = normalizeString(statKey);
  if (!Achievement || !account || !normalizedStatKey) return [];

  account.gameData ||= {};
  account.gameData.achievementStats ||= {};
  const collectionKey = `${normalizedStatKey}Items`;
  const existingItems = Array.isArray(
    account.gameData.achievementStats[collectionKey]
  )
    ? account.gameData.achievementStats[collectionKey]
    : [];
  const uniqueItems = [
    ...new Set(
      [...existingItems, ...(Array.isArray(items) ? items : [])]
        .map((item) => normalizeString(item).toLowerCase())
        .filter(Boolean)
    )
  ];
  const existingValue =
    Number(account.gameData.achievementStats[normalizedStatKey]) || 0;
  const nextValue = Math.max(existingValue, uniqueItems.length);

  account.gameData.achievementStats[collectionKey] = uniqueItems;
  account.gameData.achievementStats[normalizedStatKey] = nextValue;
  account.markModified?.('gameData.achievementStats');

  const unlocked = await unlockEligibleStatAchievements({
    Achievement,
    account,
    statKey: normalizedStatKey,
    value: nextValue,
    source
  });

  if (save) await account.save();
  return unlocked;
}

function getOwnedPackAchievementKeys(account) {
  const unlocks = Array.isArray(account?.gameData?.inGamePurchasesAndUnlocks)
    ? account.gameData.inGamePurchasesAndUnlocks
    : [];

  return [
    ...new Set(
      unlocks
        .filter(
          (unlock) => normalizeString(unlock?.type).toLowerCase() === 'pack'
        )
        .map((unlock) => normalizeString(unlock?.key).toLowerCase())
        .filter(Boolean)
    )
  ];
}

async function recordPackOwnershipAchievements({
  Achievement,
  account,
  source = 'shop-pack-owned',
  save = true
} = {}) {
  if (
    !Achievement ||
    !account ||
    !shouldTrackStandardAccountProgress({ feature: 'shop' })
  ) {
    return [];
  }

  const packKeys = getOwnedPackAchievementKeys(account);
  if (!packKeys.length) return [];

  const unlocked = await recordAchievementCollectionItems({
    Achievement,
    account,
    statKey: 'packsOwned',
    items: packKeys,
    source,
    save: false
  });
  const firstPackUnlock = await unlockAchievementByKey({
    Achievement,
    account,
    key: 'pack-hunter',
    source,
    progressAtUnlock: packKeys.length,
    save: false
  });

  if (firstPackUnlock) unlocked.push(firstPackUnlock);
  if (save) await account.save();
  return unlocked;
}

async function recordAchievementPlayDate({
  Achievement,
  account,
  playedAt = new Date(),
  source = 'play-streak',
  save = true
} = {}) {
  if (!Achievement || !account) return [];

  const playedDate = new Date(playedAt);
  if (Number.isNaN(playedDate.getTime())) return [];

  account.gameData ||= {};
  account.gameData.achievementStats ||= {};
  const stats = account.gameData.achievementStats;
  const dateKey = playedDate.toISOString().slice(0, 10);
  const previousDateKey = normalizeString(stats.playStreakLastDate);
  const currentStreak = Math.max(0, Number(stats.playStreak) || 0);
  let nextStreak = currentStreak;

  if (dateKey !== previousDateKey) {
    const previousDay = Date.parse(`${previousDateKey}T00:00:00.000Z`);
    const currentDay = Date.parse(`${dateKey}T00:00:00.000Z`);
    const dayDifference = Number.isFinite(previousDay)
      ? Math.round((currentDay - previousDay) / (1000 * 60 * 60 * 24))
      : null;

    nextStreak = dayDifference === 1 ? currentStreak + 1 : 1;
    stats.playStreak = nextStreak;
    stats.playStreakLastDate = dateKey;
    account.markModified?.('gameData.achievementStats');
  }

  const unlocked = await unlockEligibleStatAchievements({
    Achievement,
    account,
    statKey: 'playStreak',
    value: nextStreak,
    source
  });

  if (save) await account.save();
  return unlocked;
}

module.exports = {
  incrementAchievementStat,
  recordAchievementCollectionItems,
  recordPackOwnershipAchievements,
  recordAchievementPlayDate
};
