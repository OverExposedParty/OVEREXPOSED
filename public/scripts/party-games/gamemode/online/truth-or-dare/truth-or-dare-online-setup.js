const gameContainerPublic = document.querySelector('#public-view.card-container');
const gameContainerPublicButtonContainer = gameContainerPublic.querySelector('.regular-button-container');
const gameContainerPublicWaitingText = gameContainerPublicButtonContainer.querySelector('h2');
const gameContainerPublicButtonAnswer = gameContainerPublicButtonContainer.querySelector('#answer');
const gameContainerPublicButtonPass = gameContainerPublicButtonContainer.querySelector("#pass");

gameContainers.push(
  gameContainerPublic
);

async function registerTruthOrDareLateJoinIfRequested() {
  const url = new URL(window.location.href);
  const lateJoinStorageKey = `oe-late-join:${partyCode}`;
  const lateJoinRequested =
    url.searchParams.get('lateJoin') === '1' ||
    sessionStorage.getItem(lateJoinStorageKey) === '1';
  if (!lateJoinRequested) return true;

  const response = await fetch(
    `/api/waiting-room?partyCode=${encodeURIComponent(partyCode)}`
  );
  const waitingRoomData = response.ok ? await response.json() : [];
  const party = Array.isArray(waitingRoomData) ? waitingRoomData[0] : null;
  if (!party) return false;

  const players = party.players || [];
  const existingPlayer = players.find(
    (player) => getPlayerId(player) === deviceId
  );

  if (!existingPlayer) {
    const resolvedUsername = await resolveOnlineUsername(players);
    await addUserToParty({
      partyId: partyCode,
      newComputerId: deviceId,
      newUsername: resolvedUsername,
      newUserIcon: getStoredUserIconString(),
      newUserSocketId: socket.id
    });
  }

  url.searchParams.delete('lateJoin');
  sessionStorage.removeItem(lateJoinStorageKey);
  window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
  return true;
}

function getPromptHeistTimeLimit() {
  return Number(
    gameRules?.["prompt-heist-game-rule-time-limit"] ||
    gameRules?.["truth-or-dare-prompt-heist-game-rule-time-limit"] ||
    10
  );
}

async function syncTruthOrDareActionAndRender(updatedParty) {
  if (updatedParty) {
    stopTruthOrDareTimerWarning();
  }

  return syncTruthOrDarePartyAndRender(updatedParty);
}

async function passTruthOrDarePrompt() {
  const updatedParty = await performOnlinePartyAction({
    action: 'truth-or-dare-pass-question',
    payload: {
      heistTimer: Date.now() + getPromptHeistTimeLimit() * 1000,
      phaseTimer: Date.now() + gameRules["time-limit"] * 1000,
      roundTimer: Date.now() + gameRules["time-limit"] * 1000
    }
  });

  await syncTruthOrDareActionAndRender(updatedParty);
}

async function SetPageSettings() {
  if (!(await registerTruthOrDareLateJoinIfRequested())) return;

  selectPunishmentText.textContent = "YOU CHOSE TO PASS. PICK A FORFEIT.";

  selectPunishmentConfirmPunishmentButton.addEventListener('click', async () => {
    const selectedPunishmentId = selectPunishmentContainer.getAttribute('select-id');
    if (selectedPunishmentId) {
      hideContainer(selectPunishmentContainer);
      if (selectedPunishmentId === 'pass') {
        const updatedParty = await performOnlinePartyAction({
          action: 'truth-or-dare-handle-punishment-timeout',
          payload: {
            roundTimer: Date.now() + gameRules["time-limit"] * 1000
          }
        });

        await syncTruthOrDareActionAndRender(updatedParty);
        return;
      }

      const punishmentType = selectedPunishmentId == 'drink-wheel'
        ? 'DRINK_WHEEL'
        : selectedPunishmentId == 'take-a-shot'
          ? 'TAKE_A_SHOT'
          : formatDashedString({
              input: selectedPunishmentId,
              seperator: '_'
            }).toUpperCase();

      const updatedParty = await performOnlinePartyAction({
        action: 'truth-or-dare-select-punishment',
        payload: {
          punishmentType,
          phaseTimer: Date.now() + gameRules["time-limit"] * 1000
        }
      });

      await syncTruthOrDareActionAndRender(updatedParty);
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

    await syncTruthOrDareActionAndRender(updatedParty);
  });

  completePunishmentButtonPass.addEventListener('click', async () => {
    const updatedParty = await performOnlinePartyAction({
      action: 'truth-or-dare-handle-punishment-timeout',
      payload: {
        roundTimer: Date.now() + gameRules["time-limit"] * 1000
      }
    });

    await syncTruthOrDareActionAndRender(updatedParty);
  });

  selectQuestionTypeButtonTruth.addEventListener('click', async () => {
    const updatedParty = await performOnlinePartyAction({
      action: 'truth-or-dare-select-question-type',
      payload: {
        questionType: 'truth',
        timer: Date.now() + gameRules["time-limit"] * 1000
      }
    });

    await syncTruthOrDareActionAndRender(updatedParty);
  });

  selectQuestionTypeButtonDare.addEventListener('click', async () => {
    const updatedParty = await performOnlinePartyAction({
      action: 'truth-or-dare-select-question-type',
      payload: {
        questionType: 'dare',
        timer: Date.now() + gameRules["time-limit"] * 1000
      }
    });

    await syncTruthOrDareActionAndRender(updatedParty);
  });

  gameContainerPublicButtonPass.addEventListener('click', async () => {
    await passTruthOrDarePrompt();
  });

  promptHeistClaimButton.addEventListener('click', async () => {
    const updatedParty = await performOnlinePartyAction({
      action: 'truth-or-dare-claim-prompt-heist',
      payload: {
        timer: Date.now() + gameRules["time-limit"] * 1000
      }
    });

    await syncTruthOrDareActionAndRender(updatedParty);
  });

  gameContainerPublicButtonAnswer.addEventListener('click', async () => {
    const updatedParty = await performOnlinePartyAction({
      action: 'truth-or-dare-start-prompt'
    });

    await syncTruthOrDareActionAndRender(updatedParty);
  });

  completePromptCompleted.addEventListener('click', async () => {
    await ResetTruthOrDareQuestion({ force: true, nextPlayer: true, incrementScore: 1 });
  });

  AddTimerToContainer(waitingForPlayerContainer);
  AddTimerToContainer(selectUserContainer);
  AddTimerToContainer(selectQuestionTypeContainer);
  AddTimerToContainer(selectPunishmentContainer);
  AddTimerToContainer(completePunishmentContainer);
  AddTimerToContainer(promptHeistContainer);

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

      if (gameRules["take-a-shot"]) {
        const settingsButton = createUserButton("take-a-shot", "Take A Shot");
        selectPunishmentButtonContainer.appendChild(settingsButton);
      }


      // 2) Generic rules: iterate once over all keys
      Object.entries(gameRules).forEach(([ruleKey, value]) => {
        const isEnabled = value === true || value === "true";
        if (!isEnabled) return;

        // Historical parties can still contain the retired text-box rule.
        if (
          ruleKey === "take-a-shot" ||
          ruleKey === "truth-or-dare-text-box" ||
          ruleKey === "prompt-heist" ||
          ruleKey === "truth-or-dare-prompt-heist" ||
          ruleKey === "prompt-heist-game-rule-time-limit" ||
          ruleKey === "truth-or-dare-prompt-heist-game-rule-time-limit"
        ) return;

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

      selectPunishmentButtonContainer.appendChild(createUserButton("pass", "Pass"));

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
    const instructionsBasePath =
      `/scripts/party-games/gamemode/online/${cardContainerGamemode}`;
    const instructionsCacheBustKey = 'PARTY_GAMES_ONLINE_TRUTH_OR_DARE';

    await LoadScript(
      `${instructionsBasePath}/truth-or-dare-online-instructions/phase-tools.js`,
      { cacheBustKey: instructionsCacheBustKey }
    );
    await LoadScript(
      `${instructionsBasePath}/truth-or-dare-online-instructions/prompt-flow.js`,
      { cacheBustKey: instructionsCacheBustKey }
    );
    await LoadScript(
      `${instructionsBasePath}/truth-or-dare-online-instructions/punishment-flow.js`,
      { cacheBustKey: instructionsCacheBustKey }
    );
    await LoadScript(
      `${instructionsBasePath}/truth-or-dare-online-instructions/answer-flow.js`,
      { cacheBustKey: instructionsCacheBustKey }
    );
    await LoadScript(
      `${instructionsBasePath}/truth-or-dare-online-instructions/round-actions.js`,
      { cacheBustKey: instructionsCacheBustKey }
    );
    await LoadScript(
      `${instructionsBasePath}/${cardContainerGamemode}-online-instructions.js`,
      { cacheBustKey: instructionsCacheBustKey }
    );

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
    SetScriptLoaded('/scripts/party-games/online/online-settings.js');
  } else {
    ShowPartyDoesNotExistState();
  }
}
