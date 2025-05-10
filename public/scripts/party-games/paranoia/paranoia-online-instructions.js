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
  nextQuestionContainer.classList.remove('active');

  if (await GetSelectedPlayerTurnID() == deviceId) {
    waitingForPlayerContainer.classList.remove('active');
    gameContainerPrivate.classList.add('active');
  }
  else {
    waitingForPlayerTitle.textContent = "Waiting for " + currentPartyData.usernames[currentPartyData.playerTurn]
    waitingForPlayerText.textContent = "Reading Card...";
    waitingForPlayerContainer.classList.add('active');
  }
  const icons = nextQuestionSectionContainer.querySelectorAll('.icon');

  let currentUsersReady = 0
  for (let i = 0; i < icons.length; i++) {
    if (currentPartyData.usersReady[i] == true) {
      icons[i].classList.remove('yes');
      currentPartyData.usersReady[i] = false;
      currentUsersReady++
    }
  }
  if (currentUsersReady > 0) {
    await updateOnlineParty({
      partyId: partyCode,
      usersReady: currentPartyData.usersReady,
      lastPinged: Date.now(),
      usersLastPing: currentPartyData.usersLastPing,
    });
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
  const icons = nextQuestionSectionContainer.querySelectorAll('.icon');
  if (currentPartyData.usersReady[index] == false) {
    if (!gameContainerPublic.classList.contains('active')) {
      currentPartyData.usersReady[index] = true;
    }
    nextQuestionContainer.classList.add('active');
    let totalUsersReady = 0;
    for (let i = 0; i < icons.length; i++) {
      if (currentPartyData.usersReady[i] == true) {
        totalUsersReady++;
      }
    }

    currentPartyData.usersLastPing[index] = Date.now();

    if (totalUsersReady == currentPartyData.computerIds.length) {
      for (let i = 0; i < currentPartyData.usersReady.length; i++) {
        currentPartyData.usersReady[i] = false;
      }
      if (deviceId == currentPartyData.computerIds[0]) {
        currentPartyData.currentCardIndex++;
      }
      console.log(currentPartyData.currentCardIndex);
      await updateOnlineParty({
        partyId: partyCode,
        usersReady: currentPartyData.usersReady,
        userInstructions: "NEXT_USER_TURN",
        lastPinged: Date.now(),
        usersLastPing: currentPartyData.usersLastPing,
        currentCardIndex: currentPartyData.currentCardIndex,
      });
    }
    else if (!gameContainerPublic.classList.contains('active')) {
      await updateOnlineParty({
        partyId: partyCode,
        usersReady: currentPartyData.usersReady,
        lastPinged: Date.now(),
        usersLastPing: currentPartyData.usersLastPing,
      });
    }
    for (let i = 0; i < icons.length; i++) {
      if (currentPartyData.usersReady[i] == true) {
        icons[i].classList.add('yes');
      }
    }
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

function DisplayPunishmentToUser(instruction) {
  selectUserContainer.classList.remove('active');
  let parsedInstructions = parseInstructionWithDeviceID(instruction)
  waitingForPlayerText.textContent = "Showing player punishment...";
  if (parsedInstructions.deviceId == deviceId) {
    completePunishmentContainer.classList.add('active');
  }
  else {
    waitingForPlayerContainer.classList.add('active');
  }
}

async function PunishmentOffer(instruction) {
  let parsedInstructions = parseInstructionWithReasonAndDeviceID(instruction)
  const existingData = await getExistingPartyData(partyCode);
  if (!existingData || existingData.length === 0) {
    console.warn('No party data found.');
    return;
  }
  const currentPartyData = existingData[0];

  if (parsedInstructions.reason == "PASS") {
    if (parsedInstructions.deviceId == deviceId) {
      SendInstruction("USER_HAS_PASSED:USER_PASSED_PUNISHMENT:" + parsedInstructions.deviceId, true);
    }
  }
  else if (parsedInstructions.reason == "CONFIRM") {
    if (deviceId == parsedInstructions.deviceId) {
      for (let i = 0; i < currentPartyData.usersReady.length; i++) {
        currentPartyData.usersReady[i] = false;
      }
      const index = currentPartyData.computerIds.indexOf(parsedInstructions.deviceId);
      const icons = waitingForConfirmPunishmentIconContainer.querySelectorAll('.icon');
      icons[index].classList.add('yes');
      currentPartyData.usersReady[index] = true;
      SendInstruction("HAS_USER_DONE_PUNISHMENT:" + deviceId, false, null, null, currentPartyData.usersReady);
    }
  }
}

async function UserHasPassed(instruction) {
  let parsedInstructions = parseInstructionWithReason_DeviceIdAndUserName(instruction)

  const existingData = await getExistingPartyData(partyCode);
  if (!existingData || existingData.length === 0) {
    console.warn('No party data found.');
    return;
  }
  const currentPartyData = existingData[0];

  playerHasPassedContainer.classList.add('active');
  waitingForPlayerContainer.classList.remove('active');
  playerHasPassedTitle.textContent = parsedInstructions.username + " has passed";
  if (parsedInstructions.reason == "USER_CALLED_WRONG_FACE") {
    playerHasPassedText.textContent = "unsuccessful coin flip";
  }
  else if (parsedInstructions.reason == "USER_PASSED_PUNISHMENT") {
    playerHasPassedText.textContent = "punishment has been forfeited";
  }
  else if (parsedInstructions.reason == "USER_DIDNT_DO_PUNISHMENT") {
    playerHasPassedText.textContent = "punishment not complete";
  }

  await new Promise(resolve => setTimeout(resolve, 1000));

  if (deviceId == parsedInstructions.deviceId) {
    instruction = "DISPLAY_PUBLIC_CARD";
    currentPartyData.currentCardIndex++;
    currentPartyData.playerTurn++;
    if (currentPartyData.playerTurn >= currentPartyData.computerIds.length) {
      currentPartyData.playerTurn = 0;
    }
    SendInstruction(instruction, true, currentPartyData.playerTurn, currentPartyData.currentCardIndex);
  }
}

async function HasUserDonePunishment(instruction) {
  let parsedInstructions = parseInstructionWithDeviceID(instruction)
  const existingData = await getExistingPartyData(partyCode);
  if (!existingData || existingData.length === 0) {
    console.warn('No party data found.');
    return;
  }
  const currentPartyData = existingData[0];

  const index = currentPartyData.computerIds.indexOf(parsedInstructions.deviceId);
  if (parsedInstructions.deviceId != deviceId && !confirmPunishmentContainer.classList.contains('active')) {
    waitingForConfirmPunishmentContainer.classList.remove('active');
    confirmPunishmentContainer.classList.add('active');
    console.log("device not match");
  }
  else if (!waitingForConfirmPunishmentContainer.classList.contains('active')) {
    waitingForConfirmPunishmentContainer.classList.add('active');
    currentPartyData.usersReady[index] = true;
    currentPartyData.usersLastPing[index] = Date.now();
    waitingForPlayerContainer.classList.remove('active');
    confirmPunishmentContainer.classList.remove('active');
    console.log("device match");
    await updateOnlineParty({
      partyId: partyCode,
      lastPinged: Date.now(),
      usersLastPing: currentPartyData.usersLastPing,
      usersReady: currentPartyData.usersReady,
    });
  }
  console.log("parsedInstructions.deviceId: " + parsedInstructions.deviceId);
  console.log("deviceId: " + deviceId);
}
async function ChosePunishment(instruction) {
  let parsedInstructions = parseInstructionWithReasonAndDeviceID(instruction)
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

async function AnswerToUserDonePunishment(instruction) {
  let parsedInstructions = parseInstructionWithDeviceID(instruction);
  const existingData = await getExistingPartyData(partyCode);
  if (!existingData || existingData.length === 0) {
    console.warn('No party data found.');
    return;
  }
  const currentPartyData = existingData[0];

  const index = currentPartyData.computerIds.indexOf(deviceId);
  const icons = waitingForConfirmPunishmentIconContainer.querySelectorAll('.icon');
  if (currentPartyData.usersReady[index] == false) {
    if (parsedInstructions.reason == "YES") {
      icons[index].classList.add('yes');
    }
    else if (parsedInstructions.reason == "NO") {
      icons[index].classList.add('no');
    }
    currentPartyData.usersReady[index] = true;
    currentPartyData.usersLastPing[index] = Date.now();

    let totalUsersReady = 0;
    for (let i = 0; i < icons.length; i++) {
      if (currentPartyData.usersReady[i] == true) {
        totalUsersReady++;
      }
    }
    if (totalUsersReady == currentPartyData.usersReady.length) {
      const yesIconsCount = Array.from(icons).filter(icon => icon.textContent.trim().toLowerCase().includes("yes")).length;
      const noIconsCount = Array.from(icons).filter(icon => icon.textContent.trim().toLowerCase().includes("no")).length;

      if (yesIconsCount >= noIconsCount) {
        instruction = "DISPLAY_PUBLIC_CARD";
        currentPartyData.currentCardIndex++;
        currentPartyData.playerTurn++;
        if (currentPartyData.playerTurn >= currentPartyData.computerIds.length) {
          currentPartyData.playerTurn = 0;
        }
        SendInstruction(instruction, true, currentPartyData.playerTurn, currentPartyData.currentCardIndex);
      }
      else {
        SendInstruction("USER_HAS_PASSED:USER_DIDNT_DO_PUNISHMENT:" + parsedInstructions.deviceId, true);
      }
    }
    for (let i = 0; i < icons.length; i++) {
      currentPartyData.usersReady[i] = false;
      icons[i].classList.remove('yes');
      icons[i].classList.remove('no');
      }
    await updateOnlineParty({
      partyId: partyCode,
      userInstructions: instruction,
      lastPinged: Date.now(),
      usersLastPing: currentPartyData.usersLastPing,
      usersReady: currentPartyData.usersReady,
    });
  }
}

function DisplayPublicCard() {
  confirmPunishmentContainer.classList.remove('active');
  playerHasPassedContainer.classList.remove('active');
  nextQuestionContainer.classList.remove('active');
  waitingForPlayerContainer.classList.remove('active');

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

function parseInstructionWithReason_DeviceIdAndUserName(input) {
  const [instruction, reason, deviceId, username] = input.split(":");
  return {
    instruction,
    reason,
    deviceId,
    username
  };
}

async function SendInstruction(string, includeUsername = false, currentPlayerTurn = null, questionIndex = null, updateUsersReady = null) {
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
  if (questionIndex == null && currentPlayerTurn == null && currentPlayerTurn != null) {
    await updateOnlineParty({
      partyId: partyCode,
      userInstructions: instruction,
      lastPinged: Date.now(),
      usersLastPing: currentPartyData.usersLastPing,
      usersReady: updateUsersReady,
    });
  }
  else if (questionIndex == null && currentPlayerTurn == null) {
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
