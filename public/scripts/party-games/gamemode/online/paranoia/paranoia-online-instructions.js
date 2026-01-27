async function NextQuestion() {
  const players = currentPartyData.players || [];
  const state   = getPartyState(currentPartyData);
  const deck    = getPartyDeck(currentPartyData);

  const meIndex = players.findIndex(p => getPlayerId(p) === deviceId);
  const playerTurn = state.playerTurn ?? currentPartyData.playerTurn ?? 0;
  const currentPlayer = players[playerTurn];

  const votedId = getPlayerVote(currentPlayer);
  const votedIndex = votedId != null
    ? players.findIndex(p => getPlayerId(p) === votedId)
    : -1;

  const votedPlayer = votedIndex !== -1 ? players[votedIndex] : null;

  if (meIndex === -1) {
    console.warn("Device not found in players.");
    return;
  }

  const icons = waitingForPlayersIconContainer.querySelectorAll('.icon');
  const meState = getPlayerState(players[meIndex]);

  if (meState.hasConfirmed === true) {
    if (!waitingForPlayersContainer.classList.contains('active')) {
      ClearIcons();
    }
    setActiveContainers(waitingForPlayersContainer);

    // Update player's last ping
    const meConn = ensureConnection(players[meIndex]);
    meConn.lastPing = new Date();
    players[meIndex].lastPing = meConn.lastPing; // legacy mirror

    // Mark who has confirmed
    players.forEach((player, i) => {
      const pState = getPlayerState(player);
      if (pState.hasConfirmed && icons[i]) {
        icons[i].classList.add('yes');
      }
    });

    const allReady = players.every(p => getPlayerState(p).hasConfirmed === true);

    if (allReady) {
      icons.forEach(icon => icon.classList.add('yes'));
      await new Promise(resolve => setTimeout(resolve, 1500));

      ResetParanoiaQuestion({
        nextPlayer: true,
        incrementScore: 1
      });
    }
    else if (!waitingForPlayersContainer.classList.contains('active')) {
      await SendInstruction({ partyData: currentPartyData });
    }
  } else {
    // Show dual stack with current + voted player
    if (!currentPlayer || !votedPlayer) {
      console.warn('Missing current or voted player for dual stack view.');
      return;
    }

    EditUserIconPartyGames({
      container: gameContainerDualStack.querySelector('.dual-image-stack#dual-image-stack-1'),
      userId: getPlayerId(currentPlayer),
      userCustomisationString: getPlayerIcon(currentPlayer)
    });

    EditUserIconPartyGames({
      container: gameContainerDualStack.querySelector('.dual-image-stack#dual-image-stack-2'),
      userId: getPlayerId(votedPlayer),
      userCustomisationString: getPlayerIcon(votedPlayer)
    });

    const currentIndex = deck.currentCardIndex ?? currentPartyData.currentCardIndex ?? 0;
    selectedQuestionObj = getNextQuestion(currentIndex);
    DisplayCard(gameContainerDualStack, selectedQuestionObj);
    setActiveContainers(gameContainerDualStack);
  }
}

async function DisplayPrivateCard(instruction) {
  const state = getPartyState(currentPartyData);
  const players = currentPartyData.players || [];

  const timerValue = state.timer ?? currentPartyData.timer;
  const delay = new Date(timerValue) - Date.now();

  startTimer({
    timeLeft: delay / 1000,
    duration: gameRules["time-limit"],
    selectedTimer: gameContainerPrivate.querySelector('.timer-wrapper')
  });
  startTimer({
    timeLeft: delay / 1000,
    duration: gameRules["time-limit"],
    selectedTimer: selectUserContainer.querySelector('.timer-wrapper')
  });
  startTimer({
    timeLeft: delay / 1000,
    duration: gameRules["time-limit"],
    selectedTimer: waitingForPlayerContainer.querySelector('.timer-wrapper')
  });

  if (selectPunishmentButtonContainer.childElementCount == 0) {
    SetTimeOut({ delay: delay, instruction: "RESET_QUESTION:TIME_EXPIRED", nextDelay: null });
  } else {
    SetTimeOut({ delay: delay, instruction: "CHOOSING_PUNISHMENT:TIME_EXPIRED", nextDelay: null });
  }

  const parsedInstructions = parseInstruction(instruction);
  const playerTurn = state.playerTurn ?? currentPartyData.playerTurn ?? 0;
  const currentPlayer = players[playerTurn];

  if (!currentPlayer) {
    console.warn('Current player not found in DisplayPrivateCard');
    return;
  }

  const currentPlayerId = getPlayerId(currentPlayer);

  if (currentPlayerId === deviceId) {
    if (parsedInstructions.reason !== "READING_CARD") {
      setActiveContainers(selectUserContainer);
    } else {
      const deck = getPartyDeck(currentPartyData);
      const index = deck.currentCardIndex ?? currentPartyData.currentCardIndex ?? 0;
      selectedQuestionObj = getNextQuestion(index);
      DisplayCard(gameContainerPrivate, selectedQuestionObj);
      setActiveContainers(gameContainerPrivate);
    }
  } else {
    let currentWaitingForPlayerText;

    if (parsedInstructions.reason === "CHOOSE_PLAYER") {
      currentWaitingForPlayerText = "Choosing Player...";
    }
    else if (parsedInstructions.reason === "READING_CARD") {
      currentWaitingForPlayerText = "Reading Card...";
    }

    SetWaitingForPlayer({
      waitingForRoomTitle: "Waiting for " + getPlayerUsername(currentPlayer),
      waitingForRoomText: currentWaitingForPlayerText,
      player: currentPlayer
    });
    setActiveContainers(waitingForPlayerContainer);
  }
}

async function DisplayPunishmentToUser(instruction) {
  const players = currentPartyData.players || [];
  const state   = getPartyState(currentPartyData);

  const parsedInstructions = parseInstruction(instruction);
  const playerTurn = state.playerTurn ?? currentPartyData.playerTurn ?? 0;
  const turnPlayer = players[playerTurn];

  if (!turnPlayer) return;

  const votedId = getPlayerVote(turnPlayer);

  let index;
  if (votedId == null) {
    index = playerTurn;
  } else {
    index = players.findIndex(p => getPlayerId(p) === votedId);
  }

  if (index === -1) index = playerTurn;

  const target = players[index];

  console.log("parsedInstructions.reason:", parsedInstructions.reason);

  if (getPlayerId(target) === deviceId) {
    // This device is being punished
    if (parsedInstructions.reason.toUpperCase() === "DOWN_IT") {
      if (index === playerTurn) {
        completePunishmentText.textContent =
          "Down your drink. (if you refuse, the question will be passed to the next player and you will lose double points)";
      } else {
        completePunishmentText.textContent =
          "In order to find out the question you have to down your drink.";
      }
      completePunishmentContainer.setAttribute("punishment-type", "down-drink");
    } else {
      const readable = (parsedInstructions.reason).replace('_', ' ');
      if (index === playerTurn) {
        completePunishmentText.textContent =
          `take ${readable} (if you refuse, the question will be passed to the next player and you will lose double points)`;
      } else {
        completePunishmentText.textContent =
          `In order to find out the question you have to take ${readable}.`;
      }
      completePunishmentContainer.setAttribute("punishment-type", parsedInstructions.reason);
    }
    setActiveContainers(completePunishmentContainer);
  } else {
    SetWaitingForPlayer({
      waitingForRoomTitle: "Waiting for " + getPlayerUsername(target),
      waitingForRoomText: "Showing player punishment...",
      player: target
    });
    setActiveContainers(waitingForPlayerContainer);
  }
}

// Single unified PunishmentOffer using nested structure
async function PunishmentOffer(instruction) {
  const parsedInstructions = parseInstructionSecondReason(instruction);
  const latestPartyData = await GetCurrentPartyData();
  if (!latestPartyData) return;

  currentPartyData = latestPartyData;
  const players = currentPartyData.players || [];
  const state   = getPartyState(currentPartyData);

  const playerTurn = state.playerTurn ?? currentPartyData.playerTurn ?? 0;
  const turnPlayer = players[playerTurn];
  if (!turnPlayer) return;

  const votedId = getPlayerVote(turnPlayer);
  let index;
  if (votedId == null) {
    index = playerTurn;
  } else {
    index = players.findIndex(p => getPlayerId(p) === votedId);
  }
  if (index === -1) index = playerTurn;

  const target = players[index];

  if (parsedInstructions.reason === "PASS") {
    if (getPlayerId(target) === deviceId) {
      await SendInstruction({
        instruction: "USER_HAS_PASSED:USER_PASSED_PUNISHMENT",
        updateUsersReady: false,
        updateUsersConfirmation: false
      });
    }
  } else if (parsedInstructions.reason === "CONFIRM") {
    if (getPlayerId(target) === deviceId) {
      // Reset readiness
      players.forEach(p => {
        const s = getPlayerState(p);
        s.isReady = false;
        s.hasConfirmed = false;
        p.isReady = false;
        p.hasConfirmed = false;
      });

      const icons = waitingForPlayersIconContainer.querySelectorAll('.icon');
      if (icons[index]) icons[index].classList.add('yes');

      const tState = getPlayerState(target);
      tState.isReady = true;
      tState.hasConfirmed = true;
      target.isReady = true;
      target.hasConfirmed = true;

      await SendInstruction({
        instruction: "HAS_USER_DONE_PUNISHMENT:" + parsedInstructions.secondReason,
        updateUsersReady: false,
        updateUsersConfirmation: false
      });
    }
  }
}

async function UserHasPassed(instruction) {
  const players = currentPartyData.players || [];
  const state   = getPartyState(currentPartyData);

  const parsedInstructions = parseInstruction(instruction);
  const playerTurn = state.playerTurn ?? currentPartyData.playerTurn ?? 0;
  const turnPlayer = players[playerTurn];
  if (!turnPlayer) return;

  const votedId = getPlayerVote(turnPlayer);

  const index = votedId == null
    ? playerTurn
    : players.findIndex(p => getPlayerId(p) === votedId);

  const target = players[index];

  setActiveContainers(playerHasPassedContainer);
  playerHasPassedTitle.textContent = getPlayerUsername(target) + " has passed";

  if (parsedInstructions.reason === "USER_CALLED_WRONG_FACE") {
    playerHasPassedText.textContent = "unsuccessful coin flip";
  }
  else if (parsedInstructions.reason === "USER_PASSED_PUNISHMENT") {
    playerHasPassedText.textContent = "punishment has been forfeited";
  }
  else if (parsedInstructions.reason === "USER_DIDNT_DO_PUNISHMENT") {
    playerHasPassedText.textContent = "punishment not complete";
  }

  await new Promise(resolve => setTimeout(resolve, 2000));
  ResetParanoiaQuestion({ nextPlayer: true });
}

async function HasUserDonePunishment(instruction) {
  const players = currentPartyData.players || [];
  const state   = getPartyState(currentPartyData);

  const parsedInstructions = parseInstruction(instruction);
  const playerTurn = state.playerTurn ?? currentPartyData.playerTurn ?? 0;
  const turnPlayer = players[playerTurn];
  if (!turnPlayer) return;

  const votedId = getPlayerVote(turnPlayer);
  const punishedIndex = votedId == null
    ? playerTurn
    : players.findIndex(p => getPlayerId(p) === votedId);

  const punishedPlayer = players[punishedIndex];
  const meIndex = players.findIndex(p => getPlayerId(p) === deviceId);
  const meState = getPlayerState(players[meIndex]);

  const icons = waitingForPlayersIconContainer.querySelectorAll('.icon');
  
  if (!meState.isReady) {
    // Not ready yet
    if (getPlayerId(punishedPlayer) !== deviceId) {
      // I am voting on someone else
      if (!confirmPunishmentContainer.classList.contains('active')) {
        if (parsedInstructions.reason.toUpperCase().includes("TAKE_A_SHOT")) {
          confirmPunishmentText.textContent =
            "Has " + getPlayerUsername(punishedPlayer) + " taken their shot";
        }
        else if (parsedInstructions.reason.toUpperCase().includes("DOWN_IT")) {
          confirmPunishmentText.textContent =
            "Has " + getPlayerUsername(punishedPlayer) + " downed their drink";
        }
        else if (parsedInstructions.reason.toUpperCase().includes("SIP")) {
          confirmPunishmentText.textContent =
            "Has " + getPlayerUsername(punishedPlayer) + " taken " +
            parsedInstructions.reason.toUpperCase().replace("_", " ");
        }
        setActiveContainers(confirmPunishmentContainer);
      }
    } else if (!waitingForPlayersContainer.classList.contains('active')) {
      // I am the punished player
      setActiveContainers(waitingForPlayersContainer);

      const pState = getPlayerState(punishedPlayer);
      pState.isReady = true;
      pState.hasConfirmed = true;
      punishedPlayer.isReady = true;
      punishedPlayer.hasConfirmed = true;

      const conn = ensureConnection(punishedPlayer);
      conn.lastPing = new Date();
      punishedPlayer.lastPing = conn.lastPing;

      await SendInstruction({
        partyData: currentPartyData
      });
    }
  } else {
    // I have already voted; check if everyone finished
    const meConn = ensureConnection(players[meIndex]);
    meConn.lastPing = new Date();
    players[meIndex].lastPing = meConn.lastPing;

    const totalUsersReady = players.filter(p => getPlayerState(p).isReady === true).length;

    if (totalUsersReady === players.length) {
      const yesVoteCount = players.filter(p => getPlayerState(p).hasConfirmed === true).length;
      const noVoteCount = players.filter(p => getPlayerState(p).hasConfirmed === false).length;

      if (noVoteCount < yesVoteCount) {
        if (parsedInstructions.reason === "QUESTION") {
          ResetParanoiaQuestion({ nextPlayer: true, incrementScore: 1 });
        } else {
            await SendInstruction({
              instruction: "NEXT_QUESTION",
              partyData: currentPartyData,
              updateUsersReady: false,
              updateUsersConfirmation: false
            });
        }
      } else {
        await SendInstruction({
          instruction: `USER_HAS_PASSED:USER_DIDNT_DO_PUNISHMENT`,
          updateUsersReady: false,
          updateUsersConfirmation: false
        });
      }
    } else {
      players.forEach((player, i) => {
        const pState = getPlayerState(player);
        if (pState.hasConfirmed && icons[i]) {
          icons[i].classList.add('yes');
        }
      });
      setActiveContainers(waitingForPlayersContainer);
    }
  }
}

async function ChosePunishment(instruction) {
  const players = currentPartyData.players || [];
  const state   = getPartyState(currentPartyData);

  const parsedInstructions = parseInstruction(instruction);
  const playerTurn = state.playerTurn ?? currentPartyData.playerTurn ?? 0;
  const turnPlayer = players[playerTurn];
  if (!turnPlayer) return;

  const votedId = getPlayerVote(turnPlayer);

  let index;
  if (votedId == null) {
    index = playerTurn;
  } else {
    index = players.findIndex(p => getPlayerId(p) === votedId);
  }
  if (index === -1) index = playerTurn;

  const target = players[index];
  currentPlayer = target;

  if (getPlayerId(target) === deviceId) {
    if (parsedInstructions.reason === "COIN_FLIP") {
      setActiveContainers(pickHeadsOrTailsContainer);
    }
    else if (parsedInstructions.reason === "DRINK_WHEEL") {
      setActiveContainers(drinkWheelContainer);
    }
    else if (parsedInstructions.reason === "TAKE_A_SHOT") {
      if (index === playerTurn) {
        completePunishmentText.textContent =
          "take a shot. (if you refuse, the question will be passed to the next player and you will lose double points)";
      } else {
        completePunishmentText.textContent =
          "In order to find out the question you have to take a shot.";
      }
      setActiveContainers(completePunishmentContainer);
    }
  } else {
    let currentWaitingForPlayerText;
    if (parsedInstructions.reason === "COIN_FLIP") {
      currentWaitingForPlayerText = "Flipping coin...";
    }
    else if (parsedInstructions.reason === "DRINK_WHEEL") {
      currentWaitingForPlayerText = "Spinning drink wheel...";
    }
    else if (parsedInstructions.reason === "TAKE_A_SHOT") {
      currentWaitingForPlayerText = "Reading punishment...";
    }
    SetWaitingForPlayer({
      waitingForRoomTitle: "Waiting for " + getPlayerUsername(target),
      waitingForRoomText: currentWaitingForPlayerText,
      player: target
    });
    setActiveContainers(waitingForPlayerContainer);
  }
}

async function UserSelectedForPunishment(instruction) {
  const players = currentPartyData.players || [];
  const state   = getPartyState(currentPartyData);

  // still parse, in case you later use deviceId from instruction
  const parsedInstructions = parseInstructionDeviceId(instruction);

  const playerTurn = state.playerTurn ?? currentPartyData.playerTurn ?? 0;
  const turnPlayer = players[playerTurn];
  if (!turnPlayer) return;

  const votedId = getPlayerVote(turnPlayer);

  const index = votedId == null
    ? playerTurn
    : players.findIndex(p => getPlayerId(p) === votedId);

  const target = players[index];
  currentPlayer = target;

  if (getPlayerId(target) === deviceId) {
    setActiveContainers(selectPunishmentContainer);
  } else {
    SetWaitingForPlayer({
      waitingForRoomTitle: "Waiting for " + getPlayerUsername(target),
      waitingForRoomText: "Choosing Punishment...",
      player: target
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

async function ResetParanoiaQuestion({
  currentPlayerIndex = null,
  nextPlayer = true,
  incrementScore = 0
}) {
  ClearIcons();

  if (deviceId !== currentPartyData.state.hostComputerId) return;

  const players = currentPartyData.players || [];
  const state   = getPartyState(currentPartyData);
  const deck    = getPartyDeck(currentPartyData);

  if (players.length === 0) return;

  const playerTurn = state.playerTurn ?? currentPartyData.playerTurn ?? 0;

  if (currentPlayerIndex == null) {
    const turnPlayer = players[playerTurn];
    const votedId = getPlayerVote(turnPlayer);

    if (votedId == null) {
      currentPlayerIndex = playerTurn;
    } else {
      currentPlayerIndex = players.findIndex(p => getPlayerId(p) === votedId);
      if (currentPlayerIndex === -1) currentPlayerIndex = playerTurn;
    }
  }

  // Advance deck index
  const currentIndex = deck.currentCardIndex ?? currentPartyData.currentCardIndex ?? 0;
  deck.currentCardIndex = currentIndex + 1;
  currentPartyData.currentCardIndex = deck.currentCardIndex; // legacy mirror

  // Increment score for the relevant player
  const target = players[currentPlayerIndex];
  const tState = getPlayerState(target);
  tState.score = (tState.score ?? target.score ?? 0) + incrementScore;
  target.score = tState.score;

  // Rotate player turn
  if (nextPlayer === true) {
    const nextTurn = (playerTurn + 1) % players.length;
    state.playerTurn = nextTurn;
    currentPartyData.playerTurn = nextTurn;
  }

  // Reset ready/confirm/votes
  players.forEach(p => {
    const s = getPlayerState(p);
    s.isReady = false;
    s.hasConfirmed = false;
    s.vote = null;
    p.isReady = false;
    p.hasConfirmed = false;
    p.vote = null;
  });

  await SendInstruction({
    instruction: "DISPLAY_PRIVATE_CARD:READING_CARD",
    partyData: currentPartyData,
    timer: Date.now() + gameRules["time-limit"] * 1000,
  });
}

async function PartySkip() {
  await ResetParanoiaQuestion({ nextPlayer: false });
}
