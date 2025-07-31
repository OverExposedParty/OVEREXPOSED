const rootStyles = getComputedStyle(document.documentElement);
const partyDisbandedContainer = document.getElementById('party-disbanded-container');

const primaryColour = rootStyles.getPropertyValue('--primarypagecolour').trim();
const secondaryColour = rootStyles.getPropertyValue('--secondarypagecolour').trim();
const backgroundColour = rootStyles.getPropertyValue('--backgroundcolour').trim();

let gameContainers = [];
let hostedParty = false;
let waitingForHost = false;
let partyCode;
let lastKnownPing = 0;

const { protocol, hostname } = window.location;
let socket;

if (hostname === 'overexposed.app') {
  socket = io(`${protocol}//${hostname}`);
} else {
  socket = io(`${protocol}//${hostname}:3000`);
}

socket.on('connect', () => {
  console.log('Socket connected successfully');
});

socket.on('connect_error', (err) => {
  console.error('Socket connection error:', err);
});

// Call this when you want to join
function joinParty(partyCode) {
  console.log(`Joining party: ${partyCode}`);
  socket.emit('join-party', partyCode);
}

function leaveParty(partyCode) {
  console.log(`Leaving party: ${partyCode}`);
  socket.emit('leave-party', partyCode);
}

function kickUser(partyCode) {
  console.log(`Kicking self from party: ${partyCode}`);
  socket.emit('kick-user', partyCode);
}


socket.on('joined-party', (data) => {
  console.log(data.message);  // Server confirmation
});

// When the server confirms you've left the party
socket.on('left-party', (partyCode) => {
  console.log(`✅ You left party: ${partyCode}`);
  PartyDisbanded();
});

// When the server tells you that you were kicked
socket.on('kicked-from-party', (partyCode) => {
  console.log(`🥾 You were kicked from party: ${partyCode}`);
});

// Optional: listen for other people joining, leaving, or being kicked
socket.on('user-joined', ({ socketId }) => {
  console.log(`👋 User joined: ${socketId}`);
});

socket.on('user-left', ({ socketId }) => {
  console.log(`👋 User left: ${socketId}`);
});

socket.on('user-kicked', ({ socketId }) => {
  console.log(`🥾 User kicked: ${socketId}`);
});

socket.on('user-disconnected', ({ socketId }) => {
  console.log(`❌ User disconnected: ${socketId}`);
});

socket.on('party-deleted', ({ partyCode }) => {
  console.log(`🛑 Party ${partyCode} has been disbanded.`);
  PartyDisbanded();
});


async function getExistingPartyData(partyId, partyType = sessionPartyType) {
  try {
    const res = await fetch(`/api/${partyType}?partyCode=${partyId}`);
    const existingData = await res.json();
    return existingData;
  } catch (err) {
    console.error('❌ Failed to fetch existing party data:', err);
    throw err;
  }
}

function generateDeviceFingerprint() {
  const fingerprint = [
    navigator.userAgent,
    navigator.language,
    screen.width,
    screen.height,
    screen.colorDepth,
    new Date().getTimezoneOffset(),
    navigator.platform,
    navigator.hardwareConcurrency || 'unknown',
    navigator.deviceMemory || 'unknown',
    getCanvasFingerprint(),
  ].join('|');

  return hashString(fingerprint.trim());
}

// Lightweight canvas fingerprinting
function getCanvasFingerprint() {
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    ctx.textBaseline = 'top';
    ctx.font = "14px 'Arial'";
    ctx.fillStyle = '#f60';
    ctx.fillRect(125, 1, 62, 20);
    ctx.fillStyle = '#069';
    ctx.fillText('fingerprint', 2, 15);
    return canvas.toDataURL();
  } catch (e) {
    return 'unsupported';
  }
}

// Simple hash function (e.g., DJB2)
function hashString(str) {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i);
  }
  return (hash >>> 0).toString(16);
}


function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const chr = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0; // Convert to 32bit integer
  }
  return 'dev_' + Math.abs(hash).toString(36).trim(); // Trim here too
}

const deviceId = generateDeviceFingerprint().trim();
console.log("Device ID: " + deviceId);


function generatePartyCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';

  for (let i = 0; i < 3; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  code += '-';

  for (let i = 0; i < 3; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function updateOnlineParty({
  partyType = sessionPartyType,
  partyId,
  players,
  gamemode,
  gameSettings,
  selectedPacks,
  userInstructions,
  isPlaying,
  lastPinged,
  playerTurn,
  shuffleSeed,
  currentCardIndex,
  currentCardSecondIndex,
  selectedRoles,
  phase,
  generalChat,
  mafiaChat,
  timer
}) {
  const isPartyGame = partyType?.startsWith("party-game-");
  const isPartyGameMafia = partyType === "party-game-mafia";
  const isPartyGameTruthOrDare = partyType === "party-game-truth-or-dare";
  const isPartyGameParanoia = partyType === "party-game-paranoia";
  const isPartyGameMostLikelyTo = partyType === "party-game-most-likely-to";
  const isPartyGameNeverHaveIEver = partyType === "party-game-never-have-i-ever";

  const payload = {
    partyId,
    ...(isPartyGame && {
      ...(players !== undefined && { players }),
      ...(gamemode !== undefined && { gamemode }),
      ...(gameSettings !== undefined && { gameSettings }),
      ...(userInstructions !== undefined && { userInstructions }),
      ...(isPlaying !== undefined && { isPlaying }),
      ...(lastPinged !== undefined && { lastPinged }),
    }),
    ...(!isPartyGameMafia && {
      ...(selectedPacks !== undefined && { selectedPacks }),
      ...(playerTurn !== undefined && { playerTurn }),
      ...(currentCardIndex !== undefined && { currentCardIndex }),
      ...(shuffleSeed !== undefined && { shuffleSeed }),
    }),
    ...(isPartyGameTruthOrDare && {
      ...(currentCardSecondIndex !== undefined && { currentCardSecondIndex }),
    }),
    ...(isPartyGameMafia && {
      ...(selectedRoles !== undefined && { selectedRoles }),
      ...(phase !== undefined && { phase }),
      ...(generalChat !== undefined && { generalChat }),
      ...(mafiaChat !== undefined && { mafiaChat }),
      ...(timer !== undefined && { timer }),
    }),
  };

  postToBothEndpoints(
    payload,
    `/api/${partyType}?partyCode=${partyId}`,
    `/api/waiting-room?partyCode=${partyId}`
  );
}



async function addUserToParty({ partyId, newComputerId, newUsername, newUserReady, newUserConfirmation }) {
  try {
    const existingData = await getExistingPartyData(partyId);
    const currentPartyData = existingData[0] || {};

    // Extract the players array or default to empty
    const players = currentPartyData.players || [];

    // Check if user already exists by computerId
    const existingIndex = players.findIndex(p => p.computerId === newComputerId);

    if (existingIndex !== -1) {
      // User exists, update their info instead
      return UpdateUserPartyData({
        partyId,
        computerId: newComputerId,
        newUsername,
        newUserReady,
        newUserConfirmation,
      });
    }

    // Create new player object
    const newPlayer = {
      computerId: newComputerId,
      username: newUsername,
      isReady: newUserReady,
      hasConfirmed: newUserConfirmation,
      lastPing: new Date()
    };

    const updatedPlayers = [...players, newPlayer];

    return updateOnlineParty({
      partyId,
      players: updatedPlayers,
      gamemode: currentPartyData.gamemode || 'Truth Or Dare',
      isPlaying: currentPartyData.isPlaying || false,
      lastPinged: new Date()
    });
  } catch (err) {
    console.error('❌ Append failed:', err);
    throw err;
  }
}



async function UpdateUserPartyData({ partyId, computerId, newUsername, newUserReady, newUserConfirmation }) {
  try {
    // Step 1: Fetch existing party data
    const existingData = await getExistingPartyData(partyId);

    if (!existingData || existingData.length === 0) {
      throw new Error('No party data found.');
    }
    const currentPartyData = existingData[0];
    const players = currentPartyData.players || [];

    // Step 2: Find player index by computerId
    const index = players.findIndex(player => player.computerId === computerId);

    if (index === -1) {
      throw new Error(`Computer ID "${computerId}" not found in party.`);
    }

    // Step 3: Update values in the player object
    if (newUsername !== undefined) players[index].username = newUsername;
    if (newUserReady !== undefined) players[index].isReady = newUserReady;
    if (newUserConfirmation !== undefined) players[index].hasConfirmed = newUserConfirmation;

    // Optional: update lastPing too if needed
    players[index].lastPing = new Date();

    // Step 4: Send updated data back to the server
    return updateOnlineParty({
      partyId,
      players,
      gamemode: currentPartyData.gamemode || 'default',
      isPlaying: currentPartyData.isPlaying || false,
      lastPinged: new Date(),
    });

  } catch (err) {
    console.error('❌ Update by computerId failed:', err);
    throw err;
  }
}


async function removeUserFromParty(partyId, computerIdToRemove, partyType = sessionPartyType) {
  const url = `/api/${partyType}/remove-user`;
  const payload = { partyId, computerIdToRemove };

  // Use fetch with POST instead of sendBeacon
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const error = await res.json();
    console.error('Failed to remove user:', error);
    return;
  }

  // Now get the updated party
  const partyRes = await fetch(`/api/${partyType}?partyCode=${partyId}`);
  const data = await partyRes.json();
  const allUsersReady = data[0].players.findIndex(player => player.isReady === true);

  if (data[0].computerIds.length === 1) {
    deleteParty();
  } else {
    updateStartGameButton(allUsersReady);
  }
}

// When a party update is received
socket.on("party-updated", async (change, emittedPartyCode) => {
  try {
    const codeToUse = emittedPartyCode || partyCode;
    const res = await fetch(`/api/${sessionPartyType}?partyCode=${codeToUse}`);
    const data = await res.json();

    if (!data || data.length === 0) {
      PartyDisbanded();
      return;
    }
    const latestPing = data[0].lastPinged;
    if (new Date(latestPing).getTime() !== new Date(lastKnownPing).getTime()) {
      console.log('🟢 Party data changed!');
      if (data[0].isPlaying) {
        if (waitingForHost) {
          console.log("start");
          const baseUrl = hostname === 'overexposed.app'
            ? `${protocol}//${hostname}`
            : `${protocol}//${hostname}:3000`;
          transitionSplashScreen(
            `${baseUrl}/${formatPackName(data[0].gamemode)}/${codeToUse}`,
            `/images/splash-screens/${formatPackName(data[0].gamemode)}.png`
          );
          return;
        }
        FetchInstructions();
      }
      else {
        if (hostedParty) {
          partyUserCount = (data[0].players || []).length;
          checkForGameSettingsUpdates(data[0]);
        } else if (waitingForHost) {
          const playerIndex = (data[0].players || []).findIndex(p => p.computerId === deviceId);
          if (playerIndex === -1) {
            KickUser();
          }
        }
      }

      lastKnownPing = latestPing;
    }
  } catch (err) {
    console.error('❌ Error in party-updated handler:', err);
  }
});

async function checkAndDeleteEmptyParty(partyId) {
  try {
    const existingData = await getExistingPartyData(partyId);
    if (!existingData || existingData.length === 0) {
      console.warn('No party data found.');
      return;
    }

    const currentPartyData = existingData[0];
    const players = currentPartyData.players || [];

    const isEmpty = players.length === 0;

    if (isEmpty) {
      await deleteParty(partyId); // Pass partyId if needed by deleteParty
    } else {
      console.log(`Party "${partyId}" still has users. No action taken.`);
    }
  } catch (err) {
    console.error('❌ Error checking or deleting empty party:', err);
  }
}


function deleteParty() {
  if (!partyCode) return;
  const payload = JSON.stringify({ partyCode });
  const blob = new Blob([payload], { type: 'application/json' });
  //leaveParty(partyCode);
  socket.emit('delete-party', partyCode);
  partyCode = null;
  navigator.sendBeacon(`/api/${sessionPartyType}/delete`, blob);
}


async function setIsPlayingForParty(partyId, newIsPlayingValue) {
  try {
    const existingData = await getExistingPartyData(partyId);

    if (!existingData || existingData.length === 0) {
      throw new Error(`No party found with ID ${partyId}`);
    }

    const currentPartyData = existingData[0];

    await updateOnlineParty({
      partyId,
      players: currentPartyData.players, // Pass players array instead of separate arrays
      gamemode: currentPartyData.gamemode,
      isPlaying: newIsPlayingValue,
      lastPinged: Date.now(),
    });

    console.log(`✅ isPlaying updated to ${newIsPlayingValue} for party ${partyId}`);
  } catch (error) {
    console.error('❌ Failed to update isPlaying:', error);
  }
}


async function userPingToParty(deviceId, partyId) {
  try {
    const existingData = await getExistingPartyData(partyId);
    if (!existingData || existingData.length === 0) {
      throw new Error('No party data found.');
    }

    const currentPartyData = existingData[0];
    const players = currentPartyData.players || [];

    const index = players.findIndex(player => player.computerId === deviceId);
    if (index === -1) {
      throw new Error(`Device ID "${deviceId}" not found in party.`);
    }

    // Update lastPing for the player
    players[index].lastPing = new Date();

    // Update the whole players array
    return updateOnlineParty({
      partyId,
      players
    });
  } catch (err) {
    console.error('❌ Failed to ping user in party:', err);
    throw err;
  }
}



function formatPackName(name) {
  return name.toLowerCase().replace(/\s+/g, '-');
}

function PartyDisbanded() {
  try {
    if (gameContainers) {
      gameContainers.forEach(gameContainer => gameContainer.classList.remove('active'));
      partyDisbandedContainer.classList.add('active');
    }
  } catch (e) { }
}

function postToBothEndpoints(payload, endpoint1, endpoint2) {
  const options = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  };

  return Promise.all([
    fetch(endpoint1, options).then(res => res.json()),
    fetch(endpoint2, options).then(res => res.json())
  ])
    .then(([data1, data2]) => {
      // Both POSTs succeeded
      return { primary: data1, secondary: data2 };
    })
    .catch(err => {
      console.error('❌ One or both POSTs failed:', err);
      throw err;
    });
}

function setActiveContainers(...activeContainers) {
  const uniqueActiveContainers = new Set(activeContainers);

  gameContainers.forEach(container => {
    if (uniqueActiveContainers.has(container)) {
      container.classList.add('active');
    } else {
      container.classList.remove('active');
    }
  });
}

window.addEventListener('beforeunload', function () {
  if (hostDeviceId != deviceId) return;
  deleteParty();
});