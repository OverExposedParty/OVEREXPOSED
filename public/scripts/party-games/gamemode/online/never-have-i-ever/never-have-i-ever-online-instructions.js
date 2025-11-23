async function DisplayPrivateCard(instruction) {
  const delay = new Date(currentPartyData.timer) - Date.now();
  startTimer({ timeLeft: delay / 1000, duration: getIncrementContainerValue("time-limit") * 1000 / 1000, selectedTimer: gameContainerPrivate.querySelector('.timer-wrapper') });
  startTimer({ timeLeft: delay / 1000, duration: getIncrementContainerValue("time-limit") * 1000 / 1000, selectedTimer: selectOptionContainer.querySelector('.timer-wrapper') });
  startTimer({ timeLeft: delay / 1000, duration: getIncrementContainerValue("time-limit") * 1000 / 1000, selectedTimer: waitingForPlayersContainer.querySelector('.timer-wrapper') });
  SetTimeOut({ delay: delay, instruction: "DISPLAY_VOTE_RESULTS", nextDelay: resultTimerDuration, newUserConfirmed: false, newUserReady: false });

  const index = currentPartyData.players.findIndex(player => player.computerId === deviceId);
  const parsedInstructions = parseInstructionSecondReason(instruction);
  const player = currentPartyData.players[index];
  selectedQuestionObj = getNextQuestion(currentPartyData.currentCardIndex);
  selectOptionQuestionText.textContent = selectedQuestionObj.question.replace("Never have I ever ", "");
  console.log(selectOptionQuestionText.textContent);
  DisplayCard(gameContainerPrivate, selectedQuestionObj);
  if (!player.isReady && !player.hasConfirmed) {
    setActiveContainers(gameContainerPrivate);
  }
  else if (player.isReady && !player.hasConfirmed) {
    setActiveContainers(selectOptionContainer);
  }
  else {
    const allConfirmed = currentPartyData.players.every(player => player.hasConfirmed === true);

    if (allConfirmed) {
      if (deviceId === currentPartyData.players[0].computerId) {
        await SendInstruction({
          instruction: "DISPLAY_VOTE_RESULTS",
          timer: Date.now() + resultTimerDuration,
          updateUsersConfirmation: false,
          updateUsersReady: false
        });
      }
    }
    else {
      if (player.hasConfirmed) {
        DisplayWaitingForPlayers();
      }
    }
  }
}

async function DisplayVoteResults() {
  const delay = new Date(currentPartyData.timer) - Date.now();
  stopTimer(waitingForPlayersContainer.querySelector('.timer-wrapper'));
  startTimer({ timeLeft: delay / 1000, duration: resultTimerDuration / 1000, selectedTimer: resultsChartContainer.querySelector('.timer-wrapper') });

  if (!resultsChartContainer.classList.contains('active')) {
    GetVoteResults(currentPartyData);
    setActiveContainers(resultsChartContainer);
  }

  const haveVoteCount = currentPartyData.players.filter(player => player.vote === true).length;
  const haveNotVoteCount = currentPartyData.players.filter(player => player.vote === false).length;

  let punishmentInstruction;
  if (hostDeviceId === deviceId) {
    if ((haveVoteCount === 1 && (!(haveNotVoteCount <= 1))) || (haveNotVoteCount === 1 && (!(haveVoteCount <= 1))) && currentPartyData.gameRules.includes('odd-man-out')) {
      punishmentInstruction = "CHOSE_PUNISHMENT:ODD_MAN_OUT";
    }
    else {
      punishmentInstruction = "CHOSE_PUNISHMENT:TAKE_A_SIP";
    }
    for (let i = 0; i < currentPartyData.players.length; i++) {
      if (currentPartyData.players[i].vote === true && !currentPartyData.players[i].sockedtId !== "DISCONNECTED") {
        currentPartyData.players[i].score++;
      }
    }
    if (CheckSettingsExists("drink-punishment")) {
      SetTimeOut({ delay: delay, instruction: punishmentInstruction, nextDelay: null, newUserConfirmed: false, newUserReady: false });
    }
    else {
      SetTimeOut({ delay: delay, instruction: "RESET_QUESTION", nextDelay: null, newUserConfirmed: false, newUserReady: false });
    }
  }
}

async function ChosePunishment(instruction) {
  let parsedInstructions = parseInstruction(instruction);
  const index = currentPartyData.players.findIndex(player => player.computerId === deviceId);
  const icons = waitingForPlayersIconContainer.querySelectorAll('.icon');

  const allConfirmed = currentPartyData.players.every(player => player.hasConfirmed === true);

  const haveVoteCount = currentPartyData.players.filter(player => player.vote === true).length;
  const haveNotVoteCount = currentPartyData.players.filter(player => player.vote === false).length;

  if (allConfirmed) {
    if (hostDeviceId === deviceId) {
      await ResetQuestion({
        icons: icons,
        timer: Date.now() + getIncrementContainerValue("time-limit") * 1000
      });
    }
  }
  else if (parsedInstructions.reason === "TAKE_A_SIP") {
    if (currentPartyData.players.filter(player => player.vote === true).length === 0) {
      if (deviceId == hostDeviceId) {
        await ResetQuestion({
          icons: icons,
          timer: Date.now() + getIncrementContainerValue("time-limit") * 1000
        });
      }
    }
    else {
      if (currentPartyData.players[index].vote == true) {

        completePunishmentText.textContent = "Take a sip.";
        completePunishmentContainer.setAttribute("punishment-type", parsedInstructions.reason);

        if (currentPartyData.players[index].hasConfirmed == false) {
          setActiveContainers(completePunishmentContainer);
        } 
        else {
          DisplayWaitingForPlayers();
        }
      }
      else if (currentPartyData.players[index].vote != true && currentPartyData.players[index].hasConfirmed == false) {
        console.log("vote: " + currentPartyData.players[index].hasConfirmed);
        console.log("hasConfirmed: " + currentPartyData.players[index].hasConfirmed);
        SetUserConfirmation({ selectedDeviceId: deviceId, option: true, });
      }
      else {
        DisplayWaitingForPlayers();
      }
    }
  }
  else if (parsedInstructions.reason === "ODD_MAN_OUT") {
    let oddManOutIndex;
    if (haveVoteCount === 1) {
      oddManOutIndex = currentPartyData.players.findIndex(player => player.vote === true);
    }
    else {
      oddManOutIndex = currentPartyData.players.findIndex(player => player.vote === false);
    }

    if (index === oddManOutIndex) {
      console.log("You are the odd man out, spinning the wheel.");
      setActiveContainers(drinkWheelContainer);
    }
    else {
      SetWaitingForPlayer({
        waitingForRoomTitle: "Waiting for " + currentPartyData.players[oddManOutIndex].username,
        waitingForRoomText: "Spinning drink wheel...",
        player: currentPartyData.players[index]
      });
      setActiveContainers(waitingForPlayerContainer);
    }
  }
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

async function DisplayPunishmentToUser(instruction) {
  let parsedInstructions = parseInstruction(instruction)
  const index = currentPartyData.players.findIndex(player => player.computerId === parsedInstructions.deviceId);
  if (parsedInstructions.deviceId == deviceId) {
    completePunishmentText.textContent = "take " + parsedInstructions.reason.replace("_", " ");
    setActiveContainers(completePunishmentContainer);
  }
  else {
    SetWaitingForPlayer({
      waitingForRoomTitle: "Waiting for " + currentPartyData.players[index].username,
      waitingForRoomText: "Showing player punishment...",
      player: currentPartyData.players[index]
    });
    setActiveContainers(waitingForPlayerContainer);
  }
}

async function PunishmentOffer(instruction) {
  let parsedInstructions = parseInstructionSecondReason(instruction);

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

async function UserSelectedForPunishment(instruction) {
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
  const icons = waitingForPlayersIconContainer.querySelectorAll('.icon');

  const index = currentPartyData.players.findIndex(player => player.computerId === deviceId);

  if (currentPartyData.players[index].isReady === true) {
    DisplayWaitingForPlayers();

    const allReady = currentPartyData.players.every(player => player.isReady === true);

    if (allReady) {
      if (deviceId === hostDeviceId) {
        await ResetQuestion({
          icons: icons,
          timer: Date.now() + getIncrementContainerValue("time-limit") * 1000
        });
      }
    }
  }
}

function GetVoteResults(currentPartyData) {
  const haveVotes = [];
  const haveNeverVotes = [];

  currentPartyData.players.forEach((player) => {
    if (player.vote === true) {
      haveVotes.push(player);
    } else if (player.vote === false) {
      haveNeverVotes.push(player);
    }
  });

  const wrapper = document.getElementById("tableWrapper");
  wrapper.innerHTML = "";
  wrapper.className = "vote-results-wrapper"; // apply CSS class

  // Function to create a section
  function createSection(hasDivider) {
    const section = document.createElement("div");
    section.className = "vote-results-section";
    if (hasDivider) section.classList.add("has-divider");
    return section;
  }

  const haveSection = createSection(true);
  const neverSection = createSection(false);

  // Function to create header
  function createHeader(text) {
    const header = document.createElement("div");
    header.className = "vote-results-header";
    header.textContent = text;
    return header;
  }

  haveSection.appendChild(createHeader("Have"));
  neverSection.appendChild(createHeader("Have Never"));

  // Function to add icons
  function addIcons(section, players) {
    const iconsWrapper = document.createElement("div");
    iconsWrapper.className = "vote-results-icons";

    players.forEach(player => {
      const iconContainer = document.createElement("div");
      iconContainer.className = "vote-results-icon";

      createUserIconPartyGames({
        container: iconContainer,
        userId: player.computerId,
        userCustomisationString: player.userIcon
      });

      iconsWrapper.appendChild(iconContainer);
    });

    section.appendChild(iconsWrapper);
  }

  addIcons(haveSection, haveVotes);
  addIcons(neverSection, haveNeverVotes);

  wrapper.appendChild(haveSection);
  wrapper.appendChild(neverSection);
}

async function PartySkip() {
  const icons = waitingForPlayersIconContainer.querySelectorAll('.icon');
  await ResetQuestion({
    icons: icons,
    timer: Date.now() + getIncrementContainerValue("time-limit") * 1000
  });
}
