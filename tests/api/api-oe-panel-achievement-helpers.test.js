const assert = require('node:assert/strict');
const test = require('node:test');

const {
  createOePanelAchievementHelpers
} = require('../../server/routes/api-oe-panel/achievement-helpers');

function createHelpers() {
  return createOePanelAchievementHelpers({
    fs: {},
    path: {},
    PUBLIC_DIRECTORY: process.cwd(),
    formatOePanelDateTime: (value) => value || '-',
    parseBooleanLabel(value) {
      const normalized = String(value || '')
        .trim()
        .toLowerCase();
      if (normalized === 'yes') return true;
      if (normalized === 'no') return false;
      return null;
    }
  });
}

test('OE panel achievement payload accepts multiple rewards', () => {
  const { createAchievementCreatePayload } = createHelpers();

  const { achievement, error } = createAchievementCreatePayload({
    key: 'reward-stack',
    name: 'Reward Stack',
    category: 'account',
    status: 'draft',
    active: 'no',
    hidden: 'no',
    rarity: 'legendary',
    rewardsJson: JSON.stringify([
      { type: 'opals', amount: 120 },
      { type: 'xp', amount: 50 },
      { type: 'oling_consumable', key: 'opal-dust', quantity: 2 }
    ])
  });

  assert.equal(error, undefined);
  assert.equal(achievement.category, 'account');
  assert.equal(achievement.subcategory, 'profile');
  assert.equal(achievement.gamemode, null);
  assert.deepEqual(achievement.rewards, [
    {
      type: 'opals',
      key: null,
      amount: 120,
      quantity: 1,
      metadata: {}
    },
    {
      type: 'xp',
      key: null,
      amount: 50,
      quantity: 1,
      metadata: {}
    },
    {
      type: 'oling_consumable',
      key: 'opal-dust',
      amount: 0,
      quantity: 2,
      metadata: {}
    }
  ]);
  assert.equal(Object.hasOwn(achievement, 'reward'), false);
});

test('OE panel achievement payload rejects invalid rewards JSON', () => {
  const { createAchievementCreatePayload } = createHelpers();

  assert.deepEqual(
    createAchievementCreatePayload({
      key: 'bad-reward',
      name: 'Bad Reward',
      category: 'account',
      status: 'draft',
      active: 'no',
      hidden: 'no',
      rewardsJson: '{"type":"opals"}'
    }),
    { error: 'Achievement rewards must be a JSON array.' }
  );

  assert.deepEqual(
    createAchievementCreatePayload({
      key: 'bad-reward-type',
      name: 'Bad Reward Type',
      category: 'account',
      status: 'draft',
      active: 'no',
      hidden: 'no',
      rewardsJson: '[{"type":"none"}]'
    }),
    { error: 'Reward 1 type is invalid.' }
  );

  assert.deepEqual(
    createAchievementCreatePayload({
      key: 'empty-opal-reward',
      name: 'Empty Opal Reward',
      category: 'account',
      status: 'draft',
      active: 'no',
      hidden: 'no',
      rewardsJson: '[{"type":"opals"}]'
    }),
    { error: 'Reward 1 amount must be a positive integer.' }
  );

  assert.deepEqual(
    createAchievementCreatePayload({
      key: 'missing-item-key',
      name: 'Missing Item Key',
      category: 'account',
      status: 'draft',
      active: 'no',
      hidden: 'no',
      rewardsJson: '[{"type":"oling_consumable"}]'
    }),
    { error: 'Reward 1 requires a key.' }
  );
});

test('OE panel achievement rows format rewards arrays', () => {
  const { serializeAchievementForPanel } = createHelpers();

  const row = serializeAchievementForPanel({
    key: 'reward-stack',
    name: 'Reward Stack',
    category: 'account',
    rarity: 'legendary',
    rewards: [
      { type: 'opals', amount: 120 },
      { type: 'oling_consumable', key: 'opal-dust', quantity: 2 }
    ]
  });

  assert.equal(row.rewards, 'opals x120, oling_consumable opal-dust qty 2');
  assert.equal(row.subcategory, 'profile');
  assert.equal(Object.hasOwn(row, 'reward'), false);
});

test('OE panel achievement payload normalizes legacy gamemode categories', () => {
  const { createAchievementCreatePayload } = createHelpers();
  const { achievement, error } = createAchievementCreatePayload({
    key: 'legacy-imposter-achievement',
    name: 'Legacy Imposter Achievement',
    category: 'imposter-online',
    status: 'draft',
    active: 'no',
    hidden: 'no',
    rewardsJson: ''
  });

  assert.equal(error, undefined);
  assert.equal(achievement.category, 'gameplay');
  assert.equal(achievement.subcategory, 'online');
  assert.equal(achievement.gamemode, 'imposter');
  assert.equal(
    achievement.image,
    '/images/achievements/icons/gameplay/online/imposter/legacy-imposter-achievement.svg'
  );
});

test('OE panel achievement payload rejects mismatched taxonomy fields', () => {
  const { createAchievementCreatePayload } = createHelpers();
  const result = createAchievementCreatePayload({
    key: 'bad-taxonomy',
    name: 'Bad Taxonomy',
    category: 'account',
    subcategory: 'online',
    gamemode: 'imposter',
    status: 'draft',
    active: 'no',
    hidden: 'no',
    rewardsJson: ''
  });

  assert.match(result.error, /subcategory must belong to its category/i);
});
