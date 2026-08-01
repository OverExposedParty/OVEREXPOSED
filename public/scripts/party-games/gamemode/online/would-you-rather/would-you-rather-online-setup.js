const resultsChartContainer = document.getElementById('results-container');

const gameContainerPrivate = document.querySelector('#private-view.card-container');
const buttonChooseOption = gameContainerPrivate.querySelector('#button-choose-option');
let chooseOptionRequestInFlight = false;

gameContainers.push(
  gameContainerPrivate,
  resultsChartContainer
);

async function initialisePage() {
  const session = await bootstrapOnlineGamePage({
    requirePlaying: true,
    updateCurrentPartyData: true
  });
  if (!session) {
    return;
  }
  const { party, players, config, state } = session;

  debugLog("hostDeviceId:", hostDeviceId);

  if (state.isPlaying === true) {
    const rawGameRules = config.gameRules || {};
    gameRules =
      rawGameRules instanceof Map ? Object.fromEntries(rawGameRules) : rawGameRules;

    Object.entries(gameRules).forEach(([ruleKey, value]) => {
      const isEnabled = value === true || value === "true";
      if (!isEnabled) return;

      let settingsButton;

      if (ruleKey === "drink-punishment") {
        settingsButton = createUserButton("take-a-shot", "Take A Shot");
        selectPunishmentButtonContainer.appendChild(settingsButton);
      }
      else if (!/\d/.test(ruleKey)) {
        const dashed = formatDashedString({
          input: ruleKey,
          gamemode: config.gamemode,
          seperator: '-',
          uppercase: false
        });

        AddGamemodeContainers(dashed);

        settingsButton = createUserButton(
          dashed,
          formatDashedString({
            input: ruleKey,
            gamemode: config.gamemode
          })
        );

        selectPunishmentButtonContainer.appendChild(settingsButton);
      }
    });

    const instructionsBasePath =
      `/scripts/party-games/gamemode/online/${cardContainerGamemode}`;

    await LoadScript(`${instructionsBasePath}/would-you-rather-online-instructions/phase-tools.js`);
    await LoadScript(`${instructionsBasePath}/would-you-rather-online-instructions/round-actions.js`);
    await LoadScript(`${instructionsBasePath}/would-you-rather-online-instructions/private-card.js`);
    await LoadScript(`${instructionsBasePath}/would-you-rather-online-instructions/vote-flow.js`);
    await LoadScript(`${instructionsBasePath}/would-you-rather-online-instructions/punishment-flow.js`);
    await LoadScript(`${instructionsBasePath}/${cardContainerGamemode}-online-instructions.js`);

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
  if (!(await registerRoundLateJoinIfRequested())) return;

  buttonChooseOption.addEventListener('click', async () => {
    if (chooseOptionRequestInFlight) return;
    chooseOptionRequestInFlight = true;
    buttonChooseOption.disabled = true;

    try {
      currentPartyData = await GetCurrentPartyData();

      // NEW SCHEMA: currentCardIndex lives under deck
      const currentCardIndex = currentPartyData.deck.currentCardIndex;
      selectedQuestionObj = getNextQuestion(currentCardIndex);

      const splitQuestion = SplitQuestion(
        selectedQuestionObj.question.replace("Would you rather ", "")
      );

      selectOptionQuestionTextA.textContent = "A: " + splitQuestion.a;
      selectOptionQuestionTextB.textContent = "B: " + splitQuestion.b;

      setActiveContainers(selectOptionContainer);
      const players = currentPartyData.players || [];
      const me = players.find(player => getPlayerId(player) === deviceId);
      if (me) {
        const myState = getPlayerState(me);
        myState.isReady = true;
        me.isReady = true;
      }

      const updatedParty = await setUserBool(deviceId, null, true);
      if (updatedParty) {
        currentPartyData = updatedParty;
      }
    } finally {
      chooseOptionRequestInFlight = false;
      buttonChooseOption.disabled = false;
    }
  });

  selectOptionConfirmButtonA.addEventListener('click', async () => {
    await SetVote({ option: "A" });
    stopWouldYouRatherVoteTimerWarning();
  });

  selectOptionConfirmButtonB.addEventListener('click', async () => {
    await SetVote({ option: "B" });
    stopWouldYouRatherVoteTimerWarning();
  });

  completePunishmentButtonConfirm.addEventListener('click', async () => {
    const updatedParty = await performOnlinePartyAction({
      action: 'would-you-rather-complete-punishment',
      payload: {
        nextRoundTimerDurationMs: getTimeLimit() * 1000
      }
    });

    if (updatedParty) {
      currentPartyData = updatedParty;
    }
  });

  AddTimerToContainer(selectOptionContainer);
  AddTimerToContainer(waitingForPlayersContainer);
  AddTimerToContainer(resultsChartContainer);
  AddTimerToContainer(waitingForPlayerContainer);
  AddTimerToContainer(completePunishmentContainer);

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

  // NEW SCHEMA: selectedPacks + shuffleSeed in config
  await loadJSONFiles(
    currentPartyData.config.selectedPacks,
    currentPartyData.config.shuffleSeed
  );
  debugLog("Loaded JSON files");
  await initialisePage();
}
