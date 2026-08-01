async function DisplayVoteResults() {
  const state = getPartyState(currentPartyData);

  stopWouldYouRatherVoteTimerWarning();

  const delay = new Date(state.timer) - Date.now();
  const firstDisplay = !isContainerVisible(resultsChartContainer);

  stopTimerForContainer(waitingForPlayersContainer, 'waitingForPlayersContainer');
  startTimerWithContainer({
    container: resultsChartContainer,
    label: 'resultsChartContainer',
    timeLeft: delay / 1000,
    duration: resultTimerDuration / 1000
  });

  if (firstDisplay) {
    GetVoteResults(currentPartyData);
    setActiveContainers(resultsChartContainer);
  }

  if (firstDisplay) {
    scheduleWouldYouRatherPhaseAction({
      delay,
      action: 'would-you-rather-resolve-vote-results',
      payload: {
        nextRoundTimerDurationMs: getTimeLimit() * 1000,
        nextPhaseTimerDurationMs: getTimeLimit() * 1000
      }
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

function GetVoteResults(currentPartyData) {
  const players =
    typeof getRoundLateJoinParticipants === 'function'
      ? getRoundLateJoinParticipants(currentPartyData)
      : currentPartyData.players || [];
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
