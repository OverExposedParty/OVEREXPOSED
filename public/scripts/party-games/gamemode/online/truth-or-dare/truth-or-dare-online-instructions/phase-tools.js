let truthOrDareFlowSoundsInitialised = false;
let lastTruthOrDareFlowSoundEventId = null;
const unresolvedTruthOrDarePunishmentTypes = new Set([
  'COIN_FLIP',
  'DRINK_WHEEL',
  'LUCKY_COIN_FLIP'
]);

async function playTruthOrDareQuestionTypeConfirmation(questionType) {
  const normalizedQuestionType = String(questionType || '').toLowerCase();
  if (
    !['truth', 'dare'].includes(normalizedQuestionType) ||
    typeof window.PartyGameSounds?.playSequence !== 'function'
  ) {
    return null;
  }

  const voiceCue = normalizedQuestionType === 'truth'
    ? 'truthSelected'
    : 'dareSelected';
  return window.PartyGameSounds.playSequence(
    ['actionConfirmed', voiceCue],
    {
      priority: 'voice',
      conflictPolicy: 'queue-latest',
      interruptible: false
    }
  );
}

function playTruthOrDareGameOverSequence() {
  if (typeof window.PartyGameSounds?.playSequence !== 'function') {
    return Promise.resolve(null);
  }

  return window.PartyGameSounds.playSequence(
    ['gameComplete', 'gameOver'],
    {
      priority: 'critical',
      conflictPolicy: 'interrupt',
      interruptible: false,
      forceInterrupt: true,
      clearQueue: true
    }
  );
}

function playTruthOrDareRoundStart(isCurrentPlayer) {
  if (
    isCurrentPlayer &&
    typeof window.PartyGameSounds?.playSequence === 'function'
  ) {
    return window.PartyGameSounds.playSequence(
      ['roundStart', 'yourTurn'],
      {
        priority: 'phase',
        conflictPolicy: 'queue-latest',
        interruptible: false
      }
    );
  }

  return null;
}

function stopTruthOrDareTimerWarning() {
  return window.PartyGameSounds?.stopTimerWarning?.() ?? false;
}

function startTruthOrDareTimerWarning(
  state = getPartyState(currentPartyData),
  timerScope = 'select-question-type'
) {
  const deadline = state?.timer ?? currentPartyData?.timer ?? null;
  if (!deadline || typeof window.PartyGameSounds?.startTimerWarning !== 'function') {
    return false;
  }

  const fallbackPartyCode = typeof partyCode === 'undefined' ? '' : partyCode;
  const partyId = (
    currentPartyData?.partyId ??
    currentPartyData?.partyCode ??
    fallbackPartyCode
  ) || 'party';

  return window.PartyGameSounds.startTimerWarning({
    deadline,
    timerId: `${partyId}:truth-or-dare-${timerScope}:${deadline}`,
    playExpiredSound: timerScope !== 'prompt-heist'
  });
}

function syncTruthOrDareTimerWarning(
  state,
  isActionable,
  timerScope = 'select-question-type'
) {
  if (!isActionable) {
    return stopTruthOrDareTimerWarning();
  }

  return startTruthOrDareTimerWarning(state, timerScope);
}

function formatTruthOrDarePunishmentText(punishmentType = '') {
  const normalizedPunishment = String(punishmentType || '')
    .replace(/-/g, '_')
    .trim()
    .toUpperCase();

  if (normalizedPunishment === 'TAKE_A_SHOT') {
    return 'Take a shot.';
  }

  if (normalizedPunishment === 'DOWN_IT') {
    return 'Down it!';
  }

  if (normalizedPunishment) {
    return 'Take ' + normalizedPunishment.replace(/_/g, ' ').toLowerCase() + '.';
  }

  return 'Complete your punishment.';
}

function getTruthOrDareFlowSoundEvent(state, instructions) {
  const instruction = String(instructions || '');
  const phase = state?.phase ?? null;
  const punishmentType = String(state?.phaseData?.punishmentType || '')
    .replace(/-/g, '_')
    .trim()
    .toLowerCase();
  const normalizedPunishmentType = punishmentType.toUpperCase();
  const punishmentTarget =
    state?.phaseData?.targetId ?? state?.playerTurn ?? 'target';
  const deck = currentPartyData?.deck ?? {};
  const fallbackPartyCode = typeof partyCode === 'undefined' ? '' : partyCode;
  const partyId = (
    currentPartyData?.partyId ??
    currentPartyData?.partyCode ??
    fallbackPartyCode
  ) || 'party';
  const roundId =
    state?.roundNumber ??
    state?.roundIndex ??
    `${deck.currentCardIndex ?? 0}-${deck.currentCardSecondIndex ?? 0}-${state?.playerTurn ?? 0}`;

  if (phase === 'game-over' || instruction.includes('GAME_OVER')) {
    return {
      eventName: 'gameOverSequence',
      eventId: `${partyId}:truth-or-dare:game-complete:${roundId}`
    };
  }

  if (phase === 'truth-or-dare-prompt-heist') {
    return {
      eventName: 'actionConfirmed',
      eventId: `${partyId}:truth-or-dare:prompt-heist:${roundId}`
    };
  }

  if (phase === 'truth-or-dare-choose-punishment') {
    return {
      eventName: 'punishmentStart',
      eventId: `${partyId}:truth-or-dare:choose-punishment:${roundId}`
    };
  }

  if (phase === 'truth-or-dare-show-punishment') {
    if (
      punishmentType &&
      !unresolvedTruthOrDarePunishmentTypes.has(normalizedPunishmentType)
    ) {
      return {
        eventName: 'punishmentReveal',
        eventId:
          `${partyId}:truth-or-dare:punishment-reveal:${roundId}:` +
          `${punishmentTarget}:${punishmentType}`
      };
    }
    return null;
  }

  if (instruction.includes('DISPLAY_COMPLETE_QUESTION')) {
    return {
      eventName: 'actionConfirmed',
      eventId: `${partyId}:truth-or-dare:complete-prompt:${roundId}`
    };
  }

  if (instruction.includes('DISPLAY_PUBLIC_CARD')) {
    const questionType = String(
      deck.questionType ?? currentPartyData?.questionType ?? ''
    ).toLowerCase();
    return {
      eventName: ['truth', 'dare'].includes(questionType)
        ? 'questionTypeConfirmed'
        : 'resultsReveal',
      questionType,
      eventId: `${partyId}:truth-or-dare:prompt:${roundId}`
    };
  }

  if (instruction.includes('DISPLAY_SELECT_QUESTION_TYPE')) {
    const players = currentPartyData?.players || [];
    const turnPlayer = getTruthOrDareTurnPlayer(
      players,
      state,
      state?.playerTurn ?? 0
    );
    const turnPlayerId = turnPlayer
      ? getTruthOrDarePlayerId(turnPlayer)
      : null;
    const localDeviceId = typeof deviceId === 'undefined' ? null : deviceId;

    return {
      eventName: 'roundStart',
      eventId: `${partyId}:truth-or-dare:round:${roundId}`,
      isCurrentPlayer:
        localDeviceId !== null &&
        turnPlayerId !== null &&
        String(turnPlayerId) === String(localDeviceId)
    };
  }

  return null;
}

function syncTruthOrDareFlowSounds(state, instructions) {
  const event = getTruthOrDareFlowSoundEvent(state, instructions);
  const eventId = event?.eventId ?? null;

  if (!truthOrDareFlowSoundsInitialised) {
    truthOrDareFlowSoundsInitialised = true;
    lastTruthOrDareFlowSoundEventId = eventId;
    return Promise.resolve(null);
  }

  if (!event || eventId === lastTruthOrDareFlowSoundEventId) {
    return Promise.resolve(null);
  }

  lastTruthOrDareFlowSoundEventId = eventId;
  if (event.eventName === 'questionTypeConfirmed') {
    return playTruthOrDareQuestionTypeConfirmation(event.questionType);
  }

  if (event.eventName === 'gameOverSequence') {
    return playTruthOrDareGameOverSequence();
  }

  if (event.eventName === 'roundStart') {
    const roundStartSequence = playTruthOrDareRoundStart(
      event.isCurrentPlayer
    );
    if (roundStartSequence) {
      return roundStartSequence;
    }
  }

  if (typeof window.PartyGameSounds?.playOnce !== 'function') {
    return Promise.resolve(null);
  }

  return window.PartyGameSounds.playOnce(event.eventName, { eventId });
}

function getTruthOrDarePlayerId(player) {
  return getPlayerId(player) ?? player?.computerId ?? player?.identity?.computerId ?? null;
}

function getTruthOrDareTurnPlayer(players = [], state = {}, turnIndex = state?.playerTurn ?? 0) {
  const order = Array.isArray(state?.playerTurnOrder) ? state.playerTurnOrder : [];
  const playerId = order[turnIndex];

  if (playerId) {
    return players.find(player => getTruthOrDarePlayerId(player) === playerId) ?? null;
  }

  return players[turnIndex] ?? null;
}

function hideTruthOrDareDrinkWheel() {
  document
    .querySelectorAll('#drink-wheel-container')
    .forEach(container => hideContainer(container));
}

function getTruthOrDareResolvedPunishmentType(instruction, phaseData = {}) {
  const parsedInstructions = typeof instruction === 'string'
    ? parseInstruction(instruction)
    : {};

  return String(
    parsedInstructions.reason
    ?? phaseData?.punishmentType
    ?? ''
  ).toUpperCase();
}

function getTruthOrDarePhaseState() {
  const state = currentPartyData.state ?? currentPartyData;
  return {
    phase: state?.phase ?? null,
    phaseData: state?.phaseData ?? {}
  };
}

function getTruthOrDarePhaseDuration() {
  return Number(gameRules?.["time-limit"] || 120);
}

function getTruthOrDarePhaseDelay() {
  const state = getPartyState(currentPartyData);
  const timerValue = state?.timer ?? currentPartyData?.timer ?? null;
  if (!timerValue) return getTruthOrDarePhaseDuration() * 1000;

  return Math.max(new Date(timerValue) - Date.now(), 0);
}

function ensureTruthOrDareTimer(container) {
  if (!container) return false;
  if (!container.querySelector(':scope > .timer-wrapper') && typeof AddTimerToContainer === 'function') {
    AddTimerToContainer(container);
  }
  return Boolean(container.querySelector(':scope > .timer-wrapper'));
}

function startTruthOrDarePhaseTimer(container, label, delay = getTruthOrDarePhaseDelay()) {
  if (!container) return false;
  ensureTruthOrDareTimer(container);

  return startTimerWithContainer({
    container,
    label,
    timeLeft: delay / 1000,
    duration: getTruthOrDarePhaseDuration()
  });
}

async function scheduleTruthOrDarePhaseAction({ delay = 0, action, payload = {} } = {}) {
  const state = currentPartyData.state ?? currentPartyData;
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

    await syncTruthOrDarePartyAndRender(updatedParty);
  } catch (error) {
    console.error('Truth or Dare phase action failed:', error);
  }
}
