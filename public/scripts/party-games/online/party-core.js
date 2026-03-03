// party-core.js
let hostDeviceId = "";
let hostedParty = false;
let waitingForHost = false;
let loadingPage = false;
let isPlaying = false;
let lastKnownPing = 0;
let onlineUsername = 'N/A';

const { protocol, hostname } = window.location;
let socket;

let partyCode =
  window.location.pathname
    .match(/\/([A-Za-z0-9]{3}-[A-Za-z0-9]{3})(?:\/|$)/)?.[1] ?? null;

console.log("PARTY CODE: " + partyCode);


// Basic Socket.IO client init
socket = io();

socket.on('connect', () => {
  console.log('Socket connected successfully');
});

socket.on('connect_error', (err) => {
  console.error('Socket connection error:', err);
});

// ---------- Device / Fingerprint ----------

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

// const deviceId = generateDeviceFingerprint().trim();
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

// Simple hash function (keep ONE implementation)
function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const chr = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0; // Convert to 32bit integer
  }
  return 'dev_' + Math.abs(hash).toString(36).trim();
}

// ---------- Utility helpers ----------

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

function formatPackName(name) {
  return name.toLowerCase().replace(/\s+/g, '-');
}

function PartyDisbanded() {
  try {
    if (gameContainers) {
      if (!partyGameStatisticsContainer.classList.contains('active')) {
        setActiveContainers(partyDisbandedContainer);
      }
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

// Game rules helpers
function getIncrementContainerValue(key) {
  if (!Array.isArray(partyRulesSettings)) return null;

  const entry = partyRulesSettings.find(rule => {
    const [ruleKey] = rule.split(':');
    return ruleKey.includes(key);
  });

  if (!entry) return null;

  const [, value] = entry.split(':');
  return Number(value);
}

// Game page loader
async function CheckGamePage() {
  waitForFunction("SetScriptLoaded", () => {
    SetScriptLoaded('/scripts/party-games/online/online-settings.js');
  });
}

// Checks if this client should become host based on hostComputerIdList ordering
async function checkAndMaybeBecomeHost({ party, deviceId, onlineUsername }) {
  const players = party.players || [];
  const config = party.config ?? party;
  const state = party.state ?? party;
  const deck = party.deck ?? party;

  if (!state) return null;

  const hostList = Array.isArray(state.hostComputerIdList)
    ? state.hostComputerIdList
    : [];

  const currentHostId = state.hostComputerId || null;

  const hostIndex = currentHostId ? hostList.indexOf(currentHostId) : -1;
  const myIndex = hostList.indexOf(deviceId);

  if (myIndex === -1) return currentHostId;

  let resolvedHostId = currentHostId;

  if (hostIndex === -1 || myIndex < hostIndex) {
    resolvedHostId = deviceId;
    state.hostComputerId = deviceId;

    await updateOnlineParty({
      partyId: party.partyId || party.partyCode || partyCode,
      config,
      state,
      deck,
      players
    });

    if (typeof sendPartyChat === "function" && onlineUsername) {
      sendPartyChat({
        username: "[CONSOLE]",
        message: `${onlineUsername} is now the host.`,
        eventType: "connect"
      });
    }
  }

  return resolvedHostId;
}

async function SendPlayerDataToParty(player) {
  const existingData = await getExistingPartyData(partyCode);
  const updatedPartyData = existingData[0];
  console.log(updatedPartyData.players);
  const playerIndex = updatedPartyData.players.findIndex(p => getPlayerId(p) === deviceId);
  if (playerIndex === -1) return;
  updatedPartyData.players[playerIndex] = player;

  updatedPartyData.state.lastPinged = Date.now();
  await updateOnlineParty({ partyId: partyCode, players: updatedPartyData.players, state: updatedPartyData.state });
}