const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const permissionsPolicy = require('permissions-policy');
const http = require('http');

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
const partyGameMafiaSchema = require('./models/party-game-mafia-schema');
const partyGameChatLogSchema = require('./models/party-game-chat-log-schema');
const waitingRoomSchema = require('./models/waiting-room-schema');

Confession.watch()
  .on('change', (change) => {
    io.emit('confessions-updated', change);
  })
  .on('error', (error) => {
    console.error('Error watching change stream:', error);
  });

// MongoDB connections
let overexposureDb = null;
let overexposedDb = null;

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
  const waitingRoomDB = overexposureDb.collection('waiting-room');
  const partyGameTruthOrDareDB = overexposureDb.collection('party-game-truth-or-dare');
  const partyGameParanoiaDB = overexposureDb.collection('party-game-paranoia');
  const partyGameNeverHaveIEverDB = overexposureDb.collection('party-game-never-have-i-ever');
  const partyGameMostLikelyToDB = overexposureDb.collection('party-game-most-likely-to');
  const partyGameMafiaDB = overexposureDb.collection('party-game-mafia');
  const partyGameChatLogDB = overexposureDb.collection('party-game-chat-log');

  // Helper function
  const watchCollection = (collection, label) => {
    console.log('👁 Watching collection:', collection.collectionName);

    const dbName = collection.conn?.name || 'unknown';
    console.log('📂 From database:', dbName);

    collection.collection.watch([], { fullDocument: 'updateLookup' })
      .on('change', (change) => {
        const partyCode = change.fullDocument?.partyId;
        if (!partyCode) {
          console.warn(`⚠️ ${label} change missing partyCode`);
          return;
        }
        io.to(partyCode).emit('party-updated', {
          type: change.operationType,           // "update" || "delete"
          emittedPartyCode: change.fullDocument || null,   // latest party data
          documentKey: change.documentKey,      // useful for deletes
        });
        console.log(`🔄 ${label} change sent to ${partyCode}`);
      })
      .on('error', (err) => {
        console.error(`❌ ${label} stream error:`, err);
      });
  };

  const watchChatLog = (collection) => {
    console.log('👁 Watching chat-log collection:', collection.collectionName);

    collection.watch([], { fullDocument: 'updateLookup' })
      .on('change', (change) => {
        let partyCode = change.fullDocument?.partyId;

        // Handle deletes where fullDocument is null
        if (!partyCode && change.operationType === 'delete') {
          // If you store partyId in _id or another field, extract it here
          // Otherwise, you might need a separate mapping
          console.warn('⚠️ chat-log delete missing partyId');
          return;
        }

        // Only send updates/inserts
        if (['insert', 'update'].includes(change.operationType)) {
          io.to(partyCode).emit('chat-updated', {
            type: change.operationType,
            chatLog: change.fullDocument, // entire document including chat array
            documentKey: change.documentKey,
          });
          console.log(`💬 chat-log ${change.operationType} sent to ${partyCode}`);
        }

        // Handle deletes
        if (change.operationType === 'delete') {
          io.to(partyCode).emit('chat-updated', {
            type: 'delete',
            chatLog: null,
            documentKey: change.documentKey,
          });
          console.log(`❌ chat-log delete sent to ${partyCode}`);
        }
      })
      .on('error', (err) => {
        console.error('❌ chat-log stream error:', err);
      });
  };

  watchCollection(partyGameTruthOrDareDB, 'party-game-truth-or-dare');
  watchCollection(partyGameParanoiaDB, 'party-game-paranoia');
  watchCollection(partyGameNeverHaveIEverDB, 'party-game-never-have-i-ever');
  watchCollection(partyGameMostLikelyToDB, 'party-game-most-likely-to');
  watchCollection(partyGameMafiaDB, 'party-game-mafia');
  watchChatLog(partyGameChatLogDB);
  watchCollection(waitingRoomDB, 'waiting-room');
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
    const { title, text, id, date, x, y } = req.body;

    const saved = await Confession.create({
      title,
      text,
      id,
      date,
      x,
      y
    });

    res.json({ message: 'Confession saved successfully', saved });
  } catch (err) {
    console.error("❌ Error saving confession:", err);
    res.status(500).json({ error: 'Failed to save confession' });
  }
});

//WAITING ROOM
createUpsertPartyHandler({
  route: '/api/waiting-room',
  model: waitingRoomSchema,
  logLabel: 'Waiting room',
  fields: [
    'gamemode',
    'isPlaying',
    'lastPinged',
    'players',
    'gameSettings',
    'selectedPacks',
    'selectedRoles',
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
      'players',
      'gamemode',
      'gameSettings',
      'selectedPacks',
      'userInstructions',
      'isPlaying',
      'lastPinged',
      'playerTurn',
      'shuffleSeed',
      'currentCardIndex',
      'currentCardSecondIndex',
      'questionType'
    ],
    partyGameLogLabel: 'Party Game Truth Or Dare'
  },
  {
    route: 'party-game-paranoia',
    partyGameModel: partyGameParanoiaSchema,
    partyGameFields: [
      'players',
      'gamemode',
      'gameSettings',
      'selectedPacks',
      'userInstructions',
      'isPlaying',
      'lastPinged',
      'playerTurn',
      'shuffleSeed',
      'currentCardIndex'
    ],
    partyGameLogLabel: 'Party Game Paranoia'
  },
  {
    route: 'party-game-never-have-i-ever',
    partyGameModel: partyGameNeverHaveIEverSchema,
    partyGameFields: [
      'players',
      'gamemode',
      'gameSettings',
      'selectedPacks',
      'userInstructions',
      'isPlaying',
      'lastPinged',
      'playerTurn',
      'shuffleSeed',
      'currentCardIndex'
    ],
    partyGameLogLabel: 'Party Game Never Have I Ever'
  },
  {
    route: 'party-game-most-likely-to',
    partyGameModel: partyGameMostLikelyToSchema,
    partyGameFields: [
      'players',
      'gamemode',
      'gameSettings',
      'selectedPacks',
      'userInstructions',
      'isPlaying',
      'lastPinged',
      'playerTurn',
      'shuffleSeed',
      'currentCardIndex'
    ],
    partyGameLogLabel: 'Party Game Most Likely To'
  },
  {
    route: 'party-game-mafia',
    partyGameModel: partyGameMafiaSchema,
    partyGameFields: [
      'players',
      'gamemode',
      'gameSettings',
      'selectedRoles',
      'userInstructions',
      'isPlaying',
      'phase',
      'generalChat',
      'mafiaChat',
      'timer',
      'lastPinged'
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
      session.players = session.players.filter(player => player.computerId !== computerIdToRemove);

      if (session.players.length === originalCount) {
        return res.status(400).json({ error: 'Computer ID not found in session' });
      }

      await session.save();

      // --- Remove from waiting room (if exists) ---
      const waitingRoom = await waitingRoomModel.findOne({ partyId: partyId });
      if (waitingRoom) {
        const originalWaitingCount = waitingRoom.players.length;
        waitingRoom.players = waitingRoom.players.filter(
          player => player.computerId !== computerIdToRemove
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
        return res.status(400).json({ error: 'partyId and computerId are required' });
      }

      // --- Update main session ---
      const session = await mainModel.findOne({ partyId: actualPartyId });
      if (!session) {
        return res.status(404).json({ error: `${logLabel} not found` });
      }

      const player = session.players.find(p => p.computerId === computerId);
      if (!player) {
        return res.status(400).json({ error: 'Computer ID not found in session' });
      }

      player.socketId = "DISCONNECTED";
      player.lastPing = new Date();
      session.lastPinged = new Date();
      await session.save();

      // --- Update waiting room if exists ---
      const waitingRoomSession = await waitingRoomModel.findOne({ partyId: actualPartyId });
      if (waitingRoomSession) {
        const waitingPlayer = waitingRoomSession.players.find(p => p.computerId === computerId);
        if (waitingPlayer) {
          waitingPlayer.socketId = "DISCONNECTED";
          waitingPlayer.lastPing = new Date();
          waitingRoomSession.lastPinged = new Date();
          await waitingRoomSession.save();
        }
      }

      // --- Update chat log if exists ---
      const chatLogSession = await partyGameChatLogSchema.findOne({ partyId: actualPartyId });
      if (chatLogSession) {
        chatLogSession.chat.push({
          username: '[CONSOLE]',
          message: `${player.username} has been disconnected.`,
          eventType: 'disconnect'
        });
        await chatLogSession.save();
      }

      res.json({ message: 'Socket ID reset successfully in session and waiting room (if present)' });
    } catch (err) {
      console.error(`❌ Error resetting socket ID for ${logLabel.toLowerCase()}:`, err);
      res.status(500).json({ error: 'Internal server error' });
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

// Add security headers using helmet
app.use(helmet());

// Customize specific headers
app.use(helmet.hsts({ maxAge: 31536000, includeSubDomains: true }));
app.use(helmet.contentSecurityPolicy({
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'", "'unsafe-inline'", "https://code.responsivevoice.org", "https://www.googletagmanager.com", "https://*.google-analytics.com", "https://cdnjs.cloudflare.com", "https://script.google.com", "https://script.googleusercontent.com", "https://unpkg.com/compromise", "https://cdn.socket.io/4.8.1/socket.io.min.js", "https://cdn.jsdelivr.net/npm/chart.js", "https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels@2", "https://overexposed.app"],
    objectSrc: ["'none'"],
    connectSrc: ["'self'", "https://www.google-analytics.com", "https://*.google-analytics.com", "https://docs.google.com", "https://doc-0g-8s-sheets.googleusercontent.com", "https://script.google.com", "https://script.googleusercontent.com", "https://unpkg.com/compromise", "https://cdn.socket.io/4.8.1/socket.io.min.js", "https://cdn.jsdelivr.net/npm/chart.js", "https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels@2", "https://overexposed.app"],
    imgSrc: ["'self'", "https://www.google-analytics.com", "https://*.google-analytics.com"],
    frameSrc: ["https://www.googletagmanager.com", "https://*.google-analytics.com", "https://script.google.com", "https://script.googleusercontent.com"],
  }
}));

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
  res.sendFile(path.join(__dirname, 'public', 'pages', 'homepages', 'party-games-homepage.html'));
});

app.get('/what-is-overexposed', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'pages', 'what-is-overexposed', 'what-is-overexposed.html'));
});

app.get('/truth-or-dare/settings', (req, res) => {
  const filePath = path.join(__dirname, 'public', 'pages', 'party-games', 'truth-or-dare', 'truth-or-dare-settings-page.html');
  console.log(`Attempting to serve file from: ${filePath}`);
  res.sendFile(filePath);
});

app.get('/truth-or-dare', (req, res) => {
  const filePath = path.join(__dirname, 'public', 'pages', 'party-games', 'truth-or-dare', 'truth-or-dare-page.html');
  console.log(`Attempting to serve file from: ${filePath}`);
  res.sendFile(filePath);
});

app.get('/truth-or-dare/:partyCode([a-zA-Z0-9]{3}-[a-zA-Z0-9]{3})', (req, res) => {
  const filePath = path.join(__dirname, 'public', 'pages', 'party-games', 'truth-or-dare', 'truth-or-dare-online-page.html');
  console.log(`Attempting to serve file from: ${filePath}`);
  res.sendFile(filePath);
});

app.get('/paranoia/settings', (req, res) => {
  const filePath = path.join(__dirname, 'public', 'pages', 'party-games', 'paranoia', 'paranoia-settings-page.html');
  console.log(`Attempting to serve file from: ${filePath}`);
  res.sendFile(filePath);
});

app.get('/paranoia', (req, res) => {
  const filePath = path.join(__dirname, 'public', 'pages', 'party-games', 'paranoia', 'paranoia-page.html');
  console.log(`Attempting to serve file from: ${filePath}`);
  res.sendFile(filePath);
});

app.get('/paranoia/:partyCode([a-zA-Z0-9]{3}-[a-zA-Z0-9]{3})', (req, res) => {
  const filePath = path.join(__dirname, 'public', 'pages', 'party-games', 'paranoia', 'paranoia-online-page.html');
  console.log(`Attempting to serve file from: ${filePath}`);
  res.sendFile(filePath);
});

app.get('/never-have-i-ever/settings', (req, res) => {
  const filePath = path.join(__dirname, 'public', 'pages', 'party-games', 'never-have-i-ever', 'never-have-i-ever-settings-page.html');
  console.log(`Attempting to serve file from: ${filePath}`);
  res.sendFile(filePath);
});

app.get('/never-have-i-ever', (req, res) => {
  const filePath = path.join(__dirname, 'public', 'pages', 'party-games', 'never-have-i-ever', 'never-have-i-ever-page.html');
  console.log(`Attempting to serve file from: ${filePath}`);
  res.sendFile(filePath);
});

app.get('/never-have-i-ever/:partyCode([a-zA-Z0-9]{3}-[a-zA-Z0-9]{3})', (req, res) => {
  const filePath = path.join(__dirname, 'public', 'pages', 'party-games', 'never-have-i-ever', 'never-have-i-ever-online-page.html');
  console.log(`Attempting to serve file from: ${filePath}`);
  res.sendFile(filePath);
});

app.get('/most-likely-to/settings', (req, res) => {
  const filePath = path.join(__dirname, 'public', 'pages', 'party-games', 'most-likely-to', 'most-likely-to-settings-page.html');
  console.log(`Attempting to serve file from: ${filePath}`);
  res.sendFile(filePath);
});

app.get('/most-likely-to', (req, res) => {
  const filePath = path.join(__dirname, 'public', 'pages', 'party-games', 'most-likely-to', 'most-likely-to-page.html');
  console.log(`Attempting to serve file from: ${filePath}`);
  res.sendFile(filePath);
});

app.get('/most-likely-to/:partyCode([a-zA-Z0-9]{3}-[a-zA-Z0-9]{3})', (req, res) => {
  const filePath = path.join(__dirname, 'public', 'pages', 'party-games', 'most-likely-to', 'most-likely-to-online-page.html');
  console.log(`Attempting to serve file from: ${filePath}`);
  res.sendFile(filePath);
});

app.get('/mafia/settings', (req, res) => {
  const filePath = path.join(__dirname, 'public', 'pages', 'party-games', 'mafia', 'mafia-settings-page.html');
  console.log(`Attempting to serve file from: ${filePath}`);
  res.sendFile(filePath);
});

app.get('/mafia/:partyCode([a-zA-Z0-9]{3}-[a-zA-Z0-9]{3})', (req, res) => {
  const filePath = path.join(__dirname, 'public', 'pages', 'party-games', 'mafia', 'mafia-online-page.html');
  console.log(`Attempting to serve file from: ${filePath}`);
  res.sendFile(filePath);
});

app.get('/overexposure', (req, res) => {
  const filePath = path.join(__dirname, 'public', 'pages', 'overexposure', 'overexposure.html');
  console.log(`Attempting to serve file from: ${filePath}`);
  res.sendFile(filePath);
});

app.get('/overexposure/:timestamp', (req, res) => {
  const timestamp = req.params.timestamp; // This will capture the dynamic timestamp part
  const filePath = path.join(__dirname, 'public', 'pages', 'overexposure', 'overexposure.html');
  // Your logic for handling the request
  res.sendFile(filePath);
});

app.get('/waiting-room', (req, res) => {
  const filePath = path.join(__dirname, 'public', 'pages', 'waiting-room.html');
  console.log(`Attempting to serve file from: ${filePath}`);
  res.sendFile(filePath);
});

app.get('/:partyCode([a-zA-Z0-9]{3}-[a-zA-Z0-9]{3})', (req, res) => {
  const filePath = path.join(__dirname, 'public', 'pages', 'waiting-room.html');
  res.sendFile(filePath);
});


// Handle 404 (Page Not Found)
app.use((req, res) => {
  res.status(404).sendFile(path.join(__dirname, 'public', 'pages', '404.html'));
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