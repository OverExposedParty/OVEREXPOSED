async function ResetParanoiaQuestion({
  currentPlayerIndex = null,
  nextPlayer = true,
  incrementScore = 0
}) {
  ClearIcons();

  const players = currentPartyData.players || [];

  if (players.length === 0) return;

  const state = getPartyState(currentPartyData);
  const playerTurn = state.playerTurn ?? currentPartyData.playerTurn ?? 0;

  if (currentPlayerIndex == null) {
    const turnPlayer = getParanoiaTurnPlayer(players, state, playerTurn);
    const votedId = getPlayerVote(turnPlayer);

    if (votedId == null) {
      currentPlayerIndex = getParanoiaTurnPlayerIndex(players, state, playerTurn);
    } else {
      currentPlayerIndex = players.findIndex(p => getPlayerId(p) === votedId);
      if (currentPlayerIndex === -1) {
        currentPlayerIndex = getParanoiaTurnPlayerIndex(players, state, playerTurn);
      }
    }
  }
  await ResetQuestion({
    instruction: "DISPLAY_PRIVATE_CARD:READING_CARD",
    timer: Date.now() + gameRules["time-limit"] * 1000,
    playerIndex: currentPlayerIndex,
    nextPlayer,
    incrementScore
  });
}

async function PartySkip({ nextPlayer = true } = {}) {
  await ResetParanoiaQuestion({ nextPlayer });
}
