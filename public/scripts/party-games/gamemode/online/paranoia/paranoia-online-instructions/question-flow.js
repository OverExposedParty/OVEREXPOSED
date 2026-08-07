async function NextQuestion() {
  const players = currentPartyData.players || [];
  const currentParticipants =
    typeof getParanoiaCurrentParticipants === 'function'
      ? getParanoiaCurrentParticipants(currentPartyData)
      : players;
  const state = getPartyState(currentPartyData);
  const deck = getPartyDeck(currentPartyData);
  const delay = getParanoiaPhaseDelay();

  const meIndex = players.findIndex(p => getPlayerId(p) === deviceId);
  const playerTurn = state.playerTurn ?? currentPartyData.playerTurn ?? 0;
  const currentPlayer = getParanoiaTurnPlayer(players, state, playerTurn);

  const votedId = getPlayerVote(currentPlayer);
  const votedIndex = votedId != null
    ? players.findIndex(p => getPlayerId(p) === votedId)
    : -1;

  const votedPlayer = votedIndex !== -1 ? players[votedIndex] : null;

  if (meIndex === -1) {
    stopParanoiaTimerWarning();
    console.warn("Device not found in players.");
    return;
  }

  const icons = waitingForPlayersIconContainer.querySelectorAll('.icon');
  const meState = getPlayerState(players[meIndex]);

  syncParanoiaTimerWarning(
    state,
    meState.hasConfirmed !== true,
    'reveal'
  );

  if (meState.hasConfirmed === true) {
    if (!isContainerVisible(waitingForPlayersContainer)) {
      ClearIcons();
    }
    startParanoiaPhaseTimer(waitingForPlayersContainer, 'waitingForPlayersContainer', delay);
    scheduleParanoiaRevealTimeout(delay);

    const meConn = ensureConnection(players[meIndex]);
    meConn.lastPing = new Date();
    players[meIndex].lastPing = meConn.lastPing;

    SetWaitingForPlayersIconStates(players, true);
    setActiveContainers(waitingForPlayersContainer);

    const allReady = currentParticipants.every(
      p => getPlayerState(p).hasConfirmed === true
    );

    if (allReady) {
      icons.forEach(icon => icon.classList.add('yes'));
      await new Promise(resolve => setTimeout(resolve, 1500));

      await ResetParanoiaQuestion({
        nextPlayer: true,
        incrementScore: 1
      });
    }
    else if (!isContainerVisible(waitingForPlayersContainer)) {
      await SendInstruction({});
    }
  } else {
    if (!currentPlayer || !votedPlayer) {
      stopParanoiaTimerWarning();
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
    startTimerFromContainer({
      container: gameContainerDualStack,
      timeLeft: delay / 1000,
      duration: getParanoiaPhaseDuration()
    });
    startParanoiaPhaseTimer(waitingForPlayersContainer, 'waitingForPlayersContainer', delay);
    scheduleParanoiaRevealTimeout(delay);
    setActiveContainers(gameContainerDualStack);
  }
}

async function DisplayPrivateCard(instruction) {
  const state = getPartyState(currentPartyData);
  const players = currentPartyData.players || [];
  if (typeof renderParanoiaTargetButtons === 'function') {
    renderParanoiaTargetButtons(currentPartyData);
  }
  const hasPunishmentOptions = getParanoiaSelectablePunishmentButtons().length > 0;
  const punishmentTimeoutPromise = !hasPunishmentOptions
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

  if (!hasPunishmentOptions) {
    SetTimeOut({ delay: delay, instruction: "RESET_QUESTION:TIME_EXPIRED", nextDelay: null });
  }

  const parsedInstructions = parseInstruction(instruction);
  const playerTurn = state.playerTurn ?? currentPartyData.playerTurn ?? 0;
  const currentPlayer = getParanoiaTurnPlayer(players, state, playerTurn);

  if (!currentPlayer) {
    stopParanoiaTimerWarning();
    console.warn('Current player not found in DisplayPrivateCard');
    return;
  }

  const currentPlayerId = getPlayerId(currentPlayer);

  syncParanoiaTimerWarning(
    state,
    currentPlayerId === deviceId && getPlayerState(currentPlayer).hasConfirmed !== true,
    'select-target'
  );

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

async function DisplayDualStackCard() {
  const players = currentPartyData.players || [];
  const currentParticipants =
    typeof getParanoiaCurrentParticipants === 'function'
      ? getParanoiaCurrentParticipants(currentPartyData)
      : players;
  const state = getPartyState(currentPartyData);
  const deck = getPartyDeck(currentPartyData);
  const meIndex = players.findIndex(player => getPlayerId(player) === deviceId);
  const playerTurn = state.playerTurn ?? currentPartyData.playerTurn ?? 0;
  const currentPlayer = getParanoiaTurnPlayer(players, state, playerTurn);
  const revealTargetId = state?.phaseData?.revealTargetId ?? state?.phaseData?.targetId ?? null;
  const votedId = currentPlayer ? (getPlayerVote(currentPlayer) ?? revealTargetId) : revealTargetId;
  const votedPlayer = players.find(player => getPlayerId(player) === votedId) ?? null;
  const icons = waitingForPlayersIconContainer.querySelectorAll('.icon');
  const delay = getParanoiaPhaseDelay();

  startParanoiaPhaseTimer(waitingForPlayersContainer, 'waitingForPlayersContainer', delay);
  scheduleParanoiaRevealTimeout(delay);

  if (meIndex === -1) {
    stopParanoiaTimerWarning();
    console.warn("Device not found in players.");
    return;
  }

  const meState = getPlayerState(players[meIndex]);

  syncParanoiaTimerWarning(
    state,
    meState?.hasConfirmed !== true,
    'reveal'
  );

  if (meState?.hasConfirmed === true) {
    const meConn = ensureConnection(players[meIndex]);
    meConn.lastPing = new Date();
    players[meIndex].lastPing = meConn.lastPing;

    SetWaitingForPlayersIconStates(players, true);
    setActiveContainers(waitingForPlayersContainer);

    const allReady = currentParticipants.every(
      player => getPlayerState(player).hasConfirmed === true
    );
    if (allReady) {
      icons.forEach(icon => icon.classList.add('yes'));
      await new Promise(resolve => setTimeout(resolve, 1500));

      await ResetParanoiaQuestion({
        nextPlayer: true,
        incrementScore: 1
      });
    }

    return;
  }

  if (!currentPlayer || !votedPlayer) {
    stopParanoiaTimerWarning();
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
  startTimerFromContainer({
    container: gameContainerDualStack,
    timeLeft: delay / 1000,
    duration: getParanoiaPhaseDuration()
  });
  setActiveContainers(gameContainerDualStack);
  ClearIcons();
}
