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

async function initialisePage() {
  const response = await fetch(`/api/${sessionPartyType}?partyCode=${partyCode}`);
  const data = await response.json();
  if (data.length === 0) {
    ShowPartyDoesNotExistState();
    return;
  }

  const party = data[0];
  const players = party.players || [];
  const config = getPartyConfig(party);
  const state = getPartyState(party);

  isPlaying = true;

const index = players.findIndex(
    player => player.identity?.computerId === deviceId || player.computerId === deviceId
  );
  if (index === -1) {
    console.warn('Current device not found in players.');
    ShowGameAlreadyStartedState();
    return;
  }

  const me = players[index];
  onlineUsername = me.identity?.username || me.username;

  // 🔽 NEW: determine correct host based on hostComputerIdList
  const resolvedHostId = await checkAndMaybeBecomeHost({
    party,
    deviceId,
    onlineUsername
  });

  // Fallback to first player if no host resolved
  if (resolvedHostId) {
    hostDeviceId = resolvedHostId;
  } else {
    const fallbackHost = players[0];
    hostDeviceId = fallbackHost?.identity?.computerId || fallbackHost?.computerId;
  }

  console.log("hostDeviceId:", hostDeviceId);

  const myConnectionSocket = me.connection?.socketId ?? me.socketId;
  if (myConnectionSocket === "DISCONNECTED") {
    sendPartyChat({
      username: "[CONSOLE]",
      message: `${onlineUsername} has reconnected.`,
      eventType: "connect"
    });
  }

  if (!me.connection) me.connection = {};
  me.connection.socketId = socket.id;

  joinParty(partyCode);

  if (state.isPlaying === true) {
    // Build "who's most likely to" buttons for all other players
    for (let i = 0; i < players.length; i++) {
      const pid = getPlayerId(players[i]);
      if (pid !== deviceId) {
        const userButton = createUserButton(pid, getPlayerUsername(players[i]));
        selectUserButtonContainer.appendChild(userButton);
      }
    }

    // Build punishment settings from game rules (new object/Map format)
    const rawGameRules = config.gameRules || {};
    const gameRules =
      rawGameRules instanceof Map ? Object.fromEntries(rawGameRules) : rawGameRules;

    Object.entries(gameRules).forEach(([ruleKey, value]) => {
      const isEnabled = value === true || value === 'true';
      if (!isEnabled) return;

      let settingsButton;

      // Specific behaviour for take-a-shot
      if (ruleKey === "take-a-shot") {
        settingsButton = createUserButton("take-a-shot", "Take A Shot");
        selectPunishmentButtonContainer.appendChild(settingsButton);
        return;
      }

      // Skip numeric-like rules (time-limit etc.)
      if (/\d/.test(ruleKey)) return;

      AddGamemodeContainers(
        formatDashedString({
          input: ruleKey,
          seperator: '-',
          uppercase: false
        })
      );

      settingsButton = createUserButton(
        ruleKey,
        formatDashedString({
          input: ruleKey,
        })
      );
      selectPunishmentButtonContainer.appendChild(settingsButton);
    });

    // Hook up selection buttons
    const selectUserButtons = document
      .getElementById('select-user-container')
      .querySelectorAll('.selected-user-container .button-container button');
    const selectPunishmentButtons = document
      .getElementById('select-punishment-container')
      .querySelectorAll('.selected-user-container .button-container button');

    selectUserButtons.forEach(button => {
      button.addEventListener('click', () => {
        selectUserButtons.forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');
        selectUserContainer.setAttribute('selected-id', button.getAttribute('id'));
      });
    });

    // Better overflow check
    if (selectUserButtonContainer.children &&
      selectUserButtonContainer.children.length > 4) {
      selectUserButtonContainer.classList.add('overflow');
    }

    selectPunishmentButtons.forEach(button => {
      button.addEventListener('click', () => {
        selectPunishmentButtons.forEach(btn => btn.classList.remove('active'));
        selectPunishmentContainer.setAttribute('select-id', button.getAttribute('id'));
        button.classList.add('active');
      });
    });

    await LoadScript(
      `/scripts/party-games/gamemode/online/${cardContainerGamemode}/${cardContainerGamemode}-online-instructions.js`
    );

    console.log("timer:", getTimeLimit());

    const instructions = getUserInstructions(party);

    if (deviceId === hostDeviceId && instructions === "") {
      await SendInstruction({
        instruction: "DISPLAY_PRIVATE_CARD",
        updateUsersReady: false,
        updateUsersConfirmation: false,
        partyData: party,
        fetchInstruction: true,
        timer: Date.now() + getTimeLimit() * 1000
      });
    } else {
      const updatedState = {
        ...state,
        lastPinged: new Date()
      };

      await updateOnlineParty({
        partyId: partyCode,
        config,
        state: updatedState,
        players
      });
      await FetchInstructions();
    }

    SetPartyGameStatistics();
    await AddUserIcons();
    SetScriptLoaded('/scripts/party-games/online/online-settings.js');
    SetScriptLoaded('/scripts/party-games/gamemode/online/most-likely-to/most-likely-to-online.js');
  }
}

async function SetPageSettings() {
  // Current user is ready to pick someone
  buttonChoosePlayer.addEventListener('click', async () => {
    await setUserBool(deviceId, null, true);
  });

  // Confirm which player was selected
  selectUserConfirmPlayerButton.addEventListener('click', async () => {
    const selectedId = selectUserContainer.getAttribute('selected-id');
    if (!selectedId) return;

    await SetVote({ option: selectedId });

    const selectUserButtons = selectUserContainer
      .querySelectorAll('.selected-user-container .button-container button');
    selectUserButtons.forEach(button => button.classList.remove('active'));
    selectUserContainer.setAttribute('selected-id', "");
  });

  // Confirm number choice
  confirmNumberButton.addEventListener('click', async () => {
    const selectedId = selectNumberContainer.getAttribute('selected-id');
    if (!selectedId) return;

    await SetVote({ option: selectedId });

    const selectNumberButtons = selectNumberContainer
      .querySelectorAll('.selected-user-container .button-container button');
    selectNumberButtons.forEach(button => button.classList.remove('active'));
    selectNumberContainer.setAttribute('selected-id', "");
  });

  // Confirm punishment choice
  selectPunishmentConfirmPunishmentButton.addEventListener('click', async () => {
    const selectedId = selectPunishmentContainer.getAttribute('select-id');
    if (!selectedId) return;

    selectPunishmentContainer.classList.remove('active');

    if (selectedId === 'drink-wheel') {
      await SendInstruction({
        instruction: `CHOSE_PUNISHMENT:MOST_LIKELY_TO_DRINK_WHEEL:${deviceId}`,
        byPassHost: true
      });
    } else if (selectedId === 'take-a-shot') {
      completePunishmentContainer.setAttribute("punishment-type", "take-a-shot");
      await SendInstruction({
        instruction: `CHOSE_PUNISHMENT:TAKE_A_SHOT:${deviceId}`,
        byPassHost: true
      });
    }

    const selectPunishmentButtons = document
      .getElementById('select-punishment-container')
      .querySelectorAll('.selected-user-container .button-container button');
    selectPunishmentButtons.forEach(button => button.classList.remove('active'));
    selectPunishmentContainer.setAttribute('select-id', "");
  });

  // Player confirms they did the punishment
  completePunishmentButtonConfirm.addEventListener('click', async () => {
    const instructions = getUserInstructions(currentPartyData);
    const parsedInstructions = parseInstruction(instructions);
    completePunishmentContainer.classList.remove('active');

    await SetUserConfirmation({
      selectedDeviceId: deviceId,
      option: true,
      reason: "CONFIRM:" + parsedInstructions.reason,
      userInstruction: "PUNISHMENT_OFFER"
    });
  });
  // Legacy "yes/no" confirmations if you still use them
  ConfirmPunishmentButtonYes.addEventListener('click', () => {
    SetUserConfirmation(deviceId, true, "PUNISHMENT", true);
  });

  confirmPunishmentButtonNo.addEventListener('click', () => {
    SetUserConfirmation(deviceId, false, "PUNISHMENT", true);
  });

  // Timers
  AddTimerToContainer(gameContainerPrivate.querySelector('.main-image-container'));
  AddTimerToContainer(selectUserContainer);
  AddTimerToContainer(waitingForPlayersContainer);
  AddTimerToContainer(resultsChartContainer);
  AddTimerToContainer(selectNumberContainer);
  AddTimerToContainer(selectPunishmentContainer);
  AddTimerToContainer(waitingForPlayerContainer);

  // Load current party (new schema only)
  const existingData = await getExistingPartyData(partyCode);
  if (!existingData || existingData.length === 0) {
    console.warn('No party data found.');
    ShowPartyDoesNotExistState();
    return;
  }
  currentPartyData = existingData[0];

  const config = getPartyConfig(currentPartyData);
  const deck = currentPartyData.deck;

  await loadJSONFiles(config.selectedPacks, config.shuffleSeed);

  const cardIndex = deck.currentCardIndex ?? 0;
  selectedQuestionObj = getNextQuestion(cardIndex);

  selectUserTitle.textContent = "WHO'S MOST LIKELY TO ";

  initialisePage();
}
