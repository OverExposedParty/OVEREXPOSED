const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const multer = require('multer');
const ffmpegPath = require('ffmpeg-static');
const packageJson = require('../../package.json');

const { generateDeleteCode } = require('../../utils/generate-delete-code');
const { getCookieValue } = require('../services/page-assets');
const { canAccessFeature } = require('../services/page-protection');
const { exportGameModesToJson } = require('../services/game-modes');
const { exportGamePacksToJson } = require('../services/game-packs');
const { exportGameRolesToJson } = require('../services/game-roles');
const { exportGameRulesToJson } = require('../services/game-rules');
const {
  exportAchievementsToJson,
  unlockAchievementByKey
} = require('../services/achievements');
const { exportOlingConsumablesToJson } = require('../services/olings');
const { serializeOeImagesForPackJson } = require('../services/oe-images');
const {
  createMarketingUnsubscribeUrl,
  getPublicSiteUrl,
  sendEmailChangeEmail,
  sendPasswordResetEmail,
  sendVerificationEmail
} = require('../services/email');
const { recordEmailConversion } = require('../services/email-tracking');
const {
  grantShopItemsToAccount,
  serializeOpalTransactions,
  serializeOpalWallet,
  spendOpalsForProduct
} = require('../services/opals');
const {
  canUseOeItem,
  getOeItemAccessState
} = require('../services/oe-entitlements');
const {
  ONLINE_GAMEMODE_MAX_PLAYERS,
  PUBLIC_DIRECTORY,
  WEBSITE_CACHE_VERSION
} = require('../constants');
const { isProduction } = require('../logger');
const {
  OE_PANEL_ROLES,
  SYSTEM_FEATURE_FLAGS,
  createAdminLog,
  formatSystemConfigDate,
  serializeAdminLog
} = require('./shared/api-admin-helpers');
const {
  normalizeSocialPlatforms,
  serializeSocialContentItem
} = require('./shared/api-social-helpers');
const {
  formatCurrencyValue,
  formatOePanelDateTime,
  formatPartyGameLabel,
  formatReportLabel
} = require('./shared/api-formatters');
const {
  normalizePackHexColour,
  parseBooleanLabel,
  parseNullableNumber,
  parseRestrictionList
} = require('./shared/api-parsers');
const {
  getDefaultProductVariant,
  serializeProductMedia,
  serializeShopProduct,
  serializeShopVariant
} = require('./shared/api-shop-helpers');
const {
  createOverexposureAccountSummary,
  getOverexposurePostedAt,
  getOverexposurePublicId,
  getOverexposureTag,
  getOverexposureTitle,
  normalizeReportText,
  parseOverexposurePostedAt,
  serializeOverexposurePost,
  toPlainObject
} = require('./shared/api-overexposure-helpers');
const {
  createOeCustomisationHelpers
} = require('./shared/api-oe-customisation-helpers');

const OE_CUSTOMISATION_SVG_WIDTH = 512;
const OE_CUSTOMISATION_SVG_HEIGHT = 512;
const OE_PANEL_EXPORT_UPLOAD = multer({
  dest: path.join(os.tmpdir(), 'oe-panel-export-uploads'),
  limits: {
    fileSize: 250 * 1024 * 1024
  }
});
const OE_PANEL_SVG_UPLOAD = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 512 * 1024
  },
  fileFilter(req, file, callback) {
    const isSvg =
      file.mimetype === 'image/svg+xml' ||
      String(file.originalname || '')
        .toLowerCase()
        .endsWith('.svg');

    callback(
      isSvg ? null : new Error('Only SVG files can be uploaded.'),
      isSvg
    );
  }
});
fs.mkdirSync(path.join(os.tmpdir(), 'oe-panel-export-uploads'), {
  recursive: true
});

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(Math.max(number, min), max);
}

function escapeFfmpegText(value) {
  return String(value || '')
    .replace(/\\/g, '\\\\')
    .replace(/:/g, '\\:')
    .replace(/'/g, "\\'")
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]');
}

function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(ffmpegPath, args, {
      windowsHide: true
    });
    let stderr = '';

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      const error = new Error(`ffmpeg exited with code ${code}`);
      error.stderr = stderr;
      reject(error);
    });
  });
}

const {
  createPartyContentContext
} = require('./api-route-context/party-content');
const {
  createGamemodeSettingsContext
} = require('./api-route-context/gamemode-settings');
const { createModerationContext } = require('./api-route-context/moderation');
const { createPanelUserContext } = require('./api-route-context/panel-users');
const {
  createAuthSecurityContext
} = require('./api-route-context/auth-security');
const { createOAuthContext } = require('./api-route-context/oauth');
const { createAccountContext } = require('./api-route-context/accounts');
const { createPartyRoomContext } = require('./api-route-context/party-rooms');
const {
  createPublicApiRouteContext
} = require('./api-route-context/public-context');

function createApiRouteContext({ app, models, runtime, partyOwnerLeases }) {
  const context = {
    app,
    models,
    runtime,
    partyOwnerLeases,
    bcrypt,
    crypto,
    fs,
    os,
    path,
    spawn,
    multer,
    ffmpegPath,
    packageJson,
    generateDeleteCode,
    getCookieValue,
    canAccessFeature,
    exportGameModesToJson,
    exportGamePacksToJson,
    exportGameRolesToJson,
    exportGameRulesToJson,
    exportAchievementsToJson,
    unlockAchievementByKey,
    exportOlingConsumablesToJson,
    serializeOeImagesForPackJson,
    createMarketingUnsubscribeUrl,
    getPublicSiteUrl,
    sendEmailChangeEmail,
    sendPasswordResetEmail,
    sendVerificationEmail,
    recordEmailConversion,
    grantShopItemsToAccount,
    serializeOpalTransactions,
    serializeOpalWallet,
    spendOpalsForProduct,
    canUseOeItem,
    getOeItemAccessState,
    ONLINE_GAMEMODE_MAX_PLAYERS,
    PUBLIC_DIRECTORY,
    WEBSITE_CACHE_VERSION,
    isProduction,
    OE_PANEL_ROLES,
    SYSTEM_FEATURE_FLAGS,
    createAdminLog,
    formatSystemConfigDate,
    serializeAdminLog,
    normalizeSocialPlatforms,
    serializeSocialContentItem,
    formatCurrencyValue,
    formatOePanelDateTime,
    formatPartyGameLabel,
    formatReportLabel,
    normalizePackHexColour,
    parseBooleanLabel,
    parseNullableNumber,
    parseRestrictionList,
    getDefaultProductVariant,
    serializeProductMedia,
    serializeShopProduct,
    serializeShopVariant,
    createOverexposureAccountSummary,
    getOverexposurePostedAt,
    getOverexposurePublicId,
    getOverexposureTag,
    getOverexposureTitle,
    normalizeReportText,
    parseOverexposurePostedAt,
    serializeOverexposurePost,
    toPlainObject,
    createOeCustomisationHelpers,
    OE_CUSTOMISATION_SVG_WIDTH,
    OE_CUSTOMISATION_SVG_HEIGHT,
    OE_PANEL_EXPORT_UPLOAD,
    OE_PANEL_SVG_UPLOAD,
    clampNumber,
    escapeFfmpegText,
    runFfmpeg,
    ...models
  };

  Object.assign(
    context,
    createOeCustomisationHelpers({
      fs,
      path,
      PUBLIC_DIRECTORY,
      OE_CUSTOMISATION_SVG_WIDTH,
      OE_CUSTOMISATION_SVG_HEIGHT
    })
  );

  Object.assign(context, createPartyContentContext(context));
  Object.assign(context, createGamemodeSettingsContext(context));
  Object.assign(context, createModerationContext(context));
  Object.assign(context, createPanelUserContext(context));
  Object.assign(context, createAuthSecurityContext(context));
  Object.assign(context, createPartyRoomContext(context));
  Object.assign(context, createAccountContext(context));
  Object.assign(context, createOAuthContext(context));

  return createPublicApiRouteContext(context);
}

module.exports = {
  createApiRouteContext
};
