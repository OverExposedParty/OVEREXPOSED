function createPartyRoomContext(context) {
  const {
    ONLINE_GAMEMODE_MAX_PLAYERS,
    partyGameTruthOrDareSchema,
    partyGameParanoiaSchema,
    partyGameNeverHaveIEverSchema,
    partyGameMostLikelyToSchema,
    partyGameImposterSchema,
    partyGameWouldYouRatherSchema,
    partyGameMafiaSchema,
    defaultOeIcon = '0000:0100:0200:0300'
  } = context;

  function formatRoundedDuration(startDate, endDate) {
    if (!startDate || !endDate) return '-';

    const startTimestamp = new Date(startDate).getTime();
    const endTimestamp = new Date(endDate).getTime();
    if (!Number.isFinite(startTimestamp) || !Number.isFinite(endTimestamp)) {
      return '-';
    }

    const elapsedMinutes = Math.round(
      Math.abs(endTimestamp - startTimestamp) / 60000
    );

    if (elapsedMinutes < 1) return '<1m';
    if (elapsedMinutes < 60) return `${elapsedMinutes}m`;

    const elapsedHours = Math.round(elapsedMinutes / 60);
    if (elapsedHours < 24) return `${elapsedHours}h`;

    return `${Math.round(elapsedHours / 24)}d`;
  }

  function getRoomPlayerCount(room) {
    return Array.isArray(room.players) ? room.players.length : 0;
  }

  function getRoomPlayerSummary(room) {
    const players = Array.isArray(room.players) ? room.players : [];
    const isArchivedSnapshot = Boolean(room.archivedAt);
    const hostComputerIds = new Set(
      [
        room.state?.hostComputerId,
        ...(Array.isArray(room.state?.hostComputerIdList)
          ? room.state.hostComputerIdList
          : [])
      ].filter(Boolean)
    );
    let accountPlayers = 0;
    let guestPlayers = 0;
    let connectedPlayers = 0;
    let readyPlayers = 0;

    const identities = players.map((player, index) => {
      const identity = player.identity || player;
      const username =
        identity.username || player.username || `Player ${index + 1}`;
      const accountId = identity.accountId || player.accountId;
      const computerId = identity.computerId || player.computerId;
      const isHost = Boolean(player.isHost || hostComputerIds.has(computerId));
      const isConnected = Boolean(
        player.connection?.socketId || player.connection?.lastPing
      );
      const isReady = Boolean(player.state?.isReady);
      if (accountId) accountPlayers += 1;
      else guestPlayers += 1;
      if (isConnected) connectedPlayers += 1;
      if (isReady) readyPlayers += 1;

      return [
        username,
        accountId ? `account ${String(accountId)}` : 'guest',
        isHost ? 'host' : '',
        isReady ? 'ready' : '',
        isArchivedSnapshot
          ? 'archived snapshot'
          : isConnected
            ? 'connected'
            : 'disconnected',
        Number.isFinite(Number(player.state?.score))
          ? `score ${Number(player.state.score)}`
          : ''
      ]
        .filter(Boolean)
        .join(' · ');
    });

    return {
      identities: identities.join('\n') || '-',
      accountPlayers,
      guestPlayers,
      connectedPlayers: isArchivedSnapshot ? null : connectedPlayers,
      disconnectedPlayers: isArchivedSnapshot
        ? null
        : Math.max(0, players.length - connectedPlayers),
      readyPlayers
    };
  }

  function getRoomVisual(room) {
    const players = Array.isArray(room.players) ? room.players : [];
    const isArchivedSnapshot = Boolean(room.archivedAt);
    const hostComputerIds = new Set(
      [
        room.state?.hostComputerId,
        ...(Array.isArray(room.state?.hostComputerIdList)
          ? room.state.hostComputerIdList
          : [])
      ]
        .filter(Boolean)
        .map(String)
    );
    const normalizeRecord = (value) => {
      if (!value) return {};
      if (value instanceof Map) return Object.fromEntries(value);
      return typeof value === 'object' ? value : {};
    };

    return {
      players: players.map((player, index) => {
        const identity = player.identity || player;
        const computerId = identity.computerId || player.computerId;
        const participationStatus = player.state?.participationStatus || '';
        const hasConnection = Boolean(
          player.connection?.socketId || player.connection?.lastPing
        );

        return {
          username:
            identity.username || player.username || `Player ${index + 1}`,
          userIcon:
            identity.userIcon || player.userIcon || String(defaultOeIcon),
          isHost: Boolean(
            player.isHost ||
            (computerId && hostComputerIds.has(String(computerId)))
          ),
          accountType:
            identity.accountId || player.accountId ? 'Account' : 'Guest',
          connectionStatus: isArchivedSnapshot
            ? 'Archived snapshot'
            : participationStatus
              ? participationStatus
                  .split('_')
                  .map(
                    (part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`
                  )
                  .join(' ')
              : hasConnection
                ? 'Connected'
                : 'Disconnected',
          isReady: Boolean(player.state?.isReady),
          score: Number.isFinite(Number(player.state?.score))
            ? Number(player.state.score)
            : null
        };
      }),
      selectedPacks: Array.isArray(room.config?.selectedPacks)
        ? room.config.selectedPacks
        : [],
      roleCounts: normalizeRecord(room.config?.roleCounts),
      gameRules: normalizeRecord(room.config?.gameRules)
    };
  }

  function getRoomOutcome(room) {
    return (
      room.state?.outcome ||
      room.state?.result ||
      room.outcome ||
      room.result ||
      'Not recorded'
    );
  }

  function serializeRoomErrors(room) {
    const errors = Array.isArray(room.errors) ? room.errors : [];

    return errors.map((error) => ({
      occurredAt: error.occurredAt || null,
      source: error.source || 'server',
      message: error.message || 'Unknown room error',
      name: error.name || 'Error',
      code: error.code || '',
      status: Number.isInteger(error.status) ? error.status : null,
      action: error.action || '',
      actorId: error.actorId || '',
      computerId: error.computerId || '',
      username: error.username || '',
      playerTurn: Number.isInteger(error.playerTurn) ? error.playerTurn : null,
      turnPlayerId: error.turnPlayerId || '',
      phase: error.phase || '',
      instruction: error.instruction || '',
      gamemode: error.gamemode || room.config?.gamemode || room.gamemode || '',
      details: error.details || null
    }));
  }

  function getRoomErrorSummary(errors) {
    if (!Array.isArray(errors) || errors.length === 0) return '-';

    const groupedErrors = new Map();

    errors.forEach((error) => {
      const label = [
        error.name && error.name !== 'Error' ? error.name : '',
        error.message || 'Unknown room error'
      ]
        .filter(Boolean)
        .join(': ');
      const key = [
        label,
        error.code || '',
        error.status ?? '',
        error.action || '',
        error.phase || ''
      ].join('|');
      const existing = groupedErrors.get(key);

      if (existing) {
        existing.count += 1;
        return;
      }

      groupedErrors.set(key, {
        label,
        count: 1
      });
    });

    return [...groupedErrors.values()]
      .map((error) =>
        error.count > 1 ? `${error.label} (${error.count})` : error.label
      )
      .join('\n');
  }

  function getRoomInstruction(room) {
    return (
      room.config?.userInstructions ??
      room.state?.userInstructions ??
      room.userInstructions ??
      ''
    );
  }

  function formatRoomDetailValue(value) {
    if (value == null || value === '') return '-';
    if (value instanceof Date) return value.toLocaleString();
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  }

  function getRoomIssueSeverity(error) {
    const status = Number(error.status);
    if (error.source === 'client') return 'high';
    if (Number.isFinite(status) && status >= 500) return 'high';
    if (Number.isFinite(status) && status >= 400) return 'medium';
    return 'low';
  }

  function createRoomIssueAlert(room, error, roomStatus) {
    const occurredAt = error.occurredAt ? new Date(error.occurredAt) : null;
    const timeLabel =
      occurredAt && !Number.isNaN(occurredAt.getTime())
        ? occurredAt.toLocaleString()
        : 'Unknown time';
    const actorLabel = error.username || error.computerId || error.actorId;
    const phaseLabel = error.phase ? `phase ${error.phase}` : '';
    const detail = [timeLabel, actorLabel, phaseLabel, roomStatus]
      .filter(Boolean)
      .join(' | ');

    return {
      title: error.message || 'Unknown room error',
      roomCode: room.roomCode || '-',
      detail,
      severity: getRoomIssueSeverity(error),
      'container-type': 'room-issue',
      containerType: 'room-issue',
      occurredAt: error.occurredAt || null,
      source: error.source || 'server',
      gamemode: error.gamemode || room.gamemode || '-',
      action: error.action || '',
      playerTurn: error.playerTurn,
      diagnostics: [
        `Issue: ${error.message || 'Unknown room error'}`,
        `Room: ${room.roomCode || '-'}`,
        `Gamemode: ${error.gamemode || room.gamemode || '-'}`,
        `Status: ${roomStatus || '-'}`,
        `Severity: ${getRoomIssueSeverity(error)}`,
        `Occurred: ${timeLabel}`,
        `Source: ${error.source || 'server'}`,
        `Phase: ${error.phase || '-'}`,
        `Action: ${error.action || '-'}`,
        `Actor: ${error.username || error.computerId || error.actorId || '-'}`,
        `Code: ${error.code || '-'}`,
        `HTTP status: ${error.status ?? '-'}`
      ].join('\n'),
      issue: {
        message: error.message || 'Unknown room error',
        details:
          typeof error.details === 'string'
            ? error.details
            : error.details
              ? JSON.stringify(error.details, null, 2)
              : error.instruction || error.message || '-',
        source: error.source || 'server',
        severity: getRoomIssueSeverity(error),
        occurredAt: timeLabel,
        phase: error.phase || '-',
        action: error.action || '-',
        playerTurn: Number.isInteger(error.playerTurn)
          ? String(error.playerTurn)
          : '-',
        actor: error.username || error.computerId || error.actorId || '-',
        username: error.username || '-',
        computerId: error.computerId || '-',
        code: error.code || '-',
        status: error.status ?? '-'
      },
      room: {
        roomCode: room.roomCode || '-',
        gameId: room.gameId || '-',
        gamemode: error.gamemode || room.gamemode || '-',
        roomStatus: roomStatus || '-',
        playerCount: room.playerCount || '-',
        hostUser: room.hostUser || '-',
        createdAt: room.createdAt || '-',
        lastUpdated: room.lastUpdated || '-',
        archivedAt: room.archivedAt
          ? new Date(room.archivedAt).toLocaleString()
          : '-',
        sourceCollection: room.sourceCollection || '-'
      }
    };
  }

  function serializeActiveRoom(room, sourceCollection) {
    const gamemode = room.config?.gamemode || null;
    const maxPlayers = ONLINE_GAMEMODE_MAX_PLAYERS[gamemode] ?? null;
    const playerCount = getRoomPlayerCount(room);
    const errors = serializeRoomErrors(room);
    const createdAt = room.session?.createdAt;
    const lastUpdated = room.state?.lastPinged;
    const phase = room.state?.phase ?? null;
    const instruction = getRoomInstruction(room);
    const playerSummary = getRoomPlayerSummary(room);
    const roomVisual = getRoomVisual(room);

    return {
      roomCode: room.partyId || '-',
      gameId: room.session?.gameId || '-',
      gamemode: gamemode || '-',
      date: createdAt ? new Date(createdAt).toISOString().slice(0, 10) : '-',
      playerCount: maxPlayers
        ? `${playerCount}/${maxPlayers}`
        : String(playerCount),
      timeLapsed: formatRoundedDuration(createdAt, lastUpdated),
      serverRegion: room.session?.serverRegion || '-',
      roomStatus: room.state?.isPlaying ? 'In Game' : 'Lobby',
      hostUser:
        room.host?.username ||
        room.hostUsername ||
        room.createdBy ||
        roomVisual.players.find((player) => player.isHost)?.username ||
        '-',
      createdAt: createdAt ? new Date(createdAt).toLocaleString() : '-',
      lastUpdated: lastUpdated ? new Date(lastUpdated).toLocaleString() : '-',
      reportCount: Array.isArray(room.reports)
        ? String(room.reports.length)
        : '0',
      errorCount: String(errors.length),
      errorSummary: getRoomErrorSummary(errors),
      spectators: Array.isArray(room.spectators)
        ? String(room.spectators.length)
        : '0',
      visibility: room.config?.visibility || room.visibility || 'Public',
      sourceCollection,
      phase: formatRoomDetailValue(phase),
      instruction: instruction || '-',
      players: playerSummary.identities,
      accountPlayers: String(playerSummary.accountPlayers),
      guestPlayers: String(playerSummary.guestPlayers),
      connectedPlayers: String(playerSummary.connectedPlayers ?? '-'),
      disconnectedPlayers: String(playerSummary.disconnectedPlayers ?? '-'),
      readyPlayers: String(playerSummary.readyPlayers),
      selectedPacks: room.config?.selectedPacks?.join(', ') || '-',
      roleCounts: formatRoomDetailValue(room.config?.roleCounts),
      gameRules: formatRoomDetailValue(room.config?.gameRules),
      currentRound: formatRoomDetailValue(
        room.state?.round ?? room.state?.currentRound ?? room.state?.roundNumber
      ),
      playerTurn: formatRoomDetailValue(room.state?.playerTurn),
      outcome: formatRoomDetailValue(getRoomOutcome(room)),
      stateSummary: formatRoomDetailValue(room.state),
      configSummary: formatRoomDetailValue(room.config),
      roomVisual,
      errors,
      details: {
        'Game ID': room.session?.gameId || '-',
        'Created At': room.session?.createdAt
          ? new Date(room.session.createdAt).toLocaleString()
          : '-',
        Phase: formatRoomDetailValue(phase),
        Instructions: instruction || '-',
        'Phase Data': formatRoomDetailValue(room.state?.phaseData),
        'Source Collection': sourceCollection
      }
    };
  }

  function serializeArchivedRoom(room) {
    const playerCount = getRoomPlayerCount(room);
    const errors = serializeRoomErrors(room);
    const createdAt = room.session?.createdAt || room.archivedAt;
    const lastUpdated = room.session?.endedAt || room.archivedAt;
    const phase = room.state?.phase ?? null;
    const instruction = getRoomInstruction(room);
    const playerSummary = getRoomPlayerSummary(room);
    const roomVisual = getRoomVisual(room);

    return {
      roomCode: room.partyId || '-',
      gameId: room.gameId || '-',
      gamemode: room.gamemode || '-',
      date: createdAt ? new Date(createdAt).toISOString().slice(0, 10) : '-',
      playerCount: String(playerCount),
      timeLapsed: formatRoundedDuration(createdAt, lastUpdated),
      serverRegion: room.session?.serverRegion || '-',
      roomStatus: 'Archived',
      hostUser:
        room.host?.username ||
        room.hostUsername ||
        room.createdBy ||
        roomVisual.players.find((player) => player.isHost)?.username ||
        '-',
      createdAt: createdAt ? new Date(createdAt).toLocaleString() : '-',
      lastUpdated: lastUpdated ? new Date(lastUpdated).toLocaleString() : '-',
      reportCount: Array.isArray(room.reports)
        ? String(room.reports.length)
        : '0',
      errorCount: String(errors.length),
      errorSummary: getRoomErrorSummary(errors),
      spectators: Array.isArray(room.spectators)
        ? String(room.spectators.length)
        : '0',
      visibility: room.config?.visibility || room.visibility || 'Archived',
      sourceCollection: room.sourceCollection || 'archived-rooms',
      archivedAt: room.archivedAt || null,
      phase: formatRoomDetailValue(phase),
      instruction: instruction || '-',
      players: playerSummary.identities,
      accountPlayers: String(playerSummary.accountPlayers),
      guestPlayers: String(playerSummary.guestPlayers),
      connectedPlayers: String(playerSummary.connectedPlayers ?? '-'),
      disconnectedPlayers: String(playerSummary.disconnectedPlayers ?? '-'),
      readyPlayers: String(playerSummary.readyPlayers),
      selectedPacks: room.config?.selectedPacks?.join(', ') || '-',
      roleCounts: formatRoomDetailValue(room.config?.roleCounts),
      gameRules: formatRoomDetailValue(room.config?.gameRules),
      currentRound: formatRoomDetailValue(
        room.state?.round ?? room.state?.currentRound ?? room.state?.roundNumber
      ),
      playerTurn: formatRoomDetailValue(room.state?.playerTurn),
      outcome: formatRoomDetailValue(getRoomOutcome(room)),
      stateSummary: formatRoomDetailValue(room.state),
      configSummary: formatRoomDetailValue(room.config),
      roomVisual,
      errors,
      details: {
        'Game ID': room.gameId || '-',
        'Archived At': room.archivedAt
          ? new Date(room.archivedAt).toLocaleString()
          : '-',
        Phase: formatRoomDetailValue(phase),
        Instructions: instruction || '-',
        'Phase Data': formatRoomDetailValue(room.state?.phaseData),
        'Source Collection': room.sourceCollection || '-'
      }
    };
  }

  function getPartyGameRoomSources() {
    return [
      ['party-game-truth-or-dare', partyGameTruthOrDareSchema],
      ['party-game-paranoia', partyGameParanoiaSchema],
      ['party-game-never-have-i-ever', partyGameNeverHaveIEverSchema],
      ['party-game-most-likely-to', partyGameMostLikelyToSchema],
      ['party-game-imposter', partyGameImposterSchema],
      ['party-game-would-you-rather', partyGameWouldYouRatherSchema],
      ['party-game-mafia', partyGameMafiaSchema]
    ];
  }

  return {
    formatRoundedDuration,
    getRoomPlayerCount,
    getRoomPlayerSummary,
    getRoomOutcome,
    serializeRoomErrors,
    getRoomErrorSummary,
    getRoomInstruction,
    formatRoomDetailValue,
    getRoomIssueSeverity,
    createRoomIssueAlert,
    serializeActiveRoom,
    serializeArchivedRoom,
    getPartyGameRoomSources
  };
}

module.exports = {
  createPartyRoomContext
};
