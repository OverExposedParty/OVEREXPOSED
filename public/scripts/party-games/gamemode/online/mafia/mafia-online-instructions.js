// Timers (seconds -> milliseconds where needed)
const nightTimerSeconds = gameRules["night-timer"];
const dayTimerSeconds = gameRules["day-timer"];

const nightTimer = nightTimerSeconds * 1000;
const dayTimer = dayTimerSeconds * 1000;

const mafiaDisplayRoleTimer = 7500;
const displayPlayerKilledTimer = 7500;

async function DisplayRole() {
  const state = getPartyState(currentPartyData);
  const players = currentPartyData.players || [];

  const timerValue = state.timer ?? Date.now();
  const delay = new Date(timerValue) - Date.now();

  startTimer({
    timeLeft: delay / 1000,
    duration: mafiaDisplayRoleTimer / 1000,
    selectedTimer: displayRoleContainer.querySelector('.timer-wrapper')
  });

  SetTimeOut({
    delay,
    instruction: "DISPLAY_NIGHT_PHASE",
    nextDelay: nightTimer
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
  const allVotesSubmitted = await sendInstructionIfAllVotesSubmitted({
    players,
    instruction: "DISPLAY_NIGHT_PHASE_PART_TWO",
    partyData: currentPartyData,
    checkStatus: true
  });
  if (allVotesSubmitted) return;
  else if (currentPartyData.players[myIndex].state.status === "dead") {
    DisplayPlayerDeadPLayerBoard();
    return;
  }

  syncPlayerButtonsWithParty(currentPartyData);

  const timerValue = state.timer ?? Date.now();
  const delay = new Date(timerValue) - Date.now();

  startTimer({
    timeLeft: delay / 1000,
    duration: nightTimerSeconds,
    selectedTimer: selectCivilianWatchContainer.querySelector('.timer-wrapper')
  });
  startTimer({
    timeLeft: delay / 1000,
    duration: nightTimerSeconds,
    selectedTimer: waitingForPlayersContainer.querySelector('.timer-wrapper')
  });
  startTimer({
    timeLeft: delay / 1000,
    duration: nightTimerSeconds,
    selectedTimer: selectUserNightPhaseContainer.querySelector('.timer-wrapper')
  });

  SetTimeOut({
    delay,
    instruction: "DISPLAY_NIGHT_PHASE_PART_TWO",
    nextDelay: null
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
      !selectCivilianWatchContainer.classList.contains('active') &&
      !displayCivilianWatchResponseContainer.classList.contains('active')
    ) {
      console.log("completed", myState.phase.state === "completed");
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

  const state = getPartyState(currentPartyData);
  const players = currentPartyData.players || [];

  const newState = {
    ...state,
    phase: "day"
  };

  const mafiaVote = GetMafiaVote();
  console.log("mafiaVote", mafiaVote);

  const resetPlayers = ResetVotes(players);

  currentPartyData.state = newState;
  currentPartyData.players = resetPlayers;

  await SendInstruction({
    instruction: "DISPLAY_PLAYER_KILLED:" + mafiaVote,
    partyData: currentPartyData,
    timer: new Date(Date.now() + displayPlayerKilledTimer)
  });
}

async function DisplayPlayerKilled(instruction) {
  const state = getPartyState(currentPartyData);
  const players = currentPartyData.players || [];

  const timerValue = state.timer ?? Date.now();
  const delay = new Date(timerValue) - Date.now();

  startTimer({
    timeLeft: delay / 1000,
    duration: displayPlayerKilledTimer / 1000,
    selectedTimer: displayPlayerKilledContainer.querySelector('.timer-wrapper')
  });

  SetTimeOut({
    delay,
    instruction: "DISPLAY_PLAYER_KILLED_PART_TWO",
    nextDelay: null
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
  const players = currentPartyData.players || [];
  const resetPlayers = ResetVotes(players);

  currentPartyData.players = resetPlayers;

  const checkGameOver = await CheckGameOver();

  if (checkGameOver != null) {
    await SendInstruction({
      instruction: checkGameOver,
      partyData: currentPartyData
    });
  } else {
    await SendInstruction({
      instruction: "DISPLAY_DAY_PHASE_DISCUSSION",
      partyData: currentPartyData,
      timer: new Date(Date.now() + dayTimer)
    });
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

  SetTimeOut({
    delay,
    instruction: "DISPLAY_DAY_PHASE_VOTE",
    nextDelay: dayTimer
  });
  console.log(currentPartyData.players[myIndex].state.status);
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
  const allVotesSubmitted = await sendInstructionIfAllVotesSubmitted({
    players,
    instruction: "DISPLAY_DAY_PHASE_VOTE_PART_TWO",
    partyData: currentPartyData,
    checkStatus: true
  });
  console.log("allVotesSubmitted: ", allVotesSubmitted);
  if (allVotesSubmitted) return;
  else if (currentPartyData.players[myIndex].state.status === "dead") {
    DisplayPlayerDeadPLayerBoard();
    return;
  }

  syncPlayerButtonsWithParty(currentPartyData);

  const timerValue = state.timer ?? Date.now();
  const delay = new Date(timerValue) - Date.now();

  startTimer({
    timeLeft: delay / 1000,
    duration: dayTimerSeconds,
    selectedTimer: selectUserDayPhaseContainer.querySelector('.timer-wrapper')
  });

  SetTimeOut({
    delay,
    instruction: "DISPLAY_DAY_PHASE_VOTE_PART_TWO",
    nextDelay: dayTimer
  });

  const myState = getPlayerState(players[myIndex]);

  setActiveContainers(selectUserDayPhaseContainer);

  const usersButtons = selectUserDayPhaseButtonContainer.querySelectorAll('button');

  if (myState.hasConfirmed) {
    selectUserDayPhaseConfirmButton.classList.add('disabled');
  } else {
    selectUserDayPhaseConfirmButton.classList.remove('disabled');
  }

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

  const players = currentPartyData.players || [];
  const townVote = await GetTownVote();

  const resetPlayers = ResetVotes(players);
  currentPartyData.players = resetPlayers;

  await SendInstruction({
    instruction: "DISPLAY_TOWN_VOTE:" + townVote,
    partyData: currentPartyData,
    timer: new Date(Date.now() + displayPlayerKilledTimer)
  });
}

async function DisplayTownVote(instruction) {
  const state = getPartyState(currentPartyData);
  const players = currentPartyData.players || [];

  const timerValue = state.timer ?? Date.now();
  const delay = new Date(timerValue) - Date.now();

  startTimer({
    timeLeft: delay / 1000,
    duration: displayPlayerKilledTimer / 1000,
    selectedTimer: displayTownVoteContainer.querySelector('.timer-wrapper')
  });

  SetTimeOut({
    delay,
    instruction: "DISPLAY_TOWN_VOTE_PART_TWO",
    nextDelay: null
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

  const checkGameOver = await CheckGameOver();

  if (checkGameOver != null) {
    await SendInstruction({
      instruction: checkGameOver,
      partyData: currentPartyData
    });
  } else {
    await SendInstruction({
      instruction: "DISPLAY_NIGHT_PHASE",
      partyData: currentPartyData,
      timer: new Date(Date.now() + nightTimer)
    });
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
  if (!playerBoard.classList.contains('active')) {
    setActiveContainers();
    playerBoard.classList.add('active');
    addElementIfNotExists(permanantElementClassArray, playerBoard);
    toggleOverlay(true);
  }
}

async function sendInstructionIfAllVotesSubmitted({
  players,
  instruction,
  partyData,
  checkStatus
}) {
  const allVotesSubmitted = players.every(p => {
    const playerState = getPlayerState(p);

    // If we're only checking alive players, ignore dead ones
    if (checkStatus && p.state?.status !== 'alive') return true;

    // For relevant players, require confirmation
    return !!playerState?.hasConfirmed;
  });

  if (allVotesSubmitted) {
    await SendInstruction({ instruction, partyData });
  }

  return allVotesSubmitted;
}
