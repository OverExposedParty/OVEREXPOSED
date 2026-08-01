const CONTENT_ACCESS_LEVELS = Object.freeze({
  STANDARD: 'standard',
  BETA: 'beta',
  OWNER: 'owner',
  EXPLICIT: 'explicit'
});

const FEATURE_ACCESS_LEVELS = Object.freeze({
  'olings.lab': CONTENT_ACCESS_LEVELS.BETA,
  overexposure: CONTENT_ACCESS_LEVELS.BETA,
  'party-games.prompt-heist': CONTENT_ACCESS_LEVELS.BETA,
  shop: CONTENT_ACCESS_LEVELS.BETA,
  imposter: CONTENT_ACCESS_LEVELS.BETA,
  'would-you-rather': CONTENT_ACCESS_LEVELS.BETA,
  mafia: CONTENT_ACCESS_LEVELS.OWNER
});

const GAMEMODE_FEATURES = Object.freeze({
  imposter: 'imposter',
  'would-you-rather': 'would-you-rather',
  mafia: 'mafia'
});

function normalizeContentKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase();
}

function getFeatureAccessLevel(feature) {
  const normalizedFeature = normalizeContentKey(feature);
  return (
    FEATURE_ACCESS_LEVELS[normalizedFeature] || CONTENT_ACCESS_LEVELS.EXPLICIT
  );
}

function getGamemodeAccessLevel(gamemode) {
  const normalizedGamemode = normalizeContentKey(gamemode);
  const feature = GAMEMODE_FEATURES[normalizedGamemode];
  return feature
    ? getFeatureAccessLevel(feature)
    : CONTENT_ACCESS_LEVELS.STANDARD;
}

function isFeatureAvailableToStandardAccounts(feature) {
  return getFeatureAccessLevel(feature) === CONTENT_ACCESS_LEVELS.STANDARD;
}

function isGamemodeAvailableToStandardAccounts(gamemode) {
  return getGamemodeAccessLevel(gamemode) === CONTENT_ACCESS_LEVELS.STANDARD;
}

function shouldTrackStandardAccountProgress({ gamemode, feature } = {}) {
  if (gamemode && !isGamemodeAvailableToStandardAccounts(gamemode)) {
    return false;
  }
  if (feature && !isFeatureAvailableToStandardAccounts(feature)) {
    return false;
  }
  return true;
}

module.exports = {
  CONTENT_ACCESS_LEVELS,
  FEATURE_ACCESS_LEVELS,
  GAMEMODE_FEATURES,
  getFeatureAccessLevel,
  getGamemodeAccessLevel,
  isFeatureAvailableToStandardAccounts,
  isGamemodeAvailableToStandardAccounts,
  shouldTrackStandardAccountProgress
};
