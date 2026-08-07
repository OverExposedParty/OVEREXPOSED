const {
  createPartyGameId: createDefaultPartyGameId
} = require('../game-engine/party-runtime/game-session');
const { createReleaseMetadata } = require('./game-mode-releases');

const DEFAULT_ALLOCATION_ATTEMPTS = 5;

function normalizeGamemode(value) {
  return String(value || 'game')
    .trim()
    .toLowerCase();
}

function normalizePartyId(value) {
  return String(value || '')
    .trim()
    .toUpperCase();
}

function isDuplicateKeyError(error) {
  return Number(error?.code) === 11000;
}

function createPartyGameSessionService({
  PartyGameSession,
  createPartyGameId = createDefaultPartyGameId,
  resolveGameModeRelease,
  allocationAttempts = DEFAULT_ALLOCATION_ATTEMPTS
} = {}) {
  function assertRegistryAvailable() {
    if (typeof PartyGameSession?.create !== 'function') {
      const error = new Error('Party game session registry is unavailable.');
      error.status = 503;
      error.code = 'party_game_session_registry_unavailable';
      throw error;
    }
  }

  async function reservePartyGameSession({ partyId, gamemode }) {
    assertRegistryAvailable();

    const normalizedPartyId = normalizePartyId(partyId);
    const normalizedGamemode = normalizeGamemode(gamemode);
    const maximumAttempts = Math.max(1, Number(allocationAttempts) || 1);
    let gameModeRelease;

    try {
      gameModeRelease =
        (await resolveGameModeRelease?.({ gamemode: normalizedGamemode })) ||
        createReleaseMetadata({ gamemode: normalizedGamemode });
    } catch (error) {
      console.warn(
        `Falling back to minimal release metadata for ${normalizedGamemode}:`,
        error.message || error
      );
      gameModeRelease = createReleaseMetadata({
        gamemode: normalizedGamemode
      });
    }

    for (let attempt = 1; attempt <= maximumAttempts; attempt += 1) {
      const gameId = createPartyGameId(normalizedGamemode);
      try {
        await PartyGameSession.create({
          gameId,
          partyId: normalizedPartyId,
          gamemode: normalizedGamemode,
          gameModeRelease,
          status: 'reserved'
        });
        return {
          gameId,
          partyId: normalizedPartyId,
          gamemode: normalizedGamemode,
          gameModeRelease
        };
      } catch (error) {
        if (!isDuplicateKeyError(error)) throw error;
      }
    }

    const error = new Error(
      'Could not allocate a unique game session. Please try again.'
    );
    error.status = 503;
    error.code = 'party_game_session_allocation_failed';
    throw error;
  }

  async function setPartyGameSessionStatus({
    gameId,
    partyId,
    fromStatus,
    status,
    timestampField
  }) {
    if (!gameId || typeof PartyGameSession?.updateOne !== 'function') {
      return false;
    }

    const now = new Date();
    const result = await PartyGameSession.updateOne(
      {
        gameId,
        partyId: normalizePartyId(partyId),
        ...(fromStatus && { status: fromStatus })
      },
      {
        $set: {
          status,
          ...(timestampField && { [timestampField]: now })
        }
      }
    );
    return Number(result?.matchedCount ?? result?.n ?? 0) > 0;
  }

  function activatePartyGameSession({ gameId, partyId }) {
    return setPartyGameSessionStatus({
      gameId,
      partyId,
      fromStatus: 'reserved',
      status: 'active',
      timestampField: 'activatedAt'
    });
  }

  function completePartyGameSession({ gameId, partyId }) {
    return setPartyGameSessionStatus({
      gameId,
      partyId,
      status: 'completed',
      timestampField: 'completedAt'
    });
  }

  function releasePartyGameSession({ gameId, partyId }) {
    return setPartyGameSessionStatus({
      gameId,
      partyId,
      fromStatus: 'reserved',
      status: 'released',
      timestampField: 'releasedAt'
    });
  }

  return {
    activatePartyGameSession,
    completePartyGameSession,
    releasePartyGameSession,
    reservePartyGameSession
  };
}

module.exports = {
  DEFAULT_ALLOCATION_ATTEMPTS,
  createPartyGameSessionService,
  isDuplicateKeyError
};
