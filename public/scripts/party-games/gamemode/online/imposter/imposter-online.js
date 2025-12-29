let hostDeviceId = "";

const url = window.location.href;
const segments = url.split('/');
partyCode = segments.pop() || segments.pop(); // handle trailing slash

const gameContainerPrivate = document.querySelector('#private-view.card-container');
const buttonChoosePlayer = document.getElementById('button-choose-player');

const resultsChartContainer = document.getElementById('results-container');

gameContainers.push(
  gameContainerPrivate,
  resultsChartContainer
);

const timeBased = false;
const rounds = 5;
let resetGamemodeInstruction = "DISPLAY_PRIVATE_CARD";

async function SetPageSettings() {
  buttonChoosePlayer.addEventListener('click', async () => {
    await setUserBool(deviceId, null, true);
  });

  displayStartButton.addEventListener('click', async () => {
    await setUserBool(deviceId, true, null);
  });

  displayUserAnswerButton.addEventListener('click', async () => {
    const index = currentPartyData.players.findIndex(player => player.computerId === deviceId);
    currentPartyData.roundPlayerTurn = (currentPartyData.roundPlayerTurn + 1) % currentPartyData.players.length;
    if (index > currentPartyData.roundPlayerTurn) currentPartyData.round++;
    await SendInstruction({
      partyData: currentPartyData
    })
  });

  selectUserConfirmPlayerButton.addEventListener('click', async () => {
    if (selectUserButtonContainer.getAttribute('selected-id') != "") {
      await SetVote({
        option: selectUserButtonContainer.getAttribute('selected-id')
      });
      const selectUserButtons = document.getElementById('select-user-container').querySelectorAll('.selected-user-container .button-container button');
      selectUserButtons.forEach(button => {
        button.classList.remove('active');
      });
      selectUserButtonContainer.getAttribute('selected-id') != ""
    }
  });
  selectPunishmentConfirmPunishmentButton.addEventListener('click', async () => {
    if (selectPunishmentContainer.getAttribute('select-id')) {
      selectPunishmentContainer.classList.remove('active');
      if (selectPunishmentContainer.getAttribute('select-id') == 'lucky-coin-flip') {
        console.log("paranoia-coin-flip");
        await SendInstruction({
          instruction: "CHOSE_PUNISHMENT:COIN_FLIP"
        });
      }
      else if (selectPunishmentContainer.getAttribute('select-id') == 'drink-wheel') {
        await SendInstruction({
          instruction: "CHOSE_PUNISHMENT:DRINK_WHEEL"
        });
      }
      else if (selectPunishmentContainer.getAttribute('select-id') == 'take-a-shot') {
        completePunishmentContainer.setAttribute("punishment-type", "take-a-shot")
        await SendInstruction({
          instruction: "CHOSE_PUNISHMENT:TAKE_A_SHOT"
        });
      }
      const selectPunishmentButtons = document.getElementById('select-punishment-container').querySelectorAll('.selected-user-container .button-container button');
      selectPunishmentButtons.forEach(button => {
        button.classList.remove('active');
      });
      selectPunishmentContainer.setAttribute('select-id', "");
    }
  });

  completePunishmentButtonConfirm.addEventListener('click', async () => {
    await SendInstruction({
      instruction: "RESET_QUESTION:NEXT_PLAYER",
      updateUsersReady: false,
      updateUsersConfirmation: false
    });
  });

  AddTimerToContainer(selectUserContainer);
  AddTimerToContainer(cardContainerPrivate.querySelector('.main-image-container'));
  AddTimerToContainer(resultsChartContainer);
  AddTimerToContainer(waitingForPlayerContainer);
  AddTimerToContainer(selectPunishmentContainer);
  if (timeBased == false) AddTimerToContainer(displayStartTimerContainer);

  const existingData = await getExistingPartyData(partyCode);
  if (!existingData || existingData.length === 0) {
    console.warn('No party data found.');
    return;
  }
  currentPartyData = existingData[0];

  await loadJSONFiles(currentPartyData.selectedPacks, currentPartyData.shuffleSeed);

  selectedQuestionObj = getNextQuestion(currentPartyData.currentCardIndex);
  await initialisePage();
}

function updateTextContainer(text, cardType) {
  const textContainerPrivate = document.querySelector('#private-view .text-container');
  textContainerPrivate.textContent = text;
  selectUserQuestionText.textContent = text;

  const searchPackName = cardType.toLowerCase();

  // Find the matching pack based on the cardType
  const matchedPack = cardPackMap.find(pack => {
    const packNameLower = pack.packName.toLowerCase();
    return packNameLower === searchPackName;
  });
  if (matchedPack) {
    const imageUrl = matchedPack.packCard ? matchedPack.packCard : `/images/blank-cards/${gamemode}-blank-card.svg`;
    document.querySelector('#private-view .main-image').src = imageUrl;
    textContainerPrivate.style.color = matchedPack.packColour;
    document.querySelector('#private-view .card-type-text').style.color = matchedPack.packColour;
  } else {
    console.log("Pack not found");
  }

  document.querySelector('#private-view .card-type-text').textContent = cardType;
}

async function initialisePage() {
  const response = await fetch(`/api/${sessionPartyType}?partyCode=${partyCode}`);
  const data = await response.json();
  if (data.length > 0) {
    isPlaying = true;
    const index = data[0].players.findIndex(player => player.computerId === deviceId);
    onlineUsername = data[0].players[index].username;
    hostDeviceId = data[0].players[0].computerId;
    if (data[0].players[index].socketId == "DISCONNECTED") {
      sendPartyChat({
        username: "[CONSOLE]",
        message: `${onlineUsername} has reconnected.`,
        eventType: "connect"
      });
    }
    joinParty(partyCode);
    data[0].players[index].socketId = socket.id
    console.log("Socket ID set to: " + data[0].players[index].socketId);
    if (data[0].isPlaying === true) {
      if (timeBased == false) resetGamemodeInstruction = "DISPLAY_START_TIMER";
      for (let i = 0; i < data[0].players.length; i++) {
        if (data[0].players[i].computerId != deviceId) {
          const userButton = createUserButton(data[0].players[i].computerId, data[0].players[i].username);
          selectUserButtonContainer.appendChild(userButton);
        }
      }
      partyRulesSettings = parseGameRules(data[0].gameRules)
      for (let i = 0; i < partyRulesSettings.length; i++) {
        let settingsButton;
        if (partyRulesSettings[i].includes("drink-punishment")) {
          settingsButton = createUserButton("take-a-shot", "Take A Shot");
          selectPunishmentButtonContainer.appendChild(settingsButton);
        }
        else if (!/\d/.test(partyRulesSettings[i])) {
          AddGamemodeContainers(formatDashedString({ input: partyRulesSettings[i], gamemode: data[0].gamemode, seperator: '-', uppercase: false }));
          settingsButton = createUserButton(formatDashedString({ input: partyRulesSettings[i], gamemode: data[0].gamemode, seperator: '-', uppercase: false }), formatDashedString({ input: partyRulesSettings[i], gamemode: data[0].gamemode }));
          selectPunishmentButtonContainer.appendChild(settingsButton);
        }
      }
      const selectUserButtons = document.getElementById('select-user-container').querySelectorAll('.selected-user-container .button-container button');
      const selectPunishmentButtons = document.getElementById('select-punishment-container').querySelectorAll('.selected-user-container .button-container button');

      selectUserButtons.forEach(button => {
        button.addEventListener('click', () => {
          selectUserButtons.forEach(btn => btn.classList.remove('active'));
          button.classList.add('active');
          selectUserButtonContainer.setAttribute('selected-id', button.getAttribute('id'));
        });
      });
      if (selectUserButtonContainer.length > 4) {
        selectUserButtonContainer.classList.add('overflow');
      }

      selectPunishmentButtons.forEach(button => {
        button.addEventListener('click', () => {
          selectPunishmentButtons.forEach(btn => btn.classList.remove('active'));
          selectPunishmentContainer.setAttribute('select-id', button.getAttribute('id'))
          button.classList.add('active');
        });
      });
      await LoadScript(`/scripts/party-games/gamemode/online/${cardContainerGamemode}/${cardContainerGamemode}-online-instructions.js?30082025`);
      if (deviceId == hostDeviceId && data[0].userInstructions == "") {
        await SendInstruction({
          instruction: resetGamemodeInstruction,
          updateUsersReady: false,
          updateUsersConfirmation: false,
          fetchInstruction: true,
          timer: Date.now() + getIncrementContainerValue("imposter-time-limit") * 1000,
          alternativeQuestionIndex: Math.floor(Math.random() * 255)
        });
      }
      else {
        updateOnlineParty({
          partyId: partyCode,
          players: data[0].players,
          lastPinged: Date.now(),
        });
        FetchInstructions();
      }
      SetPartyGameStatistics();
      await AddUserIcons();
      SetScriptLoaded('/scripts/party-games/online/online-settings.js');
    }
  }
}

async function FetchInstructions() {
  currentPartyData = await GetCurrentPartyData();
  if (currentPartyData == undefined || currentPartyData.length === 0) {
    PartyDisbanded();
    return;
  }
  await UpdatePartyGameStatistics();
  if (currentPartyData.userInstructions == "DISPLAY_VOTE_RESULTS") {
    DisplayVoteResults();
  }
  else if (currentPartyData.userInstructions == "DISPLAY_VOTE_RESULTS_PART_TWO") {
    await DisplayVoteResultsPartTwo();
  }
  else if (currentPartyData.userInstructions == "NEXT_QUESTION") {
    NextQuestion();
  }
  else if (currentPartyData.userInstructions.includes("USER_HAS_PASSED")) {
    UserHasPassed(currentPartyData.userInstructions);
  }
  else if (currentPartyData.userInstructions.includes("USER_SELECTED_FOR_PUNISHMENT")) {
    UserSelectedForPunishment(currentPartyData.userInstructions);
  }
  else if (currentPartyData.userInstructions.includes("DISPLAY_PRIVATE_CARD")) {
    DisplayPrivateCard(currentPartyData.userInstructions);
  }
  else if (currentPartyData.userInstructions.includes("DISPLAY_START_TIMER")) {
    DisplayStartTimer();
  }
  else if (currentPartyData.userInstructions.includes("DISPLAY_ANSWER_CONTAINER")) {
    DisplayAnswerContainer();
  }
  else if (currentPartyData.userInstructions.includes("WAITING_FOR_PLAYER")) {
    WaitingForPlayer(currentPartyData.userInstructions);
  }
  else if (currentPartyData.userInstructions.includes("CHOSE_PUNISHMENT")) {
    ChosePunishment(currentPartyData.playerTurn);
  }
  else if (currentPartyData.userInstructions.includes("CHOOSING_PUNISHMENT")) {
    ChoosingPunishment(currentPartyData.playerTurn);
  }
  else if (currentPartyData.userInstructions.includes("DISPLAY_PUNISHMENT_TO_USER")) {
    DisplayPunishmentToUser();
  }
  else if (currentPartyData.userInstructions.includes("PUNISHMENT_OFFER")) {
    PunishmentOffer(currentPartyData.userInstructions);
  }
  else if (currentPartyData.userInstructions.includes("HAS_USER_DONE_PUNISHMENT")) {
    HasUserDonePunishment(currentPartyData.userInstructions);
  }
  else if (currentPartyData.userInstructions.includes("ANSWER_TO_USER_DONE_PUNISHMENT")) {
    AnswerToUserDonePunishment(currentPartyData.userInstructions);
  }
  else if (currentPartyData.userInstructions.includes("GAME_OVER")) {
    SetPartyGameStatisticsGameOver();
  }
  else if (currentPartyData.userInstructions.includes("RESET_QUESTION")) {
    if (currentPartyData.userInstructions.includes("NEXT_PLAYER")) {
      await ResetImposterQuestion({ nextPlayer: true });
    }
  }
}

function GetVoteResults(currentPartyData) {
  const values = [];
  const voteComputerIds = [];

  for (let i = 0; i < currentPartyData.players.length; i++) {
    // Get all players who voted for this player
    const voters = currentPartyData.players.filter(
      player => player.vote === currentPartyData.players[i].computerId
    );

    // Save count
    values.push(voters.length);

    // Save their deviceIds
    voteComputerIds.push(voters.map(v => v.computerId));
  }

  // Clear any previous table content
  const tableWrapper = document.getElementById("tableWrapper");
  tableWrapper.innerHTML = "";

  // Build new table
  const table = document.createElement("table");
  table.classList.add("vote-results-table");

  currentPartyData.players.forEach((player, i) => {
    const row = document.createElement("tr");

    // --- Player icon cell ---
    const iconCell = document.createElement("td");
    iconCell.classList.add("vote-icon-cell");

    createUserIconPartyGames({
      container: iconCell,
      userId: player.computerId,
      userCustomisationString: player.userIcon
    });

    row.appendChild(iconCell);

    const colonCell = document.createElement("td");
    colonCell.textContent = ":";
    colonCell.classList.add("vote-colon-cell");
    row.appendChild(colonCell);

    const votesCell = document.createElement("td");
    votesCell.classList.add("vote-votes-cell");

    for (let j = 0; j < values[i]; j++) {
      let iconSize = null;
      const voterId = voteComputerIds[i][j];
      const voter = currentPartyData.players.find(p => p.computerId === voterId);
      if (values[i] > 3) {
        iconSize = "small";
      }
      if (voter) {
        createUserIconPartyGames({
          container: votesCell,
          userId: voter.computerId,
          userCustomisationString: voter.userIcon,
          size: iconSize
        });
      }
    }

    row.appendChild(votesCell);
    table.appendChild(row);
  });

  tableWrapper.appendChild(table);
}

function getHighestVoteValue(currentPartyData) {
  const voteCounts = {};

  for (let i = 0; i < currentPartyData.players.length; i++) {
    const computerId = currentPartyData.players[i].computerId;
    voteCounts[computerId] = GetVoteCount(currentPartyData, computerId);
  }

  const values = Object.values(voteCounts);
  const maxVote = Math.max(...values);
  const occurrences = values.filter(v => v === maxVote).length;

  return occurrences > 1 ? -maxVote : maxVote;
}

function GetHighestVoted(currentPartyData) {
  const highestVoteValue = Math.abs(getHighestVoteValue(currentPartyData));
  return currentPartyData.players
    .filter(player => GetVoteCount(currentPartyData, player.computerId) === highestVoteValue)
    .map(player => player.computerId)
    .join(",");
}

function GetVoteCount(currentPartyData, computerId) {
  return currentPartyData.players.filter(player => player.vote === computerId).length;
}

function GetAlternativeQuestion(input) {
    if (!Array.isArray(input) || input.length === 0) {
        return null;
    }

    const selectedAlternativeQuestion =
        input[currentPartyData.alternativeQuestionIndex % input.length];

    return selectedAlternativeQuestion;
}
