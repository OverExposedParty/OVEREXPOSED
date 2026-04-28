const resultsChartContainer = document.getElementById('results-container');

const gameContainerPrivate = document.querySelector('#private-view.card-container');
const buttonChooseOption = gameContainerPrivate.querySelector('#button-choose-option');

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

    await LoadScript(
      `/scripts/party-games/gamemode/online/${cardContainerGamemode}/${cardContainerGamemode}-online-instructions.js`
    );

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
  buttonChooseOption.addEventListener('click', async () => {
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
    setUserBool(deviceId, null, true);
  });

  selectOptionConfirmButtonA.addEventListener('click', async () => {
    await SetVote({ option: "A" });
  });

  selectOptionConfirmButtonB.addEventListener('click', async () => {
    await SetVote({ option: "B" });
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
