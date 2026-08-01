const nightTimerSeconds = gameRules["night-timer"];
const dayTimerSeconds = gameRules["day-timer"];

const nightTimer = nightTimerSeconds * 1000;
const dayTimer = dayTimerSeconds * 1000;

const mafiaDisplayRoleTimer = 7500;
const displayPlayerKilledTimer = 7500;

let mafiaFlowSoundsInitialised = false;
let lastMafiaFlowSoundEventId = null;

function stopMafiaTimerWarning() {
  return window.PartyGameSounds?.stopTimerWarning?.() ?? false;
}

function startMafiaTimerWarning(
  state = getPartyState(currentPartyData),
  timerScope = 'night-action'
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
    timerId: `${partyId}:mafia-${timerScope}:${deadline}`
  });
}

function syncMafiaTimerWarning(state, isActionable, timerScope = 'night-action') {
  if (!isActionable) {
    return stopMafiaTimerWarning();
  }

  return startMafiaTimerWarning(state, timerScope);
}

function getMafiaFlowSoundEvent(state, instructions) {
  const instruction = String(instructions || '');
  const fallbackPartyCode = typeof partyCode === 'undefined' ? '' : partyCode;
  const partyId = (
    currentPartyData?.partyId ??
    currentPartyData?.partyCode ??
    fallbackPartyCode
  ) || 'party';
  const roundId =
    state?.completedRounds ??
    state?.roundNumber ??
    state?.roundIndex ??
    0;

  if (instruction.includes('DISPLAY_GAMEOVER')) {
    return {
      eventName: 'gameComplete',
      eventId: `${partyId}:mafia:game-complete:${roundId}`
    };
  }

  if (instruction.includes('DISPLAY_PLAYER_KILLED')) {
    return {
      eventName: 'resultsReveal',
      eventId: `${partyId}:mafia:night-result:${roundId}`
    };
  }

  if (instruction.includes('DISPLAY_TOWN_VOTE')) {
    return {
      eventName: 'resultsReveal',
      eventId: `${partyId}:mafia:day-result:${roundId}`
    };
  }

  if (instruction.includes('DISPLAY_DAY_PHASE_DISCUSSION')) {
    return {
      eventName: 'roundStart',
      eventId: `${partyId}:mafia:day:${roundId}`
    };
  }

  if (instruction.includes('DISPLAY_NIGHT_PHASE')) {
    return {
      eventName: 'roundStart',
      eventId: `${partyId}:mafia:night:${roundId}`
    };
  }

  if (instruction.includes('DISPLAY_ROLE')) {
    return {
      eventName: 'gameStart',
      eventId: `${partyId}:mafia:game-start`
    };
  }

  return null;
}

function syncMafiaFlowSounds(state, instructions) {
  const event = getMafiaFlowSoundEvent(state, instructions);
  const eventId = event?.eventId ?? null;

  if (!mafiaFlowSoundsInitialised) {
    mafiaFlowSoundsInitialised = true;
    lastMafiaFlowSoundEventId = eventId;
    return Promise.resolve(null);
  }

  if (!event || eventId === lastMafiaFlowSoundEventId) {
    return Promise.resolve(null);
  }

  lastMafiaFlowSoundEventId = eventId;
  if (typeof window.PartyGameSounds?.playOnce !== 'function') {
    return Promise.resolve(null);
  }

  return window.PartyGameSounds.playOnce(event.eventName, { eventId });
}

function syncMafiaInstructionSounds(state, instructions) {
  const instruction = String(instructions || '');
  syncMafiaFlowSounds(state, instruction);

  const instructionOwnsTimer =
    instruction.includes('DISPLAY_NIGHT_PHASE') ||
    instruction.includes('DISPLAY_DAY_PHASE_DISCUSSION') ||
    instruction.includes('DISPLAY_DAY_PHASE_VOTE');

  if (!instructionOwnsTimer) {
    stopMafiaTimerWarning();
  }
}

async function scheduleMafiaHostAction({ delay = 0, action, payload = {} } = {}) {
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
    console.error('Mafia host action failed:', error);
  }
}
