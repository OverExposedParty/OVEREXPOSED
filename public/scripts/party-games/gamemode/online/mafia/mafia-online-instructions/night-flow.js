async function DisplayRole() {
  const state = getPartyState(currentPartyData);
  const players = currentPartyData.players || [];
  stopMafiaTimerWarning();

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

  const index = players.findIndex((p) => getPlayerId(p) === deviceId);
  if (index === -1) {
    stopMafiaTimerWarning();
    console.warn('Device not found in players when displaying role.');
    return;
  }

  const myState = getPlayerState(players[index]);
  const roleKey = myState.roleKey;

  displayRoleTitle.textContent = roleKey;
  displayRoleText.textContent =
    mafiaRoleDescription[roleKey] || mafiaRoleDescription.civilian;

  popUpRoleHeader.textContent = roleKey;
  popUpRoleDescription.textContent =
    mafiaRoleDescription[roleKey] || mafiaRoleDescription.civilian;

  setActiveContainers(displayRoleContainer);
}

async function DisplayNightPhase() {
  const state = getPartyState(currentPartyData);
  const players = currentPartyData.players || [];

  const myIndex = players.findIndex((p) => getPlayerId(p) === deviceId);
  if (myIndex === -1) {
    stopMafiaTimerWarning();
    return;
  }
  const allVotesSubmitted = players.every((p) => {
    const playerState = getPlayerState(p);
    if (p.state?.status !== 'alive') return true;
    return !!playerState?.hasConfirmed;
  });
  if (allVotesSubmitted) {
    stopMafiaTimerWarning();
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
  } else if (currentPartyData.players[myIndex].state.status === 'dead') {
    stopMafiaTimerWarning();
    DisplayPlayerDeadPLayerBoard();
    return;
  }

  const myPlayer = players[myIndex];
  const myState = getPlayerState(myPlayer);
  const myRoleKey = myState.roleKey;
  const nightActionKey = getMafiaRoleActionKeys(myRoleKey, 'night')[0] || null;
  const nightActionExecutorKey = getMafiaActionExecutorKey(nightActionKey);

  syncMafiaTimerWarning(
    state,
    myState.status === 'alive' && myState.hasConfirmed !== true,
    'night-action'
  );

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

  displayRoleTitle.textContent = myRoleKey;
  displayRoleText.textContent =
    mafiaRoleDescription[myRoleKey] || mafiaRoleDescription.civilian;

  if (nightActionExecutorKey === MAFIA_ACTION_KEYS.CIVILIAN_WATCH) {
    if (
      !isContainerVisible(selectCivilianWatchContainer) &&
      !isContainerVisible(displayCivilianWatchResponseContainer)
    ) {
      debugLog('completed', myState.phase.state === 'completed');
      waitForFunction('InitializeCivilianWatch', async () => {
        await InitializeCivilianWatch(myState.phase.state === 'completed');
      });
    }
  } else if (nightActionExecutorKey === MAFIA_ACTION_KEYS.MAFIA_KILL_VOTE) {
    setActiveContainers(selectUserNightPhaseContainer);
    const civilianButtons =
      selectUserNightPhaseButtonContainer.querySelectorAll('button');

    if (myState.hasConfirmed) {
      selectUserNightPhaseConfirmButton.classList.add('disabled');
      civilianButtons.forEach((civilianButton) =>
        civilianButton.classList.add('disabled')
      );
      return;
    }
    selectUserNightPhaseConfirmButton.classList.remove('disabled');
    civilianButtons.forEach((civilianButton) => {
      const btnId = civilianButton.id;

      const hoverCount = players.filter((p) => {
        const ps = getPlayerState(p);
        return ps.isReady && ps.vote === btnId;
      }).length;

      const confirmedCount = players.filter((p) => {
        const ps = getPlayerState(p);
        return ps.hasConfirmed && ps.vote === btnId;
      }).length;

      const hoverSpan = civilianButton.querySelector('.hover-count');
      const confirmedSpan = civilianButton.querySelector('.confirmed-count');

      if (hoverSpan) hoverSpan.textContent = String(hoverCount);
      if (confirmedSpan) confirmedSpan.textContent = String(confirmedCount);
    });
  } else {
    setActiveContainers(waitingForPlayersContainer);
  }
}

async function DisplayNightPhasePartTwo() {
  return;
}

async function DisplayPlayerKilled(instruction) {
  const state = getPartyState(currentPartyData);
  const players = currentPartyData.players || [];
  const parsedInstructions = parseInstruction(instruction);
  stopMafiaTimerWarning();

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

  const rawDialogue =
    mafiaDialogueKill[Math.floor(Math.random() * mafiaDialogueKill.length)];
  const playerKilledIndex = players.findIndex(
    (p) => getPlayerId(p) === parsedInstructions.reason
  );

  let finalDialogue;

  if (playerKilledIndex !== -1 && parsedInstructions.reason !== '') {
    const playerKilled = getPlayerUsername(players[playerKilledIndex]);
    finalDialogue = rawDialogue.replace('[Player Name]', playerKilled);

    const killedState = getPlayerState(players[playerKilledIndex]);
    killedState.status = 'dead';
  } else {
    finalDialogue =
      mafiaDialogueNoKill[Math.floor(Math.random() * mafiaDialogueKill.length)];
  }

  displayPlayerKilledText.textContent = finalDialogue;
  setActiveContainers(displayPlayerKilledContainer);
}

async function DisplayPlayerKilledPartTwo() {
  stopMafiaTimerWarning();

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
