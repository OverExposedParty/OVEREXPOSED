let isHeads = false;
let hostDeviceId = "";

const url = window.location.href;
const segments = url.split('/');
partyCode = segments.pop() || segments.pop(); // handle trailing slash


const resultsChartContainer = document.getElementById('results-container');
const waitingForPlayersContainer = document.getElementById('waiting-for-confirm-punishment-container')
const waitingForPlayersIconContainer = waitingForPlayersContainer.querySelector('.content-container .user-confirmed-section');

const gameContainerPublic = document.querySelector('#public-view.card-container');

const selectOptionContainer = document.getElementById('select-option-container');
const selectOptionContainerQuestionText = selectOptionContainer.querySelector('.content-container h2');
const selectOptionButtonContainer = selectOptionContainer.querySelector('.select-button-container');
const selectOptionConfirmButtonYes = selectOptionButtonContainer.querySelector('#yes');
const selectOptionConfirmButtonNo = selectOptionButtonContainer.querySelector('#no');
const buttonChooseOption = document.getElementById('button-choose-option');

const completePunishmentContainer = document.getElementById('complete-punishment-container');
const completePunishmentButtonConfirm = completePunishmentContainer.querySelector('.select-button-container #confirm');

const waitingForPlayerContainer = document.getElementById('waiting-for-player');
const waitingForPlayerTitle = waitingForPlayerContainer.querySelector('.content-container h2')
const waitingForPlayerText = waitingForPlayerContainer.querySelector('.content-container p')

const drinkingWheelContainer = document.querySelector('#spin-the-wheel-container');


gameContainers.push(
  waitingForPlayersContainer,
  gameContainerPublic,
  completePunishmentContainer,
  drinkingWheelContainer,
  selectOptionContainer,
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

buttonChooseOption.addEventListener('click', () => {
  setActiveContainers(selectOptionContainer);
  setUserBool(deviceId, null, true)
});

selectOptionConfirmButtonYes.addEventListener('click', async () => {
  await SetVote({
    option: true
  });
});
selectOptionConfirmButtonNo.addEventListener('click', async () => {
  await SetVote({
    option: false
  });
});

completePunishmentButtonConfirm.addEventListener('click', () => {
  setUserBool(deviceId, true, true);
});


document.addEventListener('DOMContentLoaded', async () => {
  const existingData = await getExistingPartyData(partyCode);
  if (!existingData || existingData.length === 0) {
    console.warn('No party data found.');
    return;
  }
  const currentPartyData = existingData[0];

  await loadJSONFiles(currentPartyData.selectedPacks, currentPartyData.shuffleSeed);
  initialisePage();
});

function updateTextContainer(text, cardType) {

  const textContainerPublic = document.querySelector('#public-view .text-container');

  textContainerPublic.textContent = text;
  selectOptionContainerQuestionText.textContent = text.replace("Never have I ever ", "");

  const searchPackName = cardType.toLowerCase();

  // Find the matching pack based on the cardType
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
  const currentPartyData = data[0];
  if (data.length > 0) {
    joinParty(partyCode);
    hostDeviceId = data[0].players[0].computerId;
    if (data[0].isPlaying === true) {
      for (let i = 0; i < data[0].players.length; i++) {
        waitingForPlayersIconContainer.appendChild(createUserIcon(data[0].players[i].computerId));
        const icons = waitingForPlayersIconContainer.querySelectorAll('.icon');
      }
      if (deviceId == hostDeviceId) {
        const index = currentPartyData.players.findIndex(player => player.computerId === deviceId);
        let voteString = "";
        for (let i = 0; i < data[0].players.length; i++) {
          voteString += "0";
          if (i < data[0].players.length - 1) {
            voteString += ";";
          }
        }
        await SendInstruction({
          instruction: "DISPLAY_PUBLIC_CARD:" + voteString + ":",
          updateUsersReady: false,
          updateUsersConfirmation: false,
          fetchInstruction: true
        });
      }
    }
  }
}

async function FetchInstructions() {
  const res = await fetch(`/api/${sessionPartyType}?partyCode=${partyCode}`);
  const data = await res.json();
  if (!data || data.length === 0) {
    PartyDisbanded();
    return;
  }

  if (data[0].userInstructions.includes("DISPLAY_PUBLIC_CARD")) {
    DisplayPublicCard(data[0].userInstructions);
  }
  else if (data[0].userInstructions.includes("DISPLAY_VOTE_RESULTS")) {
    DisplayVoteResults(data[0].userInstructions);
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
}

const ctxChart = document.getElementById('resultsChart').getContext('2d');
let haveVotes = [];
let haveNeverVotes = [];

const resultsChart = new Chart(ctxChart, {
  type: 'bar',
  data: {
    labels: ['Have', 'Have Never'],
    datasets: [{
      data: [haveVotes.length, haveNeverVotes.length],
      backgroundColor: [primaryColour, secondaryColour],
      borderWidth: 0
    }]
  },
  options: {
    responsive: false,
    maintainAspectRatio: false,
    interaction: {
      mode: null
    },
    scales: {
      y: {
        display: false,
        grid: {
          display: false,
          drawBorder: false
        },
        ticks: {
          display: false
        }
      },
      x: {
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
          callback: function (value, index) {
            return this.getLabelForValue(value);
          },
          color: function (context) {
            const index = context.index;
            return index === 0 ? primaryColour : secondaryColour;
          }
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
          const index = context.dataIndex;
          const names = index === 0 ? haveVotes : haveNeverVotes;
          return names.join('\n');
        },
        anchor: 'center',
        align: 'center'
      }
    }
  },
  plugins: [ChartDataLabels]
});
