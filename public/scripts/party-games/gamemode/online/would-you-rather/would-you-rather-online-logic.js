async function FetchInstructions() {
  currentPartyData = await GetCurrentPartyData({ requireInstructions: true, retries: 8, delayMs: 150 });
  if (currentPartyData == undefined || currentPartyData.length === 0) {
    PartyDisbanded();
    return;
  }

  await UpdatePartyGameStatistics();

  // NEW SCHEMA: use config.userInstructions
  const instructions = getUserInstructions(currentPartyData);
  const state = getPartyState(currentPartyData);
  const phase = state?.phase ?? null;

  if (phase === 'would-you-rather-spin-odd-man-out') {
    ChosePunishment();
    return;
  }

  if (phase === 'would-you-rather-show-punishment') {
    ChosePunishment();
    return;
  }

  if (instructions.includes("DISPLAY_PRIVATE_CARD")) {
    DisplayPrivateCard(instructions);
  }
  else if (instructions.includes("DISPLAY_VOTE_RESULTS")) {
    DisplayVoteResults();
  }
  else if (instructions.includes("WAITING_FOR_PLAYER")) {
    WaitingForPlayer(instructions);
  }
  else if (instructions.includes("GAME_OVER")) {
    SetPartyGameStatisticsGameOver();
  }
  else if (instructions.includes("RESET_QUESTION")) {
    await ResetQuestion({
      nextPlayer: true,
      timer: Date.now() + getTimeLimit() * 1000
    });
  }
}
