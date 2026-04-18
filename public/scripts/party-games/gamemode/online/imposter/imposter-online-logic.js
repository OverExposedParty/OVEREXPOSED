function GetVoteResults(currentPartyData) {
  const players = currentPartyData.players || [];
  const values = [];
  const voteComputerIds = [];

  for (let i = 0; i < players.length; i++) {
    const target = players[i];
    const targetId = getPlayerId(target);

    const voters = players.filter(
      player => getPlayerState(player).vote === targetId
    );

    values.push(voters.length);
    voteComputerIds.push(voters.map(v => getPlayerId(v)));
  }

  const tableWrapper = document.getElementById("tableWrapper");
  tableWrapper.innerHTML = "";

  const table = document.createElement("table");
  table.classList.add("vote-results-table");

  players.forEach((player, i) => {
    const row = document.createElement("tr");

    // --- Player icon cell ---
    const iconCell = document.createElement("td");
    iconCell.classList.add("vote-icon-cell");

    createUserIconPartyGames({
      container: iconCell,
      userId: getPlayerId(player),
      userCustomisationString: getPlayerIcon(player)
    });

    row.appendChild(iconCell);

    const colonCell = document.createElement("td");
    colonCell.textContent = ":";
    colonCell.classList.add("vote-colon-cell");
    row.appendChild(colonCell);

    const votesCell = document.createElement("td");
    votesCell.classList.add("vote-votes-cell");

    for (let j = 0; j < values[i]; j++) {
      let iconSize = null;
      const voterId = voteComputerIds[i][j];
      const voter = players.find(p => getPlayerId(p) === voterId);
      if (values[i] > 3) {
        iconSize = "small";
      }
      if (voter) {
        createUserIconPartyGames({
          container: votesCell,
          userId: getPlayerId(voter),
          userCustomisationString: getPlayerIcon(voter),
          size: iconSize
        });
      }
    }

    row.appendChild(votesCell);
    table.appendChild(row);
  });

  tableWrapper.appendChild(table);
}

function getHighestVoteValue(currentPartyData) {
  const players = currentPartyData.players || [];
  const voteCounts = {};

  for (let i = 0; i < players.length; i++) {
    const computerId = getPlayerId(players[i]);
    voteCounts[computerId] = GetVoteCount(currentPartyData, computerId);
  }

  const values = Object.values(voteCounts);
  const maxVote = Math.max(...values);
  const occurrences = values.filter(v => v === maxVote).length;

  return occurrences > 1 ? -maxVote : maxVote;
}

function GetHighestVoted(currentPartyData) {
  const players = currentPartyData.players || [];
  const highestVoteValue = Math.abs(getHighestVoteValue(currentPartyData));

  return players
    .filter(player => {
      const id = getPlayerId(player);
      return GetVoteCount(currentPartyData, id) === highestVoteValue;
    })
    .map(player => getPlayerId(player))
    .join(",");
}

function GetVoteCount(currentPartyData, computerId) {
  const players = currentPartyData.players || [];
  return players.filter(player => getPlayerState(player).vote === computerId).length;
}

function GetAlternativeQuestion(input) {
  if (!Array.isArray(input) || input.length === 0) {
    return null;
  }

  const deck = currentPartyData.deck || {};
  const altIndex = deck.alternativeQuestionIndex ?? 0;

  const selectedAlternativeQuestion = input[altIndex % input.length];

  return selectedAlternativeQuestion;
}

async function FetchInstructions() {
  currentPartyData = await GetCurrentPartyData({ requireInstructions: true, retries: 8, delayMs: 150 });
  if (!currentPartyData) {
    PartyDisbanded();
    return;
  }

  await UpdatePartyGameStatistics();

  const userInstructions = getUserInstructions(currentPartyData);
  const state = getPartyState(currentPartyData);
  const phase = state?.phase ?? null;

  if (phase === 'imposter-choose-punishment') {
    ChoosingPunishment(state.playerTurn);
    return;
  } else if (phase === 'imposter-show-punishment') {
    DisplayPunishmentToUser();
    return;
  }

  if (userInstructions === "DISPLAY_VOTE_RESULTS") {
    DisplayVoteResults();
  } else if (userInstructions === "DISPLAY_VOTE_RESULTS_PART_TWO") {
    await DisplayVoteResultsPartTwo();
  } else if (userInstructions === "NEXT_QUESTION") {
    NextQuestion();
  } else if (userInstructions.includes("USER_HAS_PASSED")) {
    UserHasPassed(userInstructions);
  } else if (userInstructions.includes("DISPLAY_PRIVATE_CARD")) {
    DisplayPrivateCard(userInstructions);
  } else if (userInstructions.includes("DISPLAY_START_TIMER")) {
    DisplayStartTimer();
  } else if (userInstructions.includes("DISPLAY_ANSWER_CONTAINER")) {
    DisplayAnswerContainer();
  } else if (userInstructions.includes("WAITING_FOR_PLAYER")) {
    WaitingForPlayer(userInstructions);
  } else if (userInstructions.includes("GAME_OVER")) {
    SetPartyGameStatisticsGameOver();
  } else if (userInstructions.includes("RESET_QUESTION")) {
    if (userInstructions.includes("NEXT_PLAYER")) {
      await ResetImposterQuestion({ nextPlayer: true });
    }
  }
}
