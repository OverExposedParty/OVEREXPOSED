async function refreshCurrentPartyData({
  requireInstructions = false,
  retries = 2,
  delayMs = 150
} = {}) {
  const latestPartyData = await GetCurrentPartyData({
    requireInstructions,
    retries,
    delayMs
  });

  if (latestPartyData) {
    currentPartyData = latestPartyData;
  }

  return currentPartyData ?? null;
}

async function SendInstruction({
  instruction = null,
  updateUsersReady = null,
  updateUsersConfirmation = null,
  updateUsersVote = null,
  partyData = null,
  fetchInstruction = false,
  isPlaying = true,
  timer = null,
  byPassHost = false
}) {
  if (!byPassHost) {
    let authoritativeHostId = hostDeviceId;

    try {
      const latestPartyData = await GetCurrentPartyData({ retries: 1 });
      if (latestPartyData) {
        currentPartyData = latestPartyData;
        authoritativeHostId = latestPartyData.state?.hostComputerId ?? hostDeviceId;
        if (authoritativeHostId) {
          hostDeviceId = authoritativeHostId;
        }
      }
    } catch (error) {
      console.error('Failed to verify host before sending instruction:', error);
    }

    if (String(deviceId) !== String(authoritativeHostId)) return null;
  }

  if (timer !== null && timeout?.cancel) {
    timeout.cancel();
  }

  let updatedParty = null;

  try {
    updatedParty = await performOnlinePartyAction({
      action: 'send-instruction',
      payload: {
        instruction,
        updateUsersReady,
        updateUsersConfirmation,
        updateUsersVote,
        partyData,
        isPlaying,
        timer,
        byPassHost
      }
    });
  } catch (error) {
    if (!byPassHost && error?.message === 'Only the host can perform this action.') {
      const latestPartyData = await GetCurrentPartyData({ retries: 1 }).catch(() => null);
      const authoritativeHostId = latestPartyData?.state?.hostComputerId ?? null;
      if (authoritativeHostId) {
        hostDeviceId = authoritativeHostId;
      }
      return null;
    }

    throw error;
  }

  if (updatedParty) {
    currentPartyData = updatedParty;
  }

  if (fetchInstruction) {
    if (typeof runOnlineFetchInstructions === 'function') {
      await runOnlineFetchInstructions({
        force: true,
        reason: 'send-instruction'
      });
    } else if (typeof FetchInstructions === 'function') {
      await FetchInstructions();
    }
  }

  return updatedParty;
}


function parseInstructionDeviceId(input) {
  const [instruction, deviceId] = input.split(":");
  return {
    instruction,
    deviceId
  };
}

function parseInstruction(input) {
  const [instruction, reason, deviceId] = input.split(":");
  return {
    instruction,
    reason,
    deviceId
  };
}

function parseInstructionSecondReason(input) {
  const [instruction, reason, secondReason, deviceId] = input.split(":");
  return {
    instruction,
    reason,
    secondReason,
    deviceId
  };
}

async function SetUserConfirmation({
  selectedDeviceId,
  option,
  reason = null,
  userInstruction = null
}) {
  const updatedParty = await performOnlinePartyAction({
    action: 'set-user-confirmation',
    payload: {
      selectedDeviceId,
      option,
      reason,
      userInstruction
    }
  });

  if (updatedParty) {
    currentPartyData = updatedParty;
  }
}

async function setUserBool(selectedDeviceId, userConfirmation = null, userReady = null, setInstruction = null) {
  const updatedParty = await performOnlinePartyAction({
    action: 'set-user-bool',
    payload: {
      selectedDeviceId,
      userConfirmation,
      userReady,
      setInstruction
    }
  });

  if (updatedParty) {
    currentPartyData = updatedParty;
  }

  return updatedParty;
}

function ClearIcons() {
  if (!waitingForPlayersIconContainer) return;

  const icons = waitingForPlayersIconContainer.querySelectorAll('.icon');
  for (let i = 0; i < icons.length; i++) {
    icons[i].classList.remove('yes');
    icons[i].classList.remove('no');
  }
}

async function ResetQuestion({
  icons = null,
  instruction = "DISPLAY_PRIVATE_CARD",
  incrementScore = 0,
  timer = null,
  playerIndex = null,
  nextPlayer = false
}) {
  const updatedParty = await performOnlinePartyAction({
    action: 'reset-question',
    payload: {
      instruction,
      incrementScore,
      timer,
      playerIndex,
      nextPlayer
    }
  });

  if (updatedParty) {
    currentPartyData = updatedParty;
  }

  if (icons !== null) {
    for (let i = 0; i < icons.length; i++) {
      icons[i]?.classList.remove('yes');
      icons[i]?.classList.remove('no');
    }
  }
}

async function PartyRestart() {
  const updatedParty = await performOnlinePartyAction({
    action: 'party-restart',
    payload: {
      resetGamemodeInstruction:
        typeof resetGamemodeInstruction === 'string' ? resetGamemodeInstruction : null
    }
  });

  if (updatedParty) {
    currentPartyData = updatedParty;
    await runOnlineFetchInstructions({ reason: 'party-restart' });
  }
}

function countWords(str) {
  if (!str) return 0;
  return str.split('-').filter(word => word.trim() !== '').length;
}

function createUserButton(id, text) {
  const button = document.createElement("button");
  button.classList.add('sound-option');
  button.id = id;
  button.textContent = text;
  return button;
}

function formatDashedString({ input, gamemode = null, seperator = ' ', uppercase = true }) {
  let words;

  if (gamemode === null) {
    words = input.split('-');
  } else {
    words = input.split('-').slice(countWords(gamemode));
  }

  return words
    .map(word => {
      if (!word) return '';
      return uppercase
        ? word.charAt(0).toUpperCase() + word.slice(1)
        : word.charAt(0).toLowerCase() + word.slice(1);
    })
    .join(seperator);
}

function ResetVotes(players, gamemodeMafia = false) {
  for (let i = 0; i < players.length; i++) {
    const p = players[i];
    const pState = getPlayerState(p);

    if (gamemodeMafia) {
      if (pState.status === "alive" || p.status === "alive") {
        pState.vote = null;
        p.vote = null;
      }
    } else {
      pState.vote = null;
      p.vote = null;
    }

    pState.hasConfirmed = false;
    pState.isReady = false;
    p.hasConfirmed = false;
    p.isReady = false;
  }
  return players;
}

async function SetVote({ option, sendInstruction = null, hover = false }) {
  const updatedParty = await performOnlinePartyAction({
    action: 'set-vote',
    payload: {
      option,
      sendInstruction,
      hover
    }
  });

  if (updatedParty) {
    currentPartyData = updatedParty;
  }
}

function ResetBoolVotes(players) {
  for (let i = 0; i < players.length; i++) {
    const p = players[i];
    const pState = getPlayerState(p);

    pState.vote = null;
    pState.hasConfirmed = false;
    pState.isReady = false;

    p.vote = null;
    p.hasConfirmed = false;
    p.isReady = false; // legacy mirror
  }
  return players;
}

async function SetBoolVote(bool) {
  const updatedParty = await performOnlinePartyAction({
    action: 'set-bool-vote',
    payload: {
      bool
    }
  });

  if (updatedParty) {
    currentPartyData = updatedParty;
  }
}
