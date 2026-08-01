const WAITING_ROOM_GAMEMODE_STORAGE_PREFIX = 'oe-waiting-room-gamemode:';
const WAITING_ROOM_GAMEMODES = new Set([
  'truth-or-dare',
  'paranoia',
  'never-have-i-ever',
  'most-likely-to',
  'imposter',
  'would-you-rather',
  'mafia'
]);

function rememberWaitingRoomGamemode(partyId, gamemode) {
  const normalisedPartyId = String(partyId || '')
    .trim()
    .toUpperCase();
  const normalisedGamemode = String(gamemode || '')
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-');

  if (
    !/^[A-Z0-9]{3}-[A-Z0-9]{3}$/.test(normalisedPartyId) ||
    !WAITING_ROOM_GAMEMODES.has(normalisedGamemode)
  ) {
    return false;
  }

  try {
    sessionStorage.setItem(
      `${WAITING_ROOM_GAMEMODE_STORAGE_PREFIX}${normalisedPartyId}`,
      normalisedGamemode
    );
    return true;
  } catch {
    return false;
  }
}

function waitForScriptDataLoaded(scriptPath, { timeout = 5000 } = {}) {
  const basePath = scriptPath.split('?')[0];

  return new Promise((resolve, reject) => {
    const start = performance.now();

    function tick() {
      const script = [...document.scripts].find((candidate) => {
        const src = candidate.getAttribute('src') || '';
        return src.split('?')[0] === basePath;
      });

      if (script?.dataset.loaded === 'true') {
        resolve();
        return;
      }

      if (performance.now() - start > timeout) {
        reject(
          new Error(`Timed out waiting for ${basePath} to finish loading.`)
        );
        return;
      }

      requestAnimationFrame(tick);
    }

    tick();
  });
}

function waitForWaitingRoomRetry(delayMs) {
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}

async function fetchWaitingRoomPartyData() {
  const response = await fetch(
    `/api/waiting-room?partyCode=${encodeURIComponent(partyCode)}`,
    { cache: 'no-store' }
  );
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(
      payload.error ||
        payload.message ||
        `Failed to fetch waiting room party with status ${response.status}`
    );
  }
  const data = await response.json();

  if (!Array.isArray(data) || data.length === 0) {
    return null;
  }

  return data[0];
}

function isUsableWaitingRoomPartyData(partyData) {
  const gamemode = partyData?.config?.gamemode;
  const gamemodeInfo =
    typeof partyGamesInformation === 'object' && partyGamesInformation
      ? partyGamesInformation[gamemode]
      : null;

  return Boolean(
    gamemode &&
      partyData.state &&
      Array.isArray(partyData.players) &&
      gamemodeInfo
  );
}

async function getWaitingRoomPartyData({
  retries = 0,
  delayMs = 200,
  requireUsable = false
} = {}) {
  let latestPartyData = null;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    latestPartyData = await fetchWaitingRoomPartyData();

    if (!requireUsable) {
      if (latestPartyData || attempt >= retries) {
        return latestPartyData;
      }

      await waitForWaitingRoomRetry(delayMs);
      continue;
    }

    if (isUsableWaitingRoomPartyData(latestPartyData)) {
      return latestPartyData;
    }

    if (!latestPartyData && attempt >= retries) {
      return null;
    }

    if (latestPartyData && attempt >= retries) {
      throw new Error('Waiting room party data is not ready yet.');
    }

    await waitForWaitingRoomRetry(delayMs);
  }

  return latestPartyData;
}

function stopWaitingRoomDisbandMonitor() {
  if (!waitingRoomDisbandMonitor) {
    return;
  }

  clearInterval(waitingRoomDisbandMonitor);
  waitingRoomDisbandMonitor = null;
}

function startWaitingRoomDisbandMonitor() {
  stopWaitingRoomDisbandMonitor();

  waitingRoomDisbandMonitor = setInterval(async () => {
    if (!partyCode) {
      stopWaitingRoomDisbandMonitor();
      return;
    }

    try {
      const waitingRoomPartyData = await getWaitingRoomPartyData();

      if (!waitingRoomPartyData) {
        stopWaitingRoomDisbandMonitor();
        PartyDisbanded();
      }
    } catch (error) {
      console.error('Failed to monitor waiting room party state:', error);
    }
  }, WAITING_ROOM_DISBAND_FALLBACK_INTERVAL_MS);
}
