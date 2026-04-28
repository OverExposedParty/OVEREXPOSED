function GetQuestion({ cardTitle, currentPartyData }) {
  const config = getPartyConfig(currentPartyData);
  const deck = getPartyDeck(currentPartyData);

  const questionType = deck.questionType;
  const shuffleSeed = config.shuffleSeed;

  if (questionType == "truth") {
    const index = deck.currentCardIndex ?? currentPartyData.currentCardIndex ?? 0;
    cardTitle.src = "/images/party-games/truth-or-dare/truth-text.svg";
    return getNextQuestion(index, "truth", shuffleSeed);
  } else if (questionType == "dare") {
    const index = deck.currentCardSecondIndex ?? currentPartyData.currentCardSecondIndex ?? 0;
    cardTitle.src = "/images/party-games/truth-or-dare/dare-text.svg";
    return getNextQuestion(index, "dare", shuffleSeed);
  } else {
    console.warn("Unknown questionType:", questionType);
    return;
  }
}

function getTruthOrDareInstructionFallback() {
  const instructions = getUserInstructions(currentPartyData);
  if (typeof instructions === 'string' && instructions.trim() !== '') {
    return instructions;
  }

  const state = getPartyState(currentPartyData);
  if (state?.phase === 'truth-or-dare-choose-punishment') {
    return 'DISPLAY_CHOOSE_PUNISHMENT';
  }

  if (state?.phase === 'truth-or-dare-show-punishment') {
    return 'DISPLAY_SHOW_PUNISHMENT';
  }

  return 'DISPLAY_SELECT_QUESTION_TYPE';
}

async function syncTruthOrDarePartyAndRender(updatedParty) {
  if (!updatedParty) {
    return false;
  }

  currentPartyData = updatedParty;

  if (typeof FetchInstructions === 'function') {
    await runOnlineFetchInstructions({ reason: 'reset-question' });
  }

  return true;
}

async function FetchInstructions() {
  currentPartyData = await GetCurrentPartyData({ requireInstructions: true, retries: 8, delayMs: 150 });
  if (!currentPartyData) {
    PartyDisbanded();
    return;
  }

  try {
    if (typeof scoreboardContainer !== 'undefined' && scoreboardContainer) {
      await UpdatePartyGameStatistics();
    }
  } catch (error) {
    console.warn('Truth or Dare statistics update skipped during render:', error);
  }
  const phase = getPartyState(currentPartyData)?.phase ?? null;
  const instructions = getTruthOrDareInstructionFallback();
  const state = getPartyState(currentPartyData);
  const players = currentPartyData.players || [];
  const turnIndex = state?.playerTurn ?? 0;
  const turnPlayer = typeof getTruthOrDareTurnPlayer === 'function'
    ? getTruthOrDareTurnPlayer(players, state, turnIndex)
    : players[turnIndex];
  const turnPlayerId = turnPlayer?.identity?.computerId ?? turnPlayer?.computerId ?? null;
  debugLog('[OE_DEBUG][truth-or-dare][FetchInstructions][players]', {
    playersLength: players.length,
    playerIds: players.map(player => player?.identity?.computerId ?? player?.computerId ?? null)
  });
  debugLog('[OE_DEBUG][truth-or-dare][FetchInstructions]', {
    deviceId,
    hostDeviceId,
    phase,
    instructions,
    playerTurn: turnIndex,
    turnPlayerId,
    isCurrentTurn: turnPlayerId === deviceId
  });
  if (phase === 'truth-or-dare-choose-punishment') {
    ChoosingPunishment();
    return;
  }
  else if (phase === 'truth-or-dare-show-punishment') {
    DisplayPunishmentToUser(instructions);
    return;
  }
  if (instructions.includes("DISPLAY_SELECT_QUESTION_TYPE")) {
    DisplaySelectQuestionType();
  }
  else if (instructions.includes("DISPLAY_COMPLETE_QUESTION")) {
    DisplayCompleteQuestion();
  }
  else if (instructions.includes("DISPLAY_PUBLIC_CARD")) {
    DisplayPublicCard();
  }
  else if (instructions.includes("DISPLAY_ANSWER_CARD")) {
    DisplayAnswerCard(instructions);
  }
  else if (instructions.includes("DISPLAY_CONFIRM_INPUT")) {
    DisplayConfirmInput(instructions);
  }
  else if (instructions.includes("GAME_OVER")) {
    SetPartyGameStatisticsGameOver();
  }
  else if (instructions.includes("RESET_QUESTION")) {
    if (instructions.includes("TIMER_EXPIRED:2")) {
      await ResetTruthOrDareQuestion({ force: true, nextPlayer: true, incrementScore: 0, byPassHost: false });
    }
    else if (instructions.includes("TIMER_EXPIRED")) {
      await ResetTruthOrDareQuestion({ force: true, nextPlayer: true, incrementScore: 0, byPassHost: false });
    }
    else {
      await ResetTruthOrDareQuestion({ force: true, nextPlayer: true, byPassHost: false });
    }
  }
  debugLog(`FETCHING ${instructions}`);
}
