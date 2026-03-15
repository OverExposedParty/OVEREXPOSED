const url = window.location.href;
const segments = url.split('/');
partyCode = segments.pop() || segments.pop();

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

  const existingData = await getExistingPartyData(partyCode);
  if (!existingData || existingData.length === 0) {
    console.warn('No party data found.');
    ShowPartyDoesNotExistState();
    return;
  }
  // existingData[0] should already match new schema
  currentPartyData = existingData[0];

  console.log("initialisePage");
  await initialisePage();
}

async function initialisePage() {
  const response = await fetch(`/api/${sessionPartyType}?partyCode=${partyCode}`);
  const data = await response.json();
  if (!Array.isArray(data) || data.length === 0) {
    ShowPartyDoesNotExistState();
    return;
  }

  const party   = data[0];
  const players = party.players || [];
  const config  = getPartyConfig(party);
  const state   = getPartyState(party);

  if (players.length === 0) {
    console.warn("No players in party.");
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

  const myConnectionSocket = me.connection?.socketId ?? me.socketId;
  if (myConnectionSocket === "DISCONNECTED") {
    sendPartyChat({
      username: "[CONSOLE]",
      message: `${onlineUsername} has reconnected.`,
      eventType: "connect"
    });
  }

  joinParty(partyCode);

  const meConn = ensureConnection(me);
  meConn.socketId = socket.id;
  console.log("Socket ID set to: " + meConn.socketId);

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
      `/scripts/party-games/gamemode/online/${placeHolderSelectedUser.dataset.template}/${placeHolderSelectedUser.dataset.template}-online-instructions.js?30082025`
    );
    await LoadScript("/scripts/party-games/gamemode/online/mafia/mafia-dialogue.js");
    await LoadScript("/scripts/party-games/gamemode/online/mafia/mafia-civilian-watch.js");

    const instructions = getUserInstructions(party);

    if (deviceId === hostDeviceId && instructions === "") {
      const roles         = await GetRoles(players.length);
      const shuffledRoles = getShuffledRoles(roles);

      players.forEach((player, i) => {
        const pState = getPlayerState(player);
        pState.role  = shuffledRoles[i] || null;
      });

      const resetPlayers = ResetVotes(players);

      const newState = {
        ...state,
        phase: "night"
      };

      currentPartyData = {
        ...party,
        config,
        state: newState,
        players: resetPlayers
      };

      await SendInstruction({
        instruction: "DISPLAY_ROLE",
        updateUsersReady: false,
        updateUsersConfirmation: false,
        partyData: party,
        timer: new Date(Date.now() + mafiaDisplayRoleTimer)
      });
    } else {
      const updatedState = {
        ...state,
        lastPinged: new Date()
      };

      currentPartyData = {
        ...party,
        config,
        state: updatedState,
        players
      };

      await updateOnlineParty({
        partyId: partyCode,
        config,
        state: updatedState,
        players
      });
    }

    await AddUserIcons();
    SetScriptLoaded('/scripts/party-games/online/online-settings.js');
    SetScriptLoaded('/scripts/party-games/gamemode/online/mafia/mafia-online.js?30082025');
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
