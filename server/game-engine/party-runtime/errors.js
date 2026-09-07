const { getRuntimeBuild } = require('../../services/game-mode-releases');
const crypto = require('node:crypto');

const PARTY_ERROR_DEDUPLICATION_WINDOW_MS = 30_000;
const EXPECTED_PARTY_ERROR_CODES = new Set([
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

  function isExpectedPartyError(error = {}) {
    const status = Number.isInteger(error.status) ? error.status : null;
    if (status !== null && status >= 500) return false;
    if (status === 401 || status === 403) return true;

    return (
      error.name === 'AbortError' || EXPECTED_PARTY_ERROR_CODES.has(error.code)
    );
  }

  function shouldRecordPartyError({ err, source = 'server', details = {} }) {
    return !isExpectedPartyError({
      source,
      name: details.name ?? err?.name,
      code: details.code ?? err?.code,
      status: Number.isInteger(details.status) ? details.status : err?.status
    });
  }

  function createPartyErrorFingerprint(entry) {
    const identity = [
      entry?.source,
      entry?.name,
      entry?.code,
      entry?.status,
      entry?.route,
      entry?.method,
      entry?.action,
      entry?.actorId,
      entry?.message
    ]
      .map((value) => (value === undefined || value === null ? '' : value))
      .join('\u001f');

    return crypto.createHash('sha256').update(identity).digest('hex');
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

    const entry = {
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

    entry.fingerprint = createPartyErrorFingerprint(entry);
    return entry;
  }

  async function appendPartyError({
    mainModel,
    waitingRoomModel,
    partyId,
    entry
  }) {
    if (!partyId || !entry || !mainModel) return;

    if (isExpectedPartyError(entry)) return;

    const occurredAt = new Date(entry.occurredAt);
    const duplicateSince = new Date(
      (Number.isNaN(occurredAt.getTime()) ? Date.now() : occurredAt.getTime()) -
        PARTY_ERROR_DEDUPLICATION_WINDOW_MS
    );
    const fingerprint = entry.fingerprint || createPartyErrorFingerprint(entry);
    const savedEntry = { ...entry, fingerprint };

    const update = {
      $push: {
        errors: {
          $each: [savedEntry],
          $slice: -PARTY_ERROR_LOG_LIMIT
        }
      }
    };

    await Promise.allSettled(
      [mainModel, waitingRoomModel].filter(Boolean).map((model) =>
        model.updateOne(
          {
            partyId,
            errors: {
              $not: {
                $elemMatch: {
                  fingerprint,
                  occurredAt: { $gte: duplicateSince }
                }
              }
            }
          },
          update
        )
      )
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
    if (!shouldRecordPartyError({ err, source, details })) return;

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
    createPartyErrorFingerprint,
    createPartyErrorEntry,
    appendPartyError,
    isExpectedPartyError,
    shouldRecordPartyError,
    recordPartyRouteError
  };
}

module.exports = {
  EXPECTED_PARTY_ERROR_CODES,
  PARTY_ERROR_DEDUPLICATION_WINDOW_MS,
  createPartyErrorTools
};
