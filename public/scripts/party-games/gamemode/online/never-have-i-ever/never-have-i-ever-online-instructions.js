async function DisplayPrivateCard(instruction) {
  await ensureQuestionsLoadedForCurrentConfig(getPartyConfig(currentPartyData));

  const state = getPartyState(currentPartyData);
  const deck  = currentPartyData.deck ?? currentPartyData;

  const timerValue = state.timer ?? currentPartyData.timer ?? Date.now();
  const delay = new Date(timerValue) - Date.now();
  const durationSeconds = getTimeLimit();

  startTimerFromContainer({
    container: gameContainerPrivate,
    timeLeft: delay / 1000,
    duration: durationSeconds
  });
  startTimer({
    timeLeft: delay / 1000,
    duration: durationSeconds,
    selectedTimer: selectOptionContainer.querySelector('.timer-wrapper')
  });
  startTimer({
    timeLeft: delay / 1000,
    duration: durationSeconds,
    selectedTimer: waitingForPlayersContainer.querySelector('.timer-wrapper')
  });

  SetTimeOut({
    delay,
    instruction: "DISPLAY_VOTE_RESULTS",
    nextDelay: resultTimerDuration,
    newUserConfirmed: false,
    newUserReady: false
  });

  const players = currentPartyData.players || [];
  const myIndex = players.findIndex(p => getPlayerId(p) === deviceId);

  if (myIndex === -1) {
    console.warn("Device not found in players.");
    return;
  }

  const me = players[myIndex];
  const meState = me.state ?? me;

  const cardIndex = deck.currentCardIndex ?? currentPartyData.currentCardIndex ?? 0;
  selectedQuestionObj = getNextQuestion(cardIndex);

  selectOptionQuestionText.textContent =
    selectedQuestionObj.question.replace("Never have I ever ", "");
  DisplayCard(gameContainerPrivate, selectedQuestionObj);

  const isReady = meState.isReady ?? me.isReady;
  const hasConfirmed = meState.hasConfirmed ?? me.hasConfirmed;

  if (!isReady && !hasConfirmed) {
    setActiveContainers(gameContainerPrivate);
  } else if (isReady && !hasConfirmed) {
    setActiveContainers(selectOptionContainer);
  } else {
    const allConfirmed = players.every(p => {
      const ps = p.state ?? p;
      return ps.hasConfirmed === true;
    });

    if (allConfirmed) {
        await SendInstruction({
          instruction: "DISPLAY_VOTE_RESULTS",
          timer: Date.now() + resultTimerDuration,
          updateUsersConfirmation: false,
          updateUsersReady: false
        });
    } else {
      if (hasConfirmed) {
        DisplayWaitingForPlayers();
      }
    }
  }
}

async function DisplayVoteResults() {
  const state = getPartyState(currentPartyData);
  const timerValue = state.timer ?? currentPartyData.timer ?? Date.now();
  const delay = new Date(timerValue) - Date.now();
  const firstDisplay = !isContainerVisible(resultsChartContainer);

  stopTimer(waitingForPlayersContainer.querySelector('.timer-wrapper'));

  startTimer({
    timeLeft: delay / 1000,
    duration: resultTimerDuration / 1000,
    selectedTimer: resultsChartContainer.querySelector('.timer-wrapper')
  });

  const players = currentPartyData.players || [];

  if (firstDisplay) {
    GetVoteResults(currentPartyData);
    setActiveContainers(resultsChartContainer);
  }

  const haveVoteCount = players.filter(p => {
    const ps = p.state ?? p;
    return ps.vote === true;
  }).length;

  const haveNotVoteCount = players.filter(p => {
    const ps = p.state ?? p;
    return ps.vote === false;
  }).length;

  const config = getPartyConfig(currentPartyData);
  const rawGameRules = config.gameRules || {};
  const rulesObj =
    rawGameRules instanceof Map ? Object.fromEntries(rawGameRules) : rawGameRules;

  let punishmentInstruction;

  const oddManOutEnabled =
    rulesObj["odd-man-out"] === true || rulesObj["odd-man-out"] === "true";

  const hasOddManOut =
    (haveVoteCount === 1 && haveNotVoteCount > 1) ||
    (haveNotVoteCount === 1 && haveVoteCount > 1);

  if (oddManOutEnabled && hasOddManOut) {
    punishmentInstruction = "CHOSE_PUNISHMENT:ODD_MAN_OUT";
  } else {
    punishmentInstruction = "CHOSE_PUNISHMENT:TAKE_A_SIP";
  }

  if (firstDisplay) {
    let shouldPersistResultsState = false;

    players.forEach(player => {
      const ps = player.state ?? (player.state = {});
      const conn = player.connection ?? {};
      const socketId = conn.socketId ?? player.socketId;
      const vote = ps.vote ?? player.vote;

      if (vote === true && socketId !== "DISCONNECTED") {
        const currentScore = ps.score ?? player.score ?? 0;
        const nextScore = currentScore + 1;
        if (nextScore !== currentScore) {
          shouldPersistResultsState = true;
        }
        ps.score = nextScore;
        player.score = ps.score;
      }
    });

    if (deviceId === hostDeviceId && shouldPersistResultsState) {
      const config = normalizeConfig(currentPartyData);
      const nextState = normalizeState(currentPartyData);
      const deck = normalizeDeck(currentPartyData);

      nextState.lastPinged = new Date();

      await updateOnlineParty({
        partyId: partyCode,
        config,
        state: nextState,
        deck,
        players
      });
    }
  }

  const drinkPunishmentEnabled =
    rulesObj["drink-punishment"] === true || rulesObj["drink-punishment"] === "true";

  const punishmentEnabled = drinkPunishmentEnabled || oddManOutEnabled;

  if (punishmentEnabled) {
    SetTimeOut({
      delay,
      instruction: punishmentInstruction,
      nextDelay: null,
      newUserConfirmed: false,
      newUserReady: false
    });
  } else {
    SetTimeOut({
      delay,
      instruction: "RESET_QUESTION",
      nextDelay: null,
      newUserConfirmed: false,
      newUserReady: false
    });
  }
}

async function ensureDrinkWheelContainer() {
  let container = document.querySelector('#drink-wheel-container');

  if (container) {
    return container;
  }

  if (typeof AddGamemodeContainers === 'function') {
    AddGamemodeContainers('odd-man-out');

    for (let attempt = 0; attempt < 20; attempt++) {
      await new Promise(resolve => setTimeout(resolve, 100));
      container = document.querySelector('#drink-wheel-container');
      if (container) {
        return container;
      }
    }
  }

  return null;
}

async function ChosePunishment(instruction) {
  const players = currentPartyData.players || [];
  const parsed = parseInstruction(instruction);

  const myIndex = players.findIndex(p => getPlayerId(p) === deviceId);
  if (myIndex === -1) return;

  const myPlayer = players[myIndex];
  const myState = myPlayer.state ?? myPlayer;

  const allConfirmed = players.every(p => {
    const ps = p.state ?? p;
    return ps.hasConfirmed === true;
  });

  const haveVoteCount = players.filter(p => {
    const ps = p.state ?? p;
    return ps.vote === true;
  }).length;

  const haveNotVoteCount = players.filter(p => {
    const ps = p.state ?? p;
    return ps.vote === false;
  }).length;

  const icons = waitingForPlayersIconContainer.querySelectorAll('.icon');

  if (allConfirmed) {
      await ResetQuestion({
        icons,
        timer: Date.now() + getTimeLimit() * 1000
      });
  } else if (parsed.reason === "TAKE_A_SIP") {
    if (haveVoteCount === 0) {
        await ResetQuestion({
          icons,
          timer: Date.now() + getTimeLimit() * 1000
        });
    } else {
      const myVote = myState.vote ?? myPlayer.vote;

      if (myVote === true) {
        completePunishmentText.textContent = "Take a sip.";
        completePunishmentContainer.setAttribute("punishment-type", parsed.reason);

        const hasConfirmed = myState.hasConfirmed ?? myPlayer.hasConfirmed;

        if (!hasConfirmed) {
          setActiveContainers(completePunishmentContainer);
        } else {
          DisplayWaitingForPlayers();
        }
      } else if (myVote !== true && !(myState.hasConfirmed ?? myPlayer.hasConfirmed)) {
        await SetUserConfirmation({
          selectedDeviceId: deviceId,
          option: true
        });
      } else {
        DisplayWaitingForPlayers();
      }
    }
  } else if (parsed.reason === "ODD_MAN_OUT") {
    let oddManOutIndex;

    if (haveVoteCount === 1) {
      oddManOutIndex = players.findIndex(p => {
        const ps = p.state ?? p;
        return ps.vote === true;
      });
    } else {
      oddManOutIndex = players.findIndex(p => {
        const ps = p.state ?? p;
        return ps.vote === false;
      });
    }

    if (oddManOutIndex === -1) return;

    const oddPlayer = players[oddManOutIndex];

    if (myIndex === oddManOutIndex) {
      console.log("You are the odd man out, spinning the wheel.");
      const drinkWheelContainer = await ensureDrinkWheelContainer();

      if (drinkWheelContainer) {
        setActiveContainers(drinkWheelContainer);
      } else {
        console.warn("Drink wheel container was not available for odd man out.");
        SetWaitingForPlayer({
          waitingForRoomTitle: "Preparing punishment...",
          waitingForRoomText: "Loading drink wheel..."
        });
        setActiveContainers(waitingForPlayerContainer);
      }
    } else {
      SetWaitingForPlayer({
        waitingForRoomTitle: "Waiting for " + (oddPlayer.identity?.username ?? oddPlayer.username),
        waitingForRoomText: "Spinning drink wheel...",
        player: oddPlayer
      });
      setActiveContainers(waitingForPlayerContainer);
    }
  }
}

async function WaitingForPlayer(instruction) {
  const parsed = parseInstruction(instruction);
  const selectedId = await GetSelectedPlayerTurnID();

  if (selectedId === deviceId) {
    if (parsed.reason !== "READING_CARD") {
      setActiveContainers(selectUserContainer);
    } else {
      setActiveContainers(gameContainerPrivate);
    }
  } else {
    setActiveContainers(waitingForPlayerContainer);
  }

  waitingForPlayerTitle.textContent = "Waiting for " + parsed.username;

  if (parsed.reason === "CHOOSE_PLAYER") {
    waitingForPlayerText.textContent = "Choosing Player...";
  } else if (parsed.reason === "READING_CARD") {
    waitingForPlayerText.textContent = "Reading Card...";
  }
}

async function DisplayPunishmentToUser(instruction) {
  const parsed = parseInstruction(instruction);
  const players = currentPartyData.players || [];

  const index = players.findIndex(p => getPlayerId(p) === parsed.deviceId);
  if (index === -1) return;

  const player = players[index];

  if (parsed.deviceId === deviceId) {
    if (parsed.reason === "DOWN_IT") {
      completePunishmentText.textContent = "Down your drink!";
    } else {
      completePunishmentText.textContent = "Take " + parsed.reason.replaceAll("_", " ").toLowerCase();
    }
    setActiveContainers(completePunishmentContainer);
  } else {
    SetWaitingForPlayer({
      waitingForRoomTitle: "Waiting for " + (player.identity?.username ?? player.username),
      waitingForRoomText: "Showing player punishment...",
      player
    });
    setActiveContainers(waitingForPlayerContainer);
  }
}

async function PunishmentOffer(instruction) {
  const parsed = parseInstructionSecondReason(instruction);
  const players = currentPartyData.players || [];

  if (parsed.reason === "PASS") {
    if (parsed.deviceId === deviceId) {
      await SendInstruction({
        instruction: "USER_HAS_PASSED:USER_PASSED_PUNISHMENT:" + deviceId,
        partyData: currentPartyData
      });
    }
  } else if (parsed.reason === "CONFIRM") {
    if (deviceId === parsed.deviceId) {
      players.forEach(p => {
        const ps = p.state ?? (p.state = {});
        ps.isReady = false;
        ps.hasConfirmed = false;
        p.isReady = false;
        p.hasConfirmed = false;
      });

      const myIndex = players.findIndex(p => getPlayerId(p) === deviceId);
      const icons = waitingForPlayersIconContainer.querySelectorAll('.icon');

      if (myIndex !== -1) {
        const me = players[myIndex];
        const meState = me.state ?? (me.state = {});

        if (icons[myIndex]) {
          icons[myIndex].classList.add('yes');
        }
        meState.isReady = true;
        meState.hasConfirmed = true;
        me.isReady = true;
        me.hasConfirmed = true;
      }

      await SendInstruction({
        instruction: "HAS_USER_DONE_PUNISHMENT:" + parsed.secondReason + ":" + deviceId,
        partyData: currentPartyData
      });
    }
  }
}

async function UserSelectedForPunishment(instruction) {
  const parsed = parseInstructionDeviceId(instruction);
  const players = currentPartyData.players || [];

  const index = players.findIndex(p => getPlayerId(p) === parsed.deviceId);
  if (index === -1) return;

  const player = players[index];

  if (parsed.deviceId === deviceId) {
    setActiveContainers(selectPunishmentContainer);
  } else {
    waitingForPlayerTitle.textContent = "Waiting for " + (player.identity?.username ?? player.username);
    waitingForPlayerText.textContent = "Choosing Punishment...";
    setActiveContainers(waitingForPlayerContainer);
  }
}

async function AnswerToUserDonePunishment() {
  const players = currentPartyData.players || [];
  const icons = waitingForPlayersIconContainer.querySelectorAll('.icon');

  const myIndex = players.findIndex(p => getPlayerId(p) === deviceId);
  if (myIndex === -1) return;

  const me = players[myIndex];
  const meState = me.state ?? me;

  if (meState.isReady === true) {
    DisplayWaitingForPlayers();

    const allReady = players.every(p => {
      const ps = p.state ?? p;
      return ps.isReady === true;
    });

    if (allReady) {
      await ResetQuestion({
        icons,
        timer: Date.now() + getTimeLimit() * 1000
      });
    }
  }
}

function GetVoteResults(currentPartyData) {
  const players = currentPartyData.players || [];

  const haveVotes = [];
  const haveNeverVotes = [];

  players.forEach(player => {
    const ps = player.state ?? player;
    const vote = ps.vote ?? player.vote;

    if (vote === true) {
      haveVotes.push(player);
    } else if (vote === false) {
      haveNeverVotes.push(player);
    }
  });

  const wrapper = document.getElementById("tableWrapper");
  wrapper.innerHTML = "";
  wrapper.className = "vote-results-wrapper";

  function createSection(hasDivider) {
    const section = document.createElement("div");
    section.className = "vote-results-section";
    if (hasDivider) section.classList.add("has-divider");
    return section;
  }

  const haveSection = createSection(true);
  const neverSection = createSection(false);

  function createHeader(text) {
    const header = document.createElement("div");
    header.className = "vote-results-header";
    header.textContent = text;
    return header;
  }

  haveSection.appendChild(createHeader("Have"));
  neverSection.appendChild(createHeader("Have Never"));

  function addIcons(section, playersList) {
    const iconsWrapper = document.createElement("div");
    iconsWrapper.className = "vote-results-icons";

    playersList.forEach(player => {
      const iconContainer = document.createElement("div");
      iconContainer.className = "vote-results-icon";

      createUserIconPartyGames({
        container: iconContainer,
        userId: getPlayerId(player),
        userCustomisationString: player.identity?.userIcon ?? player.userIcon
      });

      iconsWrapper.appendChild(iconContainer);
    });

    section.appendChild(iconsWrapper);
  }

  addIcons(haveSection, haveVotes);
  addIcons(neverSection, haveNeverVotes);

  wrapper.appendChild(haveSection);
  wrapper.appendChild(neverSection);
}

async function PartySkip({ nextPlayer = true } = {}) {
  const icons = waitingForPlayersIconContainer.querySelectorAll('.icon');
  await ResetQuestion({
    icons,
    timer: Date.now() + getTimeLimit() * 1000,
    nextPlayer
  });
}
