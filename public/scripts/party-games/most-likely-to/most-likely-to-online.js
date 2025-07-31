let isHeads = false;
let hostDeviceId = "";

const url = window.location.href;
const segments = url.split('/');
partyCode = segments.pop() || segments.pop(); // handle trailing slash

const resultsChartContainer = document.getElementById('results-container');

const waitingForPlayersContainer = document.getElementById('waiting-for-confirm-punishment-container')
const waitingForPlayersIconContainer = waitingForPlayersContainer.querySelector('.content-container .user-confirmed-section');

const nextQuestionContainer = document.getElementById('next-question-container')
const nextQuestionSectionContainer = nextQuestionContainer.querySelector('.content-container .user-confirmed-section');

const selectUserContainer = document.getElementById('select-user-container');
const selectUserContainerQuestionText = selectUserContainer.querySelector('.content-container h2');
const selectUserButtonContainer = document.getElementById('select-user-container').querySelector('.selected-user-container .button-container');
const confirmPlayerButton = selectUserContainer.querySelector('.select-button-container button');

const selectNumberContainer = document.getElementById('select-number-container');
const selectNumberContainerQuestionText = selectUserContainer.querySelector('.content-container h2');
const selectNumberButtonContainer = selectNumberContainer.querySelector('.selected-user-container .button-container');
const confirmNumberButton = selectNumberContainer.querySelector('.select-button-container button');

const waitingForPlayerContainer = document.getElementById('waiting-for-player');
const waitingForPlayerTitle = waitingForPlayerContainer.querySelector('.content-container h2')
const waitingForPlayerText = waitingForPlayerContainer.querySelector('.content-container p')

const gameContainerPublic = document.querySelector('#public-view.card-container');

const confirmPunishmentContainer = document.getElementById('confirm-punishment-container');
const confirmPunishmentText = confirmPunishmentContainer.querySelector('.content-container h2');
const confirmPunishmentButtonYes = confirmPunishmentContainer.querySelector('#yes');
const confirmPunishmentButtonNo = confirmPunishmentContainer.querySelector('#no');

const pickHeadsOrTailsContainer = document.getElementById('heads-or-tails-pick-container');

const selectPunishmentContainer = document.getElementById('select-punishment-container')
const selectPunishmentButtonContainer = selectPunishmentContainer.querySelector('.selected-user-container .button-container');

const drinkingWheelContainer = document.querySelector('#spin-the-wheel-container');

const buttonChoosePlayer = document.getElementById('button-choose-player');
const confirmPunishmentButton = document.getElementById('select-punishment-container').querySelector('.select-button-container button');

const completePunishmentContainer = document.getElementById('complete-punishment-container');
const completePunishmentButtonConfirm = completePunishmentContainer.querySelector('.select-button-container #pass');

gameContainers.push(
  waitingForPlayersContainer,
  nextQuestionContainer,
  selectUserContainer,
  waitingForPlayerContainer,
  gameContainerPublic,
  confirmPunishmentContainer,
  selectPunishmentContainer,
  completePunishmentContainer,
  selectNumberContainer,
  drinkingWheelContainer,
  resultsChartContainer
);

function setActiveContainers(...activeContainers) {
  const uniqueActiveContainers = new Set(activeContainers);

  gameContainers.forEach(container => {
    if (uniqueActiveContainers.has(container)) {
      container.classList.add('active');
    } else {
      container.classList.remove('active');
    }
  });
}

const punishmentText = document
  .querySelector('#complete-punishment-container .content-container #punishment-text');

buttonChoosePlayer.addEventListener('click', () => {
  setActiveContainers(selectUserContainer);
  setUserBool(deviceId, null, true)
});

confirmPlayerButton.addEventListener('click', async () => {
  if (selectUserButtonContainer.getAttribute('selected-id') != "") {
    await SetVote({
      option: selectUserVoteDayContainer.getAttribute('selected-id')
    });
    const selectUserButtons = document.getElementById('select-user-container').querySelectorAll('.selected-user-container .button-container button');
    selectUserButtons.forEach(button => {
      button.classList.remove('active');
    });
    selectUserButtonContainer.getAttribute('selected-id') != ""
  }
});

confirmNumberButton.addEventListener('click', async () => {
  if (selectNumberContainer.getAttribute('selected-id') != "") {
    await SetVote({
      option: selectUserVoteDayContainer.getAttribute('selected-id')
    });
    const selectNumberButtons = selectNumberContainer.querySelectorAll('.selected-user-container .button-container button');
    selectNumberButtons.forEach(button => {
      button.classList.remove('active');
    });
    selectNumberContainer.getAttribute('selected-id') != ""
  }
});
confirmPunishmentButton.addEventListener('click', async () => {
  if (selectPunishmentContainer.getAttribute('select-id')) {
    selectPunishmentContainer.classList.remove('active');
    if (selectPunishmentContainer.getAttribute('select-id') == 'most-likely-to-drink-wheel') {
      await SendInstruction({
        instruction: "CHOSE_PUNISHMENT:MOST_LIKELY_TO_DRINK_WHEEL:" + deviceId,
      });
    }
    else if (selectPunishmentContainer.getAttribute('select-id') == 'take-a-shot') {
      completePunishmentContainer.setAttribute("punishment-type", "take-a-shot")
      await SendInstruction({
        instruction: "CHOSE_PUNISHMENT:TAKE_A_SHOT:" + deviceId,
      });
    }
    const selectPunishmentButtons = document.getElementById('select-punishment-container').querySelectorAll('.selected-user-container .button-container button');
    selectPunishmentButtons.forEach(button => {
      button.classList.remove('active');
    });
    selectPunishmentContainer.setAttribute('select-id', "");
  }
});

completePunishmentButtonConfirm.addEventListener('click', async () => {
  completePunishmentContainer.classList.remove('active');
  await SendInstruction({
    instruction: "PUNISHMENT_OFFER:CONFIRM:" + completePunishmentContainer.getAttribute("punishment-type").toUpperCase().replace(/-/g, '_') + ":" + deviceId,
  });
});

confirmPunishmentButtonYes.addEventListener('click', () => {
  SetUserConfirmation(deviceId, true, "PUNISHMENT", true);
});

confirmPunishmentButtonNo.addEventListener('click', () => {
  SetUserConfirmation(deviceId, false, "PUNISHMENT", true);
});

document.addEventListener('DOMContentLoaded', async () => {
  const existingData = await getExistingPartyData(partyCode);
  if (!existingData || existingData.length === 0) {
    console.warn('No party data found.');
    return;
  }
  const currentPartyData = existingData[0];

  await loadJSONFiles(currentPartyData.selectedPacks, currentPartyData.shuffleSeed);

  const selectedQuestionObj = getNextQuestion();
  updateTextContainer(selectedQuestionObj.question, selectedQuestionObj.cardType);
  initialisePage();
});

function updateTextContainer(text, cardType) {

  const textContainerPublic = document.querySelector('#public-view .text-container');

  textContainerPublic.textContent = text;
  selectUserContainerQuestionText.textContent = text.replace("Who's most likely to ", "");

  const searchPackName = cardType.toLowerCase();
  const matchedPack = cardPackMap.find(pack => {
    const packNameLower = pack.packName.toLowerCase();
    return packNameLower === searchPackName;
  });

  if (matchedPack) {
    const imageUrl = matchedPack.packCard ? matchedPack.packCard : `/images/blank-cards/${gamemode}-blank-card.svg`;
    document.querySelector('#public-view .main-image').src = imageUrl;
    textContainerPublic.style.color = matchedPack.packColour;
    document.querySelector('#public-view .card-type-text').style.color = matchedPack.packColour;
  } else {
    console.log("Pack not found");
  }

  document.querySelector('#public-view .card-type-text').textContent = cardType;
}
async function initialisePage() {
  const response = await fetch(`/api/${sessionPartyType}?partyCode=${partyCode}`);
  const data = await response.json();
  if (data.length > 0) {
    joinParty(partyCode);
    hostDeviceId = data[0].players[0].computerId;
    if (data[0].isPlaying === true) {
      for (let i = 0; i < data[0].players.length; i++) {
        if (data[0].players[i].computerId != deviceId) {
          const userButton = createUserButton(data[0].players[i].computerId, data[0].players[i].username);
          selectUserButtonContainer.appendChild(userButton);
        }
      }
      const partyGamemodeSettings = parseGameSettings(data[0].gameSettings)
      for (let i = 0; i < partyGamemodeSettings.length; i++) {
        let settingsButton;
        if (partyGamemodeSettings[i] == "take-a-shot") {
          settingsButton = createUserButton(partyGamemodeSettings[i], partyGamemodeSettings[i].replace(/-/g, " "));
        }
        else {
          settingsButton = createUserButton(partyGamemodeSettings[i], formatDashedString(partyGamemodeSettings[i], data[0].gamemode));
        }

        selectPunishmentButtonContainer.appendChild(settingsButton);
      }
      const selectUserButtons = document.getElementById('select-user-container').querySelectorAll('.selected-user-container .button-container button');
      const selectPunishmentButtons = document.getElementById('select-punishment-container').querySelectorAll('.selected-user-container .button-container button');

      selectUserButtons.forEach(button => {
        button.addEventListener('click', () => {
          selectUserButtons.forEach(btn => btn.classList.remove('active'));
          button.classList.add('active');
          selectUserButtonContainer.setAttribute('selected-id', button.getAttribute('id'));
        });
      });
      if (selectUserButtonContainer.length > 4) {
        selectUserButtonContainer.classList.add('overflow');
      }

      selectPunishmentButtons.forEach(button => {
        button.addEventListener('click', () => {
          selectPunishmentButtons.forEach(btn => btn.classList.remove('active'));
          selectPunishmentContainer.setAttribute('select-id', button.getAttribute('id'))
          button.classList.add('active');
        });
      });
      for (let i = 0; i < data[0].players.length; i++) {
        waitingForPlayersIconContainer.appendChild(createUserIcon(data[0].players[i].computerId));
        const icons = waitingForPlayersIconContainer.querySelectorAll('.icon');
        nextQuestionSectionContainer.appendChild(createUserIcon(data[0].players[i].computerId));
      }

      if (deviceId == hostDeviceId) {
        await SendInstruction({
          instruction: "DISPLAY_PUBLIC_CARD",
          updateUsersReady: false,
          updateUsersConfirmation: false,
          fetchInstruction: true
        });
      }
    }
  }
}
function GetVoteResults(currentPartyData) {
  const names = [];
  const values = [];

  for (let i = 0; i < currentPartyData.players.length; i++) {
    const username = currentPartyData.players[i].username;
    const voteValue = currentPartyData.players.filter(player => player.vote === currentPartyData.players[i].computerId).length;

    names.push(username);
    values.push(voteValue);
  }

  resultsChart.data.labels = names;
  resultsChart.data.datasets[0].data = values;
  resultsChart.update();
}

function ClearVotesResults() {
  const names = [];
  const values = [];

  resultsChart.data.labels = names;
  resultsChart.data.datasets[0].data = values;
  resultsChart.update();
}

function getHighestVoteValue(currentPartyData) {
  const voteCounts = {};

  for (let i = 0; i < currentPartyData.players.length; i++) {
    const computerId = currentPartyData.players[i].computerId;
    voteCounts[computerId] = GetVoteCount(currentPartyData, computerId);
  }

  const values = Object.values(voteCounts);
  const maxVote = Math.max(...values);
  const occurrences = values.filter(v => v === maxVote).length;

  return occurrences > 1 ? -maxVote : maxVote;
}

function GetVoteCount(currentPartyData, computerId) {
  return currentPartyData.players.filter(player => player.vote === computerId).length;
}

function GetHighestVoted(currentPartyData) {
  const highestVoteValue = -getHighestVoteValue(currentPartyData);
  return currentPartyData.players
    .filter(player => GetVoteCount(currentPartyData, player.computerId) === highestVoteValue)
    .map(player => player.computerId)
    .join(",");
}
function CountParsedString(parsedString) {
  if (!parsedString) return 0;
  return parsedString.split(",").filter(Boolean).length;
}

function GetStringAtIndex(votedString, index) {
  const stringList = votedString.split(",").filter(Boolean);
  return stringList[index] || null; // returns null if index is out of bounds
}


async function FetchInstructions() {
  const res = await fetch(`/api/${sessionPartyType}?partyCode=${partyCode}`);
  const data = await res.json();
  if (!data || data.length === 0) {
    PartyDisbanded();
    return;
  }

  if (data[0].userInstructions.includes("DISPLAY_PUBLIC_CARD")) {
    DisplayPublicCard();
  }
  else if (data[0].userInstructions.includes("DISPLAY_VOTE_RESULTS")) {
    DisplayVoteResults();
  }
  else if (data[0].userInstructions.includes("TIE_BREAKER_PUNISHMENT_OFFER")) {
    TieBreakerPunishmentOffer(data[0].userInstructions);
  }
  else if (data[0].userInstructions.includes("WAITING_FOR_PLAYER")) {
    WaitingForPlayer(data[0].userInstructions);
  }
  else if (data[0].userInstructions.includes("CHOSE_PUNISHMENT")) {
    ChosePunishment(data[0].userInstructions);
  }
  else if (data[0].userInstructions.includes("CHOOSING_PUNISHMENT")) {
    ChoosingPunishment(data[0].userInstructions);
  }
  else if (data[0].userInstructions.includes("DISPLAY_PUNISHMENT_TO_USER")) {
    DisplayPunishmentToUser(data[0].userInstructions);
  }
  else if (data[0].userInstructions.includes("PUNISHMENT_OFFER")) {
    PunishmentOffer(data[0].userInstructions);
  }
  else if (data[0].userInstructions.includes("HAS_USER_DONE_PUNISHMENT")) {
    HasUserDonePunishment(data[0].userInstructions);
  }
  else if (data[0].userInstructions.includes("ANSWER_TO_USER_DONE_PUNISHMENT")) {
    AnswerToUserDonePunishment();
  }
}

const ctxChart = document.getElementById('resultsChart').getContext('2d');

// Sample data
let names = ['Alvin', 'Jess', 'Sam', 'Taylor'];
let values = [3, 5, 2, 4];

const resultsChart = new Chart(ctxChart, {
  type: 'bar',
  data: {
    labels: names,
    datasets: [{
      data: values,
      backgroundColor: primaryColour,
      borderWidth: 0
    }]
  },
  options: {
    indexAxis: 'y', // 👈 makes the bars horizontal
    responsive: false,
    maintainAspectRatio: false,
    interaction: {
      mode: null
    },
    scales: {
      x: { // now x is the "value" axis
        beginAtZero: true,
        display: false,
        grid: {
          display: false,
          drawBorder: false
        },
        ticks: {
          display: false
        }
      },
      y: { // now y is the "name" axis
        grid: {
          display: false,
          drawBorder: false
        },
        ticks: {
          font: {
            family: 'LemonMilk',
            size: 16,
            weight: 'normal'
          },
          color: primaryColour
        }
      }
    },
    plugins: {
      legend: {
        display: false
      },
      datalabels: {
        color: backgroundColour,
        font: {
          family: 'LemonMilk',
          weight: 'normal',
          size: 20
        },
        formatter: function (value, context) {
          return value;
        },
        anchor: 'center',
        align: 'center'
      }
    }
  },
  plugins: [ChartDataLabels]
});