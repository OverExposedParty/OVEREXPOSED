const resultsChartContainer = document.getElementById('results-container');

const gameContainerPrivate = document.querySelector('#private-view.card-container');
const buttonChoosePlayer = document.getElementById('button-choose-player');

gameContainers.push(
  gameContainerPrivate,
  resultsChartContainer
);

async function initialisePage() {
  const session = await bootstrapOnlineGamePage({
    requirePlaying: true
  });
  if (!session) {
    return;
  }
  const { party, players, config, state } = session;

  debugLog("hostDeviceId:", hostDeviceId);

  if (state.isPlaying === true) {
    // Build "who's most likely to" buttons for every player
    for (let i = 0; i < players.length; i++) {
      const pid = getPlayerId(players[i]);
      if (pid) {
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
      `/scripts/party-games/gamemode/online/${cardContainerGamemode}/${cardContainerGamemode}-online-instructions.js`,
      { cacheBustKey: "PARTY_GAMES_ONLINE_MOST_LIKELY_TO" }
    );

    debugLog("timer:", getTimeLimit());

    const instructions = getUserInstructions(party);

    if (deviceId === hostDeviceId && instructions === "") {
      await SendInstruction({
        instruction: "DISPLAY_PRIVATE_CARD",
        updateUsersReady: false,
        updateUsersConfirmation: false,
        fetchInstruction: true,
        timer: Date.now() + getTimeLimit() * 1000
      });
    } else {
      const syncedPartyState = await syncStartupPartyState();

      if (syncedPartyState) {
        currentPartyData = {
          ...syncedPartyState.party,
          config: syncedPartyState.config,
          state: syncedPartyState.state,
          players: syncedPartyState.players
        };
      }

      const partyWithInstruction = await waitForPartyInstruction({
        retries: 20,
        delayMs: 250
      });

      if (partyWithInstruction) {
        currentPartyData = partyWithInstruction;
      }

      await runOnlineFetchInstructions({ reason: 'setup' });
    }

    SetPartyGameStatistics();
    await AddUserIcons();
    SetScriptLoaded('/scripts/party-games/online/online-settings.js');
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

    DisplayWaitingForPlayers();

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

    hideContainer(selectPunishmentContainer);
    const punishmentType = selectedId === 'drink-wheel'
      ? 'MOST_LIKELY_TO_DRINK_WHEEL'
      : selectedId === 'take-a-shot'
        ? 'TAKE_A_SHOT'
        : selectedId;

    const updatedParty = await performOnlinePartyAction({
      action: 'most-likely-to-select-punishment',
      payload: {
        punishmentType,
        phaseTimer: Date.now() + getTimeLimit() * 1000
      }
    });

    if (updatedParty) {
      currentPartyData = updatedParty;
    }

    const selectPunishmentButtons = document
      .getElementById('select-punishment-container')
      .querySelectorAll('.selected-user-container .button-container button');
    selectPunishmentButtons.forEach(button => button.classList.remove('active'));
    selectPunishmentContainer.setAttribute('select-id', "");
  });

  // Player confirms they did the punishment
  completePunishmentButtonConfirm.addEventListener('click', async () => {
    hideContainer(completePunishmentContainer);

    const updatedParty = await performOnlinePartyAction({
      action: 'most-likely-to-complete-punishment',
      payload: {
        roundTimer: Date.now() + getTimeLimit() * 1000
      }
    });

    if (updatedParty) {
      currentPartyData = updatedParty;
    }
  });
  // Legacy "yes/no" confirmations if you still use them
  ConfirmPunishmentButtonYes.addEventListener('click', () => {
    SetUserConfirmation(deviceId, true, "PUNISHMENT", true);
  });

  confirmPunishmentButtonNo.addEventListener('click', () => {
    SetUserConfirmation(deviceId, false, "PUNISHMENT", true);
  });

  // Timers
  AddTimerToContainer(selectUserContainer);
  AddTimerToContainer(waitingForPlayersContainer);
  AddTimerToContainer(resultsChartContainer);
  AddTimerToContainer(selectNumberContainer);
  AddTimerToContainer(selectPunishmentContainer);
  AddTimerToContainer(waitingForPlayerContainer);
  AddTimerToContainer(completePunishmentContainer);

  // Load current party (new schema only)
  const initialPartyData = await waitForOnlinePartySnapshot({
    requirePlayer: true,
    requirePlaying: true
  });
  if (!initialPartyData) {
    console.warn('No party data found.');
    ShowPartyDoesNotExistState();
    return;
  }
  currentPartyData = initialPartyData;

  const config = getPartyConfig(currentPartyData);
  const deck = currentPartyData.deck;

  await loadJSONFiles(config.selectedPacks, config.shuffleSeed);

  const cardIndex = deck.currentCardIndex ?? 0;
  selectedQuestionObj = getNextQuestion(cardIndex);

  selectUserTitle.textContent = "WHO'S MOST LIKELY TO ";

  initialisePage();
}
