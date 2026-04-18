async function NextQuestion() {
  const players = currentPartyData.players || [];
  const state   = getPartyState(currentPartyData);
  const deck    = getPartyDeck(currentPartyData);

  const meIndex = players.findIndex(p => getPlayerId(p) === deviceId);
  const playerTurn = state.playerTurn ?? currentPartyData.playerTurn ?? 0;
  const currentPlayer = players[playerTurn];

  const votedId = getPlayerVote(currentPlayer);
  const votedIndex = votedId != null
    ? players.findIndex(p => getPlayerId(p) === votedId)
    : -1;

  const votedPlayer = votedIndex !== -1 ? players[votedIndex] : null;

  if (meIndex === -1) {
    console.warn("Device not found in players.");
    return;
  }

  const icons = waitingForPlayersIconContainer.querySelectorAll('.icon');
  const meState = getPlayerState(players[meIndex]);

  if (meState.hasConfirmed === true) {
    if (!isContainerVisible(waitingForPlayersContainer)) {
      ClearIcons();
    }
    setActiveContainers(waitingForPlayersContainer);

    // Update player's last ping
    const meConn = ensureConnection(players[meIndex]);
    meConn.lastPing = new Date();
    players[meIndex].lastPing = meConn.lastPing; // legacy mirror

    // Mark who has confirmed
    players.forEach((player, i) => {
      const pState = getPlayerState(player);
      if (pState.hasConfirmed && icons[i]) {
        icons[i].classList.add('yes');
      }
    });

    const allReady = players.every(p => getPlayerState(p).hasConfirmed === true);

    if (allReady) {
      icons.forEach(icon => icon.classList.add('yes'));
      await new Promise(resolve => setTimeout(resolve, 1500));

      ResetParanoiaQuestion({
        nextPlayer: true,
        incrementScore: 1
      });
    }
    else if (!isContainerVisible(waitingForPlayersContainer)) {
      await SendInstruction({});
    }
  } else {
    // Show dual stack with current + voted player
    if (!currentPlayer || !votedPlayer) {
      console.warn('Missing current or voted player for dual stack view.');
      return;
    }

    EditUserIconPartyGames({
      container: gameContainerDualStack.querySelector('.dual-image-stack#dual-image-stack-1'),
      userId: getPlayerId(currentPlayer),
      userCustomisationString: getPlayerIcon(currentPlayer)
    });

    EditUserIconPartyGames({
      container: gameContainerDualStack.querySelector('.dual-image-stack#dual-image-stack-2'),
      userId: getPlayerId(votedPlayer),
      userCustomisationString: getPlayerIcon(votedPlayer)
    });

    const currentIndex = deck.currentCardIndex ?? currentPartyData.currentCardIndex ?? 0;
    selectedQuestionObj = getNextQuestion(currentIndex);
    DisplayCard(gameContainerDualStack, selectedQuestionObj);
    setActiveContainers(gameContainerDualStack);
  }
}

function getParanoiaPhaseState() {
  const state = getPartyState(currentPartyData);
  return {
    phase: state?.phase ?? null,
    phaseData: state?.phaseData ?? {}
  };
}

async function scheduleParanoiaPhaseAction({ delay = 0, action, payload = {} } = {}) {
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
    console.error('Paranoia phase action failed:', error);
  }
}

function getParanoiaTargetPlayer() {
  const players = currentPartyData.players || [];
  const { phaseData } = getParanoiaPhaseState();
  const targetId = phaseData?.targetId ?? null;

  return players.find(player => getPlayerId(player) === targetId) ?? null;
}

function formatParanoiaPunishmentText(punishmentType = '') {
  return String(punishmentType || '')
    .replace(/_/g, ' ')
    .toLowerCase();
}

async function DisplayPrivateCard(instruction) {
  const state = getPartyState(currentPartyData);
  const players = currentPartyData.players || [];
  const punishmentTimeoutPromise = selectPunishmentButtonContainer.childElementCount == 0
    ? null
    : scheduleParanoiaPhaseAction({
        delay: new Date(state.timer ?? currentPartyData.timer) - Date.now(),
        action: 'paranoia-handle-card-timeout',
        payload: {
          phaseTimer: Date.now() + gameRules["time-limit"] * 1000
        }
      });

  const timerValue = state.timer ?? currentPartyData.timer;
  const delay = new Date(timerValue) - Date.now();

  startTimerFromContainer({
    container: gameContainerPrivate,
    timeLeft: delay / 1000,
    duration: gameRules["time-limit"]
  });
  startTimerWithContainer({
    container: selectUserContainer,
    label: 'selectUserContainer',
    timeLeft: delay / 1000,
    duration: gameRules["time-limit"]
  });
  startTimerWithContainer({
    container: waitingForPlayerContainer,
    label: 'waitingForPlayerContainer',
    timeLeft: delay / 1000,
    duration: gameRules["time-limit"]
  });

  if (selectPunishmentButtonContainer.childElementCount == 0) {
    SetTimeOut({ delay: delay, instruction: "RESET_QUESTION:TIME_EXPIRED", nextDelay: null });
  }

  const parsedInstructions = parseInstruction(instruction);
  const playerTurn = state.playerTurn ?? currentPartyData.playerTurn ?? 0;
  const currentPlayer = players[playerTurn];

  if (!currentPlayer) {
    console.warn('Current player not found in DisplayPrivateCard');
    return;
  }

  const currentPlayerId = getPlayerId(currentPlayer);

  if (currentPlayerId === deviceId) {
    if (parsedInstructions.reason !== "READING_CARD") {
      setActiveContainers(selectUserContainer);
    } else {
      const deck = getPartyDeck(currentPartyData);
      const index = deck.currentCardIndex ?? currentPartyData.currentCardIndex ?? 0;
      selectedQuestionObj = getNextQuestion(index);
      DisplayCard(gameContainerPrivate, selectedQuestionObj);
      setActiveContainers(gameContainerPrivate);
    }
  } else {
    let currentWaitingForPlayerText;

    if (parsedInstructions.reason === "CHOOSE_PLAYER") {
      currentWaitingForPlayerText = "Choosing Player...";
    }
    else if (parsedInstructions.reason === "READING_CARD") {
      currentWaitingForPlayerText = "Reading Card...";
    }

    SetWaitingForPlayer({
      waitingForRoomTitle: "Waiting for " + getPlayerUsername(currentPlayer),
      waitingForRoomText: currentWaitingForPlayerText,
      player: currentPlayer
    });
    setActiveContainers(waitingForPlayerContainer);
  }

  if (punishmentTimeoutPromise) {
    await punishmentTimeoutPromise;
  }
}

async function DisplayPunishmentToUser(instruction) {
  const players = currentPartyData.players || [];
  const parsedInstructions = parseInstruction(instruction);
  const punishmentType = String(parsedInstructions.reason ?? '').toUpperCase();
  const punishedPlayer = players.find(
    player => getPlayerId(player) === parsedInstructions.deviceId
  ) ?? getParanoiaTargetPlayer();
  const punishedPlayerId = parsedInstructions.deviceId ?? getPlayerId(punishedPlayer);

  if (String(punishedPlayerId) === String(deviceId)) {
    if (punishmentType === "DOWN_IT" || punishmentType === "DOWN-IT") {
      completePunishmentText.textContent =
        "In order to find out the question you have to down your drink.";
      completePunishmentContainer.setAttribute("punishment-type", "DOWN_IT");
    } else {
      const readablePunishment = formatParanoiaPunishmentText(punishmentType);
      completePunishmentText.textContent =
        `In order to find out the question you have to take ${readablePunishment}.`;
      completePunishmentContainer.setAttribute("punishment-type", punishmentType);
    }

    setActiveContainers(completePunishmentContainer);
    return;
  }

  SetWaitingForPlayer({
    waitingForRoomTitle: "Waiting for " + (punishedPlayer ? getPlayerUsername(punishedPlayer) : "player"),
    waitingForRoomText: "Showing player punishment...",
    player: punishedPlayer ?? null
  });
  setActiveContainers(waitingForPlayerContainer);
}

// Single unified PunishmentOffer using nested structure
async function PunishmentOffer(instruction) {
  return;
}

async function UserHasPassed(instruction) {
  const players = currentPartyData.players || [];
  const state   = getPartyState(currentPartyData);
  const { phaseData } = getParanoiaPhaseState();
  const authoritativeHostId = state?.hostComputerId ?? hostDeviceId;

  const parsedInstructions = parseInstruction(instruction);
  const playerTurn = state.playerTurn ?? currentPartyData.playerTurn ?? 0;
  const turnPlayer = players[playerTurn];
  const targetId =
    parsedInstructions.deviceId ||
    phaseData?.targetId ||
    (turnPlayer ? getPlayerVote(turnPlayer) : null) ||
    (turnPlayer ? getPlayerId(turnPlayer) : null);

  const target = players.find(player => getPlayerId(player) === targetId) ?? turnPlayer ?? null;
  const targetName = target ? getPlayerUsername(target) : "Player";
  let passedReasonText = "";

  if (parsedInstructions.reason === "USER_CALLED_WRONG_FACE") {
    passedReasonText = "unsuccessful coin flip";
  }
  else if (parsedInstructions.reason === "USER_PASSED_PUNISHMENT") {
    passedReasonText = "punishment has been forfeited";
  }
  else if (parsedInstructions.reason === "USER_DIDNT_DO_PUNISHMENT") {
    passedReasonText = "punishment not complete";
  }

  SetPlayerHasPassed({
    playerHasPassedTitleText: targetName + " has passed",
    playerHasPassedReasonText: passedReasonText,
    player: target
  });
  setActiveContainers(playerHasPassedContainer);

  await new Promise(resolve => setTimeout(resolve, 2000));

  if (deviceId === authoritativeHostId) {
    await ResetParanoiaQuestion({ nextPlayer: true });
  }
}

async function HasUserDonePunishment(instruction) {
  const players = currentPartyData.players || [];
  const { phaseData } = getParanoiaPhaseState();
  const punishedPlayer = getParanoiaTargetPlayer();
  const meIndex = players.findIndex(p => getPlayerId(p) === deviceId);

  if (!punishedPlayer || meIndex === -1) return;

  const meState = getPlayerState(players[meIndex]);
  const icons = waitingForPlayersIconContainer.querySelectorAll('.icon');
  const completionReason = String(
    phaseData?.completionReason ?? phaseData?.punishmentType ?? ''
  ).toUpperCase();

  if (!meState.isReady) {
    if (getPlayerId(punishedPlayer) !== deviceId) {
      if (!isContainerVisible(confirmPunishmentContainer)) {
        if (completionReason.includes("TAKE_A_SHOT")) {
          confirmPunishmentText.textContent =
            "Has " + getPlayerUsername(punishedPlayer) + " taken their shot";
        }
        else if (completionReason.includes("DOWN_IT")) {
          confirmPunishmentText.textContent =
            "Has " + getPlayerUsername(punishedPlayer) + " downed their drink";
        }
        else if (completionReason.includes("SIP")) {
          confirmPunishmentText.textContent =
            "Has " + getPlayerUsername(punishedPlayer) + " taken " +
            completionReason.replace("_", " ");
        }
        else {
          confirmPunishmentText.textContent =
            "Has " + getPlayerUsername(punishedPlayer) + " completed their punishment";
        }

        setActiveContainers(confirmPunishmentContainer);
      }
    } else if (!isContainerVisible(waitingForPlayersContainer)) {
      setActiveContainers(waitingForPlayersContainer);
    }
  } else {
    players.forEach((player, i) => {
      const pState = getPlayerState(player);
      if (pState.hasConfirmed && icons[i]) {
        icons[i].classList.add('yes');
      }
    });
    setActiveContainers(waitingForPlayersContainer);
  }
}

async function ChosePunishment(instruction) {
  const players = currentPartyData.players || [];
  const state   = getPartyState(currentPartyData);
  const { phaseData } = getParanoiaPhaseState();
  const playerTurn = state.playerTurn ?? currentPartyData.playerTurn ?? 0;
  const turnPlayer = players[playerTurn];
  if (!turnPlayer) return;

  const target = getParanoiaTargetPlayer();
  if (!target) return;

  const punishmentType = String(phaseData?.punishmentType ?? '').toUpperCase();
  const index = players.findIndex(player => getPlayerId(player) === getPlayerId(target));
  currentPlayer = target;

  if (getPlayerId(target) === deviceId) {
    if (punishmentType === "COIN_FLIP") {
      if (coinFlipInProgress || isContainerVisible(luckyCoinFlipContainer)) {
        setActiveContainers(luckyCoinFlipContainer);
      } else {
        setActiveContainers(pickHeadsOrTailsContainer);
      }
    }
    else if (punishmentType === "DRINK_WHEEL") {
      if (typeof resetDrinkWheelState === 'function') {
        resetDrinkWheelState();
      }
      setActiveContainers(drinkWheelContainer);
    }
    else if (punishmentType === "DOWN_IT") {
      if (index === playerTurn) {
        completePunishmentText.textContent =
          "Down your drink. (if you refuse, the question will be passed to the next player and you will lose double points)";
      } else {
        completePunishmentText.textContent =
          "In order to find out the question you have to down your drink.";
      }
      completePunishmentContainer.setAttribute("punishment-type", "DOWN_IT");
      setActiveContainers(completePunishmentContainer);
    }
    else {
      const readablePunishment = formatParanoiaPunishmentText(punishmentType);
      if (index === playerTurn) {
        completePunishmentText.textContent =
          `take ${readablePunishment}. (if you refuse, the question will be passed to the next player and you will lose double points)`;
      } else {
        completePunishmentText.textContent =
          `In order to find out the question you have to take ${readablePunishment}.`;
      }
      completePunishmentContainer.setAttribute("punishment-type", punishmentType);
      setActiveContainers(completePunishmentContainer);
    }
  } else {
    let currentWaitingForPlayerText;
    if (punishmentType === "COIN_FLIP") {
      currentWaitingForPlayerText = "Flipping coin...";
    }
    else if (punishmentType === "DRINK_WHEEL") {
      currentWaitingForPlayerText = "Spinning drink wheel...";
    }
    else {
      currentWaitingForPlayerText = "Reading punishment...";
    }
    SetWaitingForPlayer({
      waitingForRoomTitle: "Waiting for " + getPlayerUsername(target),
      waitingForRoomText: currentWaitingForPlayerText,
      player: target
    });
    setActiveContainers(waitingForPlayerContainer);
  }
}

async function UserSelectedForPunishment(instruction) {
  return ChoosingPunishment();
}

async function ChoosingPunishment() {
  timeout?.cancel();
  stopTimerForContainer(waitingForPlayerContainer, 'waitingForPlayerContainer');

  const state = getPartyState(currentPartyData);
  const target = getParanoiaTargetPlayer();
  const delay = new Date(state?.timer ?? Date.now()) - Date.now();

  if (!target) return;

  startTimerWithContainer({
    container: selectPunishmentContainer,
    label: 'selectPunishmentContainer',
    timeLeft: delay / 1000,
    duration: gameRules["time-limit"]
  });
  startTimerWithContainer({
    container: waitingForPlayerContainer,
    label: 'waitingForPlayerContainer',
    timeLeft: delay / 1000,
    duration: gameRules["time-limit"]
  });

  scheduleParanoiaPhaseAction({
    delay,
    action: 'paranoia-handle-phase-timeout',
    payload: {
      roundTimer: Date.now() + gameRules["time-limit"] * 1000
    }
  });

  currentPlayer = target;

  if (getPlayerId(target) === deviceId) {
    setActiveContainers(selectPunishmentContainer);
  } else {
    SetWaitingForPlayer({
      waitingForRoomTitle: "Waiting for " + getPlayerUsername(target),
      waitingForRoomText: "Choosing Punishment...",
      player: target
    });
    setActiveContainers(waitingForPlayerContainer);
  }
}

async function DisplayDualStackCard() {
  const players = currentPartyData.players || [];
  const state = getPartyState(currentPartyData);
  const deck = getPartyDeck(currentPartyData);
  const authoritativeHostId = state?.hostComputerId ?? hostDeviceId;
  const meIndex = players.findIndex(player => getPlayerId(player) === deviceId);
  const playerTurn = state.playerTurn ?? currentPartyData.playerTurn ?? 0;
  const currentPlayer = players[playerTurn];
  const revealTargetId = state?.phaseData?.revealTargetId ?? state?.phaseData?.targetId ?? null;
  const votedId = currentPlayer ? (getPlayerVote(currentPlayer) ?? revealTargetId) : revealTargetId;
  const votedPlayer = players.find(player => getPlayerId(player) === votedId) ?? null;
  const icons = waitingForPlayersIconContainer.querySelectorAll('.icon');

  if (meIndex === -1) {
    console.warn("Device not found in players.");
    return;
  }

  const meState = getPlayerState(players[meIndex]);

  if (meState?.hasConfirmed === true) {
    setActiveContainers(waitingForPlayersContainer);

    const meConn = ensureConnection(players[meIndex]);
    meConn.lastPing = new Date();
    players[meIndex].lastPing = meConn.lastPing;

    players.forEach((player, i) => {
      const playerState = getPlayerState(player);
      if (playerState?.hasConfirmed && icons[i]) {
        icons[i].classList.add('yes');
      }
    });

    const allReady = players.every(player => getPlayerState(player).hasConfirmed === true);
    if (allReady) {
      icons.forEach(icon => icon.classList.add('yes'));
      await new Promise(resolve => setTimeout(resolve, 1500));

      if (deviceId === authoritativeHostId) {
        await ResetParanoiaQuestion({
          nextPlayer: true,
          incrementScore: 1
        });
      }
    }

    return;
  }

  if (!currentPlayer || !votedPlayer) {
    console.warn('Missing current or voted player for paranoia dual stack reveal.');
    return;
  }

  EditUserIconPartyGames({
    container: gameContainerDualStack.querySelector('.dual-image-stack#dual-image-stack-1'),
    userId: getPlayerId(currentPlayer),
    userCustomisationString: getPlayerIcon(currentPlayer)
  });

  EditUserIconPartyGames({
    container: gameContainerDualStack.querySelector('.dual-image-stack#dual-image-stack-2'),
    userId: getPlayerId(votedPlayer),
    userCustomisationString: getPlayerIcon(votedPlayer)
  });

  const currentIndex = deck.currentCardIndex ?? currentPartyData.currentCardIndex ?? 0;
  selectedQuestionObj = getNextQuestion(currentIndex);
  DisplayCard(gameContainerDualStack, selectedQuestionObj);
  setActiveContainers(gameContainerDualStack);
  ClearIcons();
}

async function ResetParanoiaQuestion({
  currentPlayerIndex = null,
  nextPlayer = true,
  incrementScore = 0
}) {
  ClearIcons();

  const players = currentPartyData.players || [];

  if (players.length === 0) return;

  const state   = getPartyState(currentPartyData);
  const playerTurn = state.playerTurn ?? currentPartyData.playerTurn ?? 0;

  if (currentPlayerIndex == null) {
    const turnPlayer = players[playerTurn];
    const votedId = getPlayerVote(turnPlayer);

    if (votedId == null) {
      currentPlayerIndex = playerTurn;
    } else {
      currentPlayerIndex = players.findIndex(p => getPlayerId(p) === votedId);
      if (currentPlayerIndex === -1) currentPlayerIndex = playerTurn;
    }
  }
  await ResetQuestion({
    instruction: "DISPLAY_PRIVATE_CARD:READING_CARD",
    timer: Date.now() + gameRules["time-limit"] * 1000,
    playerIndex: currentPlayerIndex,
    nextPlayer,
    incrementScore
  });
}

async function PartySkip({ nextPlayer = true } = {}) {
  await ResetParanoiaQuestion({ nextPlayer });
}
