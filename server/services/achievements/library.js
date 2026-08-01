const fs = require('fs/promises');
const path = require('path');

const {
  normalizeAchievementForDb,
  serializeAchievementForJson
} = require('./normalization');
const {
  isAchievementAvailableToStandardAccounts
} = require('../../../models/content/achievement-taxonomy');

function normalizeAchievementList(achievements) {
  return achievements.map((achievement, index) => ({
    ...achievement,
    ...normalizeAchievementForDb(achievement, index)
  }));
}

function filterStandardAccountAchievements(achievements) {
  return achievements.filter(isAchievementAvailableToStandardAccounts);
}

const ACHIEVEMENTS_ROOT = path.join(
  process.cwd(),
  'public',
  'json-files',
  'achievements'
);
const ACHIEVEMENTS_FILE = path.join(ACHIEVEMENTS_ROOT, 'achievements.json');

async function readAchievementsJson() {
  const data = JSON.parse(await fs.readFile(ACHIEVEMENTS_FILE, 'utf8'));
  return Array.isArray(data.achievements) ? data.achievements : [];
}

function normalizeAchievementImportList(achievements) {
  const normalized = achievements
    .map((achievement, index) => normalizeAchievementForDb(achievement, index))
    .filter(Boolean);
  const keys = new Set();

  normalized.forEach((achievement) => {
    if (keys.has(achievement.key)) {
      throw new Error(`Duplicate achievement key: ${achievement.key}`);
    }
    keys.add(achievement.key);
  });

  return normalized;
}

async function upsertAchievements(Achievement, achievements) {
  const imported = [];
  for (const achievement of achievements) {
    const importedAchievement = await Achievement.findOneAndUpdate(
      { key: achievement.key },
      { $set: achievement },
      { new: true, upsert: true, runValidators: true }
    );
    imported.push(importedAchievement);
  }
  return imported;
}

function matchesAchievementQuery(achievement, query = {}) {
  return Object.entries(query).every(([key, expected]) => {
    const actual = achievement[key];
    if (
      expected &&
      typeof expected === 'object' &&
      Array.isArray(expected.$in)
    ) {
      return expected.$in.includes(actual);
    }
    return actual === expected;
  });
}

async function importAchievementsFromJson(Achievement) {
  const achievements = normalizeAchievementImportList(
    await readAchievementsJson()
  );
  return upsertAchievements(Achievement, achievements);
}

async function hardMigrateAchievementsFromJson(Achievement) {
  const achievements = normalizeAchievementImportList(
    await readAchievementsJson()
  );
  if (!achievements.length) {
    throw new Error('Hard achievement migration refused an empty source file.');
  }

  const imported = await upsertAchievements(Achievement, achievements);
  const legacyCleanup = await Achievement.collection.updateMany(
    { reward: { $exists: true } },
    { $unset: { reward: '' } }
  );
  const staleCleanup = await Achievement.deleteMany({
    key: { $nin: achievements.map((achievement) => achievement.key) }
  });

  return {
    imported,
    legacyFieldsRemoved: Number(
      legacyCleanup?.modifiedCount || legacyCleanup?.nModified || 0
    ),
    staleAchievementsRemoved: Number(
      staleCleanup?.deletedCount || staleCleanup?.n || 0
    )
  };
}

async function exportAchievementsToJson(Achievement) {
  const achievements = await Achievement.find({})
    .sort({ category: 1, subcategory: 1, gamemode: 1, sortOrder: 1, key: 1 })
    .lean();

  await fs.mkdir(ACHIEVEMENTS_ROOT, { recursive: true });
  await fs.writeFile(
    ACHIEVEMENTS_FILE,
    `${JSON.stringify(
      { achievements: achievements.map(serializeAchievementForJson) },
      null,
      2
    )}\n`
  );

  return achievements;
}

async function getPublishedAchievements(Achievement, query = {}) {
  const publishedQuery = {
    enabled: true,
    status: 'published',
    ...query
  };

  try {
    const achievements = await Achievement.find(publishedQuery)
      .sort({ category: 1, subcategory: 1, gamemode: 1, sortOrder: 1, key: 1 })
      .lean();

    if (achievements.length) {
      return filterStandardAccountAchievements(
        normalizeAchievementList(achievements)
      );
    }
    if (typeof Achievement.countDocuments === 'function') {
      const totalAchievements = await Achievement.countDocuments({});
      if (totalAchievements > 0) return [];
    }
  } catch (error) {
    console.warn('Falling back to JSON achievements:', error.message || error);
  }

  const achievements = await readAchievementsJson();
  return achievements
    .map((achievement, index) => normalizeAchievementForDb(achievement, index))
    .filter(Boolean)
    .filter(isAchievementAvailableToStandardAccounts)
    .filter((achievement) =>
      matchesAchievementQuery(achievement, publishedQuery)
    )
    .sort(
      (left, right) =>
        left.category.localeCompare(right.category) ||
        left.subcategory.localeCompare(right.subcategory) ||
        left.sortOrder - right.sortOrder ||
        left.key.localeCompare(right.key)
    );
}

async function getAchievementLibrary(Achievement) {
  try {
    const achievements = await Achievement.find({})
      .sort({ category: 1, subcategory: 1, gamemode: 1, sortOrder: 1, key: 1 })
      .lean();

    if (achievements.length) return normalizeAchievementList(achievements);
    if (typeof Achievement.countDocuments === 'function') {
      const totalAchievements = await Achievement.countDocuments({});
      if (totalAchievements > 0) return [];
    }
  } catch (error) {
    console.warn(
      'Falling back to JSON achievement library:',
      error.message || error
    );
  }

  const achievements = await readAchievementsJson();
  return achievements
    .map((achievement, index) => normalizeAchievementForDb(achievement, index))
    .filter(Boolean)
    .sort(
      (left, right) =>
        left.category.localeCompare(right.category) ||
        left.subcategory.localeCompare(right.subcategory) ||
        left.sortOrder - right.sortOrder ||
        left.key.localeCompare(right.key)
    );
}

module.exports = {
  exportAchievementsToJson,
  getAchievementLibrary,
  getPublishedAchievements,
  hardMigrateAchievementsFromJson,
  importAchievementsFromJson
};
