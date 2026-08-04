const test = require('node:test');
const assert = require('node:assert/strict');

const achievements = require('../../server/services/achievements');
const library = require('../../server/services/achievements/library');
const normalization = require('../../server/services/achievements/normalization');
const unlocking = require('../../server/services/achievements/unlocking');
const progress = require('../../server/services/achievements/progress');
const truthOrDare = require('../../server/services/achievements/truth-or-dare');
const mostLikelyTo = require('../../server/services/achievements/most-likely-to');
const paranoia = require('../../server/services/achievements/paranoia');
const neverHaveIEver = require('../../server/services/achievements/never-have-i-ever');
const {
  achievements: canonicalAchievements
} = require('../../public/json-files/achievements/achievements.json');
const achievementRarities = require('../../public/json-files/achievements/rarities.json');
const {
  isAchievementAvailableToStandardAccounts
} = require('../../models/content/achievement-taxonomy');

const RARITY_REWARD_AMOUNTS = Object.freeze({
  common: Object.freeze({ opals: 10, xp: 50 }),
  uncommon: Object.freeze({ opals: 20, xp: 100 }),
  rare: Object.freeze({ opals: 35, xp: 175 }),
  epic: Object.freeze({ opals: 60, xp: 300 }),
  legendary: Object.freeze({ opals: 120, xp: 600 }),
  secret: Object.freeze({ opals: 150, xp: 750 })
});

const NON_STANDARD_GAMEMODES = new Set([
  'imposter',
  'mafia',
  'would-you-rather'
]);

function isNonStandardAchievement(achievement) {
  return (
    NON_STANDARD_GAMEMODES.has(achievement.gamemode) ||
    achievement.category === 'shop' ||
    (achievement.category === 'community' &&
      achievement.subcategory === 'overexposure')
  );
}

test('achievement rarity configuration only exposes supported rarities', () => {
  assert.deepEqual(Object.keys(achievementRarities), [
    'common',
    'uncommon',
    'rare',
    'epic',
    'legendary',
    'secret'
  ]);
});

test('achievement service facade preserves the public API', () => {
  assert.deepEqual(
    Object.keys(achievements).sort(),
    [
      'exportAchievementsToJson',
      'getAchievementLibrary',
      'getPublishedAchievements',
      'hardMigrateAchievementsFromJson',
      'importAchievementsFromJson',
      'incrementAchievementStat',
      'recordAchievementCollectionItems',
      'recordMostLikelyToResult',
      'recordNeverHaveIEverResult',
      'recordPackOwnershipAchievements',
      'recordParanoiaResult',
      'recordAchievementPlayDate',
      'recordTruthOrDarePromptResult',
      'serializeAchievementForJson',
      'unlockAchievementByKey'
    ].sort()
  );
});

test('achievement service facade delegates to focused modules', () => {
  assert.equal(
    achievements.exportAchievementsToJson,
    library.exportAchievementsToJson
  );
  assert.equal(
    achievements.getAchievementLibrary,
    library.getAchievementLibrary
  );
  assert.equal(
    achievements.getPublishedAchievements,
    library.getPublishedAchievements
  );
  assert.equal(
    achievements.hardMigrateAchievementsFromJson,
    library.hardMigrateAchievementsFromJson
  );
  assert.equal(
    achievements.importAchievementsFromJson,
    library.importAchievementsFromJson
  );
  assert.equal(
    achievements.serializeAchievementForJson,
    normalization.serializeAchievementForJson
  );
  assert.equal(
    achievements.unlockAchievementByKey,
    unlocking.unlockAchievementByKey
  );
  assert.equal(
    achievements.incrementAchievementStat,
    progress.incrementAchievementStat
  );
  assert.equal(
    achievements.recordAchievementCollectionItems,
    progress.recordAchievementCollectionItems
  );
  assert.equal(
    achievements.recordPackOwnershipAchievements,
    progress.recordPackOwnershipAchievements
  );
  assert.equal(
    achievements.recordAchievementPlayDate,
    progress.recordAchievementPlayDate
  );
  assert.equal(
    achievements.recordTruthOrDarePromptResult,
    truthOrDare.recordTruthOrDarePromptResult
  );
  assert.equal(
    achievements.recordMostLikelyToResult,
    mostLikelyTo.recordMostLikelyToResult
  );
  assert.equal(
    achievements.recordParanoiaResult,
    paranoia.recordParanoiaResult
  );
  assert.equal(
    achievements.recordNeverHaveIEverResult,
    neverHaveIEver.recordNeverHaveIEverResult
  );
});

test('canonical achievements include their rarity-based Opal and XP rewards', () => {
  assert.equal(canonicalAchievements.length, 169);

  canonicalAchievements.forEach((achievement) => {
    const expected = RARITY_REWARD_AMOUNTS[achievement.rarity];
    assert.ok(expected, `${achievement.key} has an unsupported rarity`);
    assert.equal(
      achievement.status,
      'published',
      `${achievement.key} is not published`
    );

    ['opals', 'xp'].forEach((type) => {
      const rewards = achievement.rewards.filter(
        (reward) => reward.type === type
      );
      assert.equal(
        rewards.length,
        1,
        `${achievement.key} should have exactly one ${type} reward`
      );
      assert.equal(
        rewards[0].amount,
        expected[type],
        `${achievement.key} has the wrong ${type} amount`
      );
    });
  });
});

test('achievements outside standard-account pages and modes are disabled', () => {
  const disabledAchievements = canonicalAchievements.filter(
    (achievement) => achievement.enabled === false
  );

  assert.equal(disabledAchievements.length, 60);
  canonicalAchievements.forEach((achievement) => {
    assert.equal(
      achievement.enabled,
      !isNonStandardAchievement(achievement),
      `${achievement.key} has the wrong enabled state`
    );
    assert.equal(
      isAchievementAvailableToStandardAccounts(achievement),
      !isNonStandardAchievement(achievement)
    );
  });
});

test('published achievement lookup excludes restricted legacy database rows', async () => {
  const rows = [
    {
      key: 'legacy-restricted-row',
      category: 'imposter-online',
      enabled: true,
      status: 'published',
      rewards: []
    },
    {
      key: 'standard-row',
      category: 'general-online',
      enabled: true,
      status: 'published',
      rewards: []
    }
  ];
  const Achievement = {
    find() {
      return {
        sort() {
          return this;
        },
        async lean() {
          return rows;
        }
      };
    }
  };

  const published = await library.getPublishedAchievements(Achievement);
  assert.deepEqual(
    published.map((achievement) => achievement.key),
    ['standard-row']
  );
});

test('resolved achievement unlocks reject restricted achievements', async () => {
  const result = await unlocking.unlockResolvedAchievement({
    account: {},
    achievement: {
      key: 'restricted-imposter-row',
      category: 'gameplay',
      subcategory: 'online',
      gamemode: 'imposter'
    }
  });

  assert.equal(result, null);
});

test('canonical achievements use the broad category taxonomy', () => {
  const allowedTaxonomy = {
    account: ['profile', 'settings'],
    customisation: ['appearance'],
    social: ['friends'],
    gameplay: ['online'],
    community: ['help', 'overexposure'],
    events: ['seasonal'],
    shop: ['collections'],
    other: ['general']
  };

  canonicalAchievements.forEach((achievement) => {
    assert.ok(
      allowedTaxonomy[achievement.category]?.includes(achievement.subcategory),
      `${achievement.key} has an invalid category/subcategory pair`
    );
    if (achievement.gamemode) {
      assert.equal(achievement.category, 'gameplay');
      assert.equal(achievement.subcategory, 'online');
    }
  });
});

test('achievement normalization accepts legacy category values', () => {
  const achievement = normalization.normalizeAchievementForDb({
    key: 'legacy-imposter-achievement',
    category: 'imposter-online'
  });

  assert.equal(achievement.category, 'gameplay');
  assert.equal(achievement.subcategory, 'online');
  assert.equal(achievement.gamemode, 'imposter');
  assert.equal(
    achievement.image,
    '/images/achievements/icons/gameplay/online/imposter/legacy-imposter-achievement.svg'
  );
});

test('achievement normalization rewrites legacy icon directories', () => {
  assert.equal(
    normalization.normalizeAchievementForDb({
      key: 'legacy-profile-achievement',
      category: 'account',
      image: '/images/achievements/icons/account/legacy-profile-achievement.svg'
    }).image,
    '/images/achievements/icons/account/profile/legacy-profile-achievement.svg'
  );

  assert.equal(
    normalization.serializeAchievementForJson({
      key: 'legacy-imposter-achievement',
      category: 'gameplay',
      subcategory: 'online',
      gamemode: 'imposter',
      image:
        '/images/achievements/icons/imposter-online/legacy-imposter-achievement.svg'
    }).image,
    '/images/achievements/icons/gameplay/online/imposter/legacy-imposter-achievement.svg'
  );
});

test('achievement import/export normalization preserves rewards arrays', () => {
  const achievement = {
    key: 'reward-stack',
    name: 'Reward Stack',
    category: 'account',
    rarity: 'legendary',
    reward: { type: 'xp', amount: 999 },
    rewards: [
      { type: 'opals', amount: 120 },
      { type: 'xp', amount: 50 },
      {
        type: 'oling_consumable',
        key: 'opal-dust',
        quantity: 2,
        metadata: { rarity: 'rare' }
      }
    ]
  };

  const dbAchievement = normalization.normalizeAchievementForDb(achievement);
  assert.equal(dbAchievement.subcategory, 'profile');
  assert.equal(Object.hasOwn(dbAchievement, 'reward'), false);
  assert.deepEqual(dbAchievement.rewards, [
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
      metadata: { rarity: 'rare' }
    }
  ]);

  const jsonAchievement =
    normalization.serializeAchievementForJson(dbAchievement);
  assert.equal(Object.hasOwn(jsonAchievement, 'reward'), false);
  assert.deepEqual(jsonAchievement.rewards, dbAchievement.rewards);

  assert.throws(
    () =>
      normalization.normalizeAchievementForDb({
        ...achievement,
        rewards: [{ type: 'none', amount: 1 }]
      }),
    /Reward 1 type is invalid/
  );
});

test('hard achievement migration removes legacy fields and stale rows', async () => {
  const upserts = [];
  const Achievement = {
    async findOneAndUpdate(query, update, options) {
      upserts.push({ query, update, options });
      return update.$set;
    },
    collection: {
      async updateMany(query, update) {
        assert.deepEqual(query, { reward: { $exists: true } });
        assert.deepEqual(update, { $unset: { reward: '' } });
        return { modifiedCount: 169 };
      }
    },
    async deleteMany(query) {
      assert.equal(query.key.$nin.length, 169);
      return { deletedCount: 2 };
    }
  };

  const result = await library.hardMigrateAchievementsFromJson(Achievement);

  assert.equal(upserts.length, 169);
  assert.equal(result.imported.length, 169);
  assert.equal(result.legacyFieldsRemoved, 169);
  assert.equal(result.staleAchievementsRemoved, 2);
});
