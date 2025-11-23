let partyRulesSettings;

const resultTimerDuration = 5000;

async function SendInstruction({
  instruction = null,
  updateUsersReady = null,
  updateUsersConfirmation = null,
  updateUsersVote = null,
  partyData = null,
  fetchInstruction = false,
  isPlaying = true,
  timer = null
}) {
  currentPartyData = partyData;

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
  if (currentPartyData.players[index].socketId === null) {
    currentPartyData.players[index].socketId = socket.id;
  }

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

  if (updateUsersVote !== null) {
    currentPartyData.players.forEach(player => {
      player.vote = updateUsersVote;
    });
  }

  if (timer !== null) {
    currentPartyData.timer = timer;
    if (timeout?.cancel) {
      timeout.cancel();
    }
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
    currentCardSecondIndex: currentPartyData.currentCardSecondIndex,
    score: currentPartyData.score,
    timer: currentPartyData.timer,
    questionType: currentPartyData.questionType,
    round: currentPartyData.round,
    roundPlayerTurn: currentPartyData.roundPlayerTurn,
    isPlaying: isPlaying,
    vote: currentPartyData.vote
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

async function SetUserConfirmation({
  selectedDeviceId,
  option,
  reason = null,
  userInstruction = null
}) {
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

async function ResetQuestion({ icons = null, instruction = "DISPLAY_PRIVATE_CARD", incrementScore = 0, timer = null, playerIndex = null }) {
  if (hostDeviceId !== deviceId) return;
  console.log(currentPartyData);
  const playerCount = currentPartyData.players.length;

  // Move to next card
  currentPartyData.currentCardIndex++;
  if (currentPartyData.playerTurn !== undefined) {
    currentPartyData.players[currentPartyData.playerTurn].score += incrementScore;
  }
  else if (playerIndex !== null) {
    currentPartyData.players[playerIndex].score += incrementScore;
  }
  // Reset each player's status and icon
  for (let i = 0; i < playerCount; i++) {
    currentPartyData.players[i].isReady = false;
    currentPartyData.players[i].hasConfirmed = false;
    currentPartyData.players[i].vote = null;
    if (icons !== null) {
      icons[i].classList.remove('yes');
      icons[i].classList.remove('no');
    }
  }

  if (timer !== null) {
    currentPartyData.timer = timer;
  }

  await updateOnlineParty({
    partyId: partyCode,
    players: currentPartyData.players,
    lastPinged: Date.now(),
    userInstructions: instruction,
    currentCardIndex: currentPartyData.currentCardIndex,
    timer: currentPartyData.timer
  });
}


function countWords(str) {
  if (!str) return 0;
  return str.split('-').filter(word => word.trim() !== '').length;
}

function createUserButton(id, text) {
  const button = document.createElement("button");
  button.id = id;
  button.textContent = text;
  return button;
}

function formatDashedString({ input, gamemode = null, seperator = ' ', uppercase = true }) {
  let words;

  if (gamemode === null) {
    words = input.split('-');
  } else {
    words = input.split('-').slice(countWords(gamemode));
  }

  return words
    .map(word => {
      if (!word) return '';
      return uppercase
        ? word.charAt(0).toUpperCase() + word.slice(1)
        : word.charAt(0).toLowerCase() + word.slice(1);
    })
    .join(seperator);
}

function ResetVotes(players, gamemodeMafia = false) {
  for (let i = 0; i < players.length; i++) {
    if (gamemodeMafia) {
      if (players[i].status == "alive") {
        players[i].vote = null;
      }
    }
    else {
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
  console.log(data[0].players);
  if (hover == false) {
    data[0].players[index].hasConfirmed = true;
  }
  if (sendInstruction != null) {
    await SendInstruction({
      instruction: sendInstruction,
      partyData: data[0]
    });
  }
  else {
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

function SetWaitingForPlayer({ waitingForRoomTitle, waitingForRoomText, player }) {
  waitingForPlayerTitle.textContent = waitingForRoomTitle;
  waitingForPlayerText.textContent = waitingForRoomText;
  EditUserIconPartyGames({
    container: waitingForPlayerContainer,
    userId: player.computerId,
    userCustomisationString: player.userIcon
  });
}

function DisplayCard(card, questionObject) {
  const cardText = card.querySelector('.text-container');
  const cardImage = card.querySelector('.main-image');
  const cardType = card.querySelector('.card-type-text');

  cardText.textContent = questionObject.question;

  const searchPackName = (questionObject.cardType).toLowerCase();
  // Find the matching pack based on the cardType
  const matchedPack = cardPackMap.find(pack => {
    const packNameLower = pack.packName.toLowerCase();
    return packNameLower === searchPackName;
  });
  if (matchedPack) {
    const imageUrl = matchedPack.packCard ? matchedPack.packCard : `/images/blank-cards/${gamemode}-blank-card.svg`;
    cardImage.src = imageUrl;
    cardText.style.color = matchedPack.packColour;
    card.querySelector('.card-type-text').style.color = matchedPack.packColour;
  } else {
    console.log("Pack not found");
  }
  cardType.textContent = questionObject.cardType;
}

async function ChoosingPunishment(index = null) {
  timeout?.cancel();
  stopTimer(waitingForPlayerContainer.querySelector('.timer-wrapper'));
  if (index === null) {
    index = currentPartyData.players.findIndex(player => player.computerId === currentPartyData.players[currentPartyData.playerTurn].vote);
  }
  currentPlayer = currentPartyData.players[index];

  if (currentPartyData.players[index].computerId == deviceId) {
    setActiveContainers(selectPunishmentContainer);
  }
  else {
    SetWaitingForPlayer({
      waitingForRoomTitle: "Waiting for " + currentPartyData.players[index].username,
      waitingForRoomText: "Choosing Punishment...",
      player: currentPlayer
    });
    setActiveContainers(waitingForPlayerContainer);
  }
}

async function ChosePunishment(index = null) {
  timeout?.cancel();
  stopTimer(waitingForPlayerContainer.querySelector('.timer-wrapper'));
  let parsedInstructions = parseInstruction(currentPartyData.userInstructions)
  if (index === null) {
    index = currentPartyData.players.findIndex(player => player.computerId === parsedInstructions.deviceId);
  }
  if (deviceId == currentPartyData.players[index].computerId) {
    if (parsedInstructions.reason == "DRINK_WHEEL") {
      setActiveContainers(drinkWheelContainer);
    }
    else if (parsedInstructions.reason == "TAKE_A_SHOT") {
      completePunishmentText.textContent = "Take a shot.";
      setActiveContainers(completePunishmentContainer);
    }
    else if (parsedInstructions.reason == "TAKE_A_SIP") {
      completePunishmentText.textContent = "Take a sip.";
      setActiveContainers(completePunishmentContainer);
    }
  }
  else {
    const currentTitle = "Waiting for " + currentPartyData.players[index].username;
    let currentText;
    if (parsedInstructions.reason == "DRINK_WHEEL") {
      currentText = "Spinning drink wheel...";
    }
    else if (parsedInstructions.reason == "TAKE_A_SHOT") {
      currentText = "Reading punishment...";
    }
    SetWaitingForPlayer({
      waitingForRoomTitle: currentTitle,
      waitingForRoomText: currentText,
      player: currentPartyData.players[index]
    });
    setActiveContainers(waitingForPlayerContainer);
  }
}

function CheckSettingsExists(key) {
  if (!Array.isArray(partyRulesSettings)) return false;
  return partyRulesSettings.some(rule => rule.includes(key.toLowerCase()));
}

async function AddUserIcons() {
  if (currentPartyData) {
    for (let i = 0; i < currentPartyData.players.length; i++) {
      createUserIconPartyGames({
        container: waitingForPlayersIconContainer,
        userId: currentPartyData.players[i].computerId,
        userCustomisationString: currentPartyData.players[i].userIcon
      });
    }
  }
}

function DisplayWaitingForPlayers(confirmation = true) {
  index = currentPartyData.players.findIndex(player => player.computerId === deviceId);
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
  currentPartyData.players[index].lastPing = Date.now();
  setActiveContainers(waitingForPlayersContainer);
}