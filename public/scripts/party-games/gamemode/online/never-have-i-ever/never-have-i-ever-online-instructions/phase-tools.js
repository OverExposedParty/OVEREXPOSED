let neverHaveIEverFlowSoundsInitialised = false;
let lastNeverHaveIEverFlowSoundEventId = null;
const unresolvedNeverHaveIEverPunishmentTypes = new Set([
  'DRINK_WHEEL',
  'ODD_MAN_OUT',
  'SPIN_ODD_MAN_OUT'
]);

function getNeverHaveIEverPhaseState() {
  const state = getPartyState(currentPartyData);
  return {
    phase: state?.phase ?? null,
    phaseData: state?.phaseData ?? {}
  };
}

async function scheduleNeverHaveIEverPhaseAction({ delay = 0, action, payload = {} } = {}) {
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
    console.error('Never Have I Ever phase action failed:', error);
  }
}

function getNeverHaveIEverTargetIds() {
  const { phaseData } = getNeverHaveIEverPhaseState();
  return Array.isArray(phaseData?.targetIds)
    ? phaseData.targetIds.filter(Boolean)
    : [];
}

function getNeverHaveIEverPhaseDuration() {
  return Number(gameRules?.["time-limit"] || 120);
}

function getNeverHaveIEverPhaseDelay() {
  const state = getPartyState(currentPartyData);
  const timerValue = state?.timer ?? currentPartyData?.timer ?? null;
  if (!timerValue) return getNeverHaveIEverPhaseDuration() * 1000;

  return Math.max(new Date(timerValue) - Date.now(), 0);
}

function stopNeverHaveIEverVoteTimerWarning() {
  return window.PartyGameSounds?.stopTimerWarning?.() ?? false;
}

function startNeverHaveIEverVoteTimerWarning(state = getPartyState(currentPartyData)) {
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
    timerId: `${partyId}:never-have-i-ever-vote:${deadline}`
  });
}

function syncNeverHaveIEverVoteTimerWarning(state, playerState) {
  if (playerState?.hasConfirmed === true) {
    return stopNeverHaveIEverVoteTimerWarning();
  }

  return startNeverHaveIEverVoteTimerWarning(state);
}

function getNeverHaveIEverFlowSoundEvent(state, instructions) {
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
  const punishmentTargets = Array.isArray(state?.phaseData?.targetIds)
    ? state.phaseData.targetIds.filter(Boolean).join('-')
    : state?.phaseData?.targetId ?? 'target';

  if (phase === 'game-over' || instruction.includes('GAME_OVER')) {
    return {
      eventName: 'gameComplete',
      eventId: `${partyId}:never-have-i-ever:game-complete:${roundId}`
    };
  }

  if (phase === 'never-have-i-ever-spin-odd-man-out') {
    return {
      eventName: 'punishmentStart',
      eventId: `${partyId}:never-have-i-ever:punishment:${roundId}`
    };
  }

  if (phase === 'never-have-i-ever-show-punishment') {
    if (
      punishmentType &&
      !unresolvedNeverHaveIEverPunishmentTypes.has(punishmentType)
    ) {
      return {
        eventName: 'punishmentReveal',
        eventId:
          `${partyId}:never-have-i-ever:punishment-reveal:${roundId}:` +
          `${punishmentTargets}:${punishmentType.toLowerCase()}`
      };
    }
    return null;
  }

  if (instruction.includes('DISPLAY_VOTE_RESULTS')) {
    return {
      eventName: 'resultsReveal',
      eventId: `${partyId}:never-have-i-ever:results:${roundId}`
    };
  }

  if (instruction.includes('DISPLAY_PRIVATE_CARD')) {
    return {
      eventName: 'roundStart',
      eventId: `${partyId}:never-have-i-ever:round:${roundId}`
    };
  }

  return null;
}

function syncNeverHaveIEverFlowSounds(state, instructions) {
  const event = getNeverHaveIEverFlowSoundEvent(state, instructions);
  const eventId = event?.eventId ?? null;

  if (!neverHaveIEverFlowSoundsInitialised) {
    neverHaveIEverFlowSoundsInitialised = true;
    lastNeverHaveIEverFlowSoundEventId = eventId;
    return Promise.resolve(null);
  }

  if (!event || eventId === lastNeverHaveIEverFlowSoundEventId) {
    return Promise.resolve(null);
  }

  lastNeverHaveIEverFlowSoundEventId = eventId;
  if (typeof window.PartyGameSounds?.playOnce !== 'function') {
    return Promise.resolve(null);
  }

  return window.PartyGameSounds.playOnce(event.eventName, { eventId });
}

function ensureNeverHaveIEverTimer(container) {
  if (!container) return false;
  if (!container.querySelector(':scope > .timer-wrapper') && typeof AddTimerToContainer === 'function') {
    AddTimerToContainer(container);
  }
  return Boolean(container.querySelector(':scope > .timer-wrapper'));
}

function startNeverHaveIEverPhaseTimer(container, label, delay = getNeverHaveIEverPhaseDelay()) {
  if (!container) return false;
  ensureNeverHaveIEverTimer(container);

  return startTimerWithContainer({
    container,
    label,
    timeLeft: delay / 1000,
    duration: getNeverHaveIEverPhaseDuration()
  });
}
