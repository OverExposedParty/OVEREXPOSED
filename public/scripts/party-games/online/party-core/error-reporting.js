let onlineErrorReportInFlight = false;
const expectedOnlinePartyErrorCodes = new Set([
  'account_required',
  'guest_session_required',
  'party_host_required',
  'party_network_unavailable',
  'party_not_found',
  'party_or_player_not_found',
  'party_owner_active_party_exists',
  'party_player_account_locked',
  'party_player_forbidden',
  'party_player_not_found',
  'party_replay_stale_session',
  'party_socket_join_timeout',
  'party_switch_conflict',
  'party_switch_game_active',
  'party_switch_same_gamemode',
  'party_switch_stale_session',
  'party_update_conflict'
]);

function shouldReportOnlineGameError(error) {
  const status = Number.isInteger(error?.status) ? error.status : null;
  if (status !== null && status >= 500) return true;
  if (status === 401 || status === 403) return false;

  return !(
    error?.name === 'AbortError' ||
    expectedOnlinePartyErrorCodes.has(error?.code)
  );
}

function getOnlineErrorSnapshotContext(extra = {}) {
  const partyData =
    typeof currentPartyData !== 'undefined' && currentPartyData
      ? currentPartyData
      : null;
  const state = partyData?.state ?? {};
  const config = partyData?.config ?? {};
  const players = Array.isArray(partyData?.players) ? partyData.players : [];
  const me = players.find(
    (player) =>
      player.identity?.computerId === deviceId || player.computerId === deviceId
  );

  return {
    ...extra,
    gamemode: config.gamemode ?? getCurrentGamemodeSlug(),
    phase: state.phase ?? null,
    playerTurn: state.playerTurn ?? null,
    turnPlayerId: Number.isInteger(state.playerTurn)
      ? (players[state.playerTurn]?.identity?.computerId ?? null)
      : null,
    instruction: config.userInstructions ?? state.userInstructions ?? '',
    username: me?.identity?.username ?? onlineUsername ?? '',
    url: window.location.href,
    userAgent: navigator.userAgent
  };
}

function serializeOnlineError(error) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      code: error.code,
      status: Number.isInteger(error.status) ? error.status : null
    };
  }

  if (error && typeof error === 'object') {
    return {
      name: typeof error.name === 'string' ? error.name : 'Error',
      message:
        typeof error.message === 'string'
          ? error.message
          : (() => {
              try {
                return JSON.stringify(error);
              } catch {
                return 'Unknown client error';
              }
            })(),
      stack: typeof error.stack === 'string' ? error.stack : '',
      code: typeof error.code === 'string' ? error.code : '',
      status: Number.isInteger(error.status) ? error.status : null
    };
  }

  return {
    name: 'Error',
    message:
      typeof error === 'string'
        ? error
        : (() => {
            try {
              return JSON.stringify(error);
            } catch {
              return 'Unknown client error';
            }
          })()
  };
}

function reportOnlineGameError(error, context = {}) {
  if (
    !shouldReportOnlineGameError(error) ||
    onlineErrorReportInFlight ||
    !partyCode ||
    typeof sessionPartyType !== 'string'
  ) {
    return;
  }

  onlineErrorReportInFlight = true;

  const payload = {
    partyId: partyCode,
    actorId: typeof deviceId === 'string' ? deviceId : null,
    computerId: typeof deviceId === 'string' ? deviceId : null,
    username: onlineUsername,
    socketId: typeof socket?.id === 'string' ? socket.id : null,
    error: serializeOnlineError(error),
    context: getOnlineErrorSnapshotContext(context)
  };
  const body = JSON.stringify(payload);
  const url = `/api/${sessionPartyType}/error?partyCode=${partyCode}`;

  try {
    if (navigator.sendBeacon) {
      const blob = new Blob([body], { type: 'application/json' });
      if (navigator.sendBeacon(url, blob)) {
        onlineErrorReportInFlight = false;
        return;
      }
    }

    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true
    })
      .catch(() => {})
      .finally(() => {
        onlineErrorReportInFlight = false;
      });
  } catch {
    onlineErrorReportInFlight = false;
  }
}

window.reportOnlineGameError = reportOnlineGameError;
window.shouldReportOnlineGameError = shouldReportOnlineGameError;

window.addEventListener('error', (event) => {
  reportOnlineGameError(event.error || event.message, {
    source: event.filename,
    line: event.lineno,
    column: event.colno
  });
});

window.addEventListener('unhandledrejection', (event) => {
  reportOnlineGameError(event.reason, {
    source: 'unhandledrejection'
  });
});
