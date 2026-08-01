async function UserHasPassed(instruction) {
  stopTruthOrDareTimerWarning();

  const players = currentPartyData.players || [];
  const parsedInstructions = parseInstruction(instruction);

  const index = players.findIndex(
    player => getTruthOrDarePlayerId(player) === parsedInstructions.deviceId
  );
  if (index === -1) return;

  const passedPlayer = players[index];
  const username = getPlayerUsername(passedPlayer);

  SetPlayerHasPassed({
    playerHasPassedTitleText: username + " has passed",
    playerHasPassedReasonText: "Question not answered",
    player: passedPlayer
  });
  setActiveContainers(playerHasPassedContainer);

  await new Promise(resolve => setTimeout(resolve, 1000));

  if (deviceId === parsedInstructions.deviceId) {
    const updatedParty = await performOnlinePartyAction({
      action: 'truth-or-dare-reset-round',
      payload: {
        force: true,
        nextPlayer: true,
        incrementScore: 0,
        timer: Date.now() + gameRules["time-limit"] * 1000
      }
    });

    await syncTruthOrDarePartyAndRender(updatedParty);
  }
}

async function DisplayCompleteQuestion() {
  timeout?.cancel();
  stopTimerForContainer(waitingForPlayerContainer, 'waitingForPlayerContainer');

  const players = currentPartyData.players || [];
  const deck = currentPartyData.deck ?? currentPartyData;

  const index = players.findIndex(player => getTruthOrDarePlayerId(player) === deviceId);
  const state = currentPartyData.state ?? currentPartyData;
  const turnIndex = state.playerTurn ?? 0;
  const currentPlayer = getTruthOrDareTurnPlayer(players, state, turnIndex);
  if (!currentPlayer) {
    stopTruthOrDareTimerWarning();
    return;
  }

  const currentPlayerId = getTruthOrDarePlayerId(currentPlayer);
  const currentPlayerUsername = getPlayerUsername(currentPlayer);

  selectedQuestionObj = GetQuestion({
    cardTitle: gameContainerPublicTitle,
    currentPartyData
  });

  const questionType = deck.questionType ?? currentPartyData.questionType;

  syncTruthOrDareTimerWarning(
    state,
    deviceId == currentPlayerId,
    'complete-prompt'
  );

  if (deviceId == currentPlayerId) {
    completePromptTitle.textContent = questionType.toUpperCase();
    completePromptText.textContent = selectedQuestionObj.question;
    setActiveContainers(completPromptContainer);
  } else {
    SetWaitingForPlayer({
      waitingForRoomTitle: "Waiting for " + currentPlayerUsername,
      waitingForRoomText: "Performing Question...",
      player: currentPlayer
    });
    setActiveContainers(waitingForPlayerContainer);
  }
}
