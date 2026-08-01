async function ChoosingPunishment() {
  const state = currentPartyData.state ?? currentPartyData;
  const players = currentPartyData.players || [];

  const delay = new Date(state.timer) - Date.now();
  const durationSeconds = gameRules["time-limit"];

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

  scheduleTruthOrDarePhaseAction({
    delay,
    action: 'truth-or-dare-handle-punishment-timeout',
    payload: {
      roundTimer: Date.now() + gameRules["time-limit"] * 1000
    }
  });

  const turnIndex = state.playerTurn ?? 0;
  const currentPlayer = getTruthOrDareTurnPlayer(players, state, turnIndex);
  if (!currentPlayer) {
    stopTruthOrDareTimerWarning();
    console.error('Player not found for current turn index:', turnIndex);
    return;
  }

  const currentPlayerId = getTruthOrDarePlayerId(currentPlayer);
  const currentPlayerUsername = getPlayerUsername(currentPlayer);
  const currentPlayerIcon = getPlayerIcon(currentPlayer);

  syncTruthOrDareTimerWarning(
    state,
    currentPlayerId === deviceId,
    'choose-punishment'
  );

  if (currentPlayerId === deviceId) {
    setActiveContainers(selectPunishmentContainer);
  } else {
    SetWaitingForPlayer({
      waitingForRoomTitle: "Waiting for " + currentPlayerUsername,
      waitingForRoomText: "Choosing Punishment...",
      player: {
        ...currentPlayer,
        username: currentPlayerUsername,
        userIcon: currentPlayerIcon,
        computerId: currentPlayerId
      }
    });
    setActiveContainers(waitingForPlayerContainer);
  }
}

async function UserSelectedForPunishment(instruction) {
  return ChoosingPunishment();
}

async function DisplayPunishmentToUser(instruction) {
  const state = currentPartyData.state ?? currentPartyData;
  const players = currentPartyData.players || [];
  const { phaseData } = getTruthOrDarePhaseState();
  const delay = getTruthOrDarePhaseDelay();
  const currentInstruction = typeof instruction === 'string'
    ? instruction
    : getUserInstructions(currentPartyData);

  const turnIndex = state.playerTurn ?? 0;
  const currentPlayer = getTruthOrDareTurnPlayer(players, state, turnIndex);
  debugLog('[OE_DEBUG][truth-or-dare][DisplaySelectQuestionType][pre-render]', {
    playersLength: players.length,
    turnIndex,
    currentPlayer,
    playerIds: players.map(player => player?.identity?.computerId ?? player?.computerId ?? null)
  });
  if (!currentPlayer) {
    stopTruthOrDareTimerWarning();
    return;
  }

  const currentPlayerId = getTruthOrDarePlayerId(currentPlayer);
  const currentPlayerUsername = getPlayerUsername(currentPlayer);
  const punishmentType = getTruthOrDareResolvedPunishmentType(currentInstruction, phaseData);

  syncTruthOrDareTimerWarning(
    state,
    currentPlayerId === deviceId,
    'perform-punishment'
  );

  if (currentPlayerId == deviceId) {
    if (punishmentType === "DRINK_WHEEL") {
      const wheelContainer = typeof drinkWheelContainer !== 'undefined'
        ? drinkWheelContainer
        : document.querySelector('#drink-wheel-container');

      if (!wheelContainer) {
        if (typeof AddGamemodeContainers === 'function') {
          AddGamemodeContainers('drink-wheel');
        }
        SetWaitingForPlayer({
          waitingForRoomTitle: "Preparing punishment...",
          waitingForRoomText: "Loading drink wheel...",
          player: currentPlayer
        });
        setActiveContainers(waitingForPlayerContainer);
        setTimeout(async () => {
          try {
            if (typeof runOnlineFetchInstructions === 'function') {
              await runOnlineFetchInstructions({
                force: true,
                reason: 'drink-wheel-container-ready'
              });
            } else if (typeof FetchInstructions === 'function') {
              await FetchInstructions();
            }
          } catch (error) {
            console.error('Failed to refresh Truth or Dare punishment UI:', error);
          }
        }, 250);
        return;
      }

      if (typeof resetDrinkWheelState === 'function') {
        resetDrinkWheelState();
      }
      startTruthOrDarePhaseTimer(wheelContainer, 'drinkWheelContainer', delay);
      setActiveContainers(wheelContainer);
      return;
    }

    hideTruthOrDareDrinkWheel();

    completePunishmentText.textContent =
      formatTruthOrDarePunishmentText(punishmentType);
    completePunishmentContainer.setAttribute(
      "punishment-type",
      punishmentType == "DOWN_IT" || punishmentType == "DOWN-IT"
        ? "DOWN_IT"
        : punishmentType
    );
    startTruthOrDarePhaseTimer(completePunishmentContainer, 'completePunishmentContainer', delay);
    setActiveContainers(completePunishmentContainer);
  } else {
    let waitingText;
    if (punishmentType === "DRINK_WHEEL") {
      waitingText = `Waiting for ${currentPlayerUsername} to spin the drink wheel.`;
    } else if (punishmentType == "DOWN_IT" || punishmentType == "DOWN-IT") {
      hideTruthOrDareDrinkWheel();
      waitingText = `Waiting for ${currentPlayerUsername} to down their drink.`;
    } else {
      hideTruthOrDareDrinkWheel();
      waitingText =
        `Waiting for ${currentPlayerUsername} to ` +
        formatTruthOrDarePunishmentText(punishmentType).toLowerCase();
    }
    SetWaitingForPlayer({
      waitingForRoomTitle: "Waiting for " + currentPlayerUsername,
      waitingForRoomText: waitingText,
      player: currentPlayer
    });
    startTruthOrDarePhaseTimer(waitingForPlayerContainer, 'waitingForPlayerContainer', delay);
    setActiveContainers(waitingForPlayerContainer);
  }
}
