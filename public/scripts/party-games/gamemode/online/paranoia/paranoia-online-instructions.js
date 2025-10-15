async function NextUserTurn() {
  const currentPlayer = currentPartyData.players[currentPartyData.playerTurn];

  if (currentPartyData.players[currentPartyData.playerTurn].computerId == deviceId) {
    selectedQuestionObj = getNextQuestion(currentPartyData.currentCardIndex);
    DisplayCard(gameContainerPrivate, selectedQuestionObj);
    setActiveContainers(gameContainerPrivate);
  }
  else {
    SetWaitingForPlayer({
      waitingForRoomTitle: "Waiting for " + currentPlayer.username,
      waitingForRoomText: "Reading Card...",
      player: currentPlayer
    });
    setActiveContainers(waitingForPlayerContainer);
  }

  let currentUsersReady = 0
  if (currentUsersReady > 0) {
    for (let i = 0; i < currentPartyData.players.length; i++) {
      currentPartyData.players[i].isReady = false;
      currentPartyData.players[i].hasConfirmed = false;
    }
    await SendInstruction({
      partyData: currentPartyData
    });
  }
  ClearIcons();
}

async function NextQuestion() {
  await UpdatePartyGameStatistics();
  const index = currentPartyData.players.findIndex(player => player.computerId === deviceId);
  const votedIndex = currentPartyData.players.findIndex(player => player.computerId === currentPartyData.players[currentPartyData.playerTurn].vote);
  const currentPlayer = currentPartyData.players[currentPartyData.playerTurn];
  const VotedPlayer = currentPartyData.players[votedIndex];
  if (index === -1) {
    console.warn("Device not found in players.");
    return;
  }

  const icons = waitingForPlayersIconContainer.querySelectorAll('.icon');

  if (currentPartyData.players[index].hasConfirmed === true) {
    if (!waitingForPlayersContainer.classList.contains('active')) {
      ClearIcons();
    }
    setActiveContainers(waitingForPlayersContainer);

    // Update player's last ping
    currentPartyData.players[index].lastPing = Date.now();

    // Count total players ready
    currentPartyData.players.forEach((player, i) => {
      if (player.hasConfirmed && icons[i]) {
        icons[i].classList.add('yes');
      }
    });


    const allReady = currentPartyData.players.every(player => player.hasConfirmed === true);

    if (allReady) {
      // Only host should update indexes and player turn
      const hostId = currentPartyData.players[0].computerId;
      icons.forEach(icon => icon.classList.add('yes'));
      await new Promise(resolve => setTimeout(resolve, 1500));
      ResetParanoiaQuestion({nextPlayer: true});
    }
    else if (!waitingForPlayersContainer.classList.contains('active')) {
      await SendInstruction({ partyData: currentPartyData });
    }
  } else {
    EditUserIconPartyGames({
      container: gameContainerDualStack.querySelector('.dual-image-stack#dual-image-stack-1'),
      userId: currentPlayer.computerId,
      userCustomisationString: currentPlayer.userIcon
    });

    EditUserIconPartyGames({
      container: gameContainerDualStack.querySelector('.dual-image-stack#dual-image-stack-2'),
      userId: VotedPlayer.computerId,
      userCustomisationString: VotedPlayer.userIcon
    });
    selectedQuestionObj = getNextQuestion(currentPartyData.currentCardIndex);
    DisplayCard(gameContainerDualStack, selectedQuestionObj);
    setActiveContainers(gameContainerDualStack);
  }
}


async function DisplayPrivateCard(instruction) {
  let parsedInstructions = parseInstruction(instruction)
  currentPlayer = currentPartyData.players[currentPartyData.playerTurn];

  if (currentPlayer.computerId == deviceId) {
    if (parsedInstructions.reason != "READING_CARD") {
      setActiveContainers(selectUserContainer);
    }
    else {
      selectedQuestionObj = getNextQuestion(currentPartyData.currentCardIndex);
      DisplayCard(gameContainerPrivate, selectedQuestionObj);
      setActiveContainers(gameContainerPrivate);
    }
  }
  else {
    let currentWaitingForPlayerText;

    if (parsedInstructions.reason == "CHOOSE_PLAYER") {
      currentWaitingForPlayerText = "Choosing Player...";
    }
    else if (parsedInstructions.reason == "READING_CARD") {
      currentWaitingForPlayerText = "Reading Card...";
    }
    SetWaitingForPlayer({
      waitingForRoomTitle: "Waiting for " + currentPlayer.username,
      waitingForRoomText: currentWaitingForPlayerText,
      player: currentPlayer
    });
    setActiveContainers(waitingForPlayerContainer);
  }

}

async function ChoosingPunishment() {
  const index = currentPartyData.players.findIndex(player => player.computerId === currentPartyData.players[currentPartyData.playerTurn].vote);
  currentPlayer = currentPartyData.players[index];

  if (currentPartyData.players[currentPartyData.playerTurn].vote == deviceId) {
    setActiveContainers(selectPunishmentContainer);
  }
  else {
    SetWaitingForPlayer({
      waitingForRoomTitle: "Waiting for " + currentPartyData.players[index].username,
      waitingForRoomText: "Choosing Punishment...",
      player: currentPlayer
    });
    setActiveContainers(waitingForPlayerContainer);
  }
}

async function DisplayPunishmentToUser(instruction) {
  let parsedInstructions = parseInstruction(instruction)
  const index = currentPartyData.players.findIndex(player => player.computerId === currentPartyData.players[currentPartyData.playerTurn].vote);
  console.log("parsedInstructions.reason: ", parsedInstructions.reason);
  if (currentPartyData.players[currentPartyData.playerTurn].vote == deviceId) {
    if (parsedInstructions.reason == "DOWN_IT") {
      completePunishmentText.textContent = "In order to find out the question you have to down your drink.";
      completePunishmentContainer.setAttribute("punishment-type", "down-drink");
    } else {
      completePunishmentText.textContent = "In order to find out the question you have to take " + (parsedInstructions.reason).replace('_', ' ') + ".";
      completePunishmentContainer.setAttribute("punishment-type", parsedInstructions.reason);
    }
    setActiveContainers(completePunishmentContainer);
  }
  else {
    SetWaitingForPlayer({
      waitingForRoomTitle: "Waiting for " + currentPartyData.players[index].username,
      waitingForRoomText: "Showing player punishment...",
      player: currentPlayer
    });
    setActiveContainers(waitingForPlayerContainer);
  }
}

//add container 
async function PunishmentOffer(instruction) {
  let parsedInstructions = parseInstructionSecondReason(instruction);
  if (parsedInstructions.reason == "PASS") {
    if (currentPartyData.players[currentPartyData.playerTurn].vote == deviceId) {
      await SendInstruction({
        instruction: "USER_HAS_PASSED:USER_PASSED_PUNISHMENT",
        updateUsersReady: false,
        updateUsersConfirmation: false
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
        instruction: "HAS_USER_DONE_PUNISHMENT:" + parsedInstructions.secondReason,
        updateUsersReady: false,
        updateUsersConfirmation: false
      });
    }
  }
}

async function UserHasPassed(instruction) {
  let parsedInstructions = parseInstruction(instruction)
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

  await new Promise(resolve => setTimeout(resolve, 2000));

  ResetParanoiaQuestion({nextPlayer: true});
}

async function HasUserDonePunishment(instruction) {
  let parsedInstructions = parseInstruction(instruction)
  const index = currentPartyData.players.findIndex(player => player.computerId === currentPartyData.players[currentPartyData.playerTurn].vote);
  const currentIndex = currentPartyData.players.findIndex(player => player.computerId === deviceId);
  const icons = waitingForPlayersIconContainer.querySelectorAll('.icon');

  if (currentPartyData.players[currentIndex].isReady == false) {
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
      currentPartyData.players[index].hasConfirmed = true; //voted true automatically
      currentPartyData.players[index].lastPing = Date.now();

      await SendInstruction({
        partyData: currentPartyData
      });
    }
  }

  else {
    currentPartyData.players[currentIndex].lastPing = Date.now();
    const totalUsersConfirmation = currentPartyData.players.filter(player => player.isReady === true).length;

    if (totalUsersConfirmation === currentPartyData.players.length) {
      //icons.forEach(icon => icon.classList.add('yes'));
      //setActiveContainers(waitingForPlayersContainer);

      //await new Promise(resolve => setTimeout(resolve, 1500));

      const yesVoteCount = currentPartyData.players.filter(player => player.hasConfirmed === true).length;
      const noVoteCount = currentPartyData.players.filter(player => player.hasConfirmed === false).length;

      if (noVoteCount < yesVoteCount) {
        currentPartyData.players[currentPartyData.playerTurn].score++;
        if (parsedInstructions.reason === "QUESTION") {
          ResetParanoiaQuestion({nextPlayer: true});
        } 
        else {
          const hostId = currentPartyData.players[0].computerId;

          if (deviceId === hostId) {
            await SendInstruction({
              instruction: "NEXT_QUESTION",
              partyData: currentPartyData,
              updateUsersReady: false,
              updateUsersConfirmation: false
            });
          }
        }
      } else {
        await SendInstruction({
          instruction: `USER_HAS_PASSED:USER_DIDNT_DO_PUNISHMENT`,
          updateUsersReady: false,
          updateUsersConfirmation: false
        });
      }
    }
    else {
      const icons = waitingForPlayersIconContainer.querySelectorAll('.icon');
      currentPartyData.players.forEach((player, i) => {
        if (player.hasConfirmed && icons[i]) {
          icons[i].classList.add('yes');
        }
      });
      setActiveContainers(waitingForPlayersContainer);
    }
  }
}

async function ChosePunishment(instruction) {
  let parsedInstructions = parseInstruction(instruction)
  const index = currentPartyData.players.findIndex(player => player.computerId === currentPartyData.players[currentPartyData.playerTurn].vote);
  currentPlayer = currentPartyData.players[index];
  if (deviceId == currentPartyData.players[currentPartyData.playerTurn].vote) {
    if (parsedInstructions.reason == "COIN_FLIP") {
      setActiveContainers(pickHeadsOrTailsContainer);
    }
    else if (parsedInstructions.reason == "DRINK_WHEEL") {
      setActiveContainers(drinkWheelContainer);
    }
    else if (parsedInstructions.reason == "TAKE_A_SHOT") {
      completePunishmentText.textContent = "In order to find out the question you have to take a shot.";
      setActiveContainers(completePunishmentContainer);
    }
  }
  else {
    let currentWaitingForPlayerText;
    if (parsedInstructions.reason == "COIN_FLIP") {
      currentWaitingForPlayerText = "Flipping coin...";
    }
    else if (parsedInstructions.reason == "DRINK_WHEEL") {
      currentWaitingForPlayerText = "Spinning drink wheel...";
    }
    else if (parsedInstructions.reason == "TAKE_A_SHOT") {
      currentWaitingForPlayerText = "Reading punishment...";
    }
    SetWaitingForPlayer({
      waitingForRoomTitle: "Waiting for " + currentPartyData.players[index].username,
      waitingForRoomText: currentWaitingForPlayerText,
      player: currentPlayer
    });
    setActiveContainers(waitingForPlayerContainer);
  }
}

async function UserSelectedForPunishment(instruction) {
  let parsedInstructions = parseInstructionDeviceId(instruction);
  const index = currentPartyData.players.findIndex(player => player.computerId === currentPartyData.players[currentPartyData.playerTurn].vote);
  if (currentPartyData.players[currentPartyData.playerTurn].vote == deviceId) {
    setActiveContainers(selectPunishmentContainer);
  }
  else {
    SetWaitingForPlayer({
      waitingForRoomTitle: "Waiting for " + currentPartyData.players[index].username,
      waitingForRoomText: "Choosing Punishment...",
      player: currentPlayer
    });
    setActiveContainers(waitingForPlayerContainer);
  }
}

async function DisplayDualStackCard() {
  await SendInstruction({
    instruction: "NEXT_QUESTION",
    partyData: currentPartyData,
    updateUsersReady: false,
    updateUsersConfirmation: false
  });
  ClearIcons();
}

async function ResetParanoiaQuestion({ nextPlayer = true }) {
  ClearIcons();
  if (deviceId == hostDeviceId) {
    currentPartyData.currentCardIndex++;
    if (nextPlayer == true) {
      currentPartyData.playerTurn = (currentPartyData.playerTurn + 1) % currentPartyData.players.length;
    }
    for (let i = 0; i < currentPartyData.players.length; i++) {
      currentPartyData.players[i].isReady = false;
      currentPartyData.players[i].hasConfirmed = false;
    }
    await SendInstruction({
      instruction: "NEXT_USER_TURN",
      partyData: currentPartyData
    });
  }
}

async function PartySkip() {
  await ResetParanoiaQuestion({nextPlayer: false});
}