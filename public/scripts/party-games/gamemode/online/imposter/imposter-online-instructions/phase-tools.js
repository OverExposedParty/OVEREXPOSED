let imposterFlowSoundsInitialised = false;
let lastImposterFlowSoundEventId = null;
const unresolvedImposterPunishmentTypes = new Set([
  'COIN_FLIP',
  'DRINK_WHEEL',
  'LUCKY_COIN_FLIP'
]);

function stopImposterTimerWarning() {
  return window.PartyGameSounds?.stopTimerWarning?.() ?? false;
}

function startImposterTimerWarning(
  state = getPartyState(currentPartyData),
  timerScope = 'confirm-prompt'
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
    timerId: `${partyId}:imposter-${timerScope}:${deadline}`
  });
}

function syncImposterTimerWarning(state, isActionable, timerScope = 'confirm-prompt') {
  if (!isActionable) {
    return stopImposterTimerWarning();
  }

  return startImposterTimerWarning(state, timerScope);
}

function syncImposterPunishmentTimerWarning(state, timerScope) {
  const targetId = state?.phaseData?.targetId ?? null;
  return syncImposterTimerWarning(
    state,
    targetId != null && String(targetId) === String(deviceId),
    timerScope
  );
}

function getImposterVoteOutcome(
  partyData = currentPartyData,
  state = getPartyState(partyData)
) {
  const players = partyData?.players || [];
  const imposterIndex = state?.playerTurn ?? 0;
  const imposter = players[imposterIndex];
  if (!imposter) return null;

  const imposterId = getPlayerId(imposter);
  const highestVotedIds =
    typeof GetHighestVoted === 'function'
      ? GetHighestVoted(partyData)
      : [];
  const highestValue =
    typeof getHighestVoteValue === 'function'
      ? getHighestVoteValue(partyData)
      : 0;
  const found =
    highestValue > 0 &&
    highestVotedIds.some(
      playerId => String(playerId) === String(imposterId)
    );

  return {
    eventName: found ? 'imposterFound' : 'imposterWins',
    found,
    imposter,
    imposterId
  };
}

function getImposterFlowSoundEvent(state, instructions) {
  const instruction = String(instructions || '');
  const phase = state?.phase ?? null;
  const deck = currentPartyData?.deck ?? {};
  const players = currentPartyData?.players ?? [];
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
      eventId: `${partyId}:imposter:game-complete:${roundId}`
    };
  }

  if (phase === 'imposter-choose-punishment') {
    return {
      eventName: 'punishmentStart',
      eventId: `${partyId}:imposter:punishment:${roundId}`
    };
  }

  if (phase === 'imposter-show-punishment') {
    if (
      punishmentType &&
      !unresolvedImposterPunishmentTypes.has(punishmentType)
    ) {
      return {
        eventName: 'punishmentReveal',
        eventId:
          `${partyId}:imposter:punishment-reveal:${roundId}:` +
          `${punishmentTarget}:${punishmentType.toLowerCase()}`
      };
    }
    return null;
  }

  if (instruction === 'DISPLAY_VOTE_RESULTS_PART_TWO') {
    const outcome = getImposterVoteOutcome(currentPartyData, state);
    if (!outcome) return null;

    return {
      eventName: outcome.eventName,
      eventId:
        `${partyId}:imposter:vote-outcome:${roundId}:` +
        `${outcome.found ? 'found' : 'wins'}`
    };
  }

  if (instruction === 'DISPLAY_VOTE_RESULTS') {
    return {
      eventName: 'resultsReveal',
      eventId: `${partyId}:imposter:results:${roundId}`
    };
  }

  if (instruction.includes('DISPLAY_ANSWER_CONTAINER')) {
    const speakingTurn = state?.speakingPlayerTurn ?? state?.roundPlayerTurn ?? 0;
    const speakingPlayerId = getPlayerId(players[speakingTurn]);

    if (speakingPlayerId != null && String(speakingPlayerId) === String(deviceId)) {
      const speakingRound = state?.speakingRound ?? state?.round ?? 0;
      return {
        eventName: 'yourTurn',
        eventId: `${partyId}:imposter:speaking-turn:${roundId}:${speakingRound}:${speakingTurn}`
      };
    }
  }

  if (instruction.includes('DISPLAY_START_TIMER')) {
    return {
      eventName: 'roundStart',
      eventId: `${partyId}:imposter:round:${roundId}`
    };
  }

  return null;
}

function syncImposterFlowSounds(state, instructions) {
  const event = getImposterFlowSoundEvent(state, instructions);
  const eventId = event?.eventId ?? null;

  if (!imposterFlowSoundsInitialised) {
    imposterFlowSoundsInitialised = true;
    lastImposterFlowSoundEventId = eventId;
    return Promise.resolve(null);
  }

  if (!event || eventId === lastImposterFlowSoundEventId) {
    return Promise.resolve(null);
  }

  lastImposterFlowSoundEventId = eventId;
  if (typeof window.PartyGameSounds?.playOnce !== 'function') {
    return Promise.resolve(null);
  }

  return window.PartyGameSounds.playOnce(event.eventName, { eventId });
}

function syncImposterInstructionSounds(state, instructions) {
  const instruction = String(instructions || '');
  const phase = state?.phase ?? null;
  syncImposterFlowSounds(state, instruction);

  const phaseOwnsActionTimer =
    phase === 'imposter-choose-punishment' ||
    phase === 'imposter-show-punishment';
  const instructionOwnsActionTimer =
    instruction.includes('DISPLAY_START_TIMER') ||
    instruction.includes('DISPLAY_ANSWER_CONTAINER') ||
    instruction.includes('DISPLAY_PRIVATE_CARD');

  if (!phaseOwnsActionTimer && !instructionOwnsActionTimer) {
    stopImposterTimerWarning();
  }
}

function getImposterPhaseState() {
  const state = getPartyState(currentPartyData);
  return {
    phase: state?.phase ?? null,
    phaseData: state?.phaseData ?? {}
  };
}

async function renderCurrentImposterInstructionFromState() {
  if (
    showRoundLateJoinContainerIfNeeded({
      partyData: currentPartyData,
      gamemode: 'imposter'
    })
  ) {
    stopImposterTimerWarning();
    return;
  }

  const userInstructions = getUserInstructions(currentPartyData);
  const state = getPartyState(currentPartyData);
  const phase = state?.phase ?? null;

  syncImposterInstructionSounds(state, userInstructions);

  if (phase === 'imposter-choose-punishment') {
    syncImposterPunishmentTimerWarning(state, 'choose-punishment');
    ChoosingPunishment(state.playerTurn);
  } else if (phase === 'imposter-show-punishment') {
    DisplayPunishmentToUser();
  } else if (userInstructions === "DISPLAY_VOTE_RESULTS") {
    DisplayVoteResults();
  } else if (userInstructions === "DISPLAY_VOTE_RESULTS_PART_TWO") {
    await DisplayVoteResultsPartTwo();
  } else if (userInstructions.includes("DISPLAY_PRIVATE_CARD")) {
    DisplayPrivateCard(userInstructions);
  } else if (userInstructions.includes("DISPLAY_START_TIMER")) {
    DisplayStartTimer();
  } else if (userInstructions.includes("DISPLAY_ANSWER_CONTAINER")) {
    DisplayAnswerContainer();
  }
}

async function scheduleImposterPhaseAction({ delay = 0, action, payload = {}, actorId = null } = {}) {
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
    if (actionPayload.nextTimerDurationMs != null) {
      actionPayload.timer = Date.now() + Number(actionPayload.nextTimerDurationMs);
      delete actionPayload.nextTimerDurationMs;
    }
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
      payload: actionPayload,
      actorId: actorId ?? deviceId,
      syncInstructions: false
    });

    if (updatedParty) {
      currentPartyData = updatedParty;
      await renderCurrentImposterInstructionFromState();
    }
  } catch (error) {
    console.error('Imposter phase action failed:', error);
  }
}
