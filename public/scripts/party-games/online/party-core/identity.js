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
    getCanvasFingerprint()
  ].join('|');

  return hashString(fingerprint.trim());
}

function getOrCreateDeviceID() {
  let deviceID = localStorage.getItem('device-id');

  if (!deviceID) {
    // Take the current timestamp in milliseconds and convert to base36
    const timestamp = Date.now().toString(36).slice(-5); // last 5 chars
    // Add 4 random base36 characters
    const randomPart = Math.random().toString(36).substring(2, 6);

    // Combine -> total 9 characters
    const uniquePart = (timestamp + randomPart).substring(0, 9);

    deviceID = 'dev_' + uniquePart;

    localStorage.setItem('device-id', deviceID);
  }

  return deviceID;
}

// const deviceId = generateDeviceFingerprint().trim();
const deviceId = getOrCreateDeviceID();
debugLog('Device ID: ' + deviceId);

function getStoredOnlineAccount() {
  try {
    return JSON.parse(localStorage.getItem('oe-account')) || null;
  } catch {
    return null;
  }
}

async function getCurrentOnlineAccount() {
  const storedAccount = getStoredOnlineAccount();
  if (storedAccount?.username) {
    return storedAccount;
  }

  try {
    const response = await fetch('/api/accounts/me', {
      credentials: 'same-origin'
    });
    const payload = await response.json().catch(() => ({}));
    return payload?.account || null;
  } catch {
    return null;
  }
}

function getPartyPlayerComputerId(player) {
  return player?.identity?.computerId ?? player?.computerId ?? null;
}

function getPartyPlayerAccountId(player) {
  return player?.identity?.accountId ?? player?.accountId ?? null;
}

function getPartyHostPlayer(party) {
  const hostComputerId = party?.state?.hostComputerId;
  if (!hostComputerId || !Array.isArray(party?.players)) return null;

  return (
    party.players.find(
      (player) =>
        String(getPartyPlayerComputerId(player)) === String(hostComputerId)
    ) || null
  );
}

function getPartyOriginalHostAccountId(party) {
  return (
    party?.session?.access?.originalHostAccountId ||
    getPartyPlayerAccountId(getPartyHostPlayer(party))
  );
}

async function getCurrentOnlineAccountId() {
  const storedAccount = getStoredOnlineAccount();
  const storedAccountId =
    storedAccount?.id || storedAccount?._id || storedAccount?.accountId;
  if (storedAccountId) {
    return storedAccountId;
  }

  try {
    const response = await fetch('/api/accounts/me', {
      credentials: 'same-origin'
    });
    const payload = await response.json().catch(() => ({}));
    const freshAccount = payload?.account || null;
    return freshAccount?.id || freshAccount?._id || freshAccount?.accountId || null;
  } catch {
    return null;
  }
}

async function getHostedOnlineSettingsAccess(party) {
  const hostPlayer = getPartyHostPlayer(party);
  const hostComputerId = getPartyPlayerComputerId(hostPlayer);
  const hostAccountId = getPartyOriginalHostAccountId(party);
  const currentAccountId = await getCurrentOnlineAccountId();
  const isHostByAccount =
    hostAccountId &&
    currentAccountId &&
    String(hostAccountId) === String(currentAccountId);
  const isHostByDevice =
    hostComputerId && String(hostComputerId) === String(deviceId);

  return {
    hostPlayer,
    hostComputerId,
    isHost: Boolean(isHostByAccount || isHostByDevice)
  };
}

function getOrCreateOnlineGuestUsername() {
  if (typeof window.getOrCreateOeGuestUsername === 'function') {
    return window.getOrCreateOeGuestUsername();
  }

  const digits = Array.from({ length: 8 }, () =>
    Math.floor(Math.random() * 10)
  ).join('');
  return `OE${digits}`;
}

function makeOnlineUsernameUnique(username, players = []) {
  const takenUsernames = new Set(
    players
      .filter((player) => player?.identity?.computerId !== deviceId)
      .map((player) => player?.identity?.username || player?.username)
      .filter(Boolean)
      .map((name) => String(name).toLowerCase())
  );

  if (!takenUsernames.has(String(username).toLowerCase())) {
    return username;
  }

  for (let index = 2; index < 100; index += 1) {
    const candidate = `${username}${index}`;
    if (!takenUsernames.has(candidate.toLowerCase())) {
      return candidate;
    }
  }

  return `${username}${Date.now().toString(36).slice(-4).toUpperCase()}`;
}

async function resolveOnlineUsername(players = []) {
  const account = await getCurrentOnlineAccount();
  const accountUsername = account?.username?.trim();
  const username = accountUsername || getOrCreateOnlineGuestUsername();

  return makeOnlineUsernameUnique(username, players);
}

function getStoredUserIconString() {
  if (typeof getUserIconString === 'function') {
    return getUserIconString();
  }

  return '0000:0100:0200:0300';
}

window.resolveOnlineUsername = resolveOnlineUsername;
window.getStoredUserIconString = getStoredUserIconString;
window.getPartyPlayerComputerId = getPartyPlayerComputerId;
window.getPartyPlayerAccountId = getPartyPlayerAccountId;
window.getPartyHostPlayer = getPartyHostPlayer;
window.getPartyOriginalHostAccountId = getPartyOriginalHostAccountId;
window.getCurrentOnlineAccountId = getCurrentOnlineAccountId;
window.getHostedOnlineSettingsAccess = getHostedOnlineSettingsAccess;

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
    hash = (hash << 5) - hash + chr;
    hash |= 0; // Convert to 32bit integer
  }
  return 'dev_' + Math.abs(hash).toString(36).trim();
}
