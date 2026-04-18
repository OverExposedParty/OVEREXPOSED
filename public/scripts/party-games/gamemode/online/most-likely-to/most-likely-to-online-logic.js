function GetVoteResults(currentPartyData) {
  const players = currentPartyData.players;

  const values = [];
  const voteComputerIds = [];

  for (let i = 0; i < players.length; i++) {
    const targetId = getPlayerId(players[i]);

    // All players who voted for this target
    const voters = players.filter(p => p.state.vote === targetId);

    values.push(voters.length);
    voteComputerIds.push(voters.map(v => getPlayerId(v)));
  }

  const tableWrapper = document.getElementById("tableWrapper");
  tableWrapper.innerHTML = "";

  const table = document.createElement("table");
  table.classList.add("vote-results-table");

  players.forEach((player, i) => {
    if (values[i] === 0) return;

    const row = document.createElement("tr");

    // Icon cell for the voted player
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
      const voterId = voteComputerIds[i][j];
      const voter = players.find(p => getPlayerId(p) === voterId);
      if (!voter) continue;

      let iconSize = null;
      if (values[i] > 3) {
        iconSize = "small";
      }

      createUserIconPartyGames({
        container: votesCell,
        userId: getPlayerId(voter),
        userCustomisationString: getPlayerIcon(voter),
        size: iconSize
      });
    }

    row.appendChild(votesCell);
    table.appendChild(row);
  });

  tableWrapper.appendChild(table);
}

function GetVoteCount(currentPartyData, computerId) {
  return currentPartyData.players.filter(p => p.state.vote === computerId).length;
}

function getHighestVoteValue(currentPartyData) {
  const players = currentPartyData.players;
  const voteCounts = {};

  players.forEach(p => {
    const id = getPlayerId(p);
    voteCounts[id] = GetVoteCount(currentPartyData, id);
  });

  const values = Object.values(voteCounts);
  if (values.length === 0) return 0;

  const maxVote = Math.max(...values);
  const occurrences = values.filter(v => v === maxVote).length;

  // Negative if tie
  return occurrences > 1 ? -maxVote : maxVote;
}

function GetHighestVoted(currentPartyData) {
  const players = currentPartyData.players;
  const highestVoteValue = Math.abs(getHighestVoteValue(currentPartyData));

  return players
    .filter(p => GetVoteCount(currentPartyData, getPlayerId(p)) === highestVoteValue)
    .map(p => getPlayerId(p))
    .join(",");
}

function CountParsedString(parsedString) {
  if (!parsedString) return 0;
  return parsedString.split(",").filter(Boolean).length;
}

function GetStringAtIndex(votedString, index) {
  const stringList = votedString.split(",").filter(Boolean);
  return stringList[index] || null;
}

async function FetchInstructions() {
  currentPartyData = await GetCurrentPartyData({ requireInstructions: true, retries: 8, delayMs: 150 });
  if (!currentPartyData) {
    PartyDisbanded();
    return;
  }

  await UpdatePartyGameStatistics();
  const state = getPartyState(currentPartyData);
  const phase = state?.phase ?? null;
  const instructions = getUserInstructions(currentPartyData);

  if (phase === "most-likely-to-tiebreaker") {
    await TieBreakerPunishmentOffer();
    return;
  }

  if (phase === "most-likely-to-choose-punishment") {
    await ChoosingPunishment();
    return;
  }

  if (phase === "most-likely-to-show-punishment") {
    await ChosePunishment();
    return;
  }

  if (!instructions || typeof instructions !== "string") {
    debugLog("No instructions to process.");
    return;
  }

  if (instructions.includes("DISPLAY_PRIVATE_CARD")) {
    DisplayPrivateCard();
  }
  else if (instructions.includes("DISPLAY_VOTE_RESULTS")) {
    DisplayVoteResults();
  }
  else if (instructions.includes("WAITING_FOR_PLAYER")) {
    WaitingForPlayer(instructions);
  }
  else if (instructions.includes("HAS_USER_DONE_PUNISHMENT")) {
    HasUserDonePunishment(instructions);
  }
  else if (instructions.includes("GAME_OVER")) {
    SetPartyGameStatisticsGameOver();
  }
  else if (instructions.includes("RESET_QUESTION")) {
    if (instructions.includes("PLAYER_TURN_PASSED")) {
      const parsed = parseInstructionDeviceId(instructions);
      const players = currentPartyData.players;
      const playerIndex = players.findIndex(p => getPlayerId(p) === parsed.reason);

      await ResetQuestion({
        timer: Date.now() + gameRules["time-limit"] * 1000,
        playerIndex,
        incrementScore: -2
      });
    } else {
      await ResetQuestion({
        timer: Date.now() + gameRules["time-limit"] * 1000
      });
    }
  }
}
