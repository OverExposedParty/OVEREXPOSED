let mostLikelyToFlowSoundsInitialised = false;
let lastMostLikelyToFlowSoundEventId = null;
const unresolvedMostLikelyToPunishmentTypes = new Set([
  'COIN_FLIP',
  'DRINK_WHEEL',
  'LUCKY_COIN_FLIP',
  'MOST_LIKELY_TO_DRINK_WHEEL'
]);

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

function stopMostLikelyToTimerWarning() {
  return window.PartyGameSounds?.stopTimerWarning?.() ?? false;
}

function startMostLikelyToTimerWarning(
  state = getPartyState(currentPartyData),
  timerScope = 'vote'
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
    timerId: `${partyId}:most-likely-to-${timerScope}:${deadline}`
  });
}

function syncMostLikelyToTimerWarning(state, isActionable, timerScope = 'vote') {
  if (!isActionable) {
    return stopMostLikelyToTimerWarning();
  }

  return startMostLikelyToTimerWarning(state, timerScope);
}

function getMostLikelyToFlowSoundEvent(state, instructions) {
  const instruction = String(instructions || '');
  const phase = state?.phase ?? null;
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
    deck.currentCardIndex ??
    'round';
  const punishmentType = String(state?.phaseData?.punishmentType ?? '')
    .replace(/-/g, '_')
    .trim()
    .toUpperCase();
  const punishmentTarget =
    state?.phaseData?.targetId ?? state?.playerTurn ?? 'target';

  if (phase === 'game-over' || instruction.includes('GAME_OVER')) {
    return {
      eventName: 'gameComplete',
      eventId: `${partyId}:most-likely-to:game-complete:${roundId}`
    };
  }

  if (phase === 'most-likely-to-choose-punishment') {
    return {
      eventName: 'punishmentStart',
      eventId: `${partyId}:most-likely-to:punishment:${roundId}`
    };
  }

  if (phase === 'most-likely-to-show-punishment') {
    if (
      punishmentType &&
      !unresolvedMostLikelyToPunishmentTypes.has(punishmentType)
    ) {
      return {
        eventName: 'punishmentReveal',
        eventId:
          `${partyId}:most-likely-to:punishment-reveal:${roundId}:` +
          `${punishmentTarget}:${punishmentType.toLowerCase()}`
      };
    }
    return null;
  }

  if (instruction.includes('DISPLAY_VOTE_RESULTS')) {
    return {
      eventName: 'resultsReveal',
      eventId: `${partyId}:most-likely-to:results:${roundId}`
    };
  }

  if (instruction.includes('DISPLAY_PRIVATE_CARD')) {
    return {
      eventName: 'roundStart',
      eventId: `${partyId}:most-likely-to:round:${roundId}`
    };
  }

  return null;
}

function syncMostLikelyToFlowSounds(state, instructions) {
  const event = getMostLikelyToFlowSoundEvent(state, instructions);
  const eventId = event?.eventId ?? null;

  if (!mostLikelyToFlowSoundsInitialised) {
    mostLikelyToFlowSoundsInitialised = true;
    lastMostLikelyToFlowSoundEventId = eventId;
    return Promise.resolve(null);
  }

  if (!event || eventId === lastMostLikelyToFlowSoundEventId) {
    return Promise.resolve(null);
  }

  lastMostLikelyToFlowSoundEventId = eventId;
  if (typeof window.PartyGameSounds?.playOnce !== 'function') {
    return Promise.resolve(null);
  }

  return window.PartyGameSounds.playOnce(event.eventName, { eventId });
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
