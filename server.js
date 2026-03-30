const express = require('express');
const bcrypt = require("bcryptjs");
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const permissionsPolicy = require('permissions-policy');
const http = require('http');
const { generateDeleteCode } = require("./utils/generate-delete-code");
const { QRCodeStyling } = require('qr-code-styling/lib/qr-code-styling.common.js');
const nodeCanvas = require('canvas');
const { JSDOM } = require('jsdom');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json()); // This will allow Express to parse incoming JSON

require('dotenv').config();

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
const partyCodeModels = [
  waitingRoomSchema,
  partyGameTruthOrDareSchema,
  partyGameParanoiaSchema,
  partyGameNeverHaveIEverSchema,
  partyGameMostLikelyToSchema,
  partyGameImposterSchema,
  partyGameWouldYouRatherSchema,
  partyGameMafiaSchema,
  partyGameChatLogSchema
];

// MongoDB connections
let overexposureDb = null;
let overexposedDb = null;
const changeStreams = new Map();
const changeStreamRestartTimers = new Map();
const changeStreamRetryCounts = new Map();
const changeStreamDefinitions = [];
const CHANGE_STREAM_BACKOFF_MS = [1000, 2000, 5000, 10000, 30000];
let dbReconnectHooksAttached = false;
const WAITING_ROOM_TEMPLATE_PATH = path.join(__dirname, 'public', 'pages', 'waiting-room.html');
const WAITING_ROOM_TEMPLATE = fs.readFileSync(WAITING_ROOM_TEMPLATE_PATH, 'utf8');
const PUBLIC_DIRECTORY = path.join(__dirname, 'public');
const WEBSITE_CACHE_VERSION = process.env.WEBSITE_CACHE_VERSION || '2026-03-30-1';
const DEPLOYMENT_VERSION = WEBSITE_CACHE_VERSION;
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

async function partyCodeExists(partyCode) {
  const matches = await Promise.all(
    partyCodeModels.map((model) => model.exists({ partyId: partyCode }))
  );

  return matches.some(Boolean);
}

async function reserveUniquePartyCode() {
  for (let attempt = 0; attempt < PARTY_CODE_MAX_ATTEMPTS; attempt += 1) {
    const partyCode = generatePartyCode();

    if (await partyCodeExists(partyCode)) {
      continue;
    }

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

  console.log(`👁 Watching ${label} stream`);
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
    const overexposureConn = await mongoose.connect(process.env.MONGO_URI_OVEREXPOSURE, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('✅ Connected to OVEREXPOSURE Database');

    const overexposedConn = await mongoose.createConnection(process.env.MONGO_URI_OVEREXPOSED, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    }).asPromise();
    console.log('✅ Connected to OVEREXPOSED Database');

    overexposureDb = mongoose.connection;
    overexposedDb = overexposedConn;
  } catch (err) {
    console.error('❌ Database connection error:', err);
    process.exit(1);
  }
}

// === SOCKET.IO SETUP ===
io.on('connection', (socket) => {
  console.log(`✅ Client connected: ${socket.id}`);

  socket.on('join-party', (partyCode) => {
    if (!partyCode) return;
    socket.join(partyCode);
    console.log(`🎉 User joined room: ${partyCode}`);
    socket.emit('joined-party', { message: `Joined party: ${partyCode}` });

    // Notify others in the room
    socket.to(partyCode).emit('user-joined', { socketId: socket.id });
  });

  socket.on('leave-party', (partyCode) => {
    if (!partyCode) return;
    socket.leave(partyCode);
    console.log(`${socket.id} left room ${partyCode}`);

    // Notify the leaving socket
    socket.emit('left-party', partyCode);

    // Notify everyone else
    socket.to(partyCode).emit('user-left', { socketId: socket.id });
  });


  socket.on('disconnect', () => {
    console.log(`❌ Client disconnected: ${socket.id}`);

    // Automatically get all rooms this socket was part of
    const rooms = Array.from(socket.rooms).filter(room => room !== socket.id);

    rooms.forEach((room) => {
      socket.to(room).emit('user-disconnected', { socketId: socket.id });
      console.log(`📢 Notified room ${room} of disconnection`);
    });
  });

  socket.on('kick-user', (partyCode) => {
    if (!partyCode) return;

    socket.leave(partyCode);
    console.log(`${socket.id} kicked from room ${partyCode}`);

    // Notify the user who was kicked
    socket.emit('kicked-from-party', partyCode);

    // Notify others in the room
    socket.to(partyCode).emit('user-kicked', { socketId: socket.id });
  });

  socket.on('delete-party', (partyCode) => {
    if (!partyCode) return;

    console.log(`🗑️ Party deleted: ${partyCode}`);

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
    console.log(`🔄 ${label} change sent to ${partyCode}`);
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
      console.log(`💬 chat-log ${change.operationType} sent to ${partyCode}`);
    }

    if (change.operationType === 'delete') {
      io.to(partyCode).emit('chat-updated', {
        type: 'delete',
        chatLog: null,
        documentKey: change.documentKey,
      });
      console.log(`❌ chat-log delete sent to ${partyCode}`);
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

      console.log(`✅ ${logLabel} ${partyCode} deleted via beacon`);
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

      console.log(`✅ ${logLabel} ${partyCode} deleted`);
      res.json({ message: `${logLabel} deleted successfully`, deleted: deletedMain });
    } catch (err) {
      console.error(`❌ Error deleting ${logLabel.toLowerCase()}:`, err);
      res.status(500).json({ error: `Failed to delete ${logLabel.toLowerCase()}` });
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
      res.status(500).json({ error: `Failed to save/update ${logLabel.toLowerCase()}` });
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

      if (!partyId || !computerIdToRemove) {
        return res.status(400).json({ error: 'partyId and computerIdToRemove are required' });
      }

      // --- Remove from session ---
      const session = await mainModel.findOne({ partyId: partyId });
      if (!session) {
        return res.status(404).json({ error: `${logLabel} not found` });
      }

      const originalCount = session.players.length;
      session.players = session.players.filter(
        player => player.identity?.computerId !== computerIdToRemove
      );

      if (session.players.length === originalCount) {
        return res.status(400).json({ error: 'Computer ID not found in session' });
      }

      await session.save();

      // --- Remove from waiting room (if exists) ---
      const waitingRoom = await waitingRoomModel.findOne({ partyId: partyId });
      if (waitingRoom) {
        const originalWaitingCount = waitingRoom.players.length;
        waitingRoom.players = waitingRoom.players.filter(
          player => player.identity?.computerId !== computerIdToRemove
        );

        if (waitingRoom.players.length !== originalWaitingCount) {
          await waitingRoom.save();
        }
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

      // --- Update main session ---
      const session = await mainModel.findOne({ partyId: actualPartyId });
      if (!session) {
        return res.status(404).json({ error: `${logLabel} not found` });
      }

      const player = session.players.find(
        (p) => p.identity?.computerId === computerId
      );
      if (!player) {
        return res.status(400).json({ error: "Computer ID not found in session" });
      }

      // Ensure nested connection exists
      if (!player.connection) {
        player.connection = {};
      }
      player.connection.socketId = "DISCONNECTED";
      player.connection.lastPing = new Date();

      // For new schema, lastPinged lives in state; fall back to top-level for legacy docs
      if (session.state) {
        session.state.lastPinged = new Date();
      } else {
        session.lastPinged = new Date();
      }

      // --- Update waiting room if exists ---
      const waitingRoomSession = await waitingRoomModel.findOne({
        partyId: actualPartyId,
      });
      if (waitingRoomSession) {
        const waitingPlayer = waitingRoomSession.players.find(
          (p) => p.identity?.computerId === computerId
        );
        if (waitingPlayer) {
          if (!waitingPlayer.connection) {
            waitingPlayer.connection = {};
          }
          waitingPlayer.connection.socketId = "DISCONNECTED";
          waitingPlayer.connection.lastPing = new Date();
          // waiting room schema still has flat lastPinged
          waitingRoomSession.lastPinged = new Date();
          await waitingRoomSession.save();
        }
      }

      // --- Update chat log if exists ---
      const chatLogSession = await partyGameChatLogSchema.findOne({
        partyId: actualPartyId,
      });

      if (chatLogSession) {
        // Disconnect message
        chatLogSession.chat.push({
          username: "[CONSOLE]",
          message: `${player.identity.username} has been disconnected.`,
          eventType: "disconnect",
        });
      }

      // --- Host reassignment (uses the helper) ---
      await reassignHostIfNeeded({
        session,
        disconnectedComputerId: computerId,
        chatLogSession,
      });

      // Save session + chat log
      await session.save();
      if (chatLogSession) {
        await chatLogSession.save();
      }

      res.json({
        message:
          "Socket ID reset successfully in session and waiting room (if present)",
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

async function reassignHostIfNeeded({ session, disconnectedComputerId, chatLogSession }) {
  const state = session.state;
  if (!state) return;

  const previousHostId = state.hostComputerId;
  const hostList = Array.isArray(state.hostComputerIdList)
    ? state.hostComputerIdList
    : [];

  if (!previousHostId) return;
  if (hostList.length === 0) return;

  let newHostPlayer = null;

  for (const candidateComputerId of hostList) {
    if (String(candidateComputerId) === String(disconnectedComputerId)) continue;

    const candidate = session.players.find(
      (p) =>
        p.identity?.computerId === candidateComputerId ||
        p.computerId === candidateComputerId
    );

    if (!candidate) continue;

    const socketId = candidate.connection?.socketId;
    if (socketId === "DISCONNECTED") continue;

    state.hostComputerId = candidateComputerId;
    newHostPlayer = candidate;
    break;
  }

  if (!newHostPlayer) {
    state.hostComputerId = null;
    return;
  }

  if (!chatLogSession) return;
  if (String(state.hostComputerId) === String(previousHostId)) return;

  const username = newHostPlayer.identity?.username || newHostPlayer.username;

  chatLogSession.chat.push({
    username: "[CONSOLE]",
    message: `${username} is now the host.`,
    eventType: "connect",
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

const isProduction = process.env.NODE_ENV === 'production';

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
  console.log(`Attempting to serve file from: ${filePath}`);
  sendVersionedHtmlFile(req, res, filePath);
});

app.get('/truth-or-dare', (req, res) => {
  const filePath = path.join(__dirname, 'public', 'pages', 'party-games', 'truth-or-dare', 'truth-or-dare-page.html');
  console.log(`Attempting to serve file from: ${filePath}`);
  sendVersionedHtmlFile(req, res, filePath);
});

app.get('/truth-or-dare/:partyCode([a-zA-Z0-9]{3}-[a-zA-Z0-9]{3})', (req, res) => {
  const filePath = path.join(__dirname, 'public', 'pages', 'party-games', 'truth-or-dare', 'truth-or-dare-online-page.html');
  console.log(`Attempting to serve file from: ${filePath}`);
  sendVersionedHtmlFile(req, res, filePath);
});

app.get('/paranoia/settings', (req, res) => {
  const filePath = path.join(__dirname, 'public', 'pages', 'party-games', 'paranoia', 'paranoia-settings-page.html');
  console.log(`Attempting to serve file from: ${filePath}`);
  sendVersionedHtmlFile(req, res, filePath);
});

app.get('/paranoia', (req, res) => {
  const filePath = path.join(__dirname, 'public', 'pages', 'party-games', 'paranoia', 'paranoia-page.html');
  console.log(`Attempting to serve file from: ${filePath}`);
  sendVersionedHtmlFile(req, res, filePath);
});

app.get('/paranoia/:partyCode([a-zA-Z0-9]{3}-[a-zA-Z0-9]{3})', (req, res) => {
  const filePath = path.join(__dirname, 'public', 'pages', 'party-games', 'paranoia', 'paranoia-online-page.html');
  console.log(`Attempting to serve file from: ${filePath}`);
  sendVersionedHtmlFile(req, res, filePath);
});

app.get('/never-have-i-ever/settings', (req, res) => {
  const filePath = path.join(__dirname, 'public', 'pages', 'party-games', 'never-have-i-ever', 'never-have-i-ever-settings-page.html');
  console.log(`Attempting to serve file from: ${filePath}`);
  sendVersionedHtmlFile(req, res, filePath);
});

app.get('/never-have-i-ever', (req, res) => {
  const filePath = path.join(__dirname, 'public', 'pages', 'party-games', 'never-have-i-ever', 'never-have-i-ever-page.html');
  console.log(`Attempting to serve file from: ${filePath}`);
  sendVersionedHtmlFile(req, res, filePath);
});

app.get('/never-have-i-ever/:partyCode([a-zA-Z0-9]{3}-[a-zA-Z0-9]{3})', (req, res) => {
  const filePath = path.join(__dirname, 'public', 'pages', 'party-games', 'never-have-i-ever', 'never-have-i-ever-online-page.html');
  console.log(`Attempting to serve file from: ${filePath}`);
  sendVersionedHtmlFile(req, res, filePath);
});

app.get('/most-likely-to/settings', (req, res) => {
  const filePath = path.join(__dirname, 'public', 'pages', 'party-games', 'most-likely-to', 'most-likely-to-settings-page.html');
  console.log(`Attempting to serve file from: ${filePath}`);
  sendVersionedHtmlFile(req, res, filePath);
});

app.get('/most-likely-to', (req, res) => {
  const filePath = path.join(__dirname, 'public', 'pages', 'party-games', 'most-likely-to', 'most-likely-to-page.html');
  console.log(`Attempting to serve file from: ${filePath}`);
  sendVersionedHtmlFile(req, res, filePath);
});

app.get('/most-likely-to/:partyCode([a-zA-Z0-9]{3}-[a-zA-Z0-9]{3})', (req, res) => {
  const filePath = path.join(__dirname, 'public', 'pages', 'party-games', 'most-likely-to', 'most-likely-to-online-page.html');
  console.log(`Attempting to serve file from: ${filePath}`);
  sendVersionedHtmlFile(req, res, filePath);
});

app.get('/imposter/settings', (req, res) => {
  const filePath = path.join(__dirname, 'public', 'pages', 'party-games', 'imposter', 'imposter-settings-page.html');
  console.log(`Attempting to serve file from: ${filePath}`);
  sendVersionedHtmlFile(req, res, filePath);
});

app.get('/imposter', (req, res) => {
  const filePath = path.join(__dirname, 'public', 'pages', 'party-games', 'imposter', 'imposter-page.html');
  console.log(`Attempting to serve file from: ${filePath}`);
  sendVersionedHtmlFile(req, res, filePath);
});


app.get('/imposter/:partyCode([a-zA-Z0-9]{3}-[a-zA-Z0-9]{3})', (req, res) => {
  const filePath = path.join(__dirname, 'public', 'pages', 'party-games', 'imposter', 'imposter-online-page.html');
  console.log(`Attempting to serve file from: ${filePath}`);
  sendVersionedHtmlFile(req, res, filePath);
});

app.get('/would-you-rather', (req, res) => {
  const filePath = path.join(__dirname, 'public', 'pages', 'party-games', 'would-you-rather', 'would-you-rather-page.html');
  console.log(`Attempting to serve file from: ${filePath}`);
  sendVersionedHtmlFile(req, res, filePath);
});

app.get('/would-you-rather/settings', (req, res) => {
  const filePath = path.join(__dirname, 'public', 'pages', 'party-games', 'would-you-rather', 'would-you-rather-settings-page.html');
  console.log(`Attempting to serve file from: ${filePath}`);
  sendVersionedHtmlFile(req, res, filePath);
});

app.get('/would-you-rather/:partyCode([a-zA-Z0-9]{3}-[a-zA-Z0-9]{3})', (req, res) => {
  const filePath = path.join(__dirname, 'public', 'pages', 'party-games', 'would-you-rather', 'would-you-rather-online-page.html');
  console.log(`Attempting to serve file from: ${filePath}`);
  sendVersionedHtmlFile(req, res, filePath);
});

app.get('/exposay/settings', (req, res) => {
  const filePath = path.join(__dirname, 'public', 'pages', 'party-games', 'exposay', 'exposay-settings-page.html');
  console.log(`Attempting to serve file from: ${filePath}`);
  sendVersionedHtmlFile(req, res, filePath);
});

app.get('/mafia/settings', (req, res) => {
  const filePath = path.join(__dirname, 'public', 'pages', 'party-games', 'mafia', 'mafia-settings-page.html');
  console.log(`Attempting to serve file from: ${filePath}`);
  sendVersionedHtmlFile(req, res, filePath);
});

app.get('/mafia/:partyCode([a-zA-Z0-9]{3}-[a-zA-Z0-9]{3})', (req, res) => {
  const filePath = path.join(__dirname, 'public', 'pages', 'party-games', 'mafia', 'mafia-online-page.html');
  console.log(`Attempting to serve file from: ${filePath}`);
  sendVersionedHtmlFile(req, res, filePath);
});

app.get('/overexposure', (req, res) => {
  const filePath = path.join(__dirname, 'public', 'pages', 'overexposure', 'overexposure.html');
  console.log(`Attempting to serve file from: ${filePath}`);
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
  console.log(`Attempting to serve file from: ${filePath}`);
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
  console.log(`Attempting to serve file from: ${filePath}`);
  sendVersionedHtmlFile(req, res, filePath);
});

app.get('/faqs', (req, res) => {
  const filePath = path.join(__dirname, 'public', 'pages', 'other', 'frequently-asked-questions.html');
  console.log(`Attempting to serve file from: ${filePath}`);
  sendVersionedHtmlFile(req, res, filePath);
});

app.get('/oes-customisation', (req, res) => {
  const filePath = path.join(__dirname, 'public', 'pages', 'other', 'oes-customisation.html');
  console.log(`Attempting to serve file from: ${filePath}`);
  sendVersionedHtmlFile(req, res, filePath);
});

app.get('/production-tools', (req, res) => {
  const filePath = path.join(__dirname, 'public', 'pages', 'other', 'production-tools.html');
  console.log(`Attempting to serve file from: ${filePath}`);
  sendVersionedHtmlFile(req, res, filePath);
});

// Handle 404 (Page Not Found)
app.use((req, res) => {
  sendVersionedHtmlFile(req, res, path.join(__dirname, 'public', 'pages', '404.html'), 404);
});

(async () => {
  await connectDatabases();
  await startChangeStreams();

  server.listen(PORT, () => {
    console.log(`🚀 Server listening on port ${PORT}`);
  });

})();

app.use((req, res, next) => {
  console.log("📩 Incoming request:", req.method, req.url);
  next();
});
