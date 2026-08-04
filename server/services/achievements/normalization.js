const {
  normalizeAchievementRewards
} = require('../../../models/content/achievement-reward-contract');
const {
  getAchievementIconDirectory,
  LEGACY_ACHIEVEMENT_ICON_DIRECTORIES,
  normalizeAchievementTaxonomy
} = require('../../../models/content/achievement-taxonomy');

function normalizeString(value, fallback = '') {
  return String(value ?? fallback).trim();
}

function normalizeNullableString(value) {
  const normalized = normalizeString(value);
  return normalized || null;
}

function normalizeNumber(value, fallback = 0) {
  if (value === null || value === undefined || value === '') return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function normalizeTags(tags) {
  if (!Array.isArray(tags)) return [];
  return tags.map((tag) => normalizeString(tag)).filter(Boolean);
}

function normalizePathSegment(value, fallback = '') {
  return (
    normalizeString(value, fallback)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || fallback
  );
}

function getAchievementImagePath(achievement = {}) {
  const { key } = achievement;
  const safeKey = normalizePathSegment(key);
  const iconDirectory = getAchievementIconDirectory(achievement);

  if (!safeKey) return '';
  return `/images/achievements/icons/${iconDirectory}/${safeKey}.svg`;
}

function normalizeAchievementImagePath(achievement = {}) {
  const image = normalizeString(achievement.image);
  const defaultPath = getAchievementImagePath(achievement);
  const legacyIconPath = image.match(
    /^\/images\/achievements\/icons\/([^/]+)\/([^/]+\.svg)$/i
  );

  if (!image) return defaultPath;
  if (/^\/images\/achievements\/[^/]+\.svg$/i.test(image)) {
    return defaultPath;
  }
  if (legacyIconPath) {
    const targetDirectory =
      LEGACY_ACHIEVEMENT_ICON_DIRECTORIES[legacyIconPath[1]];
    if (targetDirectory) {
      return `/images/achievements/icons/${targetDirectory}/${legacyIconPath[2]}`;
    }
  }

  return image;
}

function normalizeRewards(rewards = []) {
  return normalizeAchievementRewards(rewards);
}

function serializeAchievementForJson(achievement) {
  const taxonomy = normalizeAchievementTaxonomy(achievement);

  return {
    key: achievement.key,
    name: achievement.name,
    description: achievement.description || '',
    image: normalizeAchievementImagePath(achievement),
    category: taxonomy.category,
    subcategory: taxonomy.subcategory,
    gamemode: taxonomy.gamemode,
    requirementType: achievement.requirementType || 'event',
    eventType: achievement.eventType || null,
    statPath: achievement.statPath || null,
    statKey: achievement.statKey || null,
    requirementValue: achievement.requirementValue ?? 1,
    minPlayers: achievement.minPlayers ?? 0,
    points: achievement.points ?? 0,
    rarity: achievement.rarity || 'common',
    hidden: Boolean(achievement.hidden),
    enabled: achievement.enabled !== false,
    status: achievement.status || 'published',
    sortOrder: achievement.sortOrder ?? 0,
    tags: normalizeTags(achievement.tags),
    rewards: normalizeRewards(achievement.rewards),
    metadata: achievement.metadata || {}
  };
}

function normalizeAchievementForDb(achievement = {}, index = 0) {
  const key = normalizeString(achievement.key).toLowerCase();
  if (!key) return null;

  const enabled = achievement.enabled !== false;
  const status = achievement.status || (enabled ? 'published' : 'draft');
  const taxonomy = normalizeAchievementTaxonomy(achievement);

  return {
    key,
    name: normalizeString(achievement.name, key),
    description: normalizeString(achievement.description),
    image: normalizeAchievementImagePath(achievement),
    category: taxonomy.category,
    subcategory: taxonomy.subcategory,
    gamemode: taxonomy.gamemode,
    requirementType: normalizeString(achievement.requirementType, 'event'),
    eventType: normalizeNullableString(achievement.eventType),
    statPath: normalizeNullableString(achievement.statPath),
    statKey: normalizeNullableString(achievement.statKey),
    requirementValue: normalizeNumber(achievement.requirementValue, 1),
    minPlayers: normalizeNumber(achievement.minPlayers, 0),
    points: normalizeNumber(achievement.points, 0),
    rarity: normalizeString(achievement.rarity, 'common'),
    hidden: Boolean(achievement.hidden),
    enabled,
    status,
    sortOrder: normalizeNumber(achievement.sortOrder, index),
    tags: normalizeTags(achievement.tags),
    rewards: normalizeRewards(achievement.rewards),
    metadata:
      achievement.metadata && typeof achievement.metadata === 'object'
        ? achievement.metadata
        : {}
  };
}

module.exports = {
  normalizeAchievementForDb,
  normalizeRewards,
  normalizeString,
  serializeAchievementForJson
};
