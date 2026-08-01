const {
  STACKABLE_REWARD_TYPES
} = require('../../../models/content/achievement-reward-contract');
const { applyAccountXp } = require('../account-progression');
const {
  getLegacyOlingInventory,
  mergeQuantityInventoryItems
} = require('../opals/inventory');
const { normalizeRewards, normalizeString } = require('./normalization');

const UNIQUE_UNLOCK_REWARD_TYPES = new Set([
  'badge',
  'cosmetic',
  'pack',
  'oe',
  'oling_headwear',
  'oling_furniture'
]);
const OLING_INVENTORY_REWARD_LISTS = {
  oling_egg: 'eggs',
  oling_consumable: 'consumables',
  oling_furniture: 'furniture'
};

function markModifiedPaths(account, modifiedPaths) {
  modifiedPaths.forEach((path) => account.markModified?.(path));
}

function ensureOpalWallet(account) {
  account.gameData ||= {};
  account.gameData.opals ||= {};
  account.gameData.opals.balance = Math.max(
    0,
    Math.floor(Number(account.gameData.opals.balance) || 0)
  );
  account.gameData.opals.lifetimeEarned = Math.max(
    0,
    Math.floor(Number(account.gameData.opals.lifetimeEarned) || 0)
  );
  account.gameData.opals.lifetimeSpent = Math.max(
    0,
    Math.floor(Number(account.gameData.opals.lifetimeSpent) || 0)
  );
  account.gameData.opalTransactions ||= [];
}

function getAchievementRewardMetadata(achievement, reward, now) {
  return {
    ...(reward.metadata || {}),
    rewardSource: 'achievement',
    achievementKey: achievement.key,
    achievementName: achievement.name || null,
    grantedAt: now
  };
}

function grantAchievementOpals({
  account,
  achievement,
  reward,
  modifiedPaths,
  now
}) {
  ensureOpalWallet(account);

  const amount = reward.amount;
  const balanceBefore = account.gameData.opals.balance;
  const balanceAfter = balanceBefore + amount;
  const lifetimeEarnedAfter = account.gameData.opals.lifetimeEarned + amount;
  if (
    !Number.isSafeInteger(balanceAfter) ||
    !Number.isSafeInteger(lifetimeEarnedAfter)
  ) {
    throw new RangeError('Achievement Opal reward exceeds the wallet limit.');
  }

  account.gameData.opals.balance = balanceAfter;
  account.gameData.opals.lifetimeEarned = lifetimeEarnedAfter;
  const transaction = {
    type: 'earn',
    amount,
    reason: `Achievement unlocked: ${achievement.name || achievement.key}`,
    sourceType: 'achievement',
    sourceId: achievement.key,
    balanceAfter,
    metadata: {
      achievementKey: achievement.key,
      achievementName: achievement.name || null,
      rarity: achievement.rarity || null
    },
    createdAt: now
  };
  account.gameData.opalTransactions.push(transaction);
  modifiedPaths.add('gameData.opals');
  modifiedPaths.add('gameData.opalTransactions');

  return { type: reward.type, amount, balanceAfter, granted: true };
}

function grantAchievementXp({ account, reward, modifiedPaths }) {
  const progression = applyAccountXp(account, reward.amount);
  modifiedPaths.add('gameData.xp');
  modifiedPaths.add('gameData.level');

  return {
    type: reward.type,
    amount: progression.xpAdded,
    requestedAmount: reward.amount,
    progression,
    granted: progression.xpAdded === reward.amount
  };
}

function grantAchievementUnlock({
  account,
  achievement,
  reward,
  gamemode,
  partyId,
  modifiedPaths,
  now
}) {
  account.gameData ||= {};
  account.gameData.inGamePurchasesAndUnlocks ||= [];
  const alreadyOwned = account.gameData.inGamePurchasesAndUnlocks.some(
    (unlock) =>
      unlock?.type === reward.type &&
      normalizeString(unlock?.key) === reward.key
  );

  if (alreadyOwned) {
    return {
      type: reward.type,
      key: reward.key,
      granted: true,
      skipped: true,
      reason: 'already_owned'
    };
  }

  account.gameData.inGamePurchasesAndUnlocks.push({
    type: reward.type,
    key: reward.key,
    source: `achievement:${achievement.key}`,
    gamemode,
    partyId,
    unlockedAt: now,
    claimedAt: now,
    rewardGranted: true,
    rewardStatus: 'granted',
    metadata: getAchievementRewardMetadata(achievement, reward, now)
  });
  modifiedPaths.add('gameData.inGamePurchasesAndUnlocks');

  return { type: reward.type, key: reward.key, granted: true };
}

function ensureCanonicalOlingInventory(account, listKey) {
  const inventory = getLegacyOlingInventory(account);
  account.olings ||= {};
  if (!Array.isArray(account.olings[listKey])) {
    account.olings[listKey] = inventory[listKey] || [];
  } else if (!account.olings[listKey].length && inventory[listKey]?.length) {
    account.olings[listKey] = inventory[listKey];
  }
}

function grantOlingInventoryReward({
  account,
  achievement,
  reward,
  modifiedPaths,
  now
}) {
  const listKey = OLING_INVENTORY_REWARD_LISTS[reward.type];
  if (!listKey || !STACKABLE_REWARD_TYPES.has(reward.type)) return null;

  ensureCanonicalOlingInventory(account, listKey);
  account.olings[listKey] = mergeQuantityInventoryItems(
    account.olings[listKey],
    [
      {
        ...reward,
        metadata: getAchievementRewardMetadata(achievement, reward, now)
      }
    ],
    now
  );
  modifiedPaths.add(`olings.${listKey}`);

  return {
    type: reward.type,
    key: reward.key,
    quantity: reward.quantity,
    granted: true
  };
}

function applyAchievementReward({
  account,
  achievement,
  reward,
  gamemode,
  partyId,
  modifiedPaths,
  now
}) {
  if (reward.type === 'opals') {
    return grantAchievementOpals({
      account,
      achievement,
      reward,
      modifiedPaths,
      now
    });
  }
  if (reward.type === 'xp') {
    return grantAchievementXp({ account, reward, modifiedPaths });
  }

  const inventoryResult = grantOlingInventoryReward({
    account,
    achievement,
    reward,
    modifiedPaths,
    now
  });
  const unlockResult = UNIQUE_UNLOCK_REWARD_TYPES.has(reward.type)
    ? grantAchievementUnlock({
        account,
        achievement,
        reward,
        gamemode,
        partyId,
        modifiedPaths,
        now
      })
    : null;

  if (inventoryResult && unlockResult) {
    return {
      ...inventoryResult,
      entitlementGranted: unlockResult.granted,
      entitlementSkipped: unlockResult.skipped === true,
      granted:
        inventoryResult.granted &&
        (unlockResult.granted || unlockResult.skipped === true)
    };
  }
  return inventoryResult || unlockResult;
}

function getRewardStatus(rewards, rewardResults) {
  if (!rewards.length) return 'none';
  const grantedCount = rewardResults.filter(
    (reward) => reward?.granted || reward?.skipped
  ).length;
  if (grantedCount === rewards.length) return 'granted';
  return grantedCount > 0 ? 'partial' : 'failed';
}

function grantAchievementRewards({
  account,
  achievement,
  gamemode = null,
  partyId = null,
  now = new Date()
}) {
  const rewards = normalizeRewards(achievement.rewards);
  const modifiedPaths = new Set();
  const rewardResults = rewards.map((reward) =>
    applyAchievementReward({
      account,
      achievement,
      reward,
      gamemode,
      partyId,
      modifiedPaths,
      now
    })
  );
  const rewardStatus = getRewardStatus(rewards, rewardResults);
  markModifiedPaths(account, modifiedPaths);

  return {
    rewardGranted: rewardStatus === 'granted',
    rewardStatus,
    rewardResults,
    modifiedPaths: [...modifiedPaths]
  };
}

module.exports = {
  UNIQUE_UNLOCK_REWARD_TYPES,
  grantAchievementRewards
};
