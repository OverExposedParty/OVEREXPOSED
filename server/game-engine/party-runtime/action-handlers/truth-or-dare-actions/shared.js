function assertTruthOrDareAction(context) {
  const { config, workingParty } = context;
  if ((config.gamemode || workingParty.gamemode) === 'truth-or-dare') return;

  const error = new Error('This action is only valid for Truth or Dare.');
  error.status = 400;
  throw error;
}

function getCurrentTurnPlayer(context) {
  const { getTurnPlayer, getPartyPlayerId, players, state } = context;
  const playerTurn = state.playerTurn ?? 0;
  const player = getTurnPlayer(players, state, playerTurn);

  return { playerTurn, player, playerId: getPartyPlayerId(player) };
}

function assertCurrentTurnPlayer(context, message) {
  const { actorId } = context;
  const turn = getCurrentTurnPlayer(context);
  if (turn.playerId && String(turn.playerId) === String(actorId)) return turn;

  const error = new Error(message);
  error.status = 403;
  throw error;
}

function appendPunishmentChoiceTimelineEvent(context, player, punishmentType) {
  context.appendTruthOrDareTimelineEvent({
    type: 'punishment-in-progress',
    player,
    punishmentType
  });
}

module.exports = {
  assertTruthOrDareAction,
  getCurrentTurnPlayer,
  assertCurrentTurnPlayer,
  appendPunishmentChoiceTimelineEvent
};
