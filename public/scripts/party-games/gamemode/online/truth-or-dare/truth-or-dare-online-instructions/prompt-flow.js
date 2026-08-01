async function DisplaySelectQuestionType() {
  const state = currentPartyData.state ?? currentPartyData;
  const deck = currentPartyData.deck ?? currentPartyData;
  const players = currentPartyData.players || [];

  const delay = new Date(state.timer) - Date.now();
  debugLog('DisplaySelectQuestionType delay:', delay);
  const durationSeconds = gameRules["time-limit"];

  startTimerWithContainer({
    container: selectQuestionTypeContainer,
    label: 'selectQuestionTypeContainer',
    timeLeft: delay / 1000,
    duration: durationSeconds
  });
  startTimerWithContainer({
    container: waitingForPlayerContainer,
    label: 'waitingForPlayerContainer',
    timeLeft: delay / 1000,
    duration: durationSeconds
  });

  scheduleTruthOrDarePhaseAction({
    delay,
    action: 'truth-or-dare-handle-card-timeout',
    payload: {
      phaseTimer: Date.now() + gameRules["time-limit"] * 1000,
      roundTimer: Date.now() + gameRules["time-limit"] * 1000
    }
  });

  const turnIndex = state.playerTurn ?? 0;
  const currentPlayer = getTruthOrDareTurnPlayer(players, state, turnIndex);
  if (!currentPlayer) {
    stopTruthOrDareTimerWarning();
    return;
  }

  const currentPlayerId = getTruthOrDarePlayerId(currentPlayer);
  const currentPlayerUsername = getPlayerUsername(currentPlayer);
  const currentPlayerIcon = getPlayerIcon(currentPlayer);

  const truthIndex = deck.currentCardIndex ?? currentPartyData.currentCardIndex ?? 0;
  const dareIndex = deck.currentCardSecondIndex ?? currentPartyData.currentCardSecondIndex ?? 0;

  syncTruthOrDareTimerWarning(
    state,
    deviceId === currentPlayerId,
    'select-question-type'
  );

  if (deviceId === currentPlayerId) {
    if (truthIndex > numberOfTruthQuestions - 1) {
      selectQuestionTypeButtonTruth.classList.add('disabled');
    }
    if (dareIndex > numberOfDareQuestions - 1) {
      selectQuestionTypeButtonDare.classList.add('disabled');
    }
    if (
      truthIndex > numberOfTruthQuestions - 1 &&
      dareIndex > numberOfDareQuestions - 1
    ) {
      await SendInstruction({ instruction: "GAME_OVER" });
      return;
    }

    EditUserIconPartyGames({
      container: selectQuestionTypeContainer,
      userId: currentPlayerId,
      userCustomisationString: currentPlayerIcon
    });
    setActiveContainers(selectQuestionTypeContainer);
  } else {
    SetWaitingForPlayer({
      waitingForRoomTitle: "Waiting for " + currentPlayerUsername,
      waitingForRoomText: "Selecting Truth or Dare...",
      player: {
        ...currentPlayer,
        username: currentPlayerUsername,
        userIcon: currentPlayerIcon,
        computerId: currentPlayerId
      }
    });
    setActiveContainers(waitingForPlayerContainer);
  }
}

async function DisplayPublicCard() {
  const state = currentPartyData.state ?? currentPartyData;
  const players = currentPartyData.players || [];

  const delay = new Date(state.timer) - Date.now();
  const durationSeconds = gameRules["time-limit"];

  startTimerFromContainer({
    container: gameContainerPublic,
    timeLeft: delay / 1000,
    duration: durationSeconds
  });

  scheduleTruthOrDarePhaseAction({
    delay,
    action: 'truth-or-dare-handle-card-timeout',
    payload: {
      phaseTimer: Date.now() + gameRules["time-limit"] * 1000,
      roundTimer: Date.now() + gameRules["time-limit"] * 1000
    }
  });

  const index = players.findIndex(p => getTruthOrDarePlayerId(p) === deviceId);
  const turnIndex = state.playerTurn ?? 0;
  const currentPlayer = getTruthOrDareTurnPlayer(players, state, turnIndex);

  if (index === -1 || !currentPlayer) {
    stopTruthOrDareTimerWarning();
    console.warn("Device ID not found in players or current player missing");
    return;
  }

  const currentPlayerId = getTruthOrDarePlayerId(currentPlayer);
  const currentPlayerUsername = getPlayerUsername(currentPlayer);
  const currentPlayerIcon = getPlayerIcon(currentPlayer);
  debugLog('[OE_DEBUG][truth-or-dare][ChoosingPunishment]', {
    deviceId,
    hostDeviceId,
    currentPlayerId,
    currentPlayerUsername,
    phase: state?.phase ?? null,
    timer: state?.timer ?? null
  });
  const currentPlayerState = getPlayerState(currentPlayer);
  syncTruthOrDareTimerWarning(
    state,
    deviceId === currentPlayerId &&
      currentPlayerState.isReady !== true &&
      currentPlayerState.hasConfirmed !== true,
    'answer-or-pass'
  );

  debugLog('[OE_DEBUG][truth-or-dare][DisplayPublicCard]', {
    deviceId,
    hostDeviceId,
    currentPlayerId,
    currentPlayerUsername,
    currentPlayerReady: currentPlayerState?.isReady ?? null,
    currentPlayerConfirmed: currentPlayerState?.hasConfirmed ?? null,
    phase: state?.phase ?? null,
    timer: state?.timer ?? null
  });

  selectedQuestionObj = GetQuestion({
    cardTitle: gameContainerPublicTitle,
    currentPartyData
  });

  DisplayCard(gameContainerPublic, selectedQuestionObj);

  if (!currentPlayerState.isReady && !currentPlayerState.hasConfirmed) {
    EditUserIconPartyGames({
      container: gameContainerPublic,
      userId: currentPlayerId,
      userCustomisationString: currentPlayerIcon
    });
    setActiveContainers(gameContainerPublic);

    if (deviceId === currentPlayerId) {
      gameContainerPublicButtonAnswer.classList.remove('disabled');
      gameContainerPublicButtonPass.classList.remove('disabled');
      gameContainerPublicWaitingText.classList.add('disabled');
    } else {
      gameContainerPublicWaitingText.textContent =
        `${currentPlayerUsername} is choosing answer or pass`;
      gameContainerPublicButtonAnswer.classList.add('disabled');
      gameContainerPublicButtonPass.classList.add('disabled');
      gameContainerPublicWaitingText.classList.remove('disabled');
    }
  }
}

async function DisplayPromptHeist() {
  const state = currentPartyData.state ?? currentPartyData;
  const players = currentPartyData.players || [];
  const phaseData = state.phaseData || {};
  const passedPlayerId = phaseData.passedPlayerId ?? null;
  const passedPlayer = players.find(
    player => getTruthOrDarePlayerId(player) === passedPlayerId
  );
  if (!passedPlayer) {
    stopTruthOrDareTimerWarning();
    return;
  }

  const isEligibleToClaim = players.some(
    player => getTruthOrDarePlayerId(player) === deviceId
  ) && deviceId !== passedPlayerId;

  syncTruthOrDareTimerWarning(
    state,
    isEligibleToClaim,
    'prompt-heist'
  );

  const passedPlayerUsername = getPlayerUsername(passedPlayer);
  const delay = new Date(state.timer) - Date.now();
  const durationSeconds = typeof getPromptHeistTimeLimit === 'function'
    ? getPromptHeistTimeLimit()
    : Number(
        gameRules?.["prompt-heist-game-rule-time-limit"] ||
        gameRules?.["truth-or-dare-prompt-heist-game-rule-time-limit"] ||
        10
      );

  startTimerWithContainer({
    container: promptHeistContainer,
    label: 'promptHeistContainer',
    timeLeft: delay / 1000,
    duration: durationSeconds
  });
  startTimerWithContainer({
    container: waitingForPlayerContainer,
    label: 'waitingForPlayerContainer',
    timeLeft: delay / 1000,
    duration: durationSeconds
  });

  scheduleTruthOrDarePhaseAction({
    delay,
    action: 'truth-or-dare-resolve-prompt-heist',
    payload: {
      phaseTimer: Date.now() + gameRules["time-limit"] * 1000,
      roundTimer: Date.now() + gameRules["time-limit"] * 1000
    }
  });

  if (deviceId === passedPlayerId) {
    SetWaitingForPlayer({
      waitingForRoomTitle: "Prompt Heist",
      waitingForRoomText: "Waiting to see if someone steals your prompt...",
      player: passedPlayer
    });
    setActiveContainers(waitingForPlayerContainer);
    return;
  }

  promptHeistText.textContent = `${passedPlayerUsername} passed. Steal this prompt?`;
  promptHeistClaimButton.classList.remove('disabled');
  setActiveContainers(promptHeistContainer);
}
