function assertMostLikelyToGamemode({ config, workingParty }) {
  if ((config.gamemode || workingParty.gamemode) !== 'most-likely-to') {
    const error = new Error('This action is only valid for Most Likely To.');
    error.status = 400;
    throw error;
  }
}

function requireMostLikelyToPunishmentPhase({ state, expectedPhase, message }) {
  const phaseData = state.phaseData || {};
  const targetId = phaseData.targetId ?? null;

  if (state.phase !== expectedPhase || !targetId) {
    const error = new Error(message);
    error.status = 409;
    throw error;
  }

  return { phaseData, targetId };
}

function assertMostLikelyToTargetActor({ actorId, targetId, message }) {
  if (!actorId || String(actorId) !== String(targetId)) {
    const error = new Error(message);
    error.status = 403;
    throw error;
  }
}

function requireMostLikelyToPunishmentType(payload = {}) {
  const punishmentType = String(payload.punishmentType || '').trim();
  if (!punishmentType) {
    const error = new Error('punishmentType is required.');
    error.status = 400;
    throw error;
  }
  return punishmentType;
}

function getMostLikelyToPlayerIndexById(players, getPartyPlayerId, playerId) {
  return players.findIndex(
    (player) => String(getPartyPlayerId(player)) === String(playerId)
  );
}

module.exports = {
  assertMostLikelyToGamemode,
  assertMostLikelyToTargetActor,
  getMostLikelyToPlayerIndexById,
  requireMostLikelyToPunishmentPhase,
  requireMostLikelyToPunishmentType
};
