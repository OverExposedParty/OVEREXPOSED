
let partyDisbandedContainer = document.getElementById('party-disbanded-container');

let gameContainers = [];
let hostedParty = false;
let waitingForHost = false;
let loadingPage = false;
let isPlaying = false;
let partyCode;
let lastKnownPing = 0;
let onlineUsername = 'N/A';

const { protocol, hostname } = window.location;
let socket;

//if (hostname === 'overexposed.app') {
//  socket = io(`${protocol}//${hostname}`);
//} else {
//  socket = io(`${protocol}//${hostname}:3000`);
//}

socket = io(); 


socket.on('connect', () => {
  console.log('Socket connected successfully');
});

socket.on('connect_error', (err) => {
  console.error('Socket connection error:', err);
});

// Call this when you want to join
async function joinParty(partyCode) {
  console.log(`Joining party: ${partyCode}`);
  socket.emit('join-party', partyCode);
}

async function leaveParty(partyCode) {
  const currentPartyData = await GetCurrentPartyData();
  const index = currentPartyData.players.findIndex(player => player.computerId === deviceId);
  currentPartyData.players[index].socketId = null;

  await updateOnlineParty({
    partyId: partyCode,
    players: currentPartyData.players,
    lastPinged: Date.now(),
  });

  console.log(`Leaving party: ${partyCode}`);
  socket.emit('leave-party', partyCode);
}

async function kickUser(partyCode) {
  const currentPartyData = await GetCurrentPartyData();
  const index = currentPartyData.players.findIndex(player => player.computerId === deviceId);
  currentPartyData.players[index].socketId = null;

  await updateOnlineParty({
    partyId: partyCode,
    players: currentPartyData.players,
    lastPinged: Date.now(),
  });

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

async function GetCurrentPartyData() {
  const existingData = await getExistingPartyData(partyCode);
  if (!existingData || existingData.length === 0) {
    console.warn('No party data found.');
    return;
  }
  return existingData[0];
}

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

async function getPartyChatLog() {
  try {
    const res = await fetch(`/api/chat/${partyCode}`);
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

function getOrCreateDeviceID() {
  let deviceID = localStorage.getItem("device-id");

  if (!deviceID) {
    // Take the current timestamp in milliseconds and convert to base36
    const timestamp = Date.now().toString(36).slice(-5); // last 5 chars
    // Add 4 random base36 characters
    const randomPart = Math.random().toString(36).substring(2, 6);

    // Combine -> total 9 characters
    const uniquePart = (timestamp + randomPart).substring(0, 9);

    deviceID = "dev_" + uniquePart;

    localStorage.setItem("device-id", deviceID);
  }

  return deviceID;
}

//const deviceId = generateDeviceFingerprint().trim();
const deviceId = getOrCreateDeviceID();
console.log("Device ID: " + deviceId);

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
  questionType,
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
      ...(questionType !== undefined && { questionType }),
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



async function addUserToParty({ partyId, newComputerId, newUsername, newUserIcon, newUserReady = false, newUserConfirmation = false }) {
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
        newUserIcon,
        newUserReady,
        newUserConfirmation,
      });
    }

    // Create new player object
    const newPlayer = {
      computerId: newComputerId,
      username: newUsername,
      userIcon: "0000:0100:0200:0300",
      isReady: newUserReady,
      hasConfirmed: newUserConfirmation,
      lastPing: new Date(),
      socketId: null,
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

async function UpdateUserReady({ partyId, computerId, newReady, newConfirmation }) {
  try {
    await UpdateUserPartyData({
      partyId,
      computerId,
      newUserReady: newReady,
      newUserConfirmation: newConfirmation
    });
  } catch (err) {
    console.error('❌ Failed to update user ready status:', err);
    throw err;
  }
}

async function UpdateUserPartyData({ partyId, computerId, newUsername, newUserIcon, newUserReady, newUserConfirmation, newUserSocketId }) {
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
    if (newUserIcon !== undefined) players[index].userIcon = newUserIcon;
    if (newUserReady !== undefined) players[index].isReady = newUserReady;
    if (newUserConfirmation !== undefined) players[index].hasConfirmed = newUserConfirmation;
    if (newUserSocketId !== undefined) players[index].socketId = newUserSocketId;

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
  allUsersReady = data[0].players.every(player => player.isReady === true);

  if (data[0].players.length === 0) {
    DeleteParty();
  } else {
    updateStartGameButton(allUsersReady);
  }
}

// When a party update is received
socket.on("party-updated", async ({ type, emittedPartyCode, documentKey }) => {
  try {
    const codeToUse = partyCode || emittedPartyCode.partyId;
    const res = await fetch(`/api/${sessionPartyType}?partyCode=${codeToUse}`);
    const data = await res.json();

    if (!data || data.length === 0) {
      PartyDisbanded();
      return;
    }
    if (!isPlaying) {
      partyUserCount = (data[0].players || []).length;
      const playerIndex = (data[0].players || []).findIndex(p => p.computerId === deviceId);
      if (playerIndex === -1) {
        KickUser();
      }
      checkForGameSettingsUpdates(data[0]);
      if (waitingForHost || hostedParty) {
        UpdateGamemodeContainer();
      }
    }
    const latestPing = data[0].lastPinged;
    if (new Date(latestPing).getTime() !== new Date(lastKnownPing).getTime()) {
      console.log('🟢 Party data changed!');
      if (data[0].isPlaying) {
        if (waitingForHost) {
          loadingPage = true;
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
        if(isPlaying) {
          FetchInstructions();
        }
      }
      lastKnownPing = latestPing;
    }
  } catch (err) {
    console.error('❌ Error in party-updated handler:', err);
  }
});

socket.on("chat-updated", ({ type, chatLog, documentKey }) => {
  console.log("💬 Chat updated:", type, chatLog);

  if (type === "delete") {
    //CreateChatMessage("[CONSOLE]", "Party disbanded.", "error", Date.now());
    return;
  }
  // Update UI with the chat array
  DisplayChatLogs();
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
      await DeleteParty(partyId); // Pass partyId if needed by deleteParty
    } else {
      console.log(`Party "${partyId}" still has users. No action taken.`);
    }
  } catch (err) {
    console.error('❌ Error checking or deleting empty party:', err);
  }
}


function DeleteParty() {
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
      players: currentPartyData.players,
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
      CreateChatMessage("[CONSOLE]", "PARTY HAS BEEN DISBANDED.", "disconnect", Date.now());
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
  if (activeContainers.length === 0) {
    gameContainers.forEach(container => container.classList.remove('active'));
    return;
  }

  const uniqueActiveContainers = new Set(activeContainers);

  gameContainers.forEach(container => {
    if (uniqueActiveContainers.has(container)) {
      container.classList.add('active');
    } else {
      container.classList.remove('active');
    }
  });
}

// Handles removing user on page exit
function removeUserOnExit() {
  if (!partyCode) return;
  if (loadingPage) return;

  // Payload for waiting-room includes gamemode
  const waitingRoomPayload = {
    partyId: partyCode,
    computerIdToRemove: deviceId,
    gamemode: partyGameMode || undefined
  };

  // Payload for main session
  const sessionPayload = {
    partyId: partyCode,
    computerIdToRemove: deviceId
  };

  // Send beacon to remove from waiting-room if applicable
  if (sessionPartyType === "waiting-room") {
    const blob = new Blob([JSON.stringify(waitingRoomPayload)], { type: "application/json" });
    const success = navigator.sendBeacon(`/api/waiting-room/remove-user`, blob);
    console.log("🚀 Beacon to waiting-room queued:", success, waitingRoomPayload);
  }

  // Send beacon to remove from main session
  const blobSession = new Blob([JSON.stringify(sessionPayload)], { type: "application/json" });
  const successSession = navigator.sendBeacon(`/api/${sessionPartyType}/remove-user`, blobSession);
  console.log("🚀 Beacon to session queued:", successSession, sessionPayload);
}

function disconnectUserOnExit() {
  if (!partyCode || loadingPage) return;

  const sessionPayload = {
    partyId: partyCode,
    computerId: deviceId
  };

  const blobSession = new Blob([JSON.stringify(sessionPayload)], { type: "application/json" });
  const successSession = navigator.sendBeacon(`/api/${sessionPartyType}/disconnect-user`, blobSession);
  console.log("🚀 Beacon to session queued:", successSession, sessionPayload);
}



// Use both visibilitychange and beforeunload for maximum reliability
window.addEventListener("beforeunload", disconnectUserOnExit);


function getFilePathByCustomisationId(customisationId) {
  const allItems = [
    ...colourSlot,
    ...headSlot,
    ...eyesSlot,
    ...mouthSlot
  ];
  const match = allItems.find(item => item.id === customisationId);
  return match ? match.filePath : null;
}

function toKebabCase(input) {
  return input.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
}

function RemoveUserFromParty(computerIdToRemove) {
  let payload = {};
  if (partyCode && computerIdToRemove && loadingPage == false) {
    payload = { partyId: partyCode, computerIdToRemove };
    // ✅ Debug log
    console.log("🚀 Sending beacon on unload:", payload);

    const data = JSON.stringify(payload);
    const blob = new Blob([data], { type: "application/json" });
    navigator.sendBeacon(`/api/${sessionPartyType}/remove-user`, blob);
  }
}

//Game Settings
async function GetAllUsersReady() {
  const partyRes = await fetch(`/api/${sessionPartyType}?partyCode=${partyCode}`);
  const data = await partyRes.json();
  if (data[0].players.length === 1) return false;
  return data[0].players.slice(1).every(player => player.isReady === true);
}



//Chat
async function sendPartyChat({ username = "[CONSOLE]", message, eventType = "message" }) { //eventType = "message" | "connect" | "disconnect"
  if (!message || !username) return;

  if (!partyCode) {
    CreateChatMessage("[CONSOLE]", "UNABLE TO SEND MESSAGE: NO PARTY CODE", "error", Date.now());
    return;
  }
  try {
    const response = await fetch(`/api/chat/${partyCode}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, message, eventType })
    });

    const result = await response.json();
    if (result.success) {
      console.log("Message sent!");
      if (chatLogInput) chatLogInput.value = "";
    } else {
      console.error("Failed to send message:", result.error);
    }
  } catch (err) {
    console.error("Error sending chat message:", err);
  }
}

async function DeletePartyChat() {
  if (!partyCode) return;
  try {
    const res = await fetch(`/api/chat/${partyCode}`, { method: 'DELETE' });
    const data = await res.json();
    console.log(data);
  } catch (err) {
    console.error('Error deleting chat:', err);
  }
}
