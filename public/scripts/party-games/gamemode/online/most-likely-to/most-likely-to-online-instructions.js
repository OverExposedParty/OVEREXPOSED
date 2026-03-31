function formatMostLikelyToQuestionForSelection(question = "") {
  return String(question)
    .replace(/^\s*who(?:['’]s|\s+is)?\s+most\s+likely\s+to\s+/i, "")
    .trim();
}

async function DisplayPrivateCard() {
  const state   = getPartyState(currentPartyData);
  const deck    = getPartyDeck(currentPartyData);
  const players = currentPartyData.players || [];

  const delay = new Date(state.timer) - Date.now();

  const durationSeconds = getTimeLimit();

  startTimer({
    timeLeft: delay / 1000,
    duration: durationSeconds,
    selectedTimer: gameContainerPrivate.querySelector('.timer-wrapper')
  });
  startTimer({
    timeLeft: delay / 1000,
    duration: durationSeconds,
    selectedTimer: selectUserContainer.querySelector('.timer-wrapper')
  });
  startTimer({
    timeLeft: delay / 1000,
    duration: durationSeconds,
    selectedTimer: waitingForPlayersContainer.querySelector('.timer-wrapper')
  });

  SetTimeOut({
    delay,
    instruction: "DISPLAY_VOTE_RESULTS",
    nextDelay: resultTimerDuration
  });

  const myIndex = players.findIndex(p => getPlayerId(p) === deviceId);
  if (myIndex === -1) {
    console.warn("Device not found in players.");
    return;
  }

  const myState   = getPlayerState(players[myIndex]);
  const cardIndex = deck.currentCardIndex ?? 0;

  selectedQuestionObj = getNextQuestion(cardIndex);
  selectNumberButtonContainer.innerHTML = "";

  selectUserQuestionText.textContent =
    formatMostLikelyToQuestionForSelection(selectedQuestionObj.question);

  DisplayCard(gameContainerPrivate, selectedQuestionObj);

  if (!myState.isReady && !myState.hasConfirmed) {
    setActiveContainers(gameContainerPrivate);
  }
  else if (myState.isReady && !myState.hasConfirmed) {
    setActiveContainers(selectUserContainer);
  }
  else {
    const allConfirmed = players.every(p => getPlayerState(p).hasConfirmed);

    if (allConfirmed) {
        await SendInstruction({
          instruction: "DISPLAY_VOTE_RESULTS",
          timer: Date.now() + resultTimerDuration
        });
    } else if (myState.hasConfirmed) {
      DisplayWaitingForPlayers();
    }
  }
}

async function DisplayVoteResults() {
  const state   = getPartyState(currentPartyData);
  const players = currentPartyData.players || [];

  const delay = new Date(state.timer) - Date.now();

  stopTimer(waitingForPlayersContainer.querySelector('.timer-wrapper'));
  startTimer({
    timeLeft: delay / 1000,
    duration: resultTimerDuration / 1000,
    selectedTimer: resultsChartContainer.querySelector('.timer-wrapper')
  });

  const icons = waitingForPlayersIconContainer.querySelectorAll('.icon');

  const myIndex = players.findIndex(p => getPlayerId(p) === deviceId);
  if (myIndex === -1) {
    console.warn("Device not found in players.");
    return;
  }

  if (!isContainerVisible(resultsChartContainer)) {
    GetVoteResults(currentPartyData);
    setActiveContainers(resultsChartContainer);
  }

  const highestValue = getHighestVoteValue(currentPartyData);
  console.log("highestValue:", highestValue);

    const highestVotedIds = GetHighestVoted(currentPartyData); // comma string

    for (let i = 0; i < players.length; i++) {
      const player = players[i];
      const pState = getPlayerState(player);
      const pid    = getPlayerId(player);

      if (highestVotedIds.includes(pid)) {
        pState.isReady = false;
        pState.hasConfirmed = false;
        if (highestValue > 0) {
          pState.score = (pState.score ?? 0) + 1;
        }
      } else {
        pState.isReady = true;
        pState.hasConfirmed = true;
      }
    }

    ClearIcons();

    if (selectPunishmentButtonContainer.childElementCount === 0) {
      SetTimeOut({
        delay,
        instruction: "RESET_QUESTION",
        nextDelay: null
      });
    } else {
      if (highestValue < 0) {
        const updateInstruction =
          "TIE_BREAKER_PUNISHMENT_OFFER:" + highestVotedIds;
        SetTimeOut({
          delay,
          instruction: updateInstruction,
          nextDelay: getTimeLimit() * 1000
        });
      }
      else if (highestValue === 0) {
        SetTimeOut({
          delay,
          instruction: "RESET_QUESTION",
          nextDelay: null
        });
      }
      else {
        SetTimeOut({
          delay,
          instruction: "CHOOSING_PUNISHMENT:" + highestVotedIds,
          nextDelay: getTimeLimit() * 1000
        });
      }
    }
}

async function TieBreakerPunishmentOffer(instruction) {
  const state   = getPartyState(currentPartyData);
  const players = currentPartyData.players || [];

  const parsedInstructions = parseInstruction(instruction);
  const delay = new Date(state.timer) - Date.now();

  const durationSeconds = getTimeLimit();

  startTimer({
    timeLeft: delay / 1000,
    duration: durationSeconds,
    selectedTimer: selectNumberContainer.querySelector('.timer-wrapper')
  });
  startTimer({
    timeLeft: delay / 1000,
    duration: durationSeconds,
    selectedTimer: waitingForPlayersContainer.querySelector('.timer-wrapper')
  });

  SetTimeOut({
    delay,
    instruction: "CHOOSING_PUNISHMENT:" + GetStringAtIndex(parsedInstructions.reason, 0),
    nextDelay: null
  });

  const myIndex = players.findIndex(p => getPlayerId(p) === deviceId);
  if (myIndex === -1) {
    console.warn("Device not found in players.");
    return;
  }
  const myState = getPlayerState(players[myIndex]);

  if (parsedInstructions.reason.includes(deviceId)) {
    const count = CountParsedString(parsedInstructions.reason);

    for (let i = 0; i < count; i++) {
      if (selectNumberButtonContainer.querySelectorAll('button').length < count) {
        const selectedNumberButton = createUserButton(String(i), i + 1);

        selectedNumberButton.addEventListener('click', () => {
          selectNumberContainer.querySelectorAll('button')
            .forEach(btn => btn.classList.remove('active'));
          selectedNumberButton.classList.add('active');
          selectNumberContainer.setAttribute(
            'selected-id',
            selectedNumberButton.getAttribute('id')
          );
        });

        selectNumberButtonContainer.appendChild(selectedNumberButton);
      }
    }

    if (!myState.hasConfirmed) {
      setActiveContainers(selectNumberContainer);

      for (let i = 0; i < count; i++) {
        const button = document.getElementById(String(i));
        const someoneChoseThis =
          players.some(player => getPlayerState(player).vote === String(i));

        if (someoneChoseThis) {
          button.classList.add("disabled");
        } else {
          button.classList.remove("disabled");
        }
      }
    } else {
      const allConfirmed = players.every(p => getPlayerState(p).hasConfirmed);
      if (allConfirmed) {
        const randomInt = Math.floor(
          Math.random() * -getHighestVoteValue(currentPartyData)
        );
        await SendInstruction({
          instruction:
            "CHOOSING_PUNISHMENT:" +
            GetStringAtIndex(parsedInstructions.reason, randomInt),
          updateUsersReady: false,
          updateUsersConfirmation: false
        });
      } else {
        DisplayWaitingForPlayers();
      }
    }
  } else {
    DisplayWaitingForPlayers();
  }
}

async function WaitingForPlayer(instruction) {
  const parsedInstructions = parseInstruction(instruction);

  const selectedTurnId = await GetSelectedPlayerTurnID();

  if (selectedTurnId === deviceId) {
    if (parsedInstructions.reason !== "READING_CARD") {
      setActiveContainers(selectUserContainer);
    }
    else {
      setActiveContainers(gameContainerPrivate);
    }
  }
  else {
    setActiveContainers(waitingForPlayerContainer);
  }

  waitingForPlayerTitle.textContent =
    "Waiting for " + parsedInstructions.username;

  if (parsedInstructions.reason === "CHOOSE_PLAYER") {
    waitingForPlayerText.textContent = "Choosing Player...";
  }
  else if (parsedInstructions.reason === "READING_CARD") {
    waitingForPlayerText.textContent = "Reading Card...";
  }
}

async function DisplayPunishmentToUser(instruction) {
  const players = currentPartyData.players || [];
  const parsedInstructions = parseInstruction(instruction);

  const index = players.findIndex(
    p => getPlayerId(p) === parsedInstructions.deviceId
  );

  if (parsedInstructions.deviceId === deviceId) {
    completePunishmentText.textContent =
      "take " + parsedInstructions.reason.replace("_", " ");
    setActiveContainers(completePunishmentContainer);
  }
  else if (index !== -1) {
    SetWaitingForPlayer({
      waitingForRoomTitle: "Waiting for " + getPlayerUsername(players[index]),
      waitingForRoomText: "Showing player punishment...",
      player: players[index]
    });
    setActiveContainers(waitingForPlayerContainer);
  }
}

async function PunishmentOffer(instruction) {
  const parsedInstructions = parseInstruction(instruction);

  if (parsedInstructions.reason === "CONFIRM") {
    const icons = waitingForPlayersIconContainer.querySelectorAll('.icon');
    await ResetQuestion({
      icons,
      timer: Date.now() + getTimeLimit() * 1000
    });
  }
}

async function ChoosingPunishment(instruction) {
  const state   = getPartyState(currentPartyData);
  const players = currentPartyData.players || [];

  const parsedInstructions = parseInstructionDeviceId(instruction);
  const delay = new Date(state.timer) - Date.now();

  const durationSeconds = getTimeLimit();

  startTimer({
    timeLeft: delay / 1000,
    duration: durationSeconds,
    selectedTimer: selectPunishmentContainer.querySelector('.timer-wrapper')
  });
  startTimer({
    timeLeft: delay / 1000,
    duration: durationSeconds,
    selectedTimer: waitingForPlayerContainer.querySelector('.timer-wrapper')
  });

  SetTimeOut({
    delay,
    instruction: `RESET_QUESTION:PLAYER_TURN_PASSED:${parsedInstructions.reason}`,
    nextDelay: resultTimerDuration
  });

  const index = players.findIndex(
    p => getPlayerId(p) === parsedInstructions.deviceId
  );

  if (parsedInstructions.deviceId === deviceId) {
    setActiveContainers(selectPunishmentContainer);
  }
  else if (index !== -1) {
    SetWaitingForPlayer({
      waitingForRoomTitle: "Waiting for " + getPlayerUsername(players[index]),
      waitingForRoomText: "Choosing Punishment...",
      player: players[index]
    });
    setActiveContainers(waitingForPlayerContainer);
  }
}

async function ChosePunishment(instruction) {
  const players = currentPartyData.players || [];
  const parsedInstructions = parseInstruction(instruction);

  const index = players.findIndex(
    p => getPlayerId(p) === parsedInstructions.deviceId
  );

  if (parsedInstructions.deviceId === deviceId) {
    if (parsedInstructions.reason === "MOST_LIKELY_TO_DRINK_WHEEL") {
      setActiveContainers(drinkWheelContainer);
    } else if (parsedInstructions.reason === "TAKE_A_SHOT") {
      punishmentText.textContent = "Take a shot.";
      setActiveContainers(completePunishmentContainer);
    }
  } else if (index !== -1) {
    let currentWaitingForPlayerText = "";
    if (parsedInstructions.reason === "MOST_LIKELY_TO_DRINK_WHEEL") {
      currentWaitingForPlayerText = "Spinning drink wheel...";
    } else if (parsedInstructions.reason === "TAKE_A_SHOT") {
      currentWaitingForPlayerText = "Reading punishment...";
    }

    SetWaitingForPlayer({
      waitingForRoomTitle: "Waiting for " + getPlayerUsername(players[index]),
      waitingForRoomText: currentWaitingForPlayerText,
      player: players[index]
    });
    setActiveContainers(waitingForPlayerContainer);
  }
}

async function UserSelectedForPunishment(instruction) {
  const players = currentPartyData.players || [];
  const parsedInstructions = parseInstructionDeviceId(instruction);

  const index = players.findIndex(
    p => getPlayerId(p) === parsedInstructions.deviceId
  );

  if (parsedInstructions.deviceId === deviceId) {
    setActiveContainers(selectPunishmentContainer);
  }
  else if (index !== -1) {
    SetWaitingForPlayer({
      waitingForRoomTitle: "Waiting for " + getPlayerUsername(players[index]),
      waitingForRoomText: "Choosing Punishment...",
      player: players[index]
    });
    setActiveContainers(waitingForPlayerContainer);
  }
}

async function AnswerToUserDonePunishment() {
  const players = currentPartyData.players || [];
  const icons   = waitingForPlayersIconContainer.querySelectorAll('.icon');

  const myIndex = players.findIndex(p => getPlayerId(p) === deviceId);
  if (myIndex === -1) {
    console.warn("Device not found in players.");
    return;
  }

  const myState = getPlayerState(players[myIndex]);

  if (myState.isReady === true) {
    DisplayWaitingForPlayers();

    const totalReady = players.filter(p => getPlayerState(p).isReady).length;
    if (totalReady === players.length) {
      await ResetQuestion({
        icons,
        timer: Date.now() + getTimeLimit() * 1000
      });
    }
  }
}

async function PartySkip() {
  const icons = waitingForPlayersIconContainer.querySelectorAll('.icon');
  await ResetQuestion({
    icons,
    timer: Date.now() + getTimeLimit() * 1000
  });
}
