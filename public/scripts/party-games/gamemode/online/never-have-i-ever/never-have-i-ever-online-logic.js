async function FetchInstructions() {
  // Pull latest party data
  currentPartyData = await GetCurrentPartyData({ requireInstructions: true, retries: 8, delayMs: 150 });
  if (!currentPartyData) {
    PartyDisbanded();
    return;
  }

  await UpdatePartyGameStatistics();

  const config  = getPartyConfig(currentPartyData);
  const state   = getPartyState(currentPartyData);
  const players = currentPartyData.players || [];
  const phase = state?.phase ?? null;

  const instructions = getUserInstructions(currentPartyData);

  if (phase === 'never-have-i-ever-spin-odd-man-out') {
    ChosePunishment();
    return;
  }

  if (phase === 'never-have-i-ever-show-punishment') {
    ChosePunishment();
    return;
  }

  if (!instructions || typeof instructions !== 'string') {
    debugLog("No instructions to process.");
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

  debugLog(`FETCHING ${instructions}`);
}
