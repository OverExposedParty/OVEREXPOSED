let onlineErrorReportInFlight = false;

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
      stack: error.stack
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
