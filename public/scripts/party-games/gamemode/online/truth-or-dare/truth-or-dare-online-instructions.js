function getTruthOrDarePlayerId(player) {
  return getPlayerId(player) ?? player?.computerId ?? player?.identity?.computerId ?? null;
}

function getTruthOrDareTurnPlayer(players = [], state = {}, turnIndex = state?.playerTurn ?? 0) {
  const order = Array.isArray(state?.playerTurnOrder) ? state.playerTurnOrder : [];
  const playerId = order[turnIndex];

  if (playerId) {
    return players.find(player => getTruthOrDarePlayerId(player) === playerId) ?? null;
  }

  return players[turnIndex] ?? null;
}

function hideTruthOrDareDrinkWheel() {
  document
    .querySelectorAll('#drink-wheel-container')
    .forEach(container => hideContainer(container));
}

function getTruthOrDareResolvedPunishmentType(instruction, phaseData = {}) {
  const parsedInstructions = typeof instruction === 'string'
    ? parseInstruction(instruction)
    : {};

  return String(
    parsedInstructions.reason
    ?? phaseData?.punishmentType
    ?? ''
  ).toUpperCase();
}

function getTruthOrDarePhaseDuration() {
  return Number(gameRules?.["time-limit"] || 120);
}

function getTruthOrDarePhaseDelay() {
  const state = getPartyState(currentPartyData);
  const timerValue = state?.timer ?? currentPartyData?.timer ?? null;
  if (!timerValue) return getTruthOrDarePhaseDuration() * 1000;

  return Math.max(new Date(timerValue) - Date.now(), 0);
}

function ensureTruthOrDareTimer(container) {
  if (!container) return false;
  if (!container.querySelector(':scope > .timer-wrapper') && typeof AddTimerToContainer === 'function') {
    AddTimerToContainer(container);
  }
  return Boolean(container.querySelector(':scope > .timer-wrapper'));
}

function startTruthOrDarePhaseTimer(container, label, delay = getTruthOrDarePhaseDelay()) {
  if (!container) return false;
  ensureTruthOrDareTimer(container);

  return startTimerWithContainer({
    container,
    label,
    timeLeft: delay / 1000,
    duration: getTruthOrDarePhaseDuration()
  });
}

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
  if (!currentPlayer) return;

  const currentPlayerId = getTruthOrDarePlayerId(currentPlayer);
  const currentPlayerUsername = getPlayerUsername(currentPlayer);
  const currentPlayerIcon = getPlayerIcon(currentPlayer);

  const truthIndex = deck.currentCardIndex ?? currentPartyData.currentCardIndex ?? 0;
  const dareIndex = deck.currentCardSecondIndex ?? currentPartyData.currentCardSecondIndex ?? 0;

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
      SendInstruction({ instruction: "GAME_OVER" });
    }

    EditUserIconPartyGames({
      container: gameContainerAnswer,
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

async function ChoosingPunishment() {
  const state = currentPartyData.state ?? currentPartyData;
  const players = currentPartyData.players || [];

  const delay = new Date(state.timer) - Date.now();
  const durationSeconds = gameRules["time-limit"];

  startTimerWithContainer({
    container: selectPunishmentContainer,
    label: 'selectPunishmentContainer',
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
    action: 'truth-or-dare-handle-punishment-timeout',
    payload: {
      roundTimer: Date.now() + gameRules["time-limit"] * 1000
    }
  });

  const turnIndex = state.playerTurn ?? 0;
  const currentPlayer = getTruthOrDareTurnPlayer(players, state, turnIndex);
  if (!currentPlayer) {
    console.error('Player not found for current turn index:', turnIndex);
    return;
  }

  const currentPlayerId = getTruthOrDarePlayerId(currentPlayer);
  const currentPlayerUsername = getPlayerUsername(currentPlayer);
  const currentPlayerIcon = getPlayerIcon(currentPlayer);

  if (currentPlayerId === deviceId) {
    setActiveContainers(selectPunishmentContainer);
  } else {
    SetWaitingForPlayer({
      waitingForRoomTitle: "Waiting for " + currentPlayerUsername,
      waitingForRoomText: "Choosing Punishment...",
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

async function UserSelectedForPunishment(instruction) {
  return ChoosingPunishment();
}

async function DisplayPunishmentToUser(instruction) {
  const state = currentPartyData.state ?? currentPartyData;
  const players = currentPartyData.players || [];
  const { phaseData } = getTruthOrDarePhaseState();
  const delay = getTruthOrDarePhaseDelay();
  const currentInstruction = typeof instruction === 'string'
    ? instruction
    : getUserInstructions(currentPartyData);

  const turnIndex = state.playerTurn ?? 0;
  const currentPlayer = getTruthOrDareTurnPlayer(players, state, turnIndex);
  debugLog('[OE_DEBUG][truth-or-dare][DisplaySelectQuestionType][pre-render]', {
    playersLength: players.length,
    turnIndex,
    currentPlayer,
    playerIds: players.map(player => player?.identity?.computerId ?? player?.computerId ?? null)
  });
  if (!currentPlayer) return;

  const currentPlayerId = getTruthOrDarePlayerId(currentPlayer);
  const currentPlayerUsername = getPlayerUsername(currentPlayer);
  const punishmentType = getTruthOrDareResolvedPunishmentType(currentInstruction, phaseData);

  if (currentPlayerId == deviceId) {
    if (punishmentType === "DRINK_WHEEL") {
      const wheelContainer = typeof drinkWheelContainer !== 'undefined'
        ? drinkWheelContainer
        : document.querySelector('#drink-wheel-container');

      if (!wheelContainer) {
        if (typeof AddGamemodeContainers === 'function') {
          AddGamemodeContainers('drink-wheel');
        }
        SetWaitingForPlayer({
          waitingForRoomTitle: "Preparing punishment...",
          waitingForRoomText: "Loading drink wheel...",
          player: currentPlayer
        });
        setActiveContainers(waitingForPlayerContainer);
        setTimeout(() => {
          if (typeof FetchInstructions === 'function') {
            FetchInstructions();
          }
        }, 250);
        return;
      }

      if (typeof resetDrinkWheelState === 'function') {
        resetDrinkWheelState();
      }
      startTruthOrDarePhaseTimer(wheelContainer, 'drinkWheelContainer', delay);
      setActiveContainers(wheelContainer);
      return;
    }

    hideTruthOrDareDrinkWheel();

    if (punishmentType == "DOWN_IT" || punishmentType == "DOWN-IT") {
      completePunishmentText.textContent = "Down it!";
      completePunishmentContainer.setAttribute("punishment-type", "DOWN_IT");
    } else {
      completePunishmentText.textContent = "Take " + punishmentType.replaceAll("_", " ");
      completePunishmentContainer.setAttribute("punishment-type", punishmentType);
    }
    startTruthOrDarePhaseTimer(completePunishmentContainer, 'completePunishmentContainer', delay);
    setActiveContainers(completePunishmentContainer);
  } else {
    let waitingText;
    if (punishmentType === "DRINK_WHEEL") {
      waitingText = `Waiting for ${currentPlayerUsername} to spin the drink wheel.`;
    } else if (punishmentType == "DOWN_IT" || punishmentType == "DOWN-IT") {
      hideTruthOrDareDrinkWheel();
      waitingText = `Waiting for ${currentPlayerUsername} to down their drink.`;
    } else {
      hideTruthOrDareDrinkWheel();
      waitingText = `Waiting for ${currentPlayerUsername} to take ${punishmentType.replaceAll("_", " ")}.`;
    }
    SetWaitingForPlayer({
      waitingForRoomTitle: "Waiting for " + currentPlayerUsername,
      waitingForRoomText: waitingText,
      player: currentPlayer
    });
    startTruthOrDarePhaseTimer(waitingForPlayerContainer, 'waitingForPlayerContainer', delay);
    setActiveContainers(waitingForPlayerContainer);
  }
}

async function DisplayAnswerCard(instruction) {
  const players = currentPartyData.players || [];
  const index = players.findIndex(player => getTruthOrDarePlayerId(player) === deviceId);
  if (index === -1) return;

  const state = currentPartyData.state ?? currentPartyData;
  const turnIndex = state.playerTurn ?? 0;
  const currentPlayer = getTruthOrDareTurnPlayer(players, state, turnIndex);
  if (!currentPlayer) return;

  const currentPlayerId = getTruthOrDarePlayerId(currentPlayer);
  const currentPlayerUsername = getPlayerUsername(currentPlayer);
  const currentPlayerIcon = getPlayerIcon(currentPlayer);
  debugLog('[OE_DEBUG][truth-or-dare][DisplaySelectQuestionType]', {
    deviceId,
    hostDeviceId,
    currentPlayerId,
    currentPlayerUsername,
    phase: state?.phase ?? null,
    timer: state?.timer ?? null
  });
  const currentPlayerState = getPlayerState(currentPlayer);
  const isCurrentPlayersTurn = deviceId === currentPlayerId;

  let parsedInstructions = parseInstruction(instruction);

  selectedQuestionObj = GetQuestion({
    cardTitle: gameContainerPublicTitle,
    currentPartyData
  });
  DisplayCard(gameContainerPublic, selectedQuestionObj);

  if (isCurrentPlayersTurn && !currentPlayerState.hasConfirmed) {
    const question = gameContainerPublicText.textContent;
    gameContainerAnswerTitle.src = gameContainerPublicTitle.src;
    gameContainerAnswerText.innerHTML =
      `<span class="question-text">${question}<br><span style="color:var(--secondarypagecolour);">${parsedInstructions.reason}</span></span>`;
    answerQuestionContainerQuestionText.textContent = gameContainerPublicText.textContent;
    gameContainerAnswerCardType.textContent = gameContainerPublicCardType.textContent;

    EditUserIconPartyGames({
      container: gameContainerAnswer,
      userId: currentPlayerId,
      userCustomisationString: currentPlayerIcon
    });
    setActiveContainers(gameContainerAnswer);
  } else {
    SetWaitingForPlayer({
      waitingForRoomTitle: "Waiting for " + currentPlayerUsername,
      waitingForRoomText: "Answering the question...",
      player: currentPlayer
    });
    setActiveContainers(waitingForPlayerContainer);
  }
}

async function DisplayConfirmInput(instruction) {
  const players = currentPartyData.players || [];
  const deck = currentPartyData.deck ?? currentPartyData;

  const parsedInstructions = parseInstruction(instruction);
  const index = players.findIndex(player => getTruthOrDarePlayerId(player) === deviceId);
  if (index === -1) return;

  const state = currentPartyData.state ?? currentPartyData;
  const turnIndex = state.playerTurn ?? 0;
  const currentPlayer = getTruthOrDareTurnPlayer(players, state, turnIndex);
  if (!currentPlayer) return;

  const currentPlayerId = getTruthOrDarePlayerId(currentPlayer);
  const currentPlayerUsername = getPlayerUsername(currentPlayer);
  const currentPlayerState = getPlayerState(currentPlayer);
  const isCurrentPlayersTurn = deviceId === currentPlayerId;

  const questionType = deck.questionType ?? currentPartyData.questionType;

  if (questionType == "truth") {
    if (!currentPlayerState.isReady && !currentPlayerState.hasConfirmed) {
      if (isCurrentPlayersTurn) {
        answerQuestionContainerQuestionText.textContent = gameContainerPublicText.textContent;
        setActiveContainers(answerQuestionContainer);
      } else {
        SetWaitingForPlayer({
          waitingForRoomTitle: "Waiting for " + currentPlayerUsername,
          waitingForRoomText: "Writing answer to question...",
          player: currentPlayer
        });
        setActiveContainers(waitingForPlayerContainer);
      }
    }
  } else if (questionType == "dare") {
    if (isCurrentPlayersTurn) {
      await SendInstruction({
        instruction: "DISPLAY_COMPLETE_QUESTION",
        byPassHost: true
      });
    } else {
      SetWaitingForPlayer({
        waitingForRoomTitle: "Waiting for " + currentPlayerUsername,
        waitingForRoomText: "Deciding whether to answer or pass...",
        player: currentPlayer
      });
      setActiveContainers(waitingForPlayerContainer);
    }
  }
}

async function UserHasPassed(instruction) {
  const players = currentPartyData.players || [];
  let parsedInstructions = parseInstruction(instruction);

  const index = players.findIndex(
    player => getTruthOrDarePlayerId(player) === parsedInstructions.deviceId
  );
  if (index === -1) return;

  const passedPlayer = players[index];
  const username = getPlayerUsername(passedPlayer);

  SetPlayerHasPassed({
    playerHasPassedTitleText: username + " has passed",
    playerHasPassedReasonText: "Question not answered",
    player: passedPlayer
  });
  setActiveContainers(playerHasPassedContainer);

  await new Promise(resolve => setTimeout(resolve, 1000));

  if (deviceId === parsedInstructions.deviceId) {
    const updatedParty = await performOnlinePartyAction({
      action: 'truth-or-dare-reset-round',
      payload: {
        force: true,
        nextPlayer: true,
        incrementScore: 0,
        timer: Date.now() + gameRules["time-limit"] * 1000
      }
    });

    await syncTruthOrDarePartyAndRender(updatedParty);
  }
}

async function DisplayCompleteQuestion() {
  timeout?.cancel();
  stopTimerForContainer(waitingForPlayerContainer, 'waitingForPlayerContainer');

  const players = currentPartyData.players || [];
  const deck = currentPartyData.deck ?? currentPartyData;

  const index = players.findIndex(player => getTruthOrDarePlayerId(player) === deviceId);
  const state = currentPartyData.state ?? currentPartyData;
  const turnIndex = state.playerTurn ?? 0;
  const currentPlayer = getTruthOrDareTurnPlayer(players, state, turnIndex);
  if (!currentPlayer) return;

  const currentPlayerId = getTruthOrDarePlayerId(currentPlayer);
  const currentPlayerUsername = getPlayerUsername(currentPlayer);

  selectedQuestionObj = GetQuestion({
    cardTitle: gameContainerPublicTitle,
    currentPartyData
  });

  const questionType = deck.questionType ?? currentPartyData.questionType;

  if (deviceId == currentPlayerId) {
    completePromptTitle.textContent = questionType.toUpperCase();
    completePromptText.textContent = selectedQuestionObj.question;
    setActiveContainers(completPromptContainer);
  } else {
    SetWaitingForPlayer({
      waitingForRoomTitle: "Waiting for " + currentPlayerUsername,
      waitingForRoomText: "Performing Question...",
      player: currentPlayer
    });
    setActiveContainers(waitingForPlayerContainer);
  }
}

async function ResetTruthOrDareQuestion({ force = false, nextPlayer = true, incrementScore = 0, byPassHost = false }) {
  const updatedParty = await performOnlinePartyAction({
    action: 'truth-or-dare-reset-round',
    payload: {
      force,
      nextPlayer,
      incrementScore,
      timer: Date.now() + gameRules["time-limit"] * 1000,
      byPassHost
    }
  });

  if (await syncTruthOrDarePartyAndRender(updatedParty)) {
    return;
  }

  if (!force) {
    DisplayWaitingForPlayers();
  }
}

async function PartySkip({ nextPlayer = true } = {}) {
  await ResetTruthOrDareQuestion({
    force: true,
    nextPlayer
  });
}

function getTruthOrDarePhaseState() {
  const state = currentPartyData.state ?? currentPartyData;
  return {
    phase: state?.phase ?? null,
    phaseData: state?.phaseData ?? {}
  };
}

async function scheduleTruthOrDarePhaseAction({ delay = 0, action, payload = {} } = {}) {
  const state = currentPartyData.state ?? currentPartyData;
  const authoritativeHostId = state?.hostComputerId ?? hostDeviceId;

  if (deviceId !== authoritativeHostId || delay == null || !action) return;

  if (timeout?.cancel) {
    timeout.cancel();
  }

  timeout = createCancelableTimeout(delay);

  try {
    await timeout.promise;

    const updatedParty = await performOnlinePartyAction({
      action,
      payload
    });

    await syncTruthOrDarePartyAndRender(updatedParty);
  } catch (error) {
    console.error('Truth or Dare phase action failed:', error);
  }
}
