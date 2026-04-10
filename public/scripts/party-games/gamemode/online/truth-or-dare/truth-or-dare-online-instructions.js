async function DisplaySelectQuestionType() {
  const state = currentPartyData.state ?? currentPartyData;
  const deck = currentPartyData.deck ?? currentPartyData;
  const players = currentPartyData.players || [];

  const delay = new Date(state.timer) - Date.now();
  console.log('DisplaySelectQuestionType delay:', delay);
  const durationSeconds = gameRules["time-limit"];

  startTimer({
    timeLeft: delay / 1000,
    duration: durationSeconds,
    selectedTimer: selectQuestionTypeContainer.querySelector('.timer-wrapper')
  });
  startTimer({
    timeLeft: delay / 1000,
    duration: durationSeconds,
    selectedTimer: waitingForPlayerContainer.querySelector('.timer-wrapper')
  });

  if (selectPunishmentButtonContainer.childElementCount === 0) {
    SetTimeOut({ delay, instruction: "RESET_QUESTION:TIME_EXPIRED", nextDelay: null });
  } else {
    SetTimeOut({ delay, instruction: "CHOOSING_PUNISHMENT", nextDelay: null });
  }

  const turnIndex = state.playerTurn ?? 0;
  const currentPlayer = players[turnIndex];
  if (!currentPlayer) return;

  const currentPlayerId = getPlayerId(currentPlayer);
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

  if (selectPunishmentButtonContainer.childElementCount === 0) {
    SetTimeOut({ delay, instruction: "RESET_QUESTION:TIME_EXPIRED", nextDelay: null });
  } else {
    SetTimeOut({ delay, instruction: "CHOOSING_PUNISHMENT", nextDelay: null });
  }

  const index = players.findIndex(p => getPlayerId(p) === deviceId);
  const turnIndex = state.playerTurn ?? 0;
  const currentPlayer = players[turnIndex];

  if (index === -1 || !currentPlayer) {
    console.warn("Device ID not found in players or current player missing");
    return;
  }

  const currentPlayerId = getPlayerId(currentPlayer);
  const currentPlayerUsername = getPlayerUsername(currentPlayer);
  const currentPlayerIcon = getPlayerIcon(currentPlayer);
  const currentPlayerState = getPlayerState(currentPlayer);

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

  startTimer({
    timeLeft: delay / 1000,
    duration: durationSeconds,
    selectedTimer: selectPunishmentContainer.querySelector('.timer-wrapper')
  });
  startTimer({
    timeLeft: delay / 1000,
    duration: durationSeconds,
    selectedTimer: waitingForPlayerContainer.querySelector('.timer-wrapper')
  });

  SetTimeOut({ delay, instruction: "RESET_QUESTION:TIME_EXPIRED:2", nextDelay: null });

  const turnIndex = state.playerTurn ?? 0;
  const currentPlayer = players[turnIndex];
  if (!currentPlayer) {
    console.error('Player not found for current turn index:', turnIndex);
    return;
  }

  const currentPlayerId = getPlayerId(currentPlayer);
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
  const players = currentPartyData.players || [];
  let parsedInstructions = parseInstructionDeviceId(instruction);

  const index = players.findIndex(
    player => getPlayerId(player) === parsedInstructions.deviceId
  );
  if (index === -1) return;

  const selectedPlayer = players[index];
  const username = getPlayerUsername(selectedPlayer);
  const userIcon = getPlayerIcon(selectedPlayer);
  const userId = getPlayerId(selectedPlayer);

  if (parsedInstructions.deviceId == deviceId) {
    setActiveContainers(selectPunishmentContainer);
  } else {
    SetWaitingForPlayer({
      waitingForRoomTitle: "Waiting for " + username,
      waitingForRoomText: "Choosing Punishment...",
      player: {
        ...selectedPlayer,
        username,
        userIcon,
        computerId: userId
      }
    });
    setActiveContainers(waitingForPlayerContainer);
  }
}

async function DisplayPunishmentToUser(instruction) {
  const state = currentPartyData.state ?? currentPartyData;
  const players = currentPartyData.players || [];
  let parsedInstructions = parseInstruction(instruction);

  const turnIndex = state.playerTurn ?? 0;
  const currentPlayer = players[turnIndex];
  if (!currentPlayer) return;

  const currentPlayerId = getPlayerId(currentPlayer);
  const currentPlayerUsername = getPlayerUsername(currentPlayer);

  if (currentPlayerId == deviceId) {
    if(parsedInstructions.reason == "DOWN-IT") {
      completePunishmentText.textContent = "Down it!";
    } else {
      completePunishmentText.textContent = "Take " + parsedInstructions.reason.replace("_", " ");
    }
    setActiveContainers(completePunishmentContainer);
  } else {
    let waitingText;
    if (parsedInstructions.reason == "DOWN-IT") {
      waitingText = `Waiting for ${currentPlayerUsername} to down their drink.`;
    } else {
      waitingText = `Waiting for ${currentPlayerUsername} to take ${(parsedInstructions.reason).replace("_", " ")}.`;
    }
    SetWaitingForPlayer({
      waitingForRoomTitle: "Waiting for " + currentPlayerUsername,
      waitingForRoomText: waitingText,
      player: currentPlayer
    });
    setActiveContainers(waitingForPlayerContainer);
  }
}

async function DisplayAnswerCard(instruction) {
  const players = currentPartyData.players || [];
  const index = players.findIndex(player => getPlayerId(player) === deviceId);
  if (index === -1) return;

  const state = currentPartyData.state ?? currentPartyData;
  const turnIndex = state.playerTurn ?? 0;
  const currentPlayer = players[turnIndex];
  if (!currentPlayer) return;

  const currentPlayerId = getPlayerId(currentPlayer);
  const currentPlayerIcon = getPlayerIcon(currentPlayer);
  const myState = getPlayerState(players[index]);

  let parsedInstructions = parseInstruction(instruction);

  selectedQuestionObj = GetQuestion({
    cardTitle: gameContainerPublicTitle,
    currentPartyData
  });
  DisplayCard(gameContainerPublic, selectedQuestionObj);

  if (!myState.hasConfirmed) {
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
    const icons = waitingForPlayersIconContainer.querySelectorAll('.icon');
    for (let i = 0; i < players.length; i++) {
      const pState = getPlayerState(players[i]);
      if (pState.hasConfirmed) {
        icons[i]?.classList.add('yes');
      } else {
        icons[i]?.classList.remove('yes');
      }
    }
    setActiveContainers(waitingForPlayersContainer);
  }
}

async function DisplayConfirmInput(instruction) {
  const players = currentPartyData.players || [];
  const deck = currentPartyData.deck ?? currentPartyData;

  const parsedInstructions = parseInstruction(instruction);
  const index = players.findIndex(player => getPlayerId(player) === deviceId);
  if (index === -1) return;

  const activePlayer = players[index];
  const activeState = getPlayerState(activePlayer);

  const state = currentPartyData.state ?? currentPartyData;
  const turnIndex = state.playerTurn ?? 0;
  const currentPlayer = players[turnIndex];
  if (!currentPlayer) return;

  const currentPlayerId = getPlayerId(currentPlayer);
  const currentPlayerUsername = getPlayerUsername(currentPlayer);

  const questionType = deck.questionType ?? currentPartyData.questionType;

  if (questionType == "truth") {
    if (!activeState.isReady && !activeState.hasConfirmed) {
      if (deviceId === currentPlayerId) {
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
    await SendInstruction({
      instruction: "DISPLAY_COMPLETE_QUESTION"
    });
  }
}

async function UserHasPassed(instruction) {
  const players = currentPartyData.players || [];
  let parsedInstructions = parseInstruction(instruction);

  const index = players.findIndex(
    player => getPlayerId(player) === parsedInstructions.deviceId
  );
  if (index === -1) return;

  const passedPlayer = players[index];
  const username = getPlayerUsername(passedPlayer);

  playerHasPassedTitle.textContent = username + " has passed";
  playerHasPassedText.textContent = "Question not answered";
  setActiveContainers(playerHasPassedContainer);

  await new Promise(resolve => setTimeout(resolve, 1000));

  if (deviceId === parsedInstructions.deviceId) {
    const deck = currentPartyData.deck ?? (currentPartyData.deck = {});
    deck.currentCardIndex = (deck.currentCardIndex ?? currentPartyData.currentCardIndex ?? 0) + 1;

    const state = currentPartyData.state ?? (currentPartyData.state = {});
    const playersLen = players.length;

    const oldTurn = state.playerTurn ?? currentPartyData.playerTurn ?? 0;
    let newTurn = oldTurn + 1;
    if (newTurn >= playersLen) newTurn = 0;
    state.playerTurn = newTurn;
    currentPartyData.playerTurn = newTurn; // optional mirror for legacy code

    await SendInstruction({
      instruction: "NEXT_USER_TURN",
      partyData: currentPartyData
    });
  }
}

async function DisplayCompleteQuestion() {
  timeout?.cancel();
  stopTimer(waitingForPlayerContainer.querySelector('.timer-wrapper'));

  const players = currentPartyData.players || [];
  const deck = currentPartyData.deck ?? currentPartyData;

  const index = players.findIndex(player => getPlayerId(player) === deviceId);
  const state = currentPartyData.state ?? currentPartyData;
  const turnIndex = state.playerTurn ?? 0;
  const currentPlayer = players[turnIndex];
  if (!currentPlayer) return;

  const currentPlayerId = getPlayerId(currentPlayer);
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
  const players = currentPartyData.players || [];
  const index = players.findIndex(player => getPlayerId(player) === deviceId);
  if (index === -1) return;

  const state = currentPartyData.state ?? (currentPartyData.state = {});

  if (!force) {
    const me = players[index];
    const myState = getPlayerState(me);
    myState.hasConfirmed = true;
    me.hasConfirmed = true; // legacy mirror
    DisplayWaitingForPlayers();
  } else {
    for (let i = 0; i < players.length; i++) {
      const p = players[i];
      const pState = getPlayerState(p);
      pState.isReady = true;
      pState.hasConfirmed = true;
      p.isReady = true;
      p.hasConfirmed = true; // legacy mirror
    }
  }

  const allConfirmed = players.every(p => {
    const ps = getPlayerState(p);
    return ps.hasConfirmed === true;
  });

  if (allConfirmed) {
    const turnIndex = state.playerTurn ?? currentPartyData.playerTurn ?? 0;
    const scorer = players[turnIndex];
    if (scorer) {
      const scorerState = getPlayerState(scorer);
      scorerState.score = (scorerState.score ?? scorer.score ?? 0) + incrementScore;
      scorer.score = scorerState.score; // mirror
    }

    for (let i = 0; i < players.length; i++) {
      const p = players[i];
      const pState = getPlayerState(p);
      pState.isReady = false;
      pState.hasConfirmed = false;
      p.isReady = false;
      p.hasConfirmed = false; // mirror
    }

    if (nextPlayer) {
      const len = players.length;
      const oldTurn = state.playerTurn ?? currentPartyData.playerTurn ?? 0;
      const newTurn = (oldTurn + 1) % len;
      state.playerTurn = newTurn;
      currentPartyData.playerTurn = newTurn; // optional for legacy use
    }

    console.log(state.playerTurn);

    await SendInstruction({
      instruction: "DISPLAY_SELECT_QUESTION_TYPE",
      partyData: currentPartyData,
      timer: Date.now() + gameRules["time-limit"] * 1000,
      byPassHost: true
    });
  } else {
    await SendInstruction({
      partyData: currentPartyData,
      byPassHost: true

    });
  }
}

async function PartySkip({ nextPlayer = true } = {}) {
  await ResetTruthOrDareQuestion({
    force: true,
    nextPlayer
  });
}
