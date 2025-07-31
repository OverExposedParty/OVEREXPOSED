async function setPageforUser() {
  const response = await fetch(`/api/${sessionPartyType}?partyCode=${partyCode}`);
  const data = await response.json();
  const currentPartyData = await GetCurrentPartyData();

  waitingForPlayerTitle.textContent = "Waiting for " + currentPartyData.players[currentPartyData.playerTurn].username;
  waitingForPlayerText.textContent = "Reading Card...";

  if (currentPartyData.players[currentPartyData.playerTurn].computerId == deviceId) {
    setActiveContainers(gameContainerPrivate);
  }
  else {
    setActiveContainers(waitingForPlayerContainer);
  }
}

async function NextUserTurn() {
  const currentPartyData = await GetCurrentPartyData();
  const selectedQuestionObj = getNextQuestion(currentPartyData.currentCardIndex);
  updateTextContainer(selectedQuestionObj.question, selectedQuestionObj.cardType);
  if (currentPartyData.players[currentPartyData.playerTurn].computerId == deviceId) {
    setActiveContainers(gameContainerPrivate);
  }
  else {
    waitingForPlayerTitle.textContent = "Waiting for " + currentPartyData.players[currentPartyData.playerTurn].username;
    waitingForPlayerText.textContent = "Reading Card...";
    setActiveContainers(waitingForPlayerContainer);
  }

  let currentUsersReady = 0
  if (currentUsersReady > 0) {
    await SendInstruction({
      partyData: currentPartyData
    });
  }
  ClearIcons();
}

async function NextQuestion() {
  const currentPartyData = await GetCurrentPartyData();
  const index = currentPartyData.players.findIndex(player => player.computerId === deviceId);

  if (index === -1) {
    console.warn("Device not found in players.");
    return;
  }

  const icons = waitingForPlayersIconContainer.querySelectorAll('.icon');

  if (currentPartyData.players[index].hasConfirmed === true) {
    setActiveContainers(waitingForPlayersContainer);

    // Update player's last ping
    currentPartyData.players[index].lastPing = Date.now();

    // Count total players ready
    let totalUsersReady = 0;
    currentPartyData.players.forEach((player, i) => {
      if (player.hasConfirmed === true) {
        totalUsersReady++;
        if (icons[i]) icons[i].classList.add('yes');
      }
    });

    const allReady = currentPartyData.players.every(player => player.hasConfirmed === true);

    if (allReady) {
      // Only host should update indexes and player turn
      const hostId = currentPartyData.players[0].computerId;
      if (deviceId === hostId) {
        currentPartyData.currentCardIndex++;
        currentPartyData.playerTurn = (currentPartyData.playerTurn + 1) % currentPartyData.players.length;
      }

      icons.forEach(icon => icon.classList.add('yes'));

      await new Promise(resolve => setTimeout(resolve, 1500));

      await SendInstruction({
        partyData: currentPartyData,
        instruction: "NEXT_USER_TURN",
        updateUsersReady: false
      });
    } 
    else if (!waitingForPlayersContainer.classList.contains('active')) {
      console.log(waitingForPlayersContainer);
      await SendInstruction({ partyData: currentPartyData });
    }
  } else {
    setActiveContainers(gameContainerPublic);
  }
}


async function WaitingForPlayer(instruction) {
  let parsedInstructions = parseInstruction(instruction)
  const currentPartyData = await GetCurrentPartyData();

  if (currentPartyData.players[currentPartyData.playerTurn].computerId == deviceId) {
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

  waitingForPlayerTitle.textContent = "Waiting for " + currentPartyData.players[currentPartyData.playerTurn].username;

  if (parsedInstructions.reason == "CHOOSE_PLAYER") {
    waitingForPlayerText.textContent = "Choosing Player...";
  }
  else if (parsedInstructions.reason == "READING_CARD") {
    waitingForPlayerText.textContent = "Reading Card...";
  }
}

async function ChoosingPunishment() {
  const currentPartyData = await GetCurrentPartyData();
  const index = currentPartyData.players.findIndex(player => player.computerId === currentPartyData.players[currentPartyData.playerTurn].vote);

  waitingForPlayerTitle.textContent = "Waiting for " + currentPartyData.players[index].username;
  waitingForPlayerText.textContent = "Choosing Punishment...";
  if (currentPartyData.players[currentPartyData.playerTurn].vote == deviceId) {
    setActiveContainers(selectPunishmentContainer);
  }
  else {
    setActiveContainers(waitingForPlayerContainer);
  }
}

function DisplayPunishmentToUser(instruction) {
  let parsedInstructions = parseInstructionDeviceId(instruction)
  waitingForPlayerText.textContent = "Showing player punishment...";
  if (currentPartyData.players[currentPartyData.playerTurn].vote == deviceId) {
    setActiveContainers(completePunishmentContainer);
  }
  else {
    setActiveContainers(waitingForPlayerContainer);
  }
}


//add container 
async function PunishmentOffer(instruction) {
  let parsedInstructions = parseInstructionSecondReason(instruction)
  const currentPartyData = await GetCurrentPartyData();

  if (parsedInstructions.reason == "PASS") {
    if (currentPartyData.players[currentPartyData.playerTurn].vote == deviceId) {
      await SendInstruction({
        instruction: "USER_HAS_PASSED:USER_PASSED_PUNISHMENT"
      });
    }
  }
  else if (parsedInstructions.reason == "CONFIRM") {
    if (deviceId == currentPartyData.players[currentPartyData.playerTurn].vote) {
      for (let i = 0; i < currentPartyData.players.length; i++) {
        currentPartyData.players[i].isReady = false;
      }
      const index = currentPartyData.players.findIndex(player => player.computerId === deviceId);
      const icons = waitingForPlayersIconContainer.querySelectorAll('.icon');
      icons[index].classList.add('yes');
      currentPartyData.players[index].isReady = true;
      currentPartyData.players[index].hasConfirmed = true;
      await SendInstruction({
        instruction: "HAS_USER_DONE_PUNISHMENT:" + parsedInstructions.secondReason
      });
    }
  }
}

async function UserHasPassed(instruction) {
  let parsedInstructions = parseInstruction(instruction)
  const currentPartyData = await GetCurrentPartyData();
  const index = currentPartyData.players.findIndex(player => player.computerId === currentPartyData.players[currentPartyData.playerTurn].vote);
  setActiveContainers(playerHasPassedContainer);
  playerHasPassedTitle.textContent = currentPartyData.players[index].username + " has passed";
  if (parsedInstructions.reason == "USER_CALLED_WRONG_FACE") {
    playerHasPassedText.textContent = "unsuccessful coin flip";
  }
  else if (parsedInstructions.reason == "USER_PASSED_PUNISHMENT") {
    playerHasPassedText.textContent = "punishment has been forfeited";
  }
  else if (parsedInstructions.reason == "USER_DIDNT_DO_PUNISHMENT") {
    playerHasPassedText.textContent = "punishment not complete";
  }

  await new Promise(resolve => setTimeout(resolve, 1000));

  ClearIcons();
  if (deviceId == hostDeviceId) {
    currentPartyData.currentCardIndex++;
    currentPartyData.playerTurn++;
    if (currentPartyData.playerTurn >= currentPartyData.players.length) {
      currentPartyData.playerTurn = 0;
    }
    await SendInstruction({
      instruction: "NEXT_USER_TURN",
      partyData: currentPartyData
    });
  }
}

async function HasUserDonePunishment(instruction) {
  let parsedInstructions = parseInstruction(instruction)
  const currentPartyData = await GetCurrentPartyData();
  const index = currentPartyData.players.findIndex(player => player.computerId === currentPartyData.players[currentPartyData.playerTurn].vote);

  if (currentPartyData.players[currentPartyData.playerTurn].vote != deviceId) {
    if (!confirmPunishmentContainer.classList.contains('active')) {
      if (parsedInstructions.reason == "TAKE_A_SHOT") {
        confirmPunishmentText.textContent = "Has " + currentPartyData.players[index].username + " taken their shot";
      }
      else if (parsedInstructions.reason == "DOWN_DRINK") {
        confirmPunishmentText.textContent = "Has " + currentPartyData.players[index].username + " downed their drink";
      }
      else if (parsedInstructions.reason.includes("SIP")) {
        confirmPunishmentText.textContent = "Has " + currentPartyData.players[index].username + " taken " + parsedInstructions.reason.replace("_", " "); + ".";
      }
      setActiveContainers(confirmPunishmentContainer);
    }
  }
  else if (!waitingForPlayersContainer.classList.contains('active')) {
    setActiveContainers(waitingForPlayersContainer);
    currentPartyData.players[index].isReady = true;
    currentPartyData.players[index].hasConfirmed = true;
    currentPartyData.players[index].lastPing = Date.now();

    await SendInstruction({
      partyData: currentPartyData
    });
  }
}

async function ChosePunishment(instruction) {
  let parsedInstructions = parseInstruction(instruction)
  const currentPartyData = await GetCurrentPartyData();

  const index = currentPartyData.players.findIndex(player => player.computerId === currentPartyData.players[currentPartyData.playerTurn].vote);
  if (deviceId == currentPartyData.players[currentPartyData.playerTurn].vote) {
    if (parsedInstructions.reason == "PARANOIA_COIN_FLIP") {
      setActiveContainers(pickHeadsOrTailsContainer);
    }
    else if (parsedInstructions.reason == "PARANOIA_DRINK_WHEEL") {
      setActiveContainers(drinkingWheelContainer);
    }
    else if (parsedInstructions.reason == "TAKE_A_SHOT") {
      punishmentText.textContent = "In order to find out the question you have to take a shot.";
      setActiveContainers(completePunishmentContainer);
    }
  }
  else {
    waitingForPlayerTitle.textContent = "Waiting for " + currentPartyData.players[index].username;
    if (parsedInstructions.reason == "PARANOIA_COIN_FLIP") {
      waitingForPlayerText.textContent = "Calling coin flip...";
    }
    else if (parsedInstructions.reason == "PARANOIA_DRINK_WHEEL") {
      waitingForPlayerText.textContent = "Spinning drink wheel...";
    }
    else if (parsedInstructions.reason == "TAKE_A_SHOT") {
      waitingForPlayerText.textContent = "Reading punishment...";
    }
    setActiveContainers(waitingForPlayerContainer);
  }
}

async function UserSelectedForPunishment(instruction) {
  const currentPartyData = await GetCurrentPartyData();
  let parsedInstructions = parseInstructionDeviceId(instruction);
  const index = currentPartyData.players.findIndex(player => player.computerId === currentPartyData.players[currentPartyData.playerTurn].vote);
  if (currentPartyData.players[currentPartyData.playerTurn].vote == deviceId) {
    setActiveContainers(selectPunishmentContainer);
  }
  else {
    waitingForPlayerTitle.textContent = "Waiting for " + currentPartyData.players[index].username;
    waitingForPlayerText.textContent = "Choosing Punishment...";
    setActiveContainers(waitingForPlayerContainer);
  }
}

//add container
async function AnswerToUserDonePunishment(instruction) {
  const parsedInstructions = parseInstruction(instruction);
  const currentPartyData = await GetCurrentPartyData();
  const icons = waitingForPlayersIconContainer.querySelectorAll('.icon');

  // Get the index of the current player
  const index = currentPartyData.players.findIndex(player => player.computerId === deviceId);

  if (currentPartyData.players[index].hasConfirmed === true) {
    setActiveContainers(waitingForPlayersContainer);

    // Show icons for ready players
    for (let i = 0; i < currentPartyData.players.length; i++) {
      const player = currentPartyData.players[i];
      if (player.isReady === true) {
        if (player.hasConfirmed === true) {
          icons[i].classList.add('yes');
        } else {
          icons[i].classList.add('no');
        }
      }
    }

    // Update last ping for current user
    currentPartyData.players[index].lastPing = Date.now();

    // Count confirmations
    const totalUsersConfirmation = currentPartyData.players.filter(player => player.hasConfirmed).length;

    if (totalUsersConfirmation === currentPartyData.players.length) {
      // Everyone confirmed, flash green
      icons.forEach(icon => icon.classList.add('yes'));

      await new Promise(resolve => setTimeout(resolve, 1500));

      const yesIconsCount = Array.from(icons).filter(icon => icon.classList.contains("yes")).length;
      const noIconsCount = Array.from(icons).filter(icon => icon.classList.contains("no")).length;

      if (noIconsCount < yesIconsCount) {
        currentPartyData.currentCardIndex++;

        if (parsedInstructions.reason === "QUESTION") {
          await SendInstruction({
            instruction: "NEXT_USER_TURN"
          });

        } else if (parsedInstructions.reason === "PUNISHMENT") {
          const hostId = currentPartyData.players[0].computerId;

          if (deviceId === hostId) {
            currentPartyData.currentCardIndex++;
            currentPartyData.playerTurn++;

            if (currentPartyData.playerTurn >= currentPartyData.players.length) {
              currentPartyData.playerTurn = 0;
            }

            await SendInstruction({
              instruction: "NEXT_QUESTION",
              partyData: currentPartyData,
              updateUsersReady: false,
              updateUsersConfirmation: false
            });
            ClearIcons();
          }
        }

      } else {
        await SendInstruction({
          instruction: `USER_HAS_PASSED:USER_DIDNT_DO_PUNISHMENT`
        });
      }
    }
  }
}

async function DisplayPublicCard() {
  const currentPartyData = await GetCurrentPartyData();
  await SendInstruction({
    instruction: "NEXT_QUESTION",
    partyData: currentPartyData,
    updateUsersReady: false,
    updateUsersConfirmation: false
  });
  ClearIcons();
}