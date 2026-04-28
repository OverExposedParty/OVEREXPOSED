const civilianRoles = ["civilian", "mayor"];
const mafiosoRoles = ["mafioso", "godfather"];
const neutralRoles = ["lawyer", "serial killer"];

async function SetPageSettings() {
  selectUserDayPhaseConfirmButton.addEventListener('click', async () => {
    if (selectUserDayPhaseContainer.getAttribute('selected-id') != "") {
      await SetVote({
        option: selectUserDayPhaseContainer.getAttribute('selected-id')
      });

      const selectUserVoteDayPlayerButtons = selectUserDayPhaseContainer.querySelectorAll('.selected-user-container .button-container button');
      selectUserVoteDayPlayerButtons.forEach(btn => btn.classList.remove('active'));
      selectUserDayPhaseContainer.setAttribute('selected-id', "");
    }
  });

  selectUserNightPhaseConfirmButton.addEventListener('click', async () => {
    if (selectUserNightPhaseContainer.getAttribute('selected-id') != "") {
      await SetVote({
        option: selectUserNightPhaseContainer.getAttribute('selected-id')
      });
      const selectUserVoteNightPlayerButtons = selectUserNightPhaseContainer.querySelectorAll('.selected-user-container .button-container button');
      selectUserVoteNightPlayerButtons.forEach(btn => btn.classList.remove('active'));
      selectUserNightPhaseContainer.setAttribute('selected-id', "");
    }
  });

  AddTimerToContainer(waitingForPlayersContainer);
  AddTimerToContainer(displayRoleContainer);
  AddTimerToContainer(selectUserDayPhaseContainer);
  AddTimerToContainer(selectUserNightPhaseContainer);
  AddTimerToContainer(selectCivilianWatchContainer);
  AddTimerToContainer(displayCivilianWatchResponseContainer);
  AddTimerToContainer(displayTownVoteContainer);
  AddTimerToContainer(displayPlayerKilledContainer);

  const initialPartyData = await waitForOnlinePartySnapshot({
    requirePlayer: true,
    requirePlaying: true
  });
  if (!initialPartyData) {
    console.warn('No party data found.');
    ShowPartyDoesNotExistState();
    return;
  }
  // existingData[0] should already match new schema
  currentPartyData = initialPartyData;

  debugLog("initialisePage");
  await initialisePage();
}

async function initialisePage() {
  const session = await bootstrapOnlineGamePage({
    requirePlaying: true
  });
  if (!session) {
    return;
  }
  const { party, players, config, state, me } = session;
  debugLog("Socket ID set to: " + (me.connection?.socketId ?? me.socketId));

  if (state.isPlaying === true) {
    // gameRules: new object format (like other modes)
    const rawGameRules = config.gameRules || {};
    const rulesObj =
      rawGameRules instanceof Map ? Object.fromEntries(rawGameRules) : rawGameRules;

    gameRules = rulesObj;                    // expose globally if needed elsewhere
    partyRulesSettings = Object.keys(rulesObj); // if other code still uses this

    // Build day/night vote buttons
    players.forEach(player => {
      const pState         = getPlayerState(player);
      const isAlive        = pState.status === "alive";
      const playerDeviceId = getPlayerId(player);
      const playerName     = getPlayerUsername(player);
      const playerRole     = pState.role;

      // DAY: all alive players
      if (isAlive) {
        const userButton = createVoteButton(playerDeviceId, playerName, "day");
        selectUserDayPhaseButtonContainer.appendChild(userButton);
      }

      // NIGHT: other alive civilians
      if (
        playerDeviceId !== deviceId &&
        isAlive &&
        civilianRoles.includes(playerRole)
      ) {
        const userButton = createVoteButton(playerDeviceId, playerName, "night");
        selectUserNightPhaseButtonContainer.appendChild(userButton);
      }
    });

    wireUpVoteButtons();
    renderPlayers(players, "PLAYER BOARD");

    SetPlayerBoardButton({
      userCustomisationString: me.identity?.userIcon,
      userId: getPlayerId(me)
    });

    if (selectUserNightPhaseButtonContainer.querySelectorAll('button').length > 4) {
      selectUserNightPhaseContainer.classList.add('overflow');
    }

    await LoadScript(
      `/scripts/party-games/gamemode/online/${placeHolderSelectedUser.dataset.template}/${placeHolderSelectedUser.dataset.template}-online-instructions.js`
    );
    await LoadScript("/scripts/party-games/gamemode/online/mafia/mafia-dialogue.js");
    await LoadScript("/scripts/party-games/gamemode/online/mafia/mafia-civilian-watch.js");

    const instructions = getUserInstructions(party);

    if (deviceId === hostDeviceId && instructions === "") {
      const roles         = await GetRoles(players.length);
      const shuffledRoles = getShuffledRoles(roles);

      const updatedParty = await performOnlinePartyAction({
        action: 'mafia-start-game',
        payload: {
          shuffledRoles,
          timer: new Date(Date.now() + mafiaDisplayRoleTimer)
        }
      });

      if (updatedParty) {
        currentPartyData = updatedParty;
      }
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

    await AddUserIcons();
    SetScriptLoaded('/scripts/party-games/online/online-settings.js');
  }
}



async function FetchInstructions() {
  currentPartyData = await GetCurrentPartyData();

  if (!currentPartyData) {
    PartyDisbanded();
    return;
  }

  const instructions = currentPartyData.config && currentPartyData.config.userInstructions
    ? currentPartyData.config.userInstructions
    : "";
  renderPlayers(currentPartyData.players, "Player Board");
  if (!instructions) return;

   if (instructions.includes("DISPLAY_ROLE")) {
    DisplayRole();
  }
  else if (instructions.includes("DISPLAY_NIGHT_PHASE")) {
    if (instructions.includes("PART_TWO")) {
      DisplayNightPhasePartTwo();
    }
    else {
      DisplayNightPhase();
    }
  }
  else if (instructions.includes("DISPLAY_PLAYER_KILLED")) {
    if (instructions.includes("PART_TWO")) {
      DisplayPlayerKilledPartTwo(instructions);
    }
    else {
      DisplayPlayerKilled(instructions);
    }
  }
  else if (instructions.includes("DISPLAY_DAY_PHASE_DISCUSSION")) {
    DisplayDayPhaseDiscussion();
  }
  else if (instructions.includes("DISPLAY_DAY_PHASE_VOTE")) {
    if (instructions.includes("PART_TWO")) {
      DisplayDayPhaseVotePartTwo();
    }
    else {
      DisplayDayPhaseVote();
    }
  }
  else if (instructions.includes("DISPLAY_TOWN_VOTE")) {
    if (instructions.includes("PART_TWO")) {
      DisplayTownVotePartTwo();
    }
    else {
      DisplayTownVote(instructions);
    }
  }
  else if (instructions.includes("DISPLAY_GAMEOVER")) {
    DisplayGameOver(instructions);
  }
}
