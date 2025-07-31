function DisplayWaitingForPlayers(currentPartyData, index, confirmation = true) {
  setActiveContainers(waitingForPlayersContainer);
  const icons = waitingForPlayersIconContainer.querySelectorAll('.icon');

  for (let i = 0; i < currentPartyData.players.length; i++) {
    const player = currentPartyData.players[i];

    const shouldHighlight = confirmation ? player.hasConfirmed : player.isReady;

    if (shouldHighlight) {
      icons[i].classList.add('yes');
    } else {
      icons[i].classList.remove('yes');
    }
  }
  currentPartyData.players[index].lastPing = Date.now();
}


async function WaitingForPlayer(instruction) {
  let parsedInstructions = parseInstruction(instruction)

  if (await GetSelectedPlayerTurnID() === deviceId) {
    if (parsedInstructions.reason != "READING_CARD") {
      setActiveContainers(selectUserContainer);
    }
    else {
      setActiveContainers(gameContainerPrivate);
    }
  }
  else {
    setActiveContainers(waitingForPlayerContainer);
  }

  waitingForPlayerTitle.textContent = "Waiting for " + parsedInstructions.username;

  if (parsedInstructions.reason == "CHOOSE_PLAYER") {
    waitingForPlayerText.textContent = "Choosing Player...";
  }
  else if (parsedInstructions.reason == "READING_CARD") {
    waitingForPlayerText.textContent = "Reading Card...";
  }
}

function DisplayPunishmentToUser(instruction) {
  let parsedInstructions = parseInstructionDeviceId(instruction)
  waitingForPlayerText.textContent = "Showing player punishment...";
  if (parsedInstructions.deviceId == deviceId) {
    setActiveContainers(completePunishmentContainer);
  }
  else {
    setActiveContainers(waitingForPlayerContainer);
  }
}

async function PunishmentOffer(instruction) {
  let parsedInstructions = parseInstructionSecondReason(instruction);
  const currentPartyData = await GetCurrentPartyData();

  if (parsedInstructions.reason === "PASS") {
    if (parsedInstructions.deviceId === deviceId) {
      await SendInstruction({
        instruction: "USER_HAS_PASSED:USER_PASSED_PUNISHMENT:" + deviceId,
        partyData: currentPartyData
      });
    }
  } else if (parsedInstructions.reason === "CONFIRM") {
    if (deviceId === parsedInstructions.deviceId) {
      // Reset all isReady and hasConfirmed flags
      currentPartyData.players.forEach(player => {
        player.isReady = false;
        player.hasConfirmed = false;
      });

      const index = currentPartyData.players.findIndex(player => player.computerId === deviceId);
      const icons = waitingForPlayersIconContainer.querySelectorAll('.icon');

      if (index !== -1) {
        icons[index].classList.add('yes');
        currentPartyData.players[index].isReady = true;
        currentPartyData.players[index].hasConfirmed = true;
      }

      await SendInstruction({
        instruction: "HAS_USER_DONE_PUNISHMENT:" + parsedInstructions.secondReason + ":" + deviceId,
        partyData: currentPartyData
      });
    }
  }
}


async function ChosePunishment(instruction) {
  let parsedInstructions = parseInstruction(instruction);
  const currentPartyData = await GetCurrentPartyData();
  const index = currentPartyData.players.findIndex(player => player.computerId === deviceId);
  const icons = waitingForPlayersIconContainer.querySelectorAll('.icon');

  const allConfirmed = currentPartyData.players.every(player => player.hasConfirmed === true);

  const haveVoteCount = currentPartyData.players.filter(player => player.votes === true).length;
  const haveNotVoteCount = currentPartyData.players.filter(player => player.votes === false).length;

  if (allConfirmed) {
    if (currentPartyData.players[0].computerId === deviceId) {
      ResetQuestion(currentPartyData, icons);
    }
  } 
  else if (currentPartyData.players[index].vote == true   ) {
    if (parsedInstructions.reason === "ODD_MAN_OUT" && ((haveVoteCount == currentPartyData.players.length-1 && currentPartyData.players[index].vote == false) || (haveNotVoteCount == currentPartyData.players.length-1 && currentPartyData.players[index].vote == true))) {
      setActiveContainers(drinkingWheelContainer);
    } 
    else if (parsedInstructions.reason === "TAKE_A_SHOT" && currentPartyData.players[index].vote == true) {
      punishmentText.textContent = "Take a shot.";
      if (!currentPartyData.players[index].hasConfirmed) {
        setActiveContainers(completePunishmentContainer);
      } else {
        DisplayWaitingForPlayers(currentPartyData, index, true);
      }
    }
  } else {
    waitingForPlayerTitle.textContent = "Waiting for " + currentPartyData.players[index].username;
    
    if (parsedInstructions.reason === "MOST_LIKELY_TO_DRINK_WHEEL") {
      waitingForPlayerText.textContent = "Spinning drink wheel...";
    } else if (parsedInstructions.reason === "TAKE_A_SHOT") {
      waitingForPlayerText.textContent = "Reading punishment...";
    }

    if (!currentPartyData.players[index].isReady) {
      setUserBool(deviceId, true, true, parsedInstructions.instruction);
    }

    DisplayWaitingForPlayers(currentPartyData, index, true);
  }
}

async function UserSelectedForPunishment(instruction) {
  const currentPartyData = await GetCurrentPartyData();
  let parsedInstructions = parseInstructionDeviceId(instruction);
  const index = currentPartyData.players.findIndex(player => player.computerId === parsedInstructions.deviceId);
  if (parsedInstructions.deviceId == deviceId) {
    setActiveContainers(selectPunishmentContainer);
  }
  else {
    waitingForPlayerTitle.textContent = "Waiting for " + currentPartyData.players[index].username;
    waitingForPlayerText.textContent = "Choosing Punishment...";
    setActiveContainers(waitingForPlayerContainer);
  }
}
//add container
async function AnswerToUserDonePunishment() {
  const currentPartyData = await GetCurrentPartyData();
  const icons = waitingForPlayersIconContainer.querySelectorAll('.icon');

  const index = currentPartyData.players.findIndex(player => player.computerId === deviceId);

  if (currentPartyData.players[index].isReady === true) {
    DisplayWaitingForPlayers(currentPartyData, index);

    const allReady = currentPartyData.players.every(player => player.isReady === true);

    if (allReady) {
      if (deviceId === currentPartyData.players[0].computerId) {
        ResetQuestion(currentPartyData, icons);
      }
    }
  }
}

async function DisplayPublicCard(instruction) {
  const currentPartyData = await GetCurrentPartyData();
  const index = currentPartyData.players.findIndex(player => player.computerId === deviceId);
  const parsedInstructions = parseInstructionSecondReason(instruction);

  const player = currentPartyData.players[index];

  if (!player.isReady && !player.hasConfirmed) {
    const selectedQuestionObj = getNextQuestion(currentPartyData.currentCardIndex);
    updateTextContainer(selectedQuestionObj.question, selectedQuestionObj.cardType);
    setActiveContainers(gameContainerPublic);
  }
  else if (player.isReady && !player.hasConfirmed) {
    setActiveContainers(selectOptionContainer);
  }
  else {
    const allConfirmed = currentPartyData.players.every(player => player.hasConfirmed === true);

    if (allConfirmed) {
      ClearVotesResults();
      if (deviceId === currentPartyData.players[0].computerId) {
        await SendInstruction({
          instruction: "DISPLAY_VOTE_RESULTS"
        });
      }
    }
    else {
      if (player.hasConfirmed) {
        DisplayWaitingForPlayers(currentPartyData, index);
      }
    }
  }
}

async function DisplayVoteResults(instruction) {
  const currentPartyData = await GetCurrentPartyData();
  const parsedInstructions = parseInstruction(instruction);

  if (!resultsChartContainer.classList.contains('active')) {
    GetVoteResults(currentPartyData);
    setActiveContainers(resultsChartContainer);
  }

  if (currentPartyData.players[0].computerId === deviceId) {
    await new Promise(resolve => setTimeout(resolve, 5000));

    const punishmentInstruction = currentPartyData.gameSettings.includes('odd-man-out')
      ? "CHOSE_PUNISHMENT:ODD_MAN_OUT:"
      : "CHOSE_PUNISHMENT:TAKE_A_SHOT:";

    await SendInstruction({
      instruction: punishmentInstruction,
      updateUsersReady: false,
      updateUsersConfirmation: false
    });
  }
}


function GetVoteResults(currentPartyData) {
  haveVotes = [];
  haveNeverVotes = [];

  currentPartyData.players.forEach((player) => {
    if (player.vote == true) {
      haveVotes.push(player.username);
    } else if (player.vote == false){
      haveNeverVotes.push(player.username);
    }
  });

  resultsChart.data.datasets[0].data = [haveVotes.length, haveNeverVotes.length];
  resultsChart.update();
}

function ClearVotesResults() {
  haveVotes.splice(0, haveVotes.length);
  haveNeverVotes.splice(0, haveNeverVotes.length);

  resultsChart.data.datasets[0].data = [haveVotes.length, haveNeverVotes.length];
  resultsChart.update();
}