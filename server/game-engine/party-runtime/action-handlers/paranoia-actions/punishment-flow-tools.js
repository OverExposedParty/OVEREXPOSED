function assertParanoiaGamemode({ config, workingParty }) {
  if ((config.gamemode || workingParty.gamemode) !== 'paranoia') {
    const error = new Error('This action is only valid for Paranoia.');
    error.status = 400;
    throw error;
  }
}

function requireTargetActor({ state, actorId, message }) {
  const targetId = state.phaseData?.targetId ?? null;
  if (!targetId || String(targetId) !== String(actorId)) {
    const error = new Error(message);
    error.status = 403;
    throw error;
  }
  return targetId;
}

function requirePunishmentType(payload) {
  const punishmentType = String(payload.punishmentType || '').trim();
  if (!punishmentType) {
    const error = new Error('punishmentType is required.');
    error.status = 400;
    throw error;
  }
  return punishmentType;
}

function setParanoiaPunishmentInProgress({
  state,
  config,
  payload,
  targetId,
  punishmentType,
  appendParanoiaTimelineEvent
}) {
  state.phase = 'paranoia-show-punishment';
  state.phaseData = {
    targetId,
    punishmentType
  };
  state.timer =
    payload.phaseTimer ??
    Date.now() + Number(config.gameRules?.['time-limit'] || 120) * 1000;
  state.lastPinged = new Date();
  appendParanoiaTimelineEvent({
    type: 'punishment-in-progress',
    playerId: targetId,
    targetIds: [targetId],
    punishmentType
  });
}

function resetPunishmentConfirmations(players, getPartyPlayerState) {
  players.forEach((player) => {
    const playerState = getPartyPlayerState(player);
    playerState.isReady = false;
    playerState.hasConfirmed = false;
    player.isReady = false;
    player.hasConfirmed = false;
  });
}

function findPlayerByPartyId(players, getPartyPlayerId, playerId) {
  return players.find(
    (player) => String(getPartyPlayerId(player)) === String(playerId)
  );
}

function appendParanoiaAccountStat({
  workingParty,
  players,
  getPartyPlayerId,
  appendPartyAccountStatEvent,
  createAccountStatEvent,
  player = null,
  playerId,
  paths
}) {
  appendPartyAccountStatEvent(
    workingParty,
    createAccountStatEvent('paranoia', [
      {
        player:
          player ||
          (playerId == null
            ? null
            : findPlayerByPartyId(players, getPartyPlayerId, playerId)),
        paths
      }
    ])
  );
}

function setParanoiaUserPassed({ state, config, reason }) {
  state.phase = null;
  state.phaseData = null;
  config.userInstructions = `USER_HAS_PASSED:${reason}`;
  state.userInstructions = `USER_HAS_PASSED:${reason}`;
  state.lastPinged = new Date();
}

module.exports = {
  appendParanoiaAccountStat,
  assertParanoiaGamemode,
  findPlayerByPartyId,
  requirePunishmentType,
  requireTargetActor,
  resetPunishmentConfirmations,
  setParanoiaPunishmentInProgress,
  setParanoiaUserPassed
};
