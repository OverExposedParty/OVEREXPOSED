async function DisplayPrivateCard() {
  const state = getPartyState(currentPartyData);
  const deck = getPartyDeck(currentPartyData);
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
    selectedTimer: selectOptionContainer.querySelector('.timer-wrapper')
  });
  startTimer({
    timeLeft: delay / 1000,
    duration: durationSeconds,
    selectedTimer: waitingForPlayersContainer.querySelector('.timer-wrapper')
  });

  SetTimeOut({
    delay: delay,
    instruction: "DISPLAY_VOTE_RESULTS",
    nextDelay: resultTimerDuration,
    newUserConfirmed: false,
    newUserReady: false
  });

  const myIndex = players.findIndex(p => getPlayerId(p) === deviceId);
  if (myIndex === -1) {
    console.warn("Device not found in players.");
    return;
  }

  const me = players[myIndex];
  const myState = getPlayerState(me);
  const cardIdx = deck.currentCardIndex ?? 0;

  if (!myState.isReady && !myState.hasConfirmed) {
    selectedQuestionObj = getNextQuestion(cardIdx);
    DisplayCard(gameContainerPrivate, selectedQuestionObj);
    setActiveContainers(gameContainerPrivate);
  }
  else if (myState.isReady && !myState.hasConfirmed) {
    selectedQuestionObj = getNextQuestion(cardIdx);
    const splitQuestion = SplitQuestion(
      selectedQuestionObj.question.replace("Would you rather ", "")
    );
    selectOptionQuestionTextA.textContent = "A: " + splitQuestion.a;
    selectOptionQuestionTextB.textContent = "B: " + splitQuestion.b;
    setActiveContainers(selectOptionContainer);
  }
  else {
    const allConfirmed = players.every(p => getPlayerState(p).hasConfirmed === true);

    if (allConfirmed) {
      await SendInstruction({
        instruction: "DISPLAY_VOTE_RESULTS",
        timer: Date.now() + resultTimerDuration,
        updateUsersConfirmation: false,
        updateUsersReady: false
      });
    } else {
      if (myState.hasConfirmed) {
        DisplayWaitingForPlayers();
      }
    }
  }
}

async function DisplayVoteResults() {
  const state = getPartyState(currentPartyData);
  const players = currentPartyData.players || [];

  const delay = new Date(state.timer) - Date.now();

  stopTimer(waitingForPlayersContainer.querySelector('.timer-wrapper'));
  startTimer({
    timeLeft: delay / 1000,
    duration: resultTimerDuration / 1000,
    selectedTimer: resultsChartContainer.querySelector('.timer-wrapper')
  });

  if (!isContainerVisible(resultsChartContainer)) {
    GetVoteResults(currentPartyData);
    setActiveContainers(resultsChartContainer);
  }

  const aVoteCount = players.filter(
    p => getPlayerState(p).vote === "A"
  ).length;

  const bVoteCount = players.filter(
    p => getPlayerState(p).vote === "B"
  ).length;

  let punishmentInstruction;

  const config = getPartyConfig(currentPartyData);
  const rawGameRules = config.gameRules || {};
  const gameRules =
    rawGameRules instanceof Map ? Object.fromEntries(rawGameRules) : rawGameRules;

  const oddManOutEnabled =
    gameRules["odd-man-out"] === true || gameRules["odd-man-out"] === "true";

  if (
    (
      aVoteCount === 1 &&
      !(bVoteCount <= 1)
    ) ||
    (
      bVoteCount === 1 &&
      !(aVoteCount <= 1)
    ) &&
    oddManOutEnabled
  ) {
    punishmentInstruction = "CHOSE_PUNISHMENT:ODD_MAN_OUT";
  }
  else {
    punishmentInstruction = "CHOSE_PUNISHMENT:TAKE_A_SIP";
  }

  if (gameRules["drink-punishment"]) {
    SetTimeOut({
      delay: delay,
      instruction: punishmentInstruction,
      nextDelay: null,
      newUserConfirmed: false,
      newUserReady: false
    });
  }
  else {
    const winningVote =
      aVoteCount === bVoteCount
        ? null
        : aVoteCount > bVoteCount
          ? "A"
          : "B";

    SetTimeOut({
      delay: delay,
      instruction: "RESET_QUESTION:" + winningVote,
      nextDelay: null,
      newUserConfirmed: false,
      newUserReady: false
    });
  }
}

async function WaitingForPlayer(instruction) {
  const parsedInstructions = parseInstruction(instruction);

  if (await GetSelectedPlayerTurnID() === deviceId) {
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

  waitingForPlayerTitle.textContent = "Waiting for " + parsedInstructions.username;

  if (parsedInstructions.reason === "CHOOSE_PLAYER") {
    waitingForPlayerText.textContent = "Choosing Player...";
  }
  else if (parsedInstructions.reason === "READING_CARD") {
    waitingForPlayerText.textContent = "Reading Card...";
  }
}

async function DisplayPunishmentToUser(instruction) {
  const parsedInstructions = parseInstruction(instruction);
  const players = currentPartyData.players || [];

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
  const parsedInstructions = parseInstructionSecondReason(instruction);

  if (parsedInstructions.reason === "PASS") {
    if (parsedInstructions.deviceId === deviceId) {
      await SendInstruction({
        instruction: "USER_HAS_PASSED:USER_PASSED_PUNISHMENT:" + deviceId,
        partyData: currentPartyData
      });
    }
  } else if (parsedInstructions.reason === "CONFIRM") {
    if (deviceId === parsedInstructions.deviceId) {
      const players = currentPartyData.players || [];

      players.forEach(p => {
        const ps = getPlayerState(p);
        ps.isReady = false;
        ps.hasConfirmed = false;
      });

      const myIndex = players.findIndex(
        p => getPlayerId(p) === deviceId
      );
      const icons = waitingForPlayersIconContainer.querySelectorAll('.icon');

      if (myIndex !== -1) {
        if (icons[myIndex]) {
          icons[myIndex].classList.add('yes');
        }
        const myState = getPlayerState(players[myIndex]);
        myState.isReady = true;
        myState.hasConfirmed = true;
      }

      await SendInstruction({
        instruction: "HAS_USER_DONE_PUNISHMENT:" + parsedInstructions.secondReason + ":" + deviceId,
        partyData: currentPartyData
      });
    }
  }
}

async function ChosePunishment(instruction) {
  const parsedInstructions = parseInstruction(instruction);
  const players = currentPartyData.players || [];

  const myIndex = players.findIndex(
    p => getPlayerId(p) === deviceId
  );
  if (myIndex === -1) return;

  const icons = waitingForPlayersIconContainer.querySelectorAll('.icon');

  const aVoteCount = players.filter(
    p => getPlayerState(p).vote === "A"
  ).length;

  const bVoteCount = players.filter(
    p => getPlayerState(p).vote === "B"
  ).length;

  const nullVoteCount = players.filter(
    p => getPlayerState(p).vote === null
  ).length;

  const myState = getPlayerState(players[myIndex]);
  const currentVote = myState.vote;

  const allConfirmed = players.every(
    p => getPlayerState(p).hasConfirmed === true
  );

  if (allConfirmed) {
    const winningVote =
      aVoteCount === bVoteCount
        ? null
        : aVoteCount > bVoteCount
          ? "A"
          : "B";

    await SendInstruction({
      instruction: "RESET_QUESTION:" + winningVote
    });
  }
  else if (parsedInstructions.reason === "TAKE_A_SIP") {
    if ((aVoteCount === bVoteCount && nullVoteCount === 0)) {
      await SendInstruction({
        instruction: "RESET_QUESTION"
      });
    }
    else if (
      (currentVote === "A" && bVoteCount > aVoteCount) ||
      (currentVote === "B" && aVoteCount > bVoteCount) ||
      (currentVote == null)
    ) {
      completePunishmentText.textContent = "Take a sip.";
      completePunishmentContainer.setAttribute("punishment-type", parsedInstructions.reason);

      if (!myState.hasConfirmed) {
        setActiveContainers(completePunishmentContainer);
      } else {
        DisplayWaitingForPlayers();
      }
    }
    else {
      if (myState.hasConfirmed === false) {
        SetUserConfirmation({
          selectedDeviceId: deviceId,
          option: true
        });
      }
      else {
        DisplayWaitingForPlayers();
      }
    }
  }
  else if (parsedInstructions.reason === "ODD_MAN_OUT") {
    let oddManOutIndex;

    if (aVoteCount === 1) {
      oddManOutIndex = players.findIndex(
        p => getPlayerState(p).vote === "A"
      );
    }
    else {
      oddManOutIndex = players.findIndex(
        p => getPlayerState(p).vote === "B"
      );
    }

    if (oddManOutIndex === -1) return;

    if (myIndex === oddManOutIndex) {
      console.log("You are the odd man out, spinning the wheel.");
      setActiveContainers(drinkWheelContainer);
    }
    else {
      SetWaitingForPlayer({
        waitingForRoomTitle: "Waiting for " + getPlayerUsername(players[oddManOutIndex]),
        waitingForRoomText: "Spinning drink wheel...",
        player: players[oddManOutIndex]
      });
      setActiveContainers(waitingForPlayerContainer);
    }
  }
}

async function UserSelectedForPunishment(instruction) {
  const parsedInstructions = parseInstructionDeviceId(instruction);
  const players = currentPartyData.players || [];

  const index = players.findIndex(
    p => getPlayerId(p) === parsedInstructions.deviceId
  );

  if (parsedInstructions.deviceId === deviceId) {
    setActiveContainers(selectPunishmentContainer);
  }
  else if (index !== -1) {
    waitingForPlayerTitle.textContent = "Waiting for " + getPlayerUsername(players[index]);
    waitingForPlayerText.textContent = "Choosing Punishment...";
    setActiveContainers(waitingForPlayerContainer);
  }
}

async function AnswerToUserDonePunishment() {
  const players = currentPartyData.players || [];
  const icons = waitingForPlayersIconContainer.querySelectorAll('.icon');

  const myIndex = players.findIndex(
    p => getPlayerId(p) === deviceId
  );
  if (myIndex === -1) return;

  const myState = getPlayerState(players[myIndex]);

  if (myState.isReady === true) {
    DisplayWaitingForPlayers();

    const allReady = players.every(
      p => getPlayerState(p).isReady === true
    );

    if (allReady) {
      const aVoteCount = players.filter(
        p => getPlayerState(p).vote === "A"
      ).length;
      const bVoteCount = players.filter(
        p => getPlayerState(p).vote === "B"
      ).length;

      const winningVote =
        aVoteCount === bVoteCount
          ? null
          : aVoteCount > bVoteCount
            ? "A"
            : "B";

      await SendInstruction({
        instruction: "RESET_QUESTION:" + winningVote
      });
    }
  }
}

function GetVoteResults(currentPartyData) {
  const players = currentPartyData.players || [];
  const deck = getPartyDeck(currentPartyData);

  const aVotes = [];
  const bVotes = [];

  players.forEach(player => {
    const ps = getPlayerState(player);
    if (ps.vote === "A") {
      aVotes.push(player);
    } else if (ps.vote === "B") {
      bVotes.push(player);
    }
  });

  const wrapper = document.getElementById("tableWrapper");
  wrapper.innerHTML = "";
  wrapper.className = "vote-results-wrapper";

  function createSection(hasDivider) {
    const section = document.createElement("div");
    section.className = "vote-results-section";
    if (hasDivider) section.classList.add("has-divider");
    return section;
  }

  const aSection = createSection(true);
  const bSection = createSection(false);

  function createHeader(text) {
    const header = document.createElement("div");
    header.className = "vote-results-header";
    header.textContent = text;
    return header;
  }

  const cardIdx = deck.currentCardIndex ?? 0;
  selectedQuestionObj = getNextQuestion(cardIdx);
  const splitQuestion = SplitQuestion(
    selectedQuestionObj.question.replace("Would you rather ", "")
  );

  aSection.appendChild(createHeader(splitQuestion.a));
  bSection.appendChild(createHeader(splitQuestion.b));

  function addIcons(section, playersList) {
    const iconsWrapper = document.createElement("div");
    iconsWrapper.className = "vote-results-icons";

    playersList.forEach(player => {
      const iconContainer = document.createElement("div");
      iconContainer.className = "vote-results-icon";

      createUserIconPartyGames({
        container: iconContainer,
        userId: getPlayerId(player),
        userCustomisationString: player.identity?.userIcon ?? player.userIcon
      });

      iconsWrapper.appendChild(iconContainer);
    });

    section.appendChild(iconsWrapper);
  }

  addIcons(aSection, aVotes);
  addIcons(bSection, bVotes);

  wrapper.appendChild(aSection);
  wrapper.appendChild(bSection);
}

async function PartySkip() {
  await SendInstruction({
    instruction: "RESET_QUESTION:"
  });
}

function SplitQuestion(question) {
  const parts = question.split(" OR ");

  if (parts.length === 2) {
    const a = parts[0].trim().replace(/\.*$/, '').replace(/\?/g, '');
    const b = parts[1].trim().replace(/\.*$/, '').replace(/\?/g, '');
    return { a, b };
  } else {
    return {
      a: question.trim().replace(/\.*$/, '').replace(/\?/g, ''),
      b: ""
    };
  }
}
