let wouldYouRatherFlowSoundsInitialised = false;
let lastWouldYouRatherFlowSoundEventId = null;
const unresolvedWouldYouRatherPunishmentTypes = new Set([
  'DRINK_WHEEL',
  'ODD_MAN_OUT',
  'SPIN_ODD_MAN_OUT'
]);

function getWouldYouRatherPhaseState() {
  const state = getPartyState(currentPartyData);
  return {
    phase: state?.phase ?? null,
    phaseData: state?.phaseData ?? {}
  };
}

async function scheduleWouldYouRatherPhaseAction({ delay = 0, action, payload = {} } = {}) {
  const state = getPartyState(currentPartyData);
  const authoritativeHostId = state?.hostComputerId ?? hostDeviceId;

  if (deviceId !== authoritativeHostId || delay == null || !action) return;

  if (timeout?.cancel) {
    timeout.cancel();
  }

  timeout = createCancelableTimeout(delay);

  try {
    await timeout.promise;

    const actionPayload = { ...payload };
    if (actionPayload.nextPhaseTimerDurationMs != null) {
      actionPayload.phaseTimer = Date.now() + Number(actionPayload.nextPhaseTimerDurationMs);
      delete actionPayload.nextPhaseTimerDurationMs;
    }
    if (actionPayload.nextRoundTimerDurationMs != null) {
      actionPayload.roundTimer = Date.now() + Number(actionPayload.nextRoundTimerDurationMs);
      delete actionPayload.nextRoundTimerDurationMs;
    }

    const updatedParty = await performOnlinePartyAction({
      action,
      payload: actionPayload
    });

    if (updatedParty) {
      currentPartyData = updatedParty;
    }
  } catch (error) {
    console.error('Would You Rather phase action failed:', error);
  }
}

function getWouldYouRatherTargetIds() {
  const { phaseData } = getWouldYouRatherPhaseState();
  return Array.isArray(phaseData?.targetIds)
    ? phaseData.targetIds.filter(Boolean)
    : [];
}

function getWouldYouRatherWinningVote() {
  const { phaseData } = getWouldYouRatherPhaseState();
  return phaseData?.winningVote ?? null;
}

function getWouldYouRatherPhaseDuration() {
  return Number(getTimeLimit() || gameRules?.["time-limit"] || 120);
}

function getWouldYouRatherPhaseDelay() {
  const state = getPartyState(currentPartyData);
  const timerValue = state?.timer ?? currentPartyData?.timer ?? null;
  if (!timerValue) return getWouldYouRatherPhaseDuration() * 1000;

  return Math.max(new Date(timerValue) - Date.now(), 0);
}

function stopWouldYouRatherVoteTimerWarning() {
  return window.PartyGameSounds?.stopTimerWarning?.() ?? false;
}

function startWouldYouRatherVoteTimerWarning(state = getPartyState(currentPartyData)) {
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
    timerId: `${partyId}:would-you-rather-vote:${deadline}`
  });
}

function syncWouldYouRatherVoteTimerWarning(state, playerState) {
  if (playerState?.hasConfirmed === true) {
    return stopWouldYouRatherVoteTimerWarning();
  }

  return startWouldYouRatherVoteTimerWarning(state);
}

function getWouldYouRatherFlowSoundEvent(state, instructions) {
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
      eventId: `${partyId}:would-you-rather:game-complete:${roundId}`
    };
  }

  if (phase === 'would-you-rather-spin-odd-man-out') {
    return {
      eventName: 'punishmentStart',
      eventId: `${partyId}:would-you-rather:punishment:${roundId}`
    };
  }

  if (phase === 'would-you-rather-show-punishment') {
    if (
      punishmentType &&
      !unresolvedWouldYouRatherPunishmentTypes.has(punishmentType)
    ) {
      return {
        eventName: 'punishmentReveal',
        eventId:
          `${partyId}:would-you-rather:punishment-reveal:${roundId}:` +
          `${punishmentTargets}:${punishmentType.toLowerCase()}`
      };
    }
    return null;
  }

  if (instruction.includes('DISPLAY_VOTE_RESULTS')) {
    return {
      eventName: 'resultsReveal',
      eventId: `${partyId}:would-you-rather:results:${roundId}`
    };
  }

  if (instruction.includes('DISPLAY_PRIVATE_CARD')) {
    return {
      eventName: 'roundStart',
      eventId: `${partyId}:would-you-rather:round:${roundId}`
    };
  }

  return null;
}

function syncWouldYouRatherFlowSounds(state, instructions) {
  const event = getWouldYouRatherFlowSoundEvent(state, instructions);
  const eventId = event?.eventId ?? null;

  if (!wouldYouRatherFlowSoundsInitialised) {
    wouldYouRatherFlowSoundsInitialised = true;
    lastWouldYouRatherFlowSoundEventId = eventId;
    return Promise.resolve(null);
  }

  if (!event || eventId === lastWouldYouRatherFlowSoundEventId) {
    return Promise.resolve(null);
  }

  lastWouldYouRatherFlowSoundEventId = eventId;
  if (typeof window.PartyGameSounds?.playOnce !== 'function') {
    return Promise.resolve(null);
  }

  return window.PartyGameSounds.playOnce(event.eventName, { eventId });
}

function ensureWouldYouRatherTimer(container) {
  if (!container) return false;
  if (!container.querySelector(':scope > .timer-wrapper') && typeof AddTimerToContainer === 'function') {
    AddTimerToContainer(container);
  }
  return Boolean(container.querySelector(':scope > .timer-wrapper'));
}

function startWouldYouRatherPhaseTimer(container, label, delay = getWouldYouRatherPhaseDelay()) {
  if (!container) return false;
  ensureWouldYouRatherTimer(container);

  return startTimerWithContainer({
    container,
    label,
    timeLeft: delay / 1000,
    duration: getWouldYouRatherPhaseDuration()
  });
}
