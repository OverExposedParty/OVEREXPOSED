async function DisplayStartTimer() {
  const state   = getPartyState(currentPartyData);
  const deck    = getPartyDeck(currentPartyData);
  const players = currentPartyData.players || [];

  const timerValue = state.timer ?? Date.now();
  const delay      = new Date(timerValue) - Date.now();
  const timeLimit  = getTimeLimit("imposter-time-limit");

  startTimer({
    timeLeft: delay / 1000,
    duration: timeLimit,
    selectedTimer: displayStartTimerContainer.querySelector('.timer-wrapper')
  });

  SetTimeOut({
    delay,
    instruction: "DISPLAY_ANSWER_CONTAINER",
    nextDelay: null
  });

  const index = players.findIndex(p => getPlayerId(p) === deviceId);
  if (index === -1) return;

  const allConfirmed = players.every(p => getPlayerState(p).hasConfirmed);

  if (allConfirmed) {
    await SendInstruction({
      instruction: "DISPLAY_ANSWER_CONTAINER",
      updateUsersReady: false,
      updateUsersConfirmation: false
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

async function DisplayAnswerContainer() {
  if (timeout?.cancel) timeout.cancel();

  const state   = getPartyState(currentPartyData);
  const deck    = getPartyDeck(currentPartyData);
  const players = currentPartyData.players || [];

  const index = players.findIndex(p => getPlayerId(p) === deviceId);
  if (index === -1) return;

  const currentRound        = state.round ?? 0;
  const currentRoundTurnIdx = state.roundPlayerTurn ?? 0;

  if (currentRound >= rounds) {
      state.round           = 0;
      state.roundPlayerTurn = 0;

      currentPartyData.state = state;

      await SendInstruction({
        partyData: currentPartyData,
        instruction: "DISPLAY_PRIVATE_CARD",
        updateUsersReady: true,
        updateUsersConfirmation: false,
        timer: Date.now() + getTimeLimit("imposter-time-limit") * 1000
      });
    return;
  }

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
      waitingForRoomText: "Choosing Punishment...",
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

  startTimer({
    timeLeft: delay / 1000,
    duration: timeLimit,
    selectedTimer: selectUserContainer.querySelector('.timer-wrapper')
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

  startTimer({
    timeLeft: delay / 1000,
    duration: resultTimerDuration / 1000,
    selectedTimer: resultsChartContainer.querySelector('.timer-wrapper')
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

  let instruction = "";
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

    if (CheckSettingsExists("drink-punishment")) {
      instruction = "CHOOSING_PUNISHMENT";
    } else {
      instruction = "RESET_QUESTION:NEXT_PLAYER";
    }
  } else {
    SetWaitingForPlayer({
      waitingForRoomTitle: "Imposter wins",
      waitingForRoomText: `${imposterUsername} was the Imposter`,
      player: imposter
    });

    instruction = "RESET_QUESTION:NEXT_PLAYER";
  }

  setActiveContainers(waitingForPlayerContainer);

  const timerValue = state.timer ?? Date.now();
  const delay      = new Date(timerValue) - Date.now();

  startTimer({
    timeLeft: delay / 1000,
    duration: resultTimerDuration / 1000,
    selectedTimer: waitingForPlayerContainer.querySelector('.timer-wrapper')
  });

  SetTimeOut({
    delay,
    instruction
  });
}

async function DisplayPunishmentToUser() {
  const players = currentPartyData.players || [];
  const state   = getPartyState(currentPartyData);

  const userInstructions   = getUserInstructions(currentPartyData);
  const parsedInstructions = parseInstruction(userInstructions);

  const imposterIndex = state.playerTurn ?? 0;
  const imposter      = players[imposterIndex];

  if (!imposter) return;

  const imposterState = getPlayerState(imposter);
  const punishedId    = imposterState.vote;

  const punishedIndex  = players.findIndex(p => getPlayerId(p) === punishedId);
  const punishedPlayer = punishedIndex !== -1 ? players[punishedIndex] : null;

  if (punishedId === deviceId) {
    if (parsedInstructions.reason === "DOWN_IT") {
      completePunishmentText.textContent =
        "In order to find out the question you have to down your drink.";
      completePunishmentContainer.setAttribute("punishment-type", "down-drink");
    } else {
      completePunishmentText.textContent =
        "In order to find out the question you have to take " +
        parsedInstructions.reason.replace('_', ' ') +
        ".";
      completePunishmentContainer.setAttribute(
        "punishment-type",
        parsedInstructions.reason
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

  const players = currentPartyData.players || [];
  const state   = getPartyState(currentPartyData);
  const deck    = getPartyDeck(currentPartyData);

  deck.currentCardIndex = (deck.currentCardIndex ?? 0) + 1;

  if (nextPlayer && players.length > 0) {
    state.playerTurn = Math.floor(Math.random() * players.length);
  }

  players.forEach(player => {
    const pState = getPlayerState(player);
    pState.isReady      = false;
    pState.hasConfirmed = false;
    pState.vote         = null;
  });

  currentPartyData.state = state;
  currentPartyData.deck  = deck;

  await SendInstruction({
    instruction: resetGamemodeInstruction,
    partyData: currentPartyData,
    timer: Date.now() + getTimeLimit("imposter-time-limit") * 1000,
    alternativeQuestionIndex: Math.floor(Math.random() * 255)
  });
}

async function PartySkip() {
  await ResetImposterQuestion({ nextPlayer: true });
}
