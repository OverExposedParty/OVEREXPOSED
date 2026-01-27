async function FetchInstructions() {
  currentPartyData = await GetCurrentPartyData();
  if (!currentPartyData) {
    PartyDisbanded();
    return;
  }

  await UpdatePartyGameStatistics();

  const config = getPartyConfig(currentPartyData);
  const state  = getPartyState(currentPartyData);
  const players = currentPartyData.players || [];

  const instructions = getUserInstructions(currentPartyData);
  const playerTurn = state.playerTurn ?? currentPartyData.playerTurn ?? 0;

  if (!instructions || typeof instructions !== 'string') {
    console.log("No instructions to process.");
    return;
  }

  if (instructions.includes("DISPLAY_DUAL_STACK_CARD")) {
    DisplayDualStackCard();
  }
  else if (instructions === "NEXT_USER_TURN") {
    NextUserTurn();
  }
  else if (instructions === "NEXT_QUESTION") {
    NextQuestion();
  }
  else if (instructions.includes("USER_HAS_PASSED")) {
    UserHasPassed(instructions);
  }
  else if (instructions.includes("USER_SELECTED_FOR_PUNISHMENT")) {
    UserSelectedForPunishment(instructions);
  }
  else if (instructions.includes("DISPLAY_PRIVATE_CARD")) {
    DisplayPrivateCard(instructions);
  }
  else if (instructions.includes("CHOSE_PUNISHMENT")) {
    ChosePunishment(instructions);
  }
  else if (instructions.includes("CHOOSING_PUNISHMENT")) {
    if (instructions.includes("TIME_EXPIRED")) {
      ChoosingPunishment(playerTurn);
    } else {
      const turnPlayer = players[playerTurn];
      const voteId = turnPlayer?.vote ?? turnPlayer?.state?.vote;
      const chosenIndex = players.findIndex(
        p => getPlayerId(p) === voteId
      );
      ChoosingPunishment(chosenIndex);
    }
  }
  else if (instructions.includes("DISPLAY_PUNISHMENT_TO_USER")) {
    DisplayPunishmentToUser(instructions);
  }
  else if (instructions.includes("PUNISHMENT_OFFER")) {
    PunishmentOffer(instructions);
  }
  else if (instructions.includes("HAS_USER_DONE_PUNISHMENT")) {
    HasUserDonePunishment(instructions);
  }
  else if (instructions.includes("ANSWER_TO_USER_DONE_PUNISHMENT")) {
    AnswerToUserDonePunishment(instructions);
  }
  else if (instructions.includes("GAME_OVER")) {
    SetPartyGameStatisticsGameOver();
  }
  else if (instructions.includes("RESET_PARANOIA_QUESTION")) {
    const turnPlayer = players[playerTurn];
    const currentPlayerIndex = players.findIndex(
      p => getPlayerId(p) === getPlayerId(turnPlayer)
    );

    if (instructions.includes("PLAYER_TURN_PASSED:2")) {
      ResetParanoiaQuestion({
        nextPlayer: true,
        incrementScore: -2,
        currentPlayerIndex
      });
    }
    else if (instructions.includes("PLAYER_TURN_PASSED:1")) {
      ResetParanoiaQuestion({
        nextPlayer: true,
        incrementScore: -1,
        currentPlayerIndex
      });
    }
    else {
      ResetParanoiaQuestion({ nextPlayer: true });
    }
  }
}

function getPlayerVote(player) {
  return player?.vote ?? player?.state?.vote;
}