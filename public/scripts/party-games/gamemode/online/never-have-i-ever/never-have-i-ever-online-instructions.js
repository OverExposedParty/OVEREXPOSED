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
  startTimerWithContainer({
    container: selectOptionContainer,
    label: 'selectOptionContainer',
    timeLeft: delay / 1000,
    duration: durationSeconds
  });
  startTimerWithContainer({
    container: waitingForPlayersContainer,
    label: 'waitingForPlayersContainer',
    timeLeft: delay / 1000,
    duration: durationSeconds
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

  stopTimerForContainer(waitingForPlayersContainer, 'waitingForPlayersContainer');

  startTimerWithContainer({
    container: resultsChartContainer,
    label: 'resultsChartContainer',
    timeLeft: delay / 1000,
    duration: resultTimerDuration / 1000
  });

  if (firstDisplay) {
    scheduleNeverHaveIEverPhaseAction({
      delay,
      action: 'never-have-i-ever-resolve-vote-results',
      payload: {
        roundTimer: Date.now() + gameRules["time-limit"] * 1000,
        nextPlayer: true
      }
    });

    try {
      GetVoteResults(currentPartyData);
    } catch (error) {
      console.error('Never Have I Ever vote results render failed:', error);
    }

    setActiveContainers(resultsChartContainer);
  }
}

function getNeverHaveIEverPhaseState() {
  const state = getPartyState(currentPartyData);
  return {
    phase: state?.phase ?? null,
    phaseData: state?.phaseData ?? {}
  };
}

async function scheduleNeverHaveIEverPhaseAction({ delay = 0, action, payload = {} } = {}) {
  const state = getPartyState(currentPartyData);
  const authoritativeHostId = state?.hostComputerId ?? hostDeviceId;

  if (deviceId !== authoritativeHostId || delay == null || !action) return;

  if (timeout?.cancel) {
    timeout.cancel();
  }

  timeout = createCancelableTimeout(delay);

  try {
    await timeout.promise;

    const updatedParty = await performOnlinePartyAction({
      action,
      payload
    });

    if (updatedParty) {
      currentPartyData = updatedParty;
    }
  } catch (error) {
    console.error('Never Have I Ever phase action failed:', error);
  }
}

function getNeverHaveIEverTargetIds() {
  const { phaseData } = getNeverHaveIEverPhaseState();
  return Array.isArray(phaseData?.targetIds)
    ? phaseData.targetIds.filter(Boolean)
    : [];
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
  const { phase } = getNeverHaveIEverPhaseState();
  const targetIds = getNeverHaveIEverTargetIds();

  const myIndex = players.findIndex(p => getPlayerId(p) === deviceId);
  if (myIndex === -1) return;

  const myPlayer = players[myIndex];
  const myState = myPlayer.state ?? myPlayer;

  if (phase === 'never-have-i-ever-spin-odd-man-out') {
    const oddManOutId = targetIds[0] ?? null;
    const oddPlayer = players.find(player => getPlayerId(player) === oddManOutId);
    if (!oddPlayer) return;

    if (oddManOutId === deviceId) {
      const drinkWheelContainer = await ensureDrinkWheelContainer();

      if (drinkWheelContainer) {
        if (typeof resetDrinkWheelState === 'function') {
          resetDrinkWheelState();
        }
        setActiveContainers(drinkWheelContainer);
      } else {
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
    return;
  }

  if (targetIds.includes(deviceId)) {
    completePunishmentText.textContent = "Take a sip.";
    completePunishmentContainer.setAttribute("punishment-type", "TAKE_A_SIP");

    const hasConfirmed = myState.hasConfirmed ?? myPlayer.hasConfirmed;
    if (!hasConfirmed) {
      setActiveContainers(completePunishmentContainer);
    } else {
      DisplayWaitingForPlayers();
    }
  } else {
    DisplayWaitingForPlayers();
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
  return;
}

async function PunishmentOffer(instruction) {
  return;
}

async function UserSelectedForPunishment(instruction) {
  return;
}

async function AnswerToUserDonePunishment() {
  return;
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
  if (!wrapper) {
    console.warn('Never Have I Ever results wrapper not found.');
    return;
  }
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
