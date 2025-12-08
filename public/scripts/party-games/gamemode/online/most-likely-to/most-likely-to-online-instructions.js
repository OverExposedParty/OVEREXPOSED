async function DisplayPrivateCard() {
  const delay = new Date(currentPartyData.timer) - Date.now();
  startTimer({ timeLeft: delay / 1000, duration: getIncrementContainerValue("time-limit") * 1000 / 1000, selectedTimer: gameContainerPrivate.querySelector('.timer-wrapper') });
  startTimer({ timeLeft: delay / 1000, duration: getIncrementContainerValue("time-limit") * 1000 / 1000, selectedTimer: selectUserContainer.querySelector('.timer-wrapper') });
  startTimer({ timeLeft: delay / 1000, duration: getIncrementContainerValue("time-limit") * 1000 / 1000, selectedTimer: waitingForPlayersContainer.querySelector('.timer-wrapper') });
  SetTimeOut({ delay: delay, instruction: "DISPLAY_VOTE_RESULTS", nextDelay: resultTimerDuration })

  const index = currentPartyData.players.findIndex(player => player.computerId === deviceId);
  selectedQuestionObj = getNextQuestion(currentPartyData.currentCardIndex);
  selectNumberButtonContainer.innerHTML = "";

  selectUserQuestionText.textContent = selectedQuestionObj.question.replace("Who's most likely to ", "");
  DisplayCard(gameContainerPrivate, selectedQuestionObj);

  const currentPlayer = currentPartyData.players[index];
  if (!currentPlayer.isReady && !currentPlayer.hasConfirmed) {
    setActiveContainers(gameContainerPrivate);
  }
  else if (currentPlayer.isReady && !currentPlayer.hasConfirmed) {
    setActiveContainers(selectUserContainer);
  }
  else {
    const allConfirmed = currentPartyData.players.every(player => player.hasConfirmed);
    if (allConfirmed) {
      if (deviceId === hostDeviceId) {
        await SendInstruction({
          instruction: "DISPLAY_VOTE_RESULTS",
          timer: Date.now() + resultTimerDuration
        });
      }
    }
    else {
      if (currentPlayer.hasConfirmed) {
        DisplayWaitingForPlayers();
      }
    }
  }
}


async function DisplayVoteResults() {
  const delay = new Date(currentPartyData.timer) - Date.now();
  stopTimer(waitingForPlayersContainer.querySelector('.timer-wrapper'));
  startTimer({ timeLeft: delay / 1000, duration: resultTimerDuration / 1000, selectedTimer: resultsChartContainer.querySelector('.timer-wrapper') });
  const icons = waitingForPlayersIconContainer.querySelectorAll('.icon');
  const index = currentPartyData.players.findIndex(player => player.computerId === deviceId);

  if (!resultsChartContainer.classList.contains('active')) {
    GetVoteResults(currentPartyData);
    setActiveContainers(resultsChartContainer);
  }
  const highestValue = getHighestVoteValue(currentPartyData);
  console.log("highestValue: " + highestValue);
  if (deviceId == hostDeviceId) {
    for (let i = 0; i < icons.length; i++) {
      if (GetHighestVoted(currentPartyData).includes(currentPartyData.players[i].computerId)) {
        currentPartyData.players[i].isReady = false;
        currentPartyData.players[i].hasConfirmed = false;
        if(highestValue > 0) {
        currentPartyData.players[i].score++;
        }
      }
      else {
        currentPartyData.players[i].isReady = true;
        currentPartyData.players[i].hasConfirmed = true;
      }
    }
    ClearIcons();
    if (selectPunishmentButtonContainer.childElementCount == 0) {
      SetTimeOut({ delay: delay, instruction: "RESET_QUESTION", nextDelay: null });
    }
    else {
      if (highestValue < 0) {
        const updateInstruction = "TIE_BREAKER_PUNISHMENT_OFFER:" + GetHighestVoted(currentPartyData);
        SetTimeOut({ delay: delay, instruction: updateInstruction, nextDelay: getIncrementContainerValue("time-limit") * 1000 });
      }
      else if (highestValue == 0) {
        SetTimeOut({ delay: delay, instruction: "RESET_QUESTION", nextDelay: null });
      }
      else {
        SetTimeOut({ delay: delay, instruction: "CHOOSING_PUNISHMENT:" + GetHighestVoted(currentPartyData), nextDelay: getIncrementContainerValue("time-limit") * 1000 });
      }
    }
  }
}

async function TieBreakerPunishmentOffer(instruction) {
  let parsedInstructions = parseInstruction(instruction);
  const delay = new Date(currentPartyData.timer) - Date.now();
  startTimer({ timeLeft: delay / 1000, duration: getIncrementContainerValue("time-limit") * 1000 / 1000, selectedTimer: selectNumberContainer.querySelector('.timer-wrapper') });
  startTimer({ timeLeft: delay / 1000, duration: getIncrementContainerValue("time-limit") * 1000 / 1000, selectedTimer: waitingForPlayersContainer.querySelector('.timer-wrapper') });
  SetTimeOut({ delay: delay, instruction: "CHOOSING_PUNISHMENT:" + GetStringAtIndex(parsedInstructions.reason, 0), nextDelay: null }); //make it so that if the person has voted but others havent then they are penalised for not voting

  const index = currentPartyData.players.findIndex(player => player.computerId === deviceId);
  if ((parsedInstructions.reason).includes(deviceId)) {
    console.log(parsedInstructions.reason);
    for (let i = 0; i < CountParsedString(parsedInstructions.reason); i++) {
      if (selectNumberButtonContainer.querySelectorAll('button').length < CountParsedString(parsedInstructions.reason)) {
        const selectedNumberButton = createUserButton(i, i + 1);

        selectedNumberButton.addEventListener('click', () => {
          selectNumberContainer.querySelectorAll('button').forEach(btn => btn.classList.remove('active'));
          selectedNumberButton.classList.add('active');
          selectNumberContainer.setAttribute('selected-id', selectedNumberButton.getAttribute('id'));
        });

        selectNumberButtonContainer.appendChild(selectedNumberButton);
      }
    }

    if (currentPartyData.players[index].hasConfirmed === false) {
      setActiveContainers(selectNumberContainer);
      for (let i = 0; i < CountParsedString(parsedInstructions.reason); i++) {
        const button = document.getElementById(String(i));
        if (currentPartyData.players.some(player => player.vote === String(i))) {
          button.classList.add("disabled");
        } else {
          button.classList.remove("disabled");
        }
      }
    }
    else {
      if (currentPartyData.players.every(player => player.hasConfirmed === true)) {
        const randomInt = Math.floor(Math.random() * -getHighestVoteValue(currentPartyData));
        await SendInstruction({
          instruction: "CHOOSING_PUNISHMENT:" + GetStringAtIndex(parsedInstructions.reason, randomInt),
          updateisReady: false,
          updatehasConfirmed: false,
        });
      } else {
        DisplayWaitingForPlayers();
      }
    }
  } else {
    DisplayWaitingForPlayers();
  }
}

async function WaitingForPlayer(instruction) {
  let parsedInstructions = parseInstruction(instruction)

  if (await GetSelectedPlayerTurnID() === deviceId) {
    if (parsedInstructions.reason != "READING_CARD") {
      setActiveContainers(selectUserContainer);
    }
    else {
      setActiveContainers(gameContainerPrivate);
    }
  }
  else {
    setActiveContainers(waitingForPlayerContainer);
  }

  waitingForPlayerTitle.textContent = "Waiting for " + parsedInstructions.username;

  if (parsedInstructions.reason == "CHOOSE_PLAYER") {
    waitingForPlayerText.textContent = "Choosing Player...";
  }
  else if (parsedInstructions.reason == "READING_CARD") {
    waitingForPlayerText.textContent = "Reading Card...";
  }
}

async function DisplayPunishmentToUser(instruction) {
  let parsedInstructions = parseInstruction(instruction);
  const index = currentPartyData.players.findIndex(player => player.computerId === parsedInstructions.deviceId);

  if (parsedInstructions.deviceId == deviceId) {
    completePunishmentText.textContent = "take " + parsedInstructions.reason.replace("_", " ");
    setActiveContainers(completePunishmentContainer);
  }
  else {
    SetWaitingForPlayer({
      waitingForRoomTitle: "Waiting for " + currentPartyData.players[index].username,
      waitingForRoomText: "Showing player punishment...",
      player: currentPartyData.players[index]
    });
    setActiveContainers(waitingForPlayerContainer);
  }
}

async function PunishmentOffer(instruction) {
  let parsedInstructions = parseInstruction(instruction);

  if (parsedInstructions.reason == "CONFIRM") {
    if (deviceId == hostDeviceId) {
      const icons = waitingForPlayersIconContainer.querySelectorAll('.icon');
      await ResetQuestion({
        icons: icons,
        timer: Date.now() + getIncrementContainerValue("time-limit") * 1000
      });
    }
  }
}

async function ChoosingPunishment(instruction) {
    let parsedInstructions = parseInstructionDeviceId(instruction);

  const delay = new Date(currentPartyData.timer) - Date.now();
  startTimer({ timeLeft: delay / 1000, duration: getIncrementContainerValue("time-limit") * 1000 / 1000, selectedTimer: selectPunishmentContainer.querySelector('.timer-wrapper') });
  startTimer({ timeLeft: delay / 1000, duration: getIncrementContainerValue("time-limit") * 1000 / 1000, selectedTimer: waitingForPlayerContainer.querySelector('.timer-wrapper') });
  SetTimeOut({ delay: delay, instruction: `RESET_QUESTION:PLAYER_TURN_PASSED:${parsedInstructions.reason}`, nextDelay: resultTimerDuration })
  const index = currentPartyData.players.findIndex(player => player.computerId === parsedInstructions.deviceId);

  if (parsedInstructions.deviceId === deviceId) {
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

async function ChosePunishment(instruction) {
  let parsedInstructions = parseInstruction(instruction);
  const index = currentPartyData.players.findIndex(player => player.computerId === parsedInstructions.deviceId);

  if (deviceId === parsedInstructions.deviceId) {
    if (parsedInstructions.reason === "MOST_LIKELY_TO_DRINK_WHEEL") {
      setActiveContainers(drinkWheelContainer);
    } else if (parsedInstructions.reason === "TAKE_A_SHOT") {
      punishmentText.textContent = "Take a shot.";
      setActiveContainers(completePunishmentContainer);
    }
  } else {
    let currentWaitingForPlayerText = "";
    if (parsedInstructions.reason === "MOST_LIKELY_TO_DRINK_WHEEL") {
      currentWaitingForPlayerText = "Spinning drink wheel...";
    } else if (parsedInstructions.reason === "TAKE_A_SHOT") {
      currentWaitingForPlayerText = "Reading punishment...";
    }
    SetWaitingForPlayer({
      waitingForRoomTitle: "Waiting for " + currentPartyData.players[index].username,
      waitingForRoomText: currentWaitingForPlayerText,
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

async function AnswerToUserDonePunishment() {
  const icons = waitingForPlayersIconContainer.querySelectorAll('.icon');

  const index = currentPartyData.players.findIndex(player => player.computerId === deviceId);

  if (currentPartyData.players[index].isReady === true) {
    DisplayWaitingForPlayers();

    let totalisReady = currentPartyData.players.filter(player => player.isReady).length;
    if (totalisReady === currentPartyData.players.length) {
      if (deviceId === currentPartyData.players[0].computerId) {
        await ResetQuestion({
          icons: icons,
          timer: Date.now() + getIncrementContainerValue("time-limit") * 1000
        });
      }
    }
  }
}

async function PartySkip() {
  const icons = waitingForPlayersIconContainer.querySelectorAll('.icon');
  await ResetQuestion({
    icons: icons,
    timer: Date.now() + getIncrementContainerValue("time-limit") * 1000
  });
}