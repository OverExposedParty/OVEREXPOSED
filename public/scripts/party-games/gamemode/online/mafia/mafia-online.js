let hostDeviceId = "";

const url = window.location.href;
const segments = url.split('/');
partyCode = segments.pop() || segments.pop();

const sideButtonsContainer = document.querySelector('.side-buttons');
const roleButton = document.getElementById('role-button');

const popUpRoleContainer = document.getElementById('pop-up-role-container');
const popUpRoleHeader = popUpRoleContainer.querySelector('.content-container h1');
const popUpRoleDescription = popUpRoleContainer.querySelector('.content-container h2');

const civilianRoles = ["civilian", "mayor"];
const mafiosoRoles = ["mafioso", "godfather"];
const neutralRoles = ["lawyer", "serial killer"];

async function SetPageSettings() {
  roleButton.addEventListener('click', () => {
    if (!popUpRoleContainer.classList.contains('active')) {
      overlay.classList.add('active');
      addElementIfNotExists(settingsElementClassArray, popUpRoleContainer);
      popUpRoleContainer.classList.add('active')
    }
  });

  selectUserDayPhaseConfirmButton.addEventListener('click', async () => {
    if (selectUserDayPhaseContainer.getAttribute('selected-id') != "") {
      await SetVote({
        option: selectUserDayPhaseContainer.getAttribute('selected-id')
      });

      const selectUserVoteDayPlayerButtons = selectUserDayPhaseContainer.querySelectorAll('.selected-user-container .button-container button');
      selectUserVoteDayPlayerButtons.forEach(btn => btn.classList.remove('active'));
      selectUserDayPhaseContainer.setAttribute('selected-id', "");
    }
  });

  selectUserNightPhaseConfirmButton.addEventListener('click', async () => {
    if (selectUserNightPhaseContainer.getAttribute('selected-id') != "") {
      await SetVote({
        option: selectUserNightPhaseContainer.getAttribute('selected-id')
      });
      const selectUserVoteNightPlayerButtons = selectUserNightPhaseContainer.querySelectorAll('.selected-user-container .button-container button');
      selectUserVoteNightPlayerButtons.forEach(btn => btn.classList.remove('active'));
      selectUserNightPhaseContainer.setAttribute('selected-id', "");
    }
  });

  AddTimerToContainer(waitingForPlayersContainer);

  const existingData = await getExistingPartyData(partyCode);
  if (!existingData || existingData.length === 0) {
    console.warn('No party data found.');
    return;
  }
  currentPartyData = existingData[0];

  console.log("initialisePage");
  await initialisePage();
}

async function initialisePage() {
  const response = await fetch(`/api/${sessionPartyType}?partyCode=${partyCode}`);
  const data = await response.json();
  if (data.length > 0) {
    isPlaying = true;
    const index = data[0].players.findIndex(player => player.computerId === deviceId);
    onlineUsername = data[0].players[index].username;
    hostDeviceId = data[0].players[0].computerId;
    console.log("hostDeviceId: " + hostDeviceId);
    if (data[0].players[index].socketId == "DISCONNECTED") {
      sendPartyChat({
        username: "[CONSOLE]",
        message: `${onlineUsername} has reconnected.`,
        eventType: "connect"
      });
    }
    data[0].players[index].socketId = socket.id
    joinParty(partyCode);
    if (data[0].isPlaying === true) {
      partyRulesSettings = parseGameRules(data[0].gameRules)
      for (let i = 0; i < data[0].players.length; i++) {
        if (data[0].players[i].status == "alive") {
          const userButton = createUserButton(data[0].players[i].computerId, data[0].players[i].username);

          const spanHover = document.createElement('span');
          spanHover.id = 'hover';
          spanHover.textContent = '0';

          const spanConfirmed = document.createElement('span');
          spanConfirmed.id = 'confirmed';
          spanConfirmed.textContent = '0';

          userButton.appendChild(document.createTextNode('['));
          userButton.appendChild(spanHover);
          userButton.appendChild(document.createTextNode(', '));
          userButton.appendChild(spanConfirmed);
          userButton.appendChild(document.createTextNode(']'));

          selectUserDayPhaseButtonContainer.appendChild(userButton);

        }
        if (data[0].players[i].computerId != deviceId && data[0].players[i].status == "alive" && !civilianRoles.includes(data[0].players[i].role)) {
          const userButton = createUserButton(data[0].players[i].computerId, data[0].players[i].username);

          const spanHover = document.createElement('span');
          spanHover.id = 'hover';
          spanHover.textContent = '0';

          const spanConfirmed = document.createElement('span');
          spanConfirmed.id = 'confirmed';
          spanConfirmed.textContent = '0';

          userButton.appendChild(document.createTextNode(' ['));
          userButton.appendChild(spanHover);
          userButton.appendChild(document.createTextNode(', '));
          userButton.appendChild(spanConfirmed);
          userButton.appendChild(document.createTextNode('] '));

          selectUserNightPhaseButtonContainer.appendChild(userButton);
        }
      }
      const selectUserVoteDayPlayerButtons = selectUserDayPhaseButtonContainer.querySelectorAll('button');
      const selectUserVoteNightPlayerButtons = selectUserNightPhaseButtonContainer.querySelectorAll('button');

      selectUserVoteDayPlayerButtons.forEach(button => {
        button.addEventListener('click', async () => {
          selectUserVoteDayPlayerButtons.forEach(btn => btn.classList.remove('active'));
          button.classList.add('active');
          selectUserDayPhaseContainer.setAttribute('selected-id', button.getAttribute('id'));
          await SetVote({
            option: selectUserDayPhaseContainer.getAttribute('selected-id'),
            hover: true
          });
        });
      });

      selectUserVoteNightPlayerButtons.forEach(button => {
        button.addEventListener('click', async () => {
          selectUserVoteNightPlayerButtons.forEach(btn => btn.classList.remove('active'));
          button.classList.add('active');
          selectUserNightPhaseContainer.setAttribute('selected-id', button.getAttribute('id'));
          await SetVote({
            option: selectUserNightPhaseContainer.getAttribute('selected-id'),
            hover: true
          });
        });
      });
      if (selectUserNightPhaseContainer.length > 4) {
        selectUserNightPhaseContainer.classList.add('overflow');
      }

      await LoadScript(`/scripts/party-games/gamemode/online/${placeHolderSelectedUser.dataset.template}/${placeHolderSelectedUser.dataset.template}-online-instructions.js?30082025`);
      await LoadScript("/scripts/party-games/gamemode/online/mafia/mafia-dialogue.js");
      await LoadScript("/scripts/party-games/gamemode/online/mafia/mafia-civilian-watch.js");

      if (deviceId == hostDeviceId && data[0].userInstructions == "") {
        const roles = await GetRoles(data[0].players.length);
        console.log(roles);
        const shuffledRoles = getShuffledRoles(roles);
        data[0].players.forEach((player, i) => {
          player.role = shuffledRoles[i] || null;
        });
        data[0].players = ResetVotes(data[0].players);
        data[0].phase = "night";
        await SendInstruction({
          instruction: "DISPLAY_ROLE",
          updateUsersReady: false,
          updateUsersConfirmation: false,
          partyData: data[0],
          timer: new Date(Date.now() + mafiaDisplayRoleTimer)
        });
      }
      else {
        updateOnlineParty({
          partyId: partyCode,
          players: data[0].players,
          lastPinged: Date.now(),
        });
      }
      await AddUserIcons();
      SetScriptLoaded('/scripts/party-games/online/online-settings.js');
    }
  }
}

function GetMafiaVote() {
  const votes = currentPartyData.players
    .filter(player => mafiosoRoles.includes(player.role))
    .map(player => player.vote)
    .filter(vote => vote);
  console.log(votes);
  return getMostFrequentVote(votes);
}

async function GetTownVote() {
  const response = await fetch(`/api/${sessionPartyType}?partyCode=${partyCode}`);
  const data = await response.json();

  // Collect all player votes
  const votes = data[0].players
    .map(player => player.vote)
    .filter(vote => vote);

  return getMostFrequentVote(votes);
}


function getMostFrequentVote(votes) {
  // Ensure input is a non-empty array
  if (!Array.isArray(votes) || votes.length === 0) return "";

  // Count the frequency of each vote
  const counts = {};
  for (const vote of votes) {
    if (vote) { // ignore null or empty strings
      counts[vote] = (counts[vote] || 0) + 1;
    }
  }

  // Find the highest frequency vote
  let maxCount = 0;
  let maxVote = "";
  let isTie = false;

  for (const vote in counts) {
    if (counts[vote] > maxCount) {
      maxCount = counts[vote];
      maxVote = vote;
      isTie = false;
    } else if (counts[vote] === maxCount) {
      isTie = true;
    }
  }

  return isTie ? "" : maxVote;
}

async function CheckGameOver() {
  const currentPartyData = await GetCurrentPartyData();

  const civilianPlayers = currentPartyData.players.filter(player =>
    civilianRoles.includes(player.role) && player.alive
  );

  const mafiosoPlayers = currentPartyData.players.filter(player =>
    mafiosoRoles.includes(player.role) && player.alive
  );

  if (mafiosoPlayers >= civilianPlayers) {
    //return "DISPLAY_GAMEOVER:MAFIOSO";
  }
  else if (mafiosoPlayers == 0) {
    //return "DISPLAY_GAMEOVER:CIVILIAN";
  }
  return null;
}
async function GetRoles(playerCount) {
  try {
    const response = await fetch('/json-files/party-games/packs/mafia.json');
    const data = await response.json();

    const validRoles = (data["mafia-packs"] || [])
      .filter(item => item["pack-type"] === "role" && item["pack-active"] === true)
      .map(item => item["pack-name"]); 
    const builtList = [];

    partyRulesSettings.forEach(entry => {
      if (!entry) return;
      const parts = entry.split(':').map(s => s.trim());
      const key = parts[0].replace("mafia-", '');
      const count = parseInt(parts[1], 10);
      console.log("key", key, "count", count);
      console.log("validRoles", validRoles);
      // if this entry is one of the valid roles, expand it count times (default to 1)
      if (validRoles.includes(key)) {
        const times = Number.isFinite(count) && count > 0 ? count : 1;
        for (let i = 0; i < times; i++) builtList.push(key);
      }
      // otherwise ignore (e.g. time limits, other non-role settings)
    });

    // 4) If builtList is shorter than playerCount, pad with mafia-civilian
    while (builtList.length < playerCount) {
      builtList.push("mafia-civilian");
    }

    // 5) compress back to role:count format
    const roleCounts = builtList.reduce((acc, role) => {
      acc[role] = (acc[role] || 0) + 1;
      return acc;
    }, {});

    const roleString = Object.entries(roleCounts)
      .map(([role, cnt]) => `${role}:${cnt}`)
      .join(', ');

    return roleString;
  } catch (err) {
    console.error('GetRoles error:', err);
    return null;
  }
}


function getShuffledRoles(roleString) {
  const roles = [];
  roleString.split(', ').forEach(entry => {
    if (entry.trim() === '') return;
    const [roleRaw, countStr] = entry.split(':');
    const count = countStr ? parseInt(countStr, 10) : 1;

    const formattedRole = roleRaw.trim()
      .replace(/^mafia-/, '')
      .replace(/-/g, ' ');

    for (let i = 0; i < count; i++) {
      roles.push(formattedRole);
    }
  });

  // Fisher-Yates shuffle with Math.random()
  const shuffled = [...roles];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled;
}

async function FetchInstructions() {
  currentPartyData = await GetCurrentPartyData();
  if (currentPartyData == undefined || currentPartyData.length === 0) {
    PartyDisbanded();
    return;
  }

  if (currentPartyData.userInstructions.includes("DISPLAY_ROLE")) {
    DisplayRole();
  }
  else if (currentPartyData.userInstructions.includes("DISPLAY_NIGHT_PHASE")) {
    if (currentPartyData.userInstructions.includes("PART_TWO")) {
      DisplayNightPhasePartTwo();
    }
    else {
      DisplayNightPhase();
    }
  }
  else if (currentPartyData.userInstructions.includes("DISPLAY_PLAYER_KILLED")) {
    if (currentPartyData.userInstructions.includes("PART_TWO")) {
      DisplayPlayerKilledPartTwo(currentPartyData.userInstructions);
    }
    else {
      DisplayPlayerKilled(currentPartyData.userInstructions);
    }
  }
  else if (currentPartyData.userInstructions.includes("DISPLAY_DAY_PHASE_DISCUSSION")) {
    DisplayDayPhaseDiscussion();
  }
  else if (currentPartyData.userInstructions.includes("DISPLAY_DAY_PHASE_VOTE")) {
    if (currentPartyData.userInstructions.includes("PART_TWO")) {
      DisplayDayPhaseVotePartTwo();
    }
    else{
      DisplayDayPhaseVote();
    }
  }
  else if (currentPartyData.userInstructions.includes("DISPLAY_TOWN_VOTE")) {
    if (currentPartyData.userInstructions.includes("PART_TWO")) {
      DisplayTownVotePartTwo();
    }
    else {
      DisplayTownVote(currentPartyData.userInstructions);
    }
  }
  else if (currentPartyData.userInstructions.includes("DISPLAY_GAMEOVER")) {
    DisplayGameOver(currentPartyData.userInstructions);
  }
}

function RemoveUserButton(userContainer, deviceId) {
  if (!userContainer || !deviceId) return;

  const buttonToRemove = userContainer.querySelector(`#${deviceId}`);
  if (buttonToRemove) {
    buttonToRemove.remove();
  }
}