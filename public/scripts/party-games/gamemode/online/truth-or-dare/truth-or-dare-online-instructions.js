async function DisplaySelectQuestionType() {
  const delay = new Date(currentPartyData.timer) - Date.now();
  startTimer({ timeLeft: delay / 1000, duration: getIncrementContainerValue("time-limit") * 1000 / 1000, selectedTimer: selectQuestionTypeContainer.querySelector('.timer-wrapper') });
  startTimer({ timeLeft: delay / 1000, duration: getIncrementContainerValue("time-limit") * 1000 / 1000, selectedTimer: waitingForPlayerContainer.querySelector('.timer-wrapper') });
  if (selectPunishmentButtonContainer.childElementCount == 0) {
    SetTimeOut({ delay: delay, instruction: "RESET_QUESTION:TIME_EXPIRED", nextDelay: null })
  }
  else {
    SetTimeOut({ delay: delay, instruction: "CHOOSING_PUNISHMENT", nextDelay: null })
  }

  const currentPlayer = currentPartyData.players[currentPartyData.playerTurn];
  if (deviceId === currentPlayer.computerId) {
    if (currentPartyData.currentCardIndex > numberOfTruthQuestions - 1) {
      selectQuestionTypeButtonTruth.classList.add('disabled');
    }
    if (currentPartyData.currentCardSecondIndex > numberOfDareQuestions - 1) {
      selectQuestionTypeButtonDare.classList.add('disabled');
    }
    if (currentPartyData.currentCardIndex > numberOfTruthQuestions - 1 && currentPartyData.currentCardSecondIndex > numberOfDareQuestions - 1) {
      SendInstruction({
        instruction: "GAME_OVER"
      });
    }
    EditUserIconPartyGames({
      container: gameContainerAnswer,
      userId: currentPlayer.computerId,
      userCustomisationString: currentPlayer.userIcon
    });
    setActiveContainers(selectQuestionTypeContainer);
  } else {
    SetWaitingForPlayer({
      waitingForRoomTitle: "Waiting for " + currentPlayer.username,
      waitingForRoomText: "Selecting Truth or Dare...",
      player: currentPlayer
    });
    setActiveContainers(waitingForPlayerContainer);
  }
}

async function DisplayPublicCard() {
  const delay = new Date(currentPartyData.timer) - Date.now();
  startTimer({ timeLeft: delay / 1000, duration: getIncrementContainerValue("time-limit") * 1000 / 1000, selectedTimer: gameContainerPublic.querySelector('.main-image-container').querySelector('.timer-wrapper') });
  if (selectPunishmentButtonContainer.childElementCount == 0) {
    SetTimeOut({ delay: delay, instruction: "RESET_QUESTION:TIME_EXPIRED", nextDelay: null })
  }
  else {
    SetTimeOut({ delay: delay, instruction: "CHOOSING_PUNISHMENT", nextDelay: null })
  }

  const index = currentPartyData.players.findIndex(player => player.computerId === deviceId);
  const currentPlayer = currentPartyData.players[currentPartyData.playerTurn];
  if (index === -1) {
    console.warn("Device ID not found in players");
    return;
  }

  selectedQuestionObj = GetQuestion({
    cardTitle: gameContainerPublicTitle,
    currentPartyData: currentPartyData
  })

  DisplayCard(gameContainerPublic, selectedQuestionObj);

  if (!currentPlayer.isReady && !currentPlayer.hasConfirmed) {
    EditUserIconPartyGames({
      container: gameContainerPublic,
      userId: currentPlayer.computerId,
      userCustomisationString: currentPlayer.userIcon
    });
    setActiveContainers(gameContainerPublic);
    if (deviceId === currentPlayer.computerId) {
      gameContainerPublicButtonAnswer.classList.remove('disabled');
      gameContainerPublicButtonPass.classList.remove('disabled');
      gameContainerPublicWaitingText.classList.add('disabled');
    } else {
      gameContainerPublicWaitingText.textContent = `${currentPlayer.username} is choosing answer or pass`;
      gameContainerPublicButtonAnswer.classList.add('disabled');
      gameContainerPublicButtonPass.classList.add('disabled');
      gameContainerPublicWaitingText.classList.remove('disabled');
    }
  }
}

async function ChoosingPunishment() {
  const delay = new Date(currentPartyData.timer) - Date.now();
  startTimer({ timeLeft: delay / 1000, duration: getIncrementContainerValue("time-limit") * 1000 / 1000, selectedTimer: selectPunishmentContainer.querySelector('.timer-wrapper') });
  startTimer({ timeLeft: delay / 1000, duration: getIncrementContainerValue("time-limit") * 1000 / 1000, selectedTimer: waitingForPlayerContainer.querySelector('.timer-wrapper') });
  SetTimeOut({ delay: delay, instruction: "RESET_QUESTION:TIME_EXPIRED:2", nextDelay: null })

  const index = currentPartyData.players.findIndex(player => player.computerId === currentPartyData.players[currentPartyData.playerTurn].computerId);

  if (index === -1) {
    console.error('Player not found:', currentPartyData.players[currentPartyData.playerTurn].computerId);
    return;
  }

  if (currentPartyData.players[currentPartyData.playerTurn].computerId === deviceId) {
    setActiveContainers(selectPunishmentContainer);
  }
  else {
    SetWaitingForPlayer({
      waitingForRoomTitle: "Waiting for " + currentPartyData.players[index].username,
      waitingForRoomText: "Choosing Punishment...",
      player: currentPartyData.players[index]
    });
    setActiveContainers(waitingForPlayerContainer);
  }
}

async function UserSelectedForPunishment(instruction) {
  let parsedInstructions = parseInstructionDeviceId(instruction);
  const index = currentPartyData.players.findIndex(player => player.computerId === parsedInstructions.deviceId);
  if (parsedInstructions.deviceId == deviceId) {
    setActiveContainers(selectPunishmentContainer);
  }
  else {
    SetWaitingForPlayer({
      waitingForRoomTitle: "Waiting for " + currentPartyData.players[index].username,
      waitingForRoomText: "Choosing Punishment...",
      player: currentPartyData.players[index]
    });
    setActiveContainers(waitingForPlayerContainer);
  }
}

async function DisplayPunishmentToUser(instruction) {
  let parsedInstructions = parseInstruction(instruction);
  const currentPlayer = currentPartyData.players[currentPartyData.playerTurn];

  if (currentPlayer.computerId == deviceId) {
    setActiveContainers(completePunishmentContainer);
  }
  else {
    let waitingText;
    if (parsedInstructions.reason == "DOWN-IT") {
      waitingText = `Waiting for ${currentPlayer.username} to down their drink.`;
    }
    else {
      waitingText = `Waiting for ${currentPlayer.username} to take ${(parsedInstructions.reason).replace("_", " ")}.`;
    }
    SetWaitingForPlayer({
      waitingForRoomTitle: "Waiting for " + currentPlayer.username,
      waitingForRoomText: waitingText,
      player: currentPartyData.players[currentPartyData.playerTurn]
    });
    setActiveContainers(waitingForPlayerContainer);
  }
}

async function DisplayAnswerCard(instruction) {
  const index = currentPartyData.players.findIndex(player => player.computerId === deviceId);

  const currentPlayer = currentPartyData.players[currentPartyData.playerTurn];
  let parsedInstructions = parseInstruction(instruction);

  selectedQuestionObj = GetQuestion({
    cardTitle: gameContainerPublicTitle,
    currentPartyData: currentPartyData
  })
  DisplayCard(gameContainerPublic, selectedQuestionObj);

  if (!currentPartyData.players[index].hasConfirmed) {
    const question = gameContainerPublicText.textContent;
    gameContainerAnswerTitle.src = gameContainerPublicTitle.src;
    gameContainerAnswerText.innerHTML =
      `<span class="question-text">${question}<br><span style="color:var(--secondarypagecolour);">${parsedInstructions.reason}</span></span>`;
    answerQuestionContainerQuestionText.textContent = gameContainerPublicText.textContent;
    gameContainerAnswerCardType.textContent = gameContainerPublicCardType.textContent;
    EditUserIconPartyGames({
      container: gameContainerAnswer,
      userId: currentPlayer.computerId,
      userCustomisationString: currentPlayer.userIcon
    });
    setActiveContainers(gameContainerAnswer);
  } else {
    const icons = waitingForPlayersIconContainer.querySelectorAll('.icon');
    for (let i = 0; i < currentPartyData.players.length; i++) {
      if (currentPartyData.players[i].hasConfirmed) {
        icons[i].classList.add('yes');
      } else {
        icons[i].classList.remove('yes');
      }
    }
    setActiveContainers(waitingForPlayersContainer);
  }
}

async function DisplayConfirmInput(instruction) {
  const parsedInstructions = parseInstruction(instruction);
  const index = currentPartyData.players.findIndex(player => player.computerId === deviceId);

  const activePlayer = currentPartyData.players[index];
  const currentPlayer = currentPartyData.players[currentPartyData.playerTurn];

  if (currentPartyData.questionType == "truth") {
    if (!activePlayer.isReady && !activePlayer.hasConfirmed) {
      if (deviceId === currentPlayer.computerId) {
        answerQuestionContainerQuestionText.textContent = gameContainerPublicText.textContent;
        setActiveContainers(answerQuestionContainer);
      }
      else {
        SetWaitingForPlayer({
          waitingForRoomTitle: "Waiting for " + currentPlayer.username,
          waitingForRoomText: "Writing answer to question...",
          player: currentPlayer
        });
        setActiveContainers(waitingForPlayerContainer);
      }
    }
  } else if (currentPartyData.questionType == "dare") {
    await SendInstruction({
      instruction: "DISPLAY_COMPLETE_QUESTION"
    });
  }
}


async function UserHasPassed(instruction) {
  let parsedInstructions = parseInstruction(instruction);
  const index = currentPartyData.players.findIndex(player => player.computerId === parsedInstructions.deviceId);

  playerHasPassedTitle.textContent = currentPartyData.players[index].username + " has passed";
  playerHasPassedText.textContent = "Question not answered";
  setActiveContainers(playerHasPassedContainer);

  await new Promise(resolve => setTimeout(resolve, 1000));

  if (deviceId === parsedInstructions.deviceId) {
    currentPartyData.currentCardIndex++;
    currentPartyData.playerTurn++;
    if (currentPartyData.playerTurn >= currentPartyData.players.length) {
      currentPartyData.playerTurn = 0;
    }
    await SendInstruction({
      instruction: "NEXT_USER_TURN",
      partyData: currentPartyData
    });
  }
}

async function DisplayCompleteQuestion() {
  timeout?.cancel();
  stopTimer(waitingForPlayerContainer.querySelector('.timer-wrapper'));
  const index = currentPartyData.players.findIndex(player => player.computerId === deviceId);

  const currentPlayer = currentPartyData.players[currentPartyData.playerTurn];

  selectedQuestionObj = GetQuestion({
    cardTitle: gameContainerPublicTitle,
    currentPartyData: currentPartyData
  })


  if (deviceId == currentPlayer.computerId) {
    completePromptTitle.textContent = currentPartyData.questionType.toUpperCase();
    completePromptText.textContent = selectedQuestionObj.question;
    setActiveContainers(completPromptContainer);
  }
  else {
    SetWaitingForPlayer({
      waitingForRoomTitle: "Waiting for " + currentPlayer.username,
      waitingForRoomText: "Performing Question...",
      player: currentPlayer
    });
    setActiveContainers(waitingForPlayerContainer);
  }
}

async function ResetTruthOrDareQuestion({ force = false, nextPlayer = true, incrementScore = 0 }) {
  const index = currentPartyData.players.findIndex(player => player.computerId === deviceId);

  if (!force) {
    currentPartyData.players[index].hasConfirmed = true;
    DisplayWaitingForPlayers();
  } else {
    for (let i = 0; i < currentPartyData.players.length; i++) {
      currentPartyData.players[i].isReady = true;
      currentPartyData.players[i].hasConfirmed = true;
    }
  }

  const allConfirmed = currentPartyData.players.every(player => player.hasConfirmed === true);
  if (allConfirmed) {
    //await new Promise(resolve => setTimeout(resolve, 1500));
    currentPartyData.players[currentPartyData.playerTurn].score += incrementScore;
    for (let i = 0; i < currentPartyData.players.length; i++) {
      currentPartyData.players[i].isReady = false;
      currentPartyData.players[i].hasConfirmed = false;
    }

    if (nextPlayer) {
      currentPartyData.playerTurn = (currentPartyData.playerTurn + 1) % currentPartyData.players.length;
    }

    console.log(currentPartyData.playerTurn);
    await SendInstruction({
      instruction: "DISPLAY_SELECT_QUESTION_TYPE",
      partyData: currentPartyData,
      timer: Date.now() + getIncrementContainerValue("time-limit") * 1000,
    });
  } else {
    await SendInstruction({
      partyData: currentPartyData
    });
  }
}

async function PartySkip() {
  await ResetTruthOrDareQuestion({
    force: true,
    nextPlayer: false
  });
}
