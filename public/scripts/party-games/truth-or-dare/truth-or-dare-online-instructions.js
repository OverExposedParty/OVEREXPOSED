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

async function DisplaySelectQuestionType() {
  const currentPartyData = await GetCurrentPartyData();
  const currentPlayer = currentPartyData.players[currentPartyData.playerTurn];
  if (deviceId === currentPlayer.computerId) {
    setActiveContainers(selectQuestionTypeContainer);
  } else {
    waitingForPlayerTitle.textContent = "Waiting for " + currentPlayer.username;
    waitingForPlayerText.textContent = "Selecting Truth or Dare...";
    setActiveContainers(waitingForPlayerContainer);
  }
}

async function DisplayWaitingForPlayers(currentPartyData, index, confirmation = true) {
  setActiveContainers(waitingForPlayers);
  const icons = waitingForPlayersIconContainer.querySelectorAll('.icon');

  let boolCheck;
  if (confirmation === true) {
    boolCheck = currentPartyData.players.map(player => player.hasConfirmed);
  } else {
    boolCheck = currentPartyData.players.map(player => player.isReady);
  }

  for (let i = 0; i < boolCheck.length; i++) {
    if (boolCheck[i] === true) {
      icons[i]?.classList.add('yes');
    } else {
      icons[i]?.classList.remove('yes');
    }
  }

  currentPartyData.players[index].lastPing = new Date();

  await updateOnlineParty({
    partyId: partyCode,
    players: currentPartyData.players,
    lastPinged: Date.now(),
  });
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

async function ChoosingPunishment(instruction) {
  let parsedInstructions = parseInstructionDeviceId(instruction);
  const currentPartyData = await GetCurrentPartyData();
  const index = currentPartyData.players.findIndex(player => player.computerId === parsedInstructions.deviceId);

  if (index === -1) {
    console.error('Player not found:', parsedInstructions.deviceId);
    return;
  }

  waitingForPlayerTitle.textContent = "Waiting for " + currentPartyData.players[index].username;
  waitingForPlayerText.textContent = "Choosing Punishment...";
  
  if (parsedInstructions.deviceId === deviceId) {
    setActiveContainers(selectPunishmentContainer);
  } else {
    setActiveContainers(waitingForPlayerContainer);
  }
}


async function ChosePunishment(instruction) {
  let parsedInstructions = parseInstruction(instruction)
  const currentPartyData = await GetCurrentPartyData();

  const index = currentPartyData.players.findIndex(player => player.computerId === parsedInstructions.deviceId);
  if (deviceId == parsedInstructions.deviceId) {
    if (parsedInstructions.reason == "MOST_LIKELY_TO_DRINK_WHEEL") {
      setActiveContainers(drinkingWheelContainer);
    }
    else if (parsedInstructions.reason == "TAKE_A_SHOT") {
      punishmentText.textContent = "In order to find out the question you have to take a shot.";
      setActiveContainers(completePunishmentContainer);
    }
  }
  else {
    waitingForPlayerTitle.textContent = "Waiting for " + currentPartyData.players[index].username;
    if (parsedInstructions.reason == "MOST_LIKELY_TO_DRINK_WHEEL") {
      waitingForPlayerText.textContent = "Spinning drink wheel...";
    }
    else if (parsedInstructions.reason == "TAKE_A_SHOT") {
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

async function DisplayPublicCard(instruction) {
  let parsedInstructions = parseInstruction(instruction);
  const currentPartyData = await GetCurrentPartyData();
  const index = currentPartyData.players.findIndex(player => player.computerId === deviceId);
  if (index === -1) {
    console.warn("Device ID not found in players");
    return;
  }

  let selectedQuestionObj;

  if (parsedInstructions.reason == 0) {
    gameContainerPublicTitle.src = "/images/party-games/truth-or-dare/truth-text.svg";
    selectedQuestionObj = getNextQuestion(currentPartyData.currentCardIndex, parsedInstructions.reason, currentPartyData.shuffleSeed);
  } else if (parsedInstructions.reason == 1) {
    gameContainerPublicTitle.src = "/images/party-games/truth-or-dare/dare-text.svg";
    selectedQuestionObj = getNextQuestion(currentPartyData.currentCardSecondIndex, parsedInstructions.reason, currentPartyData.shuffleSeed);
  } else {
    console.warn("Unknown reason in parsedInstructions:", parsedInstructions.reason);
    return;
  }

  updateTextContainer(selectedQuestionObj.question, selectedQuestionObj.cardType);

  const currentPlayer = currentPartyData.players[index];
  const activePlayer = currentPartyData.players[currentPartyData.playerTurn];

  if (!currentPlayer.isReady && !currentPlayer.hasConfirmed) {
    setActiveContainers(gameContainerPublic);
    if (deviceId === activePlayer.computerId) {
      gameContainerPublicButtonAnswer.classList.remove('disabled');
      gameContainerPublicButtonPass.classList.remove('disabled');
      gameContainerPublicWaitingText.classList.add('disabled');
    } else {
      gameContainerPublicWaitingText.textContent = `${activePlayer.username} is picking truth or dare`;
      gameContainerPublicButtonAnswer.classList.add('disabled');
      gameContainerPublicButtonPass.classList.add('disabled');
      gameContainerPublicWaitingText.classList.remove('disabled');
    }
  }
}

async function DisplayAnswerCard(instruction) {
  const currentPartyData = await GetCurrentPartyData();
  const index = currentPartyData.players.findIndex(player => player.computerId === deviceId);
  let parsedInstructions = parseInstruction(instruction);
  
  const selectedQuestionObj = getNextQuestion(currentPartyData.currentCardIndex, 0, currentPartyData.shuffleSeed);
  gameContainerPublicTitle.src = "/images/party-games/truth-or-dare/truth-text.svg";
  updateTextContainer(selectedQuestionObj.question, selectedQuestionObj.cardType);

  if (!currentPartyData.players[index].hasConfirmed) {
    const question = gameContainerPublicText.textContent;
    gameContainerAnswerTitle.src = gameContainerPublicTitle.src;
    gameContainerAnswerText.innerHTML =
      `<span class="question-text">${question}<br><span style="color:var(--secondarypagecolour);">${currentPartyData.players[currentPartyData.playerTurn].username}: ${parsedInstructions.reason}</span></span>`;
    answerQuestionContainerQuestionText.textContent = gameContainerPublicText.textContent;
    gameContainerAnswerCardType.textContent = gameContainerPublicCardType.textContent;
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
    setActiveContainers(waitingForPlayers);
  }
}

async function DisplayConfirmInput(instruction) {
  const currentPartyData = await GetCurrentPartyData();
  const index = currentPartyData.players.findIndex(player => player.computerId === deviceId);
  let parsedInstructions = parseInstruction(instruction);

  if (parsedInstructions.reason == 0) {
    if (!currentPartyData.players[index].isReady && !currentPartyData.players[index].hasConfirmed) {
      if (deviceId === currentPartyData.players[currentPartyData.playerTurn].computerId) {
        answerQuestionContainerQuestionText.textContent = gameContainerPublicText.textContent;
        setActiveContainers(answerQuestionContainer);
      } else {
        waitingForPlayerText.textContent = "Writing answer to question...";
        setActiveContainers(waitingForPlayerContainer);
      }
    }
  } else if (parsedInstructions.reason == 1) {
    await ResetTruthOrDareQuestion(true);
  }
}


async function UserHasPassed(instruction) {
  let parsedInstructions = parseInstruction(instruction);

  const currentPartyData = await GetCurrentPartyData();
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

async function ResetTruthOrDareQuestion(force = false) {
  const currentPartyData = await GetCurrentPartyData();
  const index = currentPartyData.players.findIndex(player => player.computerId === deviceId);

  if (!force) {
    currentPartyData.players[index].hasConfirmed = true;
    DisplayWaitingForPlayers(currentPartyData, index);
  } else {
    for (let i = 0; i < currentPartyData.players.length; i++) {
      currentPartyData.players[i].isReady = true;
      currentPartyData.players[i].hasConfirmed = true;
    }
  }

  const allConfirmed = currentPartyData.players.every(player => player.hasConfirmed === true);
  if (allConfirmed) {
    await new Promise(resolve => setTimeout(resolve, 1500));

    for (let i = 0; i < currentPartyData.players.length; i++) {
      currentPartyData.players[i].isReady = false;
      currentPartyData.players[i].hasConfirmed = false;
    }

    currentPartyData.playerTurn++;
    if (currentPartyData.playerTurn > currentPartyData.players.length - 1) {
      currentPartyData.playerTurn = 0;
    }

    await SendInstruction({
      instruction: "DISPLAY_SELECT_QUESTION_TYPE:" + currentPartyData.playerTurn,
      partyData: currentPartyData
    });
  } else {
    await SendInstruction({
      partyData: currentPartyData
    });
  }
}

async function IncrementCurrentCardIndex(type) {
  const currentPartyData = await GetCurrentPartyData();
  if (type == 0) {
    currentPartyData.currentCardIndex++;
  }
  else if (type == 1) {
    currentPartyData.currentCardSecondIndex++;
  }
  await SendInstruction({
    partyData: currentPartyData
  });
}

async function SendInstructionTruthOrDare(stringInstruction, includeReason = false, updateUsersReady = false, updateUsersConfirmation = false) {
  const currentPartyData = await GetCurrentPartyData();
  const index = currentPartyData.players.findIndex(player => player.computerId === deviceId);

  if (index === -1) {
    console.warn("Device ID not found in currentPartyData.players");
    return; // exit early if player not found
  }

  // Update this player's last ping timestamp
  currentPartyData.players[index].lastPinged = Date.now();

  // Compose instruction string
  let currentParsedInstructions = parseInstruction(currentPartyData.userInstructions);
  let instruction = includeReason ? stringInstruction + currentParsedInstructions.reason : stringInstruction;

  // Update all players' usersReady if requested
  if (updateUsersReady === true) {
    currentPartyData.players.forEach(player => {
      player.usersReady = true;
    });
  }

  // Update all players' usersConfirmation if requested
  if (updateUsersConfirmation === true) {
    currentPartyData.players.forEach(player => {
      player.usersConfirmation = true;
    });
  }

  console.log("🧪 Instruction Received:", instruction);

  // Send updated players array directly to backend
  await updateOnlineParty({
    partyId: partyCode,
    players: currentPartyData.players,
    userInstructions: instruction,
    lastPinged: Date.now(),
  });
}
