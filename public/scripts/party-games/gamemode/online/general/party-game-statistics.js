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
            const isVisible = toggleContainerVisibility(
                partyGameStatisticsContainer,
                !isContainerVisible(partyGameStatisticsContainer)
            );
            if (isVisible) {
                addElementIfNotExists(settingsElementClassArray, partyGameStatisticsContainer);
                showContainer(overlay);
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
    if (!Array.isArray(currentPartyData.players)) return;

    scoreboardContainer.innerHTML = "";

    for (let i = 0; i < currentPartyData.players.length; i++) {
        const player = currentPartyData.players[i];
        const id = getPlayerId(player);
        const username = getPlayerUsername(player);
        const score = getPlayerScore(player);

        const playerStatisticContainer = document.createElement('div');
        playerStatisticContainer.classList.add('player-statistic');
        playerStatisticContainer.dataset.userId = id;

        playerStatisticContainer.textContent = `${username}: ${score} pts`;
        scoreboardContainer.appendChild(playerStatisticContainer);
    }
    if (deviceId != hostDeviceId) {
        partyGameStatisticsEndGameButton.classList.add('disabled');
    }
}

async function UpdatePartyGameStatistics() {
    if (typeof currentPartyData == "undefined" || currentPartyData == null) return;
    if (!Array.isArray(currentPartyData.players)) return;

    const playerStatisticContainers = scoreboardContainer.querySelectorAll('.player-statistic');

    for (let i = 0; i < playerStatisticContainers.length; i++) {
        const player = currentPartyData.players[i];
        if (!player) continue;

        const username = getPlayerUsername(player);
        const score = getPlayerScore(player);

        playerStatisticContainers[i].textContent = `${username}: ${score} pts`;
    }
}

function SetPartyGameStatisticsGameOver() {
    console.log("GAME IS OVER - SHOWING STATISTICS");
    const playersByStanding = GetPlayersByStanding();

    // Podium icons
    for (let i = 0; i < 3; i++) { // top 3 players
        const podiumContainer = i === 0 ? podiumFirstPlace : i === 1 ? podiumSecondPlace : podiumThirdPlace;
        if (playersByStanding[i]) {
            const player = playersByStanding[i];
            const id = getPlayerId(player);
            const icon = getPlayerIcon(player);

            EditUserIconPartyGames({
                container: podiumContainer,
                userId: id,
                userCustomisationString: icon
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

        const username = getPlayerUsername(player);
        const score = getPlayerScore(player);

        const rank = getOrdinal(index + startRank); // actual rank in the original list
        div.textContent = `[${rank}] ${username}: ${score} pts`;

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

    // Local client flag
    isPlaying = false;

    // Try to mirror into nested state too (for consistency)
    if (currentPartyData.state) {
        currentPartyData.state.isPlaying = false;
    }

    showContainer(overlay);
    showContainer(gameOverContainer);
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

    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("viewBox", "0 0 485 485");
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", "Statistics Icon");

    const rootGroup = document.createElementNS(svgNS, "g");
    const group = document.createElementNS(svgNS, "g");

    const outerCircle = document.createElementNS(svgNS, "circle");
    outerCircle.setAttribute("cx", "242.5");
    outerCircle.setAttribute("cy", "242.5");
    outerCircle.setAttribute("r", "225");
    outerCircle.setAttribute("fill", "#1f1f1f");
    outerCircle.setAttribute("stroke", "var(--primarypagecolour)");
    outerCircle.setAttribute("stroke-miterlimit", "10");
    outerCircle.setAttribute("stroke-width", "35px");

    const barOne = document.createElementNS(svgNS, "rect");
    barOne.setAttribute("x", "130");
    barOne.setAttribute("y", "205");
    barOne.setAttribute("width", "75");
    barOne.setAttribute("height", "100");
    barOne.setAttribute("fill", "var(--secondarypagecolour)");

    const barTwo = document.createElementNS(svgNS, "rect");
    barTwo.setAttribute("x", "205");
    barTwo.setAttribute("y", "180");
    barTwo.setAttribute("width", "75");
    barTwo.setAttribute("height", "125");
    barTwo.setAttribute("fill", "var(--primarypagecolour)");

    const barThree = document.createElementNS(svgNS, "rect");
    barThree.setAttribute("x", "280");
    barThree.setAttribute("y", "230");
    barThree.setAttribute("width", "75");
    barThree.setAttribute("height", "75");
    barThree.setAttribute("fill", "var(--secondarypagecolour)");

    group.appendChild(barOne);
    group.appendChild(barTwo);
    group.appendChild(barThree);

    rootGroup.appendChild(outerCircle);
    rootGroup.appendChild(group);
    svg.appendChild(rootGroup);
    button.appendChild(svg);
    document.body.appendChild(button);

    return button;
}

function GetPlayersByStanding() {
    try {
        if (!currentPartyData) return [];
        if (!Array.isArray(currentPartyData.players)) return [];

        return [...currentPartyData.players].sort((a, b) => {
            const scoreA = getPlayerScore(a);
            const scoreB = getPlayerScore(b);
            return scoreB - scoreA;
        });

    } catch (err) {
        console.error("Error parsing currentPartyData:", err);
        return [];
    }
}

/* ──────────────────────────────────────────────
   HELPERS FOR NESTED/LEGACY PLAYER SHAPES
────────────────────────────────────────────── */

function getPlayerScore(player) {
    if (player?.state && typeof player.state.score === 'number') {
        return player.state.score;
    }
    if (typeof player?.score === 'number') {
        return player.score;
    }
    return 0;
}
