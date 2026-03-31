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

let loadedQuestionConfigSignature = null;

function getQuestionConfigSignature(config = {}) {
  const selectedPacks = Array.isArray(config.selectedPacks) ? [...config.selectedPacks].sort() : [];
  const shuffleSeed = config.shuffleSeed ?? null;
  return JSON.stringify({ selectedPacks, shuffleSeed });
}

async function ensureQuestionsLoadedForCurrentConfig(config = {}) {
  const nextSignature = getQuestionConfigSignature(config);

  if (loadedQuestionConfigSignature === nextSignature) {
    return;
  }

  await loadJSONFiles(config.selectedPacks, config.shuffleSeed);
  loadedQuestionConfigSignature = nextSignature;
  console.log("Loaded JSON files for synced config");
}

async function initialisePage() {
  const party = await waitForOnlinePartySnapshot({
    requirePlayer: true,
    requirePlaying: true
  });
  if (!party) {
    ShowPartyDoesNotExistState();
    return;
  }
  currentPartyData = party;

  const players = party.players || [];
  const config = getPartyConfig(party);
  const state = getPartyState(party);

  if (players.length === 0) {
    console.warn('No players in party.');
    return;
  }

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

  const meConn = ensureConnection(me);
  meConn.socketId = socket.id;
  me.socketId = socket.id;

  await joinParty(partyCode);

  if (state.isPlaying === true) {
    const rawGameRules = config.gameRules || {};
    gameRules =
      rawGameRules instanceof Map ? Object.fromEntries(rawGameRules) : rawGameRules;

    const gm = config.gamemode || party.gamemode;

    Object.entries(gameRules).forEach(([ruleKey, value]) => {
      const isEnabled = value === true || value === "true";
      if (!isEnabled) return;

      if (ruleKey === "take-a-sip") return;

      if (/\d/.test(ruleKey)) return;

      AddGamemodeContainers(
        formatDashedString({
          input: ruleKey,
          gamemode: gm,
          seperator: '-',
          uppercase: false
        })
      );
    });

    await LoadScript(
      `/scripts/party-games/gamemode/online/${cardContainerGamemode}/${cardContainerGamemode}-online-instructions.js`,
      { cacheBustKey: "PARTY_GAMES_ONLINE_NEVER_HAVE_I_EVER" }
    );

    const instructions = getUserInstructions(party);
    if (!gameRules["time-limit"]) {
      gameRules["time-limit"] = 120;
    }
    if (deviceId == hostDeviceId && instructions === "") {
      await SendInstruction({
        instruction: "DISPLAY_PRIVATE_CARD",
        updateUsersReady: false,
        updateUsersConfirmation: false,
        partyData: party,
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

      await ensureQuestionsLoadedForCurrentConfig(getPartyConfig(currentPartyData));

      await FetchInstructions();
    }

    SetPartyGameStatistics();
    await AddUserIcons();
    SetScriptLoaded('/scripts/party-games/online/online-settings.js');
  }
}


async function SetPageSettings() {
  buttonChooseOption.addEventListener('click', async () => {
    // setUserBool already refactored to use nested player.state
    await setUserBool(deviceId, null, true);
  });

  selectOptionConfirmButtonYes.addEventListener('click', async () => {
    await SetVote({ option: true });
  });

  selectOptionConfirmButtonNo.addEventListener('click', async () => {
    await SetVote({ option: false });
  });

  completePunishmentButtonConfirm.addEventListener('click', async () => {
    const instructions = getUserInstructions(currentPartyData);
    const parsedInstructions = parseInstruction(instructions);

    if (parsedInstructions.instruction.includes("DISPLAY_PUNISHMENT_TO_USER")) {
      await SendInstruction({
        instruction: "RESET_QUESTION",
        timer: Date.now() + gameRules["time-limit"] * 1000,
        byPassHost: true
      });
    } else {
      await setUserBool(deviceId, true, true);
    }
  });

  AddTimerToContainer(gameContainerPrivate.querySelector('.main-image-container'));
  AddTimerToContainer(selectOptionContainer);
  AddTimerToContainer(waitingForPlayersContainer);
  AddTimerToContainer(resultsChartContainer);

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

  // 🔁 Use nested config (with legacy fallback)
  const config = getPartyConfig(currentPartyData);
  await ensureQuestionsLoadedForCurrentConfig(config);
  await initialisePage();
}
