const fs = require('fs');
const path = require('path');

const {
  PUBLIC_DIRECTORY,
  PARTY_CODE_CHARACTERS,
  PARTY_CODE_MAX_ATTEMPTS,
  ONLINE_GAMEMODE_MAX_PLAYERS,
  PARTY_META_IMAGE_FILENAMES,
  formatGamemodeName
} = require('../../constants');
const { PARTY_GAME_MODELS_BY_GAMEMODE } = require('../../models');
const { escapeHtmlAttribute } = require('./html-escape');
const { isPartyRoomActive } = require('../party-room-activity');

const WAITING_ROOM_TEMPLATE_PATH = path.join(
  PUBLIC_DIRECTORY,
  'pages',
  'waiting-room.html'
);
const WAITING_ROOM_TEMPLATE = fs.readFileSync(
  WAITING_ROOM_TEMPLATE_PATH,
  'utf8'
);
const WAITING_ROOM_GAMEMODE_COLOURS = Object.freeze({
  'truth-or-dare': { primary: '#66CCFF', secondary: '#427BB9' },
  paranoia: { primary: '#9D8AFF', secondary: '#7F71B2' },
  'never-have-i-ever': { primary: '#FF9266', secondary: '#B96542' },
  'most-likely-to': { primary: '#FFEE66', secondary: '#B9AA42' },
  imposter: { primary: '#3DA7A1', secondary: '#2A6E6A' },
  'would-you-rather': { primary: '#7CFFB2', secondary: '#55B97F' },
  mafia: { primary: '#9B56D3', secondary: '#6D3C95' }
});

function getWaitingRoomGamemodeColours(gamemode) {
  return (
    WAITING_ROOM_GAMEMODE_COLOURS[gamemode] || {
      primary: '#999999',
      secondary: '#666666'
    }
  );
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

function getWaitingRoomSplashScreen(gamemode) {
  if (!PARTY_GAME_MODELS_BY_GAMEMODE[gamemode]) {
    return '/images/splash-screens/overexposed.png';
  }

  const splashScreen = `/images/splash-screens/${gamemode}.png`;
  const absolutePath = path.join(
    PUBLIC_DIRECTORY,
    splashScreen.replace(/^\//, '')
  );
  return fs.existsSync(absolutePath)
    ? splashScreen
    : '/images/splash-screens/overexposed.png';
}

async function getPartySessionByGamemode(gamemode, partyCode) {
  const model = PARTY_GAME_MODELS_BY_GAMEMODE[gamemode];

  if (!model) {
    return null;
  }

  const party = await model.findOne({ partyId: partyCode }).lean();
  return isPartyRoomActive(party) ? party : null;
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

  if (!isPartyRoomActive(waitingRoom)) {
    return {
      title: 'Party Not Found | OVEREXPOSED',
      description:
        "This party couldn't be found. It may have expired or the code may be incorrect. Start a new party on Overexposed.",
      ogImage: fallbackImageUrl,
      primaryColour: '#999999',
      secondaryColour: '#666666',
      url: waitingRoomUrl
    };
  }

  const gamemode = waitingRoom.config?.gamemode || 'overexposed';
  const gamemodeColours = getWaitingRoomGamemodeColours(gamemode);
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
    primaryColour: gamemodeColours.primary,
    secondaryColour: gamemodeColours.secondary,
    splashScreen: getWaitingRoomSplashScreen(gamemode),
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
    __META_CANONICAL_URL__: meta.url,
    __WAITING_ROOM_SPLASH_SCREEN__:
      meta.splashScreen || '/images/splash-screens/overexposed.png',
    __WAITING_ROOM_PRIMARY_COLOUR__: meta.primaryColour || '#999999',
    __WAITING_ROOM_SECONDARY_COLOUR__: meta.secondaryColour || '#666666'
  };

  return Object.entries(replacements).reduce(
    (html, [placeholder, value]) =>
      html.replaceAll(placeholder, escapeHtmlAttribute(value)),
    WAITING_ROOM_TEMPLATE
  );
}

module.exports = {
  getWaitingRoomGamemodeColours,
  getWaitingRoomSplashScreen,
  reserveUniquePartyCode,
  getWaitingRoomMeta,
  renderWaitingRoomPage
};
