let partyUserCount = 0;
let onlinePartyExpiryMonitorId = null;
const ONLINE_PARTY_EXPIRY_CHECK_INTERVAL_MS = 10000;
window.currentOnlineShuffleSeed = window.currentOnlineShuffleSeed ?? null;
let activePartyLobbyLockRefresh = null;
let activePartyLobbySession = null;
let recentlyDeletedOnlinePartyCode = '';
let recentlyDeletedOnlinePartyCodeExpiresAt = 0;
const PARTY_GAME_API_ROUTE_PATTERN =
  /^party-game-(truth-or-dare|paranoia|never-have-i-ever|most-likely-to|imposter|would-you-rather|mafia)$/;

function suppressActiveLobbyLockForDeletedParty(code) {
  const normalizedCode = String(code || '').trim().toUpperCase();
  if (!normalizedCode) return;
  recentlyDeletedOnlinePartyCode = normalizedCode;
  recentlyDeletedOnlinePartyCodeExpiresAt = Date.now() + 15000;
}

function isRecentlyDeletedOnlineParty(session) {
  if (!session?.code || !recentlyDeletedOnlinePartyCode) return false;
  if (Date.now() > recentlyDeletedOnlinePartyCodeExpiresAt) {
    recentlyDeletedOnlinePartyCode = '';
    recentlyDeletedOnlinePartyCodeExpiresAt = 0;
    return false;
  }
  return (
    String(session.code || '').trim().toUpperCase() ===
    recentlyDeletedOnlinePartyCode
  );
}

function getSettingsPartyCodeFromUrl() {
  try {
    return new URLSearchParams(window.location.search).get('partyCode') || '';
  } catch {
    return '';
  }
}

function isSameOnlineSettingsLobby(session) {
  if (!session?.code) return false;
  const currentCode = partyCode || getSettingsPartyCodeFromUrl();
  return (
    String(session.key || '') === String(partyGameMode || '') &&
    String(session.code || '').toUpperCase() ===
      String(currentCode || '').toUpperCase()
  );
}

function setOnlineButtonLockedByActiveLobby(session) {
  const previousActivePartyLobbySession = activePartyLobbySession;
  const isLocked = Boolean(session && !isSameOnlineSettingsLobby(session));
  activePartyLobbySession = isLocked ? session : null;

  if (previousActivePartyLobbySession !== activePartyLobbySession) {
    window.dispatchEvent(
      new CustomEvent('oe-active-party-lobby-state-changed', {
        detail: {
          active: isLocked,
          session: activePartyLobbySession
        }
      })
    );
  }

  return !isLocked;
}

function getActivePartyApiRoute(session) {
  const explicitRoute = String(session?.apiRoute || '').trim();
  if (PARTY_GAME_API_ROUTE_PATTERN.test(explicitRoute)) {
    return explicitRoute;
  }

  const gamemode = String(session?.gamemode || session?.key || '')
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-');
  const derivedRoute = `party-game-${gamemode}`;
  return PARTY_GAME_API_ROUTE_PATTERN.test(derivedRoute) ? derivedRoute : '';
}

async function leaveActivePartyLobby(session = activePartyLobbySession) {
  const partyCode = String(
    session?.partyCode || session?.code || ''
  ).trim().toUpperCase();
  const apiRoute = getActivePartyApiRoute(session);
  const playerComputerId = String(
    session?.playerComputerId || ''
  ).trim();

  if (
    !/^[A-Z0-9]{3}-[A-Z0-9]{3}$/.test(partyCode) ||
    !PARTY_GAME_API_ROUTE_PATTERN.test(apiRoute) ||
    !playerComputerId
  ) {
    throw new Error('The active party membership could not be verified.');
  }

  const response = await fetch(`/api/${apiRoute}/remove-user`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      partyId: partyCode,
      computerIdToRemove: playerComputerId,
      actorComputerId: playerComputerId,
      exitIntent: 'create-party'
    })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.success === false) {
    const serverError = payload?.error || {};
    const error = new Error(
      serverError.message || 'Failed to leave the active party.'
    );
    error.code = serverError.code || 'party_leave_failed';
    error.status = response.status;
    throw error;
  }

  setOnlineButtonLockedByActiveLobby(null);
  window.dispatchEvent(
    new CustomEvent('oe-active-party-lobby-left', {
      detail: { partyCode }
    })
  );
  return true;
}

async function endActiveOwnedParty(session = activePartyLobbySession) {
  const partyCode = String(
    session?.partyCode || session?.code || ''
  ).trim().toUpperCase();
  const apiRoute = getActivePartyApiRoute(session);

  if (
    !/^[A-Z0-9]{3}-[A-Z0-9]{3}$/.test(partyCode) ||
    !apiRoute
  ) {
    throw new Error('The active party ownership could not be verified.');
  }

  const response = await fetch(`/api/${apiRoute}/delete`, {
    method: 'POST',
    credentials: 'same-origin',
    keepalive: true,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ partyCode })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.success === false) {
    const serverError = payload?.error || {};
    const error = new Error(
      serverError.message || 'Failed to end the active party.'
    );
    error.code = serverError.code || 'party_disband_failed';
    error.status = response.status;
    throw error;
  }

  setOnlineButtonLockedByActiveLobby(null);
  window.dispatchEvent(
    new CustomEvent('oe-active-party-lobby-disbanded', {
      detail: { partyCode }
    })
  );
  return true;
}

async function refreshActivePartyLobbyLock() {
  try {
    const response = await fetch('/api/accounts/friends/active-party-lobby', {
      cache: 'no-store',
      credentials: 'same-origin'
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload?.success === false) return true;
    const data = payload?.data || payload;
    const session = data?.active ? data.session : null;
    if (isRecentlyDeletedOnlineParty(session)) {
      return setOnlineButtonLockedByActiveLobby(null);
    }
    return setOnlineButtonLockedByActiveLobby(
      session
    );
  } catch (error) {
    console.warn('Failed to refresh active party lobby lock:', error);
    return true;
  }
}

function startActivePartyLobbyLockRefresh() {
  if (activePartyLobbyLockRefresh) return;
  window.setTimeout(refreshActivePartyLobbyLock, 500);
  activePartyLobbyLockRefresh = window.setInterval(
    refreshActivePartyLobbyLock,
    10000
  );
}

window.refreshActivePartyLobbyLock = refreshActivePartyLobbyLock;
window.getActivePartyLobbySession = () => activePartyLobbySession;
window.endActiveOwnedParty = endActiveOwnedParty;
window.leaveActivePartyLobby = leaveActivePartyLobby;
window.clearActivePartyLobbyLock = () =>
  setOnlineButtonLockedByActiveLobby(null);

window.addEventListener('oe-active-party-lobby-left', () => {
  window.clearActivePartyLobbyLock?.();
  refreshActivePartyLobbyLock();
});
