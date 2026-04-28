async function DisplayPrivateCard() {
  const state = getPartyState(currentPartyData);
  const deck = getPartyDeck(currentPartyData);
  const players = currentPartyData.players || [];

  const delay = new Date(state.timer) - Date.now();
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
    delay: delay,
    instruction: "DISPLAY_VOTE_RESULTS",
    nextDelay: resultTimerDuration,
    newUserConfirmed: false,
    newUserReady: false
  });

  const myIndex = players.findIndex(p => getPlayerId(p) === deviceId);
  if (myIndex === -1) {
    console.warn("Device not found in players.");
    return;
  }

  const me = players[myIndex];
  const myState = getPlayerState(me);
  const cardIdx = deck.currentCardIndex ?? 0;

  if (!myState.isReady && !myState.hasConfirmed) {
    selectedQuestionObj = getNextQuestion(cardIdx);
    DisplayCard(gameContainerPrivate, selectedQuestionObj);
    setActiveContainers(gameContainerPrivate);
  }
  else if (myState.isReady && !myState.hasConfirmed) {
    selectedQuestionObj = getNextQuestion(cardIdx);
    const splitQuestion = SplitQuestion(
      selectedQuestionObj.question.replace("Would you rather ", "")
    );
    selectOptionQuestionTextA.textContent = "A: " + splitQuestion.a;
    selectOptionQuestionTextB.textContent = "B: " + splitQuestion.b;
    setActiveContainers(selectOptionContainer);
  }
  else {
    const allConfirmed = players.every(p => getPlayerState(p).hasConfirmed === true);

    if (allConfirmed) {
      await SendInstruction({
        instruction: "DISPLAY_VOTE_RESULTS",
        timer: Date.now() + resultTimerDuration,
        updateUsersConfirmation: false,
        updateUsersReady: false
      });
    } else {
      if (myState.hasConfirmed) {
        DisplayWaitingForPlayers();
      }
    }
  }
}

function getWouldYouRatherPhaseState() {
  const state = getPartyState(currentPartyData);
  return {
    phase: state?.phase ?? null,
    phaseData: state?.phaseData ?? {}
  };
}

async function scheduleWouldYouRatherPhaseAction({ delay = 0, action, payload = {} } = {}) {
  const state = getPartyState(currentPartyData);
  const authoritativeHostId = state?.hostComputerId ?? hostDeviceId;

  if (deviceId !== authoritativeHostId || delay == null || !action) return;

  if (timeout?.cancel) {
    timeout.cancel();
  }

  timeout = createCancelableTimeout(delay);

  try {
    await timeout.promise;

    const actionPayload = { ...payload };
    if (actionPayload.nextPhaseTimerDurationMs != null) {
      actionPayload.phaseTimer = Date.now() + Number(actionPayload.nextPhaseTimerDurationMs);
      delete actionPayload.nextPhaseTimerDurationMs;
    }
    if (actionPayload.nextRoundTimerDurationMs != null) {
      actionPayload.roundTimer = Date.now() + Number(actionPayload.nextRoundTimerDurationMs);
      delete actionPayload.nextRoundTimerDurationMs;
    }

    const updatedParty = await performOnlinePartyAction({
      action,
      payload: actionPayload
    });

    if (updatedParty) {
      currentPartyData = updatedParty;
    }
  } catch (error) {
    console.error('Would You Rather phase action failed:', error);
  }
}

function getWouldYouRatherTargetIds() {
  const { phaseData } = getWouldYouRatherPhaseState();
  return Array.isArray(phaseData?.targetIds)
    ? phaseData.targetIds.filter(Boolean)
    : [];
}

function getWouldYouRatherWinningVote() {
  const { phaseData } = getWouldYouRatherPhaseState();
  return phaseData?.winningVote ?? null;
}

function getWouldYouRatherPhaseDuration() {
  return Number(getTimeLimit() || gameRules?.["time-limit"] || 120);
}

function getWouldYouRatherPhaseDelay() {
  const state = getPartyState(currentPartyData);
  const timerValue = state?.timer ?? currentPartyData?.timer ?? null;
  if (!timerValue) return getWouldYouRatherPhaseDuration() * 1000;

  return Math.max(new Date(timerValue) - Date.now(), 0);
}

function ensureWouldYouRatherTimer(container) {
  if (!container) return false;
  if (!container.querySelector(':scope > .timer-wrapper') && typeof AddTimerToContainer === 'function') {
    AddTimerToContainer(container);
  }
  return Boolean(container.querySelector(':scope > .timer-wrapper'));
}

function startWouldYouRatherPhaseTimer(container, label, delay = getWouldYouRatherPhaseDelay()) {
  if (!container) return false;
  ensureWouldYouRatherTimer(container);

  return startTimerWithContainer({
    container,
    label,
    timeLeft: delay / 1000,
    duration: getWouldYouRatherPhaseDuration()
  });
}

async function DisplayVoteResults() {
  const state = getPartyState(currentPartyData);

  const delay = new Date(state.timer) - Date.now();
  const firstDisplay = !isContainerVisible(resultsChartContainer);

  stopTimerForContainer(waitingForPlayersContainer, 'waitingForPlayersContainer');
  startTimerWithContainer({
    container: resultsChartContainer,
    label: 'resultsChartContainer',
    timeLeft: delay / 1000,
    duration: resultTimerDuration / 1000
  });

  if (firstDisplay) {
    GetVoteResults(currentPartyData);
    setActiveContainers(resultsChartContainer);
  }

  if (firstDisplay) {
    scheduleWouldYouRatherPhaseAction({
      delay,
      action: 'would-you-rather-resolve-vote-results',
      payload: {
        nextRoundTimerDurationMs: getTimeLimit() * 1000,
        nextPhaseTimerDurationMs: getTimeLimit() * 1000
      }
    });
  }
}

async function WaitingForPlayer(instruction) {
  const parsedInstructions = parseInstruction(instruction);

  if (await GetSelectedPlayerTurnID() === deviceId) {
    if (parsedInstructions.reason !== "READING_CARD") {
      setActiveContainers(selectUserContainer);
    }
    else {
      setActiveContainers(gameContainerPrivate);
    }
  }
  else {
    setActiveContainers(waitingForPlayerContainer);
  }

  waitingForPlayerTitle.textContent = "Waiting for " + parsedInstructions.username;

  if (parsedInstructions.reason === "CHOOSE_PLAYER") {
    waitingForPlayerText.textContent = "Choosing Player...";
  }
  else if (parsedInstructions.reason === "READING_CARD") {
    waitingForPlayerText.textContent = "Reading Card...";
  }
}

async function DisplayPunishmentToUser(instruction) {
  return;
}

async function PunishmentOffer(instruction) {
  return;
}

async function ChosePunishment(instruction) {
  const players = currentPartyData.players || [];
  const { phase, phaseData } = getWouldYouRatherPhaseState();
  const targetIds = getWouldYouRatherTargetIds();
  const delay = getWouldYouRatherPhaseDelay();

  const myIndex = players.findIndex(
    p => getPlayerId(p) === deviceId
  );
  if (myIndex === -1) return;

  const icons = waitingForPlayersIconContainer.querySelectorAll('.icon');

  const myState = getPlayerState(players[myIndex]);

  players.forEach((player, i) => {
    const pState = getPlayerState(player);
    if (pState.hasConfirmed && icons[i]) {
      icons[i].classList.add('yes');
    }
  });

  if (phase === 'would-you-rather-spin-odd-man-out') {
    const oddManOutId = targetIds[0] ?? null;
    const oddManOutPlayer = players.find(player => getPlayerId(player) === oddManOutId);
    if (!oddManOutPlayer) return;

    if (oddManOutId === deviceId) {
      if (typeof resetDrinkWheelState === 'function') {
        resetDrinkWheelState();
      }
      startWouldYouRatherPhaseTimer(drinkWheelContainer, 'drinkWheelContainer', delay);
      setActiveContainers(drinkWheelContainer);
    } else {
      SetWaitingForPlayer({
        waitingForRoomTitle: "Waiting for " + getPlayerUsername(oddManOutPlayer),
        waitingForRoomText: "Spinning drink wheel...",
        player: oddManOutPlayer
      });
      startWouldYouRatherPhaseTimer(waitingForPlayerContainer, 'waitingForPlayerContainer', delay);
      setActiveContainers(waitingForPlayerContainer);
    }
    return;
  }

  if (phase === 'would-you-rather-show-punishment') {
    scheduleWouldYouRatherPhaseAction({
      delay,
      action: 'would-you-rather-handle-phase-timeout',
      payload: {
        nextRoundTimerDurationMs: getTimeLimit() * 1000
      }
    });
  }

  if (targetIds.includes(deviceId)) {
    const punishmentType = String(phaseData?.punishmentType ?? 'TAKE_A_SIP');
    completePunishmentText.textContent =
      punishmentType === 'TAKE_A_SIP'
        ? 'Take a sip.'
        : 'Take ' + punishmentType.replace(/_/g, ' ').toLowerCase() + '.';
    completePunishmentContainer.setAttribute('punishment-type', punishmentType);

    if (!myState.hasConfirmed) {
      startWouldYouRatherPhaseTimer(completePunishmentContainer, 'completePunishmentContainer', delay);
      setActiveContainers(completePunishmentContainer);
    } else {
      startWouldYouRatherPhaseTimer(waitingForPlayersContainer, 'waitingForPlayersContainer', delay);
      DisplayWaitingForPlayers();
    }
  } else {
    startWouldYouRatherPhaseTimer(waitingForPlayersContainer, 'waitingForPlayersContainer', delay);
    DisplayWaitingForPlayers();
  }
}

async function UserSelectedForPunishment(instruction) {
  return;
}

async function AnswerToUserDonePunishment() {
  return;
}

function GetVoteResults(currentPartyData) {
  const players = currentPartyData.players || [];
  const deck = getPartyDeck(currentPartyData);

  const aVotes = [];
  const bVotes = [];

  players.forEach(player => {
    const ps = getPlayerState(player);
    if (ps.vote === "A") {
      aVotes.push(player);
    } else if (ps.vote === "B") {
      bVotes.push(player);
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

  const aSection = createSection(true);
  const bSection = createSection(false);

  function createHeader(text) {
    const header = document.createElement("div");
    header.className = "vote-results-header";
    header.textContent = text;
    return header;
  }

  const cardIdx = deck.currentCardIndex ?? 0;
  selectedQuestionObj = getNextQuestion(cardIdx);
  const splitQuestion = SplitQuestion(
    selectedQuestionObj.question.replace("Would you rather ", "")
  );

  aSection.appendChild(createHeader(splitQuestion.a));
  bSection.appendChild(createHeader(splitQuestion.b));

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

  addIcons(aSection, aVotes);
  addIcons(bSection, bVotes);

  wrapper.appendChild(aSection);
  wrapper.appendChild(bSection);
}

async function PartySkip({ nextPlayer = true } = {}) {
  if (!nextPlayer) {
    await ResetQuestion({
      nextPlayer: false,
      timer: Date.now() + getTimeLimit() * 1000
    });
    return;
  }

  await SendInstruction({
    instruction: "RESET_QUESTION:"
  });
}

function SplitQuestion(question) {
  const parts = question.split(" OR ");

  if (parts.length === 2) {
    const a = parts[0].trim().replace(/\.*$/, '').replace(/\?/g, '');
    const b = parts[1].trim().replace(/\.*$/, '').replace(/\?/g, '');
    return { a, b };
  } else {
    return {
      a: question.trim().replace(/\.*$/, '').replace(/\?/g, ''),
      b: ""
    };
  }
}
