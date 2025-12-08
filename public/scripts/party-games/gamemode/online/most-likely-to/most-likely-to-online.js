let hostDeviceId = "";

const url = window.location.href;
const segments = url.split('/');
partyCode = segments.pop() || segments.pop(); // handle trailing slash

const resultsChartContainer = document.getElementById('results-container');

const gameContainerPrivate = document.querySelector('#private-view.card-container');
const buttonChoosePlayer = document.getElementById('button-choose-player');

gameContainers.push(
  gameContainerPrivate,
  resultsChartContainer
);

const punishmentText = document
  .querySelector('#complete-punishment-container .content-container #punishment-text');

async function SetPageSettings() {
  buttonChoosePlayer.addEventListener('click', async () => {
    await setUserBool(deviceId, null, true)
  });

  selectUserConfirmPlayerButton.addEventListener('click', async () => {
    if (selectUserContainer.getAttribute('selected-id') != "") {
      console.log(selectUserContainer.getAttribute('selected-id'));
      await SetVote({
        option: selectUserContainer.getAttribute('selected-id')
      });
      const selectUserButtons = selectUserContainer.querySelectorAll('.selected-user-container .button-container button');
      selectUserButtons.forEach(button => {
        button.classList.remove('active');
      });
      selectUserContainer.getAttribute('selected-id') != ""
    }
  });

  confirmNumberButton.addEventListener('click', async () => {
    if (selectNumberContainer.getAttribute('selected-id') != "") {
      await SetVote({
        option: selectNumberContainer.getAttribute('selected-id')
      });
      const selectNumberButtons = selectNumberContainer.querySelectorAll('.selected-user-container .button-container button');
      selectNumberButtons.forEach(button => {
        button.classList.remove('active');
      });
      selectNumberContainer.getAttribute('selected-id') != ""
    }
  });
  selectPunishmentConfirmPunishmentButton.addEventListener('click', async () => {
    if (selectPunishmentContainer.getAttribute('select-id')) {
      selectPunishmentContainer.classList.remove('active');
      if (selectPunishmentContainer.getAttribute('select-id') == 'most-likely-to-drink-wheel') {
        await SendInstruction({
          instruction: "CHOSE_PUNISHMENT:MOST_LIKELY_TO_DRINK_WHEEL:" + deviceId,
        });
      }
      else if (selectPunishmentContainer.getAttribute('select-id') == 'take-a-shot') {
        completePunishmentContainer.setAttribute("punishment-type", "take-a-shot")
        await SendInstruction({
          instruction: "CHOSE_PUNISHMENT:TAKE_A_SHOT:" + deviceId,
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
    const parsedInstructions = parseInstruction(currentPartyData.userInstructions);
    completePunishmentContainer.classList.remove('active');
    await SetUserConfirmation({
      selectedDeviceId: deviceId,
      option: true,
      reason: "CONFIRM:" + parsedInstructions.reason,
      userInstruction: "PUNISHMENT_OFFER"
    });
  });

  ConfirmPunishmentButtonYes.addEventListener('click', () => {
    SetUserConfirmation(deviceId, true, "PUNISHMENT", true);
  });

  confirmPunishmentButtonNo.addEventListener('click', () => {
    SetUserConfirmation(deviceId, false, "PUNISHMENT", true);
  });

  AddTimerToContainer(gameContainerPrivate.querySelector('.main-image-container'));
  AddTimerToContainer(selectUserContainer);
  AddTimerToContainer(waitingForPlayersContainer);
  AddTimerToContainer(resultsChartContainer);
  AddTimerToContainer(selectNumberContainer);
  AddTimerToContainer(selectPunishmentContainer);
  AddTimerToContainer(waitingForPlayerContainer);

  const existingData = await getExistingPartyData(partyCode);
  if (!existingData || existingData.length === 0) {
    console.warn('No party data found.');
    return;
  }
  currentPartyData = existingData[0];

  await loadJSONFiles(currentPartyData.selectedPacks, currentPartyData.shuffleSeed);

  selectedQuestionObj = getNextQuestion(currentPartyData.currentCardIndex);
  selectUserTitle.textContent = "WHO'S MOST LIKELY TO ";
  initialisePage();
}

async function initialisePage() {
  const response = await fetch(`/api/${sessionPartyType}?partyCode=${partyCode}`);
  const data = await response.json();
  if (data.length > 0) {
    isPlaying = true;
    const index = data[0].players.findIndex(player => player.computerId === deviceId);
    onlineUsername = data[0].players[index].username;
    hostDeviceId = data[0].players[0].computerId;
    console.log("hostDeviceId: " + hostDeviceId);
    if (data[0].players[index].socketId == "DISCONNECTED") {
      sendPartyChat({
        username: "[CONSOLE]",
        message: `${onlineUsername} has reconnected.`,
        eventType: "connect"
      });
    }
    data[0].players[index].socketId = socket.id
    joinParty(partyCode);
    if (data[0].isPlaying === true) {
      for (let i = 0; i < data[0].players.length; i++) {
        if (data[0].players[i].computerId != deviceId) {
          const userButton = createUserButton(data[0].players[i].computerId, data[0].players[i].username);
          selectUserButtonContainer.appendChild(userButton);
        }
      }
      partyRulesSettings = parseGameRules(data[0].gameRules)
      for (let i = 0; i < partyRulesSettings.length; i++) {
        let settingsButton;
        if (partyRulesSettings[i].includes("take-a-shot")) {
          settingsButton = createUserButton("take-a-shot", "Take A Shot");
          selectPunishmentButtonContainer.appendChild(settingsButton);
        }
        else if (!/\d/.test(partyRulesSettings[i])) {
          AddGamemodeContainers(formatDashedString({ input: partyRulesSettings[i], gamemode: data[0].gamemode, seperator: '-', uppercase: false }));
          settingsButton = createUserButton(partyRulesSettings[i], formatDashedString({ input: partyRulesSettings[i], gamemode: data[0].gamemode }));
          selectPunishmentButtonContainer.appendChild(settingsButton);
        }
      }
      const selectUserButtons = document.getElementById('select-user-container').querySelectorAll('.selected-user-container .button-container button');
      const selectPunishmentButtons = document.getElementById('select-punishment-container').querySelectorAll('.selected-user-container .button-container button');

      selectUserButtons.forEach(button => {
        button.addEventListener('click', () => {
          selectUserButtons.forEach(btn => btn.classList.remove('active'));
          button.classList.add('active');
          selectUserContainer.setAttribute('selected-id', button.getAttribute('id'));
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
      console.log("timer: " + getIncrementContainerValue("time-limit"));
      if (deviceId == hostDeviceId && data[0].userInstructions == "") {
        await SendInstruction({
          instruction: "DISPLAY_PRIVATE_CARD",
          updateUsersReady: false,
          updateUsersConfirmation: false,
          fetchInstruction: true,
          timer: Date.now() + getIncrementContainerValue("time-limit") * 1000
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
    if (values[i] === 0) return;
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

function GetVoteCount(currentPartyData, computerId) {
  return currentPartyData.players.filter(player => player.vote === computerId).length;
}

function GetHighestVoted(currentPartyData) {
  const highestVoteValue = Math.abs(getHighestVoteValue(currentPartyData));
  return currentPartyData.players
    .filter(player => GetVoteCount(currentPartyData, player.computerId) === highestVoteValue)
    .map(player => player.computerId)
    .join(",");
}
function CountParsedString(parsedString) {
  if (!parsedString) return 0;
  return parsedString.split(",").filter(Boolean).length;
}

function GetStringAtIndex(votedString, index) {
  const stringList = votedString.split(",").filter(Boolean);
  return stringList[index] || null; // returns null if index is out of bounds
}


async function FetchInstructions() {
  currentPartyData = await GetCurrentPartyData();
  if (currentPartyData == undefined || currentPartyData.length === 0) {
    PartyDisbanded();
    return;
  }
  await UpdatePartyGameStatistics();
  if (currentPartyData.userInstructions.includes("DISPLAY_PRIVATE_CARD")) {
    DisplayPrivateCard();
  }
  else if (currentPartyData.userInstructions.includes("DISPLAY_VOTE_RESULTS")) {
    DisplayVoteResults();
  }
  else if (currentPartyData.userInstructions.includes("TIE_BREAKER_PUNISHMENT_OFFER")) {
    TieBreakerPunishmentOffer(currentPartyData.userInstructions);
  }
  else if (currentPartyData.userInstructions.includes("WAITING_FOR_PLAYER")) {
    WaitingForPlayer(currentPartyData.userInstructions);
  }
  else if (currentPartyData.userInstructions.includes("CHOSE_PUNISHMENT")) {
    ChosePunishment(currentPartyData.userInstructions);
  }
  else if (currentPartyData.userInstructions.includes("CHOOSING_PUNISHMENT")) {
    ChoosingPunishment(currentPartyData.userInstructions);
  }
  else if (currentPartyData.userInstructions.includes("DISPLAY_PUNISHMENT_TO_USER")) {
    DisplayPunishmentToUser(currentPartyData.userInstructions);
  }
  else if (currentPartyData.userInstructions.includes("PUNISHMENT_OFFER")) {
    PunishmentOffer(currentPartyData.userInstructions);
  }
  else if (currentPartyData.userInstructions.includes("HAS_USER_DONE_PUNISHMENT")) {
    HasUserDonePunishment(currentPartyData.userInstructions);
  }
  else if (currentPartyData.userInstructions.includes("ANSWER_TO_USER_DONE_PUNISHMENT")) {
    AnswerToUserDonePunishment();
  }
  else if (currentPartyData.userInstructions.includes("GAME_OVER")) {
    SetPartyGameStatisticsGameOver();
  }
  else if (currentPartyData.userInstructions.includes("RESET_QUESTION")) {
    if (currentPartyData.userInstructions.includes("PLAYER_TURN_PASSED")) {
      let parsedInstructions = parseInstructionDeviceId(currentPartyData.userInstructions);
      await ResetQuestion({
        timer: Date.now() + getIncrementContainerValue("time-limit") * 1000,
        playerIndex: currentPartyData.players.findIndex(player => player.computerId === parsedInstructions.reason),
        incrementScore: -2
      });
    }
    else {
      await ResetQuestion({
        timer: Date.now() + getIncrementContainerValue("time-limit") * 1000
      });
    }
  }
}

const names = ['TEST1', 'TEST2', 'TEST3', 'TEST4'];
const values = [3, 5, 2, 4];

const tableWrapper = document.getElementById("tableWrapper");
const table = document.createElement("table");
table.style.borderCollapse = "collapse";

names.forEach((name, i) => {
  const row = document.createElement("tr");

  // Name column
  const nameCell = document.createElement("td");
  nameCell.textContent = name;
  nameCell.style.padding = "4px 8px";
  nameCell.style.verticalAlign = "middle";
  row.appendChild(nameCell);

  // Icons column
  const iconsCell = document.createElement("td");
  iconsCell.style.padding = "4px 8px";
  iconsCell.style.display = "flex";   // display icons inline
  iconsCell.style.gap = "4px";        // spacing between icons

  for (let j = 0; j < values[i]; j++) {
    const icon = document.createElement("div");
    icon.className = "icon medium";

    icon.innerHTML = `
      <div class="image-stack">
        <img src="/images/user-customisation/colour/blank/blank-colour.svg"
             class="user-customisation-character layer-colour" alt="Colour Slot">
        <img src="/images/user-customisation/head-slot/blank/no-head-slot.svg"
             class="user-customisation-character layer-head-slot" alt="Head Slot">
        <img src="/images/user-customisation/eyes-slot/blank/no-eyes-slot.svg"
             class="user-customisation-character layer-eyes-slot" alt="Eyes Slot">
        <img src="/images/user-customisation/mouth-slot/blank/no-mouth-slot.svg"
             class="user-customisation-character layer-mouth-slot" alt="Mouth Slot">
      </div>
    `;

    iconsCell.appendChild(icon);
  }

  row.appendChild(iconsCell);
  table.appendChild(row);
});

tableWrapper.appendChild(table);