const url = window.location.href;
const segments = url.split('/');
partyCode = segments.pop() || segments.pop(); // handle trailing slash

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
  selectPunishmentConfirmPunishmentButton.addEventListener('click', async () => {
    if (selectPunishmentContainer.getAttribute('select-id')) {
      selectPunishmentContainer.classList.remove('active');
      if (selectPunishmentContainer.getAttribute('select-id') == 'drink-wheel') {
        await SendInstruction({
          instruction: `CHOSE_PUNISHMENT:${formatDashedString({
            input: selectPunishmentContainer.getAttribute('select-id'),
            seperator: '_'
          }).toUpperCase()}:` + deviceId,
          byPassHost: true
        });
      }
      else if (selectPunishmentContainer.getAttribute('select-id') == 'take-a-shot') {
        completePunishmentContainer.setAttribute("punishment-type", "take-a-shot")
        await SendInstruction({
          instruction: "CHOSE_PUNISHMENT:TAKE_A_SHOT:" + deviceId,
          byPassHost: true
        });
      }
      const selectPunishmentButtons = document.getElementById('select-punishment-container').querySelectorAll('.selected-user-container .button-container button');
      selectPunishmentButtons.forEach(button => {
        button.classList.remove('active');
      });
      selectPunishmentContainer.setAttribute('select-id', "");
    }
  });

  completePunishmentButtonConfirm.addEventListener('click', async () => {
    await ResetTruthOrDareQuestion({ force: true, nextPlayer: true });
  });

  selectQuestionTypeButtonTruth.addEventListener('click', async () => {
    // deck.currentCardIndex++, deck.questionType = "truth"
    currentPartyData.deck = currentPartyData.deck || {};
    currentPartyData.deck.currentCardIndex = (currentPartyData.deck.currentCardIndex ?? 0) + 1;
    currentPartyData.deck.questionType = "truth";

    await SendInstruction({
      partyData: currentPartyData,
      instruction: "DISPLAY_PUBLIC_CARD",
      updateUsersReady: false,
      updateUsersConfirmation: false,
      timer: Date.now() + gameRules["time-limit"] * 1000,
      byPassHost: true
    });
  });

  selectQuestionTypeButtonDare.addEventListener('click', async () => {
    currentPartyData.deck = currentPartyData.deck || {};
    currentPartyData.deck.currentCardSecondIndex = (currentPartyData.deck.currentCardSecondIndex ?? 0) + 1;
    currentPartyData.deck.questionType = "dare";

    await SendInstruction({
      partyData: currentPartyData,
      instruction: "DISPLAY_PUBLIC_CARD",
      updateUsersReady: false,
      updateUsersConfirmation: false,
      timer: Date.now() + gameRules["time-limit"] * 1000,
      byPassHost: true
    });
  });

  gameContainerPublicButtonPass.addEventListener('click', async () => {
    if (selectPunishmentButtonContainer.childElementCount == 0) {
      await SendInstruction({
        instruction: "RESET_QUESTION",
        byPassHost: true
      });
      return;
    }
    else {
      await SendInstruction({
        instruction: "CHOOSING_PUNISHMENT",
        byPassHost: true
      });
    }
  });

  gameContainerPublicButtonAnswer.addEventListener('click', async () => {
    if (textBoxSetting == false) {
      await SendInstruction({
        instruction: "DISPLAY_COMPLETE_QUESTION",
        byPassHost: true
      });
    }
    else {
      await SendInstruction({
        instruction: "DISPLAY_CONFIRM_INPUT",
        byPassHost: true
      });
    }
  });

  answerQuestionSubmitButton.addEventListener('click', async () => {
    await SendInstruction({
      instruction: "DISPLAY_ANSWER_CARD:" + answerQuestionAnswer.value,
      byPassHost: true
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
  AddTimerToContainer(cardContainerPublic.querySelector('.main-image-container'));
  AddTimerToContainer(selectPunishmentContainer);

  console.log(cardContainerPublic);
  console.log(cardContainerPublic.querySelector('.main-image-container'));

  const existingData = await getExistingPartyData(partyCode);
  if (!existingData || existingData.length === 0) {
    console.warn('No party data found.');
    return;
  }
  currentPartyData = existingData[0];

  // Use config for selectedPacks & shuffleSeed (fallback to flat for legacy)
  const config = currentPartyData.config ?? currentPartyData;
  await loadJSONFiles(config.selectedPacks, config.shuffleSeed);
  console.log("initialisePage");
  await initialisePage();
}

async function initialisePage() {
  const response = await fetch(`/api/${sessionPartyType}?partyCode=${partyCode}`);
  const data = await response.json();
  if (data.length > 0) {
    const party = data[0];

    const players = party.players || [];
    const config = party.config ?? party;
    const state = party.state ?? party;
    const deck = party.deck ?? party;

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

    // Ensure connection exists
    me.connection = me.connection || {};
    me.connection.socketId = socket.id;

    joinParty(partyCode);

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
    await LoadScript(`/scripts/party-games/gamemode/online/${cardContainerGamemode}/${cardContainerGamemode}-online-instructions.js?30082025`);

    const userInstructions = config.userInstructions;
    if (!gameRules["time-limit"]) {
      gameRules["time-limit"] = 120;
    }

    if (deviceId == hostDeviceId && userInstructions === "") {
      await SendInstruction({
        instruction: "DISPLAY_SELECT_QUESTION_TYPE",
        updateUsersReady: false,
        updateUsersConfirmation: false,
        partyData: party,
        timer: Date.now() + gameRules["time-limit"] * 1000,
      });
    }
    else {
      const updatedState = {
        ...state,
        lastPinged: Date.now()
      };

      await updateOnlineParty({
        partyId: partyCode,
        config,
        state: updatedState,
        deck,
        players
      });
    }

    SetPartyGameStatistics();
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
    SetScriptLoaded('/scripts/party-games/gamemode/online/truth-or-dare/truth-or-dare-online.js?30082025');
  }
}