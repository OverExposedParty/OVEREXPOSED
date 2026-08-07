const { getRuntimeBuild } = require('../../services/game-mode-releases');

function createPartyErrorTools(deps) {
  const {
    PARTY_ERROR_LOG_LIMIT,
    PARTY_ID_PATTERN,
    debugWarn,
    getPartyPlayerId,
    shouldUsePlayerTurnOrder,
    getTurnPlayer,
    getPartyRuntimeBuild = getRuntimeBuild
  } = deps;

  function truncateErrorText(value, maxLength = 2000) {
    if (value === undefined || value === null) return '';
    const text = String(value);
    return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
  }

  function getPartyIdFromRequest(req) {
    const candidate =
      req.body?.partyId ??
      req.body?.partyCode ??
      req.query?.partyCode ??
      req.params?.partyCode ??
      null;
    return typeof candidate === 'string' && PARTY_ID_PATTERN.test(candidate)
      ? candidate
      : null;
  }

  function getErrorActorId(req, details = {}) {
    return (
      details.actorId ??
      req.body?.actorId ??
      req.body?.actorComputerId ??
      req.body?.computerId ??
      req.body?.newComputerId ??
      req.body?.identity?.computerId ??
      null
    );
  }

  function getTurnPlayerIdForError(party, state, players) {
    const playerTurn = state?.playerTurn ?? null;
    if (!Number.isInteger(playerTurn)) return null;

    const turnPlayer = shouldUsePlayerTurnOrder(party)
      ? getTurnPlayer(players, state, playerTurn)
      : players[playerTurn];

    return getPartyPlayerId(turnPlayer);
  }

  function createPartyErrorEntry({
    err,
    req,
    party,
    source = 'server',
    details = {}
  }) {
    const config = party?.config ?? {};
    const state = party?.state ?? {};
    const players = Array.isArray(party?.players) ? party.players : [];
    const actorId = getErrorActorId(req, details);
    const actorPlayer =
      players.find((player) => getPartyPlayerId(player) === actorId) ?? null;
    const actorIdentity = actorPlayer?.identity ?? {};
    const savedGameModeRelease = party?.session?.gameModeRelease;
    const gameModeRelease = savedGameModeRelease?.toObject
      ? savedGameModeRelease.toObject()
      : savedGameModeRelease || null;

    return {
      occurredAt: new Date(),
      source,
      message: truncateErrorText(
        details.message ?? err?.message ?? 'Unknown party error',
        500
      ),
      name: truncateErrorText(details.name ?? err?.name ?? 'Error', 120),
      code: truncateErrorText(details.code ?? err?.code ?? '', 120),
      status: Number.isInteger(details.status)
        ? details.status
        : Number.isInteger(err?.status)
          ? err.status
          : null,
      stack: truncateErrorText(details.stack ?? err?.stack ?? '', 4000),
      route: truncateErrorText(req?.originalUrl ?? req?.url ?? '', 500),
      method: req?.method ?? '',
      action: truncateErrorText(details.action ?? req.body?.action ?? '', 120),
      actorId,
      computerId:
        details.computerId ??
        actorIdentity.computerId ??
        req.body?.computerId ??
        req.body?.newComputerId ??
        null,
      username:
        details.username ??
        actorIdentity.username ??
        req.body?.username ??
        req.body?.newUsername ??
        '',
      socketId:
        details.socketId ??
        actorPlayer?.connection?.socketId ??
        req.body?.socketId ??
        req.body?.newUserSocketId ??
        null,
      playerTurn: Number.isInteger(state?.playerTurn) ? state.playerTurn : null,
      turnPlayerId: getTurnPlayerIdForError(party, state, players),
      phase: state?.phase ?? null,
      instruction: config?.userInstructions ?? state?.userInstructions ?? '',
      gamemode: config?.gamemode ?? party?.gamemode ?? null,
      gameModeRelease,
      runtimeBuild: getPartyRuntimeBuild(),
      details: details.details ?? null
    };
  }

  async function appendPartyError({
    mainModel,
    waitingRoomModel,
    partyId,
    entry
  }) {
    if (!partyId || !entry || !mainModel) return;

    const update = {
      $push: {
        errors: {
          $each: [entry],
          $slice: -PARTY_ERROR_LOG_LIMIT
        }
      }
    };

    await Promise.allSettled(
      [mainModel, waitingRoomModel]
        .filter(Boolean)
        .map((model) => model.updateOne({ partyId }, update))
    );
  }

  async function recordPartyRouteError({
    err,
    req,
    mainModel,
    waitingRoomModel,
    source = 'server',
    details = {}
  }) {
    const partyId = details.partyId ?? getPartyIdFromRequest(req);
    if (!partyId || !mainModel) return;

    try {
      const party = await mainModel.findOne({ partyId }).lean();
      if (!party) return;

      await appendPartyError({
        mainModel,
        waitingRoomModel,
        partyId,
        entry: createPartyErrorEntry({ err, req, party, source, details })
      });
    } catch (logErr) {
      debugWarn('Failed to write party error log:', logErr);
    }
  }

  return {
    createPartyErrorEntry,
    appendPartyError,
    recordPartyRouteError
  };
}

module.exports = {
  createPartyErrorTools
};
