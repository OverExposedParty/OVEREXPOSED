const url = window.location.href;
const segments = url.split('/');
partyCode = segments.pop() || segments.pop(); // handle trailing slash

const resultsChartContainer = document.getElementById('results-container');

const gameContainerPrivate = document.querySelector('#private-view.card-container');
const buttonChooseOption = gameContainerPrivate.querySelector('#button-choose-option');

gameContainers.push(
  gameContainerPrivate,
  resultsChartContainer
);

async function initialisePage() {
  const response = await fetch(`/api/${sessionPartyType}?partyCode=${partyCode}`);
  const data = await response.json();

  if (!Array.isArray(data) || data.length === 0) return;

  const party = data[0];
  currentPartyData = party;

  const players = party.players || [];
  const config = getPartyConfig(party);
  const state = getPartyState(party);

  if (players.length === 0) {
    console.warn("No players in party.");
    return;
  }

  isPlaying = !!state.isPlaying;

  const index = players.findIndex(
    player => player.identity?.computerId === deviceId || player.computerId === deviceId
  );
  if (index === -1) {
    console.warn('Current device not found in players.');
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
      `/scripts/party-games/gamemode/online/${cardContainerGamemode}/${cardContainerGamemode}-online-instructions.js?30082025`
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
      FetchInstructions();
    }

    SetPartyGameStatistics();
    await AddUserIcons();
    SetScriptLoaded('/scripts/party-games/online/online-settings.js');
    SetScriptLoaded('/scripts/party-games/gamemode/online/would-you-rather/would-you-rather-online.js?30082025');
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
    // NEW SCHEMA: userInstructions is in config
    let parsedInstructions = parseInstruction(currentPartyData.config.userInstructions);

    if (parsedInstructions.instruction === "DISPLAY_PUNISHMENT_TO_USER") {
      // NEW SCHEMA: vote lives under player.state.vote
      const aVoteCount = currentPartyData.players.filter(
        player => player.state.vote === "A"
      ).length;

      const bVoteCount = currentPartyData.players.filter(
        player => player.state.vote === "B"
      ).length;

      const winningVote =
        aVoteCount === bVoteCount
          ? null
          : aVoteCount > bVoteCount
            ? "A"
            : "B";

      await SendInstruction({
        instruction: "RESET_QUESTION:" + winningVote
      });
    } else {
      await setUserBool(deviceId, true, true);
    }
  });

  AddTimerToContainer(selectOptionContainer);
  AddTimerToContainer(cardContainerPrivate.querySelector('.main-image-container'));
  AddTimerToContainer(waitingForPlayersContainer);
  AddTimerToContainer(resultsChartContainer);

  const existingData = await getExistingPartyData(partyCode);
  if (!existingData || existingData.length === 0) {
    console.warn('No party data found.');
    return;
  }
  currentPartyData = existingData[0];

  // NEW SCHEMA: selectedPacks + shuffleSeed in config
  await loadJSONFiles(
    currentPartyData.config.selectedPacks,
    currentPartyData.config.shuffleSeed
  );
  console.log("Loaded JSON files");
  await initialisePage();
}
