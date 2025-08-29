let hostDeviceId = "";

const url = window.location.href;
const segments = url.split('/');
partyCode = segments.pop() || segments.pop();

const waitingForPlayersContainers = document.getElementById('waiting-for-players-container');
const waitingForPlayersTimerWrapper = waitingForPlayersContainers.querySelector('.timer-wrapper');

const displayRoleContainer = document.getElementById('display-role-container');
const displayRoleTimerWrapper = displayRoleContainer.querySelector('.timer-wrapper');
const displayRoleHeader = displayRoleContainer.querySelector('.content-container h1');
const displayRoleDescription = displayRoleContainer.querySelector('.content-container h2');

const selectUserVoteDayContainer = document.getElementById('select-user-day-phase-container');
const selectUserVoteDayTimerWrapper = selectUserVoteDayContainer.querySelector('.timer-wrapper');
const selectUserVoteDaySelectUserContainer = selectUserVoteDayContainer.querySelector('.button-container');
const selectUserVoteDayConfirmButton = selectUserVoteDayContainer.querySelector('.select-button-container .select-button');

const selectUserVoteNightContainer = document.getElementById('select-user-night-phase-container');
const selectUserVoteNightTimerWrapper = selectUserVoteNightContainer.querySelector('.timer-wrapper');
const selectUserVoteNightSelectUserContainer = selectUserVoteNightContainer.querySelector('.button-container');
const selectUserVoteNightConfirmButton = selectUserVoteNightContainer.querySelector('.select-button-container .select-button');

const displayTownVoteContainer = document.getElementById('display-town-vote-container');
const displayTownVoteTimerWrapper = displayTownVoteContainer.querySelector('.timer-wrapper');

const displayPlayerKilledContainer = document.getElementById('display-player-killed-container');
const displayPlayerKilledTimerWrapper = displayPlayerKilledContainer.querySelector('.timer-wrapper');
const displayPlayerKilledText = displayPlayerKilledContainer.querySelector('.content-container h2');

const displayGameOverContainer = document.getElementById('display-game-over-container');
const displayGameOverHeader = displayGameOverContainer.querySelector('.content-container h1');
const displayGameOverText = displayGameOverContainer.querySelector('.content-container h2');

const displayDayPhaseDiscussionContainer = document.getElementById('display-day-timer'); //Big Time Wrapper

const sideButtonsContainer = document.querySelector('.side-buttons');
const roleButton = document.getElementById('role-button');

const popUpRoleContainer = document.getElementById('pop-up-role-container');
const popUpRoleHeader = popUpRoleContainer.querySelector('.content-container h1');
const popUpRoleDescription = popUpRoleContainer.querySelector('.content-container h2');

gameContainers.push(
  waitingForPlayersContainers,
  displayRoleContainer,
  selectUserVoteDayContainer,
  selectUserVoteNightContainer,
  displayTownVoteContainer,
  displayPlayerKilledContainer,
  displayDayPhaseDiscussionContainer,
  displayGameOverContainer
);

const civilianRoles = ["civilian", "mayor"];
const mafiosoRoles = ["mafioso", "godfather"];
const neutralRoles = ["lawyer", "serial killer"];

roleButton.addEventListener('click', () => {
  if (!popUpRoleContainer.classList.contains('active')) {
    overlay.classList.add('active');
    addElementIfNotExists(settingsElementClassArray, popUpRoleContainer);
    popUpRoleContainer.classList.add('active')
  }
});

selectUserVoteDayConfirmButton.addEventListener('click', async () => {
  if (selectUserVoteDayContainer.getAttribute('selected-id') != "") {
    await SetVote({
      option: selectUserVoteDayContainer.getAttribute('selected-id')
    });

    const selectUserVoteDayPlayerButtons = selectUserVoteDayContainer.querySelectorAll('.selected-user-container .button-container button');
    selectUserVoteDayPlayerButtons.forEach(btn => btn.classList.remove('active'));
    selectUserVoteDayContainer.setAttribute('selected-id', "");
  }
});

selectUserVoteNightConfirmButton.addEventListener('click', async () => {
  if (selectUserVoteNightContainer.getAttribute('selected-id') != "") {
    await SetVote({
      option: selectUserVoteNightContainer.getAttribute('selected-id')
    });
    const selectUserVoteNightPlayerButtons = selectUserVoteNightContainer.querySelectorAll('.selected-user-container .button-container button');
    //selectUserVoteNightPlayerButtons.forEach(btn => btn.classList.remove('active'));
    //selectUserVoteNightContainer.setAttribute('selected-id', "");
  }
});

document.addEventListener('DOMContentLoaded', async () => {
  initialisePage();
});

async function initialisePage() {
  const response = await fetch(`/api/${sessionPartyType}?partyCode=${partyCode}`);
  const data = await response.json();
  if (data.length > 0) {
    joinParty(partyCode);
    hostDeviceId = data[0].players[0].computerId;
    if (data[0].isPlaying === true) {
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

          selectUserVoteDaySelectUserContainer.appendChild(userButton);

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

          selectUserVoteNightSelectUserContainer.appendChild(userButton);
        }
      }
      const selectUserVoteDayPlayerButtons = selectUserVoteDayContainer.querySelectorAll('.selected-user-container .button-container button');
      const selectUserVoteNightPlayerButtons = selectUserVoteNightContainer.querySelectorAll('.selected-user-container .button-container button');

      selectUserVoteDayPlayerButtons.forEach(button => {
        button.addEventListener('click', async () => {
          selectUserVoteDayPlayerButtons.forEach(btn => btn.classList.remove('active'));
          button.classList.add('active');
          selectUserVoteDayContainer.setAttribute('selected-id', button.getAttribute('id'));
          await SetVote({
            option: selectUserVoteDayContainer.getAttribute('selected-id'),
            hover: true
          });
        });
      });

      selectUserVoteNightPlayerButtons.forEach(button => {
        button.addEventListener('click', async () => {
          selectUserVoteNightPlayerButtons.forEach(btn => btn.classList.remove('active'));
          button.classList.add('active');
          selectUserVoteNightContainer.setAttribute('selected-id', button.getAttribute('id'));
          await SetVote({
            option: selectUserVoteNightContainer.getAttribute('selected-id'),
            hover: true
          });
        });
      });
      if (selectUserVoteNightContainer.length > 4) {
        selectUserVoteNightContainer.classList.add('overflow');
      }
      const shuffledRoles = getShuffledRoles(data[0].selectedRoles, data[0].shuffleSeed);
      data[0].players.forEach((player, i) => {
        player.role = shuffledRoles[i] || null;
      });
      if (deviceId == hostDeviceId) {
        data[0].players = ResetVotes(data[0].players);
        data[0].timer = new Date(Date.now() + mafiaDisplayRoleTimer);
        data[0].phase = "night";
        await SendInstruction({
          instruction: "DISPLAY_ROLE",
          updateUsersReady: false,
          updateUsersConfirmation: false,
          partyData: data[0],
        });
      }
    }
    FetchInstructions();
  }
}

async function GetMafiaVote() {
  const response = await fetch(`/api/${sessionPartyType}?partyCode=${partyCode}`);
  const data = await response.json();

  // Collect votes from all mafiosos
  const votes = data[0].players
    .filter(player => mafiosoRoles.includes(player.role))
    .map(player => player.vote) // assuming .vote holds the voted playerId
    .filter(vote => vote); // remove null/undefined

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


function startTimer(timeLeft, duration, selectedTimer) {
  const timer = selectedTimer.querySelector('.timer');
  const mask = selectedTimer.querySelector('.mask');
  const timerWrapper = selectedTimer; // Assuming this is correct context

  let timerNumber;
  let small = selectedTimer.classList.contains('small');

  if (!small) {
    timerNumber = selectedTimer.querySelector('.timer-number');
    timerNumber.textContent = timeLeft;
  }

  if (timeLeft > duration) timeLeft = duration;
  if (timeLeft < 0) timeLeft = 0;

  timerWrapper.classList.add('active');

  let startTime = null;
  let remaining = timeLeft;

  function animate(timestamp) {
    if (!startTime) startTime = timestamp;
    const elapsed = (timestamp - startTime) / 1000;

    const timePassed = duration - timeLeft + elapsed;
    const progress = Math.min(timePassed / duration, 1);

    const rotateDeg = 360 * progress;
    timer.style.transform = `rotate(${rotateDeg}deg)`;

    if (progress < 0.5) {
      const localProgress = progress / 0.5;
      const rotation = 0 + localProgress * (-179.8);
      mask.style.transform = `rotate(${rotation}deg)`;
      mask.style.background = getComputedStyle(document.documentElement)
        .getPropertyValue('--primarypagecolour').trim();
    } else {
      const localProgress = (progress - 0.5) / 0.5;
      const rotation = 0 + localProgress * (-180);
      mask.style.transform = `rotate(${rotation}deg)`;
      mask.style.background = getComputedStyle(document.documentElement)
        .getPropertyValue('--backgroundcolour').trim();
    }

    const newRemaining = Math.ceil(duration - timePassed);
    if (!small && newRemaining !== remaining && newRemaining >= 0) {
      remaining = newRemaining;
      timerNumber.textContent = remaining;
    }

    if (progress < 1) {
      requestAnimationFrame(animate);
    }
  }
  requestAnimationFrame(animate);
}

function getShuffledRoles(roleString) {
  const roles = [];
  roleString.split(',').forEach(entry => {
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


function getGameSetting(inputString, key) {
  const settings = inputString.split(',');

  for (const setting of settings) {
    const [settingKey, value] = setting.split(':');
    if (settingKey.trim() === key) {
      return Number(value);
    }
  }

  return null; // or a default value like 0 if preferred
}

function createCancelableTimeout(ms) {
  let timeoutId;
  let rejectFn;
  let isFinished = false;

  const promise = new Promise((resolve, reject) => {
    rejectFn = reject;
    timeoutId = setTimeout(() => {
      isFinished = true;
      resolve();
    }, ms);
  });

  return {
    promise,
    cancel: () => {
      if (!isFinished && timeoutId != null) {
        clearTimeout(timeoutId);
        //rejectFn?.(new Error('Timeout canceled'));
        timeoutId = null;
      }
    }
  };
}

async function FetchInstructions() {
  const res = await fetch(`/api/${sessionPartyType}?partyCode=${partyCode}`);
  const data = await res.json();
  if (!data || data.length === 0) {
    PartyDisbanded();
    return;
  }

  if (data[0].userInstructions.includes("DISPLAY_ROLE")) {
    DisplayRole();
  }
  else if (data[0].userInstructions.includes("DISPLAY_NIGHT_PHASE")) {
    DisplayNightPhase();
  }
  else if (data[0].userInstructions.includes("DISPLAY_PLAYER_KILLED")) {
    DisplayPlayerKilled(data[0].userInstructions);
  }
  else if (data[0].userInstructions.includes("DISPLAY_DAY_PHASE_DISCUSSION")) {
    DisplayDayPhaseDiscussion();
  }
  else if (data[0].userInstructions.includes("DISPLAY_DAY_PHASE_VOTE")) {
    DisplayDayPhaseVote();
  }
  else if (data[0].userInstructions.includes("DISPLAY_TOWN_VOTE")) {
    DisplayTownVote(data[0].userInstructions);
  }
  else if (data[0].userInstructions.includes("DISPLAY_GAMEOVER")) {
    DisplayGameOver(data[0].userInstructions);
  }
}

function RemoveUserButton(userContainer, deviceId) {
  if (!userContainer || !deviceId) return;

  const buttonToRemove = userContainer.querySelector(`#${deviceId}`);
  if (buttonToRemove) {
    buttonToRemove.remove();
  }
}