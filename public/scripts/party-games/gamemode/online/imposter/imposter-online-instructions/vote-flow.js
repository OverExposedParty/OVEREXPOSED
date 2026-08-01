async function DisplayVoteResults() {
  const state = getPartyState(currentPartyData);
  stopImposterTimerWarning();

  if (!isContainerVisible(resultsChartContainer)) {
    GetVoteResults(currentPartyData);
    setActiveContainers(resultsChartContainer);
  }

  const timerValue = state.timer ?? Date.now();
  const delay = new Date(timerValue) - Date.now();

  startTimerWithContainer({
    container: resultsChartContainer,
    label: 'resultsChartContainer',
    timeLeft: delay / 1000,
    duration: resultTimerDuration / 1000
  });

  SetTimeOut({
    delay,
    instruction: "DISPLAY_VOTE_RESULTS_PART_TWO",
    nextDelay: resultTimerDuration
  });
}

async function DisplayVoteResultsPartTwo() {
  const state = getPartyState(currentPartyData);
  stopImposterTimerWarning();
  const players = currentPartyData.players || [];

  const outcome = getImposterVoteOutcome(currentPartyData, state);
  const imposter = outcome?.imposter;

  if (!imposter) {
    stopImposterTimerWarning();
    return;
  }

  const imposterUsername = getPlayerUsername(imposter);

  if (outcome.found) {
    SetWaitingForPlayer({
      waitingForRoomTitle: "Imposter found",
      waitingForRoomText: `${imposterUsername} was the Imposter`,
      player: imposter
    });
  } else {
    SetWaitingForPlayer({
      waitingForRoomTitle: "Imposter wins",
      waitingForRoomText: `${imposterUsername} was the Imposter`,
      player: imposter
    });
  }

  setActiveContainers(waitingForPlayerContainer);

  const timerValue = state.timer ?? Date.now();
  const delay = new Date(timerValue) - Date.now();

  startTimerWithContainer({
    container: waitingForPlayerContainer,
    label: 'waitingForPlayerContainer',
    timeLeft: delay / 1000,
    duration: resultTimerDuration / 1000
  });

  scheduleImposterPhaseAction({
    delay,
    action: 'imposter-resolve-vote-outcome',
    payload: {
      nextPhaseTimerDurationMs: getTimeLimit("imposter-time-limit") * 1000,
      nextRoundTimerDurationMs: getTimeLimit("imposter-time-limit") * 1000,
      resetInstruction: resetGamemodeInstruction,
      alternativeQuestionIndex: Math.floor(Math.random() * 255)
    }
  });
}
