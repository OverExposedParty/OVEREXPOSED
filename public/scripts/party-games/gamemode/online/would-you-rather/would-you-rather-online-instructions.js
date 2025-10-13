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

async function DisplayPunishmentToUser(instruction) {
  const currentPartyData = await GetCurrentPartyData();
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

  const aVoteCount = currentPartyData.players.filter(player => player.vote === "A").length;
  const bVoteCount = currentPartyData.players.filter(player => player.vote === "B").length;

  const currentVote = currentPartyData.players[index].vote;

  if (allConfirmed) {
    if (currentPartyData.players[0].computerId === deviceId) {
      await ResetQuestion({
        currentPartyData: currentPartyData,
        icons: icons
      });
    }
  }
  else if (parsedInstructions.reason === "TAKE_A_SIP") {
    if ((aVoteCount == bVoteCount || aVoteCount == 0 || bVoteCount == 0) && deviceId == hostDeviceId) {
      await ResetQuestion({
        currentPartyData: currentPartyData,
        icons: icons
      });
    }
    else {
      if (currentPartyData.players[index].vote == "A" && bVoteCount > aVoteCount || currentPartyData.players[index].vote == "B" && aVoteCount > bVoteCount) {

        completePunishmentText.textContent = "Take a sip.";
        completePunishmentContainer.setAttribute("punishment-type", parsedInstructions.reason);

        if (!currentPartyData.players[index].hasConfirmed) {
          setActiveContainers(completePunishmentContainer);
        } else {
          DisplayWaitingForPlayers(currentPartyData, index, true);
        }
      }
    }
  }
  else if (parsedInstructions.reason === "ODD_MAN_OUT") {
    let oddManOutIndex;
    if (aVoteCount === 1) {
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
        await ResetQuestion({
          currentPartyData: currentPartyData,
          icons: icons
        });
      }
    }
  }
}

async function DisplayPrivateCard(instruction) {
  const currentPartyData = await GetCurrentPartyData();
  const index = currentPartyData.players.findIndex(player => player.computerId === deviceId);
  const parsedInstructions = parseInstructionSecondReason(instruction);
  const player = currentPartyData.players[index];
  if (!player.isReady && !player.hasConfirmed) {
    selectedQuestionObj = getNextQuestion(currentPartyData.currentCardIndex);
    DisplayCard(gameContainerPrivate, selectedQuestionObj);
    setActiveContainers(gameContainerPrivate);
  }
  else if (player.isReady && !player.hasConfirmed) {
    selectedQuestionObj = getNextQuestion(currentPartyData.currentCardIndex);
    const splitQuestion = SplitQuestion(selectedQuestionObj.question.replace("Would you rather ", ""));
    selectOptionQuestionTextA.textContent = "A: " + splitQuestion.a;
    selectOptionQuestionTextB.textContent = "B: " + splitQuestion.b;
    setActiveContainers(selectOptionContainer);
  }
  else {
    const allConfirmed = currentPartyData.players.every(player => player.hasConfirmed === true);

    if (allConfirmed) {
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

async function DisplayVoteResults() {
  const currentPartyData = await GetCurrentPartyData();

  if (!resultsChartContainer.classList.contains('active')) {
    GetVoteResults(currentPartyData);
    setActiveContainers(resultsChartContainer);
  }

  const aVoteCount = currentPartyData.players.filter(player => player.vote === "A").length;
  const bVoteCount = currentPartyData.players.filter(player => player.vote === "B").length;

  if (currentPartyData.players[0].computerId === deviceId) {
    await new Promise(resolve => setTimeout(resolve, 5000));
    let punishmentInstruction;
    if ((aVoteCount === 1 || bVoteCount === 1) && currentPartyData.gameRules.includes('odd-man-out')) {
      punishmentInstruction = "CHOSE_PUNISHMENT:ODD_MAN_OUT";
    }
    else {
      punishmentInstruction = "CHOSE_PUNISHMENT:TAKE_A_SIP";
    }

    await SendInstruction({
      instruction: punishmentInstruction,
      updateUsersReady: false,
      updateUsersConfirmation: false
    });
  }
}

function GetVoteResults(currentPartyData) {
  const aVotes = [];
  const bVotes = [];

  currentPartyData.players.forEach((player) => {
    if (player.vote === "A") {
      aVotes.push(player);
    } else if (player.vote === "B") {
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

  selectedQuestionObj = getNextQuestion(currentPartyData.currentCardIndex);
  const splitQuestion = SplitQuestion(selectedQuestionObj.question.replace("Would you rather ", ""));

  aSection.appendChild(createHeader(splitQuestion.a));
  bSection.appendChild(createHeader(splitQuestion.b));

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

  addIcons(aSection, aVotes);
  addIcons(bSection, bVotes);

  wrapper.appendChild(aSection);
  wrapper.appendChild(bSection);
}

async function PartySkip() {
  const currentPartyData = await GetCurrentPartyData();
  const icons = waitingForPlayersIconContainer.querySelectorAll('.icon');
  await ResetQuestion({
    currentPartyData: currentPartyData,
    icons: icons
  });
}

function SplitQuestion(question) {
  const parts = question.split(" OR ");

  if (parts.length === 2) {
    const a = parts[0].trim().replace(/\.*$/, '').replace(/\?/g, '');
    const b = parts[1].trim().replace(/\.*$/, '').replace(/\?/g, '');
    return { a, b };
  } else {
    return { a: question.trim().replace(/\.*$/, '').replace(/\?/g, ''), b: "" };
  }
}