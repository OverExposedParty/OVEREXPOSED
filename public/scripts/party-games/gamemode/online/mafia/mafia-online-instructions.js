// Timers (seconds -> milliseconds where needed)
const nightTimerSeconds = gameRules["night-timer"];
const dayTimerSeconds = gameRules["day-timer"];

const nightTimer = nightTimerSeconds * 1000;
const dayTimer = dayTimerSeconds * 1000;

const mafiaDisplayRoleTimer = 7500;
const displayPlayerKilledTimer = 7500;

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

async function DisplayRole() {
  const state = getPartyState(currentPartyData);
  const players = currentPartyData.players || [];

  const timerValue = state.timer ?? Date.now();
  const delay = new Date(timerValue) - Date.now();

  startTimerWithContainer({
    container: displayRoleContainer,
    label: 'displayRoleContainer',
    timeLeft: delay / 1000,
    duration: mafiaDisplayRoleTimer / 1000
  });

  await scheduleMafiaHostAction({
    delay,
    action: 'send-instruction',
    payload: {
      instruction: 'DISPLAY_NIGHT_PHASE',
      timer: new Date(Date.now() + nightTimer)
    }
  });

  const index = players.findIndex(p => getPlayerId(p) === deviceId);
  if (index === -1) {
    console.warn("Device not found in players when displaying role.");
    return;
  }

  const myState = getPlayerState(players[index]);
  const role = myState.role;

  displayRoleTitle.textContent = role;
  displayRoleText.textContent = mafiaRoleDescription[role];

  popUpRoleHeader.textContent = role;
  popUpRoleDescription.textContent = mafiaRoleDescription[role];

  setActiveContainers(displayRoleContainer);
}

async function DisplayNightPhase() {
  const state = getPartyState(currentPartyData);
  const players = currentPartyData.players || [];

  const myIndex = players.findIndex(p => getPlayerId(p) === deviceId);
  if (myIndex === -1) return;
  const allVotesSubmitted = players.every(p => {
    const playerState = getPlayerState(p);
    if (p.state?.status !== 'alive') return true;
    return !!playerState?.hasConfirmed;
  });
  if (allVotesSubmitted) {
    const updatedParty = await performOnlinePartyAction({
      action: 'mafia-resolve-night',
      payload: {
        timer: new Date(Date.now() + displayPlayerKilledTimer)
      }
    });

    if (updatedParty) {
      currentPartyData = updatedParty;
    }
    return;
  }
  else if (currentPartyData.players[myIndex].state.status === "dead") {
    DisplayPlayerDeadPLayerBoard();
    return;
  }

  syncPlayerButtonsWithParty(currentPartyData);

  const timerValue = state.timer ?? Date.now();
  const delay = new Date(timerValue) - Date.now();

  startTimerWithContainer({
    container: selectCivilianWatchContainer,
    label: 'selectCivilianWatchContainer',
    timeLeft: delay / 1000,
    duration: nightTimerSeconds
  });
  startTimerWithContainer({
    container: waitingForPlayersContainer,
    label: 'waitingForPlayersContainer',
    timeLeft: delay / 1000,
    duration: nightTimerSeconds
  });
  startTimerWithContainer({
    container: selectUserNightPhaseContainer,
    label: 'selectUserNightPhaseContainer',
    timeLeft: delay / 1000,
    duration: nightTimerSeconds
  });

  await scheduleMafiaHostAction({
    delay,
    action: 'mafia-resolve-night',
    payload: {
      timer: new Date(Date.now() + displayPlayerKilledTimer)
    }
  });

  const index = players.findIndex(p => getPlayerId(p) === deviceId);
  if (index === -1) return;

  const myPlayer = players[index];
  const myState = getPlayerState(myPlayer);
  const myRole = myState.role;

  displayRoleTitle.textContent = myRole;
  displayRoleText.textContent = mafiaRoleDescription[myRole];

  if (myRole === "civilian") {
    if (
      !isContainerVisible(selectCivilianWatchContainer) &&
      !isContainerVisible(displayCivilianWatchResponseContainer)
    ) {
      debugLog("completed", myState.phase.state === "completed");
      waitForFunction("InitializeCivilianWatch", async () => {
        await InitializeCivilianWatch(myState.phase.state === "completed");
      })

    }
  } else {
    setActiveContainers(selectUserNightPhaseContainer);
    const civilianButtons = selectUserNightPhaseButtonContainer.querySelectorAll('button');

    if (myState.hasConfirmed) {
      selectUserNightPhaseConfirmButton.classList.add('disabled');
      civilianButtons.forEach(civilianButton => civilianButton.classList.add('disabled'));
      return;
    } else {
      selectUserNightPhaseConfirmButton.classList.remove('disabled');
    }
    civilianButtons.forEach(civilianButton => {
      const btnId = civilianButton.id;

      const hoverCount = players.filter(p => {
        const ps = getPlayerState(p);
        return ps.isReady && ps.vote === btnId;
      }).length;

      const confirmedCount = players.filter(p => {
        const ps = getPlayerState(p);
        return ps.hasConfirmed && ps.vote === btnId;
      }).length;

      const hoverSpan = civilianButton.querySelector('.hover-count');
      const confirmedSpan = civilianButton.querySelector('.confirmed-count');

      if (hoverSpan) hoverSpan.textContent = String(hoverCount);
      if (confirmedSpan) confirmedSpan.textContent = String(confirmedCount);
    });
  }
}

async function DisplayNightPhasePartTwo() {
  return;
}

async function DisplayPlayerKilled(instruction) {
  const state = getPartyState(currentPartyData);
  const players = currentPartyData.players || [];

  const timerValue = state.timer ?? Date.now();
  const delay = new Date(timerValue) - Date.now();

  startTimerWithContainer({
    container: displayPlayerKilledContainer,
    label: 'displayPlayerKilledContainer',
    timeLeft: delay / 1000,
    duration: displayPlayerKilledTimer / 1000
  });

  await scheduleMafiaHostAction({
    delay,
    action: 'mafia-finish-player-killed',
    payload: {
      killedId: parsedInstructions.reason,
      timer: new Date(Date.now() + dayTimer)
    }
  });

  const parsedInstructions = parseInstruction(instruction);

  const rawDialogue =
    mafiaDialogueKill[Math.floor(Math.random() * mafiaDialogueKill.length)];

  const playerKilledIndex = players.findIndex(
    p => getPlayerId(p) === parsedInstructions.reason
  );

  let finalDialogue;

  if (playerKilledIndex !== -1 && parsedInstructions.reason !== "") {
    const playerKilled = getPlayerUsername(players[playerKilledIndex]);
    finalDialogue = rawDialogue.replace("[Player Name]", playerKilled);

    const killedState = getPlayerState(players[playerKilledIndex]);
    killedState.status = "dead";
  } else {
    finalDialogue =
      mafiaDialogueNoKill[Math.floor(Math.random() * mafiaDialogueKill.length)];
  }

  displayPlayerKilledText.textContent = finalDialogue;
  setActiveContainers(displayPlayerKilledContainer);
}

async function DisplayPlayerKilledPartTwo() {
  const userInstructions = getUserInstructions(currentPartyData);
  const parsedInstructions = parseInstruction(userInstructions);

  const updatedParty = await performOnlinePartyAction({
    action: 'mafia-finish-player-killed',
    payload: {
      killedId: parsedInstructions.reason,
      timer: new Date(Date.now() + dayTimer)
    }
  });

  if (updatedParty) {
    currentPartyData = updatedParty;
  }
}

async function DisplayDayPhaseDiscussion() {
  const players = currentPartyData.players || [];
  myIndex = players.findIndex(p => getPlayerId(p) === deviceId);
  const state = getPartyState(currentPartyData);

  const timerValue = state.timer ?? Date.now();
  const delay = new Date(timerValue) - Date.now();

  startTimer({
    timeLeft: delay / 1000,
    duration: dayTimerSeconds,
    selectedTimer: displayDayTimerContainer
  });

  await scheduleMafiaHostAction({
    delay,
    action: 'send-instruction',
    payload: {
      instruction: 'DISPLAY_DAY_PHASE_VOTE',
      timer: new Date(Date.now() + dayTimer)
    }
  });
  debugLog(currentPartyData.players[myIndex].state.status);
  if (currentPartyData.players[myIndex].state.status === "dead") {
    DisplayPlayerDeadPLayerBoard();
    return;
  }
  setActiveContainers(displayDayTimerContainer);
}

async function DisplayDayPhaseVote() {
  const state = getPartyState(currentPartyData);
  const players = currentPartyData.players || [];

  const myIndex = players.findIndex(p => getPlayerId(p) === deviceId);
  if (myIndex === -1) return;
  const allVotesSubmitted = players.every(p => {
    const playerState = getPlayerState(p);
    if (p.state?.status !== 'alive') return true;
    return !!playerState?.hasConfirmed;
  });
  debugLog("allVotesSubmitted: ", allVotesSubmitted);
  if (allVotesSubmitted) {
    const updatedParty = await performOnlinePartyAction({
      action: 'mafia-resolve-day-vote',
      payload: {
        timer: new Date(Date.now() + displayPlayerKilledTimer)
      }
    });

    if (updatedParty) {
      currentPartyData = updatedParty;
    }
    return;
  }
  else if (currentPartyData.players[myIndex].state.status === "dead") {
    DisplayPlayerDeadPLayerBoard();
    return;
  }

  syncPlayerButtonsWithParty(currentPartyData);

  const timerValue = state.timer ?? Date.now();
  const delay = new Date(timerValue) - Date.now();

  startTimerWithContainer({
    container: selectUserDayPhaseContainer,
    label: 'selectUserDayPhaseContainer',
    timeLeft: delay / 1000,
    duration: dayTimerSeconds
  });

  await scheduleMafiaHostAction({
    delay,
    action: 'mafia-resolve-day-vote',
    payload: {
      timer: new Date(Date.now() + displayPlayerKilledTimer)
    }
  });

  const myState = getPlayerState(players[myIndex]);

  setActiveContainers(selectUserDayPhaseContainer);

  if (myState.hasConfirmed) {
    selectUserDayPhaseConfirmButton.classList.add('disabled');
  } else {
    selectUserDayPhaseConfirmButton.classList.remove('disabled');
  }
  const usersButtons = selectUserDayPhaseButtonContainer.querySelectorAll('button');

  usersButtons.forEach(usersButton => {
    const btnId = usersButton.id;

    const hoverCount = players.filter(p => {
      const ps = getPlayerState(p);
      return ps.isReady && ps.vote === btnId;
    }).length;

    const confirmedCount = players.filter(p => {
      const ps = getPlayerState(p);
      return ps.hasConfirmed && ps.vote === btnId;
    }).length;

    const hoverSpan = usersButton.querySelector('.hover-count');
    const confirmedSpan = usersButton.querySelector('.confirmed-count');

    if (hoverSpan) hoverSpan.textContent = String(hoverCount);
    if (confirmedSpan) confirmedSpan.textContent = String(confirmedCount);
  });
}

async function DisplayDayPhaseVotePartTwo() {
  return;
}

async function DisplayTownVote(instruction) {
  const state = getPartyState(currentPartyData);
  const players = currentPartyData.players || [];

  const timerValue = state.timer ?? Date.now();
  const delay = new Date(timerValue) - Date.now();

  startTimerWithContainer({
    container: displayTownVoteContainer,
    label: 'displayTownVoteContainer',
    timeLeft: delay / 1000,
    duration: displayPlayerKilledTimer / 1000
  });

  await scheduleMafiaHostAction({
    delay,
    action: 'mafia-finish-town-vote',
    payload: {
      votedOutId: parsedInstructions.reason,
      timer: new Date(Date.now() + nightTimer)
    }
  });

  const parsedInstructions = parseInstruction(instruction);
  const rawDialogue =
    mafiaDialogueTownVote[Math.floor(Math.random() * mafiaDialogueTownVote.length)];

  const playerVotedOutIndex = players.findIndex(
    p => getPlayerId(p) === parsedInstructions.reason
  );

  let finalDialogue;

  if (playerVotedOutIndex !== -1 && parsedInstructions.reason !== "") {
    const playerVotedOut = getPlayerUsername(players[playerVotedOutIndex]);
    finalDialogue = rawDialogue.replace("[Player Name]", playerVotedOut);

    const votedState = getPlayerState(players[playerVotedOutIndex]);
    votedState.status = "dead";
  } else {
    finalDialogue =
      mafiaDialogueTownNoVote[Math.floor(Math.random() * mafiaDialogueKill.length)];
  }

  displayTownVoteText.textContent = finalDialogue;
  setActiveContainers(displayTownVoteContainer);
}

async function DisplayTownVotePartTwo() {
  const userInstructions = getUserInstructions(currentPartyData);
  const parsedInstructions = parseInstruction(userInstructions);

  const updatedParty = await performOnlinePartyAction({
    action: 'mafia-finish-town-vote',
    payload: {
      votedOutId: parsedInstructions.reason,
      timer: new Date(Date.now() + nightTimer)
    }
  });

  if (updatedParty) {
    currentPartyData = updatedParty;
  }
}

async function DisplayGameOver(instruction) {
  const parsedInstructions = parseInstruction(instruction);

  if (parsedInstructions.reason === "MAFIOSO") {
    displayGameOverTitle.textContent = "MAFIA WIN";
    displayGameOverText.textContent = "MAFIA HAVE OUTLASTED THE CIVILIANS";
  } else if (parsedInstructions.reason === "CIVILIAN") {
    displayGameOverTitle.textContent = "CIVILIAN WIN";
    displayGameOverText.textContent = "CIVILIAN HAVE OUTLASTED THE MAFIA";
  }

  setActiveContainers(displayGameOverContainer);
}


function DisplayPlayerDeadPLayerBoard() {
  if (!isContainerVisible(playerBoard)) {
    setActiveContainers();
    showContainer(playerBoard);
    addElementIfNotExists(permanantElementClassArray, playerBoard);
    toggleOverlay(true);
  }
}

