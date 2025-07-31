async function SendInstruction({
  instruction = null,
  updateUsersReady = null,
  updateUsersConfirmation = null,
  partyData = null,
  fetchInstruction = false
}) {
  let currentPartyData = partyData;

  if (partyData == null) {
    const existingData = await getExistingPartyData(partyCode);
    if (!existingData || existingData.length === 0) {
      console.warn('No party data found.');
      return;
    }
    currentPartyData = existingData[0];
  }
  const index = currentPartyData.players.findIndex(player => player.computerId === deviceId);

  if (index === -1) {
    console.warn('Device ID not found in players.');
    return;
  }

  // Update this player's lastPinged timestamp
  currentPartyData.players[index].lastPinged = Date.now();

  // Update all players' usersReady if requested
  if (updateUsersReady !== null) {
    currentPartyData.players.forEach(player => {
      player.isReady = updateUsersReady;
    });
  }

  // Update all players' usersConfirmation if requested
  if (updateUsersConfirmation !== null) {
    currentPartyData.players.forEach(player => {
      player.hasConfirmed = updateUsersConfirmation;
    });
  }

  // Use existing userInstructions if instruction param is null
  if (instruction == null) {
    instruction = currentPartyData.userInstructions;
  }

  console.log("🧪 Instruction Received:", instruction);

  await updateOnlineParty({
    partyId: partyCode,
    players: currentPartyData.players,
    userInstructions: instruction,
    lastPinged: Date.now(),
    playerTurn: currentPartyData.playerTurn,
    currentCardIndex: currentPartyData.currentCardIndex,
    timer: currentPartyData.timer,
  });
  if (fetchInstruction) {
    FetchInstructions();
  }
}

function parseInstructionDeviceId(input) {
  const [instruction, deviceId] = input.split(":");
  return {
    instruction,
    deviceId
  };
}

function parseInstruction(input) {
  const [instruction, reason, deviceId] = input.split(":");
  return {
    instruction,
    reason,
    deviceId
  };
}

function parseInstructionSecondReason(input) {
  const [instruction, reason, secondReason, deviceId] = input.split(":");
  return {
    instruction,
    reason,
    secondReason,
    deviceId
  };
}


async function GetUsername(selectedDeviceId) {
  const existingData = await getExistingPartyData(partyCode);
  if (!existingData || existingData.length === 0) {
    console.warn('No party data found.');
    return;
  }
  const currentPartyData = existingData[0];

  const player = currentPartyData.players.find(p => p.computerId === selectedDeviceId);
  return player ? player.username : undefined;
}

async function SetUserConfirmation({
  selectedDeviceId,
  option,
  reason = null,
  userInstruction = null
}) {
  const existingData = await getExistingPartyData(partyCode);
  if (!existingData || existingData.length === 0) {
    console.warn('No party data found.');
    return;
  }

  const currentPartyData = existingData[0];
  const index = currentPartyData.players.findIndex(player => player.computerId === selectedDeviceId);

  if (index === -1) {
    console.warn('Player not found for device ID:', selectedDeviceId);
    return;
  }

  currentPartyData.players[index].isReady = true;
  currentPartyData.players[index].hasConfirmed = option;
  currentPartyData.players[index].lastPing = Date.now();

  if (userInstruction != null) {
    await SendInstruction({
      instruction: `${userInstruction}:${reason}`,
      partyData: currentPartyData
    });
  }
  else {
    await SendInstruction({
      partyData: currentPartyData
    });
  }
}


async function setUserBool(selectedDeviceId, userConfirmation = null, userReady = null, setInstruction = null) {
  const existingData = await getExistingPartyData(partyCode);
  if (!existingData || existingData.length === 0) {
    console.warn('No party data found.');
    return;
  }

  const currentPartyData = existingData[0];
  const player = currentPartyData.players.find(p => p.computerId === selectedDeviceId);

  if (!player) {
    console.warn('Player not found for device ID:', selectedDeviceId);
    return;
  }

  if (userConfirmation !== null) {
    player.hasConfirmed = userConfirmation;
  }

  if (userReady !== null) {
    player.isReady = userReady;
  }

  if (currentPartyData.userInstructions.includes(setInstruction) || setInstruction === null) {
    await updateOnlineParty({
      partyId: partyCode,
      players: currentPartyData.players,
      lastPinged: Date.now(),
    });
  }
}


function ClearIcons() {
  const icons = waitingForPlayersIconContainer.querySelectorAll('.icon');
  for (let i = 0; i < icons.length; i++) {
    icons[i].classList.remove('yes');
    icons[i].classList.remove('no');
  }
}

async function ResetQuestion(currentPartyData, icons) {
  let voteString = "";
  const playerCount = currentPartyData.players.length;

  for (let i = 0; i < playerCount; i++) {
    voteString += "0";
    if (i < playerCount - 1) {
      voteString += ";";
    }
  }

  const instruction = "DISPLAY_PUBLIC_CARD:" + voteString + ":";

  // Move to next card
  currentPartyData.currentCardIndex++;

  // Reset each player's status and icon
  for (let i = 0; i < playerCount; i++) {
    currentPartyData.players[i].isReady = false;
    currentPartyData.players[i].hasConfirmed = false;

    icons[i].classList.remove('yes');
    icons[i].classList.remove('no');
  }

  await updateOnlineParty({
    partyId: partyCode,
    players: currentPartyData.players,
    lastPinged: Date.now(),
    userInstructions: instruction,
    currentCardIndex: currentPartyData.currentCardIndex
  });
}


function countWords(str) {
  if (!str) return 0;
  return str.split(' ').filter(word => word.trim() !== '').length;
}

function createUserIcon(id) {
  const icon = document.createElement('div');
  icon.id = id;
  icon.classList.add('icon');
  icon.textContent = 'O';
  return icon;
}

function createUserButton(id, text) {
  const button = document.createElement("button");
  button.id = id;
  button.textContent = text;
  return button;
}

function parseGameSettings(settingsString) {
  if (!settingsString) return [];
  return settingsString.split(',').filter(Boolean);
}

function formatDashedString(input, gamemode) {
  const words = input.split('-').slice(countWords(gamemode));
  return words
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

async function GetCurrentPartyData() {
  const existingData = await getExistingPartyData(partyCode);
  if (!existingData || existingData.length === 0) {
    console.warn('No party data found.');
    return;
  }
  return existingData[0];
}

function ResetVotes(players) {
  for (let i = 0; i < players.length; i++) {
    if (players[i].status == "alive") {
      players[i].vote = null;
    }
    players[i].hasConfirmed = false;
    players[i].isReady = false;
  }
  return players;
}

async function SetVote({ option, sendInstruction = null, hover = false }) {
  const response = await fetch(`/api/${sessionPartyType}?partyCode=${partyCode}`);
  const data = await response.json();

  const index = data[0].players.findIndex(player => player.computerId === deviceId);
  data[0].players[index].vote = option;
  data[0].players[index].isReady = true;
  if(hover == false){
    data[0].players[index].hasConfirmed = true;
  }
  if (sendInstruction != null) {
    await SendInstruction({
      instruction: sendInstruction,
      partyData: data[0]
    });
  } else {
    await updateOnlineParty({
      partyId: partyCode,
      players: data[0].players,
      lastPinged: Date.now()
    });
  }
}


function ResetBoolVotes(players) {
  for (let i = 0; i < players.length; i++) {
    players[i].vote = null;
    players[i].hasConfirmed = false;
    players[i].isReady = false;
  }
  return players;
}

async function SetBoolVote(bool) {
  const response = await fetch(`/api/${sessionPartyType}?partyCode=${partyCode}`);
  const data = await response.json();

  const index = data[0].players.findIndex(player => player.computerId === deviceId);
  data[0].players[index].vote = bool;
  data[0].players[index].hasConfirmed = true;
  console.log("working");
  await updateOnlineParty({
    partyId: partyCode,
    players: data[0].players,
    lastPinged: Date.now()
  });
}