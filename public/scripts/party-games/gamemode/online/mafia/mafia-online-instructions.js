const nightTimer = getIncrementContainerValue("night-timer") * 1000;
const dayTimer = getIncrementContainerValue("day-timer") * 1000;

const mafiaDisplayRoleTimer = 7500;
const displayPlayerKilledTimer = 7500;

async function DisplayRole() {
  const delay = new Date(currentPartyData.timer) - Date.now();
  startTimer({ timeLeft: delay / 1000, duration: mafiaDisplayRoleTimer / 1000, selectedTimer: displayRoleContainer.querySelector('.timer-wrapper') });
  SetTimeOut({ delay: delay, instruction: "DISPLAY_NIGHT_PHASE", nextDelay: nightTimer })

  const index = currentPartyData.players.findIndex(player => player.computerId === deviceId);

  displayRoleTitle.textContent = currentPartyData.players[index].role;
  displayRoleText.textContent = mafiaRoleDescription[currentPartyData.players[index].role];

  popUpRoleHeader.textContent = currentPartyData.players[index].role;
  popUpRoleDescription.textContent = mafiaRoleDescription[currentPartyData.players[index].role];

  setActiveContainers(displayRoleContainer);
}

async function DisplayNightPhase() {
  const delay = (new Date(currentPartyData.timer) - Date.now());
  startTimer({ timeLeft: delay / 1000, duration: nightTimer / 1000, selectedTimer: selectCivilianWatchContainer.querySelector('.timer-wrapper') });
  startTimer({ timeLeft: delay / 1000, duration: nightTimer / 1000, selectedTimer: displayCivilianWatchResponseContainer.querySelector('.timer-wrapper') });
  startTimer({ timeLeft: delay / 1000, duration: nightTimer / 1000, selectedTimer: waitingForPlayersContainer.querySelector('.timer-wrapper') });
  startTimer({ timeLeft: delay / 1000, duration: nightTimer / 1000, selectedTimer: selectUserNightPhaseContainer.querySelector('.timer-wrapper') });
  SetTimeOut({ delay: delay, instruction: "DISPLAY_NIGHT_PHASE_PART_TWO", nextDelay: null });

  sideButtonsContainer.classList.remove('disabled');

  const index = currentPartyData.players.findIndex(player => player.computerId === deviceId);
  displayRoleTitle.textContent = currentPartyData.players[index].role;
  displayRoleText.textContent = mafiaRoleDescription[currentPartyData.players[index].role];
  console.log("role: ", currentPartyData.players[index].role);
  console.log("index: ", index);
  if (currentPartyData.players[index].role == "civilian") {
    if (!selectCivilianWatchContainer.classList.contains('active') && !displayCivilianWatchResponseContainer.classList.contains('active')) {
      if (currentPartyData.players[index].hasConfirmed === true) {
        selectCivilianWatchContainer.querySelectorAll('button').forEach(btn => btn.classList.add('disabled'));
      } else if (currentPartyData.players[index].hasConfirmed === false) {
        selectCivilianWatchContainer.querySelectorAll('button').forEach(btn => btn.classList.remove('disabled'));
      }

      InitializeCivilianWatch();
    }
  }
  else {
    setActiveContainers(selectUserNightPhaseContainer);
    const civilianButtons = selectUserNightPhaseButtonContainer.querySelectorAll('button');
    if (currentPartyData.players[index].hasConfirmed == true) {
      selectUserNightPhaseConfirmButton.classList.add('disabled');
    }
    else {
      selectUserNightPhaseConfirmButton.classList.remove('disabled');
    }

    civilianButtons.forEach(civilianButton => {
      civilianButton.querySelector("#hover").textContent = String(currentPartyData.players.filter(p => p.isReady && p.vote === civilianButton.id).length);
      civilianButton.querySelector("#confirmed").textContent = String(currentPartyData.players.filter(p => p.hasConfirmed && p.vote === civilianButton.id).length);
    });
  }
  if (deviceId == hostDeviceId) {
    const allVotesSubmitted = currentPartyData.players.every(player => player.hasConfirmed === true);

    if (!allVotesSubmitted) return;
    await SendInstruction({
      instruction: "DISPLAY_NIGHT_PHASE_PART_TWO",
      partyData: currentPartyData,
    });
  }
}

async function DisplayNightPhasePartTwo() {
  if (deviceId != hostDeviceId) return;
  currentPartyData.phase = "day";
  const mafiaVote = GetMafiaVote();
  currentPartyData.players = ResetVotes(currentPartyData.players);
  await SendInstruction({
    instruction: "DISPLAY_PLAYER_KILLED:" + mafiaVote,
    partyData: currentPartyData,
    timer: new Date(Date.now() + displayPlayerKilledTimer),
  });
}

async function DisplayPlayerKilled(instruction) {
  const delay = (new Date(currentPartyData.timer) - Date.now());
  startTimer({ timeLeft: delay / 1000, duration: displayPlayerKilledTimer / 1000, selectedTimer: displayPlayerKilledContainer.querySelector('.timer-wrapper') });
  SetTimeOut({ delay: delay, instruction: "DISPLAY_PLAYER_KILLED_PART_TWO", nextDelay: null });

  const parsedInstructions = parseInstruction(instruction);

  const index = currentPartyData.players.findIndex(player => player.computerId === deviceId);
  const rawDialogue = mafiaDialogueKill[Math.floor(Math.random() * mafiaDialogueKill.length)];
  const playerKilledIndex = currentPartyData.players.findIndex(player => player.computerId === parsedInstructions.reason)
  let finalDialogue;

  if (playerKilledIndex !== -1 || parsedInstructions.reason !== "") {
    const playerKilled = currentPartyData.players[playerKilledIndex].username;
    finalDialogue = rawDialogue.replace("[Player Name]", playerKilled);
    //currentPartyData.players[playerKilledIndex].status = 'dead';
    //RemoveUserButton(selectUserDayPhaseContainer, currentPartyData.players[playerKilledIndex].computerId);
    //RemoveUserButton(selectUserNightPhaseContainer, currentPartyData.players[playerKilledIndex].computerId);
  }
  else {
    finalDialogue = mafiaDialogueNoKill[Math.floor(Math.random() * mafiaDialogueKill.length)];
  }
  displayPlayerKilledText.textContent = finalDialogue;
  setActiveContainers(displayPlayerKilledContainer);
}

async function DisplayPlayerKilledPartTwo() {
  if (deviceId == hostDeviceId) {
    currentPartyData.players = ResetVotes(currentPartyData.players);
    const checkGameOver = await CheckGameOver();
    if (checkGameOver != null) {
      await SendInstruction({
        instruction: checkGameOver,
        partyData: currentPartyData,
      });
    }
    else {
      await SendInstruction({
        instruction: "DISPLAY_DAY_PHASE_DISCUSSION",
        partyData: currentPartyData,
        timer: new Date(Date.now() + dayTimer)
      });
    }
  }
}

async function DisplayDayPhaseDiscussion() {
  const delay = (new Date(currentPartyData.timer) - Date.now());
  startTimer({ timeLeft: delay / 1000, duration: dayTimer / 1000, selectedTimer: displayDayTimerContainer });
  SetTimeOut({ delay: delay, instruction: "DISPLAY_DAY_PHASE_VOTE", nextDelay: dayTimer });
  setActiveContainers(displayDayTimerContainer);
}

async function DisplayDayPhaseVote() {
  const delay = (new Date(currentPartyData.timer) - Date.now());
  startTimer({ timeLeft: delay / 1000, duration: dayTimer / 1000, selectedTimer: selectUserDayPhaseContainer.querySelector('.timer-wrapper') });
  SetTimeOut({ delay: delay, instruction: "DISPLAY_DAY_PHASE_VOTE_PART_TWO", nextDelay: dayTimer });

  const index = currentPartyData.players.findIndex(player => player.computerId === deviceId);
  setActiveContainers(selectUserDayPhaseContainer);
  const usersButtons = selectUserDayPhaseButtonContainer.querySelectorAll('button');
  if (currentPartyData.players[index].hasConfirmed == true) {
    selectUserDayPhaseConfirmButton.classList.add('disabled');
  }
  else {
    selectUserDayPhaseConfirmButton.classList.remove('disabled');
  }

  usersButtons.forEach(usersButton => {
    usersButton.querySelector("#hover").textContent = String(currentPartyData.players.filter(p => p.isReady && p.vote === usersButton.id).length);
    usersButton.querySelector("#confirmed").textContent = String(currentPartyData.players.filter(p => p.hasConfirmed && p.vote === usersButton.id).length);
  });

  if (deviceId == hostDeviceId) {
    const allVotesSubmitted = currentPartyData.players.every(player => player.hasConfirmed === true);
    if (!allVotesSubmitted) return;
    await SendInstruction({
      instruction: "DISPLAY_DAY_PHASE_VOTE_PART_TWO",
      partyData: currentPartyData,
    });
  }
}

async function DisplayDayPhaseVotePartTwo() {
  if (deviceId != hostDeviceId) return;
  const townVote = await GetTownVote();
  currentPartyData.players = ResetVotes(currentPartyData.players);
  await SendInstruction({
    instruction: "DISPLAY_TOWN_VOTE:" + townVote,
    partyData: currentPartyData,
    timer: new Date(Date.now() + displayPlayerKilledTimer),
  });
}

async function DisplayTownVote(instruction) {
  const delay = (new Date(currentPartyData.timer) - Date.now());
  startTimer({ timeLeft: delay / 1000, duration: displayPlayerKilledTimer / 1000, selectedTimer: displayTownVoteContainer.querySelector('.timer-wrapper') });
  SetTimeOut({ delay: delay, instruction: "DISPLAY_TOWN_VOTE_PART_TWO", nextDelay: null });

  const parsedInstructions = parseInstruction(instruction);
  const rawDialogue = mafiaDialogueTownVote[Math.floor(Math.random() * mafiaDialogueTownVote.length)];
  const playerVotedOutIndex = currentPartyData.players.findIndex(player => player.computerId === parsedInstructions.reason)
  if (playerVotedOutIndex == "") {
    const playerVotedOut = currentPartyData.players[playerVotedOutIndex].username;
    finalDialogue = rawDialogue.replace("[Player Name]", playerVotedOut); //Get Player Killed
    //currentPartyData.players[playerVotedOutIndex].status = 'dead';
    //RemoveUserButton(selectUserVoteDaySelectUserContainer, currentPartyData.players[playerVotedOutIndex].computerId);
    //RemoveUserButton(selectUserVoteNightSelectUserContainer, currentPartyData.players[playerVotedOutIndex].computerId);
  }
  else {
    finalDialogue = mafiaDialogueTownNoVote[Math.floor(Math.random() * mafiaDialogueKill.length)];
  }
  displayTownVoteText.textContent = finalDialogue;

  setActiveContainers(displayTownVoteContainer);
}

async function DisplayTownVotePartTwo() {
  if (deviceId != hostDeviceId) return;
  const checkGameOver = await CheckGameOver();
  if (checkGameOver != null) {
    await SendInstruction({
      instruction: checkGameOver,
      partyData: currentPartyData,
    });
  }
  else {
    await SendInstruction({
      instruction: "DISPLAY_NIGHT_PHASE",
      partyData: currentPartyData,
      timer: new Date(Date.now() + nightTimer),
    });
  }
}

async function DisplayGameOver(instruction) {
  const parsedInstructions = parseInstruction(instruction);
  if (parsedInstructions.reason == "MAFIOSO") {
    displayGameOverTitle.textContent = "MAFIA WIN";
    displayGameOverText.textContent = "MAFIA HAVE OUTLASTED THE CIVILIANS";
  }
  else if (parsedInstructions.reason == "CIVILIAN") {
    displayGameOverTitle.textContent = "CIVILIAN WIN";
    displayGameOverText.textContent = "CIVILIAN HAVE OUTLASTED THE MAFIA";
  }
  setActiveContainers(displayGameOverContainer);
}