async function DisplayPunishmentToUser(instruction) {
  const players = currentPartyData.players || [];
  const parsedInstructions = parseInstruction(instruction);
  const delay = getParanoiaPhaseDelay();
  const punishmentType = String(parsedInstructions.reason ?? '').toUpperCase();
  const punishedPlayer = players.find(
    player => getPlayerId(player) === parsedInstructions.deviceId
  ) ?? getParanoiaTargetPlayer();
  const punishedPlayerId = parsedInstructions.deviceId ?? getPlayerId(punishedPlayer);

  syncParanoiaTimerWarning(
    getPartyState(currentPartyData),
    String(punishedPlayerId) === String(deviceId),
    'perform-punishment'
  );

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

    startParanoiaPhaseTimer(completePunishmentContainer, 'completePunishmentContainer', delay);
    setActiveContainers(completePunishmentContainer);
    return;
  }

  SetWaitingForPlayer({
    waitingForRoomTitle: "Waiting for " + (punishedPlayer ? getPlayerUsername(punishedPlayer) : "player"),
    waitingForRoomText: "Showing player punishment...",
    player: punishedPlayer ?? null
  });
  startParanoiaPhaseTimer(waitingForPlayerContainer, 'waitingForPlayerContainer', delay);
  setActiveContainers(waitingForPlayerContainer);
}

async function PunishmentOffer(instruction) {
  return;
}

async function UserHasPassed(instruction) {
  stopParanoiaTimerWarning();

  const players = currentPartyData.players || [];
  const state = getPartyState(currentPartyData);
  const { phaseData } = getParanoiaPhaseState();
  const authoritativeHostId = state?.hostComputerId ?? hostDeviceId;

  const parsedInstructions = parseInstruction(instruction);
  const playerTurn = state.playerTurn ?? currentPartyData.playerTurn ?? 0;
  const turnPlayer = getParanoiaTurnPlayer(players, state, playerTurn);
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
  const delay = getParanoiaPhaseDelay();

  if (!punishedPlayer || meIndex === -1) {
    stopParanoiaTimerWarning();
    return;
  }

  startParanoiaPhaseTimers([
    { container: confirmPunishmentContainer, label: 'confirmPunishmentContainer' },
    { container: waitingForPlayersContainer, label: 'waitingForPlayersContainer' }
  ], delay);
  scheduleParanoiaCurrentPhaseTimeout(delay);

  const meState = getPlayerState(players[meIndex]);
  syncParanoiaTimerWarning(
    getPartyState(currentPartyData),
    getPlayerId(punishedPlayer) !== deviceId && meState.isReady !== true,
    'confirm-punishment'
  );

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
    SetWaitingForPlayersIconStates(players, true);
    setActiveContainers(waitingForPlayersContainer);
  }
}

async function ChosePunishment(instruction) {
  const players = currentPartyData.players || [];
  const state = getPartyState(currentPartyData);
  const { phaseData } = getParanoiaPhaseState();
  const delay = getParanoiaPhaseDelay();
  const playerTurn = state.playerTurn ?? currentPartyData.playerTurn ?? 0;
  const turnPlayer = getParanoiaTurnPlayer(players, state, playerTurn);
  if (!turnPlayer) {
    stopParanoiaTimerWarning();
    return;
  }

  const target = getParanoiaTargetPlayer();
  if (!target) {
    stopParanoiaTimerWarning();
    return;
  }

  syncParanoiaTimerWarning(
    state,
    getPlayerId(target) === deviceId,
    'perform-punishment'
  );

  const punishmentType = String(phaseData?.punishmentType ?? '').toUpperCase();
  const index = players.findIndex(player => getPlayerId(player) === getPlayerId(target));
  const turnPlayerIndex = getParanoiaTurnPlayerIndex(players, state, playerTurn);
  currentPlayer = target;

  startParanoiaPhaseTimers([
    { container: pickHeadsOrTailsContainer, label: 'pickHeadsOrTailsContainer' },
    {
      container: typeof luckyCoinFlipContainer === 'undefined' ? null : luckyCoinFlipContainer,
      label: 'luckyCoinFlipContainer'
    },
    {
      container: typeof drinkWheelContainer === 'undefined' ? null : drinkWheelContainer,
      label: 'drinkWheelContainer'
    },
    { container: completePunishmentContainer, label: 'completePunishmentContainer' },
    { container: waitingForPlayerContainer, label: 'waitingForPlayerContainer' }
  ], delay);
  scheduleParanoiaCurrentPhaseTimeout(delay);

  if (getPlayerId(target) === deviceId) {
    if (punishmentType === "COIN_FLIP") {
      if (coinFlipInProgress || isContainerVisible(luckyCoinFlipContainer)) {
        startParanoiaPhaseTimer(luckyCoinFlipContainer, 'luckyCoinFlipContainer', delay);
        setActiveContainers(luckyCoinFlipContainer);
      } else {
        startParanoiaPhaseTimer(pickHeadsOrTailsContainer, 'pickHeadsOrTailsContainer', delay);
        setActiveContainers(pickHeadsOrTailsContainer);
      }
    }
    else if (punishmentType === "DRINK_WHEEL") {
      const wheelIsAlreadyActive =
        (typeof spinning !== 'undefined' && spinning === true) ||
        isContainerVisible(drinkWheelContainer);

      if (!wheelIsAlreadyActive && typeof resetDrinkWheelState === 'function') {
        resetDrinkWheelState();
      }
      startParanoiaPhaseTimer(drinkWheelContainer, 'drinkWheelContainer', delay);
      setActiveContainers(drinkWheelContainer);
    }
    else if (punishmentType === "DOWN_IT") {
      if (index === turnPlayerIndex) {
        completePunishmentText.textContent =
          "Down your drink. (if you refuse, the question will be passed to the next player and you will lose double points)";
      } else {
        completePunishmentText.textContent =
          "In order to find out the question you have to down your drink.";
      }
      completePunishmentContainer.setAttribute("punishment-type", "DOWN_IT");
      startParanoiaPhaseTimer(completePunishmentContainer, 'completePunishmentContainer', delay);
      setActiveContainers(completePunishmentContainer);
    }
    else {
      const readablePunishment = formatParanoiaPunishmentText(punishmentType);
      if (index === turnPlayerIndex) {
        completePunishmentText.textContent =
          `take ${readablePunishment}. (if you refuse, the question will be passed to the next player and you will lose double points)`;
      } else {
        completePunishmentText.textContent =
          `In order to find out the question you have to take ${readablePunishment}.`;
      }
      completePunishmentContainer.setAttribute("punishment-type", punishmentType);
      startParanoiaPhaseTimer(completePunishmentContainer, 'completePunishmentContainer', delay);
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
    startParanoiaPhaseTimer(waitingForPlayerContainer, 'waitingForPlayerContainer', delay);
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

  if (!target) {
    stopParanoiaTimerWarning();
    return;
  }

  syncParanoiaTimerWarning(
    state,
    getPlayerId(target) === deviceId,
    'choose-punishment'
  );

  if (
    getPlayerId(target) === deviceId &&
    getParanoiaSelectablePunishmentButtons().length === 0
  ) {
    await handleSelectPunishmentPassClick();
    return;
  }

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
