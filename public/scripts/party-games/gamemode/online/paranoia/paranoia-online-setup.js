// ----------------------
// URL + basic DOM setup
// ----------------------
const gameContainerDualStack = document.querySelector('#dual-stack-view.card-container');
const buttonNextQuestion = document.getElementById('button-next-question');

const gameContainerPrivate = document.querySelector('#private-view.card-container');
const buttonChoosePlayer = document.getElementById('button-choose-player');

gameContainers.push(
  gameContainerPrivate,
  gameContainerDualStack,
);

let textBoxSetting = false;

function getParanoiaPunishmentChoiceButtons() {
  return Array.from(
    selectPunishmentButtonContainer?.querySelectorAll('button') || []
  );
}

function getParanoiaSelectablePunishmentButtons() {
  return getParanoiaPunishmentChoiceButtons().filter(
    button => button.getAttribute('id') !== 'pass'
  );
}

function getParanoiaCurrentParticipants(partyData = currentPartyData) {
  return typeof getRoundLateJoinParticipants === 'function'
    ? getRoundLateJoinParticipants(partyData)
    : partyData?.players || [];
}

function renderParanoiaTargetButtons(partyData = currentPartyData) {
  if (!selectUserButtonContainer || !partyData) return;

  const participants = getParanoiaCurrentParticipants(partyData);
  selectUserButtonContainer.replaceChildren();
  selectUserButtonContainer.setAttribute('selected-id', '');

  participants.forEach((player) => {
    const pId = getPlayerId(player);
    const pName = getPlayerUsername(player);

    if (!pId || pId === deviceId) return;

    const userButton = createUserButton(pId, pName);
    userButton.addEventListener('click', () => {
      selectUserButtonContainer
        .querySelectorAll('button')
        .forEach(btn => btn.classList.remove('active'));
      userButton.classList.add('active');
      selectUserButtonContainer.setAttribute('selected-id', pId);
    });
    selectUserButtonContainer.appendChild(userButton);
  });

  selectUserButtonContainer.classList.toggle(
    'overflow',
    selectUserButtonContainer.children.length > 4
  );
}

// ----------------------
// Initialise page (data + UI bootstrapping)
// ----------------------
async function initialisePage() {
  const session = await bootstrapOnlineGamePage({
    requirePlaying: true
  });
  if (!session) {
    return;
  }
  const { party, players, config, state, deck } = session;

  debugLog("hostDeviceId:", hostDeviceId);

  if (state.isPlaying === true) {
    renderParanoiaTargetButtons(party);

    gameRules = config.gameRules || {};
    const gm = config.gamemode || party.gamemode;

    if (gameRules["take-a-shot"]) {
      const settingsButton = createUserButton("take-a-shot", "Take A Shot");
      selectPunishmentButtonContainer.appendChild(settingsButton);
    }

    Object.entries(gameRules).forEach(([ruleKey, value]) => {
      const isEnabled = value === true || value === "true";
      if (!isEnabled) return;

      if (ruleKey === "take-a-shot") return;

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

    if (!selectPunishmentButtonContainer.querySelector('#pass')) {
      selectPunishmentButtonContainer.appendChild(createUserButton("pass", "Pass"));
    }

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

    const instructionsBasePath =
      `/scripts/party-games/gamemode/online/${cardContainerGamemode}`;
    const instructionsCacheBustKey = 'PARTY_GAMES_ONLINE_PARANOIA';

    await LoadScript(
      `${instructionsBasePath}/paranoia-online-instructions/phase-tools.js`,
      { cacheBustKey: instructionsCacheBustKey }
    );
    await LoadScript(
      `${instructionsBasePath}/paranoia-online-instructions/question-flow.js`,
      { cacheBustKey: instructionsCacheBustKey }
    );
    await LoadScript(
      `${instructionsBasePath}/paranoia-online-instructions/punishment-flow.js`,
      { cacheBustKey: instructionsCacheBustKey }
    );
    await LoadScript(
      `${instructionsBasePath}/paranoia-online-instructions/round-actions.js`,
      { cacheBustKey: instructionsCacheBustKey }
    );
    await LoadScript(
      `${instructionsBasePath}/${cardContainerGamemode}-online-instructions.js`,
      { cacheBustKey: instructionsCacheBustKey }
    );

    selectPunishmentTitle.textContent = "SELECT A PUNISHMENT";
    selectPunishmentText.textContent = "Pick a forfeit to reveal the secret question.";

    const instructions = getUserInstructions(party);
    if (!gameRules["time-limit"]) {
      gameRules["time-limit"] = 120;
    }
    if (deviceId === hostDeviceId && instructions === "") {
      await SendInstruction({
        instruction: "DISPLAY_PRIVATE_CARD:READING_CARD",
        updateUsersReady: false,
        updateUsersConfirmation: false,
        fetchInstruction: true,
        timer: Date.now() + gameRules["time-limit"] * 1000,
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

    SetPartyGameStatistics();
    await AddUserIcons();
    SetScriptLoaded('/scripts/party-games/online/online-settings.js');
  }
}


async function SetPageSettings() {
  if (!(await registerRoundLateJoinIfRequested())) return;

  wireEventListeners();

  AddTimerToContainer(waitingForPlayerContainer);
  AddTimerToContainer(waitingForPlayersContainer);
  AddTimerToContainer(selectUserContainer);
  AddTimerToContainer(selectPunishmentContainer);
  AddTimerToContainer(pickHeadsOrTailsContainer);
  AddTimerToContainer(completePunishmentContainer);
  AddTimerToContainer(confirmPunishmentContainer);

  const initialPartyData = await waitForOnlinePartySnapshot({
    requirePlayer: true,
    requirePlaying: true,
    requireSelectedPacks: true
  });
  if (!initialPartyData) {
    console.warn('No party data found.');
    ShowPartyDoesNotExistState();
    return;
  }
  currentPartyData = initialPartyData;

  const config = getPartyConfig(currentPartyData);
  const deck = getPartyDeck(currentPartyData);

  const questionsLoaded = await loadJSONFiles(
    config.selectedPacks,
    config.shuffleSeed
  );
  if (!questionsLoaded) return;

  const initialIndex = deck.currentCardIndex ?? currentPartyData.currentCardIndex ?? 0;
  selectedQuestionObj = getNextQuestion(initialIndex);

  await initialisePage();
}
