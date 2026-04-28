const gameContainerPublic = document.querySelector('#public-view.card-container');
const gameContainerPublicButtonContainer = gameContainerPublic.querySelector('.regular-button-container');
const gameContainerPublicWaitingText = gameContainerPublicButtonContainer.querySelector('h2');
const gameContainerPublicButtonAnswer = gameContainerPublicButtonContainer.querySelector('#answer');
const gameContainerPublicButtonPass = gameContainerPublicButtonContainer.querySelector("#pass");
const gameContainerAnswer = document.querySelector('#answer-view.card-container');
const gameContainerAnswerButtonContainer = gameContainerAnswer.querySelector('.regular-button-container');
const gameContainerAnswerButtonNextQuestion = gameContainerAnswerButtonContainer.querySelector("#next-question");

gameContainers.push(
  gameContainerPublic,
  gameContainerAnswer
);

let textBoxSetting = false;

async function SetPageSettings() {
  selectPunishmentText.textContent = "YOU CHOSE TO PASS. PICK A FORFEIT.";

  selectPunishmentConfirmPunishmentButton.addEventListener('click', async () => {
    if (selectPunishmentContainer.getAttribute('select-id')) {
      hideContainer(selectPunishmentContainer);
      const punishmentType = selectPunishmentContainer.getAttribute('select-id') == 'drink-wheel'
        ? 'DRINK_WHEEL'
        : selectPunishmentContainer.getAttribute('select-id') == 'take-a-shot'
          ? 'TAKE_A_SHOT'
          : formatDashedString({
              input: selectPunishmentContainer.getAttribute('select-id'),
              seperator: '_'
            }).toUpperCase();

      const updatedParty = await performOnlinePartyAction({
        action: 'truth-or-dare-select-punishment',
        payload: {
          punishmentType,
          phaseTimer: Date.now() + gameRules["time-limit"] * 1000
        }
      });

      await syncTruthOrDarePartyAndRender(updatedParty);
      const selectPunishmentButtons = document.getElementById('select-punishment-container').querySelectorAll('.selected-user-container .button-container button');
      selectPunishmentButtons.forEach(button => {
        button.classList.remove('active');
      });
      selectPunishmentContainer.setAttribute('select-id', "");
    }
  });

  completePunishmentButtonConfirm.addEventListener('click', async () => {
    const updatedParty = await performOnlinePartyAction({
      action: 'truth-or-dare-complete-punishment',
      payload: {
        roundTimer: Date.now() + gameRules["time-limit"] * 1000
      }
    });

    await syncTruthOrDarePartyAndRender(updatedParty);
  });

  selectQuestionTypeButtonTruth.addEventListener('click', async () => {
    const updatedParty = await performOnlinePartyAction({
      action: 'truth-or-dare-select-question-type',
      payload: {
        questionType: 'truth',
        timer: Date.now() + gameRules["time-limit"] * 1000
      }
    });

    await syncTruthOrDarePartyAndRender(updatedParty);
  });

  selectQuestionTypeButtonDare.addEventListener('click', async () => {
    const updatedParty = await performOnlinePartyAction({
      action: 'truth-or-dare-select-question-type',
      payload: {
        questionType: 'dare',
        timer: Date.now() + gameRules["time-limit"] * 1000
      }
    });

    await syncTruthOrDarePartyAndRender(updatedParty);
  });

  gameContainerPublicButtonPass.addEventListener('click', async () => {
    const updatedParty = await performOnlinePartyAction({
      action: 'truth-or-dare-pass-question',
      payload: {
        phaseTimer: Date.now() + gameRules["time-limit"] * 1000,
        roundTimer: Date.now() + gameRules["time-limit"] * 1000
      }
    });

    await syncTruthOrDarePartyAndRender(updatedParty);
  });

  gameContainerPublicButtonAnswer.addEventListener('click', async () => {
    if (textBoxSetting == false) {
      await SendInstruction({
        instruction: "DISPLAY_COMPLETE_QUESTION",
        byPassHost: true,
        fetchInstruction: true
      });
    }
    else {
      await SendInstruction({
        instruction: "DISPLAY_CONFIRM_INPUT",
        byPassHost: true,
        fetchInstruction: true
      });
    }
  });

  answerQuestionSubmitButton.addEventListener('click', async () => {
    await SendInstruction({
      instruction: "DISPLAY_ANSWER_CARD:" + answerQuestionAnswer.value,
      byPassHost: true,
      fetchInstruction: true
    });
  });

  gameContainerAnswerButtonNextQuestion.addEventListener('click', async () => {
    await ResetTruthOrDareQuestion({ force: false, nextPlayer: true });
  });

  completePromptCompleted.addEventListener('click', async () => {
    await ResetTruthOrDareQuestion({ force: true, nextPlayer: true, incrementScore: 1 });
  });

  AddTimerToContainer(waitingForPlayerContainer);
  AddTimerToContainer(selectUserContainer);
  AddTimerToContainer(selectQuestionTypeContainer);
  AddTimerToContainer(selectPunishmentContainer);
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

  // Use config for selectedPacks & shuffleSeed (fallback to flat for legacy)
  const config = getPartyConfig(currentPartyData);
  await loadJSONFiles(config.selectedPacks, config.shuffleSeed);
  debugLog("initialisePage");
  await initialisePage();
}

async function initialisePage() {
  const session = await bootstrapOnlineGamePage({
    requirePlaying: true
  });
  if (session) {
    const { party, players, config, state } = session;

    debugLog("hostDeviceId:", hostDeviceId);
    debugLog('[OE_DEBUG][truth-or-dare][initialisePage]', {
      deviceId,
      hostDeviceId,
      onlineUsername,
      userInstructions: getUserInstructions(party),
      phase: state?.phase ?? null,
      playerTurn: state?.playerTurn ?? null
    });

    if (state.isPlaying === true) {
      gameRules = config.gameRules || {};
      const gm = config.gamemode || party.gamemode;

      // 1) Direct checks for specific rules
      if (gameRules["truth-or-dare-text-box"]) {
        textBoxSetting = true;
      }

      if (gameRules["take-a-shot"]) {
        const settingsButton = createUserButton("take-a-shot", "Take A Shot");
        selectPunishmentButtonContainer.appendChild(settingsButton);
      }


      // 2) Generic rules: iterate once over all keys
      Object.entries(gameRules).forEach(([ruleKey, value]) => {
        const isEnabled = value === true || value === "true";
        if (!isEnabled) return;

        if (ruleKey === "take-a-shot" || ruleKey === "truth-or-dare-text-box") return;

        if (/\d/.test(ruleKey)) return;

        AddGamemodeContainers(
          formatDashedString({
            input: ruleKey,
            seperator: '-',
            uppercase: false
          })
        );

        const settingsButton = createUserButton(
          ruleKey,
          formatDashedString({
            input: ruleKey,
          })
        );

        selectPunishmentButtonContainer.appendChild(settingsButton);
      });

      const selectPunishmentButtons = document
        .getElementById('select-punishment-container')
        .querySelectorAll('.selected-user-container .button-container button');

      selectPunishmentButtons.forEach(button => {
        button.addEventListener('click', () => {
          selectPunishmentButtons.forEach(btn => btn.classList.remove('active'));
          selectPunishmentContainer.setAttribute('select-id', button.getAttribute('id'));
          button.classList.add('active');
        });
      });
    }
    await LoadScript(`/scripts/party-games/gamemode/online/${cardContainerGamemode}/${cardContainerGamemode}-online-instructions.js`);

    const userInstructions = getUserInstructions(party);
    if (!gameRules["time-limit"]) {
      gameRules["time-limit"] = 120;
    }

    if (deviceId == hostDeviceId && userInstructions === "") {
      debugLog('[OE_DEBUG][truth-or-dare][initialisePage] host seeding initial instruction', {
        deviceId,
        hostDeviceId,
        userInstructions,
        phase: state?.phase ?? null,
        playerTurn: state?.playerTurn ?? null
      });
      await SendInstruction({
        instruction: "DISPLAY_SELECT_QUESTION_TYPE",
        updateUsersReady: false,
        updateUsersConfirmation: false,
        fetchInstruction: true,
        timer: Date.now() + gameRules["time-limit"] * 1000,
      });
    }
    
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

    debugLog('[OE_DEBUG][truth-or-dare][initialisePage] before FetchInstructions', {
      phase: currentPartyData?.state?.phase ?? currentPartyData?.phase ?? null,
      playerTurn: currentPartyData?.state?.playerTurn ?? currentPartyData?.playerTurn ?? null,
      instructions: getUserInstructions(currentPartyData)
    });
    await runOnlineFetchInstructions({ reason: 'setup' });

    try {
      if (typeof scoreboardContainer !== 'undefined' && scoreboardContainer) {
        SetPartyGameStatistics();
      }
    } catch (error) {
      console.warn('Truth or Dare statistics setup skipped during startup:', error);
    }
    await AddUserIcons();

    const firstPlayer = players[0];
    const firstId = firstPlayer.identity?.computerId || firstPlayer.computerId;
    const firstIcon = firstPlayer.identity?.userIcon || firstPlayer.userIcon;

    EditUserIconPartyGames({
      container: podiumThirdPlace,
      userId: firstId,
      userCustomisationString: firstIcon
    });
    SetScriptLoaded('/scripts/party-games/online/online-settings.js');
  } else {
    ShowPartyDoesNotExistState();
  }
}
