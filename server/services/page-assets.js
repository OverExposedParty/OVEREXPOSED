const fs = require('fs');
const path = require('path');

const {
  PUBLIC_DIRECTORY,
  WEBSITE_CACHE_VERSION,
  DEPLOYMENT_VERSION,
  ONE_YEAR_IN_SECONDS,
  PARTY_CODE_CHARACTERS,
  PARTY_CODE_MAX_ATTEMPTS,
  ONLINE_GAMEMODE_MAX_PLAYERS,
  PARTY_META_IMAGE_FILENAMES,
  formatGamemodeName
} = require('../constants');
const { PARTY_GAME_MODELS_BY_GAMEMODE } = require('../models');

const WAITING_ROOM_TEMPLATE_PATH = path.join(
  PUBLIC_DIRECTORY,
  'pages',
  'waiting-room.html'
);
const WAITING_ROOM_TEMPLATE = fs.readFileSync(
  WAITING_ROOM_TEMPLATE_PATH,
  'utf8'
);

function getCookieValue(cookieHeader, key) {
  if (
    typeof cookieHeader !== 'string' ||
    typeof key !== 'string' ||
    key.length === 0
  ) {
    return null;
  }

  const cookies = cookieHeader.split(';');
  for (const cookie of cookies) {
    const [rawName, ...rawValue] = cookie.trim().split('=');
    if (rawName === key) {
      return rawValue.join('=');
    }
  }

  return null;
}

function removeLegacyCacheBustParams(url) {
  const keysToDelete = [];

  for (const [key, value] of url.searchParams.entries()) {
    if (/^\d+$/.test(key) && value === '') {
      keysToDelete.push(key);
    }
  }

  keysToDelete.forEach((key) => {
    url.searchParams.delete(key);
  });
}

function getVersionedPublicAssetUrl(assetUrl) {
  if (typeof assetUrl !== 'string' || !assetUrl.startsWith('/')) {
    return assetUrl;
  }

  try {
    const url = new URL(assetUrl, 'http://localhost');
    const assetPath = decodeURIComponent(url.pathname);
    const normalizedAssetPath = path
      .normalize(assetPath)
      .replace(/^([\\/])+/, '');
    const filePath = path.join(PUBLIC_DIRECTORY, normalizedAssetPath);

    if (!filePath.startsWith(PUBLIC_DIRECTORY)) {
      return assetUrl;
    }

    fs.accessSync(filePath, fs.constants.F_OK);

    removeLegacyCacheBustParams(url);
    url.searchParams.set('v', WEBSITE_CACHE_VERSION);
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return assetUrl;
  }
}

function versionLocalAssetReferences(html) {
  if (typeof html !== 'string') {
    return html;
  }

  return html.replace(
    /<(script|link|img)\b[^>]*(src|href)=["']([^"']+)["'][^>]*>/gi,
    (tag, tagName, attributeName, assetUrl) => {
      const lowerTagName = tagName.toLowerCase();

      if (
        lowerTagName === 'link' &&
        !/(rel=["'](?:stylesheet|preload|icon|shortcut icon|apple-touch-icon|manifest)["'])/i.test(
          tag
        )
      ) {
        return tag;
      }

      if (lowerTagName === 'link' && /rel=["']canonical["']/i.test(tag)) {
        return tag;
      }

      const versionedUrl = getVersionedPublicAssetUrl(assetUrl);
      if (versionedUrl === assetUrl) {
        return tag;
      }

      return tag.replace(
        new RegExp(
          `(${attributeName}=["'])${assetUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(["'])`,
          'i'
        ),
        `$1${versionedUrl}$2`
      );
    }
  );
}

function stripMetaContentSecurityPolicy(html) {
  if (typeof html !== 'string') {
    return html;
  }

  return html.replace(
    /<meta\b[^>]*http-equiv=["']Content-Security-Policy["'][^>]*>\s*/gi,
    ''
  );
}

function applyScriptNonceAttributes(html, cspNonce) {
  if (typeof html !== 'string' || typeof cspNonce !== 'string' || !cspNonce) {
    return html;
  }

  return html.replace(/<script\b([^>]*)>/gi, (tag, attributes = '') => {
    if (/\bnonce\s*=/i.test(attributes)) {
      return tag;
    }

    return `<script${attributes} nonce="${cspNonce}">`;
  });
}

function prepareHtmlResponse(html, { cspNonce = null } = {}) {
  return applyScriptNonceAttributes(
    versionLocalAssetReferences(stripMetaContentSecurityPolicy(html)),
    cspNonce
  );
}

function sendVersionedHtmlFile(req, res, filePath, statusCode = 200) {
  fs.readFile(filePath, 'utf8', (error, html) => {
    if (error) {
      console.error(`Error reading HTML file "${filePath}":`, error);
      if (!res.headersSent) {
        res.status(500).send('Internal Server Error');
      }
      return;
    }

    const existingDeploymentVersion = getCookieValue(
      req.headers.cookie,
      'oe-deployment-version'
    );
    if (existingDeploymentVersion !== DEPLOYMENT_VERSION) {
      res.setHeader('Clear-Site-Data', '"cache"');
      res.append(
        'Set-Cookie',
        `oe-deployment-version=${DEPLOYMENT_VERSION}; Path=/; Max-Age=${ONE_YEAR_IN_SECONDS}; SameSite=Lax`
      );
    }

    res
      .status(statusCode)
      .type('html')
      .send(prepareHtmlResponse(html, { cspNonce: res.locals?.cspNonce }));
  });
}

function escapeHtmlAttribute(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function getPartyMetaImagePath(gamemode, stateKey) {
  const filenames = PARTY_META_IMAGE_FILENAMES[stateKey] || [];

  for (const filename of filenames) {
    const relativePath = `/images/meta/og-images/party-games/${gamemode}/${filename}`;
    const absolutePath = path.join(
      PUBLIC_DIRECTORY,
      relativePath.replace(/^\//, '')
    );

    if (fs.existsSync(absolutePath)) {
      return relativePath;
    }
  }

  return '/images/meta/og-images/party-games/party-not-found.jpg';
}

async function getPartySessionByGamemode(gamemode, partyCode) {
  const model = PARTY_GAME_MODELS_BY_GAMEMODE[gamemode];

  if (!model) {
    return null;
  }

  return model.findOne({ partyId: partyCode }).lean();
}

function getPartyUserInstructions(partySession) {
  return (
    partySession?.config?.userInstructions ||
    partySession?.state?.userInstructions ||
    partySession?.userInstructions ||
    ''
  );
}

function generatePartyCode() {
  let code = '';

  for (let i = 0; i < 3; i += 1) {
    code += PARTY_CODE_CHARACTERS.charAt(
      Math.floor(Math.random() * PARTY_CODE_CHARACTERS.length)
    );
  }

  code += '-';

  for (let i = 0; i < 3; i += 1) {
    code += PARTY_CODE_CHARACTERS.charAt(
      Math.floor(Math.random() * PARTY_CODE_CHARACTERS.length)
    );
  }

  return code;
}

async function reserveUniquePartyCode(waitingRoomModel) {
  for (let attempt = 0; attempt < PARTY_CODE_MAX_ATTEMPTS; attempt += 1) {
    const partyCode = generatePartyCode();

    try {
      await waitingRoomModel.create({ partyId: partyCode });
      return partyCode;
    } catch (error) {
      if (error?.code === 11000) {
        continue;
      }

      throw error;
    }
  }

  throw new Error(
    `Failed to reserve a unique party code after ${PARTY_CODE_MAX_ATTEMPTS} attempts`
  );
}

function buildAbsoluteUrl(req, relativePath = '/') {
  const forwardedProto = req.headers['x-forwarded-proto'];
  const protocol = forwardedProto
    ? forwardedProto.split(',')[0].trim()
    : req.protocol;
  return `${protocol}://${req.get('host')}${relativePath}`;
}

async function getWaitingRoomMeta(req, partyCode, waitingRoom) {
  const waitingRoomUrl = buildAbsoluteUrl(req, `/${partyCode}`);
  const fallbackImageUrl = buildAbsoluteUrl(
    req,
    '/images/meta/og-images/party-games/party-not-found.jpg'
  );

  if (!waitingRoom) {
    return {
      title: 'Party Not Found | OVEREXPOSED',
      description:
        "This party couldn't be found. It may have expired or the code may be incorrect. Start a new party on Overexposed.",
      ogImage: fallbackImageUrl,
      url: waitingRoomUrl
    };
  }

  const gamemode = waitingRoom.config?.gamemode || 'overexposed';
  const gamemodeName = formatGamemodeName(gamemode) || 'Overexposed';
  const isPartyInProgress = Boolean(waitingRoom.state?.isPlaying);
  const playerCount = Array.isArray(waitingRoom.players)
    ? waitingRoom.players.length
    : 0;
  const maxPlayers = ONLINE_GAMEMODE_MAX_PLAYERS[gamemode] ?? null;
  const isLobbyFull =
    !isPartyInProgress && maxPlayers != null && playerCount >= maxPlayers;
  let metaState = 'waitingForHost';

  if (isLobbyFull) {
    metaState = 'lobbyFull';
  } else if (isPartyInProgress) {
    const partySession = await getPartySessionByGamemode(gamemode, partyCode);
    const userInstructions = getPartyUserInstructions(partySession);
    metaState = userInstructions.includes('GAME_OVER')
      ? 'gameHasFinished'
      : 'gameHasStarted';
  }

  const ogImagePath = getPartyMetaImagePath(gamemode, metaState);

  return {
    title:
      metaState === 'gameHasFinished'
        ? `${gamemodeName} Game Over | OVEREXPOSED`
        : metaState === 'gameHasStarted'
          ? `${gamemodeName} Game In Progress | OVEREXPOSED`
          : metaState === 'lobbyFull'
            ? `${gamemodeName} Lobby Full | OVEREXPOSED`
            : `${gamemodeName} Online | OVEREXPOSED`,
    description:
      metaState === 'gameHasFinished'
        ? `This ${gamemodeName} game is over. Start a new room on Overexposed to play again.`
        : metaState === 'gameHasStarted'
          ? `This ${gamemodeName} game has already started. Start a new room on Overexposed and get everyone back in.`
          : metaState === 'lobbyFull'
            ? `This ${gamemodeName} lobby is full. Start a new room on Overexposed to make space for more players.`
            : `Join this ${gamemodeName} room on Overexposed and jump straight into the party.`,
    ogImage: buildAbsoluteUrl(req, ogImagePath),
    url: waitingRoomUrl
  };
}

function renderWaitingRoomPage(meta) {
  const replacements = {
    __META_TITLE__: meta.title,
    __META_DESCRIPTION__: meta.description,
    __META_OG_TITLE__: meta.title,
    __META_OG_DESCRIPTION__: meta.description,
    __META_OG_IMAGE__: meta.ogImage,
    __META_OG_URL__: meta.url,
    __META_TWITTER_TITLE__: meta.title,
    __META_TWITTER_DESCRIPTION__: meta.description,
    __META_TWITTER_IMAGE__: meta.ogImage,
    __META_CANONICAL_URL__: meta.url
  };

  return Object.entries(replacements).reduce(
    (html, [placeholder, value]) =>
      html.replaceAll(placeholder, escapeHtmlAttribute(value)),
    WAITING_ROOM_TEMPLATE
  );
}

module.exports = {
  getCookieValue,
  getVersionedPublicAssetUrl,
  versionLocalAssetReferences,
  stripMetaContentSecurityPolicy,
  applyScriptNonceAttributes,
  prepareHtmlResponse,
  sendVersionedHtmlFile,
  reserveUniquePartyCode,
  getWaitingRoomMeta,
  renderWaitingRoomPage
};
