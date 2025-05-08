function NextUserTurn() {
  const selectedQuestionObj = getNextQuestion();
  updateTextContainer(selectedQuestionObj.question, selectedQuestionObj.cardType);


  playerHasPassedContainer.classList.remove('active');
  

  if (GetSelectedPlayerTurnID() == deviceId) {
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
  playerHasPassedContainer.classList.add('active');
  playerHasPassedTitle.textContent = parsedInstructions.username + " has passed";
  if(parsedInstructions.reason == "USER_CALLED_WRONG_FACE"){
    playerHasPassedText.textContent = "unsuccessful coin flip";
  }
}

async function WaitingForPlayer(instruction) {
  let parsedInstructions = parseInstruction(instruction)
  waitingForPlayerTitle.textContent = "Waiting for " + parsedInstructions.username;
  if(parsedInstructions.reason == "CHOOSE_PLAYER"){
    waitingForPlayerText.textContent = "Choosing Player...";
    if (await GetSelectedPlayerTurnID() === deviceId) {
      gameContainerPrivate.classList.remove('active');
      selectUserContainer.classList.add('active');
    }
    else{
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
  if(parsedInstructions.deviceId == deviceId){
    waitingForPlayerContainer.classList.remove('active');
    selectPunishmentContainer.classList.add('active');
  }
  else{
    selectUserContainer.classList.remove('active');
    waitingForPlayerContainer.classList.add('active');
  }
}
function ChosePunishment(instruction) {
  let parsedInstructions = parseInstruction(instruction)
  waitingForPlayerContainer.classList.add('active');
  waitingForPlayerTitle.textContent = "Waiting for " + parsedInstructions.username;
  if(parsedInstructions.reason == "PARANOIA_COIN_FLIP"){
    waitingForPlayerText.textContent = "Flipping coin...";
  }
  else if(parsedInstructions.reason == "PARANOIA_DRINK_WHEEL"){
    waitingForPlayerText.textContent = "Spinning drink wheel...";
  }
  else if(parsedInstructions.reason == "PARANOIA_TAKE_A_SHOT"){
    waitingForPlayerText.textContent = "Reading punishment...";
  }
}
function UserSelectedForPunishment(instruction) {
  let parsedInstructions = parseInstructionWithDeviceID(instruction);
  if (parsedInstructions.deviceId == deviceId) {
    selectPunishmentContainer.classList.add('active');
    waitingForPlayerContainer.classList.remove('active');
  }
  else{
    waitingForPlayerContainer.classList.add('active');
    waitingForPlayerTitle.textContent = "Waiting for " + GetUsername(parsedInstructions.deviceId);
    waitingForPlayerText.textContent = "Choosing Punishment...";
  }
}

function DisplayPublicCard(){
  gameContainerPublic.classList.add('active');
  confirmPunishmentContainer.classList.remove('active');
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

async function SendInstruction(string, includeUsername = false){
  let instruction = "";
  const existingData = await getExistingPartyData(partyCode);
  if (!existingData || existingData.length === 0) {
    console.warn('No party data found.');
    return;
  }
  const currentPartyData = existingData[0];
  if(includeUsername){
    instruction = string + ":" + currentPartyData.usernames[currentPartyData.playerTurn];
  }
  else{
    instruction = string;
  }


  updateOnlineParty({
    partyId: partyCode,
    userInstructions: instruction,
    lastPinged: Date.now(),
  });
}

async function GetUsername(computerId){
  const existingData = await getExistingPartyData(partyCode);
  if (!existingData || existingData.length === 0) {
    console.warn('No party data found.');
    return;
  }
  const currentPartyData = existingData[0];

  const index = currentPartyData.computerIds.indexOf(computerId);
  return currentPartyData.usernames[index];
}

async function GetUserID(username){
  const existingData = await getExistingPartyData(partyCode);
  if (!existingData || existingData.length === 0) {
    console.warn('No party data found.');
    return;
  }
  const currentPartyData = existingData[0];

  const index = currentPartyData.usernames.indexOf(username);
  return currentPartyData.computerIds[index];
}

async function GetSelectedPlayerTurnID(){
  const existingData = await getExistingPartyData(partyCode);
  if (!existingData || existingData.length === 0) {
    console.warn('No party data found.');
    return;
  }
  const currentPartyData = existingData[0];
  return currentPartyData.computerIds[currentPartyData.playerTurn];
}
