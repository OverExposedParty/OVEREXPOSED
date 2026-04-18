const express = require('express');
const bcrypt = require("bcryptjs");
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const compression = require('compression');
const helmet = require('helmet');
const permissionsPolicy = require('permissions-policy');
const http = require('http');
const { generateDeleteCode } = require("./utils/generate-delete-code");
const { QRCodeStyling } = require('qr-code-styling/lib/qr-code-styling.common.js');
const nodeCanvas = require('canvas');
const { JSDOM } = require('jsdom');

require('dotenv').config();

const isProduction = process.env.NODE_ENV === 'production';

function debugLog(...args) {
  if (!isProduction) {
    console.log(...args);
  }
}

function debugWarn(...args) {
  if (!isProduction) {
    console.warn(...args);
  }
}

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json()); // This will allow Express to parse incoming JSON
app.use(compression({ threshold: 1024 }));

const socketIo = require('socket.io'); // Import socket.io
const server = http.createServer(app);
const io = socketIo(server);
const mongoose = require('mongoose');

const Confession = require('./models/confessions');
const partyGameTruthOrDareSchema = require('./models/party-game-truth-or-dare-schema');
const partyGameParanoiaSchema = require('./models/party-game-paranoia-schema');
const partyGameNeverHaveIEverSchema = require('./models/party-game-never-have-i-ever-schema');
const partyGameMostLikelyToSchema = require('./models/party-game-most-likely-to-schema');
const partyGameWouldYouRatherSchema = require('./models/party-game-would-you-rather-schema');
const partyGameMafiaSchema = require('./models/party-game-mafia-schema');
const partyGameChatLogSchema = require('./models/party-game-chat-log-schema');
const waitingRoomSchema = require('./models/waiting-room-schema');
const partyGameImposterSchema = require('./models/party-game-imposter-schema');

const PARTY_CODE_CHARACTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const PARTY_CODE_MAX_ATTEMPTS = 100;

// MongoDB connections
let overexposureDb = null;
const changeStreams = new Map();
const changeStreamRestartTimers = new Map();
const changeStreamRetryCounts = new Map();
const changeStreamDefinitions = [];
const socketPartyMemberships = new Map();
const CHANGE_STREAM_BACKOFF_MS = [1000, 2000, 5000, 10000, 30000];
let dbReconnectHooksAttached = false;
const WAITING_ROOM_TEMPLATE_PATH = path.join(__dirname, 'public', 'pages', 'waiting-room.html');
const WAITING_ROOM_TEMPLATE = fs.readFileSync(WAITING_ROOM_TEMPLATE_PATH, 'utf8');
const PUBLIC_DIRECTORY = path.join(__dirname, 'public');
const WEBSITE_CACHE_VERSION = process.env.WEBSITE_CACHE_VERSION || '2026-04-17-1';
const DEPLOYMENT_VERSION = WEBSITE_CACHE_VERSION;
const ONLINE_GAMEMODE_MIN_PLAYERS = {
  'truth-or-dare': 2,
  'paranoia': 3,
  'never-have-i-ever': 2,
  'most-likely-to': 3,
  'imposter': 3,
  'would-you-rather': 3,
  'mafia': 5
};
const ONLINE_GAMEMODE_MAX_PLAYERS = {
  'truth-or-dare': 20,
  'paranoia': 15,
  'never-have-i-ever': 20,
  'most-likely-to': 20,
  'imposter': 16,
  'would-you-rather': 20,
  'mafia': 20
};
const PARTY_GAME_MODELS_BY_GAMEMODE = {
  'truth-or-dare': partyGameTruthOrDareSchema,
  'paranoia': partyGameParanoiaSchema,
  'never-have-i-ever': partyGameNeverHaveIEverSchema,
  'most-likely-to': partyGameMostLikelyToSchema,
  'imposter': partyGameImposterSchema,
  'would-you-rather': partyGameWouldYouRatherSchema,
  'mafia': partyGameMafiaSchema
};
const PARTY_META_IMAGE_FILENAMES = {
  waitingForHost: ['waiting-for-host.jpg', 'play.jpg'],
  gameHasStarted: ['game-has-started.jpg'],
  gameHasFinished: ['game-has-finished.jpg'],
  lobbyFull: ['lobby-full.jpg', 'lobby full.jpg', 'play.jpg']
};

function getCookieValue(cookieHeader, key) {
  if (typeof cookieHeader !== 'string' || typeof key !== 'string' || key.length === 0) {
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
    const normalizedAssetPath = path.normalize(assetPath).replace(/^([\\/])+/, '');
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

  return html.replace(/<(script|link|img)\b[^>]*(src|href)=["']([^"']+)["'][^>]*>/gi, (tag, tagName, attributeName, assetUrl) => {
    const lowerTagName = tagName.toLowerCase();
    const lowerTag = tag.toLowerCase();

    if (lowerTagName === 'link' && !/(rel=["'](?:stylesheet|preload|icon|shortcut icon|apple-touch-icon|manifest)["'])/i.test(tag)) {
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
      new RegExp(`(${attributeName}=["'])${assetUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(["'])`, 'i'),
      `$1${versionedUrl}$2`
    );
  });
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

    const existingDeploymentVersion = getCookieValue(req.headers.cookie, 'oe-deployment-version');
    if (existingDeploymentVersion !== DEPLOYMENT_VERSION) {
      res.setHeader('Clear-Site-Data', '"cache"');
      res.append('Set-Cookie', `oe-deployment-version=${DEPLOYMENT_VERSION}; Path=/; Max-Age=${ONE_YEAR_IN_SECONDS}; SameSite=Lax`);
    }

    res.status(statusCode).type('html').send(versionLocalAssetReferences(html));
  });
}

function escapeHtmlAttribute(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function formatGamemodeName(gamemode = '') {
  return gamemode
    .split('-')
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function getPartyMetaImagePath(gamemode, stateKey) {
  const filenames = PARTY_META_IMAGE_FILENAMES[stateKey] || [];

  for (const filename of filenames) {
    const relativePath = `/images/meta/og-images/party-games/${gamemode}/${filename}`;
    const absolutePath = path.join(PUBLIC_DIRECTORY, relativePath.replace(/^\//, ''));

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
  return partySession?.config?.userInstructions
    || partySession?.state?.userInstructions
    || partySession?.userInstructions
    || '';
}

function generatePartyCode() {
  let code = '';

  for (let i = 0; i < 3; i++) {
    code += PARTY_CODE_CHARACTERS.charAt(Math.floor(Math.random() * PARTY_CODE_CHARACTERS.length));
  }

  code += '-';

  for (let i = 0; i < 3; i++) {
    code += PARTY_CODE_CHARACTERS.charAt(Math.floor(Math.random() * PARTY_CODE_CHARACTERS.length));
  }

  return code;
}

async function reserveUniquePartyCode() {
  for (let attempt = 0; attempt < PARTY_CODE_MAX_ATTEMPTS; attempt += 1) {
    const partyCode = generatePartyCode();

    try {
      await waitingRoomSchema.create({ partyId: partyCode });
      return partyCode;
    } catch (error) {
      if (error?.code === 11000) {
        continue;
      }

      throw error;
    }
  }

  throw new Error(`Failed to reserve a unique party code after ${PARTY_CODE_MAX_ATTEMPTS} attempts`);
}

function buildAbsoluteUrl(req, relativePath = '/') {
  const forwardedProto = req.headers['x-forwarded-proto'];
  const protocol = forwardedProto ? forwardedProto.split(',')[0].trim() : req.protocol;
  return `${protocol}://${req.get('host')}${relativePath}`;
}

async function getWaitingRoomMeta(req, partyCode, waitingRoom) {
  const waitingRoomUrl = buildAbsoluteUrl(req, `/${partyCode}`);
  const fallbackImageUrl = buildAbsoluteUrl(req, '/images/meta/og-images/party-games/party-not-found.jpg');

  if (!waitingRoom) {
    return {
      title: 'Party Not Found | OVEREXPOSED',
      description: "This party couldn't be found. It may have expired or the code may be incorrect. Start a new party on Overexposed.",
      ogImage: fallbackImageUrl,
      url: waitingRoomUrl
    };
  }

  const gamemode = waitingRoom.config?.gamemode || 'overexposed';
  const gamemodeName = formatGamemodeName(gamemode) || 'Overexposed';
  const isPartyInProgress = Boolean(waitingRoom.state?.isPlaying);
  const playerCount = Array.isArray(waitingRoom.players) ? waitingRoom.players.length : 0;
  const maxPlayers = ONLINE_GAMEMODE_MAX_PLAYERS[gamemode] ?? null;
  const isLobbyFull = !isPartyInProgress && maxPlayers != null && playerCount >= maxPlayers;
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
    title: metaState === 'gameHasFinished'
      ? `${gamemodeName} Game Over | OVEREXPOSED`
      : metaState === 'gameHasStarted'
        ? `${gamemodeName} Game In Progress | OVEREXPOSED`
        : metaState === 'lobbyFull'
          ? `${gamemodeName} Lobby Full | OVEREXPOSED`
          : `${gamemodeName} Online | OVEREXPOSED`,
    description: metaState === 'gameHasFinished'
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
    '__META_TITLE__': meta.title,
    '__META_DESCRIPTION__': meta.description,
    '__META_OG_TITLE__': meta.title,
    '__META_OG_DESCRIPTION__': meta.description,
    '__META_OG_IMAGE__': meta.ogImage,
    '__META_OG_URL__': meta.url,
    '__META_TWITTER_TITLE__': meta.title,
    '__META_TWITTER_DESCRIPTION__': meta.description,
    '__META_TWITTER_IMAGE__': meta.ogImage,
    '__META_CANONICAL_URL__': meta.url
  };

  return Object.entries(replacements).reduce(
    (html, [placeholder, value]) => html.replaceAll(placeholder, escapeHtmlAttribute(value)),
    WAITING_ROOM_TEMPLATE
  );
}

function closeChangeStream(key) {
  const stream = changeStreams.get(key);
  if (!stream) return;

  try {
    stream.removeAllListeners();
    stream.close();
  } catch (err) {
    console.warn(`⚠️ Failed to close change stream "${key}":`, err.message || err);
  }

  changeStreams.delete(key);
}

function scheduleChangeStreamRestart(definition, reason) {
  const { key, label } = definition;

  if (changeStreamRestartTimers.has(key)) {
    return;
  }

  closeChangeStream(key);

  const attempt = (changeStreamRetryCounts.get(key) || 0) + 1;
  changeStreamRetryCounts.set(key, attempt);
  const delay = CHANGE_STREAM_BACKOFF_MS[Math.min(attempt - 1, CHANGE_STREAM_BACKOFF_MS.length - 1)];

  console.warn(`🔁 Restarting "${label}" stream in ${delay}ms (reason: ${reason}, attempt: ${attempt})`);

  const timer = setTimeout(() => {
    changeStreamRestartTimers.delete(key);
    registerResilientChangeStream(definition);
  }, delay);

  changeStreamRestartTimers.set(key, timer);
}

function registerResilientChangeStream(definition) {
  const { key, label, open, onChange } = definition;

  closeChangeStream(key);

  const pendingTimer = changeStreamRestartTimers.get(key);
  if (pendingTimer) {
    clearTimeout(pendingTimer);
    changeStreamRestartTimers.delete(key);
  }

  let stream;
  try {
    stream = open();
  } catch (err) {
    console.error(`❌ Failed to open "${label}" stream:`, err);
    scheduleChangeStreamRestart(definition, 'open-failed');
    return;
  }

  changeStreams.set(key, stream);
  changeStreamRetryCounts.set(key, 0);

  stream.on('change', onChange);
  stream.on('error', (err) => {
    console.error(`❌ ${label} stream error:`, err);
    scheduleChangeStreamRestart(definition, 'error');
  });
  stream.on('close', () => {
    console.warn(`⚠️ ${label} stream closed`);
    scheduleChangeStreamRestart(definition, 'close');
  });
  stream.on('end', () => {
    console.warn(`⚠️ ${label} stream ended`);
    scheduleChangeStreamRestart(definition, 'end');
  });

  debugLog(`👁 Watching ${label} stream`);
}

function restartAllChangeStreams(reason = 'manual-restart') {
  if (!changeStreamDefinitions.length) return;
  console.warn(`♻️ Restarting all change streams (${reason})`);
  changeStreamDefinitions.forEach(registerResilientChangeStream);
}

function attachDbReconnectHooks() {
  if (dbReconnectHooksAttached || !overexposureDb) return;
  dbReconnectHooksAttached = true;

  overexposureDb.on('disconnected', () => {
    console.warn('⚠️ MongoDB disconnected; waiting to restart streams on reconnect');
  });

  overexposureDb.on('reconnected', () => {
    restartAllChangeStreams('mongo-reconnected');
  });

  overexposureDb.on('error', (err) => {
    console.error('❌ MongoDB connection error:', err);
  });
}

async function connectDatabases() {
  try {
    await mongoose.connect(process.env.MONGO_URI_OVEREXPOSURE);
    debugLog('✅ Connected to OVEREXPOSURE Database');

    overexposureDb = mongoose.connection;
  } catch (err) {
    console.error('❌ Database connection error:', err);
    process.exit(1);
  }
}

async function ensureDatabaseIndexes() {
  const modelsToIndex = [
    waitingRoomSchema,
    partyGameTruthOrDareSchema,
    partyGameParanoiaSchema,
    partyGameNeverHaveIEverSchema,
    partyGameMostLikelyToSchema,
    partyGameImposterSchema,
    partyGameWouldYouRatherSchema,
    partyGameMafiaSchema,
    partyGameChatLogSchema,
    Confession
  ];

  await Promise.all(
    modelsToIndex.map(async (model) => {
      try {
        await model.createIndexes();
      } catch (error) {
        console.warn(`⚠️ Failed to ensure indexes for ${model.modelName}:`, error.message || error);
      }
    })
  );
}

// === SOCKET.IO SETUP ===
io.on('connection', (socket) => {
  debugLog(`✅ Client connected: ${socket.id}`);

  socket.on('join-party', (partyCode) => {
    if (!partyCode) return;
    socket.join(partyCode);
    debugLog(`🎉 User joined room: ${partyCode}`);
    socket.emit('joined-party', { message: `Joined party: ${partyCode}` });

    // Notify others in the room
    socket.to(partyCode).emit('user-joined', { socketId: socket.id });
  });

  socket.on('leave-party', (partyCode) => {
    if (!partyCode) return;
    socket.leave(partyCode);
    debugLog(`${socket.id} left room ${partyCode}`);

    // Notify the leaving socket
    socket.emit('left-party', partyCode);

    // Notify everyone else
    socket.to(partyCode).emit('user-left', { socketId: socket.id });
  });


  socket.on('disconnect', async () => {
    debugLog(`❌ Client disconnected: ${socket.id}`);

    // Automatically get all rooms this socket was part of
    const rooms = Array.from(socket.rooms).filter(room => room !== socket.id);

    rooms.forEach((room) => {
      socket.to(room).emit('user-disconnected', { socketId: socket.id });
      debugLog(`📢 Notified room ${room} of disconnection`);
    });

    await disconnectSocketPartyMemberships(socket.id);
  });

  socket.on('kick-user', (partyCode) => {
    if (!partyCode) return;

    socket.leave(partyCode);
    debugLog(`${socket.id} kicked from room ${partyCode}`);

    // Notify the user who was kicked
    socket.emit('kicked-from-party', partyCode);

    // Notify others in the room
    socket.to(partyCode).emit('user-kicked', { socketId: socket.id });
  });

  socket.on('delete-party', (partyCode) => {
    if (!partyCode) return;

    debugLog(`🗑️ Party deleted: ${partyCode}`);

    // Notify everyone in the room (except the sender)
    socket.to(partyCode).emit('party-deleted', { partyCode });

    // Also notify the sender (the host)
    socket.emit('party-deleted', { partyCode });

    // Remove all sockets from the room
    const clientsInRoom = io.sockets.adapter.rooms.get(partyCode);
    if (clientsInRoom) {
      for (const clientId of clientsInRoom) {
        const clientSocket = io.sockets.sockets.get(clientId);
        clientSocket?.leave(partyCode);
      }
    }
  });
});

// === WATCH DATABASE CHANGES ===
async function startChangeStreams() {
  if (!overexposureDb) {
    throw new Error('Cannot start change streams before database connection is ready');
  }

  const waitingRoomDB = overexposureDb.collection('waiting-room');
  const partyGameTruthOrDareDB = overexposureDb.collection('party-game-truth-or-dare');
  const partyGameParanoiaDB = overexposureDb.collection('party-game-paranoia');
  const partyGameNeverHaveIEverDB = overexposureDb.collection('party-game-never-have-i-ever');
  const partyGameMostLikelyToDB = overexposureDb.collection('party-game-most-likely-to');
  const partyGameImposterDB = overexposureDb.collection('party-game-imposter');
  const partyGameWouldYouRatherDB = overexposureDb.collection('party-game-would-you-rather');
  const partyGameMafiaDB = overexposureDb.collection('party-game-mafia');
  const partyGameChatLogDB = overexposureDb.collection('party-game-chat-log');

  const openWatchStream = (collection) => {
    if (collection?.collection?.watch) {
      return collection.collection.watch([], { fullDocument: 'updateLookup' });
    }
    return collection.watch([], { fullDocument: 'updateLookup' });
  };

  const partyChangeHandler = (label) => (change) => {
    const partyCode = change.fullDocument?.partyId;
    if (!partyCode) {
      console.warn(`⚠️ ${label} change missing partyCode`);
      return;
    }

    io.to(partyCode).emit('party-updated', {
      type: change.operationType,
      source: label,
      emittedPartyCode: change.fullDocument || null,
      documentKey: change.documentKey,
    });
    debugLog(`🔄 ${label} change sent to ${partyCode}`);
  };

  const chatLogChangeHandler = (change) => {
    const partyCode = change.fullDocument?.partyId;

    if (!partyCode && change.operationType === 'delete') {
      console.warn('⚠️ chat-log delete missing partyId');
      return;
    }

    if (['insert', 'update'].includes(change.operationType)) {
      io.to(partyCode).emit('chat-updated', {
        type: change.operationType,
        chatLog: change.fullDocument,
        documentKey: change.documentKey,
      });
      debugLog(`💬 chat-log ${change.operationType} sent to ${partyCode}`);
    }

    if (change.operationType === 'delete') {
      io.to(partyCode).emit('chat-updated', {
        type: 'delete',
        chatLog: null,
        documentKey: change.documentKey,
      });
      debugLog(`❌ chat-log delete sent to ${partyCode}`);
    }
  };

  changeStreamDefinitions.length = 0;
  changeStreamDefinitions.push(
    {
      key: 'confessions',
      label: 'confessions',
      open: () => Confession.watch([], { fullDocument: 'updateLookup' }),
      onChange: (change) => io.emit('confessions-updated', change)
    },
    {
      key: 'party-game-truth-or-dare',
      label: 'party-game-truth-or-dare',
      open: () => openWatchStream(partyGameTruthOrDareDB),
      onChange: partyChangeHandler('party-game-truth-or-dare')
    },
    {
      key: 'party-game-paranoia',
      label: 'party-game-paranoia',
      open: () => openWatchStream(partyGameParanoiaDB),
      onChange: partyChangeHandler('party-game-paranoia')
    },
    {
      key: 'party-game-never-have-i-ever',
      label: 'party-game-never-have-i-ever',
      open: () => openWatchStream(partyGameNeverHaveIEverDB),
      onChange: partyChangeHandler('party-game-never-have-i-ever')
    },
    {
      key: 'party-game-most-likely-to',
      label: 'party-game-most-likely-to',
      open: () => openWatchStream(partyGameMostLikelyToDB),
      onChange: partyChangeHandler('party-game-most-likely-to')
    },
    {
      key: 'party-game-imposter',
      label: 'party-game-imposter',
      open: () => openWatchStream(partyGameImposterDB),
      onChange: partyChangeHandler('party-game-imposter')
    },
    {
      key: 'party-game-would-you-rather',
      label: 'party-game-would-you-rather',
      open: () => openWatchStream(partyGameWouldYouRatherDB),
      onChange: partyChangeHandler('party-game-would-you-rather')
    },
    {
      key: 'party-game-mafia',
      label: 'party-game-mafia',
      open: () => openWatchStream(partyGameMafiaDB),
      onChange: partyChangeHandler('party-game-mafia')
    },
    {
      key: 'party-game-chat-log',
      label: 'party-game-chat-log',
      open: () => openWatchStream(partyGameChatLogDB),
      onChange: chatLogChangeHandler
    },
    {
      key: 'waiting-room',
      label: 'waiting-room',
      open: () => openWatchStream(waitingRoomDB),
      onChange: partyChangeHandler('waiting-room')
    }
  );

  attachDbReconnectHooks();
  restartAllChangeStreams('startup');
}

// OVEREXPOSURE API
app.get('/api/confessions', async (req, res) => {
  try {
    const data = await Confession.find({});
    res.json(data);
  } catch (err) {
    console.error('❌ Failed to fetch confessions:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/confessions', async (req, res) => {
  try {
    const { title, text, id, date, userIcon, x, y, tag } = req.body;

    // 1) Generate user-facing delete code, e.g. "123-456"
    const deleteCode = generateDeleteCode();

    // 2) Hash it (Option B)
    const saltRounds = 10;
    const deleteCodeHash = await bcrypt.hash(deleteCode, saltRounds);

    // 3) Save confession with hash ONLY
    const saved = await Confession.create({
      title,
      text,
      id,
      date,
      userIcon,
      x,
      y,
      tag,
      deleteCodeHash,
    });

    // 4) Return the delete code ONCE to the client
    res.status(201).json({
      message: 'Confession saved successfully',
      confession: saved,
      deleteCode, // 👈 the plain code, not stored in DB
    });
  } catch (err) {
    console.error("❌ Error saving confession:", err);
    res.status(500).json({ error: 'Failed to save confession' });
  }
});

// Delete a confession by id + delete code
app.delete('/api/confessions/:id', async (req, res) => {
  try {
    const publicId = req.params.id;         // this is your custom 'id' like "20260109200112819"
    const { deleteCode } = req.body;

    if (!deleteCode) {
      return res.status(400).json({ error: 'Delete code is required' });
    }

    // 🔍 Find by your custom `id` field, NOT Mongo _id
    const confession = await Confession.findOne({ id: publicId });

    if (!confession || !confession.deleteCodeHash) {
      return res.status(403).json({ error: 'Invalid confession or delete code' });
    }

    const matches = await bcrypt.compare(deleteCode, confession.deleteCodeHash);
    if (!matches) {
      return res.status(403).json({ error: 'Invalid confession or delete code' });
    }

    // 🗑 Delete using the same custom id
    await Confession.deleteOne({ id: publicId });

    res.json({ success: true, message: 'Confession deleted successfully' });
  } catch (err) {
    console.error('❌ Error deleting confession:', err);
    res.status(500).json({ error: 'Failed to delete confession' });
  }
});

//WAITING ROOM
createUpsertPartyHandler({
  route: '/api/waiting-room',
  model: waitingRoomSchema,
  logLabel: 'Waiting room',
  fields: [
      'config',
      'state',
      'players'
  ]
});
createPartyGetHandler({
  route: '/api/waiting-room',
  model: waitingRoomSchema,
  logLabel: 'Waiting room'
});
createPatchPlayerHandler({
  route: '/api/waiting-room/patch-player',
  mainModel: waitingRoomSchema,
  waitingRoomModel: null,
  logLabel: 'Waiting room',
});

// OVEREXPOSED PARTY GAMES (dynamic handler registration)
const partyGameRoutes = [
  {
    route: 'party-game-truth-or-dare',
    partyGameModel: partyGameTruthOrDareSchema,
    partyGameFields: [
      'config',
      'state',
      'deck',
      'players'
    ],
    partyGameLogLabel: 'Party Game Truth Or Dare'
  },
  {
    route: 'party-game-paranoia',
    partyGameModel: partyGameParanoiaSchema,
    partyGameFields: [
      'config',
      'state',
      'deck',
      'players'
    ],
    partyGameLogLabel: 'Party Game Paranoia'
  },
  {
    route: 'party-game-never-have-i-ever',
    partyGameModel: partyGameNeverHaveIEverSchema,
    partyGameFields: [
      'config',
      'state',
      'deck',
      'players'
    ],
    partyGameLogLabel: 'Party Game Never Have I Ever'
  },
  {
    route: 'party-game-most-likely-to',
    partyGameModel: partyGameMostLikelyToSchema,
    partyGameFields: [
      'config',
      'state',
      'deck',
      'players'
    ],
    partyGameLogLabel: 'Party Game Most Likely To'
  },
    {
    route: 'party-game-imposter',
    partyGameModel: partyGameImposterSchema,
    partyGameFields: [
      'config',
      'state',
      'deck',
      'players'
    ],
    partyGameLogLabel: 'Party Game Imposter'
  },
  {
    route: 'party-game-would-you-rather',
    partyGameModel: partyGameWouldYouRatherSchema,
    partyGameFields: [
      'config',
      'state',
      'deck',
      'players'
    ],
    partyGameLogLabel: 'Party Game Would You Rather'
  },
  {
    route: 'party-game-mafia',
    partyGameModel: partyGameMafiaSchema,
    partyGameFields: [
      'config',
      'state',
      'players'
    ],
    partyGameLogLabel: 'Party Game Mafia'
  }
];

// Register generic party game routes
partyGameRoutes.forEach(({ route, partyGameModel, partyGameLogLabel, partyGameFields }) => {
  createUpsertPartyHandler({
    route: `/api/${route}`,
    model: partyGameModel,
    logLabel: partyGameLogLabel,
    fields: partyGameFields
  });

  createDeleteHandler({
    route: `/api/${route}/delete`,
    mainModel: partyGameModel,
    waitingRoomModel: waitingRoomSchema,
    logLabel: partyGameLogLabel,
  });

  createPartyActionHandler({
    route: `/api/${route}`,
    mainModel: partyGameModel,
    waitingRoomModel: waitingRoomSchema,
    logLabel: partyGameLogLabel,
    hasDeck: partyGameFields.includes('deck')
  });

  createDeleteQueryHandler({
    route: `/api/${route}`,
    mainModel: partyGameModel,
    waitingRoomModel: waitingRoomSchema,
    logLabel: partyGameLogLabel,
  });

  createRemoveUserHandler({
    route: `/api/${route}/remove-user`,
    mainModel: partyGameModel,
    waitingRoomModel: waitingRoomSchema,
    logLabel: partyGameLogLabel,
  });

  createJoinUserHandler({
    route: `/api/${route}/join-user`,
    mainModel: partyGameModel,
    waitingRoomModel: waitingRoomSchema,
    logLabel: partyGameLogLabel,
  });

  createPatchPlayerHandler({
    route: `/api/${route}/patch-player`,
    mainModel: partyGameModel,
    waitingRoomModel: waitingRoomSchema,
    logLabel: partyGameLogLabel,
  });

  createDisconnectUserHandler({
    route: `/api/${route}/disconnect-user`,
    mainModel: partyGameModel,
    waitingRoomModel: waitingRoomSchema,
    logLabel: partyGameLogLabel,
  });

  createPartyGetHandler({
    route: `/api/${route}`,
    model: partyGameModel,
    logLabel: partyGameLogLabel,
  });
});

app.post('/api/party-mafia/:partyCode([a-zA-Z0-9]{3}-[a-zA-Z0-9]{3})/chat', async (req, res) => {
  const { partyCode } = req.params;
  const { username, message, isMafia } = req.body;

  try {
    const update = isMafia
      ? { $push: { mafiaChat: { username, message } } }
      : { $push: { generalChat: { username, message } } };

    const updatedGame = await partyGameMafiaSchema.findOneAndUpdate(
      { partyId: partyCode },
      update,
      { new: true }
    );

    if (!updatedGame) {
      return res.status(404).json({ error: 'Party not found' });
    }

    res.json(updatedGame);
  } catch (err) {
    console.error('Error updating chat:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/party-qr/:partyCode([a-zA-Z0-9]{3}-[a-zA-Z0-9]{3})', async (req, res) => {
  const { partyCode } = req.params;
  const rawColor = typeof req.query.color === 'string' ? req.query.color.trim() : '';
  const safeColor = /^#[0-9A-Fa-f]{6}$/.test(rawColor) ? rawColor : '#000000';
  const joinUrl = `${req.protocol}://${req.get('host')}/${partyCode}`;

  try {
    const qrCode = new QRCodeStyling({
      jsdom: JSDOM,
      nodeCanvas,
      width: 512,
      height: 512,
      type: 'canvas',
      data: joinUrl,
      margin: 8,
      qrOptions: {
        errorCorrectionLevel: 'M'
      },
      dotsOptions: {
        color: safeColor,
        type: 'rounded'
      },
      backgroundOptions: {
        color: 'transparent'
      }
    });

    const imageBuffer = await qrCode.getRawData('png');

    // Ensure transparent background even when QR renderers flatten to white.
    const image = await nodeCanvas.loadImage(imageBuffer);
    const transparentCanvas = nodeCanvas.createCanvas(image.width, image.height);
    const transparentCtx = transparentCanvas.getContext('2d');
    transparentCtx.drawImage(image, 0, 0);

    const imageData = transparentCtx.getImageData(0, 0, image.width, image.height);
    const pixels = imageData.data;
    for (let i = 0; i < pixels.length; i += 4) {
      const r = pixels[i];
      const g = pixels[i + 1];
      const b = pixels[i + 2];
      // Remove near-white background pixels.
      if (r >= 248 && g >= 248 && b >= 248) {
        pixels[i + 3] = 0;
      }
    }
    transparentCtx.putImageData(imageData, 0, 0);
    const outputBuffer = transparentCanvas.toBuffer('image/png');

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    res.send(outputBuffer);
  } catch (err) {
    console.error(`❌ Failed to generate QR for party ${partyCode}:`, err);
    res.status(500).json({ error: 'Failed to generate QR code' });
  }
});

app.post('/api/party-code/reserve', async (req, res) => {
  try {
    const partyCode = await reserveUniquePartyCode();
    res.json({ partyCode });
  } catch (error) {
    console.error('❌ Failed to reserve unique party code:', error);
    res.status(500).json({ error: 'Failed to reserve unique party code' });
  }
});

function createDeleteHandler({ route, mainModel, waitingRoomModel, logLabel }) {
  app.post(route, async (req, res) => {
    const { partyCode } = req.body;

    if (!partyCode) {
      return res.status(400).json({ error: 'Party code is required' });
    }

    try {
      const deletedMain = await mainModel.findOneAndDelete({ partyId: partyCode });
      const deletedWaitingRoom = await waitingRoomModel.findOneAndDelete({ partyId: partyCode });

      if (!deletedMain) {
        return res.status(404).json({ error: `${logLabel} not found` });
      }

      debugLog(`✅ ${logLabel} ${partyCode} deleted via beacon`);
      res.json({ message: `${logLabel} deleted successfully`, deleted: deletedMain });
    } catch (err) {
      console.error(`❌ Error deleting ${logLabel.toLowerCase()} on unload:`, err);
      res.status(500).json({ error: `Failed to delete ${logLabel.toLowerCase()}` });
    }
  });
}

function createDeleteQueryHandler({ route, mainModel, waitingRoomModel, logLabel }) {
  app.delete(route, async (req, res) => {
    const { partyCode } = req.query;

    if (!partyCode) {
      return res.status(400).json({ error: 'Party code is required' });
    }

    try {
      const deletedMain = await mainModel.findOneAndDelete({ partyId: partyCode });
      const deletedWaitingRoom = await waitingRoomModel.findOneAndDelete({ partyId: partyCode });

      if (!deletedMain) {
        return res.status(404).json({ error: `${logLabel} not found` });
      }

      debugLog(`✅ ${logLabel} ${partyCode} deleted`);
      res.json({ message: `${logLabel} deleted successfully`, deleted: deletedMain });
    } catch (err) {
      console.error(`❌ Error deleting ${logLabel.toLowerCase()}:`, err);
      res.status(500).json({ error: `Failed to delete ${logLabel.toLowerCase()}` });
    }
  });
}

function cloneSerializable(value) {
  if (value == null) return value;
  return JSON.parse(JSON.stringify(value));
}

function getPartyConfigDoc(party) {
  if (!party.config || typeof party.config !== 'object') {
    party.config = {};
  }
  return party.config;
}

function getPartyStateDoc(party) {
  if (!party.state || typeof party.state !== 'object') {
    party.state = {};
  }
  return party.state;
}

function getPartyDeckDoc(party, { hasDeck = true } = {}) {
  if (!hasDeck) return null;
  if (!party.deck || typeof party.deck !== 'object') {
    party.deck = {};
  }
  return party.deck;
}

function getPartyPlayersDoc(party) {
  if (!Array.isArray(party.players)) {
    party.players = [];
  }
  return party.players;
}

function getPartyPlayerId(player) {
  return player?.identity?.computerId ?? player?.computerId ?? null;
}

function assertOnlinePlayerRestrictions({ gamemode, players = [] }) {
  const playerCount = Array.isArray(players) ? players.length : 0;
  const minPlayers = ONLINE_GAMEMODE_MIN_PLAYERS[gamemode] ?? null;
  const maxPlayers = ONLINE_GAMEMODE_MAX_PLAYERS[gamemode] ?? null;

  if (minPlayers != null && playerCount < minPlayers) {
    const error = new Error(`${formatGamemodeName(gamemode)} needs at least ${minPlayers} players to start.`);
    error.status = 400;
    throw error;
  }

  if (maxPlayers != null && playerCount > maxPlayers) {
    const error = new Error(`${formatGamemodeName(gamemode)} allows up to ${maxPlayers} players.`);
    error.status = 400;
    throw error;
  }
}

function getPartyPlayerState(player) {
  if (!player.state || typeof player.state !== 'object') {
    player.state = {};
  }
  return player.state;
}

function ensurePartyPlayerConnection(player) {
  if (!player.connection || typeof player.connection !== 'object') {
    player.connection = {
      socketId: player?.socketId ?? null,
      lastPing: new Date()
    };
  }
  return player.connection;
}

function getPartyInstruction(party) {
  const config = getPartyConfigDoc(party);
  const state = getPartyStateDoc(party);
  return config.userInstructions ?? state.userInstructions ?? party.userInstructions ?? '';
}

function getPartyRuleValue(config, key, fallback = null) {
  const rules = config?.gameRules;
  if (!rules) return fallback;
  if (typeof rules.get === 'function') {
    const value = rules.get(key);
    return value ?? fallback;
  }
  if (Object.prototype.hasOwnProperty.call(rules, key)) {
    return rules[key];
  }
  return fallback;
}

function getVoteCountForTarget(players, targetId) {
  return players.filter((player) => {
    const playerState = getPartyPlayerState(player);
    return playerState.vote === targetId || player.vote === targetId;
  }).length;
}

function getMostLikelyToHighestVoteValue(players) {
  const voteCounts = players.map((player) => {
    const playerId = getPartyPlayerId(player);
    return getVoteCountForTarget(players, playerId);
  });

  if (voteCounts.length === 0) return 0;

  const maxVote = Math.max(...voteCounts);
  const occurrences = voteCounts.filter(value => value === maxVote).length;
  return occurrences > 1 ? -maxVote : maxVote;
}

function getMostLikelyToHighestVotedIds(players) {
  const highestVoteValue = Math.abs(getMostLikelyToHighestVoteValue(players));

  return players
    .filter((player) => {
      const playerId = getPartyPlayerId(player);
      return getVoteCountForTarget(players, playerId) === highestVoteValue;
    })
    .map((player) => getPartyPlayerId(player))
    .filter(Boolean);
}

function getMostLikelyToEnabledPunishments(config) {
  const rules = config?.gameRules;
  const entries = rules instanceof Map
    ? Array.from(rules.entries())
    : Object.entries(rules || {});

  return entries
    .filter(([, value]) => value === true || value === 'true')
    .map(([key]) => key)
    .filter((key) => !/\d/.test(key));
}

function applyMostLikelyToRoundReset({
  workingParty,
  incrementScore = 0,
  playerIndex = null,
  nextPlayer = true,
  timer = null
}) {
  const config = getPartyConfigDoc(workingParty);
  const state = getPartyStateDoc(workingParty);
  const deck = getPartyDeckDoc(workingParty, { hasDeck: true });
  const players = getPartyPlayersDoc(workingParty);

  const playerTurn = state.playerTurn ?? 0;
  let resolvedPlayerIndex = playerIndex;

  if (resolvedPlayerIndex == null) {
    resolvedPlayerIndex = playerTurn;
  }

  if (resolvedPlayerIndex >= 0 && resolvedPlayerIndex < players.length) {
    const target = players[resolvedPlayerIndex];
    const targetState = getPartyPlayerState(target);
    targetState.score = (targetState.score ?? target.score ?? 0) + incrementScore;
    target.score = targetState.score;
  }

  deck.currentCardIndex = (deck.currentCardIndex ?? 0) + 1;

  if (nextPlayer && players.length > 0) {
    state.playerTurn = (playerTurn + 1) % players.length;
  }

  players.forEach((player) => {
    const playerState = getPartyPlayerState(player);
    playerState.isReady = false;
    playerState.hasConfirmed = false;
    playerState.vote = null;
    player.isReady = false;
    player.hasConfirmed = false;
    player.vote = null;
  });

  state.phase = null;
  state.phaseData = null;
  state.timer = timer;
  config.userInstructions = 'DISPLAY_PRIVATE_CARD';
  state.userInstructions = 'DISPLAY_PRIVATE_CARD';
  state.lastPinged = new Date();
}

function applyParanoiaRoundReset({
  workingParty,
  incrementScore = 0,
  currentPlayerIndex = null,
  nextPlayer = true,
  timer = null
}) {
  const config = getPartyConfigDoc(workingParty);
  const state = getPartyStateDoc(workingParty);
  const deck = getPartyDeckDoc(workingParty, { hasDeck: true });
  const players = getPartyPlayersDoc(workingParty);

  if (players.length === 0) return;

  const playerTurn = state.playerTurn ?? 0;
  let resolvedPlayerIndex = currentPlayerIndex;

  if (resolvedPlayerIndex == null) {
    const turnPlayer = players[playerTurn];
    const votedId = getPartyPlayerState(turnPlayer).vote ?? turnPlayer?.vote ?? null;
    if (votedId == null) {
      resolvedPlayerIndex = playerTurn;
    } else {
      const votedIndex = players.findIndex(player => getPartyPlayerId(player) === votedId);
      resolvedPlayerIndex = votedIndex === -1 ? playerTurn : votedIndex;
    }
  }

  if (resolvedPlayerIndex >= 0 && resolvedPlayerIndex < players.length) {
    const target = players[resolvedPlayerIndex];
    const targetState = getPartyPlayerState(target);
    targetState.score = (targetState.score ?? target.score ?? 0) + incrementScore;
    target.score = targetState.score;
  }

  deck.currentCardIndex = (deck.currentCardIndex ?? 0) + 1;

  if (nextPlayer && players.length > 0) {
    state.playerTurn = (playerTurn + 1) % players.length;
  }

  players.forEach((player) => {
    const playerState = getPartyPlayerState(player);
    playerState.isReady = false;
    playerState.hasConfirmed = false;
    playerState.vote = null;
    player.isReady = false;
    player.hasConfirmed = false;
    player.vote = null;
  });

  state.phase = null;
  state.phaseData = null;
  state.timer = timer;
  config.userInstructions = 'DISPLAY_PRIVATE_CARD:READING_CARD';
  state.userInstructions = 'DISPLAY_PRIVATE_CARD:READING_CARD';
  state.lastPinged = new Date();
}

function applyWouldYouRatherRoundReset({
  workingParty,
  winningVote = null,
  timer = null
}) {
  const config = getPartyConfigDoc(workingParty);
  const state = getPartyStateDoc(workingParty);
  const deck = getPartyDeckDoc(workingParty, { hasDeck: true });
  const players = getPartyPlayersDoc(workingParty);

  players.forEach((player) => {
    const playerState = getPartyPlayerState(player);
    const socketId = player.connection?.socketId ?? player.socketId;
    const vote = playerState.vote ?? player.vote ?? null;

    if (winningVote && vote === winningVote && socketId !== 'DISCONNECTED') {
      const nextScore = (playerState.score ?? player.score ?? 0) + 1;
      playerState.score = nextScore;
      player.score = nextScore;
    }

    playerState.isReady = false;
    playerState.hasConfirmed = false;
    playerState.vote = null;
    player.isReady = false;
    player.hasConfirmed = false;
    player.vote = null;
  });

  deck.currentCardIndex = (deck.currentCardIndex ?? 0) + 1;
  state.phase = null;
  state.phaseData = null;
  state.timer = timer;
  config.userInstructions = 'DISPLAY_PRIVATE_CARD';
  state.userInstructions = 'DISPLAY_PRIVATE_CARD';
  state.lastPinged = new Date();
}

function applyNeverHaveIEverRoundReset({
  workingParty,
  timer = null,
  nextPlayer = true
}) {
  const config = getPartyConfigDoc(workingParty);
  const state = getPartyStateDoc(workingParty);
  const deck = getPartyDeckDoc(workingParty, { hasDeck: true });
  const players = getPartyPlayersDoc(workingParty);

  players.forEach((player) => {
    const playerState = getPartyPlayerState(player);
    playerState.isReady = false;
    playerState.hasConfirmed = false;
    playerState.vote = null;
    player.isReady = false;
    player.hasConfirmed = false;
    player.vote = null;
  });

  deck.currentCardIndex = (deck.currentCardIndex ?? 0) + 1;

  if (nextPlayer && players.length > 0) {
    const playerTurn = state.playerTurn ?? 0;
    state.playerTurn = (playerTurn + 1) % players.length;
  }

  state.phase = null;
  state.phaseData = null;
  state.timer = timer;
  config.userInstructions = 'DISPLAY_PRIVATE_CARD';
  state.userInstructions = 'DISPLAY_PRIVATE_CARD';
  state.lastPinged = new Date();
}

function getTruthOrDareEnabledPunishments(config = {}) {
  const rules = config.gameRules instanceof Map
    ? Object.fromEntries(config.gameRules)
    : (config.gameRules || {});

  return Object.entries(rules)
    .filter(([ruleKey, value]) => {
      const isEnabled = value === true || value === 'true';
      if (!isEnabled) return false;
      if (/\d/.test(ruleKey)) return false;
      if (ruleKey === 'truth-or-dare-text-box') return false;
      return true;
    })
    .map(([ruleKey]) => ruleKey);
}

function applyTruthOrDareRoundReset({
  workingParty,
  incrementScore = 0,
  nextPlayer = true,
  timer = null
}) {
  const config = getPartyConfigDoc(workingParty);
  const state = getPartyStateDoc(workingParty);
  const players = getPartyPlayersDoc(workingParty);

  const playerTurn = state.playerTurn ?? 0;
  const currentPlayer = players[playerTurn];
  if (currentPlayer) {
    const currentPlayerState = getPartyPlayerState(currentPlayer);
    currentPlayerState.score = (currentPlayerState.score ?? currentPlayer.score ?? 0) + incrementScore;
    currentPlayer.score = currentPlayerState.score;
  }

  players.forEach((player) => {
    const playerState = getPartyPlayerState(player);
    playerState.isReady = false;
    playerState.hasConfirmed = false;
    player.isReady = false;
    player.hasConfirmed = false;
  });

  if (nextPlayer && players.length > 0) {
    state.playerTurn = ((state.playerTurn ?? 0) + 1) % players.length;
  }

  state.phase = null;
  state.phaseData = null;
  state.timer = timer;
  config.userInstructions = 'DISPLAY_SELECT_QUESTION_TYPE';
  state.userInstructions = 'DISPLAY_SELECT_QUESTION_TYPE';
  state.lastPinged = new Date();
}

function applyImposterRoundReset({
  workingParty,
  nextPlayer = true,
  timer = null,
  resetInstruction = 'DISPLAY_START_TIMER',
  alternativeQuestionIndex = null
}) {
  const config = getPartyConfigDoc(workingParty);
  const state = getPartyStateDoc(workingParty);
  const deck = getPartyDeckDoc(workingParty, { hasDeck: true });
  const players = getPartyPlayersDoc(workingParty);

  deck.currentCardIndex = (deck.currentCardIndex ?? 0) + 1;

  if (alternativeQuestionIndex !== null && alternativeQuestionIndex !== undefined) {
    deck.alternativeQuestionIndex = alternativeQuestionIndex;
  }

  if (nextPlayer && players.length > 0) {
    state.playerTurn = Math.floor(Math.random() * players.length);
  }

  state.round = 0;
  state.roundPlayerTurn = 0;

  players.forEach((player) => {
    const playerState = getPartyPlayerState(player);
    playerState.isReady = false;
    playerState.hasConfirmed = false;
    playerState.vote = null;
    player.isReady = false;
    player.hasConfirmed = false;
    player.vote = null;
  });

  state.phase = null;
  state.phaseData = null;
  state.timer = timer;
  config.userInstructions = resetInstruction;
  state.userInstructions = resetInstruction;
  state.lastPinged = new Date();
}

function getMostFrequentNonTiedVote(votes = []) {
  const counts = new Map();
  votes.filter(Boolean).forEach((vote) => {
    counts.set(vote, (counts.get(vote) ?? 0) + 1);
  });

  let maxCount = 0;
  let maxVote = '';
  let isTie = false;

  counts.forEach((count, vote) => {
    if (count > maxCount) {
      maxCount = count;
      maxVote = vote;
      isTie = false;
    } else if (count === maxCount) {
      isTie = true;
    }
  });

  return isTie ? '' : maxVote;
}

function getMafiaNightVote(players = []) {
  const mafiosoRoles = new Set(['mafioso', 'godfather']);
  const votes = players
    .filter(player => mafiosoRoles.has(getPartyPlayerState(player).role))
    .map(player => getPartyPlayerState(player).vote ?? player.vote)
    .filter(Boolean);

  return getMostFrequentNonTiedVote(votes);
}

function getMafiaTownVote(players = []) {
  const votes = players
    .filter(player => (getPartyPlayerState(player).status ?? player.status) === 'alive')
    .map(player => getPartyPlayerState(player).vote ?? player.vote)
    .filter(Boolean);

  return getMostFrequentNonTiedVote(votes);
}

function evaluateMafiaGameOver(players = []) {
  const civilianRoles = new Set(['civilian', 'mayor']);
  const mafiosoRoles = new Set(['mafioso', 'godfather']);
  const neutralRoles = new Set(['lawyer', 'serial killer']);

  const alive = players.filter(player => (getPartyPlayerState(player).status ?? player.status) === 'alive');
  const civilians = alive.filter(player => civilianRoles.has(getPartyPlayerState(player).role));
  const mafia = alive.filter(player => mafiosoRoles.has(getPartyPlayerState(player).role));
  const neutrals = alive.filter(player => neutralRoles.has(getPartyPlayerState(player).role));
  const serialKillers = alive.filter(player => getPartyPlayerState(player).role === 'serial killer');

  if (mafia.length > 0 && mafia.length >= civilians.length + neutrals.length) {
    return 'DISPLAY_GAMEOVER:MAFIOSO';
  }

  if (mafia.length === 0 && civilians.length > 0) {
    return 'DISPLAY_GAMEOVER:CIVILIAN';
  }

  if (serialKillers.length === 1 && alive.length === 1) {
    return 'DISPLAY_GAMEOVER:SERIAL_KILLER';
  }

  if (alive.length === 0) {
    return 'DISPLAY_GAMEOVER:DRAW';
  }

  return null;
}

function resetMafiaVotes(players = []) {
  players.forEach((player) => {
    const playerState = getPartyPlayerState(player);
    const status = playerState.status ?? player.status;
    if (status === 'alive') {
      playerState.vote = null;
      player.vote = null;
    }
    playerState.hasConfirmed = false;
    playerState.isReady = false;
    player.hasConfirmed = false;
    player.isReady = false;
  });
}

function mergePlayerState(basePlayer = {}, incomingPlayer = {}) {
  const mergedPlayer = {
    ...cloneSerializable(basePlayer),
    ...cloneSerializable(incomingPlayer)
  };

  mergedPlayer.identity = {
    ...(cloneSerializable(basePlayer.identity) || {}),
    ...(cloneSerializable(incomingPlayer.identity) || {})
  };
  mergedPlayer.connection = {
    ...(cloneSerializable(basePlayer.connection) || {}),
    ...(cloneSerializable(incomingPlayer.connection) || {})
  };
  mergedPlayer.state = {
    ...(cloneSerializable(basePlayer.state) || {}),
    ...(cloneSerializable(incomingPlayer.state) || {})
  };

  return mergedPlayer;
}

function applyPartyPatchesToSnapshot(workingParty, payload = {}, { hasDeck = true } = {}) {
  const config = getPartyConfigDoc(workingParty);
  const state = getPartyStateDoc(workingParty);
  const deck = getPartyDeckDoc(workingParty, { hasDeck });
  const players = getPartyPlayersDoc(workingParty);

  if (payload.configPatch && typeof payload.configPatch === 'object') {
    Object.assign(config, cloneSerializable(payload.configPatch));
  }

  if (payload.statePatch && typeof payload.statePatch === 'object') {
    Object.assign(state, cloneSerializable(payload.statePatch));
  }

  if (deck && payload.deckPatch && typeof payload.deckPatch === 'object') {
    Object.assign(deck, cloneSerializable(payload.deckPatch));
  }

  if (Array.isArray(payload.playerUpdates)) {
    const playersById = new Map();
    players.forEach((player, index) => {
      const id = getPartyPlayerId(player);
      if (id) {
        playersById.set(id, index);
      }
    });

    payload.playerUpdates.forEach((update) => {
      const updateId = update?.computerId ?? update?.identity?.computerId ?? null;
      if (!updateId) return;

      const updatePayload = cloneSerializable(update);
      delete updatePayload.computerId;

      const existingIndex = playersById.get(updateId);
      if (existingIndex === undefined) {
        const nextPlayer = mergePlayerState({ identity: { computerId: updateId } }, updatePayload);
        players.push(nextPlayer);
        playersById.set(updateId, players.length - 1);
        return;
      }

      players[existingIndex] = mergePlayerState(players[existingIndex], updatePayload);
    });
  }

  return workingParty;
}

function assertActorCanControlParty(party, actorId, allowBypass = false) {
  if (allowBypass) return;

  const state = getPartyStateDoc(party);
  const hostId = state.hostComputerId ?? null;

  if (!hostId || !actorId || String(hostId) !== String(actorId)) {
    const error = new Error('Only the host can perform this action.');
    error.status = 403;
    throw error;
  }
}

function applyPartyActionToSnapshot({
  party,
  action,
  actorId,
  payload = {},
  hasDeck = true
}) {
  const workingParty = cloneSerializable(party);
  const config = getPartyConfigDoc(workingParty);
  const state = getPartyStateDoc(workingParty);
  const deck = getPartyDeckDoc(workingParty, { hasDeck });
  const players = getPartyPlayersDoc(workingParty);
  const allowBypass = payload.byPassHost === true;
  const actorIndex = players.findIndex(player => getPartyPlayerId(player) === actorId);
  const actorPlayer = actorIndex !== -1 ? players[actorIndex] : null;

  if (actorPlayer) {
    const connection = ensurePartyPlayerConnection(actorPlayer);
    connection.lastPing = new Date();
    if (payload.socketId) {
      connection.socketId = payload.socketId;
      actorPlayer.socketId = payload.socketId;
    }
  }

  switch (action) {
    case 'start-game': {
      assertActorCanControlParty(workingParty, actorId, false);

      const gamemode = config.gamemode || workingParty.gamemode;

      if (payload.bypassPlayerRestrictions !== true) {
        assertOnlinePlayerRestrictions({ gamemode, players });
      }

      state.isPlaying = true;
      state.lastPinged = new Date();
      state.hostComputerId = state.hostComputerId ?? actorId;
      state.hostComputerIdList = players
        .map(player => getPartyPlayerId(player))
        .filter(Boolean);
      break;
    }

    case 'send-instruction': {
      assertActorCanControlParty(workingParty, actorId, allowBypass);
      applyPartyPatchesToSnapshot(workingParty, payload, { hasDeck });

      if (payload.updateUsersReady !== null && payload.updateUsersReady !== undefined) {
        players.forEach((player) => {
          const playerState = getPartyPlayerState(player);
          playerState.isReady = payload.updateUsersReady;
          player.isReady = payload.updateUsersReady;
        });
      }

      if (payload.updateUsersConfirmation !== null && payload.updateUsersConfirmation !== undefined) {
        players.forEach((player) => {
          const playerState = getPartyPlayerState(player);
          playerState.hasConfirmed = payload.updateUsersConfirmation;
          player.hasConfirmed = payload.updateUsersConfirmation;
        });
      }

      if (payload.updateUsersVote !== null && payload.updateUsersVote !== undefined) {
        players.forEach((player) => {
          const playerState = getPartyPlayerState(player);
          playerState.vote = payload.updateUsersVote;
          player.vote = payload.updateUsersVote;
        });
      }

      if (payload.timer !== null && payload.timer !== undefined) {
        state.timer = payload.timer;
      }

      const nextInstruction =
        payload.instruction == null
          ? getPartyInstruction(workingParty)
          : payload.instruction;

      if (nextInstruction != null) {
        config.userInstructions = nextInstruction;
        state.userInstructions = nextInstruction;
      }

      state.isPlaying = payload.isPlaying ?? true;
      state.lastPinged = new Date();
      break;
    }

    case 'set-user-confirmation': {
      const targetIndex = players.findIndex(
        player => getPartyPlayerId(player) === payload.selectedDeviceId
      );

      if (targetIndex === -1) {
        const error = new Error('Player not found for confirmation update.');
        error.status = 404;
        throw error;
      }

      const targetPlayer = players[targetIndex];
      const targetState = getPartyPlayerState(targetPlayer);
      const targetConnection = ensurePartyPlayerConnection(targetPlayer);

      targetState.isReady = true;
      targetState.hasConfirmed = payload.option;
      targetPlayer.isReady = true;
      targetPlayer.hasConfirmed = payload.option;
      targetConnection.lastPing = new Date();
      targetPlayer.lastPing = targetConnection.lastPing;

      if (payload.userInstruction != null) {
        const nextInstruction = `${payload.userInstruction}:${payload.reason}`;
        config.userInstructions = nextInstruction;
        state.userInstructions = nextInstruction;
      }

      state.lastPinged = new Date();
      break;
    }

    case 'set-user-bool': {
      const targetPlayer = players.find(
        player => getPartyPlayerId(player) === payload.selectedDeviceId
      );

      if (!targetPlayer) {
        const error = new Error('Player not found for state update.');
        error.status = 404;
        throw error;
      }

      const targetState = getPartyPlayerState(targetPlayer);

      if (payload.userConfirmation !== null && payload.userConfirmation !== undefined) {
        targetState.hasConfirmed = payload.userConfirmation;
        targetPlayer.hasConfirmed = payload.userConfirmation;
      }

      if (payload.userReady !== null && payload.userReady !== undefined) {
        targetState.isReady = payload.userReady;
        targetPlayer.isReady = payload.userReady;
      }

      const currentInstruction = getPartyInstruction(workingParty);
      if (payload.setInstruction == null || currentInstruction.includes(payload.setInstruction)) {
        state.lastPinged = new Date();
      }
      break;
    }

    case 'set-vote': {
      if (!actorPlayer) {
        const error = new Error('Voting player not found.');
        error.status = 404;
        throw error;
      }

      const actorState = getPartyPlayerState(actorPlayer);
      actorState.vote = payload.option;
      actorState.isReady = true;
      actorPlayer.vote = payload.option;
      actorPlayer.isReady = true;

      if (payload.hover === false) {
        actorState.hasConfirmed = true;
        actorPlayer.hasConfirmed = true;
      }

      if (payload.sendInstruction != null) {
        config.userInstructions = payload.sendInstruction;
        state.userInstructions = payload.sendInstruction;
      }

      state.lastPinged = new Date();
      break;
    }

    case 'set-bool-vote': {
      if (!actorPlayer) {
        const error = new Error('Voting player not found.');
        error.status = 404;
        throw error;
      }

      const actorState = getPartyPlayerState(actorPlayer);
      actorState.vote = payload.bool;
      actorState.hasConfirmed = true;
      actorPlayer.vote = payload.bool;
      actorPlayer.hasConfirmed = true;

      state.lastPinged = new Date();
      break;
    }

    case 'reset-question': {
      assertActorCanControlParty(workingParty, actorId, allowBypass);

      if (deck) {
        const currentCardIndex = deck.currentCardIndex ?? workingParty.currentCardIndex ?? 0;
        deck.currentCardIndex = currentCardIndex + 1;
      }

      if (state.playerTurn !== undefined && state.playerTurn !== null) {
        const currentPlayer = players[state.playerTurn];
        if (currentPlayer) {
          const currentPlayerState = getPartyPlayerState(currentPlayer);
          currentPlayerState.score = (currentPlayerState.score ?? currentPlayer.score ?? 0) + (payload.incrementScore ?? 0);
          currentPlayer.score = currentPlayerState.score;
        }
      } else if (payload.playerIndex !== null && payload.playerIndex !== undefined) {
        const selectedPlayer = players[payload.playerIndex];
        if (selectedPlayer) {
          const selectedPlayerState = getPartyPlayerState(selectedPlayer);
          selectedPlayerState.score = (selectedPlayerState.score ?? selectedPlayer.score ?? 0) + (payload.incrementScore ?? 0);
          selectedPlayer.score = selectedPlayerState.score;
        }
      }

      players.forEach((player) => {
        const playerState = getPartyPlayerState(player);
        playerState.isReady = false;
        playerState.hasConfirmed = false;
        playerState.vote = null;
        player.isReady = false;
        player.hasConfirmed = false;
        player.vote = null;
      });

      if (payload.timer !== null && payload.timer !== undefined) {
        state.timer = payload.timer;
      }

      if (payload.nextPlayer && players.length > 0 && state.playerTurn !== undefined && state.playerTurn !== null) {
        state.playerTurn = (state.playerTurn + 1) % players.length;
      }

      state.phase = null;
      state.phaseData = null;

      if (payload.instruction != null) {
        const resetInstruction =
          (config.gamemode || workingParty.gamemode) === 'paranoia' &&
          payload.nextPlayer === true &&
          String(payload.instruction).includes('DISPLAY_PRIVATE_CARD')
            ? 'DISPLAY_PRIVATE_CARD:READING_CARD'
            : payload.instruction;

        config.userInstructions = resetInstruction;
        state.userInstructions = resetInstruction;
      }

      state.lastPinged = new Date();
      break;
    }

    case 'party-restart': {
      assertActorCanControlParty(workingParty, actorId, allowBypass);

      const gamemode = config.gamemode || workingParty.gamemode;
      let restartInstruction = 'DISPLAY_PRIVATE_CARD';

      if (gamemode === 'truth-or-dare') {
        restartInstruction = 'DISPLAY_SELECT_QUESTION_TYPE';
      } else if (gamemode === 'paranoia') {
        restartInstruction = 'DISPLAY_PRIVATE_CARD:READING_CARD';
      } else if (gamemode === 'imposter') {
        restartInstruction = typeof payload.resetGamemodeInstruction === 'string' && payload.resetGamemodeInstruction
          ? payload.resetGamemodeInstruction
          : 'DISPLAY_PRIVATE_CARD';
      }

      if (deck) {
        deck.currentCardIndex = 0;
        deck.currentCardSecondIndex = 0;
        deck.alternativeQuestionIndex = 0;
        if (deck.questionType !== undefined) {
          deck.questionType = 'truth';
        }
      }

      state.isPlaying = true;
      state.playerTurn = 0;
      state.round = 0;
      state.roundPlayerTurn = 0;
      state.vote = null;
      state.lastPinged = new Date();

      const gameTimeLimit =
        Number(getPartyRuleValue(config, 'time-limit')) ||
        Number(getPartyRuleValue(config, 'imposter-time-limit')) ||
        120;

      state.timer = Date.now() + gameTimeLimit * 1000;
      config.userInstructions = restartInstruction;
      state.userInstructions = restartInstruction;

      players.forEach((player) => {
        const playerState = getPartyPlayerState(player);
        playerState.isReady = false;
        playerState.hasConfirmed = false;
        playerState.vote = null;
        playerState.score = 0;

        player.isReady = false;
        player.hasConfirmed = false;
        player.vote = null;
        player.score = 0;
      });

      break;
    }

    case 'sync-party-state': {
      applyPartyPatchesToSnapshot(workingParty, payload, { hasDeck });

      if (payload.touchState !== false) {
        state.lastPinged = new Date();
      }

      break;
    }

    case 'most-likely-to-resolve-vote-results': {
      if ((config.gamemode || workingParty.gamemode) !== 'most-likely-to') {
        const error = new Error('This action is only valid for Most Likely To.');
        error.status = 400;
        throw error;
      }

      assertActorCanControlParty(workingParty, actorId, allowBypass);

      const highestValue = getMostLikelyToHighestVoteValue(players);
      const highestVotedIds = new Set(getMostLikelyToHighestVotedIds(players));

      players.forEach((player) => {
        const playerState = getPartyPlayerState(player);
        const playerId = getPartyPlayerId(player);
        const isHighestVoted = highestVotedIds.has(playerId);
        const desiredReady = !isHighestVoted;
        const desiredConfirmed = !isHighestVoted;

        playerState.isReady = desiredReady;
        playerState.hasConfirmed = desiredConfirmed;
        player.isReady = desiredReady;
        player.hasConfirmed = desiredConfirmed;

        if (isHighestVoted && highestValue > 0) {
          const nextScore = (playerState.score ?? player.score ?? 0) + 1;
          playerState.score = nextScore;
          player.score = nextScore;
        }
      });

      state.phase = null;
      state.phaseData = null;
      state.lastPinged = new Date();
      break;
    }

    case 'most-likely-to-resolve-tiebreaker': {
      if ((config.gamemode || workingParty.gamemode) !== 'most-likely-to') {
        const error = new Error('This action is only valid for Most Likely To.');
        error.status = 400;
        throw error;
      }

      assertActorCanControlParty(workingParty, actorId, allowBypass);

      if (state.phase !== 'most-likely-to-tiebreaker') {
        state.lastPinged = new Date();
        break;
      }

      const tiedIds = Array.isArray(payload.tiedIds)
        ? payload.tiedIds.filter(Boolean)
        : [];

      if (tiedIds.length === 0) {
        const error = new Error('tiedIds is required to resolve a tie-breaker.');
        error.status = 400;
        throw error;
      }

      const chosenIndex = Math.floor(Math.random() * tiedIds.length);
      const chosenId = tiedIds[chosenIndex];
      state.phase = 'most-likely-to-choose-punishment';
      state.phaseData = {
        targetId: chosenId
      };
      state.timer = payload.timer ?? state.timer ?? null;
      state.lastPinged = new Date();
      break;
    }

    case 'never-have-i-ever-resolve-vote-results': {
      if ((config.gamemode || workingParty.gamemode) !== 'never-have-i-ever') {
        const error = new Error('This action is only valid for Never Have I Ever.');
        error.status = 400;
        throw error;
      }

      assertActorCanControlParty(workingParty, actorId, allowBypass);

      players.forEach((player) => {
        const playerState = getPartyPlayerState(player);
        const socketId = player.connection?.socketId ?? player.socketId;
        const vote = playerState.vote ?? player.vote;

        if (vote === true && socketId !== 'DISCONNECTED') {
          const nextScore = (playerState.score ?? player.score ?? 0) + 1;
          playerState.score = nextScore;
          player.score = nextScore;
        }
      });

      const haveVoteCount = players.filter(player => (getPartyPlayerState(player).vote ?? player.vote) === true).length;
      const haveNotVoteCount = players.filter(player => (getPartyPlayerState(player).vote ?? player.vote) === false).length;

      const oddManOutEnabled =
        getPartyRuleValue(config, 'odd-man-out') === true ||
        getPartyRuleValue(config, 'odd-man-out') === 'true';
      const drinkPunishmentEnabled =
        getPartyRuleValue(config, 'drink-punishment') === true ||
        getPartyRuleValue(config, 'drink-punishment') === 'true';
      const hasOddManOut =
        (haveVoteCount === 1 && haveNotVoteCount > 1) ||
        (haveNotVoteCount === 1 && haveVoteCount > 1);

      if (!(drinkPunishmentEnabled || oddManOutEnabled)) {
        applyNeverHaveIEverRoundReset({
          workingParty,
          timer: payload.roundTimer ?? null,
          nextPlayer: payload.nextPlayer ?? true
        });
        break;
      }

      if (oddManOutEnabled && hasOddManOut) {
        const oddVote = haveVoteCount === 1 ? true : false;
        const oddPlayer = players.find(player => (getPartyPlayerState(player).vote ?? player.vote) === oddVote) ?? null;
        const targetId = getPartyPlayerId(oddPlayer);

        if (!targetId) {
          applyNeverHaveIEverRoundReset({
            workingParty,
            timer: payload.roundTimer ?? null,
            nextPlayer: payload.nextPlayer ?? true
          });
          break;
        }

        players.forEach((player) => {
          const playerState = getPartyPlayerState(player);
          const playerId = getPartyPlayerId(player);
          const isTarget = String(playerId) === String(targetId);
          playerState.isReady = !isTarget;
          playerState.hasConfirmed = !isTarget;
          player.isReady = !isTarget;
          player.hasConfirmed = !isTarget;
        });

        state.phase = 'never-have-i-ever-spin-odd-man-out';
        state.phaseData = {
          targetIds: [targetId],
          punishmentType: 'DRINK_WHEEL'
        };
        state.lastPinged = new Date();
        break;
      }

      if (haveVoteCount === 0) {
        applyNeverHaveIEverRoundReset({
          workingParty,
          timer: payload.roundTimer ?? null,
          nextPlayer: payload.nextPlayer ?? true
        });
        break;
      }

      const punishedIds = players
        .filter(player => (getPartyPlayerState(player).vote ?? player.vote) === true)
        .map(player => getPartyPlayerId(player))
        .filter(Boolean);

      if (punishedIds.length === 0) {
        applyNeverHaveIEverRoundReset({
          workingParty,
          timer: payload.roundTimer ?? null,
          nextPlayer: payload.nextPlayer ?? true
        });
        break;
      }

      players.forEach((player) => {
        const playerState = getPartyPlayerState(player);
        const playerId = getPartyPlayerId(player);
        const isTarget = punishedIds.includes(playerId);
        playerState.isReady = !isTarget;
        playerState.hasConfirmed = !isTarget;
        player.isReady = !isTarget;
        player.hasConfirmed = !isTarget;
      });

      state.phase = 'never-have-i-ever-show-punishment';
      state.phaseData = {
        targetIds: punishedIds,
        punishmentType: 'TAKE_A_SIP'
      };
      state.lastPinged = new Date();
      break;
    }

    case 'never-have-i-ever-resolve-drink-wheel': {
      if ((config.gamemode || workingParty.gamemode) !== 'never-have-i-ever') {
        const error = new Error('This action is only valid for Never Have I Ever.');
        error.status = 400;
        throw error;
      }

      const targetIds = Array.isArray(state.phaseData?.targetIds)
        ? state.phaseData.targetIds.filter(Boolean)
        : [];

      if (!targetIds.includes(actorId)) {
        const error = new Error('Only the odd-man-out player can resolve the drink wheel.');
        error.status = 403;
        throw error;
      }

      const punishmentType = String(payload.punishmentType || '').trim();
      if (!punishmentType) {
        const error = new Error('punishmentType is required.');
        error.status = 400;
        throw error;
      }

      state.phase = 'never-have-i-ever-show-punishment';
      state.phaseData = {
        ...(state.phaseData || {}),
        punishmentType
      };
      state.lastPinged = new Date();
      break;
    }

    case 'never-have-i-ever-complete-punishment': {
      if ((config.gamemode || workingParty.gamemode) !== 'never-have-i-ever') {
        const error = new Error('This action is only valid for Never Have I Ever.');
        error.status = 400;
        throw error;
      }

      const targetIds = Array.isArray(state.phaseData?.targetIds)
        ? state.phaseData.targetIds.filter(Boolean)
        : [];

      if (!targetIds.includes(actorId)) {
        const error = new Error('Only punished players can complete this punishment.');
        error.status = 403;
        throw error;
      }

      const actorTarget = players.find(player => getPartyPlayerId(player) === actorId);
      if (!actorTarget) {
        const error = new Error('Punished player not found.');
        error.status = 404;
        throw error;
      }

      const actorState = getPartyPlayerState(actorTarget);
      actorState.isReady = true;
      actorState.hasConfirmed = true;
      actorTarget.isReady = true;
      actorTarget.hasConfirmed = true;

      const allReady = players.every(player => getPartyPlayerState(player).isReady === true);
      if (allReady) {
        applyNeverHaveIEverRoundReset({
          workingParty,
          timer: payload.roundTimer ?? null,
          nextPlayer: payload.nextPlayer ?? true
        });
      } else {
        state.lastPinged = new Date();
      }
      break;
    }

    case 'truth-or-dare-select-question-type': {
      if ((config.gamemode || workingParty.gamemode) !== 'truth-or-dare') {
        const error = new Error('This action is only valid for Truth or Dare.');
        error.status = 400;
        throw error;
      }

      const playerTurn = state.playerTurn ?? 0;
      const turnPlayer = players[playerTurn];
      const turnPlayerId = getPartyPlayerId(turnPlayer);

      if (!turnPlayerId || String(turnPlayerId) !== String(actorId)) {
        const error = new Error('Only the current player can choose truth or dare.');
        error.status = 403;
        throw error;
      }

      const questionType = String(payload.questionType || '').trim().toLowerCase();
      if (questionType !== 'truth' && questionType !== 'dare') {
        const error = new Error('questionType must be truth or dare.');
        error.status = 400;
        throw error;
      }

      if (questionType === 'truth') {
        deck.currentCardIndex = (deck.currentCardIndex ?? 0) + 1;
      } else {
        deck.currentCardSecondIndex = (deck.currentCardSecondIndex ?? 0) + 1;
      }

      deck.questionType = questionType;
      state.phase = null;
      state.phaseData = null;
      state.timer = payload.timer ?? state.timer ?? null;
      config.userInstructions = 'DISPLAY_PUBLIC_CARD';
      state.userInstructions = 'DISPLAY_PUBLIC_CARD';
      state.lastPinged = new Date();
      break;
    }

    case 'truth-or-dare-pass-question': {
      if ((config.gamemode || workingParty.gamemode) !== 'truth-or-dare') {
        const error = new Error('This action is only valid for Truth or Dare.');
        error.status = 400;
        throw error;
      }

      const playerTurn = state.playerTurn ?? 0;
      const turnPlayer = players[playerTurn];
      const turnPlayerId = getPartyPlayerId(turnPlayer);

      if (!turnPlayerId || String(turnPlayerId) !== String(actorId)) {
        const error = new Error('Only the current player can pass this question.');
        error.status = 403;
        throw error;
      }

      const punishmentRules = getTruthOrDareEnabledPunishments(config);
      if (punishmentRules.length === 0) {
        applyTruthOrDareRoundReset({
          workingParty,
          incrementScore: 0,
          nextPlayer: true,
          timer: payload.roundTimer ?? null
        });
      } else {
        state.phase = 'truth-or-dare-choose-punishment';
        state.phaseData = {};
        state.timer = payload.phaseTimer ?? state.timer ?? null;
        state.lastPinged = new Date();
      }
      break;
    }

    case 'truth-or-dare-select-punishment': {
      if ((config.gamemode || workingParty.gamemode) !== 'truth-or-dare') {
        const error = new Error('This action is only valid for Truth or Dare.');
        error.status = 400;
        throw error;
      }

      const playerTurn = state.playerTurn ?? 0;
      const turnPlayer = players[playerTurn];
      const turnPlayerId = getPartyPlayerId(turnPlayer);

      if (!turnPlayerId || String(turnPlayerId) !== String(actorId)) {
        const error = new Error('Only the current player can choose the punishment.');
        error.status = 403;
        throw error;
      }

      const punishmentType = String(payload.punishmentType || '').trim();
      if (!punishmentType) {
        const error = new Error('punishmentType is required.');
        error.status = 400;
        throw error;
      }

      state.phase = 'truth-or-dare-show-punishment';
      state.phaseData = { punishmentType };
      state.lastPinged = new Date();
      break;
    }

    case 'truth-or-dare-resolve-drink-wheel': {
      if ((config.gamemode || workingParty.gamemode) !== 'truth-or-dare') {
        const error = new Error('This action is only valid for Truth or Dare.');
        error.status = 400;
        throw error;
      }

      const playerTurn = state.playerTurn ?? 0;
      const turnPlayer = players[playerTurn];
      const turnPlayerId = getPartyPlayerId(turnPlayer);

      if (!turnPlayerId || String(turnPlayerId) !== String(actorId)) {
        const error = new Error('Only the current player can resolve the drink wheel.');
        error.status = 403;
        throw error;
      }

      const punishmentType = String(payload.punishmentType || '').trim();
      if (!punishmentType) {
        const error = new Error('punishmentType is required.');
        error.status = 400;
        throw error;
      }

      state.phase = 'truth-or-dare-show-punishment';
      state.phaseData = { punishmentType };
      state.lastPinged = new Date();
      break;
    }

    case 'truth-or-dare-complete-punishment': {
      if ((config.gamemode || workingParty.gamemode) !== 'truth-or-dare') {
        const error = new Error('This action is only valid for Truth or Dare.');
        error.status = 400;
        throw error;
      }

      const playerTurn = state.playerTurn ?? 0;
      const turnPlayer = players[playerTurn];
      const turnPlayerId = getPartyPlayerId(turnPlayer);

      if (!turnPlayerId || String(turnPlayerId) !== String(actorId)) {
        const error = new Error('Only the current player can complete the punishment.');
        error.status = 403;
        throw error;
      }

      applyTruthOrDareRoundReset({
        workingParty,
        incrementScore: 0,
        nextPlayer: true,
        timer: payload.roundTimer ?? null
      });
      break;
    }

    case 'truth-or-dare-handle-card-timeout': {
      if ((config.gamemode || workingParty.gamemode) !== 'truth-or-dare') {
        const error = new Error('This action is only valid for Truth or Dare.');
        error.status = 400;
        throw error;
      }

      assertActorCanControlParty(workingParty, actorId, allowBypass);

      const punishmentRules = getTruthOrDareEnabledPunishments(config);
      if (punishmentRules.length === 0) {
        applyTruthOrDareRoundReset({
          workingParty,
          incrementScore: -1,
          nextPlayer: true,
          timer: payload.roundTimer ?? null
        });
      } else {
        state.phase = 'truth-or-dare-choose-punishment';
        state.phaseData = { timedOut: true };
        state.timer = payload.phaseTimer ?? state.timer ?? null;
        state.lastPinged = new Date();
      }
      break;
    }

    case 'truth-or-dare-handle-punishment-timeout': {
      if ((config.gamemode || workingParty.gamemode) !== 'truth-or-dare') {
        const error = new Error('This action is only valid for Truth or Dare.');
        error.status = 400;
        throw error;
      }

      assertActorCanControlParty(workingParty, actorId, allowBypass);

      applyTruthOrDareRoundReset({
        workingParty,
        incrementScore: -2,
        nextPlayer: true,
        timer: payload.roundTimer ?? null
      });
      break;
    }

    case 'truth-or-dare-reset-round': {
      if ((config.gamemode || workingParty.gamemode) !== 'truth-or-dare') {
        const error = new Error('This action is only valid for Truth or Dare.');
        error.status = 400;
        throw error;
      }

      const playerTurn = state.playerTurn ?? 0;
      const turnPlayer = players[playerTurn];
      const turnPlayerId = getPartyPlayerId(turnPlayer);
      const hostId = state.hostComputerId ?? null;
      const force = payload.force === true;

      if (force) {
        if (
          (!turnPlayerId || String(turnPlayerId) !== String(actorId)) &&
          (!hostId || String(hostId) !== String(actorId))
        ) {
          const error = new Error('Only the current player or host can force-reset this round.');
          error.status = 403;
          throw error;
        }

        players.forEach((player) => {
          const playerState = getPartyPlayerState(player);
          playerState.isReady = true;
          playerState.hasConfirmed = true;
          player.isReady = true;
          player.hasConfirmed = true;
        });
      } else {
        const actorPlayer = players.find(player => getPartyPlayerId(player) === actorId);
        if (!actorPlayer) {
          const error = new Error('Player not found for round reset confirmation.');
          error.status = 404;
          throw error;
        }
        const actorState = getPartyPlayerState(actorPlayer);
        actorState.hasConfirmed = true;
        actorPlayer.hasConfirmed = true;
      }

      const allConfirmed = players.every(player => getPartyPlayerState(player).hasConfirmed === true);
      if (allConfirmed) {
        applyTruthOrDareRoundReset({
          workingParty,
          incrementScore: Number(payload.incrementScore ?? 0),
          nextPlayer: payload.nextPlayer !== false,
          timer: payload.timer ?? null
        });
      } else {
        state.lastPinged = new Date();
      }
      break;
    }

    case 'imposter-advance-answer-turn': {
      if ((config.gamemode || workingParty.gamemode) !== 'imposter') {
        const error = new Error('This action is only valid for Imposter.');
        error.status = 400;
        throw error;
      }

      const currentRoundTurn = state.roundPlayerTurn ?? 0;
      const currentSpeaker = players[currentRoundTurn];
      const currentSpeakerId = getPartyPlayerId(currentSpeaker);

      if (!currentSpeakerId || String(currentSpeakerId) !== String(actorId)) {
        const error = new Error('Only the current speaking player can advance the turn.');
        error.status = 403;
        throw error;
      }

      const playerCount = players.length;
      if (playerCount === 0) {
        const error = new Error('No players available for Imposter round advancement.');
        error.status = 400;
        throw error;
      }

      const roundsLimit = Number(payload.roundsLimit ?? 5);
      const nextRoundPlayerTurn = (currentRoundTurn + 1) % playerCount;
      const wrapped = nextRoundPlayerTurn <= currentRoundTurn;
      const nextRound = (state.round ?? 0) + (wrapped ? 1 : 0);

      if (nextRound >= roundsLimit) {
        state.round = 0;
        state.roundPlayerTurn = 0;
        state.phase = null;
        state.phaseData = null;
        state.timer = payload.timer ?? state.timer ?? null;
        config.userInstructions = 'DISPLAY_PRIVATE_CARD';
        state.userInstructions = 'DISPLAY_PRIVATE_CARD';

        players.forEach((player) => {
          const playerState = getPartyPlayerState(player);
          playerState.isReady = true;
          playerState.hasConfirmed = false;
          player.isReady = true;
          player.hasConfirmed = false;
        });
      } else {
        state.round = nextRound;
        state.roundPlayerTurn = nextRoundPlayerTurn;
      }

      state.lastPinged = new Date();
      break;
    }

    case 'imposter-resolve-vote-outcome': {
      if ((config.gamemode || workingParty.gamemode) !== 'imposter') {
        const error = new Error('This action is only valid for Imposter.');
        error.status = 400;
        throw error;
      }

      assertActorCanControlParty(workingParty, actorId, allowBypass);

      const imposterIndex = state.playerTurn ?? 0;
      const imposter = players[imposterIndex];
      const imposterId = getPartyPlayerId(imposter);

      if (!imposterId) {
        const error = new Error('Imposter player not found.');
        error.status = 404;
        throw error;
      }

      const voteCounts = new Map();
      players.forEach((player) => {
        const targetId = getPartyPlayerState(player).vote ?? player.vote ?? null;
        if (!targetId) return;
        voteCounts.set(targetId, (voteCounts.get(targetId) ?? 0) + 1);
      });

      const maxVotes = Math.max(0, ...voteCounts.values());
      const highestVotedIds = [...voteCounts.entries()]
        .filter(([, count]) => count === maxVotes)
        .map(([targetId]) => targetId);
      const imposterCaught = maxVotes > 0 && highestVotedIds.includes(imposterId) && highestVotedIds.length === 1;
      const drinkPunishmentEnabled =
        getPartyRuleValue(config, 'drink-punishment') === true ||
        getPartyRuleValue(config, 'drink-punishment') === 'true';

      if (imposterCaught && drinkPunishmentEnabled) {
        state.phase = 'imposter-choose-punishment';
        state.phaseData = {
          targetId: imposterId
        };
        state.timer = payload.phaseTimer ?? state.timer ?? null;
        state.lastPinged = new Date();
      } else {
        applyImposterRoundReset({
          workingParty,
          nextPlayer: true,
          timer: payload.roundTimer ?? null,
          resetInstruction: payload.resetInstruction ?? 'DISPLAY_START_TIMER',
          alternativeQuestionIndex: payload.alternativeQuestionIndex
        });
      }
      break;
    }

    case 'imposter-select-punishment': {
      if ((config.gamemode || workingParty.gamemode) !== 'imposter') {
        const error = new Error('This action is only valid for Imposter.');
        error.status = 400;
        throw error;
      }

      const targetId = state.phaseData?.targetId ?? null;
      if (!targetId || String(targetId) !== String(actorId)) {
        const error = new Error('Only the punished imposter can choose the punishment.');
        error.status = 403;
        throw error;
      }

      const punishmentType = String(payload.punishmentType || '').trim();
      if (!punishmentType) {
        const error = new Error('punishmentType is required.');
        error.status = 400;
        throw error;
      }

      state.phase = 'imposter-show-punishment';
      state.phaseData = {
        targetId,
        punishmentType
      };
      state.lastPinged = new Date();
      break;
    }

    case 'imposter-resolve-drink-wheel': {
      if ((config.gamemode || workingParty.gamemode) !== 'imposter') {
        const error = new Error('This action is only valid for Imposter.');
        error.status = 400;
        throw error;
      }

      const targetId = state.phaseData?.targetId ?? null;
      if (!targetId || String(targetId) !== String(actorId)) {
        const error = new Error('Only the punished imposter can resolve the drink wheel.');
        error.status = 403;
        throw error;
      }

      const punishmentType = String(payload.punishmentType || '').trim();
      if (!punishmentType) {
        const error = new Error('punishmentType is required.');
        error.status = 400;
        throw error;
      }

      state.phase = 'imposter-show-punishment';
      state.phaseData = {
        targetId,
        punishmentType
      };
      state.lastPinged = new Date();
      break;
    }

    case 'imposter-complete-punishment': {
      if ((config.gamemode || workingParty.gamemode) !== 'imposter') {
        const error = new Error('This action is only valid for Imposter.');
        error.status = 400;
        throw error;
      }

      const targetId = state.phaseData?.targetId ?? null;
      if (!targetId || String(targetId) !== String(actorId)) {
        const error = new Error('Only the punished imposter can complete the punishment.');
        error.status = 403;
        throw error;
      }

      applyImposterRoundReset({
        workingParty,
        nextPlayer: true,
        timer: payload.roundTimer ?? null,
        resetInstruction: payload.resetInstruction ?? 'DISPLAY_START_TIMER',
        alternativeQuestionIndex: payload.alternativeQuestionIndex
      });
      break;
    }

    case 'imposter-reset-round': {
      if ((config.gamemode || workingParty.gamemode) !== 'imposter') {
        const error = new Error('This action is only valid for Imposter.');
        error.status = 400;
        throw error;
      }

      const hostId = state.hostComputerId ?? null;
      if (!hostId || String(hostId) !== String(actorId)) {
        const error = new Error('Only the host can reset the Imposter round.');
        error.status = 403;
        throw error;
      }

      applyImposterRoundReset({
        workingParty,
        nextPlayer: payload.nextPlayer !== false,
        timer: payload.timer ?? null,
        resetInstruction: payload.resetInstruction ?? 'DISPLAY_START_TIMER',
        alternativeQuestionIndex: payload.alternativeQuestionIndex
      });
      break;
    }

    case 'mafia-start-game': {
      if ((config.gamemode || workingParty.gamemode) !== 'mafia') {
        const error = new Error('This action is only valid for Mafia.');
        error.status = 400;
        throw error;
      }

      assertActorCanControlParty(workingParty, actorId, allowBypass);

      const shuffledRoles = Array.isArray(payload.shuffledRoles) ? payload.shuffledRoles : [];
      if (shuffledRoles.length === 0 || shuffledRoles.length < players.length) {
        const error = new Error('shuffledRoles is required to start Mafia.');
        error.status = 400;
        throw error;
      }

      players.forEach((player, index) => {
        const playerState = getPartyPlayerState(player);
        playerState.role = shuffledRoles[index] || 'civilian';
        playerState.status = 'alive';
        playerState.vote = null;
        playerState.isReady = false;
        playerState.hasConfirmed = false;
        player.vote = null;
        player.isReady = false;
        player.hasConfirmed = false;
      });

      state.phase = 'night';
      state.timer = payload.timer ?? state.timer ?? null;
      config.userInstructions = 'DISPLAY_ROLE';
      state.userInstructions = 'DISPLAY_ROLE';
      state.lastPinged = new Date();
      break;
    }

    case 'mafia-resolve-night': {
      if ((config.gamemode || workingParty.gamemode) !== 'mafia') {
        const error = new Error('This action is only valid for Mafia.');
        error.status = 400;
        throw error;
      }

      assertActorCanControlParty(workingParty, actorId, allowBypass);

      state.phase = 'day';
      resetMafiaVotes(players);

      const mafiaVote = getMafiaNightVote(players);
      config.userInstructions = `DISPLAY_PLAYER_KILLED:${mafiaVote}`;
      state.userInstructions = `DISPLAY_PLAYER_KILLED:${mafiaVote}`;
      state.timer = payload.timer ?? state.timer ?? null;
      state.lastPinged = new Date();
      break;
    }

    case 'mafia-finish-player-killed': {
      if ((config.gamemode || workingParty.gamemode) !== 'mafia') {
        const error = new Error('This action is only valid for Mafia.');
        error.status = 400;
        throw error;
      }

      assertActorCanControlParty(workingParty, actorId, allowBypass);

      const killedId = String(payload.killedId || '').trim();
      if (killedId) {
        const killedPlayer = players.find(player => getPartyPlayerId(player) === killedId);
        if (killedPlayer) {
          const killedState = getPartyPlayerState(killedPlayer);
          killedState.status = 'dead';
          killedPlayer.status = 'dead';
        }
      }

      resetMafiaVotes(players);

      const gameOverInstruction = evaluateMafiaGameOver(players);
      if (gameOverInstruction) {
        config.userInstructions = gameOverInstruction;
        state.userInstructions = gameOverInstruction;
      } else {
        config.userInstructions = 'DISPLAY_DAY_PHASE_DISCUSSION';
        state.userInstructions = 'DISPLAY_DAY_PHASE_DISCUSSION';
        state.timer = payload.timer ?? state.timer ?? null;
      }

      state.lastPinged = new Date();
      break;
    }

    case 'mafia-resolve-day-vote': {
      if ((config.gamemode || workingParty.gamemode) !== 'mafia') {
        const error = new Error('This action is only valid for Mafia.');
        error.status = 400;
        throw error;
      }

      assertActorCanControlParty(workingParty, actorId, allowBypass);

      const townVote = getMafiaTownVote(players);
      resetMafiaVotes(players);

      config.userInstructions = `DISPLAY_TOWN_VOTE:${townVote}`;
      state.userInstructions = `DISPLAY_TOWN_VOTE:${townVote}`;
      state.timer = payload.timer ?? state.timer ?? null;
      state.lastPinged = new Date();
      break;
    }

    case 'mafia-finish-town-vote': {
      if ((config.gamemode || workingParty.gamemode) !== 'mafia') {
        const error = new Error('This action is only valid for Mafia.');
        error.status = 400;
        throw error;
      }

      assertActorCanControlParty(workingParty, actorId, allowBypass);

      const votedOutId = String(payload.votedOutId || '').trim();
      if (votedOutId) {
        const votedPlayer = players.find(player => getPartyPlayerId(player) === votedOutId);
        if (votedPlayer) {
          const votedState = getPartyPlayerState(votedPlayer);
          votedState.status = 'dead';
          votedPlayer.status = 'dead';
        }
      }

      const gameOverInstruction = evaluateMafiaGameOver(players);
      if (gameOverInstruction) {
        config.userInstructions = gameOverInstruction;
        state.userInstructions = gameOverInstruction;
      } else {
        state.phase = 'night';
        config.userInstructions = 'DISPLAY_NIGHT_PHASE';
        state.userInstructions = 'DISPLAY_NIGHT_PHASE';
        state.timer = payload.timer ?? state.timer ?? null;
      }

      state.lastPinged = new Date();
      break;
    }

    case 'would-you-rather-resolve-vote-results': {
      if ((config.gamemode || workingParty.gamemode) !== 'would-you-rather') {
        const error = new Error('This action is only valid for Would You Rather.');
        error.status = 400;
        throw error;
      }

      assertActorCanControlParty(workingParty, actorId, allowBypass);

      const aVoteCount = players.filter(player => (getPartyPlayerState(player).vote ?? player.vote) === 'A').length;
      const bVoteCount = players.filter(player => (getPartyPlayerState(player).vote ?? player.vote) === 'B').length;
      const nullVoteCount = players.filter(player => (getPartyPlayerState(player).vote ?? player.vote) == null).length;
      const winningVote =
        aVoteCount === bVoteCount
          ? null
          : aVoteCount > bVoteCount
            ? 'A'
            : 'B';

      const oddManOutEnabled =
        getPartyRuleValue(config, 'odd-man-out') === true ||
        getPartyRuleValue(config, 'odd-man-out') === 'true';
      const drinkPunishmentEnabled =
        getPartyRuleValue(config, 'drink-punishment') === true ||
        getPartyRuleValue(config, 'drink-punishment') === 'true';

      if (!drinkPunishmentEnabled) {
        applyWouldYouRatherRoundReset({
          workingParty,
          winningVote,
          timer: payload.roundTimer ?? null
        });
        break;
      }

      if (
        oddManOutEnabled &&
        (
          (aVoteCount === 1 && bVoteCount > 1) ||
          (bVoteCount === 1 && aVoteCount > 1)
        )
      ) {
        const oddVote = aVoteCount === 1 ? 'A' : 'B';
        const oddPlayer = players.find(player => (getPartyPlayerState(player).vote ?? player.vote) === oddVote) ?? null;
        const targetId = getPartyPlayerId(oddPlayer);

        if (!targetId) {
          applyWouldYouRatherRoundReset({
            workingParty,
            winningVote,
            timer: payload.roundTimer ?? null
          });
          break;
        }

        players.forEach((player) => {
          const playerState = getPartyPlayerState(player);
          const playerId = getPartyPlayerId(player);
          const isTarget = String(playerId) === String(targetId);
          playerState.isReady = !isTarget;
          playerState.hasConfirmed = !isTarget;
          player.isReady = !isTarget;
          player.hasConfirmed = !isTarget;
        });

        state.phase = 'would-you-rather-spin-odd-man-out';
        state.phaseData = {
          targetIds: [targetId],
          punishmentType: 'DRINK_WHEEL',
          winningVote
        };
        state.lastPinged = new Date();
        break;
      }

      const punishedIds = players
        .filter((player) => {
          const vote = getPartyPlayerState(player).vote ?? player.vote ?? null;
          return winningVote == null ? vote == null : vote !== winningVote;
        })
        .map(player => getPartyPlayerId(player))
        .filter(Boolean);

      if (punishedIds.length === 0) {
        applyWouldYouRatherRoundReset({
          workingParty,
          winningVote,
          timer: payload.roundTimer ?? null
        });
        break;
      }

      players.forEach((player) => {
        const playerState = getPartyPlayerState(player);
        const playerId = getPartyPlayerId(player);
        const isTarget = punishedIds.includes(playerId);
        playerState.isReady = !isTarget;
        playerState.hasConfirmed = !isTarget;
        player.isReady = !isTarget;
        player.hasConfirmed = !isTarget;
      });

      state.phase = 'would-you-rather-show-punishment';
      state.phaseData = {
        targetIds: punishedIds,
        punishmentType: 'TAKE_A_SIP',
        winningVote
      };
      state.lastPinged = new Date();
      break;
    }

    case 'would-you-rather-resolve-drink-wheel': {
      if ((config.gamemode || workingParty.gamemode) !== 'would-you-rather') {
        const error = new Error('This action is only valid for Would You Rather.');
        error.status = 400;
        throw error;
      }

      const targetIds = Array.isArray(state.phaseData?.targetIds)
        ? state.phaseData.targetIds.filter(Boolean)
        : [];

      if (!targetIds.includes(actorId)) {
        const error = new Error('Only the odd-man-out player can resolve the drink wheel.');
        error.status = 403;
        throw error;
      }

      const punishmentType = String(payload.punishmentType || '').trim();
      if (!punishmentType) {
        const error = new Error('punishmentType is required.');
        error.status = 400;
        throw error;
      }

      state.phase = 'would-you-rather-show-punishment';
      state.phaseData = {
        ...(state.phaseData || {}),
        punishmentType
      };
      state.lastPinged = new Date();
      break;
    }

    case 'would-you-rather-complete-punishment': {
      if ((config.gamemode || workingParty.gamemode) !== 'would-you-rather') {
        const error = new Error('This action is only valid for Would You Rather.');
        error.status = 400;
        throw error;
      }

      const targetIds = Array.isArray(state.phaseData?.targetIds)
        ? state.phaseData.targetIds.filter(Boolean)
        : [];
      const winningVote = state.phaseData?.winningVote ?? null;

      if (!targetIds.includes(actorId)) {
        const error = new Error('Only punished players can complete this punishment.');
        error.status = 403;
        throw error;
      }

      const actorTarget = players.find(player => getPartyPlayerId(player) === actorId);
      if (!actorTarget) {
        const error = new Error('Punished player not found.');
        error.status = 404;
        throw error;
      }

      const actorState = getPartyPlayerState(actorTarget);
      actorState.isReady = true;
      actorState.hasConfirmed = true;
      actorTarget.isReady = true;
      actorTarget.hasConfirmed = true;

      const allReady = players.every(player => getPartyPlayerState(player).isReady === true);
      if (allReady) {
        applyWouldYouRatherRoundReset({
          workingParty,
          winningVote,
          timer: payload.roundTimer ?? null
        });
      } else {
        state.lastPinged = new Date();
      }
      break;
    }

    case 'paranoia-select-target': {
      if ((config.gamemode || workingParty.gamemode) !== 'paranoia') {
        const error = new Error('This action is only valid for Paranoia.');
        error.status = 400;
        throw error;
      }

      const playerTurn = state.playerTurn ?? 0;
      const turnPlayer = players[playerTurn];
      const turnPlayerId = getPartyPlayerId(turnPlayer);

      if (!turnPlayerId || String(turnPlayerId) !== String(actorId)) {
        const error = new Error('Only the current player can select a target.');
        error.status = 403;
        throw error;
      }

      const targetId = String(payload.targetId || '').trim();
      if (!targetId) {
        const error = new Error('targetId is required.');
        error.status = 400;
        throw error;
      }

      const actorState = getPartyPlayerState(turnPlayer);
      actorState.vote = targetId;
      actorState.isReady = true;
      actorState.hasConfirmed = true;
      turnPlayer.vote = targetId;
      turnPlayer.isReady = true;
      turnPlayer.hasConfirmed = true;

      state.phase = 'paranoia-choose-punishment';
      state.phaseData = { targetId };
      state.timer = payload.phaseTimer ?? state.timer ?? null;
      state.lastPinged = new Date();
      break;
    }

    case 'paranoia-handle-card-timeout': {
      if ((config.gamemode || workingParty.gamemode) !== 'paranoia') {
        const error = new Error('This action is only valid for Paranoia.');
        error.status = 400;
        throw error;
      }

      assertActorCanControlParty(workingParty, actorId, allowBypass);

      const playerTurn = state.playerTurn ?? 0;
      const turnPlayer = players[playerTurn];
      const turnPlayerId = getPartyPlayerId(turnPlayer);

      if (!turnPlayer || !turnPlayerId) {
        const error = new Error('Current player not found for Paranoia timeout.');
        error.status = 404;
        throw error;
      }

      const turnPlayerState = getPartyPlayerState(turnPlayer);
      turnPlayerState.vote = turnPlayerId;
      turnPlayerState.isReady = true;
      turnPlayerState.hasConfirmed = true;
      turnPlayer.vote = turnPlayerId;
      turnPlayer.isReady = true;
      turnPlayer.hasConfirmed = true;

      state.phase = 'paranoia-choose-punishment';
      state.phaseData = {
        targetId: turnPlayerId
      };
      state.timer = payload.phaseTimer ?? state.timer ?? null;
      state.lastPinged = new Date();
      break;
    }

    case 'paranoia-select-punishment': {
      if ((config.gamemode || workingParty.gamemode) !== 'paranoia') {
        const error = new Error('This action is only valid for Paranoia.');
        error.status = 400;
        throw error;
      }

      const targetId = state.phaseData?.targetId ?? null;
      if (!targetId || String(targetId) !== String(actorId)) {
        const error = new Error('Only the selected player can choose the punishment.');
        error.status = 403;
        throw error;
      }

      const punishmentType = String(payload.punishmentType || '').trim();
      if (!punishmentType) {
        const error = new Error('punishmentType is required.');
        error.status = 400;
        throw error;
      }

      state.phase = 'paranoia-show-punishment';
      state.phaseData = {
        targetId,
        punishmentType
      };
      state.lastPinged = new Date();
      break;
    }

    case 'paranoia-resolve-drink-wheel': {
      if ((config.gamemode || workingParty.gamemode) !== 'paranoia') {
        const error = new Error('This action is only valid for Paranoia.');
        error.status = 400;
        throw error;
      }

      const targetId = state.phaseData?.targetId ?? null;
      if (!targetId || String(targetId) !== String(actorId)) {
        const error = new Error('Only the selected player can resolve the drink wheel.');
        error.status = 403;
        throw error;
      }

      const punishmentType = String(payload.punishmentType || '').trim();
      if (!punishmentType) {
        const error = new Error('punishmentType is required.');
        error.status = 400;
        throw error;
      }

      state.phase = 'paranoia-show-punishment';
      state.phaseData = {
        targetId,
        punishmentType
      };
      state.lastPinged = new Date();
      break;
    }

    case 'paranoia-resolve-coin-flip': {
      if ((config.gamemode || workingParty.gamemode) !== 'paranoia') {
        const error = new Error('This action is only valid for Paranoia.');
        error.status = 400;
        throw error;
      }

      const targetId = state.phaseData?.targetId ?? null;
      if (!targetId || String(targetId) !== String(actorId)) {
        const error = new Error('Only the selected player can resolve the coin flip.');
        error.status = 403;
        throw error;
      }

      if (payload.matchedFace === true) {
        state.phase = null;
        state.phaseData = {
          targetId,
          revealTargetId: targetId,
          punishmentType: 'lucky-coin-flip'
        };
        config.userInstructions = 'DISPLAY_DUAL_STACK_CARD';
        state.userInstructions = 'DISPLAY_DUAL_STACK_CARD';
      } else {
        state.phase = null;
        state.phaseData = {
          targetId,
          punishmentType: 'lucky-coin-flip',
          completionReason: 'USER_CALLED_WRONG_FACE'
        };
        config.userInstructions = 'USER_HAS_PASSED:USER_CALLED_WRONG_FACE';
        state.userInstructions = 'USER_HAS_PASSED:USER_CALLED_WRONG_FACE';
      }

      state.lastPinged = new Date();
      break;
    }

    case 'paranoia-begin-punishment-confirmation': {
      if ((config.gamemode || workingParty.gamemode) !== 'paranoia') {
        const error = new Error('This action is only valid for Paranoia.');
        error.status = 400;
        throw error;
      }

      const targetId = state.phaseData?.targetId ?? null;
      const punishmentType = state.phaseData?.punishmentType ?? null;

      if (!targetId || String(targetId) !== String(actorId)) {
        const error = new Error('Only the selected player can start punishment confirmation.');
        error.status = 403;
        throw error;
      }

      players.forEach((player) => {
        const playerState = getPartyPlayerState(player);
        playerState.isReady = false;
        playerState.hasConfirmed = false;
        player.isReady = false;
        player.hasConfirmed = false;
      });

      const targetPlayer = players.find(player => getPartyPlayerId(player) === targetId);
      if (targetPlayer) {
        const targetState = getPartyPlayerState(targetPlayer);
        targetState.isReady = true;
        targetState.hasConfirmed = true;
        targetPlayer.isReady = true;
        targetPlayer.hasConfirmed = true;
      }

      state.phase = 'paranoia-confirm-punishment';
      state.phaseData = {
        targetId,
        punishmentType,
        completionReason: payload.completionReason ?? punishmentType
      };
      state.lastPinged = new Date();
      break;
    }

    case 'paranoia-submit-punishment-vote': {
      if ((config.gamemode || workingParty.gamemode) !== 'paranoia') {
        const error = new Error('This action is only valid for Paranoia.');
        error.status = 400;
        throw error;
      }

      if (state.phase !== 'paranoia-confirm-punishment') {
        const error = new Error('Paranoia is not currently confirming a punishment.');
        error.status = 409;
        throw error;
      }

      const targetId = state.phaseData?.targetId ?? null;
      const completionReason = state.phaseData?.completionReason ?? null;
      const actorPlayer = players.find(player => getPartyPlayerId(player) === actorId);

      if (!actorPlayer) {
        const error = new Error('Voting player not found.');
        error.status = 404;
        throw error;
      }

      if (String(actorId) === String(targetId)) {
        const error = new Error('Selected player cannot submit confirmation votes here.');
        error.status = 403;
        throw error;
      }

      const actorState = getPartyPlayerState(actorPlayer);
      actorState.isReady = true;
      actorState.hasConfirmed = Boolean(payload.option);
      actorPlayer.isReady = true;
      actorPlayer.hasConfirmed = Boolean(payload.option);

      const totalUsersReady = players.filter(player => getPartyPlayerState(player).isReady === true).length;

      if (totalUsersReady === players.length) {
        const yesVoteCount = players.filter(player => getPartyPlayerState(player).hasConfirmed === true).length;
        const noVoteCount = players.filter(player => getPartyPlayerState(player).hasConfirmed === false).length;

        if (noVoteCount < yesVoteCount) {
          if (completionReason === 'QUESTION') {
            applyParanoiaRoundReset({
              workingParty,
              incrementScore: 1,
              nextPlayer: true,
              timer: payload.roundTimer ?? null
            });
          } else {
            players.forEach((player) => {
              const playerState = getPartyPlayerState(player);
              playerState.isReady = false;
              playerState.hasConfirmed = false;
              player.isReady = false;
              player.hasConfirmed = false;
            });

            state.phase = null;
            state.phaseData = null;
            config.userInstructions = 'NEXT_QUESTION';
            state.userInstructions = 'NEXT_QUESTION';
            state.lastPinged = new Date();
          }
        } else {
          state.phase = null;
          state.phaseData = null;
          config.userInstructions = 'USER_HAS_PASSED:USER_DIDNT_DO_PUNISHMENT';
          state.userInstructions = 'USER_HAS_PASSED:USER_DIDNT_DO_PUNISHMENT';
          state.lastPinged = new Date();
        }
      } else {
        state.lastPinged = new Date();
      }
      break;
    }

    case 'paranoia-pass-punishment': {
      if ((config.gamemode || workingParty.gamemode) !== 'paranoia') {
        const error = new Error('This action is only valid for Paranoia.');
        error.status = 400;
        throw error;
      }

      const playerTurn = state.playerTurn ?? 0;
      const turnPlayer = players[playerTurn];
      const turnPlayerId = getPartyPlayerId(turnPlayer);
      const targetId = state.phaseData?.targetId ?? turnPlayerId ?? null;

      if (!targetId || String(targetId) !== String(actorId)) {
        const error = new Error('Only the selected player can pass the punishment.');
        error.status = 403;
        throw error;
      }

      if (turnPlayerId && String(turnPlayerId) === String(actorId)) {
        applyParanoiaRoundReset({
          workingParty,
          currentPlayerIndex: playerTurn,
          incrementScore: -2,
          nextPlayer: true,
          timer: payload.roundTimer ?? null
        });
      } else {
        state.phase = null;
        state.phaseData = null;
        config.userInstructions = 'USER_HAS_PASSED:USER_PASSED_PUNISHMENT';
        state.userInstructions = 'USER_HAS_PASSED:USER_PASSED_PUNISHMENT';
        state.lastPinged = new Date();
      }
      break;
    }

    case 'paranoia-handle-phase-timeout': {
      if ((config.gamemode || workingParty.gamemode) !== 'paranoia') {
        const error = new Error('This action is only valid for Paranoia.');
        error.status = 400;
        throw error;
      }

      assertActorCanControlParty(workingParty, actorId, allowBypass);

      if (state.phase === 'paranoia-choose-punishment') {
        const targetId = state.phaseData?.targetId ?? null;
        const targetIndex = players.findIndex(player => getPartyPlayerId(player) === targetId);

        applyParanoiaRoundReset({
          workingParty,
          currentPlayerIndex: targetIndex === -1 ? null : targetIndex,
          incrementScore: -2,
          nextPlayer: true,
          timer: payload.roundTimer ?? null
        });
      } else {
        state.lastPinged = new Date();
      }
      break;
    }

    case 'most-likely-to-advance-from-results': {
      if ((config.gamemode || workingParty.gamemode) !== 'most-likely-to') {
        const error = new Error('This action is only valid for Most Likely To.');
        error.status = 400;
        throw error;
      }

      assertActorCanControlParty(workingParty, actorId, allowBypass);

      const highestValue = getMostLikelyToHighestVoteValue(players);
      const highestVotedIds = getMostLikelyToHighestVotedIds(players);
      const enabledPunishments = getMostLikelyToEnabledPunishments(config);

      if (enabledPunishments.length === 0 || highestValue === 0) {
        applyMostLikelyToRoundReset({
          workingParty,
          timer: payload.roundTimer ?? null
        });
        break;
      }

      if (highestValue < 0) {
        players.forEach((player) => {
          const playerId = getPartyPlayerId(player);
          const playerState = getPartyPlayerState(player);
          const isTiedPlayer = highestVotedIds.includes(playerId);

          playerState.vote = null;
          player.vote = null;
          playerState.isReady = false;
          player.isReady = false;
          playerState.hasConfirmed = !isTiedPlayer;
          player.hasConfirmed = !isTiedPlayer;
        });

        state.phase = 'most-likely-to-tiebreaker';
        state.phaseData = {
          tiedIds: highestVotedIds
        };
        state.timer = payload.phaseTimer ?? state.timer ?? null;
        state.lastPinged = new Date();
        break;
      }

      state.phase = 'most-likely-to-choose-punishment';
      state.phaseData = {
        targetId: highestVotedIds[0] ?? null
      };
      state.timer = payload.phaseTimer ?? state.timer ?? null;
      state.lastPinged = new Date();
      break;
    }

    case 'most-likely-to-select-punishment': {
      if ((config.gamemode || workingParty.gamemode) !== 'most-likely-to') {
        const error = new Error('This action is only valid for Most Likely To.');
        error.status = 400;
        throw error;
      }

      const phase = state.phase;
      const phaseData = state.phaseData || {};
      const targetId = phaseData.targetId ?? null;

      if (phase !== 'most-likely-to-choose-punishment' || !targetId) {
        const error = new Error('Most Likely To is not currently choosing a punishment.');
        error.status = 409;
        throw error;
      }

      if (!actorId || String(actorId) !== String(targetId)) {
        const error = new Error('Only the selected player can choose the punishment.');
        error.status = 403;
        throw error;
      }

      const punishmentType = String(payload.punishmentType || '').trim();
      if (!punishmentType) {
        const error = new Error('punishmentType is required.');
        error.status = 400;
        throw error;
      }

      state.phase = 'most-likely-to-show-punishment';
      state.phaseData = {
        targetId,
        punishmentType
      };
      state.timer = payload.phaseTimer ?? state.timer ?? null;
      state.lastPinged = new Date();
      break;
    }

    case 'most-likely-to-resolve-drink-wheel': {
      if ((config.gamemode || workingParty.gamemode) !== 'most-likely-to') {
        const error = new Error('This action is only valid for Most Likely To.');
        error.status = 400;
        throw error;
      }

      const phase = state.phase;
      const phaseData = state.phaseData || {};
      const targetId = phaseData.targetId ?? null;

      if (phase !== 'most-likely-to-show-punishment' || !targetId) {
        const error = new Error('Most Likely To is not currently resolving a punishment.');
        error.status = 409;
        throw error;
      }

      if (!actorId || String(actorId) !== String(targetId)) {
        const error = new Error('Only the selected player can resolve the drink wheel.');
        error.status = 403;
        throw error;
      }

      const punishmentType = String(payload.punishmentType || '').trim();
      if (!punishmentType) {
        const error = new Error('punishmentType is required.');
        error.status = 400;
        throw error;
      }

      state.phaseData = {
        ...phaseData,
        targetId,
        punishmentType
      };
      state.lastPinged = new Date();
      break;
    }

    case 'most-likely-to-complete-punishment': {
      if ((config.gamemode || workingParty.gamemode) !== 'most-likely-to') {
        const error = new Error('This action is only valid for Most Likely To.');
        error.status = 400;
        throw error;
      }

      const phase = state.phase;
      const phaseData = state.phaseData || {};
      const targetId = phaseData.targetId ?? null;

      if (phase !== 'most-likely-to-show-punishment' || !targetId) {
        const error = new Error('Most Likely To is not currently resolving a punishment.');
        error.status = 409;
        throw error;
      }

      if (!actorId || String(actorId) !== String(targetId)) {
        const error = new Error('Only the selected player can complete the punishment.');
        error.status = 403;
        throw error;
      }

      applyMostLikelyToRoundReset({
        workingParty,
        timer: payload.roundTimer ?? null
      });
      break;
    }

    case 'most-likely-to-handle-phase-timeout': {
      if ((config.gamemode || workingParty.gamemode) !== 'most-likely-to') {
        const error = new Error('This action is only valid for Most Likely To.');
        error.status = 400;
        throw error;
      }

      assertActorCanControlParty(workingParty, actorId, allowBypass);

      if (state.phase === 'most-likely-to-tiebreaker') {
        const tiedIds = Array.isArray(state.phaseData?.tiedIds)
          ? state.phaseData.tiedIds.filter(Boolean)
          : [];

        if (tiedIds.length === 0) {
          applyMostLikelyToRoundReset({
            workingParty,
            timer: payload.roundTimer ?? null
          });
          break;
        }

        state.phase = 'most-likely-to-choose-punishment';
        state.phaseData = {
          targetId: tiedIds[0]
        };
        state.timer = payload.phaseTimer ?? state.timer ?? null;
        state.lastPinged = new Date();
        break;
      }

      if (state.phase === 'most-likely-to-choose-punishment') {
        const targetId = state.phaseData?.targetId ?? null;
        const targetIndex = players.findIndex(player => getPartyPlayerId(player) === targetId);

        applyMostLikelyToRoundReset({
          workingParty,
          playerIndex: targetIndex === -1 ? null : targetIndex,
          incrementScore: -2,
          nextPlayer: false,
          timer: payload.roundTimer ?? null
        });
        break;
      }

      state.lastPinged = new Date();
      break;
    }

    default: {
      const error = new Error(`Unknown party action: ${action}`);
      error.status = 400;
      throw error;
    }
  }

  return workingParty;
}

function createPartyActionHandler({ route, mainModel, waitingRoomModel, logLabel, hasDeck }) {
  app.post(`${route}/action`, async (req, res) => {
    try {
      const partyId = req.body.partyId || req.query.partyCode;
      const { action, actorId, payload = {} } = req.body;

      if (!partyId) {
        return res.status(400).json({ error: 'partyId is required' });
      }

      if (!action) {
        return res.status(400).json({ error: 'action is required' });
      }

      const existingParty = await mainModel.findOne({ partyId }).lean();
      if (!existingParty) {
        return res.status(404).json({ error: `${logLabel} not found` });
      }

      const updatedPartySnapshot = applyPartyActionToSnapshot({
        party: existingParty,
        action,
        actorId,
        payload,
        hasDeck
      });

      const updateData = {
        config: updatedPartySnapshot.config,
        state: updatedPartySnapshot.state,
        players: updatedPartySnapshot.players
      };

      if (hasDeck) {
        updateData.deck = updatedPartySnapshot.deck;
      }

      const [updatedParty] = await Promise.all([
        mainModel.findOneAndUpdate(
          { partyId },
          updateData,
          { new: true }
        ),
        waitingRoomModel.findOneAndUpdate(
          { partyId },
          {
            config: updatedPartySnapshot.config,
            state: updatedPartySnapshot.state,
            players: updatedPartySnapshot.players
          },
          {
            new: true,
            upsert: true
          }
        )
      ]);

      res.json({
        message: `${logLabel} action applied successfully`,
        updated: updatedParty
      });
    } catch (err) {
      const status = Number.isInteger(err.status) ? err.status : 500;
      console.error(`❌ Error applying ${logLabel.toLowerCase()} action:`, err);
      res.status(status).json({ error: err.message || `Failed to apply ${logLabel.toLowerCase()} action` });
    }
  });
}

function createUpsertPartyHandler({ route, model, logLabel, fields }) {
  app.post(route, async (req, res) => {
    try {
      const { partyId } = req.body;

      if (!partyId) {
        return res.status(400).json({ error: 'partyId is required' });
      }

      // Build the update object dynamically from allowed fields
      const updateData = {};
      for (const field of fields) {
        if (req.body.hasOwnProperty(field)) {
          updateData[field] = req.body[field];
        }
      }

      const shouldCheckExistingParty =
        updateData.state?.isPlaying === true ||
        updateData.state?.hostComputerId !== undefined ||
        updateData.state?.hostComputerIdList !== undefined;
      const existingParty = shouldCheckExistingParty
        ? await model.findOne({ partyId }).lean()
        : null;

      if (existingParty && updateData.state && typeof updateData.state === 'object') {
        updateData.state = {
          ...updateData.state,
          hostComputerId: existingParty.state?.hostComputerId ?? null,
          hostComputerIdList: Array.isArray(existingParty.state?.hostComputerIdList)
            ? existingParty.state.hostComputerIdList
            : []
        };
      }

      if (updateData.state?.isPlaying === true && req.body.bypassPlayerRestrictions !== true) {
        const gamemode =
          updateData.config?.gamemode ??
          existingParty?.config?.gamemode ??
          existingParty?.gamemode;
        const players = Array.isArray(updateData.players)
          ? updateData.players
          : existingParty?.players;

        assertOnlinePlayerRestrictions({ gamemode, players });
      }

      const updated = await model.findOneAndUpdate(
        { partyId },
        updateData,
        {
          new: true,
          upsert: true,
        }
      );

      res.json({ message: `${logLabel} updated or created successfully`, updated });
    } catch (err) {
      console.error(`❌ Error saving/updating ${logLabel.toLowerCase()}:`, err);
      const status = Number.isInteger(err.status) ? err.status : 500;
      res.status(status).json({ error: err.message || `Failed to save/update ${logLabel.toLowerCase()}` });
    }
  });
}

const partyJoinLocks = new Map();

async function withPartyJoinLock(partyId, task) {
  const previous = partyJoinLocks.get(partyId) || Promise.resolve();
  const current = previous.catch(() => {}).then(task);
  const stored = current.catch(() => {});

  partyJoinLocks.set(partyId, stored);

  try {
    return await current;
  } finally {
    if (partyJoinLocks.get(partyId) === stored) {
      partyJoinLocks.delete(partyId);
    }
  }
}

function getSocketPartyMembershipKey(partyId, computerId) {
  return `${partyId}:${computerId}`;
}

function rememberSocketPartyMembership({ socketId, partyId, computerId, mainModel, waitingRoomModel, logLabel }) {
  if (!socketId || socketId === "DISCONNECTED" || !partyId || !computerId || !mainModel) {
    return;
  }

  const memberships = socketPartyMemberships.get(socketId) || new Map();
  memberships.set(getSocketPartyMembershipKey(partyId, computerId), {
    partyId,
    computerId,
    mainModel,
    waitingRoomModel,
    logLabel
  });
  socketPartyMemberships.set(socketId, memberships);
}

function forgetSocketPartyMembership(socketId, partyId, computerId) {
  if (!socketId) return;

  const memberships = socketPartyMemberships.get(socketId);
  if (!memberships) return;

  memberships.delete(getSocketPartyMembershipKey(partyId, computerId));

  if (memberships.size === 0) {
    socketPartyMemberships.delete(socketId);
  }
}

function isSocketIdActive(socketId) {
  return Boolean(socketId && socketId !== "DISCONNECTED" && io.sockets.sockets.get(socketId));
}

function getPlayerConnectionSocketId(player) {
  return player?.connection?.socketId ?? player?.socketId ?? null;
}

function getLiveHostCandidate({ session, ignoreComputerId = null }) {
  const state = session.state;
  const players = Array.isArray(session.players) ? session.players : [];
  const playerIds = players
    .map(player => getPartyPlayerId(player))
    .filter(Boolean);
  const currentHostId = state?.hostComputerId ?? null;
  const fallbackHostList = currentHostId
    ? [
        currentHostId,
        ...playerIds.filter(playerId => String(playerId) !== String(currentHostId))
      ]
    : playerIds;
  const rawHostList = Array.isArray(state?.hostComputerIdList) && state.hostComputerIdList.length > 0
    ? state.hostComputerIdList
    : fallbackHostList;
  const hostList = rawHostList.filter(candidateComputerId =>
    players.some(player => String(getPartyPlayerId(player)) === String(candidateComputerId))
  );

  for (const candidateComputerId of hostList) {
    if (ignoreComputerId && String(candidateComputerId) === String(ignoreComputerId)) {
      continue;
    }

    const candidate = players.find(
      player => String(getPartyPlayerId(player)) === String(candidateComputerId)
    );

    if (candidate && isSocketIdActive(getPlayerConnectionSocketId(candidate))) {
      return { candidateComputerId, candidate, hostList };
    }
  }

  return { candidateComputerId: null, candidate: null, hostList };
}

async function syncWaitingRoomHostState({ waitingRoomModel, partyId, state }) {
  if (!waitingRoomModel || !partyId || !state) return;

  await waitingRoomModel.findOneAndUpdate(
    { partyId },
    {
      $set: {
        'state.hostComputerId': state.hostComputerId ?? null,
        'state.hostComputerIdList': Array.isArray(state.hostComputerIdList)
          ? state.hostComputerIdList
          : [],
        'state.lastPinged': new Date()
      }
    }
  );
}

function appendHostChangedChat(chatLogSession, previousHostId, newHostPlayer) {
  if (!chatLogSession || !newHostPlayer) return;

  const newHostId = getPartyPlayerId(newHostPlayer);
  if (String(newHostId) === String(previousHostId)) return;

  const username = newHostPlayer.identity?.username || newHostPlayer.username;
  if (!username) return;

  chatLogSession.chat.push({
    username: "[CONSOLE]",
    message: `${username} is now the host.`,
    eventType: "connect",
  });
}

async function repairPartyHost({ session, waitingRoomModel, chatLogSession, ignoreComputerId = null }) {
  const state = session.state;
  if (!state) return null;

  const previousHostId = state.hostComputerId ?? null;
  const { candidateComputerId, candidate, hostList } = getLiveHostCandidate({
    session,
    ignoreComputerId
  });

  state.hostComputerIdList = hostList;
  state.hostComputerId = candidateComputerId ?? null;
  state.lastPinged = new Date();

  appendHostChangedChat(chatLogSession, previousHostId, candidate);
  await syncWaitingRoomHostState({
    waitingRoomModel,
    partyId: session.partyId,
    state
  });

  return state.hostComputerId;
}

async function repairPartyHostForParty({ partyId, mainModel, waitingRoomModel, chatLogSession, ignoreComputerId = null }) {
  const session = await mainModel.findOne({ partyId });
  if (!session) return null;

  await repairPartyHost({
    session,
    waitingRoomModel,
    chatLogSession,
    ignoreComputerId
  });

  await session.save();
  return session.toObject ? session.toObject() : session;
}

async function disconnectPartyPlayer({ partyId, computerId, mainModel, waitingRoomModel, logLabel, socketId = null, writeChat = true }) {
  return withPartyJoinLock(partyId, async () => {
    const session = await mainModel.findOne({ partyId });
    if (!session) {
      debugWarn(`Unable to disconnect ${computerId}; ${logLabel} ${partyId} was not found.`);
      return null;
    }

    const player = session.players.find(
      partyPlayer => String(getPartyPlayerId(partyPlayer)) === String(computerId)
    );

    if (!player) {
      debugWarn(`Unable to disconnect ${computerId}; player was not found in ${logLabel} ${partyId}.`);
      return null;
    }

    const currentSocketId = getPlayerConnectionSocketId(player);
    if (currentSocketId === "DISCONNECTED") {
      forgetSocketPartyMembership(socketId, partyId, computerId);
      return session.toObject ? session.toObject() : session;
    }

    if (socketId && currentSocketId && currentSocketId !== "DISCONNECTED" && String(currentSocketId) !== String(socketId)) {
      forgetSocketPartyMembership(socketId, partyId, computerId);
      return session.toObject ? session.toObject() : session;
    }

    if (!player.connection) {
      player.connection = {};
    }
    player.connection.socketId = "DISCONNECTED";
    player.connection.lastPing = new Date();
    player.socketId = "DISCONNECTED";

    if (session.state) {
      session.state.lastPinged = new Date();
    } else {
      session.lastPinged = new Date();
    }

    const waitingRoomSession = waitingRoomModel
      ? await waitingRoomModel.findOne({ partyId })
      : null;
    if (waitingRoomSession) {
      const waitingPlayer = waitingRoomSession.players.find(
        partyPlayer => String(getPartyPlayerId(partyPlayer)) === String(computerId)
      );
      if (waitingPlayer) {
        if (!waitingPlayer.connection) {
          waitingPlayer.connection = {};
        }
        waitingPlayer.connection.socketId = "DISCONNECTED";
        waitingPlayer.connection.lastPing = new Date();
        waitingPlayer.socketId = "DISCONNECTED";
        waitingRoomSession.state = waitingRoomSession.state || {
          isPlaying: Boolean(session.state?.isPlaying)
        };
        waitingRoomSession.state.lastPinged = new Date();
        await waitingRoomSession.save();
      }
    }

    const chatLogSession = writeChat
      ? await partyGameChatLogSchema.findOne({ partyId })
      : null;

    if (chatLogSession) {
      chatLogSession.chat.push({
        username: "[CONSOLE]",
        message: `${player.identity?.username || player.username || "A player"} has been disconnected.`,
        eventType: "disconnect",
      });
    }

    await repairPartyHost({
      session,
      waitingRoomModel,
      chatLogSession,
      ignoreComputerId: computerId
    });

    await session.save();
    if (chatLogSession) {
      await chatLogSession.save();
    }

    forgetSocketPartyMembership(currentSocketId, partyId, computerId);
    if (socketId && socketId !== currentSocketId) {
      forgetSocketPartyMembership(socketId, partyId, computerId);
    }

    return session.toObject ? session.toObject() : session;
  });
}

async function disconnectSocketPartyMemberships(socketId) {
  const memberships = socketPartyMemberships.get(socketId);
  if (!memberships) return;

  socketPartyMemberships.delete(socketId);

  await Promise.all(
    Array.from(memberships.values()).map(membership =>
      disconnectPartyPlayer({
        ...membership,
        socketId,
        writeChat: true
      }).catch((error) => {
        console.error(`❌ Failed to disconnect socket ${socketId} from ${membership.partyId}:`, error);
      })
    )
  );
}

function mergePartyPlayer(existing = {}, incoming = {}) {
  return {
    ...existing,
    ...incoming,
    identity: {
      ...(existing.identity || {}),
      ...(incoming.identity || {})
    },
    connection: {
      ...(existing.connection || {}),
      ...(incoming.connection || {})
    },
    state: {
      ...(existing.state || {}),
      ...(incoming.state || {})
    }
  };
}

function upsertPartyPlayer(players, incomingPlayer) {
  const incomingPlayerId = getPartyPlayerId(incomingPlayer);
  const nextPlayers = [];
  let mergedPlayer = null;
  let mergedPlayerIndex = -1;

  for (const player of players || []) {
    if (getPartyPlayerId(player) !== incomingPlayerId) {
      nextPlayers.push(player);
      continue;
    }

    mergedPlayer = mergePartyPlayer(mergedPlayer || player, player);

    if (mergedPlayerIndex === -1) {
      mergedPlayerIndex = nextPlayers.length;
      nextPlayers.push(null);
    }
  }

  if (mergedPlayerIndex === -1) {
    nextPlayers.push(incomingPlayer);
  } else {
    nextPlayers[mergedPlayerIndex] = mergePartyPlayer(mergedPlayer, incomingPlayer);
  }

  return nextPlayers;
}

function buildJoinPlayerFromBody(body = {}) {
  const identity = body.identity || {};
  const connection = body.connection || {};
  const state = body.state || {};
  const computerId = body.computerId ?? body.newComputerId ?? identity.computerId;
  const username = body.username ?? body.newUsername ?? identity.username;
  const userIcon = body.userIcon ?? body.newUserIcon ?? identity.userIcon;
  const socketId = body.socketId ?? body.newUserSocketId ?? connection.socketId;
  const isReady = body.isReady ?? body.newUserReady ?? state.isReady;
  const hasConfirmed = body.hasConfirmed ?? body.newUserConfirmation ?? state.hasConfirmed;
  const score = body.score ?? body.newScore ?? state.score;
  const nextState = {
    ...state
  };

  if (isReady !== undefined) {
    nextState.isReady = isReady;
  }

  if (hasConfirmed !== undefined) {
    nextState.hasConfirmed = hasConfirmed;
  }

  if (score !== undefined) {
    nextState.score = score;
  }

  return {
    identity: {
      computerId,
      ...(username !== undefined ? { username } : {}),
      ...(userIcon !== undefined ? { userIcon } : {})
    },
    connection: {
      ...(socketId !== undefined ? { socketId } : {}),
      lastPing: new Date()
    },
    state: nextState
  };
}

function isPlainPatchObject(value) {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    !(value instanceof Date)
  );
}

function addNestedPlayerPatch(set, path, value) {
  if (value === undefined) {
    return;
  }

  if (isPlainPatchObject(value)) {
    Object.entries(value).forEach(([key, nestedValue]) => {
      addNestedPlayerPatch(set, `${path}.${key}`, nestedValue);
    });
    return;
  }

  set[`players.$.${path}`] = value;
}

function buildPlayerPatchFromBody(body = {}) {
  const identityPatch = body.identityPatch || body.identity || {};
  const connectionPatch = body.connectionPatch || body.connection || {};
  const statePatch = body.statePatch || body.state || {};
  const fullPlayerPatch = body.playerPatch || body.player || {};
  const set = {};

  if (isPlainPatchObject(fullPlayerPatch.identity)) {
    Object.entries(fullPlayerPatch.identity).forEach(([key, value]) => {
      if (key === 'computerId') return;
      addNestedPlayerPatch(set, `identity.${key}`, value);
    });
  }

  if (isPlainPatchObject(fullPlayerPatch.connection)) {
    Object.entries(fullPlayerPatch.connection).forEach(([key, value]) => {
      addNestedPlayerPatch(set, `connection.${key}`, value);
    });
  }

  if (isPlainPatchObject(fullPlayerPatch.state)) {
    Object.entries(fullPlayerPatch.state).forEach(([key, value]) => {
      addNestedPlayerPatch(set, `state.${key}`, value);
    });
  }

  const username = body.username ?? body.newUsername ?? identityPatch.username;
  const userIcon = body.userIcon ?? body.newUserIcon ?? identityPatch.userIcon;
  const socketId = body.socketId ?? body.newUserSocketId ?? connectionPatch.socketId;
  const isReady = body.isReady ?? body.newUserReady ?? statePatch.isReady;
  const hasConfirmed = body.hasConfirmed ?? body.newUserConfirmation ?? statePatch.hasConfirmed;
  const score = body.score ?? body.newScore ?? statePatch.score;
  const vote = body.vote ?? body.newVote ?? statePatch.vote;
  const status = body.status ?? body.newStatus ?? statePatch.status;
  const role = body.role ?? body.newRole ?? statePatch.role;

  if (username !== undefined) {
    set['players.$.identity.username'] = username;
  }

  if (userIcon !== undefined) {
    set['players.$.identity.userIcon'] = userIcon;
  }

  if (socketId !== undefined) {
    set['players.$.connection.socketId'] = socketId;
  }

  if (isReady !== undefined) {
    set['players.$.state.isReady'] = isReady;
  }

  if (hasConfirmed !== undefined) {
    set['players.$.state.hasConfirmed'] = hasConfirmed;
  }

  if (score !== undefined) {
    set['players.$.state.score'] = score;
  }

  if (vote !== undefined) {
    set['players.$.state.vote'] = vote;
  }

  if (status !== undefined) {
    set['players.$.state.status'] = status;
  }

  if (role !== undefined) {
    set['players.$.state.role'] = role;
  }

  if (body.touchLastPing !== false) {
    set['players.$.connection.lastPing'] = new Date();
  }

  set['state.lastPinged'] = new Date();

  return set;
}

async function upsertPlayerInPartyDocument(model, partyId, incomingPlayer) {
  const session = await model.findOne({ partyId });

  if (!session) {
    return null;
  }

  const currentPlayers = Array.isArray(session.players)
    ? session.players.map(player => player.toObject ? player.toObject() : cloneSerializable(player))
    : [];

  session.players = upsertPartyPlayer(currentPlayers, incomingPlayer);

  if (session.state && typeof session.state === 'object') {
    session.state.lastPinged = new Date();
  }

  await session.save();
  return session.toObject ? session.toObject() : session;
}

function createJoinUserHandler({ route, mainModel, waitingRoomModel, logLabel }) {
  app.post(route, async (req, res) => {
    const partyId = req.body.partyId || req.query.partyCode;
    const incomingPlayer = buildJoinPlayerFromBody(req.body);
    const incomingPlayerId = getPartyPlayerId(incomingPlayer);

    if (!partyId || !incomingPlayerId) {
      return res.status(400).json({ error: 'partyId and computerId are required' });
    }

    try {
      const result = await withPartyJoinLock(partyId, async () => {
        const updatedMain = await upsertPlayerInPartyDocument(mainModel, partyId, incomingPlayer);

        if (!updatedMain) {
          return null;
        }

        const updatedWaitingRoom = await upsertPlayerInPartyDocument(waitingRoomModel, partyId, incomingPlayer);
        const socketId = getPlayerConnectionSocketId(incomingPlayer);

        rememberSocketPartyMembership({
          socketId,
          partyId,
          computerId: incomingPlayerId,
          mainModel,
          waitingRoomModel,
          logLabel
        });

        const repairedMain = await repairPartyHostForParty({
          partyId,
          mainModel,
          waitingRoomModel
        });

        return { updatedMain: repairedMain ?? updatedMain, updatedWaitingRoom };
      });

      if (!result) {
        return res.status(404).json({ error: 'Party not found' });
      }

      res.json({
        message: `${logLabel} player joined or updated successfully`,
        updated: result.updatedMain,
        waitingRoom: result.updatedWaitingRoom
      });
    } catch (err) {
      console.error(`❌ Error joining/updating ${logLabel.toLowerCase()} player:`, err);
      res.status(500).json({ error: `Failed to join/update ${logLabel.toLowerCase()} player` });
    }
  });
}

async function patchPlayerInPartyDocument(model, partyId, computerId, set) {
  if (!model) {
    return null;
  }

  return model.findOneAndUpdate(
    {
      partyId,
      'players.identity.computerId': computerId
    },
    { $set: set },
    { new: true }
  ).lean();
}

function createPatchPlayerHandler({ route, mainModel, waitingRoomModel, logLabel }) {
  app.post(route, async (req, res) => {
    try {
      const partyId = req.body.partyId || req.query.partyCode;
      const computerId =
        req.body.computerId ??
        req.body.newComputerId ??
        req.body.identity?.computerId ??
        req.body.identityPatch?.computerId;

      if (!partyId || !computerId) {
        return res.status(400).json({ error: 'partyId and computerId are required' });
      }

      const playerPatch = buildPlayerPatchFromBody(req.body);
      const nextSocketId = playerPatch['players.$.connection.socketId'];

      const { updatedMain, updatedWaitingRoom } = await withPartyJoinLock(partyId, async () => {
        const [patchedMain, patchedWaitingRoom] = await Promise.all([
          patchPlayerInPartyDocument(mainModel, partyId, computerId, playerPatch),
          patchPlayerInPartyDocument(waitingRoomModel, partyId, computerId, playerPatch)
        ]);

        if (nextSocketId) {
          rememberSocketPartyMembership({
            socketId: nextSocketId,
            partyId,
            computerId,
            mainModel,
            waitingRoomModel,
            logLabel
          });
        }

        const repairedMain = await repairPartyHostForParty({
          partyId,
          mainModel,
          waitingRoomModel
        });

        return {
          updatedMain: repairedMain ?? patchedMain,
          updatedWaitingRoom: patchedWaitingRoom
        };
      });

      if (!updatedMain) {
        return res.status(404).json({ error: `${logLabel} player not found` });
      }

      res.json({
        message: `${logLabel} player patched successfully`,
        updated: updatedMain,
        waitingRoom: updatedWaitingRoom
      });
    } catch (err) {
      console.error(`❌ Error patching ${logLabel.toLowerCase()} player:`, err);
      res.status(500).json({ error: `Failed to patch ${logLabel.toLowerCase()} player` });
    }
  });
}

function createRemoveUserHandler({ route, mainModel, waitingRoomModel, logLabel }) {
  app.post(route, async (req, res) => {
    try {
      let body = req.body;

      // Handle beacon (string) vs normal fetch (object)
      if (typeof body === "string") {
        try {
          body = JSON.parse(body);
        } catch (e) {
          return res.status(400).json({ error: "Invalid JSON from beacon" });
        }
      }

      const { partyId, computerIdToRemove } = body;
      const actorComputerId = body.actorComputerId ?? body.actorId ?? null;
      const actorSocketId = body.actorSocketId ?? body.socketId ?? null;

      if (!partyId || !computerIdToRemove) {
        return res.status(400).json({ error: 'partyId and computerIdToRemove are required' });
      }

      if (!actorComputerId) {
        return res.status(403).json({ error: 'actorComputerId is required to remove a player from the party' });
      }

      const result = await withPartyJoinLock(partyId, async () => {
        // --- Remove from session ---
        const session = await mainModel.findOne({ partyId: partyId });
        if (!session) {
          return { status: 404, error: `${logLabel} not found` };
        }

        const isSelfRemoval = String(actorComputerId) === String(computerIdToRemove);

        if (!isSelfRemoval) {
          const hostComputerId = session.state?.hostComputerId ?? null;
          const actorPlayer = session.players.find(
            player => String(getPartyPlayerId(player)) === String(actorComputerId)
          );
          const actorCurrentSocketId = actorPlayer?.connection?.socketId ?? null;
          const actorSocketMatches = !actorSocketId || !actorCurrentSocketId || String(actorCurrentSocketId) === String(actorSocketId);

          if (!hostComputerId || String(actorComputerId) !== String(hostComputerId) || !actorSocketMatches) {
            return { status: 403, error: 'Only the host can remove another player from the party' };
          }
        }

        const removedPlayer = session.players.find(
          player => String(getPartyPlayerId(player)) === String(computerIdToRemove)
        );
        const removedSocketId = getPlayerConnectionSocketId(removedPlayer);
        const originalCount = session.players.length;
        session.players = session.players.filter(
          player => String(getPartyPlayerId(player)) !== String(computerIdToRemove)
        );

        if (session.players.length === originalCount) {
          return { status: 400, error: 'Computer ID not found in session' };
        }

        const chatLogSession = await partyGameChatLogSchema.findOne({ partyId });
        await repairPartyHost({
          session,
          waitingRoomModel,
          chatLogSession,
          ignoreComputerId: computerIdToRemove
        });

        await session.save();
        if (chatLogSession) {
          await chatLogSession.save();
        }

        // --- Remove from waiting room (if exists) ---
        const waitingRoom = await waitingRoomModel.findOne({ partyId: partyId });
        if (waitingRoom) {
          const originalWaitingCount = waitingRoom.players.length;
          waitingRoom.players = waitingRoom.players.filter(
            player => String(getPartyPlayerId(player)) !== String(computerIdToRemove)
          );

          if (waitingRoom.players.length !== originalWaitingCount) {
            if (waitingRoom.state) {
              waitingRoom.state.hostComputerId = session.state?.hostComputerId ?? null;
              waitingRoom.state.hostComputerIdList = session.state?.hostComputerIdList ?? [];
              waitingRoom.state.lastPinged = new Date();
            }
            await waitingRoom.save();
          }
        }

        forgetSocketPartyMembership(removedSocketId, partyId, computerIdToRemove);
        return { removedSocketId };
      });

      if (result?.error) {
        return res.status(result.status).json({ error: result.error });
      }

      const removedSocketId = result?.removedSocketId;

      if (removedSocketId && removedSocketId !== "DISCONNECTED") {
        const removedSocket = io.sockets.sockets.get(removedSocketId);

        if (removedSocket) {
          removedSocket.emit('kicked-from-party', partyId);
          removedSocket.leave(partyId);
        }

        io.to(partyId).emit('user-kicked', {
          socketId: removedSocketId,
          computerId: computerIdToRemove
        });
      }

      res.json({ message: 'User removed successfully from session and waiting room (if present)' });
    } catch (err) {
      console.error(`❌ Error removing user from ${logLabel.toLowerCase()}:`, err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
}


function createDisconnectUserHandler({ route, mainModel, waitingRoomModel, logLabel }) {
  app.post(route, async (req, res) => {
    try {
      let body = req.body;

      // Handle beacon (string) vs normal fetch (object)
      if (typeof body === "string") {
        try {
          body = JSON.parse(body);
        } catch (e) {
          return res.status(400).json({ error: "Invalid JSON from beacon" });
        }
      }

      const { partyId, computerId, partyCode } = body;
      const actualPartyId = partyId || partyCode;

      if (!actualPartyId || !computerId) {
        return res.status(400).json({ error: "partyId and computerId are required" });
      }

      const updated = await disconnectPartyPlayer({
        partyId: actualPartyId,
        computerId,
        mainModel,
        waitingRoomModel,
        logLabel,
        socketId: body.socketId ?? body.actorSocketId ?? null,
        writeChat: true
      });

      if (!updated) {
        return res.status(404).json({ error: `${logLabel} or player not found` });
      }

      res.json({
        message:
          "Socket ID reset successfully in session and waiting room (if present)",
        updated
      });
    } catch (err) {
      console.error(`❌ Error resetting socket ID for ${logLabel.toLowerCase()}:`, err);
      res.status(500).json({ error: "Internal server error" });
    }
  });
}


function createPartyGetHandler({ route, model, logLabel }) {
  app.get(route, async (req, res) => {
    const { partyCode } = req.query;

    try {
      const filter = partyCode ? { partyId: partyCode } : {};
      const data = await model.find(filter);
      res.json(data);
    } catch (err) {
      console.error(`❌ Failed to fetch ${logLabel.toLowerCase()}(s):`, err);
      res.status(500).json({ error: 'Server error' });
    }
  });
}

app.post('/api/chat/:partyId', async (req, res) => {
  const { partyId } = req.params;
  const { username, message, eventType } = req.body;

  try {
    await partyGameChatLogSchema.updateOne(
      { partyId },
      {
        $push: { chat: { username, message, eventType } },
        $set: { lastPinged: new Date() }
      },
      { upsert: true }
    );

    res.status(200).json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/chat/:partyId', async (req, res) => {
  const { partyId } = req.params;

  try {
    const chatLog = await partyGameChatLogSchema.findOne({ partyId });
    res.json(chatLog || { chat: [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE chat log for a specific party
app.delete('/api/chat/:partyId', async (req, res) => {
  const { partyId } = req.params;

  try {
    const result = await partyGameChatLogSchema.deleteOne({ partyId });

    if (result.deletedCount === 0) {
      return res.status(404).json({ success: false, message: 'Chat not found' });
    }

    res.status(200).json({ success: true, message: `Chat for party ${partyId} deleted` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Add security headers using helmet.
// Keep strict isolation/HSTS for production, but avoid breaking LAN HTTP testing.
app.use(helmet({
  contentSecurityPolicy: false,
  hsts: false,
  crossOriginOpenerPolicy: isProduction ? { policy: 'same-origin' } : false,
  originAgentCluster: isProduction
}));

if (isProduction) {
  app.use(helmet.hsts({ maxAge: 31536000, includeSubDomains: true }));
}

app.use(
  helmet.contentSecurityPolicy({
    useDefaults: true,
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'",
        "'unsafe-inline'",
        "https://code.responsivevoice.org",
        "https://www.googletagmanager.com",
        "https://*.google-analytics.com",
        "https://cdnjs.cloudflare.com",
        "https://script.google.com",
        "https://script.googleusercontent.com",
        "https://unpkg.com/compromise",
        "https://cdn.socket.io",
        "https://cdn.jsdelivr.net/npm/chart.js",
        "https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels@2",
        "https://overexposed.app"
      ],
      objectSrc: ["'none'"],
      connectSrc: [
        "'self'",
        "https://overexposed.app:3000",
        "https://www.google-analytics.com",
        "https://*.google-analytics.com",
        "https://docs.google.com",
        "https://doc-0g-8s-sheets.googleusercontent.com",
        "https://script.google.com",
        "https://script.googleusercontent.com",
        "https://unpkg.com/compromise",
        "https://cdn.socket.io",
        "https://cdn.jsdelivr.net/npm/chart.js",
        "https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels@2",
        "https://overexposed.app"
      ],
      imgSrc: [
        "'self'",
        "https://www.google-analytics.com",
        "https://*.google-analytics.com"
      ],
      frameSrc: [
        "https://www.googletagmanager.com",
        "https://*.google-analytics.com",
        "https://script.google.com",
        "https://script.googleusercontent.com"
      ],
      // Avoid upgrading LAN HTTP requests to HTTPS during local testing.
      upgradeInsecureRequests: isProduction ? [] : null
    }
  })
);



app.use(helmet.frameguard({ action: 'sameorigin' }));
app.use(helmet.noSniff());
app.use(helmet.referrerPolicy({ policy: 'no-referrer-when-downgrade' }));

// Use permissionsPolicy
app.use(permissionsPolicy({
  features: {
    geolocation: ['self'],  // Correct without quotes here
    microphone: []
  }
}));

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
}));


app.use(cors());

const ONE_YEAR_IN_SECONDS = 31536000;
const STATIC_ASSET_EXTENSIONS = new Set([
  '.js', '.css', '.png', '.jpg', '.jpeg', '.webp', '.avif', '.gif', '.svg',
  '.ico', '.woff', '.woff2', '.ttf', '.otf', '.mp3', '.wav', '.ogg', '.json'
]);

app.use((req, res, next) => {
  const ext = path.extname(req.path).toLowerCase();
  let hasVersionQuery = false;

  try {
    const requestUrl = new URL(req.originalUrl, 'http://localhost');
    hasVersionQuery = requestUrl.searchParams.has('v');
  } catch {
    hasVersionQuery = false;
  }

  if (STATIC_ASSET_EXTENSIONS.has(ext)) {
    if (hasVersionQuery) {
      res.setHeader('Cache-Control', `public, max-age=${ONE_YEAR_IN_SECONDS}, immutable`);
    } else {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
  } else if (ext === '.html') {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }

  next();
});

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.svg')) {
      res.set('Content-Type', 'image/svg+xml');
    }
  }
}));

// Define routes for your HTML pages
app.get('/', (req, res) => {
  sendVersionedHtmlFile(req, res, path.join(__dirname, 'public', 'pages', 'homepages', 'homepage.html'));
});

app.get('/truth-or-dare/settings', (req, res) => {
  const filePath = path.join(__dirname, 'public', 'pages', 'party-games', 'truth-or-dare', 'truth-or-dare-settings-page.html');
  debugLog(`Attempting to serve file from: ${filePath}`);
  sendVersionedHtmlFile(req, res, filePath);
});

app.get('/truth-or-dare', (req, res) => {
  const filePath = path.join(__dirname, 'public', 'pages', 'party-games', 'truth-or-dare', 'truth-or-dare-page.html');
  debugLog(`Attempting to serve file from: ${filePath}`);
  sendVersionedHtmlFile(req, res, filePath);
});

app.get('/truth-or-dare/:partyCode([a-zA-Z0-9]{3}-[a-zA-Z0-9]{3})', (req, res) => {
  const filePath = path.join(__dirname, 'public', 'pages', 'party-games', 'truth-or-dare', 'truth-or-dare-online-page.html');
  debugLog(`Attempting to serve file from: ${filePath}`);
  sendVersionedHtmlFile(req, res, filePath);
});

app.get('/paranoia/settings', (req, res) => {
  const filePath = path.join(__dirname, 'public', 'pages', 'party-games', 'paranoia', 'paranoia-settings-page.html');
  debugLog(`Attempting to serve file from: ${filePath}`);
  sendVersionedHtmlFile(req, res, filePath);
});

app.get('/paranoia', (req, res) => {
  const filePath = path.join(__dirname, 'public', 'pages', 'party-games', 'paranoia', 'paranoia-page.html');
  debugLog(`Attempting to serve file from: ${filePath}`);
  sendVersionedHtmlFile(req, res, filePath);
});

app.get('/paranoia/:partyCode([a-zA-Z0-9]{3}-[a-zA-Z0-9]{3})', (req, res) => {
  const filePath = path.join(__dirname, 'public', 'pages', 'party-games', 'paranoia', 'paranoia-online-page.html');
  debugLog(`Attempting to serve file from: ${filePath}`);
  sendVersionedHtmlFile(req, res, filePath);
});

app.get('/never-have-i-ever/settings', (req, res) => {
  const filePath = path.join(__dirname, 'public', 'pages', 'party-games', 'never-have-i-ever', 'never-have-i-ever-settings-page.html');
  debugLog(`Attempting to serve file from: ${filePath}`);
  sendVersionedHtmlFile(req, res, filePath);
});

app.get('/never-have-i-ever', (req, res) => {
  const filePath = path.join(__dirname, 'public', 'pages', 'party-games', 'never-have-i-ever', 'never-have-i-ever-page.html');
  debugLog(`Attempting to serve file from: ${filePath}`);
  sendVersionedHtmlFile(req, res, filePath);
});

app.get('/never-have-i-ever/:partyCode([a-zA-Z0-9]{3}-[a-zA-Z0-9]{3})', (req, res) => {
  const filePath = path.join(__dirname, 'public', 'pages', 'party-games', 'never-have-i-ever', 'never-have-i-ever-online-page.html');
  debugLog(`Attempting to serve file from: ${filePath}`);
  sendVersionedHtmlFile(req, res, filePath);
});

app.get('/most-likely-to/settings', (req, res) => {
  const filePath = path.join(__dirname, 'public', 'pages', 'party-games', 'most-likely-to', 'most-likely-to-settings-page.html');
  debugLog(`Attempting to serve file from: ${filePath}`);
  sendVersionedHtmlFile(req, res, filePath);
});

app.get('/most-likely-to', (req, res) => {
  const filePath = path.join(__dirname, 'public', 'pages', 'party-games', 'most-likely-to', 'most-likely-to-page.html');
  debugLog(`Attempting to serve file from: ${filePath}`);
  sendVersionedHtmlFile(req, res, filePath);
});

app.get('/most-likely-to/:partyCode([a-zA-Z0-9]{3}-[a-zA-Z0-9]{3})', (req, res) => {
  const filePath = path.join(__dirname, 'public', 'pages', 'party-games', 'most-likely-to', 'most-likely-to-online-page.html');
  debugLog(`Attempting to serve file from: ${filePath}`);
  sendVersionedHtmlFile(req, res, filePath);
});

app.get('/imposter/settings', (req, res) => {
  const filePath = path.join(__dirname, 'public', 'pages', 'party-games', 'imposter', 'imposter-settings-page.html');
  debugLog(`Attempting to serve file from: ${filePath}`);
  sendVersionedHtmlFile(req, res, filePath);
});

app.get('/imposter', (req, res) => {
  const filePath = path.join(__dirname, 'public', 'pages', 'party-games', 'imposter', 'imposter-page.html');
  debugLog(`Attempting to serve file from: ${filePath}`);
  sendVersionedHtmlFile(req, res, filePath);
});


app.get('/imposter/:partyCode([a-zA-Z0-9]{3}-[a-zA-Z0-9]{3})', (req, res) => {
  const filePath = path.join(__dirname, 'public', 'pages', 'party-games', 'imposter', 'imposter-online-page.html');
  debugLog(`Attempting to serve file from: ${filePath}`);
  sendVersionedHtmlFile(req, res, filePath);
});

app.get('/would-you-rather', (req, res) => {
  const filePath = path.join(__dirname, 'public', 'pages', 'party-games', 'would-you-rather', 'would-you-rather-page.html');
  debugLog(`Attempting to serve file from: ${filePath}`);
  sendVersionedHtmlFile(req, res, filePath);
});

app.get('/would-you-rather/settings', (req, res) => {
  const filePath = path.join(__dirname, 'public', 'pages', 'party-games', 'would-you-rather', 'would-you-rather-settings-page.html');
  debugLog(`Attempting to serve file from: ${filePath}`);
  sendVersionedHtmlFile(req, res, filePath);
});

app.get('/would-you-rather/:partyCode([a-zA-Z0-9]{3}-[a-zA-Z0-9]{3})', (req, res) => {
  const filePath = path.join(__dirname, 'public', 'pages', 'party-games', 'would-you-rather', 'would-you-rather-online-page.html');
  debugLog(`Attempting to serve file from: ${filePath}`);
  sendVersionedHtmlFile(req, res, filePath);
});

app.get('/exposay/settings', (req, res) => {
  const filePath = path.join(__dirname, 'public', 'pages', 'party-games', 'exposay', 'exposay-settings-page.html');
  debugLog(`Attempting to serve file from: ${filePath}`);
  sendVersionedHtmlFile(req, res, filePath);
});

app.get('/mafia/settings', (req, res) => {
  const filePath = path.join(__dirname, 'public', 'pages', 'party-games', 'mafia', 'mafia-settings-page.html');
  debugLog(`Attempting to serve file from: ${filePath}`);
  sendVersionedHtmlFile(req, res, filePath);
});

app.get('/mafia/:partyCode([a-zA-Z0-9]{3}-[a-zA-Z0-9]{3})', (req, res) => {
  const filePath = path.join(__dirname, 'public', 'pages', 'party-games', 'mafia', 'mafia-online-page.html');
  debugLog(`Attempting to serve file from: ${filePath}`);
  sendVersionedHtmlFile(req, res, filePath);
});

app.get('/overexposure', (req, res) => {
  const filePath = path.join(__dirname, 'public', 'pages', 'overexposure', 'overexposure.html');
  debugLog(`Attempting to serve file from: ${filePath}`);
  sendVersionedHtmlFile(req, res, filePath);
});

app.get('/overexposure/:timestamp', (req, res) => {
  const timestamp = req.params.timestamp; // This will capture the dynamic timestamp part
  const filePath = path.join(__dirname, 'public', 'pages', 'overexposure', 'overexposure.html');
  // Your logic for handling the request
  sendVersionedHtmlFile(req, res, filePath);
});

app.get('/waiting-room', (req, res) => {
  const filePath = path.join(__dirname, 'public', 'pages', 'waiting-room.html');
  debugLog(`Attempting to serve file from: ${filePath}`);
  sendVersionedHtmlFile(req, res, filePath);
});

app.get('/:partyCode([a-zA-Z0-9]{3}-[a-zA-Z0-9]{3})', async (req, res) => {
  const { partyCode } = req.params;

  try {
    const waitingRoom = await waitingRoomSchema.findOne({ partyId: partyCode }).lean();
    const meta = await getWaitingRoomMeta(req, partyCode, waitingRoom);
    const existingDeploymentVersion = getCookieValue(req.headers.cookie, 'oe-deployment-version');
    if (existingDeploymentVersion !== DEPLOYMENT_VERSION) {
      res.setHeader('Clear-Site-Data', '"cache"');
      res.append('Set-Cookie', `oe-deployment-version=${DEPLOYMENT_VERSION}; Path=/; Max-Age=${ONE_YEAR_IN_SECONDS}; SameSite=Lax`);
    }

    res.type('html').send(versionLocalAssetReferences(renderWaitingRoomPage(meta)));
  } catch (error) {
    console.error(`Error rendering waiting room preview for party "${partyCode}":`, error);
    const meta = await getWaitingRoomMeta(req, partyCode, null);
    const existingDeploymentVersion = getCookieValue(req.headers.cookie, 'oe-deployment-version');
    if (existingDeploymentVersion !== DEPLOYMENT_VERSION) {
      res.setHeader('Clear-Site-Data', '"cache"');
      res.append('Set-Cookie', `oe-deployment-version=${DEPLOYMENT_VERSION}; Path=/; Max-Age=${ONE_YEAR_IN_SECONDS}; SameSite=Lax`);
    }

    res.status(500).type('html').send(versionLocalAssetReferences(renderWaitingRoomPage(meta)));
  }
});

app.get('/terms-and-privacy', (req, res) => {
  const filePath = path.join(__dirname, 'public', 'pages', 'other', 'terms-and-privacy.html');
  debugLog(`Attempting to serve file from: ${filePath}`);
  sendVersionedHtmlFile(req, res, filePath);
});

app.get('/faqs', (req, res) => {
  const filePath = path.join(__dirname, 'public', 'pages', 'other', 'frequently-asked-questions.html');
  debugLog(`Attempting to serve file from: ${filePath}`);
  sendVersionedHtmlFile(req, res, filePath);
});

app.get('/oes-customisation', (req, res) => {
  const filePath = path.join(__dirname, 'public', 'pages', 'other', 'oes-customisation.html');
  debugLog(`Attempting to serve file from: ${filePath}`);
  sendVersionedHtmlFile(req, res, filePath);
});

app.get('/production-tools', (req, res) => {
  const filePath = path.join(__dirname, 'public', 'pages', 'other', 'production-tools.html');
  debugLog(`Attempting to serve file from: ${filePath}`);
  sendVersionedHtmlFile(req, res, filePath);
});

// Handle 404 (Page Not Found)
app.use((req, res) => {
  sendVersionedHtmlFile(req, res, path.join(__dirname, 'public', 'pages', '404.html'), 404);
});

(async () => {
  await connectDatabases();
  await ensureDatabaseIndexes();
  await startChangeStreams();

  server.listen(PORT, () => {
    debugLog(`🚀 Server listening on port ${PORT}`);
  });

})();

app.use((req, res, next) => {
  debugLog("📩 Incoming request:", req.method, req.url);
  next();
});
