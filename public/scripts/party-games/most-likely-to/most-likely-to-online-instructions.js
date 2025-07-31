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

function DisplayPunishmentToUser(instruction) {
  let parsedInstructions = parseInstructionDeviceId(instruction)
  waitingForPlayerText.textContent = "Showing player punishment...";
  if (parsedInstructions.deviceId == deviceId) {
    setActiveContainers(completePunishmentContainer);
  }
  else {
    setActiveContainers(waitingForPlayerContainer);
  }
}

async function PunishmentOffer(instruction) {
  let parsedInstructions = parseInstructionSecondReason(instruction);
  const currentPartyData = await GetCurrentPartyData();

  if (parsedInstructions.reason == "CONFIRM") {
    if (parsedInstructions.deviceId == deviceId) {
      const icons = waitingForPlayersIconContainer.querySelectorAll('.icon');
      ResetQuestion(currentPartyData, icons);
    }
  }
}

async function ChoosingPunishment(instruction) {
  let parsedInstructions = parseInstructionDeviceId(instruction);
  const currentPartyData = await GetCurrentPartyData();
  const index = currentPartyData.players.findIndex(player => player.deviceId === parsedInstructions.reason);

  waitingForPlayerTitle.textContent = "Waiting for " + currentPartyData.players[index].username;
  waitingForPlayerText.textContent = "Choosing Punishment...";

  if (parsedInstructions.deviceId === deviceId) {
    setActiveContainers(selectPunishmentContainer);
  } else {
    setActiveContainers(waitingForPlayerContainer);
  }
}

async function ChosePunishment(instruction) {
  let parsedInstructions = parseInstruction(instruction);
  const currentPartyData = await GetCurrentPartyData();
  const index = currentPartyData.players.findIndex(player => player.deviceId === parsedInstructions.deviceId);

  if (deviceId === parsedInstructions.deviceId) {
    if (parsedInstructions.reason === "MOST_LIKELY_TO_DRINK_WHEEL") {
      setActiveContainers(drinkingWheelContainer);
    } else if (parsedInstructions.reason === "TAKE_A_SHOT") {
      punishmentText.textContent = "Take a shot.";
      setActiveContainers(completePunishmentContainer);
    }
  } else {
    waitingForPlayerTitle.textContent = "Waiting for " + currentPartyData.players[index].username;

    if (parsedInstructions.reason === "MOST_LIKELY_TO_DRINK_WHEEL") {
      waitingForPlayerText.textContent = "Spinning drink wheel...";
    } else if (parsedInstructions.reason === "TAKE_A_SHOT") {
      waitingForPlayerText.textContent = "Reading punishment...";
    }

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
    waitingForPlayerTitle.textContent = "Waiting for " + currentPartyData.players[index].username;
    waitingForPlayerText.textContent = "Choosing Punishment...";
    setActiveContainers(waitingForPlayerContainer);
  }
}

async function AnswerToUserDonePunishment() {
  const currentPartyData = await GetCurrentPartyData();
  const icons = waitingForPlayersIconContainer.querySelectorAll('.icon');

  const index = currentPartyData.players.findIndex(player => player.deviceId === deviceId);

  if (currentPartyData.players[index].isReady === true) {
    DisplayWaitingForPlayers(currentPartyData, index);

    let totalisReady = currentPartyData.players.filter(player => player.isReady).length;
    if (totalisReady === currentPartyData.players.length) {
      if (deviceId === currentPartyData.players[0].deviceId) {
        ResetQuestion(currentPartyData, icons);
      }
    }
  }
}


async function DisplayPublicCard() {
  const currentPartyData = await GetCurrentPartyData();
  const index = currentPartyData.players.findIndex(player => player.computerId === deviceId);

  const currentPlayer = currentPartyData.players[index];

  if (!currentPlayer.isReady && !currentPlayer.hasConfirmed) {
    setActiveContainers(gameContainerPublic);
  }
  else if (currentPlayer.isReady && !currentPlayer.hasConfirmed) {
    setActiveContainers(selectUserContainer);
  }
  else {
    const allConfirmed = currentPartyData.players.every(player => player.hasConfirmed);
    if (allConfirmed) {
      if (deviceId === hostDeviceId) {
        ClearVotesResults();
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
  const index = currentPartyData.players.findIndex(player => player.deviceId === deviceId);

  if (!resultsChartContainer.classList.contains('active')) {
    GetVoteResults(currentPartyData);
    setActiveContainers(resultsChartContainer);
  }

  if (deviceId == hostDeviceId) {
    await new Promise(resolve => setTimeout(resolve, 5000));
    const highestValue = getHighestVoteValue(currentPartyData);

    for (let i = 0; i < icons.length; i++) {
      currentPartyData.players[i].isReady = false;
      currentPartyData.players[i].hasConfirmed = false;
    }
    ClearIcons();

    if (highestValue < 0) {
      const updateInstruction = "TIE_BREAKER_PUNISHMENT_OFFER:" + GetHighestVoted(currentPartyData);
      await SendInstruction({
        instruction: updateInstruction,
        partyData: currentPartyData
      });
    }
    else {
      await SendInstruction({
        instruction: "CHOOSING_PUNISHMENT:" + GetHighestVoted(currentPartyData),
        partyData: currentPartyData
      });
    }
  } else {
    if (currentPartyData.players[index].hasConfirmed) {
      DisplayWaitingForPlayers(currentPartyData, index);
    }
  }
}

async function TieBreakerPunishmentOffer(instruction) {
  let parsedInstructions = parseInstruction(instruction);
  const currentPartyData = await GetCurrentPartyData();
  const index = currentPartyData.players.findIndex(player => player.computerId === deviceId);
  if (parsedInstructions.reason.includes(deviceId)) {
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
