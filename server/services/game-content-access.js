const {
  canAccessFeature,
  canAccessOwnerPages
} = require('./page-protection');

const PUBLIC_GAME_CONTENT_ACCESS = Object.freeze({ type: 'public' });

function normalizeGameContentAccess(access) {
  const type = String(access?.type || 'public')
    .trim()
    .toLowerCase();

  if (type === 'feature') {
    const feature = String(access?.feature || '')
      .trim()
      .toLowerCase();
    return feature ? { type, feature } : PUBLIC_GAME_CONTENT_ACCESS;
  }

  if (type === 'owner') return { type };
  return PUBLIC_GAME_CONTENT_ACCESS;
}

function serializeGameContentAccess(access) {
  const normalized = normalizeGameContentAccess(access);
  return normalized.type === 'public' ? null : normalized;
}

function canAccountAccessGameContent(account, access) {
  const normalized = normalizeGameContentAccess(access);
  if (normalized.type === 'public') return true;
  if (normalized.type === 'feature') {
    return canAccessFeature(account, normalized.feature);
  }
  if (normalized.type === 'owner') return canAccessOwnerPages(account);
  return false;
}

module.exports = {
  PUBLIC_GAME_CONTENT_ACCESS,
  canAccountAccessGameContent,
  normalizeGameContentAccess,
  serializeGameContentAccess
};
