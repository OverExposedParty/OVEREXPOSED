let timeout;

async function DisplayRole() {
  const currentPartyData = await GetCurrentPartyData();
  const index = currentPartyData.players.findIndex(player => player.computerId === deviceId);

  const delay = new Date(currentPartyData.timer) - Date.now();
  startTimer(delay / 1000, mafiaDisplayRoleTimer / 1000, displayRoleTimerWrapper);

  displayRoleHeader.textContent = currentPartyData.players[index].role;
  displayRoleDescription.textContent = mafiaRoleDescription[currentPartyData.players[index].role];

  popUpRoleHeader.textContent = currentPartyData.players[index].role;
  popUpRoleDescription.textContent = mafiaRoleDescription[currentPartyData.players[index].role];

  setActiveContainers(displayRoleContainer);
  if (deviceId == hostDeviceId) {
    if (timeout?.cancel) {
      timeout.cancel();
    }
    timeout = null;
    timeout = createCancelableTimeout(delay);
    try {
      await timeout.promise;
    } catch (err) {
      if (err.message === 'Timeout canceled') {
        return;
      } else {
        throw err;
      }
    }
    const nightTimer = getGameSetting(currentPartyData.gameSettings, "mafia-night-timer") * 1000;
    currentPartyData.timer = new Date(Date.now() + nightTimer);
    await SendInstruction({
      instruction: "DISPLAY_NIGHT_PHASE",
      partyData: currentPartyData,
    });
  }
}

async function DisplayNightPhase() {
  sideButtonsContainer.classList.remove('disabled');
  const currentPartyData = await GetCurrentPartyData();
  const index = currentPartyData.players.findIndex(player => player.computerId === deviceId);
  displayRoleHeader.textContent = currentPartyData.players[index].role;
  displayRoleDescription.textContent = mafiaRoleDescription[currentPartyData.players[index].role];
  const nightTimerLength = getGameSetting(currentPartyData.gameSettings, "mafia-night-timer") * 1000;
  const timeLeft = (new Date(currentPartyData.timer) - Date.now());
  console.log("role: ", currentPartyData.players[index].role);
  console.log("index: ", index);
  if (currentPartyData.players[index].role == "civilian") {
    if (!selectCivilianWatchContainer.classList.contains('active') && !displayCivilianWatchResponseContainer.classList.contains('active')) {
      if (currentPartyData.players[index].hasConfirmed == false) {
        startTimer(timeLeft / 1000, nightTimerLength / 1000, selectCivilianWatchTimerWrapper);
        startTimer(timeLeft / 1000, nightTimerLength / 1000, displayCivilianWatchResponseTimerWrapper);
        InitializeCivilianWatch();
      }
      else {
        startTimer(timeLeft / 1000, nightTimerLength / 1000, waitingForPlayersTimerWrapper);
        setActiveContainers(waitingForPlayersContainers);
      }
    }
  }
  else {
    startTimer(timeLeft / 1000, nightTimerLength / 1000, selectUserVoteNightTimerWrapper);
    setActiveContainers(selectUserVoteNightContainer);
    const civilianButtons = selectUserVoteNightSelectUserContainer.querySelectorAll('button');
    if (currentPartyData.players[index].hasConfirmed == true) {
      selectUserVoteNightConfirmButton.classList.add('disabled');
    }
    else {
      selectUserVoteNightConfirmButton.classList.remove('disabled');
    }

    civilianButtons.forEach(civilianButton => {
      civilianButton.querySelector("#hover").textContent = String(currentPartyData.players.filter(p => p.isReady && p.vote === civilianButton.id).length);
      civilianButton.querySelector("#confirmed").textContent = String(currentPartyData.players.filter(p => p.hasConfirmed && p.vote === civilianButton.id).length);
    });
  }
  if (deviceId == hostDeviceId) {
    const allVotesSubmitted = currentPartyData.players.every(player => player.hasConfirmed === true);

    if (timeout?.cancel) {
      timeout.cancel();
      timeout = null;
    }
    if (!allVotesSubmitted) {
      timeout = createCancelableTimeout(timeLeft);
      try {
        await timeout.promise;
      } catch (err) {
        if (err.message === 'Timeout canceled') {
          return;
        } else {
          throw err;
        }
      }
    }
    currentPartyData.timer = new Date(Date.now() + displayPlayerKilledTimer);
    currentPartyData.phase = "day";
    const mafiaVote = await GetMafiaVote();
    currentPartyData.players = ResetVotes(currentPartyData.players);
    await SendInstruction({
      instruction: "DISPLAY_PLAYER_KILLED:" + mafiaVote,
      partyData: currentPartyData,
    });
  }
}

async function DisplayPlayerKilled(instruction) {
  const parsedInstructions = parseInstruction(instruction);
  const currentPartyData = await GetCurrentPartyData();
  const index = currentPartyData.players.findIndex(player => player.computerId === deviceId);
  const rawDialogue = mafiaDialogueKill[Math.floor(Math.random() * mafiaDialogueKill.length)];
  const playerKilledIndex = currentPartyData.players.findIndex(player => player.computerId === parsedInstructions.reason)
  let finalDialogue;

  if (playerKilledIndex !== undefined) {
    const playerKilled = currentPartyData.players[playerKilledIndex].username;
    finalDialogue = rawDialogue.replace("[Player Name]", playerKilled); //Get Player Killed
    currentPartyData.players[playerKilledIndex].status = 'dead';
    RemoveUserButton(selectUserVoteDaySelectUserContainer, currentPartyData.players[playerKilledIndex].computerId);
    RemoveUserButton(selectUserVoteNightSelectUserContainer, currentPartyData.players[playerKilledIndex].computerId);
  }
  else {
    finalDialogue = mafiaDialogueNoKill[Math.floor(Math.random() * mafiaDialogueKill.length)];
  }
  displayPlayerKilledText.textContent = finalDialogue;
  const timeLeft = (new Date(currentPartyData.timer) - Date.now());
  startTimer(timeLeft / 1000, displayPlayerKilledTimer / 1000, displayPlayerKilledTimerWrapper);

  setActiveContainers(displayPlayerKilledContainer);

  if (deviceId == hostDeviceId) {
    if (timeout?.cancel) {
      timeout.cancel();
    }
    timeout = null;
    timeout = createCancelableTimeout(timeLeft);
    try {
      await timeout.promise;
    } catch (err) {
      if (err.message === 'Timeout canceled') {
        return;
      } else {
        throw err;
      }
    }
    const dayTimer = getGameSetting(currentPartyData.gameSettings, "mafia-day-timer") * 1000;
    currentPartyData.timer = new Date(Date.now() + dayTimer);
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
      });
    }
  }
}

async function DisplayDayPhaseDiscussion() {
  const currentPartyData = await GetCurrentPartyData();
  const index = currentPartyData.players.findIndex(player => player.computerId === deviceId);

  const dayTimerLength = getGameSetting(currentPartyData.gameSettings, "mafia-day-timer") * 1000;
  const timeLeft = (new Date(currentPartyData.timer) - Date.now());
  startTimer(timeLeft / 1000, dayTimerLength / 1000, displayDayPhaseDiscussionContainer);
  setActiveContainers(displayDayPhaseDiscussionContainer);

  if (deviceId == hostDeviceId) {
    if (timeout?.cancel) {
      timeout.cancel();
    }
    timeout = null;

    console.log("timeLeft: " + timeLeft);
    timeout = createCancelableTimeout(timeLeft);
    try {
      await timeout.promise;
    } catch (err) {
      if (err.message === 'Timeout canceled') {
        return;
      } else {
        throw err;
      }
    }
    const dayTimer = getGameSetting(currentPartyData.gameSettings, "mafia-day-timer") * 1000;
    currentPartyData.timer = new Date(Date.now() + dayTimer);
    await SendInstruction({
      instruction: "DISPLAY_DAY_PHASE_VOTE",
      partyData: currentPartyData,
    });
  }
}

async function DisplayDayPhaseVote() {
  const currentPartyData = await GetCurrentPartyData();
  const index = currentPartyData.players.findIndex(player => player.computerId === deviceId);

  const dayTimerLength = getGameSetting(currentPartyData.gameSettings, "mafia-day-timer") * 1000;
  const timeLeft = (new Date(currentPartyData.timer) - Date.now());
  startTimer(timeLeft / 1000, dayTimerLength / 1000, selectUserVoteDayTimerWrapper, true);
  startTimer(timeLeft / 1000, dayTimerLength / 1000, selectUserVoteDayTimerWrapper);
  setActiveContainers(selectUserVoteDayContainer);
  const usersButtons = selectUserVoteDaySelectUserContainer.querySelectorAll('button');
  if (currentPartyData.players[index].hasConfirmed == true) {
    selectUserVoteDayConfirmButton.classList.add('disabled');
  }
  else {
    selectUserVoteDayConfirmButton.classList.remove('disabled');
  }

  usersButtons.forEach(usersButton => {
    usersButton.querySelector("#hover").textContent = String(currentPartyData.players.filter(p => p.isReady && p.vote === usersButton.id).length);
    usersButton.querySelector("#confirmed").textContent = String(currentPartyData.players.filter(p => p.hasConfirmed && p.vote === usersButton.id).length);
  });

  if (deviceId == hostDeviceId) {
    const allVotesSubmitted = currentPartyData.players.every(player => player.hasConfirmed === true);
    if (timeout?.cancel) {
      timeout.cancel();
      timeout = null;
    }

    if (!allVotesSubmitted) {
      timeout = createCancelableTimeout(timeLeft);
      try {
        await timeout.promise;
      } catch (err) {
        if (err.message === 'Timeout canceled') {
          return;
        } else {
          throw err;
        }
      }
    }

    currentPartyData.timer = new Date(Date.now() + displayPlayerKilledTimer);
    const townVote = await GetTownVote();
    currentPartyData.players = ResetVotes(currentPartyData.players);
    await SendInstruction({
      instruction: "DISPLAY_TOWN_VOTE:" + townVote,
      partyData: currentPartyData,
    });
  }
}

async function DisplayTownVote(instruction) {
  const parsedInstructions = parseInstruction(instruction);
  const currentPartyData = await GetCurrentPartyData();
  const index = currentPartyData.players.findIndex(player => player.computerId === deviceId);
  const rawDialogue = mafiaDialogueTownVote[Math.floor(Math.random() * mafiaDialogueTownVote.length)];
  const playerVotedOutIndex = currentPartyData.players.findIndex(player => player.computerId === parsedInstructions.reason)
  if (playerVotedOutIndex == "") {
    const playerVotedOut = currentPartyData.players[playerVotedOutIndex].username;
    finalDialogue = rawDialogue.replace("[Player Name]", playerVotedOut); //Get Player Killed
    currentPartyData.players[playerVotedOutIndex].status = 'dead';
    RemoveUserButton(selectUserVoteDaySelectUserContainer, currentPartyData.players[playerVotedOutIndex].computerId);
    RemoveUserButton(selectUserVoteNightSelectUserContainer, currentPartyData.players[playerVotedOutIndex].computerId);
  }
  else {
    finalDialogue = mafiaDialogueTownNoVote[Math.floor(Math.random() * mafiaDialogueKill.length)];
  }
  displayPlayerKilledText.textContent = finalDialogue;
  const timeLeft = (new Date(currentPartyData.timer) - Date.now());
  startTimer(timeLeft / 1000, displayPlayerKilledTimer / 1000, displayTownVoteTimerWrapper);
  setActiveContainers(displayTownVoteContainer);

  if (deviceId == hostDeviceId) {
    if (timeout?.cancel) {
      timeout.cancel();
    }
    timeout = null;
    timeout = createCancelableTimeout(timeLeft);
    try {
      await timeout.promise;
    } catch (err) {
      if (err.message === 'Timeout canceled') {
        return;
      } else {
        throw err;
      }
    }
    const nightTimer = getGameSetting(currentPartyData.gameSettings, "mafia-day-timer") * 1000;
    currentPartyData.timer = new Date(Date.now() + nightTimer);
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
      });
    }
  }
}

async function DisplayGameOver(instruction) {
  setActiveContainers(displayGameOverContainer);
  const parsedInstructions = parseInstruction(instruction);
  if (parsedInstructions.reason == "MAFIOSO") {
    displayGameOverHeader.textContent = "MAFIA WIN";
    displayGameOverText.textContent = "MAFIA HAVE OUTLASTED THE CIVILIANS";
  }
  else if (parsedInstructions.reason == "CIVILIAN") {
    displayGameOverHeader.textContent = "CIVILIAN WIN";
    displayGameOverText.textContent = "CIVILIAN HAVE OUTLASTED THE MAFIA";
  }
}