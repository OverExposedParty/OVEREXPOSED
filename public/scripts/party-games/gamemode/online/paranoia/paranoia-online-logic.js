async function FetchInstructions() {
  currentPartyData = await GetCurrentPartyData({ requireInstructions: true, retries: 8, delayMs: 150 });
  if (!currentPartyData) {
    PartyDisbanded();
    return;
  }

  await UpdatePartyGameStatistics();

  const config = getPartyConfig(currentPartyData);
  const state  = getPartyState(currentPartyData);
  const players = currentPartyData.players || [];
  const phase = state?.phase ?? null;

  const instructions = getUserInstructions(currentPartyData);
  const playerTurn = state.playerTurn ?? currentPartyData.playerTurn ?? 0;

  if (phase === 'paranoia-choose-punishment') {
    ChoosingPunishment();
    return;
  }

  if (phase === 'paranoia-show-punishment') {
    if (instructions === "NEXT_QUESTION") {
      NextQuestion();
      return;
    }

    if (instructions.includes("USER_HAS_PASSED")) {
      UserHasPassed(instructions);
      return;
    }

    if (instructions.includes("DISPLAY_DUAL_STACK_CARD")) {
      DisplayDualStackCard();
      return;
    }

    if (instructions.includes("DISPLAY_PUNISHMENT_TO_USER")) {
      DisplayPunishmentToUser(instructions);
      return;
    }
    ChosePunishment();
    return;
  }

  if (phase === 'paranoia-confirm-punishment') {
    HasUserDonePunishment();
    return;
  }

  if (!instructions || typeof instructions !== 'string') {
    debugLog("No instructions to process.");
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
  else if (instructions.includes("DISPLAY_PUNISHMENT_TO_USER")) {
    DisplayPunishmentToUser(instructions);
  }
  else if (instructions.includes("DISPLAY_PRIVATE_CARD")) {
    DisplayPrivateCard(instructions);
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
