async function DisplayDayPhaseDiscussion() {
  const players = currentPartyData.players || [];
  myIndex = players.findIndex(p => getPlayerId(p) === deviceId);
  const state = getPartyState(currentPartyData);

  if (myIndex === -1) {
    stopMafiaTimerWarning();
    return;
  }

  const myState = getPlayerState(players[myIndex]);
  syncMafiaTimerWarning(
    state,
    myState.status === 'alive',
    'day-discussion'
  );

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
    stopMafiaTimerWarning();
    DisplayPlayerDeadPLayerBoard();
    return;
  }
  setActiveContainers(displayDayTimerContainer);
}

async function DisplayDayPhaseVote() {
  const state = getPartyState(currentPartyData);
  const players = currentPartyData.players || [];

  const myIndex = players.findIndex(p => getPlayerId(p) === deviceId);
  if (myIndex === -1) {
    stopMafiaTimerWarning();
    return;
  }
  const allVotesSubmitted = players.every(p => {
    const playerState = getPlayerState(p);
    if (p.state?.status !== 'alive') return true;
    return !!playerState?.hasConfirmed;
  });
  debugLog("allVotesSubmitted: ", allVotesSubmitted);
  if (allVotesSubmitted) {
    stopMafiaTimerWarning();
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
    stopMafiaTimerWarning();
    DisplayPlayerDeadPLayerBoard();
    return;
  }

  const myState = getPlayerState(players[myIndex]);
  syncMafiaTimerWarning(
    state,
    myState.status === 'alive' && myState.hasConfirmed !== true,
    'day-vote'
  );

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
  const parsedInstructions = parseInstruction(instruction);
  stopMafiaTimerWarning();

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
  stopMafiaTimerWarning();

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
