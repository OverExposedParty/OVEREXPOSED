function GetQuestion({ cardTitle, currentPartyData }) {
  const config = getPartyConfig(currentPartyData);
  const deck = getPartyDeck(currentPartyData);

  const questionType = deck.questionType;
  const shuffleSeed = config.shuffleSeed;

  if (questionType == "truth") {
    const index = deck.currentCardIndex ?? currentPartyData.currentCardIndex ?? 0;
    updateGamemodeTextSvgSource(
      cardTitle,
      "/images/party-games/truth-or-dare/truth-text.svg",
      "truth"
    );
    return getNextQuestion(index, "truth", shuffleSeed);
  } else if (questionType == "dare") {
    const index = deck.currentCardSecondIndex ?? currentPartyData.currentCardSecondIndex ?? 0;
    updateGamemodeTextSvgSource(
      cardTitle,
      "/images/party-games/truth-or-dare/dare-text.svg",
      "dare"
    );
    return getNextQuestion(index, "dare", shuffleSeed);
  } else {
    console.warn("Unknown questionType:", questionType);
    return;
  }
}

function getTruthOrDareInstructionFallback() {
  const instructions = getUserInstructions(currentPartyData);
  if (typeof instructions === 'string' && instructions.trim() !== '') {
    // Redirect parties that were already in the retired written-answer flow.
    if (
      instructions.includes('DISPLAY_ANSWER_CARD') ||
      instructions.includes('DISPLAY_CONFIRM_INPUT')
    ) {
      return 'DISPLAY_COMPLETE_QUESTION';
    }
    return instructions;
  }

  const state = getPartyState(currentPartyData);
  if (state?.phase === 'truth-or-dare-choose-punishment') {
    return 'DISPLAY_CHOOSE_PUNISHMENT';
  }

  if (state?.phase === 'truth-or-dare-show-punishment') {
    return 'DISPLAY_SHOW_PUNISHMENT';
  }

  if (state?.phase === 'truth-or-dare-prompt-heist') {
    return 'DISPLAY_PROMPT_HEIST';
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

function formatTruthOrDareTimelineEvent(event = {}, players = []) {
  const player = players.find(
    (item) => String(getTruthOrDarePlayerId(item)) === String(event.playerId)
  );
  const playerName = event.playerName || (player ? getPlayerUsername(player) : 'Player');
  const questionType = String(event.questionType || '').toLowerCase();
  const punishmentType = String(event.punishmentType || '')
    .replaceAll('_', ' ')
    .replaceAll('-', ' ')
    .toLowerCase();

  switch (event.type) {
    case 'choosing-question-type':
      return `${playerName} choosing truth or dare`;
    case 'question-type-selected':
      return `${playerName} chose ${questionType || 'truth or dare'}`;
    case 'deciding-answer-or-pass':
      return `${playerName} deciding answer or pass`;
    case 'doing-prompt':
      return `${playerName} completing prompt`;
    case 'prompt-passed':
      return `${playerName} passed`;
    case 'prompt-heist-opened':
      return 'Prompt heist opened';
    case 'prompt-heist-claimed':
      return `${playerName} stole the prompt`;
    case 'prompt-heist-expired':
      return 'Prompt heist expired';
    case 'choosing-punishment':
      return `${playerName} choosing punishment`;
    case 'punishment-selected':
      return punishmentType
        ? `${playerName} chose ${punishmentType}`
        : `${playerName} chose punishment`;
    case 'punishment-completed':
      return `${playerName} completed punishment`;
    case 'prompt-timed-out':
      return `${playerName} timed out`;
    case 'punishment-timed-out':
      return `${playerName} punishment timed out`;
    case 'prompt-completed':
      return `${playerName} completed ${questionType || 'prompt'}`;
    default:
      return null;
  }
}

function getTruthOrDareTimelinePlayerIcon(event = {}, players = []) {
  if (event.playerIcon) {
    return event.playerIcon;
  }

  const player = players.find(
    (item) => String(getTruthOrDarePlayerId(item)) === String(event.playerId)
  );
  return getPlayerIcon(player) || '';
}

function createTruthOrDareTimelineMarker(event = {}, players = []) {
  const marker = document.createElement('span');
  marker.className = 'next-round-join-timeline-dot';

  const playerIcon = getTruthOrDareTimelinePlayerIcon(event, players);
  if (!playerIcon || typeof CreateImageStack !== 'function') {
    marker.setAttribute('aria-hidden', 'true');
    return marker;
  }

  const parsed = parseCustomisationString(playerIcon);
  const userCustomisation = {
    colour: getFilePathByCustomisationId(parsed.colour, 'colour'),
    headSlot: getFilePathByCustomisationId(parsed.head, 'headSlot'),
    eyesSlot: getFilePathByCustomisationId(parsed.eyes, 'eyesSlot'),
    mouthSlot: getFilePathByCustomisationId(parsed.mouth, 'mouthSlot')
  };
  marker.classList.add('has-oe');
  marker.appendChild(CreateImageStack(userCustomisation));
  return marker;
}

function renderTruthOrDareLateJoinTimeline(partyData = currentPartyData) {
  const timeline = nextRoundJoinContainer?.querySelector('#next-round-join-timeline');
  if (!timeline || !partyData) return;

  const state = getPartyState(partyData) || {};
  const players = partyData.players || [];
  const timelineEvents = Array.isArray(state.roundTimeline)
    ? state.roundTimeline
    : [];
  const events = timelineEvents
    .map((event) => ({
      event,
      label: formatTruthOrDareTimelineEvent(event, players)
    }))
    .filter((item) => item.label);

  timeline.replaceChildren(
    ...events.map(({ event, label }, index) => {
      const step = document.createElement('div');
      step.className = 'next-round-join-timeline-step';
      if (index === events.length - 1) {
        step.classList.add('is-current');
      }

      const marker = createTruthOrDareTimelineMarker(event, players);

      const text = document.createElement('span');
      text.className = 'next-round-join-timeline-label';
      text.textContent = label;

      step.append(marker, text);
      return step;
    })
  );

  if (timeline.parentElement) {
    timeline.parentElement.scrollLeft = timeline.parentElement.scrollWidth;
  }
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
  const currentPlayer = players.find(
    (player) =>
      String(player?.identity?.computerId ?? player?.computerId) ===
      String(deviceId)
  );
  if (currentPlayer?.state?.participationStatus === 'pending_next_round') {
    stopTruthOrDareTimerWarning();
    renderTruthOrDareLateJoinTimeline(currentPartyData);
    setActiveContainers(nextRoundJoinContainer);
    return;
  }

  syncTruthOrDareFlowSounds(state, instructions);

  const phaseOwnsActionTimer =
    phase === 'truth-or-dare-choose-punishment' ||
    phase === 'truth-or-dare-show-punishment' ||
    phase === 'truth-or-dare-prompt-heist';
  const instructionOwnsActionTimer =
    instructions.includes('DISPLAY_SELECT_QUESTION_TYPE') ||
    instructions.includes('DISPLAY_PUBLIC_CARD') ||
    instructions.includes('DISPLAY_COMPLETE_QUESTION');

  if (!phaseOwnsActionTimer && !instructionOwnsActionTimer) {
    stopTruthOrDareTimerWarning();
  }

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
  else if (phase === 'truth-or-dare-prompt-heist') {
    DisplayPromptHeist();
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
