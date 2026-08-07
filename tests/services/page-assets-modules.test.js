const assert = require('node:assert/strict');
const test = require('node:test');

const pageAssets = require('../../server/services/page-assets');
const assetResponse = require('../../server/services/page-assets/asset-response');
const protectedPage = require('../../server/services/page-assets/protected-page');
const waitingRoom = require('../../server/services/page-assets/waiting-room');

test('page asset facade preserves its composed public API', () => {
  assert.deepEqual(Object.keys(pageAssets).sort(), [
    'applyScriptNonceAttributes',
    'getCookieValue',
    'getProtectedPageLoginUrl',
    'getVersionedPublicAssetUrl',
    'getWaitingRoomMeta',
    'injectCriticalSplashStyles',
    'prepareHtmlResponse',
    'renderProtectedPage',
    'renderWaitingRoomPage',
    'reserveUniquePartyCode',
    'sendProtectedPage',
    'sendVersionedHtmlFile',
    'stripMetaContentSecurityPolicy',
    'versionLocalAssetReferences'
  ]);

  assert.equal(pageAssets.getCookieValue, assetResponse.getCookieValue);
  assert.equal(
    pageAssets.prepareHtmlResponse,
    assetResponse.prepareHtmlResponse
  );
  assert.equal(
    pageAssets.getProtectedPageLoginUrl,
    protectedPage.getProtectedPageLoginUrl
  );
  assert.equal(pageAssets.sendProtectedPage, protectedPage.sendProtectedPage);
  assert.equal(
    pageAssets.reserveUniquePartyCode,
    waitingRoom.reserveUniquePartyCode
  );
  assert.equal(pageAssets.getWaitingRoomMeta, waitingRoom.getWaitingRoomMeta);
});

test('waiting-room first paint uses the active gamemode palette', () => {
  assert.deepEqual(waitingRoom.getWaitingRoomGamemodeColours('mafia'), {
    primary: '#9B56D3',
    secondary: '#6D3C95'
  });
  assert.deepEqual(waitingRoom.getWaitingRoomGamemodeColours('unknown'), {
    primary: '#999999',
    secondary: '#666666'
  });
});
