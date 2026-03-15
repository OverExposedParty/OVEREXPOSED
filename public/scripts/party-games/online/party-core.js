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

function setupMobileButtonHoverFlash() {
  const isTouchLikeDevice = window.matchMedia('(hover: none), (pointer: coarse)').matches;
  if (!isTouchLikeDevice) return;

  const hoverFlashClass = 'touchhover';
  const hoverFlashDurationMs = 220;
  const buttonSelector = '.tap-hover-flash';
  const hoverTimeoutMap = new WeakMap();

  document.addEventListener('pointerdown', (event) => {
    const tappedButton = event.target.closest(buttonSelector);
    if (!tappedButton) return;
    if (tappedButton.disabled || tappedButton.classList.contains('disabled')) return;

    const existingTimeout = hoverTimeoutMap.get(tappedButton);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    tappedButton.classList.add(hoverFlashClass);
    const timeoutId = setTimeout(() => {
      tappedButton.classList.remove(hoverFlashClass);
      hoverTimeoutMap.delete(tappedButton);
    }, hoverFlashDurationMs);

    hoverTimeoutMap.set(tappedButton, timeoutId);
  }, { passive: true });
}

setupMobileButtonHoverFlash();

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

function ensureOnlineStatusContainer({
  id,
  title,
  description = ""
}) {
  let container = document.getElementById(id);

  if (!container) {
    container = document.createElement("div");
    container.id = id;
    const mainContainer = document.querySelector(".main-container");
    (mainContainer || document.body).appendChild(container);
  }

  container.className = "online-status-container";
  container.innerHTML = `
    <div class="content-container">
      <h1>${title}</h1>
      ${description ? `<p>${description}</p>` : ""}
    </div>
  `;

  return container;
}

function replaceHeadLink(selector, href, cacheBustKey = null) {
  const existingLink = document.querySelector(selector);
  if (!existingLink) return;

  const nextLink = existingLink.cloneNode(true);
  nextLink.href = typeof versionAssetUrl === "function"
    ? versionAssetUrl(href, { cacheBustKey })
    : href;
  existingLink.replaceWith(nextLink);
}

function setPartyDoesNotExistFavicons() {
  const faviconBasePath = "/images/meta/favicons/party-games/party-does-not-exist";

  replaceHeadLink('link[rel="icon"][type="image/x-icon"]', `${faviconBasePath}/favicon.ico`);
  replaceHeadLink('link[rel="icon"][sizes="16x16"]', `${faviconBasePath}/favicon-16x16.png`);
  replaceHeadLink('link[rel="icon"][sizes="32x32"]', `${faviconBasePath}/favicon-32x32.png`);
  replaceHeadLink('link[rel="apple-touch-icon"]', `${faviconBasePath}/apple-touch-icon.png`);
  replaceHeadLink('link[rel="manifest"]', `${faviconBasePath}/site.webmanifest`);
}

function getCurrentGamemodeSlug() {
  if (typeof window.location?.pathname === "string") {
    const segments = window.location.pathname.split('/').filter(Boolean);
    if (segments.length > 0) {
      return segments[0].trim().toLowerCase();
    }
  }

  if (typeof formattedGamemode === "string" && formattedGamemode.trim()) {
    return formattedGamemode.trim().toLowerCase().replace(/\s+/g, '-');
  }

  return "";
}

function setGameAlreadyStartedFavicons() {
  const gamemode = getCurrentGamemodeSlug();

  if (!gamemode) return;

  const faviconBasePath = `/images/meta/favicons/party-games/${gamemode}/in-game-locked`;

  replaceHeadLink('link[rel="icon"][type="image/x-icon"]', `${faviconBasePath}/favicon.ico`);
  replaceHeadLink('link[rel="icon"][sizes="16x16"]', `${faviconBasePath}/favicon-16x16.png`);
  replaceHeadLink('link[rel="icon"][sizes="32x32"]', `${faviconBasePath}/favicon-32x32.png`);
  replaceHeadLink('link[rel="apple-touch-icon"]', `${faviconBasePath}/apple-touch-icon.png`);
  replaceHeadLink('link[rel="manifest"]', `${faviconBasePath}/site.webmanifest`);
}

function ShowPartyDoesNotExistState() {
  document.body.classList.add("party-missing-state");
  document.documentElement.style.setProperty('--primarypagecolour', '#999999');
  document.documentElement.style.setProperty('--secondarypagecolour', '#666666');
  setPartyDoesNotExistFavicons();

  const statusContainer = ensureOnlineStatusContainer({
    id: "party-does-not-exist",
    title: "Party does not exist",
    description: "Check the code and try joining again."
  });

  setActiveContainers();
  statusContainer.classList.add("active");
  const titlePrefix = typeof formattedGamemode === "string" && formattedGamemode.trim()
    ? formattedGamemode.toUpperCase()
    : "WAITING ROOM";
  document.title = `${titlePrefix} | PARTY DOES NOT EXIST`;
}

function ShowGameAlreadyStartedState() {
  document.body.classList.add("party-missing-state");
  setGameAlreadyStartedFavicons();

  const statusContainer = ensureOnlineStatusContainer({
    id: "game-already-started",
    title: "Game Already Started",
    description: "You can’t join mid-game. create a new game."
  });

  setActiveContainers();
  statusContainer.classList.add("active");
  const titlePrefix = typeof formattedGamemode === "string" && formattedGamemode.trim()
    ? formattedGamemode.toUpperCase()
    : "WAITING ROOM";
  document.title = `${titlePrefix} | GAME ALREADY STARTED`;
}

function dispatchOnlinePageColours(primary, secondary) {
  if (!primary || !secondary) return;

  document.documentElement.style.setProperty('--primarypagecolour', primary);
  document.documentElement.style.setProperty('--secondarypagecolour', secondary);
  document.dispatchEvent(new CustomEvent('page-colours-updated', {
    detail: { primary, secondary }
  }));
}

function getOnlinePackByCardType(cardType) {
  if (!cardType || !Array.isArray(cardPackMap)) return null;

  const searchPackName = String(cardType).trim().toLowerCase();
  if (!searchPackName) return null;

  return cardPackMap.find(pack => {
    const packNameLower = pack.packName?.toLowerCase?.();
    return packNameLower === searchPackName;
  }) || null;
}

function applyOnlinePackTheme(cardType) {
  const matchedPack = getOnlinePackByCardType(cardType);
  if (!matchedPack) return null;

  dispatchOnlinePageColours(matchedPack.packColour, matchedPack.packSecondaryColour);
  return matchedPack;
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
