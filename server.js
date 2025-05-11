const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const permissionsPolicy = require('permissions-policy');
const http = require('http');
const mongoose = require('mongoose');

const partyEvents = require('./change-streams');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json()); // This will allow Express to parse incoming JSON

require('dotenv').config();


const socketIo = require('socket.io'); // Import socket.io
const server = http.createServer(app);
const io = socketIo(server);

// Use async/await for MongoDB connections
async function connectDatabases() {
  try {
    await mongoose.connect(process.env.MONGO_URI_OVEREXPOSURE);
    console.log('✅ Connected to OVEREXPOSURE Database');

    // Updated connection for second database, removed deprecated options
    await mongoose.createConnection(process.env.MONGO_URI_OVEREXPOSED).asPromise();

    console.log('✅ Connected to OVEREXPOSED Database');
  } catch (err) {
    console.error('❌ Database connection error:', err);
  }
}

connectDatabases();

function notifyPartyUpdate(partyCode, partyData) {
  io.to(partyCode).emit("party-updated", partyData);
}

function updatePartyData(partyCode, newPartyData) {
  // Simulate a party data change (e.g., update party info, settings, etc.)
  // Once the data is updated, notify all clients in that party room
  notifyPartyUpdate(partyCode, newPartyData);
}

const Confession = require('./models/confessions');
const OnlineParty = require('./models/online-party');

OnlineParty.watch()
  .on('change', (change) => {
    // Emit the update to all clients in the same partyCode room
    //io.to(change.partyCode).emit('party-updated', change);  // Emit to the room associated with the partyCode
    io.emit('party-updated', change);  // Trigger partyChange event on partyEvents
  })
  .on('error', (error) => {
    console.error('Error watching change stream:', error);
  });

Confession.watch()
  .on('change', (change) => {
    io.emit('confessions-updated', change);
  })
  .on('error', (error) => {
    console.error('Error watching change stream:', error);
  });

// Set up a socket connection
io.on('connection', (socket) => {
  console.log('A client connected');

  // Listen for the 'join-party' event from the front end (when users join)
  socket.on('join-party', (partyCode) => {
    console.log(`User joined party with code: ${partyCode}`);

    // Join the room associated with the partyCode
    socket.join(partyCode);  // Add the user to the room corresponding to the partyCode

    // You can also send a message to the user or do other logic when they join
    socket.emit('joined-party', { message: `Successfully joined party ${partyCode}` });
  });

  socket.on('disconnect', () => {
    console.log('A client disconnected');
  });
});

// Route to fetch all confessions
app.get('/api/confessions', async (req, res) => {
  try {
    const data = await Confession.find({});  // This should fetch all documents from the 'confessions' collection
    //console.log('🔍 Data from MongoDB:', data);  // Check what's returned
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

// Route to fetch all confessions
app.get('/api/party-games', async (req, res) => {
  const { partyCode } = req.query;

  try {
    // If partyCode exists, filter by it, otherwise fetch all records
    const filter = partyCode ? { partyId: partyCode } : {};
    const data = await OnlineParty.find(filter);
    res.json(data);
  } catch (err) {
    console.error('❌ Failed to fetch party:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/party-games', async (req, res) => {
  try {
    const { partyId, computerIds, gamemode, usernames, gameSettings, selectedPacks, usersReady, userInstructions, isPlaying, lastPinged, usersLastPing, playerTurn, shuffleSeed, currentCardIndex } = req.body;

    // Find and update the existing party game document by partyId, or create a new one if none exists
    const updatedParty = await OnlineParty.findOneAndUpdate(
      { partyId },  // Search by partyId
      {
        computerIds,
        gamemode,
        usernames,
        gameSettings,
        selectedPacks,
        usersReady,
        userInstructions,
        isPlaying,
        lastPinged,
        usersLastPing,
        playerTurn,
        shuffleSeed,
        currentCardIndex,
      },
      {
        new: true,       // Return the updated document
        upsert: true     // Create a new document if not found
      });

    res.json({ message: 'Party game updated or created successfully', updatedParty });
  } catch (err) {
    console.error("❌ Error saving or updating party game:", err);
    res.status(500).json({ error: 'Failed to save or update party game' });
  }
});

// Route to delete a party game by partyId
app.delete('/api/party-games', async (req, res) => {
  const { partyCode } = req.query;

  if (!partyCode) {
    return res.status(400).json({ error: 'Party code is required' });
  }

  try {
    // Find and delete the party game by partyId
    const deletedParty = await OnlineParty.findOneAndDelete({ partyId: partyCode });

    if (!deletedParty) {
      return res.status(404).json({ error: 'Party game not found' });
    }

    res.json({ message: 'Party game deleted successfully', deletedParty });
  } catch (err) {
    console.error('❌ Error deleting party game:', err);
    res.status(500).json({ error: 'Failed to delete party game' });
  }
});

app.post('/api/party-games/delete', async (req, res) => {
  const { partyCode } = req.body;

  if (!partyCode) {
    return res.status(400).json({ error: 'Party code is required' });
  }

  try {
    const deletedParty = await OnlineParty.findOneAndDelete({ partyId: partyCode });

    if (!deletedParty) {
      return res.status(404).json({ error: 'Party game not found' });
    }

    console.log(`✅ Party ${partyCode} deleted via sendBeacon`);
    res.json({ message: 'Party game deleted successfully', deletedParty });
  } catch (err) {
    console.error('❌ Error deleting party game on unload:', err);
    res.status(500).json({ error: 'Failed to delete party game' });
  }
});


app.post('/api/party-games/remove-user', async (req, res) => {
  try {
    const { partyId, computerIdToRemove } = req.body;

    if (!partyId || !computerIdToRemove) {
      return res.status(400).json({ error: 'partyId and computerIdToRemove are required' });
    }

    // Step 1: Get party as plain object (not a Mongoose doc)
    const party = await OnlineParty.findOne({ partyId }).lean();

    if (!party) {
      return res.status(404).json({ error: 'Party not found' });
    }

    const index = party.computerIds.indexOf(computerIdToRemove);
    if (index === -1) {
      return res.status(400).json({ error: 'Computer ID not found in party' });
    }

    // Step 2: Remove the index from parallel arrays
    const updatedComputerIds = [...party.computerIds];
    const updatedUsernames = [...party.usernames];
    const updatedUsersReady = [...party.usersReady];
    const updatedUsersLastPing = [...party.usersLastPing];

    updatedComputerIds.splice(index, 1);
    updatedUsernames.splice(index, 1);
    updatedUsersReady.splice(index, 1);
    updatedUsersLastPing.splice(index, 1);

    // Step 3: Only update fields you want. Do not touch required ones like userInstructions.
    await OnlineParty.updateOne(
      { partyId },
      {
        $set: {
          computerIds: updatedComputerIds,
          usernames: updatedUsernames,
          usersReady: updatedUsersReady,
          usersLastPing: updatedUsersLastPing
        }
      }
    );

    res.json({ message: 'User removed successfully' });

  } catch (err) {
    console.error('❌ Error removing user from party:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});



// Add security headers using helmet
app.use(helmet());

// Customize specific headers
app.use(helmet.hsts({ maxAge: 31536000, includeSubDomains: true }));
app.use(helmet.contentSecurityPolicy({
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'", "'unsafe-inline'", "https://code.responsivevoice.org", "https://www.googletagmanager.com", "https://*.google-analytics.com", "https://cdnjs.cloudflare.com", "https://script.google.com", "https://script.googleusercontent.com", "https://unpkg.com/compromise", "https://cdn.socket.io/4.8.1/socket.io.min.js", "https://overexposed.app:3000"],
    objectSrc: ["'none'"],
    connectSrc: ["'self'", "https://www.google-analytics.com", "https://*.google-analytics.com", "https://docs.google.com", "https://doc-0g-8s-sheets.googleusercontent.com", "https://script.google.com", "https://script.googleusercontent.com", "https://unpkg.com/compromise", "https://cdn.socket.io/4.8.1/socket.io.min.js", "https://overexposed.app:3000"],
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


/*app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
})); */

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
  res.sendFile(path.join(__dirname, 'public', 'pages', 'homepages', 'homepage.html'));
});

app.get('/party-games', (req, res) => {
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
  const filePath = path.join(__dirname, 'public', 'pages', 'party-games', 'paranoia', 'paranoia-settings-page.html');
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

app.get('/insights', (req, res) => {
  const filePath = path.join(__dirname, 'public', 'pages', 'blog-section', 'blog-landing-page.html');
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


//Blogs
app.get('/insights/final-year-stress', (req, res) => {
  const filePath = path.join(__dirname, 'public', 'pages', 'blog-section', 'blogs', 'final-year-stress.html');
  console.log(`Attempting to serve file from: ${filePath}`);
  res.sendFile(filePath);
});

app.get('/insights/new-years-eve-party', (req, res) => {
  const filePath = path.join(__dirname, 'public', 'pages', 'blog-section', 'blogs', 'nye-party.html');
  console.log(`Attempting to serve file from: ${filePath}`);
  res.sendFile(filePath);
});

app.get('/insights/break-the-ice-not-hearts', (req, res) => {
  const filePath = path.join(__dirname, 'public', 'pages', 'blog-section', 'blogs', 'break-the-ice-not-hearts.html');
  console.log(`Attempting to serve file from: ${filePath}`);
  res.sendFile(filePath);
});
app.get('/insights/valentines-day', (req, res) => {
  const filePath = path.join(__dirname, 'public', 'pages', 'blog-section', 'blogs', 'break-the-ice-not-hearts.html');
  console.log(`Attempting to serve file from: ${filePath}`);
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

server.listen(PORT, () => {
  console.log(`✅ Server listening on port ${PORT}`);
});


