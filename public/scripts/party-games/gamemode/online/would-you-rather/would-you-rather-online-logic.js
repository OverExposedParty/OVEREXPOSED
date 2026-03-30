async function FetchInstructions() {
  currentPartyData = await GetCurrentPartyData({ requireInstructions: true, retries: 8, delayMs: 150 });
  if (currentPartyData == undefined || currentPartyData.length === 0) {
    PartyDisbanded();
    return;
  }

  await UpdatePartyGameStatistics();

  // NEW SCHEMA: use config.userInstructions
  const instructions = getUserInstructions(currentPartyData);

  if (instructions.includes("DISPLAY_PRIVATE_CARD")) {
    DisplayPrivateCard(instructions);
  }
  else if (instructions.includes("DISPLAY_VOTE_RESULTS")) {
    DisplayVoteResults();
  }
  else if (instructions.includes("WAITING_FOR_PLAYER")) {
    WaitingForPlayer(instructions);
  }
  else if (instructions.includes("CHOSE_PUNISHMENT")) {
    ChosePunishment(instructions);
  }
  else if (instructions.includes("CHOOSING_PUNISHMENT")) {
    ChoosingPunishment(instructions);
  }
  else if (instructions.includes("DISPLAY_PUNISHMENT_TO_USER")) {
    DisplayPunishmentToUser(instructions);
  }
  else if (instructions.includes("PUNISHMENT_OFFER")) {
    PunishmentOffer(instructions);
  }
  else if (instructions.includes("GAME_OVER")) {
    SetPartyGameStatisticsGameOver();
  }
  else if (instructions.includes("RESET_QUESTION")) {
    if (hostDeviceId != deviceId) return;

    const parsedInstructions = parseInstruction(instructions);

    if (parsedInstructions.reason == "A" || parsedInstructions.reason == "B") {
      for (let i = 0; i < currentPartyData.players.length; i++) {
        const player = currentPartyData.players[i];

        // NEW SCHEMA: vote/score under state, socketId under connection
        if (
          player.state.vote == parsedInstructions.reason &&
          player.connection.socketId !== "DISCONNECTED"
        ) {
          player.state.score++;
        }
      }
    }

    await ResetQuestion({
      nextPlayer: true,
      timer: Date.now() + getTimeLimit() * 1000
    });
  }
}
