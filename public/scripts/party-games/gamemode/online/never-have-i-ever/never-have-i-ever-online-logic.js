async function FetchInstructions() {
  // Pull latest party data
  currentPartyData = await GetCurrentPartyData();
  if (!currentPartyData) {
    PartyDisbanded();
    return;
  }

  await UpdatePartyGameStatistics();

  const config  = getPartyConfig(currentPartyData);
  const state   = getPartyState(currentPartyData);
  const players = currentPartyData.players || [];

  const instructions = getUserInstructions(currentPartyData);

  if (!instructions || typeof instructions !== 'string') {
    console.log("No instructions to process.");
    return;
  }

  // ---- Instruction routing for Never Have I Ever ----
  if (instructions.includes("DISPLAY_PRIVATE_CARD")) {
    // e.g. "DISPLAY_PRIVATE_CARD"
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
    const icons = waitingForPlayersIconContainer.querySelectorAll('.icon');
    await ResetQuestion({
      icons,
      timer: Date.now() + gameRules["time-limit"] * 1000
    });
  }

  console.log(`FETCHING ${instructions}`);
}