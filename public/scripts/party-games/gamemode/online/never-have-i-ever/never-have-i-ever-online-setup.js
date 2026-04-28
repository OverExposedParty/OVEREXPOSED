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
  debugLog("Loaded JSON files for synced config");
}

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

      await runOnlineFetchInstructions({ reason: 'setup' });
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
    const updatedParty = await performOnlinePartyAction({
      action: 'never-have-i-ever-complete-punishment',
      payload: {
        roundTimer: Date.now() + gameRules["time-limit"] * 1000,
        nextPlayer: true
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

  // 🔁 Use nested config (with legacy fallback)
  const config = getPartyConfig(currentPartyData);
  await ensureQuestionsLoadedForCurrentConfig(config);
  await initialisePage();
}
