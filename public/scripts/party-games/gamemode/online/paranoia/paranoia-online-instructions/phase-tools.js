let paranoiaFlowSoundsInitialised = false;
let lastParanoiaFlowSoundEventId = null;
const unresolvedParanoiaPunishmentTypes = new Set([
  'COIN_FLIP',
  'DRINK_WHEEL',
  'LUCKY_COIN_FLIP'
]);

function stopParanoiaTimerWarning() {
  return window.PartyGameSounds?.stopTimerWarning?.() ?? false;
}

function startParanoiaTimerWarning(
  state = getPartyState(currentPartyData),
  timerScope = 'select-target'
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
    timerId: `${partyId}:paranoia-${timerScope}:${deadline}`
  });
}

function syncParanoiaTimerWarning(state, isActionable, timerScope = 'select-target') {
  if (!isActionable) {
    return stopParanoiaTimerWarning();
  }

  return startParanoiaTimerWarning(state, timerScope);
}

function getParanoiaFlowSoundEvent(state, instructions) {
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
    state?.playerTurn ??
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
      eventId: `${partyId}:paranoia:game-complete:${roundId}`
    };
  }

  if (instruction.includes('USER_HAS_PASSED')) {
    return {
      eventName: 'playerPassed',
      eventId: `${partyId}:paranoia:player-passed:${roundId}`
    };
  }

  if (
    instruction === 'NEXT_QUESTION' ||
    instruction.includes('DISPLAY_DUAL_STACK_CARD')
  ) {
    return {
      eventName: 'resultsReveal',
      eventId: `${partyId}:paranoia:reveal:${roundId}`
    };
  }

  if (phase === 'paranoia-choose-punishment') {
    return {
      eventName: 'punishmentStart',
      eventId: `${partyId}:paranoia:punishment:${roundId}`
    };
  }

  if (phase === 'paranoia-show-punishment') {
    if (
      punishmentType &&
      !unresolvedParanoiaPunishmentTypes.has(punishmentType)
    ) {
      return {
        eventName: 'punishmentReveal',
        eventId:
          `${partyId}:paranoia:punishment-reveal:${roundId}:` +
          `${punishmentTarget}:${punishmentType.toLowerCase()}`
      };
    }
    return null;
  }

  if (instruction.includes('DISPLAY_PRIVATE_CARD')) {
    return {
      eventName: 'roundStart',
      eventId: `${partyId}:paranoia:round:${roundId}`
    };
  }

  return null;
}

function syncParanoiaFlowSounds(state, instructions) {
  const event = getParanoiaFlowSoundEvent(state, instructions);
  const eventId = event?.eventId ?? null;

  if (!paranoiaFlowSoundsInitialised) {
    paranoiaFlowSoundsInitialised = true;
    lastParanoiaFlowSoundEventId = eventId;
    return Promise.resolve(null);
  }

  if (!event || eventId === lastParanoiaFlowSoundEventId) {
    return Promise.resolve(null);
  }

  lastParanoiaFlowSoundEventId = eventId;
  if (typeof window.PartyGameSounds?.playOnce !== 'function') {
    return Promise.resolve(null);
  }

  return window.PartyGameSounds.playOnce(event.eventName, { eventId });
}

function getParanoiaTurnPlayer(players = [], state = {}, turnIndex = state?.playerTurn ?? 0) {
  const order = Array.isArray(state?.playerTurnOrder) ? state.playerTurnOrder : [];
  const playerId = order[turnIndex];

  if (playerId) {
    return players.find(player => getPlayerId(player) === playerId) ?? null;
  }

  return players[turnIndex] ?? null;
}

function getParanoiaTurnPlayerIndex(players = [], state = {}, turnIndex = state?.playerTurn ?? 0) {
  const turnPlayer = getParanoiaTurnPlayer(players, state, turnIndex);
  if (!turnPlayer) return -1;

  const turnPlayerId = getPlayerId(turnPlayer);
  return players.findIndex(player => getPlayerId(player) === turnPlayerId);
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

function getParanoiaPhaseDuration() {
  return Number(gameRules?.["time-limit"] || 120);
}

function getParanoiaPhaseDelay() {
  const state = getPartyState(currentPartyData);
  const timerValue = state?.timer ?? currentPartyData?.timer ?? null;
  if (!timerValue) return getParanoiaPhaseDuration() * 1000;

  return Math.max(new Date(timerValue) - Date.now(), 0);
}

function ensureParanoiaTimer(container) {
  if (!container) return false;
  if (!container.querySelector(':scope > .timer-wrapper') && typeof AddTimerToContainer === 'function') {
    AddTimerToContainer(container);
  }
  return Boolean(container.querySelector(':scope > .timer-wrapper'));
}

function startParanoiaPhaseTimer(container, label, delay = getParanoiaPhaseDelay()) {
  if (!container) return false;
  ensureParanoiaTimer(container);

  return startTimerWithContainer({
    container,
    label,
    timeLeft: delay / 1000,
    duration: getParanoiaPhaseDuration()
  });
}

function startParanoiaPhaseTimers(containers = [], delay = getParanoiaPhaseDelay()) {
  containers.forEach(({ container, label }) => {
    startParanoiaPhaseTimer(container, label, delay);
  });
}

function scheduleParanoiaCurrentPhaseTimeout(delay = getParanoiaPhaseDelay()) {
  scheduleParanoiaPhaseAction({
    delay,
    action: 'paranoia-handle-phase-timeout',
    payload: {
      roundTimer: Date.now() + getParanoiaPhaseDuration() * 1000
    }
  });
}

function scheduleParanoiaRevealTimeout(delay = getParanoiaPhaseDelay()) {
  scheduleParanoiaPhaseAction({
    delay,
    action: 'paranoia-handle-reveal-timeout',
    payload: {
      roundTimer: Date.now() + getParanoiaPhaseDuration() * 1000
    }
  });
}
