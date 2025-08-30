function DisplayWaitingForPlayers(currentPartyData, index, confirmation = true) {
  setActiveContainers(waitingForPlayersContainer);
  const icons = waitingForPlayersIconContainer.querySelectorAll('.icon');

  for (let i = 0; i < currentPartyData.players.length; i++) {
    const player = currentPartyData.players[i];
    const check = confirmation ? player.hasConfirmed : player.isReady;

    if (check === true) {
      icons[i].classList.add('yes');
    } else if (check === false) {
      icons[i].classList.remove('yes');
    }
  }
  //currentPartyData.players[index].lastPing = Date.now();
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
  const currentPartyData = await GetCurrentPartyData();
  const index = currentPartyData.players.findIndex(player => player.computerId === parsedInstructions.reason);

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
  const currentPartyData = await GetCurrentPartyData();

  if (parsedInstructions.reason == "CONFIRM") {
    if (deviceId == hostDeviceId) {
      const icons = waitingForPlayersIconContainer.querySelectorAll('.icon');
      await ResetQuestion({
        currentPartyData: currentPartyData,
        icons: icons
      });
    }
  }
}

async function ChoosingPunishment(instruction) {
  let parsedInstructions = parseInstructionDeviceId(instruction);
  const currentPartyData = await GetCurrentPartyData();
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
  const currentPartyData = await GetCurrentPartyData();
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
  const currentPartyData = await GetCurrentPartyData();
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
  const currentPartyData = await GetCurrentPartyData();
  const icons = waitingForPlayersIconContainer.querySelectorAll('.icon');

  const index = currentPartyData.players.findIndex(player => player.computerId === deviceId);

  if (currentPartyData.players[index].isReady === true) {
    DisplayWaitingForPlayers(currentPartyData, index);

    let totalisReady = currentPartyData.players.filter(player => player.isReady).length;
    if (totalisReady === currentPartyData.players.length) {
      if (deviceId === currentPartyData.players[0].computerId) {
        await ResetQuestion({
          currentPartyData: currentPartyData,
          icons: icons
        });
      }
    }
  }
}

async function DisplayPrivateCard() {
  const currentPartyData = await GetCurrentPartyData();
  const index = currentPartyData.players.findIndex(player => player.computerId === deviceId);
  selectedQuestionObj = getNextQuestion(currentPartyData.currentCardIndex);
  selectNumberButtonContainer.innerHTML = "";
  const currentPlayer = currentPartyData.players[index];
  if (!currentPlayer.isReady && !currentPlayer.hasConfirmed) {
    DisplayCard(gameContainerPrivate, selectedQuestionObj);
    setActiveContainers(gameContainerPrivate);
  }
  else if (currentPlayer.isReady && !currentPlayer.hasConfirmed) {
    selectUserQuestionText.textContent = selectedQuestionObj.question.replace("Who's most likely to ", "")
    setActiveContainers(selectUserContainer);
  }
  else {
    const allConfirmed = currentPartyData.players.every(player => player.hasConfirmed);
    if (allConfirmed) {
      if (deviceId === hostDeviceId) {
        await SendInstruction({
          instruction: "DISPLAY_VOTE_RESULTS"
        });
      }
    }
    else {
      if (currentPlayer.hasConfirmed) {
        DisplayWaitingForPlayers(currentPartyData, index);
      }
    }
  }
}


async function DisplayVoteResults() {
  const currentPartyData = await GetCurrentPartyData();
  const icons = waitingForPlayersIconContainer.querySelectorAll('.icon');
  const index = currentPartyData.players.findIndex(player => player.computerId === deviceId);

  if (!resultsChartContainer.classList.contains('active')) {
    GetVoteResults(currentPartyData);
    setActiveContainers(resultsChartContainer);
  }
  const highestValue = getHighestVoteValue(currentPartyData);

  if (deviceId == hostDeviceId) {
    await new Promise(resolve => setTimeout(resolve, 5000));


    for (let i = 0; i < icons.length; i++) {
      if (GetHighestVoted(currentPartyData).includes(currentPartyData.players[i].computerId)) {
        currentPartyData.players[i].isReady = false;
        currentPartyData.players[i].hasConfirmed = false;
      }
      else {
        currentPartyData.players[i].isReady = true;
        currentPartyData.players[i].hasConfirmed = true;
      }
    }
    ClearIcons();
    console.log("highestValue: ", highestValue);
    if (highestValue < 0) {
      const updateInstruction = "TIE_BREAKER_PUNISHMENT_OFFER:" + GetHighestVoted(currentPartyData);
      await SendInstruction({
        instruction: updateInstruction,
        partyData: currentPartyData
      });
    }
    else {
      console.log("GetHighestVoted: ", GetHighestVoted(currentPartyData));
      await SendInstruction({
        instruction: "CHOOSING_PUNISHMENT:" + GetHighestVoted(currentPartyData),
        partyData: currentPartyData
      });
    }
  }
}

async function TieBreakerPunishmentOffer(instruction) {
  let parsedInstructions = parseInstruction(instruction);
  const currentPartyData = await GetCurrentPartyData();
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
        DisplayWaitingForPlayers(currentPartyData, index, true);
      }
    }
  } else {
    DisplayWaitingForPlayers(currentPartyData, index, true);
  }
}

async function PartySkip() {
  const currentPartyData = await GetCurrentPartyData();
  const icons = waitingForPlayersIconContainer.querySelectorAll('.icon');
  await ResetQuestion({
    currentPartyData: currentPartyData,
    icons: icons
  });
}