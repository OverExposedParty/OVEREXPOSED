const ACHIEVEMENT_REWARD_TYPES = Object.freeze([
  'opals',
  'xp',
  'badge',
  'cosmetic',
  'pack',
  'oe',
  'oling_egg',
  'oling_consumable',
  'oling_headwear',
  'oling_furniture'
]);

const AMOUNT_REWARD_TYPES = new Set(['opals', 'xp']);
const KEYED_REWARD_TYPES = new Set(
  ACHIEVEMENT_REWARD_TYPES.filter((type) => !AMOUNT_REWARD_TYPES.has(type))
);
const STACKABLE_REWARD_TYPES = new Set([
  'oling_egg',
  'oling_consumable',
  'oling_furniture'
]);

const MAX_REWARDS_PER_ACHIEVEMENT = 20;
const MAX_REWARD_AMOUNT = 1_000_000;
const MAX_REWARD_QUANTITY = 10_000;
const MAX_REWARD_KEY_LENGTH = 200;

class AchievementRewardValidationError extends TypeError {
  constructor(message, { index = null, field = null } = {}) {
    super(message);
    this.name = 'AchievementRewardValidationError';
    this.index = index;
    this.field = field;
  }
}

function toPlainReward(reward) {
  return reward?.toObject?.({ depopulate: true }) || reward;
}

function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function rewardError(index, field, message) {
  const prefix = Number.isInteger(index) ? `Reward ${index + 1}` : 'Reward';
  return new AchievementRewardValidationError(`${prefix} ${message}`, {
    index,
    field
  });
}

function normalizePositiveInteger(value, { index, field, maximum }) {
  const number = Number(value);
  if (!Number.isInteger(number) || number <= 0) {
    throw rewardError(index, field, `${field} must be a positive integer.`);
  }
  if (number > maximum) {
    throw rewardError(
      index,
      field,
      `${field} cannot be greater than ${maximum}.`
    );
  }
  return number;
}

function normalizeRewardKey(value, index) {
  const key = String(value ?? '').trim();
  if (!key) {
    throw rewardError(index, 'key', 'requires a key.');
  }
  if (key.length > MAX_REWARD_KEY_LENGTH) {
    throw rewardError(
      index,
      'key',
      `key cannot be longer than ${MAX_REWARD_KEY_LENGTH} characters.`
    );
  }
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._:/-]*$/.test(key)) {
    throw rewardError(index, 'key', 'key contains unsupported characters.');
  }
  return key;
}

function normalizeRewardMetadata(value, index) {
  if (value === undefined || value === null) return {};
  const metadata = value?.toObject?.({ depopulate: true }) || value;
  if (!isPlainObject(metadata)) {
    throw rewardError(index, 'metadata', 'metadata must be an object.');
  }
  return { ...metadata };
}

function normalizeAchievementReward(rewardInput, index = 0) {
  const reward = toPlainReward(rewardInput);
  if (!reward || typeof reward !== 'object' || Array.isArray(reward)) {
    throw rewardError(index, null, 'must be an object.');
  }

  const type = String(reward.type ?? '')
    .trim()
    .toLowerCase();
  if (!ACHIEVEMENT_REWARD_TYPES.includes(type)) {
    throw rewardError(index, 'type', 'type is invalid.');
  }

  const metadata = normalizeRewardMetadata(reward.metadata, index);
  if (AMOUNT_REWARD_TYPES.has(type)) {
    const amount = normalizePositiveInteger(reward.amount, {
      index,
      field: 'amount',
      maximum: MAX_REWARD_AMOUNT
    });
    const quantityValue = reward.quantity ?? 1;
    if (Number(quantityValue) !== 1) {
      throw rewardError(index, 'quantity', 'quantity must be 1 for this type.');
    }
    if (reward.key !== undefined && reward.key !== null && reward.key !== '') {
      throw rewardError(index, 'key', 'cannot have a key for this type.');
    }

    return {
      type,
      key: null,
      amount,
      quantity: 1,
      metadata
    };
  }

  const key = normalizeRewardKey(reward.key, index);
  const quantity = STACKABLE_REWARD_TYPES.has(type)
    ? normalizePositiveInteger(reward.quantity ?? 1, {
        index,
        field: 'quantity',
        maximum: MAX_REWARD_QUANTITY
      })
    : 1;

  if (!STACKABLE_REWARD_TYPES.has(type) && Number(reward.quantity ?? 1) !== 1) {
    throw rewardError(index, 'quantity', 'quantity must be 1 for this type.');
  }
  if (reward.amount !== undefined && Number(reward.amount) !== 0) {
    throw rewardError(index, 'amount', 'cannot have an amount for this type.');
  }

  return {
    type,
    key,
    amount: 0,
    quantity,
    metadata
  };
}

function normalizeAchievementRewards(rewardsInput = []) {
  if (!Array.isArray(rewardsInput)) {
    throw new AchievementRewardValidationError(
      'Achievement rewards must be an array.'
    );
  }
  if (rewardsInput.length > MAX_REWARDS_PER_ACHIEVEMENT) {
    throw new AchievementRewardValidationError(
      `Achievements cannot have more than ${MAX_REWARDS_PER_ACHIEVEMENT} rewards.`
    );
  }

  const rewards = rewardsInput.map(normalizeAchievementReward);
  const identities = new Set();
  rewards.forEach((reward, index) => {
    const identity = KEYED_REWARD_TYPES.has(reward.type)
      ? `${reward.type}:${reward.key}`
      : reward.type;
    if (identities.has(identity)) {
      throw rewardError(index, null, 'duplicates an earlier reward.');
    }
    identities.add(identity);
  });

  return rewards;
}

function getAchievementRewardValidationMessage(rewards) {
  try {
    normalizeAchievementRewards(rewards);
    return null;
  } catch (error) {
    return error instanceof AchievementRewardValidationError
      ? error.message
      : 'Achievement rewards are invalid.';
  }
}

module.exports = {
  ACHIEVEMENT_REWARD_TYPES,
  AMOUNT_REWARD_TYPES,
  KEYED_REWARD_TYPES,
  STACKABLE_REWARD_TYPES,
  MAX_REWARD_AMOUNT,
  MAX_REWARD_QUANTITY,
  MAX_REWARDS_PER_ACHIEVEMENT,
  AchievementRewardValidationError,
  getAchievementRewardValidationMessage,
  normalizeAchievementReward,
  normalizeAchievementRewards
};
