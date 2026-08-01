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
  const state = getPartyState(currentPartyData);
  const players = currentPartyData.players || [];
  const { phaseData } = getMostLikelyToPhaseState();
  const targetId = phaseData?.targetId ?? null;
  const delay = new Date(state.timer) - Date.now();
  const durationSeconds = getTimeLimit();

  syncMostLikelyToTimerWarning(
    state,
    targetId === deviceId,
    'choose-punishment'
  );

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
  stopMostLikelyToTimerWarning();

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
