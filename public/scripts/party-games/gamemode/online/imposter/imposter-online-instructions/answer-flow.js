async function DisplayStartTimer() {
  const state = getPartyState(currentPartyData);
  const deck = getPartyDeck(currentPartyData);
  const players = currentPartyData.players || [];

  const timerValue = state.timer ?? Date.now();
  const delay = new Date(timerValue) - Date.now();
  const timeLimit = getTimeLimit("imposter-time-limit");

  startTimerWithContainer({
    container: displayStartTimerContainer,
    label: 'displayStartTimerContainer',
    timeLeft: delay / 1000,
    duration: timeLimit
  });

  startTimerWithContainer({
    container: waitingForPlayersContainer,
    label: 'waitingForPlayersContainer',
    timeLeft: delay / 1000,
    duration: timeLimit
  });

  SetTimeOut({
    delay,
    instruction: "DISPLAY_ANSWER_CONTAINER",
    nextDelay: timeLimit * 1000
  });

  const index = players.findIndex(p => getPlayerId(p) === deviceId);
  if (index === -1) {
    stopImposterTimerWarning();
    return;
  }

  const roundPlayers = getRoundLateJoinParticipants(currentPartyData);
  const allConfirmed = roundPlayers.every(p => getPlayerState(p).hasConfirmed);

  if (allConfirmed) {
    stopImposterTimerWarning();
    await SendInstruction({
      instruction: "DISPLAY_ANSWER_CONTAINER",
      updateUsersReady: false,
      updateUsersConfirmation: false,
      timer: Date.now() + timeLimit * 1000
    });
    return;
  }

  const me = players[index];
  const meState = getPlayerState(me);

  syncImposterTimerWarning(
    state,
    meState.hasConfirmed !== true,
    'confirm-prompt'
  );

  if (!meState.hasConfirmed) {
    const cardIndex = deck.currentCardIndex ?? 0;
    selectedQuestionObj = getNextQuestion(cardIndex);

    if ((state.playerTurn ?? 0) === index) {
      selectedQuestionObj.question = GetAlternativeQuestion(
        selectedQuestionObj.questionAlternatives
      );
    }

    displayStartTimerText.textContent =
      "Your prompt is: " + selectedQuestionObj.question;

    setActiveContainers(displayStartTimerContainer);
  } else {
    DisplayWaitingForPlayers();
  }
}

async function DisplayAnswerContainer() {
  if (timeout?.cancel) timeout.cancel();

  const state = getPartyState(currentPartyData);
  const deck = getPartyDeck(currentPartyData);
  const players = currentPartyData.players || [];

  const timerValue = state.timer ?? Date.now();
  const delay = new Date(timerValue) - Date.now();
  const timeLimit = getTimeLimit("imposter-time-limit");

  startTimerWithContainer({
    container: displayUserAnswerContainer,
    label: 'displayUserAnswerContainer',
    timeLeft: delay / 1000,
    duration: timeLimit
  });

  startTimerWithContainer({
    container: waitingForPlayerContainer,
    label: 'waitingForPlayerContainer',
    timeLeft: delay / 1000,
    duration: timeLimit
  });

  const index = players.findIndex(p => getPlayerId(p) === deviceId);
  if (index === -1) {
    stopImposterTimerWarning();
    return;
  }

  const currentSpeakingRound = state.speakingRound ?? state.round ?? 0;
  const currentSpeakingTurnIdx =
    state.speakingPlayerTurn ?? state.roundPlayerTurn ?? 0;

  if (currentSpeakingRound >= speakingRounds) {
    const updatedParty = await performOnlinePartyAction({
      action: 'imposter-advance-answer-turn',
      payload: {
        speakingRoundsLimit: speakingRounds,
        timer: Date.now() + getTimeLimit("imposter-time-limit") * 1000
      }
    });

    if (updatedParty) {
      currentPartyData = updatedParty;
      stopImposterTimerWarning();
    }
    return;
  }

  scheduleImposterPhaseAction({
    delay,
    action: 'imposter-advance-answer-turn',
    actorId: getPlayerId(players[currentSpeakingTurnIdx]),
    payload: {
      speakingRoundsLimit: speakingRounds,
      expectedSpeakingRound: currentSpeakingRound,
      expectedSpeakingPlayerTurn: currentSpeakingTurnIdx,
      nextTimerDurationMs: timeLimit * 1000
    }
  });

  syncImposterTimerWarning(
    state,
    index === currentSpeakingTurnIdx,
    'answer-turn'
  );

  if (index === currentSpeakingTurnIdx) {
    const cardIndex = deck.currentCardIndex ?? 0;
    selectedQuestionObj = getNextQuestion(cardIndex);

    if ((state.playerTurn ?? 0) === index) {
      selectedQuestionObj.question = GetAlternativeQuestion(
        selectedQuestionObj.questionAlternatives
      );
    }

    displayUserAnswerText.textContent =
      `Your prompt is: ${selectedQuestionObj.question}. ` +
      `Explain it without giving too much away — you might be the Imposter.`;

    setActiveContainers(displayUserAnswerContainer);
  } else {
    const currentPlayer = players[currentSpeakingTurnIdx];
    if (!currentPlayer) {
      stopImposterTimerWarning();
      return;
    }

    const username = getPlayerUsername(currentPlayer);

    SetWaitingForPlayer({
      waitingForRoomTitle: "Waiting for " + username,
      waitingForRoomText: "Answering prompt...",
      player: currentPlayer
    });

    setActiveContainers(waitingForPlayerContainer);
  }
}

async function DisplayPrivateCard() {
  const state = getPartyState(currentPartyData);
  const deck = getPartyDeck(currentPartyData);
  const players = currentPartyData.players || [];

  const index = players.findIndex(p => getPlayerId(p) === deviceId);
  if (index === -1) {
    stopImposterTimerWarning();
    return;
  }

  const player = players[index];
  const pState = getPlayerState(player);

  syncImposterTimerWarning(
    state,
    pState.hasConfirmed !== true,
    'vote'
  );

  const timerValue = state.timer ?? Date.now();
  const delay = new Date(timerValue) - Date.now();
  const timeLimit = getTimeLimit("imposter-time-limit");

  startTimerFromContainer({
    container: cardContainerPrivate,
    timeLeft: delay / 1000,
    duration: timeLimit
  });

  startTimerWithContainer({
    container: selectUserContainer,
    label: 'selectUserContainer',
    timeLeft: delay / 1000,
    duration: timeLimit
  });

  startTimerWithContainer({
    container: waitingForPlayersContainer,
    label: 'waitingForPlayersContainer',
    timeLeft: delay / 1000,
    duration: timeLimit
  });

  SetTimeOut({
    delay,
    instruction: "DISPLAY_VOTE_RESULTS",
    nextDelay: resultTimerDuration
  });

  selectUserQuestionText.textContent = "Select who you think is the Imposter";

  if (!pState.isReady && !pState.hasConfirmed) {
    const cardIndex = deck.currentCardIndex ?? 0;
    selectedQuestionObj = getNextQuestion(cardIndex);

    if ((state.playerTurn ?? 0) === index) {
      selectedQuestionObj.question = GetAlternativeQuestion(
        selectedQuestionObj.questionAlternatives
      );
    }

    DisplayCard(gameContainerPrivate, selectedQuestionObj);
    setActiveContainers(gameContainerPrivate);
  } else if (pState.isReady && !pState.hasConfirmed) {
    setActiveContainers(selectUserContainer);
  } else {
    const allConfirmed = getRoundLateJoinParticipants(currentPartyData).every(
      pl => getPlayerState(pl).hasConfirmed === true
    );

    if (allConfirmed) {
      await SendInstruction({
        instruction: "DISPLAY_VOTE_RESULTS",
        timer: Date.now() + resultTimerDuration
      });
    } else if (pState.hasConfirmed) {
      DisplayWaitingForPlayers();
    }
  }
}
