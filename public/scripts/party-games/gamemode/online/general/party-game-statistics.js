let partyGameStatisticsButton;

let partyGameStatisticsContainer, partyGameStatisticsTitle, scoreboardContainer, partyGameStatisticsEndGameButton;

// Scoreboard template
fetch('/html-templates/party-games/party-game-statistics.html')
    .then(response => response.text())
    .then(data => {
        document.getElementById('header-placeholder').insertAdjacentHTML('beforeend', data);

        partyGameStatisticsContainer = document.getElementById('header-placeholder').querySelector('#party-game-statistics-container');
        partyGameStatisticsTitle = partyGameStatisticsContainer.querySelector('h1');
        scoreboardContainer = partyGameStatisticsContainer.querySelector('#scoreboard-container');
        partyGameStatisticsEndGameButton = partyGameStatisticsContainer.querySelector('#end-game');

        partyGameStatisticsEndGameButton.addEventListener('click', async () => {
            if (deviceId == hostDeviceId && isPlaying == true) {
                await SendInstruction({
                    instruction: "GAME_OVER",
                    isPlaying: false
                });
            }
            else if (isPlaying == false) {
                transitionSplashScreen('/', '/images/splash-screens/overexposed.png');
            }
        });

        partyGameStatisticsButton = CreatePartyGameStatisticsButton(cardContainerGamemode);

        partyGameStatisticsButton.addEventListener('click', () => {
            partyGameStatisticsContainer.classList.toggle('active');
            if (partyGameStatisticsContainer.classList.contains('active')) {
                addElementIfNotExists(settingsElementClassArray, partyGameStatisticsContainer);
                overlay.classList.add('active');
            }
        })
    }).then(() => {
        SetPartyGameStatistics();
    })

async function SetPartyGameStatistics() {
    const currentPartyData = await GetCurrentPartyData();
    for (let i = 0; i < currentPartyData.players.length; i++) {
        const playerStatisticContainer = document.createElement('div');
        playerStatisticContainer.classList.add('player-statistic');
        playerStatisticContainer.dataset.userId = currentPartyData.players[i].computerId;

        playerStatisticContainer.textContent = `${currentPartyData.players[i].username}: ${currentPartyData.players[i].score} points`;
        scoreboardContainer.appendChild(playerStatisticContainer);
    }
    if (deviceId != hostDeviceId) {
        partyGameStatisticsEndGameButton.classList.add('disabled');
    }
}

async function UpdatePartyGameStatistics() {
    const currentPartyData = await GetCurrentPartyData();
    const playerStatisticContainers = scoreboardContainer.querySelectorAll('.player-statistic');
    for (let i = 0; i < playerStatisticContainers.length; i++) {
        playerStatisticContainers[i].textContent = `${currentPartyData.players[i].username}: ${currentPartyData.players[i].score} points`;
    }
}

function SetPartyGameStatisticsGameOver() {
    if (deviceId == hostDeviceId) {
        DeleteParty();
    }
    setActiveContainers();
    partyGameStatisticsEndGameButton.classList.remove('disabled');
    isPlaying = false;
    partyGameStatisticsTitle.textContent = "Game Over";
    partyGameStatisticsEndGameButton.textContent = "MAIN MENU";
    overlay.classList.add('active');
    partyGameStatisticsContainer.classList.add('active');
    removeElementIfExists(settingsElementClassArray, partyGameStatisticsContainer);
    addElementIfNotExists(permanantElementClassArray, partyGameStatisticsContainer);
}

function CreatePartyGameStatisticsButton(gamemode) {
    // Create button
    const button = document.createElement("button");
    button.className = "party-game-statistics-button";
    button.setAttribute("data-gamemode", gamemode);

    // Create image
    const img = document.createElement("img");
    img.src = `/images/icons/${gamemode}/party-game-statistics-icon.svg`;
    img.alt = "Statistics Icon";

    // Append image to button
    button.appendChild(img);
    document.body.appendChild(button);

    return button;
}