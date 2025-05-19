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

function parseInstructionWithTwoReasonsAndDeviceID(input) {
  const [instruction, reason, secondReason, deviceId] = input.split(":");
  return {
    instruction,
    reason,
    secondReason,
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

async function SetUserConfirmation(selectedDeviceId, bool, type = null, AnswerToUserDonePunishment = false) {
  const existingData = await getExistingPartyData(partyCode);
  if (!existingData || existingData.length === 0) {
    console.warn('No party data found.');
    return;
  }
  const currentPartyData = existingData[0];
  const index = currentPartyData.computerIds.indexOf(selectedDeviceId);
  currentPartyData.usersReady[index] = true
  currentPartyData.usersConfirmation[index] = bool;
  if (AnswerToUserDonePunishment) {
    await updateOnlineParty({
      partyId: partyCode,
      usersReady: currentPartyData.usersReady,
      usersConfirmation: currentPartyData.usersConfirmation,
      lastPinged: Date.now(),
      usersLastPing: currentPartyData.usersLastPing,
      userInstructions: "ANSWER_TO_USER_DONE_PUNISHMENT:" + type + ":" +selectedDeviceId
    });
  }
  else {
    await updateOnlineParty({
      partyId: partyCode,
      usersReady: currentPartyData.usersReady,
      usersConfirmation: currentPartyData.usersConfirmation,
      lastPinged: Date.now(),
      usersLastPing: currentPartyData.usersLastPing,
    });
  }
}