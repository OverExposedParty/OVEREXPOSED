// ----------------------
// URL + basic DOM setup
// ----------------------
const url = window.location.href;
const segments = url.split('/');
partyCode = segments.pop() || segments.pop(); // handle trailing slash

const gameContainerDualStack = document.querySelector('#dual-stack-view.card-container');
const buttonNextQuestion = document.getElementById('button-next-question');

const gameContainerPrivate = document.querySelector('#private-view.card-container');
const buttonChoosePlayer = document.getElementById('button-choose-player');

gameContainers.push(
  gameContainerPrivate,
  gameContainerDualStack,
);

let textBoxSetting = false;

// ----------------------
// Initialise page (data + UI bootstrapping)
// ----------------------
async function initialisePage() {
  const response = await fetch(`/api/${sessionPartyType}?partyCode=${partyCode}`);
  const data = await response.json();
  if (data.length === 0) {
    ShowPartyDoesNotExistState();
    return;
  }

  const party = data[0];
  const players = party.players || [];
  const config = getPartyConfig(party);
  const state = getPartyState(party);
  const deck = getPartyDeck(party);

  isPlaying = true;

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

  me.connection = me.connection || {};
  me.connection.socketId = socket.id;
  console.log("Socket ID set to: " + me.connection.socketId);

  joinParty(partyCode);

  if (state.isPlaying === true) {
    for (let i = 0; i < players.length; i++) {
      const p = players[i];
      const pId = getPlayerId(p);
      const pName = getPlayerUsername(p);

      if (pId && pId !== deviceId) {
        const userButton = createUserButton(pId, pName);
        selectUserButtonContainer.appendChild(userButton);
      }
    }

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

    const selectUserButtons = document
      .getElementById('select-user-container')
      .querySelectorAll('.selected-user-container .button-container button');
    const selectPunishmentButtons = document
      .getElementById('select-punishment-container')
      .querySelectorAll('.selected-user-container .button-container button');

    selectUserButtons.forEach(button => {
      button.addEventListener('click', () => {
        selectUserButtons.forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');
        selectUserButtonContainer.setAttribute('selected-id', button.getAttribute('id'));
      });
    });

    if (selectUserButtonContainer.children && selectUserButtonContainer.children.length > 4) {
      selectUserButtonContainer.classList.add('overflow');
    }

    selectPunishmentButtons.forEach(button => {
      button.addEventListener('click', () => {
        selectPunishmentButtons.forEach(btn => btn.classList.remove('active'));
        selectPunishmentContainer.setAttribute('select-id', button.getAttribute('id'));
        button.classList.add('active');
      });
    });

    await LoadScript(`/scripts/party-games/gamemode/online/${cardContainerGamemode}/${cardContainerGamemode}-online-instructions.js?30082025`);

    selectPunishmentTitle.textContent = "You've been selected";
    selectPunishmentText.textContent = "Select a punishment to find out the question";

    const instructions = getUserInstructions(party);
    if (!gameRules["time-limit"]) {
      gameRules["time-limit"] = 120;
    }
    if (deviceId === hostDeviceId && instructions === "") {
      await SendInstruction({
        instruction: "DISPLAY_PRIVATE_CARD:READING_CARD",
        updateUsersReady: false,
        updateUsersConfirmation: false,
        partyData: party,
        fetchInstruction: true,
        timer: Date.now() + gameRules["time-limit"] * 1000,
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
        deck,
        players
      });

      FetchInstructions();
    }

    SetPartyGameStatistics();
    await AddUserIcons();
    SetScriptLoaded('/scripts/party-games/online/online-settings.js');
    SetScriptLoaded('/scripts/party-games/gamemode/online/paranoia/paranoia-online.js?30082025');
  }
}


async function SetPageSettings() {
  wireEventListeners();

  AddTimerToContainer(waitingForPlayerContainer);
  AddTimerToContainer(gameContainerPrivate.querySelector('.main-image-container'));
  AddTimerToContainer(selectUserContainer);

  const existingData = await getExistingPartyData(partyCode);
  if (!existingData || existingData.length === 0) {
    console.warn('No party data found.');
    ShowPartyDoesNotExistState();
    return;
  }
  currentPartyData = existingData[0];

  const config = getPartyConfig(currentPartyData);
  const deck = getPartyDeck(currentPartyData);

  await loadJSONFiles(config.selectedPacks, config.shuffleSeed);

  const initialIndex = deck.currentCardIndex ?? currentPartyData.currentCardIndex ?? 0;
  selectedQuestionObj = getNextQuestion(initialIndex);

  await initialisePage();
}
