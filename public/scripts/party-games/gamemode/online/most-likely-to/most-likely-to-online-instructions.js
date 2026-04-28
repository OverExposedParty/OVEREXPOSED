function formatMostLikelyToQuestionForSelection(question = "") {
  return String(question)
    .replace(/^\s*who(?:['’]s|\s+is)?\s+most\s+likely\s+to\s+/i, "")
    .trim();
}

function formatMostLikelyToPunishmentText(punishmentType = "") {
  const normalisedPunishment = String(punishmentType || "")
    .replace(/-/g, "_")
    .trim()
    .toUpperCase();

  if (normalisedPunishment === "TAKE_A_SHOT") {
    return "Take a shot.";
  }

  if (normalisedPunishment === "DOWN_IT") {
    return "Down your drink!";
  }

  if (normalisedPunishment) {
    return "Take " + normalisedPunishment.replace(/_/g, " ").toLowerCase() + ".";
  }

  return "Complete your punishment.";
}

function getMostLikelyToPunishmentTextElement() {
  return completePunishmentText
    ?? completePunishmentContainer?.querySelector?.('.content-container #punishment-text')
    ?? document.querySelector('#complete-punishment-container .content-container #punishment-text');
}

function getMostLikelyToPhaseState() {
  const state = getPartyState(currentPartyData);
  return {
    phase: state?.phase ?? null,
    phaseData: state?.phaseData ?? {}
  };
}

function getMostLikelyToPhaseDuration() {
  return Number(getTimeLimit() || gameRules?.["time-limit"] || 120);
}

function getMostLikelyToPhaseDelay() {
  const state = getPartyState(currentPartyData);
  const timerValue = state?.timer ?? currentPartyData?.timer ?? null;
  if (!timerValue) return getMostLikelyToPhaseDuration() * 1000;

  return Math.max(new Date(timerValue) - Date.now(), 0);
}

function ensureMostLikelyToTimer(container) {
  if (!container) return false;
  if (!container.querySelector(':scope > .timer-wrapper') && typeof AddTimerToContainer === 'function') {
    AddTimerToContainer(container);
  }
  return Boolean(container.querySelector(':scope > .timer-wrapper'));
}

function startMostLikelyToPhaseTimer(container, label, delay = getMostLikelyToPhaseDelay()) {
  if (!container) return false;
  ensureMostLikelyToTimer(container);

  return startTimerWithContainer({
    container,
    label,
    timeLeft: delay / 1000,
    duration: getMostLikelyToPhaseDuration()
  });
}

async function scheduleMostLikelyToPhaseAction({ delay = 0, action, payload = {} } = {}) {
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
    console.error('Most Likely To phase action failed:', error);
  }
}

async function DisplayPrivateCard() {
  const state   = getPartyState(currentPartyData);
  const deck    = getPartyDeck(currentPartyData);
  const players = currentPartyData.players || [];

  const delay = new Date(state.timer) - Date.now();

  const durationSeconds = getTimeLimit();

  startTimerFromContainer({
    container: gameContainerPrivate,
    timeLeft: delay / 1000,
    duration: durationSeconds
  });
  startTimerWithContainer({
    container: selectUserContainer,
    label: 'selectUserContainer',
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
    nextDelay: resultTimerDuration
  });

  const myIndex = players.findIndex(p => getPlayerId(p) === deviceId);
  if (myIndex === -1) {
    console.warn("Device not found in players.");
    return;
  }

  const myState   = getPlayerState(players[myIndex]);
  const cardIndex = deck.currentCardIndex ?? 0;

  selectedQuestionObj = getNextQuestion(cardIndex);
  selectNumberButtonContainer.innerHTML = "";

  selectUserQuestionText.textContent =
    formatMostLikelyToQuestionForSelection(selectedQuestionObj.question);

  DisplayCard(gameContainerPrivate, selectedQuestionObj);

  if (!myState.isReady && !myState.hasConfirmed) {
    setActiveContainers(gameContainerPrivate);
  }
  else if (myState.isReady && !myState.hasConfirmed) {
    setActiveContainers(selectUserContainer);
  }
  else {
    const allConfirmed = players.every(p => getPlayerState(p).hasConfirmed);

    if (allConfirmed) {
        await SendInstruction({
          instruction: "DISPLAY_VOTE_RESULTS",
          timer: Date.now() + resultTimerDuration
        });
    } else if (myState.hasConfirmed) {
      DisplayWaitingForPlayers();
    }
  }
}

async function DisplayVoteResults() {
  const state   = getPartyState(currentPartyData);
  const players = currentPartyData.players || [];
  const authoritativeHostId = state.hostComputerId ?? hostDeviceId;

  const delay = new Date(state.timer) - Date.now();
  const firstDisplay = !isContainerVisible(resultsChartContainer);

  stopTimerForContainer(waitingForPlayersContainer, 'waitingForPlayersContainer');
  startTimerWithContainer({
    container: resultsChartContainer,
    label: 'resultsChartContainer',
    timeLeft: delay / 1000,
    duration: resultTimerDuration / 1000
  });

  const icons = waitingForPlayersIconContainer.querySelectorAll('.icon');

  const myIndex = players.findIndex(p => getPlayerId(p) === deviceId);
  if (myIndex === -1) {
    console.warn("Device not found in players.");
    return;
  }

  if (firstDisplay) {
    GetVoteResults(currentPartyData);
    setActiveContainers(resultsChartContainer);
  }

  const highestValue = getHighestVoteValue(currentPartyData);
  debugLog("highestValue:", highestValue);

  if (firstDisplay) {
    if (deviceId === authoritativeHostId) {
      const updatedParty = await performOnlinePartyAction({
        action: 'most-likely-to-resolve-vote-results'
      });

      if (updatedParty) {
        currentPartyData = updatedParty;
      }
    }
  }

    ClearIcons();

    if (firstDisplay) {
      scheduleMostLikelyToPhaseAction({
        delay,
        action: 'most-likely-to-advance-from-results',
        payload: {
          phaseTimer: Date.now() + getTimeLimit() * 1000,
          roundTimer: Date.now() + getTimeLimit() * 1000
        }
      });
    }
}

async function TieBreakerPunishmentOffer() {
  const state   = getPartyState(currentPartyData);
  const players = currentPartyData.players || [];
  const authoritativeHostId = state.hostComputerId ?? hostDeviceId;
  const { phaseData } = getMostLikelyToPhaseState();
  const delay = new Date(state.timer) - Date.now();

  const durationSeconds = getTimeLimit();

  startTimerWithContainer({
    container: selectNumberContainer,
    label: 'selectNumberContainer',
    timeLeft: delay / 1000,
    duration: durationSeconds
  });
  startTimerWithContainer({
    container: waitingForPlayersContainer,
    label: 'waitingForPlayersContainer',
    timeLeft: delay / 1000,
    duration: durationSeconds
  });

  scheduleMostLikelyToPhaseAction({
    delay,
    action: 'most-likely-to-handle-phase-timeout',
    payload: {
      phaseTimer: Date.now() + getTimeLimit() * 1000,
      roundTimer: Date.now() + getTimeLimit() * 1000
    }
  });

  const myIndex = players.findIndex(p => getPlayerId(p) === deviceId);
  if (myIndex === -1) {
    console.warn("Device not found in players.");
    return;
  }
  const myState = getPlayerState(players[myIndex]);

  const tiedIds = Array.isArray(phaseData?.tiedIds)
    ? phaseData.tiedIds.filter(Boolean)
    : [];

  if (tiedIds.includes(deviceId)) {
    const count = tiedIds.length;

    for (let i = 0; i < count; i++) {
      if (selectNumberButtonContainer.querySelectorAll('button').length < count) {
        const selectedNumberButton = createUserButton(String(i), i + 1);

        selectedNumberButton.addEventListener('click', () => {
          selectNumberContainer.querySelectorAll('button')
            .forEach(btn => btn.classList.remove('active'));
          selectedNumberButton.classList.add('active');
          selectNumberContainer.setAttribute(
            'selected-id',
            selectedNumberButton.getAttribute('id')
          );
        });

        selectNumberButtonContainer.appendChild(selectedNumberButton);
      }
    }

    if (!myState.hasConfirmed) {
      setActiveContainers(selectNumberContainer);

      for (let i = 0; i < count; i++) {
        const button = document.getElementById(String(i));
        const someoneChoseThis =
          players.some(player => getPlayerState(player).vote === String(i));

        if (someoneChoseThis) {
          button.classList.add("disabled");
        } else {
          button.classList.remove("disabled");
        }
      }
    } else {
      const allConfirmed = tiedIds.every((tiedId) => {
        const tiedPlayer = players.find(p => getPlayerId(p) === tiedId);
        return tiedPlayer ? getPlayerState(tiedPlayer).hasConfirmed === true : false;
      });
      if (allConfirmed && deviceId === authoritativeHostId) {
        const updatedParty = await performOnlinePartyAction({
          action: 'most-likely-to-resolve-tiebreaker',
          payload: {
            tiedIds,
            timer: Date.now() + getTimeLimit() * 1000
          }
        });

        if (updatedParty) {
          currentPartyData = updatedParty;

          if (getPartyState(currentPartyData)?.phase === "most-likely-to-choose-punishment") {
            await ChoosingPunishment();
            return;
          }
        }
      } else {
        DisplayWaitingForPlayers();
      }
    }
  } else {
    DisplayWaitingForPlayers();
  }
}

async function WaitingForPlayer(instruction) {
  const parsedInstructions = parseInstruction(instruction);

  const selectedTurnId = await GetSelectedPlayerTurnID();

  if (selectedTurnId === deviceId) {
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

  waitingForPlayerTitle.textContent =
    "Waiting for " + parsedInstructions.username;

  if (parsedInstructions.reason === "CHOOSE_PLAYER") {
    waitingForPlayerText.textContent = "Choosing Player...";
  }
  else if (parsedInstructions.reason === "READING_CARD") {
    waitingForPlayerText.textContent = "Reading Card...";
  }
}

async function DisplayPunishmentToUser(instruction) {
  const players = currentPartyData.players || [];
  const parsedInstructions = parseInstruction(instruction);

  const index = players.findIndex(
    p => getPlayerId(p) === parsedInstructions.deviceId
  );

  if (parsedInstructions.deviceId === deviceId) {
    completePunishmentText.textContent =
      "take " + parsedInstructions.reason.replace("_", " ");
    setActiveContainers(completePunishmentContainer);
  }
  else if (index !== -1) {
    SetWaitingForPlayer({
      waitingForRoomTitle: "Waiting for " + getPlayerUsername(players[index]),
      waitingForRoomText: "Showing player punishment...",
      player: players[index]
    });
    setActiveContainers(waitingForPlayerContainer);
  }
}

async function ChoosingPunishment() {
  const state   = getPartyState(currentPartyData);
  const players = currentPartyData.players || [];
  const { phaseData } = getMostLikelyToPhaseState();
  const targetId = phaseData?.targetId ?? null;
  const delay = new Date(state.timer) - Date.now();

  const durationSeconds = getTimeLimit();

  startTimerWithContainer({
    container: selectPunishmentContainer,
    label: 'selectPunishmentContainer',
    timeLeft: delay / 1000,
    duration: durationSeconds
  });
  startTimerWithContainer({
    container: waitingForPlayerContainer,
    label: 'waitingForPlayerContainer',
    timeLeft: delay / 1000,
    duration: durationSeconds
  });

  scheduleMostLikelyToPhaseAction({
    delay,
    action: 'most-likely-to-handle-phase-timeout',
    payload: {
      roundTimer: Date.now() + getTimeLimit() * 1000
    }
  });

  const index = players.findIndex(
    p => getPlayerId(p) === targetId
  );

  if (targetId === deviceId) {
    setActiveContainers(selectPunishmentContainer);
  }
  else if (index !== -1) {
    SetWaitingForPlayer({
      waitingForRoomTitle: "Waiting for " + getPlayerUsername(players[index]),
      waitingForRoomText: "Choosing Punishment...",
      player: players[index]
    });
    setActiveContainers(waitingForPlayerContainer);
  }
}

async function ChosePunishment() {
  const players = currentPartyData.players || [];
  const { phaseData } = getMostLikelyToPhaseState();
  const targetId = phaseData?.targetId ?? null;
  const punishmentType = phaseData?.punishmentType ?? '';
  const delay = getMostLikelyToPhaseDelay();

  const index = players.findIndex(
    p => getPlayerId(p) === targetId
  );

  if (targetId === deviceId) {
    if (punishmentType === "MOST_LIKELY_TO_DRINK_WHEEL") {
      const wheelIsAlreadyActive =
        (typeof spinning !== 'undefined' && spinning === true) ||
        isContainerVisible(drinkWheelContainer);

      if (!wheelIsAlreadyActive && typeof resetDrinkWheelState === 'function') {
        resetDrinkWheelState();
      }
      startMostLikelyToPhaseTimer(drinkWheelContainer, 'drinkWheelContainer', delay);
      setActiveContainers(drinkWheelContainer);
    } else {
      const punishmentTextElement = getMostLikelyToPunishmentTextElement();
      if (punishmentTextElement) {
        punishmentTextElement.textContent = formatMostLikelyToPunishmentText(punishmentType);
      }
      completePunishmentContainer.setAttribute("punishment-type", punishmentType);
      startMostLikelyToPhaseTimer(completePunishmentContainer, 'completePunishmentContainer', delay);
      setActiveContainers(completePunishmentContainer);
    }
  } else if (index !== -1) {
    let currentWaitingForPlayerText = "Reading punishment...";
    if (punishmentType === "MOST_LIKELY_TO_DRINK_WHEEL") {
      currentWaitingForPlayerText = "Spinning drink wheel...";
    }

    SetWaitingForPlayer({
      waitingForRoomTitle: "Waiting for " + getPlayerUsername(players[index]),
      waitingForRoomText: currentWaitingForPlayerText,
      player: players[index]
    });
    startMostLikelyToPhaseTimer(waitingForPlayerContainer, 'waitingForPlayerContainer', delay);
    startMostLikelyToPhaseTimer(waitingForPlayersContainer, 'waitingForPlayersContainer', delay);
    setActiveContainers(waitingForPlayerContainer);
  }
}

async function PartySkip({ nextPlayer = true } = {}) {
  const icons = waitingForPlayersIconContainer.querySelectorAll('.icon');
  await ResetQuestion({
    icons,
    timer: Date.now() + getTimeLimit() * 1000,
    nextPlayer
  });
}
