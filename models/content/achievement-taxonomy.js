const ACHIEVEMENT_CATEGORY_CONFIG = Object.freeze({
  account: Object.freeze(['profile', 'settings']),
  customisation: Object.freeze(['appearance']),
  social: Object.freeze(['friends']),
  gameplay: Object.freeze(['online']),
  community: Object.freeze(['help', 'overexposure']),
  events: Object.freeze(['seasonal']),
  shop: Object.freeze(['collections']),
  other: Object.freeze(['general'])
});

const DEFAULT_SUBCATEGORIES = Object.freeze({
  account: 'profile',
  customisation: 'appearance',
  social: 'friends',
  gameplay: 'online',
  community: 'overexposure',
  events: 'seasonal',
  shop: 'collections',
  other: 'general'
});

const {
  isFeatureAvailableToStandardAccounts,
  isGamemodeAvailableToStandardAccounts
} = require('./standard-account-content');

const LEGACY_CATEGORY_TAXONOMY = Object.freeze({
  account: Object.freeze({ category: 'account', subcategory: 'profile' }),
  settings: Object.freeze({ category: 'account', subcategory: 'settings' }),
  customisation: Object.freeze({
    category: 'customisation',
    subcategory: 'appearance'
  }),
  'friends-social': Object.freeze({
    category: 'social',
    subcategory: 'friends'
  }),
  'general-online': Object.freeze({
    category: 'gameplay',
    subcategory: 'online'
  }),
  help: Object.freeze({ category: 'community', subcategory: 'help' }),
  overexposure: Object.freeze({
    category: 'community',
    subcategory: 'overexposure'
  }),
  seasonal: Object.freeze({ category: 'events', subcategory: 'seasonal' }),
  shop: Object.freeze({ category: 'shop', subcategory: 'collections' }),
  other: Object.freeze({ category: 'other', subcategory: 'general' }),
  'truth-or-dare-online': Object.freeze({
    category: 'gameplay',
    subcategory: 'online',
    gamemode: 'truth-or-dare'
  }),
  'paranoia-online': Object.freeze({
    category: 'gameplay',
    subcategory: 'online',
    gamemode: 'paranoia'
  }),
  'most-likely-to-online': Object.freeze({
    category: 'gameplay',
    subcategory: 'online',
    gamemode: 'most-likely-to'
  }),
  'never-have-i-ever-online': Object.freeze({
    category: 'gameplay',
    subcategory: 'online',
    gamemode: 'never-have-i-ever'
  }),
  'would-you-rather-online': Object.freeze({
    category: 'gameplay',
    subcategory: 'online',
    gamemode: 'would-you-rather'
  }),
  'imposter-online': Object.freeze({
    category: 'gameplay',
    subcategory: 'online',
    gamemode: 'imposter'
  }),
  'mafia-online': Object.freeze({
    category: 'gameplay',
    subcategory: 'online',
    gamemode: 'mafia'
  })
});

const ACHIEVEMENT_ICON_DIRECTORIES = Object.freeze({
  'account|profile': 'account/profile',
  'account|settings': 'account/settings',
  'customisation|appearance': 'customisation/appearance',
  'social|friends': 'social/friends',
  'gameplay|online': 'gameplay/online',
  'community|help': 'community/help',
  'community|overexposure': 'community/overexposure',
  'events|seasonal': 'events/seasonal',
  'shop|collections': 'shop/collections',
  'other|general': 'other/general'
});

function normalizeTaxonomySegment(value, fallback = '') {
  return (
    String(value ?? fallback)
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || fallback
  );
}

function normalizeAchievementTaxonomy(achievement = {}) {
  const legacyCategory = normalizeTaxonomySegment(
    achievement.category,
    'general-online'
  );
  const legacyTaxonomy = LEGACY_CATEGORY_TAXONOMY[legacyCategory];
  const category = legacyTaxonomy?.category || legacyCategory;
  const requestedSubcategory = normalizeTaxonomySegment(
    achievement.subcategory
  );
  const allowedSubcategories = ACHIEVEMENT_CATEGORY_CONFIG[category];
  const subcategory =
    (requestedSubcategory &&
    (!allowedSubcategories ||
      allowedSubcategories.includes(requestedSubcategory))
      ? requestedSubcategory
      : '') ||
    legacyTaxonomy?.subcategory ||
    DEFAULT_SUBCATEGORIES[category] ||
    'general';
  const gamemode =
    normalizeTaxonomySegment(achievement.gamemode) ||
    legacyTaxonomy?.gamemode ||
    null;

  return { category, subcategory, gamemode };
}

function isAchievementTaxonomyValid(achievement = {}) {
  const requestedSubcategory = normalizeTaxonomySegment(
    achievement.subcategory
  );
  const taxonomy = normalizeAchievementTaxonomy(achievement);
  const allowedSubcategories = ACHIEVEMENT_CATEGORY_CONFIG[taxonomy.category];

  if (
    requestedSubcategory &&
    allowedSubcategories &&
    !allowedSubcategories.includes(requestedSubcategory)
  ) {
    return false;
  }

  return (
    !taxonomy.gamemode ||
    (taxonomy.category === 'gameplay' && taxonomy.subcategory === 'online')
  );
}

function isAchievementAvailableToStandardAccounts(achievement = {}) {
  const taxonomy = normalizeAchievementTaxonomy(achievement);
  if (
    taxonomy.gamemode &&
    !isGamemodeAvailableToStandardAccounts(taxonomy.gamemode)
  ) {
    return false;
  }
  if (
    taxonomy.category === 'shop' &&
    !isFeatureAvailableToStandardAccounts('shop')
  ) {
    return false;
  }
  if (
    taxonomy.category === 'community' &&
    taxonomy.subcategory === 'overexposure' &&
    !isFeatureAvailableToStandardAccounts('overexposure')
  ) {
    return false;
  }
  return true;
}

function getAchievementIconDirectory(achievement = {}) {
  const taxonomy = normalizeAchievementTaxonomy(achievement);
  const baseDirectory =
    ACHIEVEMENT_ICON_DIRECTORIES[
      `${taxonomy.category}|${taxonomy.subcategory}`
    ] || `${taxonomy.category}/${taxonomy.subcategory}`;

  if (
    taxonomy.category === 'gameplay' &&
    taxonomy.subcategory === 'online' &&
    taxonomy.gamemode
  ) {
    return `${baseDirectory}/${taxonomy.gamemode}`;
  }

  return baseDirectory;
}

module.exports = {
  ACHIEVEMENT_CATEGORY_CONFIG,
  getAchievementIconDirectory,
  isAchievementAvailableToStandardAccounts,
  isAchievementTaxonomyValid,
  normalizeAchievementTaxonomy,
  normalizeTaxonomySegment
};
