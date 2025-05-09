async function NextUserTurn() {
  const existingData = await getExistingPartyData(partyCode);
  if (!existingData || existingData.length === 0) {
    console.warn('No party data found.');
    return;
  }
  const currentPartyData = existingData[0];

  const selectedQuestionObj = getNextQuestion(currentPartyData.currentCardIndex);
  updateTextContainer(selectedQuestionObj.question, selectedQuestionObj.cardType);

  playerHasPassedContainer.classList.remove('active');

  if (await GetSelectedPlayerTurnID() == deviceId) {
    waitingForPlayerContainer.classList.remove('active');
    gameContainerPrivate.classList.add('active');
  }
  else {
    waitingForPlayerTitle.textContent = "Waiting for " + currentPartyData.usernames[currentPartyData.playerTurn]
    waitingForPlayerText.textContent = "Reading Card...";
    waitingForPlayerContainer.classList.add('active');
  }
}

async function NextQuestion() {
  const existingData = await getExistingPartyData(partyCode);
  if (!existingData || existingData.length === 0) {
    console.warn('No party data found.');
    return;
  }
  const currentPartyData = existingData[0];
  const index = currentPartyData.computerIds.indexOf(deviceId);
  waitingForPlayerContainer.classList.remove('active');
  gameContainerPrivate.classList.remove('active');
  const icons = nextQuestionSectionContainer.querySelectorAll('.icon');
  if (currentPartyData.usersReady[index] == false) {
    currentPartyData.usersReady[index] = true;
    nextQuestionContainer.classList.add('active');
    let totalUsersReady = 0;
    for (let i = 0; i < icons.length; i++) {
      if (currentPartyData.usersReady[i] == true) {
        totalUsersReady++;
      }
    }
    if (totalUsersReady == currentPartyData.computerIds.length) {
      await updateOnlineParty({
        partyId: partyCode,
        usersReady: currentPartyData.usersReady,
        userInstructions: "NEXT_USER_TURN",
        lastPinged: Date.now(),
      });
    }
    else {
      await updateOnlineParty({
        partyId: partyCode,
        usersReady: currentPartyData.usersReady,
        lastPinged: Date.now(),
      });
    }
    for (let i = 0; i < icons.length; i++) {
      if (currentPartyData.usersReady[i] == true) {
        icons[i].classList.add('yes');
      }
    }
  }
}

function UserHasPassed(instruction) {
  let parsedInstructions = parseInstruction(instruction)
  playerHasPassedContainer.classList.add('active');
  waitingForPlayerContainer.classList.remove('active');
  playerHasPassedTitle.textContent = parsedInstructions.username + " has passed";
  if (parsedInstructions.reason == "USER_CALLED_WRONG_FACE") {
    playerHasPassedText.textContent = "unsuccessful coin flip";
  }
}

async function WaitingForPlayer(instruction) {
  let parsedInstructions = parseInstruction(instruction)
  waitingForPlayerTitle.textContent = "Waiting for " + parsedInstructions.username;
  if (parsedInstructions.reason == "CHOOSE_PLAYER") {
    waitingForPlayerText.textContent = "Choosing Player...";
    if (await GetSelectedPlayerTurnID() === deviceId) {
      gameContainerPrivate.classList.remove('active');
      selectUserContainer.classList.add('active');
    }
    else {
      selectUserContainer.classList.remove('active');
      waitingForPlayerContainer.classList.add('active');

    }
  }
}

function ChoosingPunishment(instruction) {
  selectUserContainer.classList.remove('active');
  let parsedInstructions = parseInstructionWithDeviceID(instruction)
  waitingForPlayerTitle.textContent = "Waiting for " + parsedInstructions.username;
  waitingForPlayerText.textContent = "Choosing Punishment...";
  if (parsedInstructions.deviceId == deviceId) {
    waitingForPlayerContainer.classList.remove('active');
    selectPunishmentContainer.classList.add('active');
  }
  else {
    selectUserContainer.classList.remove('active');
    waitingForPlayerContainer.classList.add('active');
  }
}
async function ChosePunishment(instruction) {
  let parsedInstructions = parseInstructionWithReasonAndDeviceID(instruction)
  const selectedDeviceId = await GetSelectedPlayerTurnID()
  if (deviceId == parsedInstructions.deviceId) {
    if (parsedInstructions.reason == "PARANOIA_COIN_FLIP") {
      pickHeadsOrTailsContainer.classList.add('active');
    }
    else if (parsedInstructions.reason == "PARANOIA_DRINK_WHEEL") {
      drinkWheelContainer.classList.add('active');
    }
    else if (parsedInstructions.reason == "PARANOIA_TAKE_A_SHOT") {
      completePunishmentContainer.classList.add('active');
    }
  }
  else {
    waitingForPlayerTitle.textContent = "Waiting for " + parsedInstructions.username;
    if (parsedInstructions.reason == "PARANOIA_COIN_FLIP") {
      waitingForPlayerContainer.classList.add('active');
      waitingForPlayerText.textContent = "Calling coin flip...";
    }
    else if (parsedInstructions.reason == "PARANOIA_DRINK_WHEEL") {
      waitingForPlayerContainer.classList.add('active');
      waitingForPlayerText.textContent = "Spinning drink wheel...";
    }
    else if (parsedInstructions.reason == "PARANOIA_TAKE_A_SHOT") {
      waitingForPlayerContainer.classList.add('active');
      waitingForPlayerText.textContent = "Reading punishment...";
    }
  }
}
function UserSelectedForPunishment(instruction) {
  let parsedInstructions = parseInstructionWithDeviceID(instruction);
  if (parsedInstructions.deviceId == deviceId) {
    selectPunishmentContainer.classList.add('active');
    waitingForPlayerContainer.classList.remove('active');
  }
  else {
    waitingForPlayerContainer.classList.add('active');
    waitingForPlayerTitle.textContent = "Waiting for " + GetUsername(parsedInstructions.deviceId);
    waitingForPlayerText.textContent = "Choosing Punishment...";
  }
}

function DisplayPublicCard() {
  confirmPunishmentContainer.classList.remove('active');
  playerHasPassedContainer.classList.remove('active');
  nextQuestionContainer.classList.remove('active');

  gameContainerPublic.classList.add('active');
}

function parseInstruction(input) {
  const [instruction, reason, username] = input.split(":");
  return {
    instruction,
    reason,
    username
  };
}

function parseInstructionWithDeviceID(input) {
  const [instruction, deviceId, username] = input.split(":");
  return {
    instruction,
    deviceId,
    username
  };
}

function parseInstructionWithReasonAndDeviceID(input) {
  const [instruction, reason, deviceId] = input.split(":");
  return {
    instruction,
    reason,
    deviceId
  };
}

async function SendInstruction(string, includeUsername = false, currentPlayerTurn = null, questionIndex = null) {
  let instruction = "";
  const existingData = await getExistingPartyData(partyCode);
  if (!existingData || existingData.length === 0) {
    console.warn('No party data found.');
    return;
  }
  const currentPartyData = existingData[0];
  const index = currentPartyData.computerIds.indexOf(deviceId);
  currentPartyData.usersLastPing[index] = Date.now();
  if (includeUsername) {
    instruction = string + ":" + currentPartyData.usernames[currentPartyData.playerTurn];
  }
  else {
    instruction = string;
  }
  console.log("🧪 Instruction Received:", instruction);
  if (questionIndex == null && currentPlayerTurn == null) {
    await updateOnlineParty({
      partyId: partyCode,
      userInstructions: instruction,
      lastPinged: Date.now(),
      usersLastPing: currentPartyData.usersLastPing,
    });
  }
  else if (questionIndex == null) {
    await updateOnlineParty({
      partyId: partyCode,
      userInstructions: instruction,
      lastPinged: Date.now(),
      usersLastPing: currentPartyData.usersLastPing,
      playerTurn: currentPlayerTurn,
    });
  }
  else {
    await updateOnlineParty({
      partyId: partyCode,
      userInstructions: instruction,
      lastPinged: Date.now(),
      usersLastPing: currentPartyData.usersLastPing,
      playerTurn: currentPlayerTurn,
      currentCardIndex: questionIndex
    });
  }
}

async function GetUsername(computerId) {
  const existingData = await getExistingPartyData(partyCode);
  if (!existingData || existingData.length === 0) {
    console.warn('No party data found.');
    return;
  }
  const currentPartyData = existingData[0];

  const index = currentPartyData.computerIds.indexOf(computerId);
  return currentPartyData.usernames[index];
}

async function GetUserID(username) {
  const existingData = await getExistingPartyData(partyCode);
  if (!existingData || existingData.length === 0) {
    console.warn('No party data found.');
    return;
  }
  const currentPartyData = existingData[0];

  const index = currentPartyData.usernames.indexOf(username);
  return currentPartyData.computerIds[index];
}

async function GetSelectedPlayerTurnID() {
  const existingData = await getExistingPartyData(partyCode);
  if (!existingData || existingData.length === 0) {
    console.warn('No party data found.');
    return;
  }
  const currentPartyData = existingData[0];
  return currentPartyData.computerIds[currentPartyData.playerTurn];
}
