async function DisplayPrivateCard() {
  const state = getPartyState(currentPartyData);
  const deck = getPartyDeck(currentPartyData);
  const players = currentPartyData.players || [];

  const delay = new Date(state.timer) - Date.now();
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
    delay: delay,
    instruction: "DISPLAY_VOTE_RESULTS",
    nextDelay: resultTimerDuration,
    newUserConfirmed: false,
    newUserReady: false
  });

  const myIndex = players.findIndex(p => getPlayerId(p) === deviceId);
  if (myIndex === -1) {
    stopWouldYouRatherVoteTimerWarning();
    console.warn("Device not found in players.");
    return;
  }

  const me = players[myIndex];
  const myState = getPlayerState(me);
  const cardIdx = deck.currentCardIndex ?? 0;

  syncWouldYouRatherVoteTimerWarning(state, myState);

  if (!myState.isReady && !myState.hasConfirmed) {
    if (chooseOptionRequestInFlight && isContainerVisible(selectOptionContainer)) {
      return;
    }

    selectedQuestionObj = getNextQuestion(cardIdx);
    DisplayCard(gameContainerPrivate, selectedQuestionObj);
    setActiveContainers(gameContainerPrivate);
  }
  else if (myState.isReady && !myState.hasConfirmed) {
    selectedQuestionObj = getNextQuestion(cardIdx);
    const splitQuestion = SplitQuestion(
      selectedQuestionObj.question.replace("Would you rather ", "")
    );
    selectOptionQuestionTextA.textContent = "A: " + splitQuestion.a;
    selectOptionQuestionTextB.textContent = "B: " + splitQuestion.b;
    setActiveContainers(selectOptionContainer);
  }
  else {
    const currentParticipants =
      typeof getRoundLateJoinParticipants === 'function'
        ? getRoundLateJoinParticipants(currentPartyData)
        : players;
    const allConfirmed = currentParticipants.every(
      p => getPlayerState(p).hasConfirmed === true
    );

    if (allConfirmed) {
      await SendInstruction({
        instruction: "DISPLAY_VOTE_RESULTS",
        timer: Date.now() + resultTimerDuration,
        updateUsersConfirmation: false,
        updateUsersReady: false
      });
    } else {
      if (myState.hasConfirmed) {
        DisplayWaitingForPlayers();
      }
    }
  }
}
