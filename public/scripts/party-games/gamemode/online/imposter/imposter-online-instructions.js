async function DisplayStartTimer() {
  const delay = new Date(currentPartyData.timer) - Date.now();
  startTimer({ timeLeft: delay / 1000, duration: getIncrementContainerValue("imposter-time-limit") * 1000 / 1000, selectedTimer: displayStartTimerContainer.querySelector('.timer-wrapper') });
  SetTimeOut({ delay: delay, instruction: "DISPLAY_ANSWER_CONTAINER", nextDelay: null });

  const index = currentPartyData.players.findIndex(player => player.computerId === deviceId);

  const allConfirmed = currentPartyData.players.every(player => player.hasConfirmed === true);
  if (allConfirmed) {
    if (deviceId === hostDeviceId) {
      await SendInstruction({
        instruction: "DISPLAY_ANSWER_CONTAINER",
        updateUsersReady: false,
        updateUsersConfirmation: false
      });
    }
  }
  else {
    if (currentPartyData.players[index].hasConfirmed === false) {
      selectedQuestionObj = getNextQuestion(currentPartyData.currentCardIndex);
      if (currentPartyData.playerTurn == index) {
        selectedQuestionObj.question = GetAlternativeQuestion(selectedQuestionObj.questionAlternatives);
      }
      displayStartTimerText.textContent = "Your word is: " + selectedQuestionObj.question;
      setActiveContainers(displayStartTimerContainer);
    }
    else {
      DisplayWaitingForPlayers();
    }
  }
}

async function DisplayAnswerContainer() {
  if (timeout?.cancel) {
    timeout.cancel();
  }
  const index = currentPartyData.players.findIndex(player => player.computerId === deviceId);
  if (currentPartyData.round >= rounds) {
    if (deviceId === hostDeviceId) {
      currentPartyData.round = 0;
      currentPartyData.roundPlayerTurn = 0;
      await SendInstruction({
        partyData: currentPartyData,
        instruction: "DISPLAY_PRIVATE_CARD",
        updateUsersReady: true,
        updateUsersConfirmation: false,
        timer: Date.now() + getIncrementContainerValue("imposter-time-limit") * 1000,
      });
    }
  }
  else if (index === currentPartyData.roundPlayerTurn) {
    selectedQuestionObj = getNextQuestion(currentPartyData.currentCardIndex);
    if (currentPartyData.playerTurn == index) {
      selectedQuestionObj.question = GetAlternativeQuestion(selectedQuestionObj.questionAlternatives);
    }
    displayUserAnswerText.textContent = `Your word is ${selectedQuestionObj.question} explain the word but remember you may be imposter.`;
    setActiveContainers(displayUserAnswerContainer);
  }
  else {
    SetWaitingForPlayer({
      waitingForRoomTitle: "Waiting for " + currentPartyData.players[currentPartyData.roundPlayerTurn].username,
      waitingForRoomText: "Choosing Punishment...",
      player: currentPartyData.players[currentPartyData.roundPlayerTurn]
    });
    setActiveContainers(waitingForPlayerContainer);
  }

}

async function DisplayPrivateCard() {
  const index = currentPartyData.players.findIndex(player => player.computerId === deviceId);
  const player = currentPartyData.players[index];

  const delay = new Date(currentPartyData.timer) - Date.now();
  startTimer({ timeLeft: delay / 1000, duration: getIncrementContainerValue("imposter-time-limit") * 1000 / 1000, selectedTimer: cardContainerPrivate.querySelector('.timer-wrapper') });
  startTimer({ timeLeft: delay / 1000, duration: getIncrementContainerValue("imposter-time-limit") * 1000 / 1000, selectedTimer: selectUserContainer.querySelector('.timer-wrapper') });
  SetTimeOut({ delay: delay, instruction: "DISPLAY_VOTE_RESULTS", nextDelay: resultTimerDuration })

  selectUserQuestionText.textContent = "Select who you think is the Imposter";
  if (!player.isReady && !player.hasConfirmed) {
    selectedQuestionObj = getNextQuestion(currentPartyData.currentCardIndex);
    if (currentPartyData.playerTurn == index) {
      selectedQuestionObj.question = GetAlternativeQuestion(selectedQuestionObj.questionAlternatives);
    }
    DisplayCard(gameContainerPrivate, selectedQuestionObj);
    setActiveContainers(gameContainerPrivate);
  }
  else if (player.isReady && !player.hasConfirmed) {
    setActiveContainers(selectUserContainer);
  }
  else {
    const allConfirmed = currentPartyData.players.every(player => player.hasConfirmed === true);

    if (allConfirmed) {
      if (deviceId === currentPartyData.players[0].computerId) {
        await SendInstruction({
          instruction: "DISPLAY_VOTE_RESULTS",
          timer: Date.now() + resultTimerDuration
        });
      }
    }
    else {
      if (player.hasConfirmed) {
        DisplayWaitingForPlayers();
      }
    }
  }
}

async function DisplayVoteResults() {
  const icons = waitingForPlayersIconContainer.querySelectorAll('.icon');
  const index = currentPartyData.players.findIndex(player => player.computerId === deviceId);

  if (!resultsChartContainer.classList.contains('active')) {
    GetVoteResults(currentPartyData);
    setActiveContainers(resultsChartContainer);
  }

  const delay = new Date(currentPartyData.timer) - Date.now();
  startTimer({ timeLeft: delay / 1000, duration: resultTimerDuration / 1000, selectedTimer: resultsChartContainer.querySelector('.timer-wrapper') });
  SetTimeOut({ delay: delay, instruction: "DISPLAY_VOTE_RESULTS_PART_TWO", nextDelay: resultTimerDuration })
}

async function DisplayVoteResultsPartTwo() {
  let instruction = "";
  const highestValue = getHighestVoteValue(currentPartyData);
  if (GetHighestVoted(currentPartyData).includes(currentPartyData.players[currentPartyData.playerTurn].computerId) && highestValue > 0) {
    SetWaitingForPlayer({
      waitingForRoomTitle: "Imposter found!",
      waitingForRoomText: currentPartyData.players[currentPartyData.playerTurn].username + " was the Imposter",
      player: currentPartyData.players[currentPartyData.playerTurn]
    });
    if (CheckSettingsExists("drink-punishment")) {
      instruction = "CHOOSING_PUNISHMENT";
    }
    else {
      instruction = "RESET_QUESTION:NEXT_PLAYER";
    }
  }
  else {
    SetWaitingForPlayer({
      waitingForRoomTitle: "Imposter wins",
      waitingForRoomText: currentPartyData.players[currentPartyData.playerTurn].username + " was the Imposter",
      player: currentPartyData.players[currentPartyData.playerTurn]
    });
    instruction = "RESET_QUESTION:NEXT_PLAYER";
  }
  setActiveContainers(waitingForPlayerContainer);

  const delay = new Date(currentPartyData.timer) - Date.now();
  startTimer({ timeLeft: delay / 1000, duration: resultTimerDuration / 1000, selectedTimer: waitingForPlayerContainer.querySelector('.timer-wrapper') });
  SetTimeOut({ delay: delay, instruction: instruction })
}

async function DisplayPunishmentToUser() {
  let parsedInstructions = parseInstruction(currentPartyData.userInstructions)
  const index = currentPartyData.players.findIndex(player => player.computerId === currentPartyData.players[currentPartyData.playerTurn].vote);
  console.log("parsedInstructions.reason: ", parsedInstructions.reason);
  if (currentPartyData.players[currentPartyData.playerTurn].vote == deviceId) {
    if (parsedInstructions.reason == "DOWN_IT") {
      completePunishmentText.textContent = "In order to find out the question you have to down your drink.";
      completePunishmentContainer.setAttribute("punishment-type", "down-drink");
    } else {
      completePunishmentText.textContent = "In order to find out the question you have to take " + (parsedInstructions.reason).replace('_', ' ') + ".";
      completePunishmentContainer.setAttribute("punishment-type", parsedInstructions.reason);
    }
    setActiveContainers(completePunishmentContainer);
  }
  else {
    SetWaitingForPlayer({
      waitingForRoomTitle: "Waiting for " + currentPartyData.players[index].username,
      waitingForRoomText: "Showing player punishment...",
      player: currentPlayer
    });
    setActiveContainers(waitingForPlayerContainer);
  }
}

async function ResetImposterQuestion({ nextPlayer = true } = {}) {
  if (deviceId != hostDeviceId) return;
  ClearIcons();

  currentPartyData.currentCardIndex++;
  if (nextPlayer == true) {
    currentPartyData.playerTurn = Math.floor(Math.random() * currentPartyData.players.length);
  }
  for (let i = 0; i < currentPartyData.players.length; i++) {
    currentPartyData.players[i].isReady = false;
    currentPartyData.players[i].hasConfirmed = false;
    currentPartyData.players[i].vote = "";
  }
  await SendInstruction({
    instruction: resetGamemodeInstruction,
    partyData: currentPartyData,
    timer: Date.now() + getIncrementContainerValue("imposter-time-limit") * 1000,
    alternativeQuestionIndex: Math.floor(Math.random() * 255)
  });

}

async function PartySkip() {
  await ResetImposterQuestion({ nextPlayer: true });
}