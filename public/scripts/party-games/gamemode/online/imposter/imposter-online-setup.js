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
    const updatedParty = await performOnlinePartyAction({
      action: 'imposter-advance-answer-turn',
      payload: {
        roundsLimit: rounds,
        timer: Date.now() + getTimeLimit("imposter-time-limit") * 1000
      },
      syncInstructions: false
    });

    if (updatedParty) {
      currentPartyData = updatedParty;
      if (typeof renderCurrentImposterInstructionFromState === 'function') {
        await renderCurrentImposterInstructionFromState();
      } else if (typeof FetchInstructions === 'function') {
        await FetchInstructions();
      }
    }
  });

  selectUserConfirmPlayerButton.addEventListener('click', async () => {
    if (selectUserButtonContainer.getAttribute('selected-id') != "") {
      await SetVote({
        option: selectUserButtonContainer.getAttribute('selected-id')
      });
      const selectUserButtons = document
        .getElementById('select-user-container')
        .querySelectorAll('.selected-user-container .button-container button');
      selectUserButtons.forEach(button => {
        button.classList.remove('active');
      });
      selectUserButtonContainer.getAttribute('selected-id') != "";
    }
  });

  selectPunishmentConfirmPunishmentButton.addEventListener('click', async () => {
    if (selectPunishmentContainer.getAttribute('select-id')) {
      hideContainer(selectPunishmentContainer);

      const selectedId = selectPunishmentContainer.getAttribute('select-id');
      const punishmentType = selectedId === 'lucky-coin-flip'
        ? 'COIN_FLIP'
        : selectedId === 'drink-wheel'
          ? 'DRINK_WHEEL'
          : selectedId === 'take-a-shot'
            ? 'TAKE_A_SHOT'
            : selectedId;

      const updatedParty = await performOnlinePartyAction({
        action: 'imposter-select-punishment',
        payload: {
          punishmentType
        }
      });

      if (updatedParty) {
        currentPartyData = updatedParty;
      }

      const selectPunishmentButtons = document
        .getElementById('select-punishment-container')
        .querySelectorAll('.selected-user-container .button-container button');
      selectPunishmentButtons.forEach(button => {
        button.classList.remove('active');
      });

      selectPunishmentContainer.setAttribute('select-id', "");
    }
  });

  completePunishmentButtonConfirm.addEventListener('click', async () => {
    const updatedParty = await performOnlinePartyAction({
      action: 'imposter-complete-punishment',
      payload: {
        roundTimer: Date.now() + getTimeLimit("imposter-time-limit") * 1000,
        resetInstruction: resetGamemodeInstruction,
        alternativeQuestionIndex: Math.floor(Math.random() * 255)
      }
    });

    if (updatedParty) {
      currentPartyData = updatedParty;
    }
  });

  AddTimerToContainer(selectUserContainer);
  AddTimerToContainer(resultsChartContainer);
  AddTimerToContainer(waitingForPlayersContainer);
  AddTimerToContainer(waitingForPlayerContainer);
  AddTimerToContainer(displayUserAnswerContainer);
  AddTimerToContainer(selectPunishmentContainer);
  if (timeBased === false) AddTimerToContainer(displayStartTimerContainer);

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

  const config = currentPartyData.config || {};
  const deck = currentPartyData.deck || {};

  await loadJSONFiles(config.selectedPacks, config.shuffleSeed);

  const currentCardIndex = deck.currentCardIndex ?? 0;
  selectedQuestionObj = getNextQuestion(currentCardIndex);

  await initialisePage();
}

async function initialisePage() {
  const session = await bootstrapOnlineGamePage({
    requirePlaying: true
  });
  if (!session) {
    return;
  }
  const { party, players, config, state, deck, me } = session;

  debugLog("hostDeviceId:", hostDeviceId);
  debugLog("Socket ID set to: " + (me.connection?.socketId ?? me.socketId));

  if (state.isPlaying === true) {
    if (timeBased === false) {
      resetGamemodeInstruction = "DISPLAY_START_TIMER";
    }

    // Build user selection buttons
    players.forEach(player => {
      const id = getPlayerId(player);
      if (id !== deviceId) {
        const username  = getPlayerUsername(player);
        const userButton = createUserButton(id, username);
        selectUserButtonContainer.appendChild(userButton);
      }
    });

    // New schema: gameRules is an object/map
    const rawGameRules = config.gameRules || {};
    const rulesObj =
      rawGameRules instanceof Map ? Object.fromEntries(rawGameRules) : rawGameRules;

    // Expose globally if you use `gameRules` elsewhere in this file
    gameRules = rulesObj;

    Object.entries(rulesObj).forEach(([ruleKey, value]) => {
      const isEnabled = value === true || value === "true";
      if (!isEnabled) return;

      let settingsButton;

      // Keep substring behaviour for any "*drink-punishment" rule keys
      if (ruleKey.includes("drink-punishment")) {
        settingsButton = createUserButton("take-a-shot", "Take A Shot");
        selectPunishmentButtonContainer.appendChild(settingsButton);
      } else if (!/\d/.test(ruleKey)) {
        const gm   = config.gamemode;
        const id   = formatDashedString({ input: ruleKey, gamemode: gm, seperator: '-', uppercase: false });
        const label = formatDashedString({ input: ruleKey, gamemode: gm });
        AddGamemodeContainers(id);
        settingsButton = createUserButton(id, label);
        selectPunishmentButtonContainer.appendChild(settingsButton);
      }
    });

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
        selectUserButtonContainer.setAttribute('selected-id', button.getAttribute('id'));
      });
    });

    // Proper overflow check
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

    const currentInstructions = getUserInstructions(party);

    if (deviceId === hostDeviceId && currentInstructions === "") {
      await SendInstruction({
        instruction: resetGamemodeInstruction,
        updateUsersReady: false,
        updateUsersConfirmation: false,
        fetchInstruction: true,
        // still using imposter-time-limit increment container for this mode
        timer: Date.now() + getTimeLimit("imposter-time-limit") * 1000,
        alternativeQuestionIndex: Math.floor(Math.random() * 255)
      });
    } else {
      const syncedPartyState = await syncStartupPartyState();

      if (syncedPartyState) {
        currentPartyData = {
          ...syncedPartyState.party,
          config: syncedPartyState.config,
          state: syncedPartyState.state,
          deck: syncedPartyState.deck,
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

    currentPartyData = { ...party, config, state, deck };

    SetPartyGameStatistics();
    await AddUserIcons();
    SetScriptLoaded('/scripts/party-games/online/online-settings.js');
  }
}
