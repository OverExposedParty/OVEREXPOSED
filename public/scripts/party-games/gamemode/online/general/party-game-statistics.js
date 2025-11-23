let partyGameStatisticsButton;

let partyGameStatisticsContainer, partyGameStatisticsTitle, scoreboardContainer, partyGameStatisticsEndGameButton;
let gameOverContainer, gameOverTitle, mainMenuButton;

let podiumFirstPlace, podiumSecondPlace, podiumThirdPlace;

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
            console.log("END GAME BUTTON PRESSED");

            if (deviceId == hostDeviceId && isPlaying == true) {
                await SendInstruction({
                    instruction: "GAME_OVER",
                });
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
        gameOverContainer = document.getElementById('header-placeholder').querySelector('#game-over-container');
        gameOverTitle = gameOverContainer.querySelector('h1');
        mainMenuButton = gameOverContainer.querySelector('#button-main-menu');
        podiumFirstPlace = gameOverContainer.querySelector('.podium-point#first-place');
        podiumSecondPlace = gameOverContainer.querySelector('.podium-point#second-place');
        podiumThirdPlace = gameOverContainer.querySelector('.podium-point#third-place');

        mainMenuButton.addEventListener('click', () => {
            transitionSplashScreen('/', '/images/splash-screens/overexposed.png');
        });
    }).catch(error => {
        console.error('Error loading party game statistics template:', error);
    });

function SetPartyGameStatistics() {
    if (typeof currentPartyData == "undefined" || currentPartyData == null) return;
    for (let i = 0; i < currentPartyData.players.length; i++) {
        const playerStatisticContainer = document.createElement('div');
        playerStatisticContainer.classList.add('player-statistic');
        playerStatisticContainer.dataset.userId = currentPartyData.players[i].computerId;

        playerStatisticContainer.textContent = `${currentPartyData.players[i].username}: ${currentPartyData.players[i].score} pts`;
        scoreboardContainer.appendChild(playerStatisticContainer);
    }
    if (deviceId != hostDeviceId) {
        partyGameStatisticsEndGameButton.classList.add('disabled');
    }
}

async function UpdatePartyGameStatistics() {
    if (typeof currentPartyData == "undefined" || currentPartyData == null) return;
    const playerStatisticContainers = scoreboardContainer.querySelectorAll('.player-statistic');
    for (let i = 0; i < playerStatisticContainers.length; i++) {
        playerStatisticContainers[i].textContent = `${currentPartyData.players[i].username}: ${currentPartyData.players[i].score} pts`;
    }
}

function SetPartyGameStatisticsGameOver() {
    console.log("GAME IS OVER - SHOWING STATISTICS");
    const playersByStanding = GetPlayersByStanding();

    for (let i = 0; i < 3; i++) { //top 3 players
        const podiumContainer = i === 0 ? podiumFirstPlace : i === 1 ? podiumSecondPlace : podiumThirdPlace;
        if (playersByStanding[i]) {
            EditUserIconPartyGames({
                container: podiumContainer,
                userId: playersByStanding[i].computerId,
                userCustomisationString: playersByStanding[i].userIcon
            });
            console.log(`podium place ${i + 1}:`, podiumContainer);
        }
        else {
            podiumContainer.innerHTML = "";
        }
    }
    function getOrdinal(n) {
    if (n % 100 >= 11 && n % 100 <= 13) return n + "th";
    switch (n % 10) {
        case 1: return n + "st";
        case 2: return n + "nd";
        case 3: return n + "rd";
        default: return n + "th";
    }
}
    const gameOverScoresContainer = document.getElementById('game-over-scores-container');
    gameOverScoresContainer.innerHTML = "";

    const players = playersByStanding;
    const startRank = 1;
    const endRank = 14;
    const columns = 2;

    let displayPlayers = players.slice(startRank - 1, endRank);

    // Determine number of rows needed
    let rows = Math.ceil(displayPlayers.length / columns);

    // Add player elements
    displayPlayers.forEach((player, index) => {
        const div = document.createElement('div');
        div.classList.add('game-over-player-statistic');

        const rank = getOrdinal(index + startRank); // actual rank in the original list
        div.textContent = `[${rank}] ${player.username}: ${player.score} pts`;

        const row = Math.floor(index / columns) + 1;
        const col = (index % columns) + 1;

        div.style.gridRow = row;
        div.style.gridColumn = col;

        gameOverScoresContainer.appendChild(div);
    });

    // Add "trash" message if there are more than 18 players
    if (players.length > endRank) {
        const trashDiv = document.createElement('div');
        trashDiv.classList.add('game-over-player-statistic');
        trashDiv.textContent = "the rest of you are too trash to display";

        trashDiv.style.gridRow = rows + 1;
        trashDiv.style.gridColumn = `1 / span ${columns}`;
        trashDiv.style.textAlign = "center";

        gameOverScoresContainer.appendChild(trashDiv);
    }

    setActiveContainers();
    partyGameStatisticsEndGameButton.classList.remove('disabled');
    isPlaying = false;
    overlay.classList.add('active');
    gameOverContainer.classList.add('active');
    removeElementIfExists(settingsElementClassArray, partyGameStatisticsContainer);
    addElementIfNotExists(permanantElementClassArray, partyGameStatisticsContainer);
    if (deviceId == hostDeviceId) {
        DeleteParty();
    }
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

function GetPlayersByStanding() {
    try {
        if (!currentPartyData) return [];
        if (!Array.isArray(currentPartyData.players)) return [];

        return [...currentPartyData.players].sort((a, b) => b.score - a.score);

    } catch (err) {
        console.error("Error parsing currentPartyData:", err);
        return [];
    }
}
