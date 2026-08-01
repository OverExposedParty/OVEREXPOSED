async function DisplayPrivateCard(instruction) {
  await ensureQuestionsLoadedForCurrentConfig(getPartyConfig(currentPartyData));

  const state = getPartyState(currentPartyData);
  const deck  = currentPartyData.deck ?? currentPartyData;

  const timerValue = state.timer ?? currentPartyData.timer ?? Date.now();
  const delay = new Date(timerValue) - Date.now();
  const durationSeconds = getTimeLimit();

  startTimerFromContainer({
    container: gameContainerPrivate,
    timeLeft: delay / 1000,
    duration: durationSeconds
  });
  startTimerWithContainer({
    container: selectOptionContainer,
    label: 'selectOptionContainer',
    timeLeft: delay / 1000,
    duration: durationSeconds
  });
  startTimerWithContainer({
    container: waitingForPlayersContainer,
    label: 'waitingForPlayersContainer',
    timeLeft: delay / 1000,
    duration: durationSeconds
  });

  SetTimeOut({
    delay,
    instruction: "DISPLAY_VOTE_RESULTS",
    nextDelay: resultTimerDuration,
    newUserConfirmed: false,
    newUserReady: false
  });

  const players = currentPartyData.players || [];
  const myIndex = players.findIndex(p => getPlayerId(p) === deviceId);

  if (myIndex === -1) {
    stopNeverHaveIEverVoteTimerWarning();
    console.warn("Device not found in players.");
    return;
  }

  const me = players[myIndex];
  const meState = me.state ?? me;

  const cardIndex = deck.currentCardIndex ?? currentPartyData.currentCardIndex ?? 0;
  selectedQuestionObj = getNextQuestion(cardIndex);

  selectOptionQuestionText.textContent =
    selectedQuestionObj.question.replace("Never have I ever ", "");
  DisplayCard(gameContainerPrivate, selectedQuestionObj);

  const isReady = meState.isReady ?? me.isReady;
  const hasConfirmed = meState.hasConfirmed ?? me.hasConfirmed;

  syncNeverHaveIEverVoteTimerWarning(state, { hasConfirmed });

  if (!isReady && !hasConfirmed) {
    setActiveContainers(gameContainerPrivate);
  } else if (isReady && !hasConfirmed) {
    setActiveContainers(selectOptionContainer);
  } else {
    const participantIds = new Set(
      (state.roundParticipantIds || []).map(String)
    );
    const allConfirmed = players
      .filter((player) => {
        const playerState = player.state ?? player;
        return (
          playerState.participationStatus !== 'pending_next_round' &&
          (participantIds.size === 0 ||
            participantIds.has(String(getPlayerId(player))))
        );
      })
      .every((player) => {
        const playerState = player.state ?? player;
        return playerState.hasConfirmed === true;
      });

    if (allConfirmed) {
        await SendInstruction({
          instruction: "DISPLAY_VOTE_RESULTS",
          timer: Date.now() + resultTimerDuration,
          updateUsersConfirmation: false,
          updateUsersReady: false
        });
    } else {
      if (hasConfirmed) {
        DisplayWaitingForPlayers();
      }
    }
  }
}
