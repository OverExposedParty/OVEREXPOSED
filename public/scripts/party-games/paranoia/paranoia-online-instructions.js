async function setPageforUser() {
  const response = await fetch(`/api/party-games?partyCode=${partyCode}`);
  const data = await response.json();

  const existingData = await getExistingPartyData(partyCode);
  if (!existingData || existingData.length === 0) {
    console.warn('No party data found.');
    return;
  }
  const currentPartyData = existingData[0];

  waitingForPlayerTitle.textContent = "Waiting for " + currentPartyData.usernames[currentPartyData.playerTurn]
  waitingForPlayerText.textContent = "Reading Card...";

  if (data[0].computerIds[data[0].playerTurn] == deviceId) {
    setActiveContainers(gameContainerPrivate);
  }
  else {
    setActiveContainers(waitingForPlayerContainer);
  }
}

async function NextUserTurn() {
  const existingData = await getExistingPartyData(partyCode);
  if (!existingData || existingData.length === 0) {
    console.warn('No party data found.');
    return;
  }
  const currentPartyData = existingData[0];

  const selectedQuestionObj = getNextQuestion(currentPartyData.currentCardIndex);
  updateTextContainer(selectedQuestionObj.question, selectedQuestionObj.cardType);
  //console.log("GetSelectedPlayerTurnID: " + GetSelectedPlayerTurnID());
  if (await GetSelectedPlayerTurnID() == deviceId) {
    setActiveContainers(gameContainerPrivate);
  }
  else {
    waitingForPlayerTitle.textContent = "Waiting for " + currentPartyData.usernames[currentPartyData.playerTurn]
    waitingForPlayerText.textContent = "Reading Card...";
    setActiveContainers(waitingForPlayerContainer);
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
  if (currentPartyData.usersReady[index] == true) {
    setActiveContainers(nextQuestionContainer);
    let totalUsersReady = 0;
    for (let i = 0; i < icons.length; i++) {
      if (currentPartyData.usersReady[i] == true) {
        totalUsersReady++;
      }
    }
    console.log("totalUsersReady: " + totalUsersReady);

    currentPartyData.usersLastPing[index] = Date.now();

    if (totalUsersReady == currentPartyData.computerIds.length) {
      for (let i = 0; i < currentPartyData.usersReady.length; i++) {
        currentPartyData.usersReady[i] = false;
      }
      if (deviceId == currentPartyData.computerIds[0]) {
        currentPartyData.currentCardIndex++;
        currentPartyData.playerTurn++;
        if (currentPartyData.playerTurn >= currentPartyData.computerIds.length) {
          currentPartyData.playerTurn = 0;
        }
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

async function ChoosingPunishment(instruction) {
  let parsedInstructions = parseInstructionWithDeviceID(instruction)
  const existingData = await getExistingPartyData(partyCode);
  if (!existingData || existingData.length === 0) {
    console.warn('No party data found.');
    return;
  }
  const currentPartyData = existingData[0];
  const index = currentPartyData.computerIds.indexOf(parsedInstructions.deviceId);

  waitingForPlayerTitle.textContent = "Waiting for " + currentPartyData.usernames[index];
  waitingForPlayerText.textContent = "Choosing Punishment...";
  if (parsedInstructions.deviceId == deviceId) {
    setActiveContainers(selectPunishmentContainer);
  }
  else {
    setActiveContainers(waitingForPlayerContainer);
  }
}

function DisplayPunishmentToUser(instruction) {
  let parsedInstructions = parseInstructionWithDeviceID(instruction)
  waitingForPlayerText.textContent = "Showing player punishment...";
  if (parsedInstructions.deviceId == deviceId) {
    setActiveContainers(completePunishmentContainer);
  }
  else {
    setActiveContainers(waitingForPlayerContainer);
  }
}


//add container 
async function PunishmentOffer(instruction) {
  let parsedInstructions = parseInstructionWithTwoReasonsAndDeviceID(instruction)
  const existingData = await getExistingPartyData(partyCode);
  if (!existingData || existingData.length === 0) {
    console.warn('No party data found.');
    return;
  }
  const currentPartyData = existingData[0];

  if (parsedInstructions.reason == "PASS") {
    if (parsedInstructions.deviceId == deviceId) {
      SendInstruction("USER_HAS_PASSED:USER_PASSED_PUNISHMENT:" + deviceId, true);
    }
  }
  else if (parsedInstructions.reason == "CONFIRM") {
    if (deviceId == parsedInstructions.deviceId) {
      for (let i = 0; i < currentPartyData.usersReady.length; i++) {
        currentPartyData.usersReady[i] = false;
      }
      const index = currentPartyData.computerIds.indexOf(deviceId);
      const icons = waitingForConfirmPunishmentIconContainer.querySelectorAll('.icon');
      icons[index].classList.add('yes');
      currentPartyData.usersReady[index] = true;
      currentPartyData.usersConfirmation[index] = true;
      SendInstruction("HAS_USER_DONE_PUNISHMENT:" + parsedInstructions.secondReason + ":" + deviceId, false, null, null, currentPartyData.usersReady);
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

  setActiveContainers(playerHasPassedContainer);

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
    instruction = "NEXT_USER_TURN";
    currentPartyData.currentCardIndex++;
    currentPartyData.playerTurn++;
    if (currentPartyData.playerTurn >= currentPartyData.computerIds.length) {
      currentPartyData.playerTurn = 0;
    }
    SendInstruction(instruction, false, currentPartyData.playerTurn, currentPartyData.currentCardIndex);
  }
}

async function HasUserDonePunishment(instruction) {
  let parsedInstructions = parseInstructionWithReasonAndDeviceID(instruction)
  const existingData = await getExistingPartyData(partyCode);
  if (!existingData || existingData.length === 0) {
    console.warn('No party data found.');
    return;
  }
  const currentPartyData = existingData[0];

  const index = currentPartyData.computerIds.indexOf(parsedInstructions.deviceId);

  if (parsedInstructions.deviceId != deviceId) {
    if (!confirmPunishmentContainer.classList.contains('active')) {
      if (parsedInstructions.reason == "TAKE_A_SHOT") {
        confirmPunishmentText.textContent = "Has " + currentPartyData.usernames[index] + " taken their shot";
      }
      else if (parsedInstructions.reason == "DOWN_DRINK") {
        confirmPunishmentText.textContent = "Has " + currentPartyData.usernames[index] + " downed their drink";
      }
      else if (parsedInstructions.reason.includes("SIP")) {
        confirmPunishmentText.textContent = "Has " + currentPartyData.usernames[index] + " taken " + parsedInstructions.reason.replace("_", " "); + ".";
      }
      setActiveContainers(confirmPunishmentContainer);
    }
  }
  else if (!waitingForConfirmPunishmentContainer.classList.contains('active')) {
    setActiveContainers(waitingForConfirmPunishmentContainer);
    currentPartyData.usersReady[index] = true;
    currentPartyData.usersConfirmation[index] = true;
    currentPartyData.usersLastPing[index] = Date.now();

    await updateOnlineParty({
      partyId: partyCode,
      lastPinged: Date.now(),
      usersLastPing: currentPartyData.usersLastPing,
      usersReady: currentPartyData.usersReady,
      usersConfirmation: currentPartyData.usersConfirmation,
    });
  }
}

async function ChosePunishment(instruction) {
  let parsedInstructions = parseInstructionWithReason_DeviceIdAndUserName(instruction)
  const existingData = await getExistingPartyData(partyCode);
  if (!existingData || existingData.length === 0) {
    console.warn('No party data found.');
    return;
  }
  const currentPartyData = existingData[0];

  const index = currentPartyData.computerIds.indexOf(parsedInstructions.deviceId);
  if (deviceId == parsedInstructions.deviceId) {
    if (parsedInstructions.reason == "PARANOIA_COIN_FLIP") {
      setActiveContainers(pickHeadsOrTailsContainer);
    }
    else if (parsedInstructions.reason == "PARANOIA_DRINK_WHEEL") {
      setActiveContainers(drinkWheelContainer);
    }
    else if (parsedInstructions.reason == "PARANOIA_TAKE_A_SHOT") {
      punishmentText.textContent = "In order to find out the question you have to take a shot.";
      setActiveContainers(completePunishmentContainer);
    }
  }
  else {
    waitingForPlayerTitle.textContent = "Waiting for " + currentPartyData.usernames[index];;
    if (parsedInstructions.reason == "PARANOIA_COIN_FLIP") {
      waitingForPlayerText.textContent = "Calling coin flip...";
    }
    else if (parsedInstructions.reason == "PARANOIA_DRINK_WHEEL") {
      waitingForPlayerText.textContent = "Spinning drink wheel...";
    }
    else if (parsedInstructions.reason == "PARANOIA_TAKE_A_SHOT") {
      waitingForPlayerText.textContent = "Reading punishment...";
    }
    setActiveContainers(waitingForPlayerContainer);
  }
}
function UserSelectedForPunishment(instruction) {
  let parsedInstructions = parseInstructionWithDeviceID(instruction);
  if (parsedInstructions.deviceId == deviceId) {
    setActiveContainers(selectPunishmentContainer);
  }
  else {
    waitingForPlayerTitle.textContent = "Waiting for " + GetUsername(parsedInstructions.deviceId);
    waitingForPlayerText.textContent = "Choosing Punishment...";
    setActiveContainers(waitingForPlayerContainer);
  }
}

//add container
async function AnswerToUserDonePunishment(instruction) {
  let parsedInstructions = parseInstructionWithReason_DeviceIdAndUserName(instruction);
  const existingData = await getExistingPartyData(partyCode);
  if (!existingData || existingData.length === 0) {
    console.warn('No party data found.');
    return;
  }
  const currentPartyData = existingData[0];
  const icons = waitingForConfirmPunishmentIconContainer.querySelectorAll('.icon');

  const index = currentPartyData.computerIds.indexOf(deviceId);

  if (currentPartyData.usersReady[index] == true) {
    setActiveContainers(waitingForConfirmPunishmentContainer);
    for (let i = 0; i < currentPartyData.usersConfirmation.length; i++) {
      if (currentPartyData.usersReady[i] == true) {
        if (currentPartyData.usersConfirmation[i] == true) {
          icons[i].classList.add('yes');
        }
        else {
          icons[i].classList.add('no');
        }
      }
    }
    currentPartyData.usersLastPing[index] = Date.now();

    let totalUsersConfirmation = currentPartyData.usersReady.filter(confirmation => confirmation).length;
    if (totalUsersConfirmation == currentPartyData.usersReady.length) {
      const yesIconsCount = Array.from(icons).filter(icon => icon.classList.contains("yes")).length;
      const noIconsCount = Array.from(icons).filter(icon => icon.classList.contains("no")).length;

      console.log("yesIconsCount: " + yesIconsCount);
      console.log("noIconsCount: " + noIconsCount);
      if (noIconsCount < yesIconsCount) {
        currentPartyData.currentCardIndex++;
        if (parsedInstructions.reason == "QUESTION") {
          instruction = "NEXT_USER_TURN";
          SendInstruction(instruction, false);
        }
        else if (parsedInstructions.reason == "PUNISHMENT") {
          if (deviceId == currentPartyData.computerIds[0]) {
            instruction = "DISPLAY_PUBLIC_CARD";
            currentPartyData.currentCardIndex++;
            currentPartyData.playerTurn++;

            if (currentPartyData.playerTurn >= currentPartyData.computerIds.length) {
              currentPartyData.playerTurn = 0;
            }
            SendInstruction(instruction, true, currentPartyData.playerTurn, currentPartyData.currentCardIndex);
          }
        }
      }
      else {
        SendInstruction("USER_HAS_PASSED:USER_DIDNT_DO_PUNISHMENT:" + parsedInstructions.deviceId, true);
      }
      for (let i = 0; i < icons.length; i++) {
        currentPartyData.usersReady[i] = false;
        currentPartyData.usersConfirmation[i] = false;
        icons[i].classList.remove('yes');
        icons[i].classList.remove('no');
      }
    }
  }
}

async function DisplayPublicCard() {
  const existingData = await getExistingPartyData(partyCode);
  if (!existingData || existingData.length === 0) {
    console.warn('No party data found.');
    return;
  }
  const currentPartyData = existingData[0];
  const icons = waitingForConfirmPunishmentIconContainer.querySelectorAll('.icon');

  setActiveContainers(gameContainerPublic);
  for (let i = 0; i < icons.length; i++) {
    currentPartyData.usersReady[i] = false;
    currentPartyData.usersConfirmation[i] = false;
    icons[i].classList.remove('yes');
    icons[i].classList.remove('no');
  }
  await updateOnlineParty({
    partyId: partyCode,
    usersReady: currentPartyData.usersReady,
    usersConfirmation: currentPartyData.usersConfirmation,
    lastPinged: Date.now(),
    usersLastPing: currentPartyData.usersLastPing,
    userInstructions: "NEXT_QUESTION"
  });
}