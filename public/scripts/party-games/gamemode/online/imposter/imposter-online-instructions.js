async function DisplayStartTimer() {
  const state   = getPartyState(currentPartyData);
  const deck    = getPartyDeck(currentPartyData);
  const players = currentPartyData.players || [];

  const timerValue = state.timer ?? Date.now();
  const delay      = new Date(timerValue) - Date.now();
  const timeLimit  = getTimeLimit("imposter-time-limit");

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
  if (index === -1) return;

  const allConfirmed = players.every(p => getPlayerState(p).hasConfirmed);

  if (allConfirmed) {
    await SendInstruction({
      instruction: "DISPLAY_ANSWER_CONTAINER",
      updateUsersReady: false,
      updateUsersConfirmation: false,
      timer: Date.now() + timeLimit * 1000
    });
    return;
  }

  const me      = players[index];
  const meState = getPlayerState(me);

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

function getImposterPhaseState() {
  const state = getPartyState(currentPartyData);
  return {
    phase: state?.phase ?? null,
    phaseData: state?.phaseData ?? {}
  };
}

async function renderCurrentImposterInstructionFromState() {
  const userInstructions = getUserInstructions(currentPartyData);
  const state = getPartyState(currentPartyData);
  const phase = state?.phase ?? null;

  if (phase === 'imposter-choose-punishment') {
    ChoosingPunishment(state.playerTurn);
  } else if (phase === 'imposter-show-punishment') {
    DisplayPunishmentToUser();
  } else if (userInstructions === "DISPLAY_VOTE_RESULTS") {
    DisplayVoteResults();
  } else if (userInstructions === "DISPLAY_VOTE_RESULTS_PART_TWO") {
    await DisplayVoteResultsPartTwo();
  } else if (userInstructions.includes("DISPLAY_PRIVATE_CARD")) {
    DisplayPrivateCard(userInstructions);
  } else if (userInstructions.includes("DISPLAY_START_TIMER")) {
    DisplayStartTimer();
  } else if (userInstructions.includes("DISPLAY_ANSWER_CONTAINER")) {
    DisplayAnswerContainer();
  }
}

async function scheduleImposterPhaseAction({ delay = 0, action, payload = {}, actorId = null } = {}) {
  const state = getPartyState(currentPartyData);
  const authoritativeHostId = state?.hostComputerId ?? hostDeviceId;

  if (deviceId !== authoritativeHostId || delay == null || !action) return;

  if (timeout?.cancel) {
    timeout.cancel();
  }

  timeout = createCancelableTimeout(delay);

  try {
    await timeout.promise;

    const actionPayload = { ...payload };
    if (actionPayload.nextTimerDurationMs != null) {
      actionPayload.timer = Date.now() + Number(actionPayload.nextTimerDurationMs);
      delete actionPayload.nextTimerDurationMs;
    }
    if (actionPayload.nextPhaseTimerDurationMs != null) {
      actionPayload.phaseTimer = Date.now() + Number(actionPayload.nextPhaseTimerDurationMs);
      delete actionPayload.nextPhaseTimerDurationMs;
    }
    if (actionPayload.nextRoundTimerDurationMs != null) {
      actionPayload.roundTimer = Date.now() + Number(actionPayload.nextRoundTimerDurationMs);
      delete actionPayload.nextRoundTimerDurationMs;
    }

    const updatedParty = await performOnlinePartyAction({
      action,
      payload: actionPayload,
      actorId: actorId ?? deviceId,
      syncInstructions: false
    });

    if (updatedParty) {
      currentPartyData = updatedParty;
      await renderCurrentImposterInstructionFromState();
    }
  } catch (error) {
    console.error('Imposter phase action failed:', error);
  }
}

async function DisplayAnswerContainer() {
  if (timeout?.cancel) timeout.cancel();

  const state   = getPartyState(currentPartyData);
  const deck    = getPartyDeck(currentPartyData);
  const players = currentPartyData.players || [];

  const timerValue = state.timer ?? Date.now();
  const delay      = new Date(timerValue) - Date.now();
  const timeLimit  = getTimeLimit("imposter-time-limit");

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
  if (index === -1) return;

  const currentRound        = state.round ?? 0;
  const currentRoundTurnIdx = state.roundPlayerTurn ?? 0;

  if (currentRound >= rounds) {
      const updatedParty = await performOnlinePartyAction({
        action: 'imposter-advance-answer-turn',
        payload: {
          roundsLimit: rounds,
          timer: Date.now() + getTimeLimit("imposter-time-limit") * 1000
        }
      });

      if (updatedParty) {
        currentPartyData = updatedParty;
      }
    return;
  }

  scheduleImposterPhaseAction({
    delay,
    action: 'imposter-advance-answer-turn',
    actorId: getPlayerId(players[currentRoundTurnIdx]),
    payload: {
      roundsLimit: rounds,
      expectedRound: currentRound,
      expectedRoundPlayerTurn: currentRoundTurnIdx,
      nextTimerDurationMs: timeLimit * 1000
    }
  });

  if (index === currentRoundTurnIdx) {
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
    const currentPlayer = players[currentRoundTurnIdx];
    if (!currentPlayer) return;

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
  const state   = getPartyState(currentPartyData);
  const deck    = getPartyDeck(currentPartyData);
  const players = currentPartyData.players || [];

  const index = players.findIndex(p => getPlayerId(p) === deviceId);
  if (index === -1) return;

  const player = players[index];
  const pState = getPlayerState(player);

  const timerValue = state.timer ?? Date.now();
  const delay      = new Date(timerValue) - Date.now();
  const timeLimit  = getTimeLimit("imposter-time-limit");

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
    const allConfirmed = players.every(
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

async function DisplayVoteResults() {
  const state = getPartyState(currentPartyData);

  if (!isContainerVisible(resultsChartContainer)) {
    GetVoteResults(currentPartyData);
    setActiveContainers(resultsChartContainer);
  }

  const timerValue = state.timer ?? Date.now();
  const delay      = new Date(timerValue) - Date.now();

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
  const state   = getPartyState(currentPartyData);
  const players = currentPartyData.players || [];

  const highestValue   = getHighestVoteValue(currentPartyData);
  const imposterIndex  = state.playerTurn ?? 0;
  const imposter       = players[imposterIndex];

  if (!imposter) return;

  const imposterId       = getPlayerId(imposter);
  const imposterUsername = getPlayerUsername(imposter);

  if (GetHighestVoted(currentPartyData).includes(imposterId) && highestValue > 0) {
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
  const delay      = new Date(timerValue) - Date.now();

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

async function DisplayPunishmentToUser() {
  const players = currentPartyData.players || [];
  const state   = getPartyState(currentPartyData);
  const { phaseData } = getImposterPhaseState();

  const imposterIndex = state.playerTurn ?? 0;
  const imposter      = players[imposterIndex];

  if (!imposter) return;

  const punishedId    = phaseData?.targetId ?? getPlayerId(imposter);
  const punishmentType = String(phaseData?.punishmentType ?? '').toUpperCase();

  const punishedIndex  = players.findIndex(p => getPlayerId(p) === punishedId);
  const punishedPlayer = punishedIndex !== -1 ? players[punishedIndex] : null;

  if (punishedId === deviceId) {
    if (punishmentType === "DOWN_IT" || punishmentType === "DOWN-IT") {
      completePunishmentText.textContent =
        "In order to find out the question you have to down your drink.";
      completePunishmentContainer.setAttribute("punishment-type", "down-drink");
    } else {
      completePunishmentText.textContent =
        "In order to find out the question you have to take " +
        punishmentType.replace('_', ' ') +
        ".";
      completePunishmentContainer.setAttribute(
        "punishment-type",
        punishmentType
      );
    }

    setActiveContainers(completePunishmentContainer);
  } else if (punishedPlayer) {
    const username = getPlayerUsername(punishedPlayer);

    SetWaitingForPlayer({
      waitingForRoomTitle: "Waiting for " + username,
      waitingForRoomText: "Showing player punishment...",
      player: punishedPlayer
    });

    setActiveContainers(waitingForPlayerContainer);
  }
}

async function ResetImposterQuestion({ nextPlayer = true } = {}) {

  ClearIcons();

  const updatedParty = await performOnlinePartyAction({
    action: 'imposter-reset-round',
    payload: {
      nextPlayer,
      timer: Date.now() + getTimeLimit("imposter-time-limit") * 1000,
      resetInstruction: resetGamemodeInstruction,
      alternativeQuestionIndex: Math.floor(Math.random() * 255)
    }
  });

  if (updatedParty) {
    currentPartyData = updatedParty;
  }
}

async function PartySkip({ nextPlayer = true } = {}) {
  await ResetImposterQuestion({ nextPlayer });
}
