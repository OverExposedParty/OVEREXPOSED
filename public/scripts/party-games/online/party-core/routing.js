function getOnlinePartyLobbyDestination(party, { forceWaitingRoom = false } = {}) {
  const config = party?.config || {};
  const state = party?.state || {};
  const gamemode = config.gamemode || partyGameMode || getCurrentGamemodeSlug();
  const code = party?.partyId || partyCode;
  const isHost =
    !forceWaitingRoom &&
    state.hostComputerId &&
    String(state.hostComputerId) === String(deviceId);

  if (isHost && gamemode && code) {
    return `/${formatPackName(gamemode)}/settings?partyCode=${encodeURIComponent(code)}`;
  }

  return code ? `/${encodeURIComponent(code)}` : '/';
}

function isCurrentOnlineGamemodePartyRoute(party) {
  const gamemode = party?.config?.gamemode || partyGameMode;
  const code = party?.partyId || partyCode;
  if (!gamemode || !code) return false;

  const expectedPath = `/${formatPackName(gamemode)}/${code}`.toLowerCase();
  return window.location.pathname.replace(/\/$/, '').toLowerCase() === expectedPath;
}

function redirectOnlinePartyToLobby(party, options = {}) {
  if (!party) return false;

  loadingPage = true;
  const destination = getOnlinePartyLobbyDestination(party, options);
  const gamemode = party?.config?.gamemode || partyGameMode || 'overexposed';
  const splashName = options.forceWaitingRoom
    ? formatPackName(gamemode)
    : `${formatPackName(gamemode)}-settings`;

  if (typeof transitionSplashScreen === 'function') {
    transitionSplashScreen(
      destination,
      `/images/splash-screens/${splashName}.png`
    );
  } else {
    window.location.assign(destination);
  }
  return true;
}

window.getOnlinePartyLobbyDestination = getOnlinePartyLobbyDestination;
window.isCurrentOnlineGamemodePartyRoute = isCurrentOnlineGamemodePartyRoute;
window.redirectOnlinePartyToLobby = redirectOnlinePartyToLobby;

debugLog('PARTY CODE: ' + partyCode);

window.onlinePartySettingsResumePending = Boolean(
  partyCode &&
  /\/settings\/?$/i.test(window.location.pathname) &&
  new URLSearchParams(window.location.search).get('partyCode') === partyCode
);
