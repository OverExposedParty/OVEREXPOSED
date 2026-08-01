const {
  getCookieValue,
  getVersionedPublicAssetUrl,
  versionLocalAssetReferences,
  stripMetaContentSecurityPolicy,
  injectCriticalSplashStyles,
  applyScriptNonceAttributes,
  prepareHtmlResponse,
  sendVersionedHtmlFile
} = require('./page-assets/asset-response');
const {
  getProtectedPageLoginUrl,
  renderProtectedPage,
  sendProtectedPage
} = require('./page-assets/protected-page');
const {
  reserveUniquePartyCode,
  getWaitingRoomMeta,
  renderWaitingRoomPage
} = require('./page-assets/waiting-room');

module.exports = {
  getCookieValue,
  getVersionedPublicAssetUrl,
  versionLocalAssetReferences,
  stripMetaContentSecurityPolicy,
  injectCriticalSplashStyles,
  applyScriptNonceAttributes,
  prepareHtmlResponse,
  sendVersionedHtmlFile,
  reserveUniquePartyCode,
  getWaitingRoomMeta,
  getProtectedPageLoginUrl,
  renderWaitingRoomPage,
  renderProtectedPage,
  sendProtectedPage
};
