async function NextUserTurn() {
  const selectedQuestionObj = getNextQuestion();
  updateTextContainer(selectedQuestionObj.question, selectedQuestionObj.cardType);

  const existingData = await getExistingPartyData(partyCode);
  if (!existingData || existingData.length === 0) {
    console.warn('No party data found.');
    return;
  }
  if(playerHasPassedContainer.classList.contains('active')){
    playerHasPassedContainer.classList.remove('active');
  }
  const currentPartyData = existingData[0];

  if (currentPartyData.computerIds[currentPartyData.playerTurn] == deviceId) {
    gameContainerPrivate.classList.add('active');
  }
  else {
    waitingForPlayerTitle.textContent = "Waiting for " + currentPartyData.usernames[currentPartyData.playerTurn]
    waitingForPlayerText.textContent = "Reading Card...";
    waitingForPlayerContainer.classList.add('active');
  }
}

function UserHasPassed(instruction) {
  let parsedInstructions = parseInstruction(instruction)
  if(parsedInstructions.reason == "USER_CALLED_WRONG_FACE"){
    playerHasPassedContainer.classList.add('active');
    playerHasPassedTitle.textContent = parsedInstructions.username + " has passed"
    playerHasPassedText.textContent = "unsuccessful coin flip"
  }
}

function UserSelectedForPunishment(instruction) {
  let parsedInstructions = parseInstructionWithDeviceID(instruction);
  if (parsedInstructions.deviceId == deviceId) {
    selectPunishmentContainer.classList.add('active');
    waitingForPlayerContainer.classList.remove('active');
  }
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
  const [instruction, deviceId] = input.split(":");
  return {
    instruction,
    deviceId
  };
}