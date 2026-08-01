async function DisplayVoteResults() {
  const state = getPartyState(currentPartyData);
  stopNeverHaveIEverVoteTimerWarning();

  const timerValue = state.timer ?? currentPartyData.timer ?? Date.now();
  const delay = new Date(timerValue) - Date.now();
  const firstDisplay = !isContainerVisible(resultsChartContainer);

  stopTimerForContainer(waitingForPlayersContainer, 'waitingForPlayersContainer');

  startTimerWithContainer({
    container: resultsChartContainer,
    label: 'resultsChartContainer',
    timeLeft: delay / 1000,
    duration: resultTimerDuration / 1000
  });

  if (firstDisplay) {
    scheduleNeverHaveIEverPhaseAction({
      delay,
      action: 'never-have-i-ever-resolve-vote-results',
      payload: {
        roundTimer: Date.now() + gameRules["time-limit"] * 1000,
        phaseTimer: Date.now() + gameRules["time-limit"] * 1000,
        nextPlayer: true
      }
    });

    try {
      GetVoteResults(currentPartyData);
    } catch (error) {
      console.error('Never Have I Ever vote results render failed:', error);
    }

    setActiveContainers(resultsChartContainer);
  }
}

async function WaitingForPlayer(instruction) {
  const parsed = parseInstruction(instruction);
  const selectedId = await GetSelectedPlayerTurnID();

  if (selectedId === deviceId) {
    if (parsed.reason !== "READING_CARD") {
      setActiveContainers(selectUserContainer);
    } else {
      setActiveContainers(gameContainerPrivate);
    }
  } else {
    setActiveContainers(waitingForPlayerContainer);
  }

  waitingForPlayerTitle.textContent = "Waiting for " + parsed.username;

  if (parsed.reason === "CHOOSE_PLAYER") {
    waitingForPlayerText.textContent = "Choosing Player...";
  } else if (parsed.reason === "READING_CARD") {
    waitingForPlayerText.textContent = "Reading Card...";
  }
}

function GetVoteResults(currentPartyData) {
  const players = currentPartyData.players || [];

  const haveVotes = [];
  const haveNeverVotes = [];

  players.forEach(player => {
    const ps = player.state ?? player;
    const vote = ps.vote ?? player.vote;

    if (vote === true) {
      haveVotes.push(player);
    } else if (vote === false) {
      haveNeverVotes.push(player);
    }
  });

  const wrapper = document.getElementById("tableWrapper");
  if (!wrapper) {
    console.warn('Never Have I Ever results wrapper not found.');
    return;
  }
  wrapper.innerHTML = "";
  wrapper.className = "vote-results-wrapper";

  function createSection(hasDivider) {
    const section = document.createElement("div");
    section.className = "vote-results-section";
    if (hasDivider) section.classList.add("has-divider");
    return section;
  }

  const haveSection = createSection(true);
  const neverSection = createSection(false);

  function createHeader(text) {
    const header = document.createElement("div");
    header.className = "vote-results-header";
    header.textContent = text;
    return header;
  }

  haveSection.appendChild(createHeader("Have"));
  neverSection.appendChild(createHeader("Have Never"));

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

  addIcons(haveSection, haveVotes);
  addIcons(neverSection, haveNeverVotes);

  wrapper.appendChild(haveSection);
  wrapper.appendChild(neverSection);
}
