function GetPlayersByStanding() {
    try {
        const players = getPartyGameScoreboardPlayers();
        if (!Array.isArray(players)) return [];

        return [...players].sort((a, b) => {
            const scoreA = getPlayerScore(a);
            const scoreB = getPlayerScore(b);
            return scoreB - scoreA;
        });

    } catch (err) {
        console.error("Error parsing currentPartyData:", err);
        return [];
    }
}

function renderPartyGameScoreboard() {
    if (!scoreboardContainer) return;

    const previousPositions = getPartyGameScoreboardRowPositions();
    const activeIds = new Set();
    const playersByStanding = GetPlayersByStanding();

    scoreboardContainer.classList.toggle('many-players', playersByStanding.length > 5);

    playersByStanding.forEach((player, index) => {
        const id = getPlayerId(player);
        if (!id) return;

        activeIds.add(String(id));
        const playerStatisticContainer = getOrCreatePartyGameStatisticRow(player);
        updatePartyGameStatisticRow(playerStatisticContainer, player, index);
        scoreboardContainer.appendChild(playerStatisticContainer);
    });

    scoreboardContainer.querySelectorAll('.player-statistic').forEach(row => {
        if (!activeIds.has(String(row.dataset.userId))) {
            row.remove();
        }
    });

    animatePartyGameScoreboardRows(previousPositions);
}

function getOrCreatePartyGameStatisticRow(player) {
    const id = String(getPlayerId(player));
    let playerStatisticContainer = [...scoreboardContainer.querySelectorAll('.player-statistic')]
        .find(row => String(row.dataset.userId) === id);

    if (playerStatisticContainer) {
        return playerStatisticContainer;
    }

    playerStatisticContainer = document.createElement('div');
    playerStatisticContainer.classList.add('player-statistic');
    playerStatisticContainer.dataset.userId = id;

    const rank = document.createElement('span');
    rank.className = 'player-statistic-rank';

    const avatar = document.createElement('div');
    avatar.className = 'player-statistic-avatar';

    const icon = document.createElement('div');
    icon.className = 'icon';
    icon.dataset.userId = id;

    const imageStack = document.createElement('div');
    imageStack.className = 'image-stack';

    ['colour', 'head-slot', 'eyes-slot', 'mouth-slot'].forEach(slot => {
        const img = document.createElement('img');
        img.id = slot;
        img.alt = '';
        img.src = getBlankPartyGameStatisticIconPath(slot);
        imageStack.appendChild(img);
    });

    icon.appendChild(imageStack);
    avatar.appendChild(icon);

    const name = document.createElement('span');
    name.className = 'player-statistic-name';

    const points = document.createElement('span');
    points.className = 'player-statistic-score';

    playerStatisticContainer.appendChild(rank);
    playerStatisticContainer.appendChild(avatar);
    playerStatisticContainer.appendChild(name);
    playerStatisticContainer.appendChild(points);

    return playerStatisticContainer;
}

function updatePartyGameStatisticRow(playerStatisticContainer, player, index) {
    if (!playerStatisticContainer) return;

    const id = getPlayerId(player);
    const username = getPlayerUsername(player);
    const score = getPlayerScore(player);

    playerStatisticContainer.dataset.userId = id;
    playerStatisticContainer.querySelector('.player-statistic-rank').textContent = `${index + 1}`;
    playerStatisticContainer.querySelector('.player-statistic-name').textContent = username;
    playerStatisticContainer.querySelector('.player-statistic-score').textContent = `${score} pts`;

    const icon = playerStatisticContainer.querySelector('.icon');
    if (icon) {
        icon.dataset.userId = id;
    }

    if (typeof EditUserIconPartyGames === 'function') {
        EditUserIconPartyGames({
            container: playerStatisticContainer.querySelector('.player-statistic-avatar'),
            userId: id,
            userCustomisationString: getPlayerIcon(player)
        });
    }
}

function getPartyGameScoreboardRowPositions() {
    const positions = new Map();
    if (!scoreboardContainer) return positions;

    scoreboardContainer.querySelectorAll('.player-statistic').forEach(row => {
        if (!row.dataset.userId) return;
        positions.set(String(row.dataset.userId), row.getBoundingClientRect());
    });

    return positions;
}

function animatePartyGameScoreboardRows(previousPositions) {
    if (!previousPositions || previousPositions.size === 0) return;

    scoreboardContainer.querySelectorAll('.player-statistic').forEach(row => {
        const previousPosition = previousPositions.get(String(row.dataset.userId));
        if (!previousPosition) return;

        const nextPosition = row.getBoundingClientRect();
        const deltaY = previousPosition.top - nextPosition.top;

        if (deltaY === 0) return;

        row.style.transition = 'none';
        row.style.transform = `translateY(${deltaY}px)`;

        requestAnimationFrame(() => {
            row.style.transition = 'transform 320ms ease';
            row.style.transform = '';
        });
    });
}

function getBlankPartyGameStatisticIconPath(slot) {
    switch (slot) {
        case 'colour':
            return '/images/user-customisation/colour/blank/blank-colour.svg';
        case 'head-slot':
            return '/images/user-customisation/head-slot/blank/no-head-slot.svg';
        case 'eyes-slot':
            return '/images/user-customisation/eyes-slot/blank/no-eyes-slot.svg';
        case 'mouth-slot':
            return '/images/user-customisation/mouth-slot/blank/no-mouth-slot.svg';
        default:
            return '';
    }
}

function getPartyGameScoreSnapshot() {
    const snapshot = new Map();
    const players = getPartyGameScoreboardPlayers();
    if (!Array.isArray(players)) return snapshot;

    players.forEach(player => {
        const id = getPlayerId(player);
        if (!id) return;
        snapshot.set(String(id), getPlayerScore(player));
    });

    return snapshot;
}

function getPartyGameScoreDeltas(previousScores = new Map()) {
    if (!previousScores || previousScores.size === 0) return [];
    const players = getPartyGameScoreboardPlayers();
    if (!Array.isArray(players)) return [];

    const previousRanks = getPartyGameRankMap(previousScores);
    const currentRanks = getPartyGameRankMap(getPartyGameScoreSnapshot());

    return players
        .map(player => {
            const id = getPlayerId(player);
            if (!id) return null;

            const key = String(id);
            if (!previousScores.has(key)) return null;

            const score = getPlayerScore(player);
            const previousScore = previousScores.get(key);
            const delta = score - previousScore;

            if (delta === 0) return null;

            const previousRank = previousRanks.get(key) ?? null;
            const currentRank = currentRanks.get(key) ?? null;
            const rankDelta =
                previousRank !== null && currentRank !== null
                    ? previousRank - currentRank
                    : 0;

            return {
                id: key,
                player,
                username: getPlayerUsername(player),
                score,
                previousScore,
                delta,
                previousRank,
                currentRank,
                rankDelta
            };
        })
        .filter(Boolean)
        .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
}

function getPartyGameRankMap(scoreSnapshot = new Map()) {
    const rankMap = new Map();
    const players = getPartyGameScoreboardPlayers();
    if (!Array.isArray(players)) return rankMap;

    [...players]
        .filter(player => scoreSnapshot.has(String(getPlayerId(player))))
        .sort((a, b) => {
            const scoreA = scoreSnapshot.get(String(getPlayerId(a))) ?? 0;
            const scoreB = scoreSnapshot.get(String(getPlayerId(b))) ?? 0;
            return scoreB - scoreA;
        })
        .forEach((player, index) => {
            rankMap.set(String(getPlayerId(player)), index + 1);
        });

    return rankMap;
}

function getPartyGameLeaderId() {
    const leader = GetPlayersByStanding()[0];
    return leader ? String(getPlayerId(leader)) : null;
}

function getPartyGameScoreboardPlayers() {
    const resolvedPartyData = typeof currentPartyData !== 'undefined' ? currentPartyData : null;
    if (!resolvedPartyData) return [];

    const gameOverPlayers = resolvedPartyData?.state?.phaseData?.gameOverPlayers;
    if (
        resolvedPartyData?.state?.phase === 'game-over' &&
        Array.isArray(gameOverPlayers) &&
        gameOverPlayers.length > 0
    ) {
        return gameOverPlayers;
    }

    return Array.isArray(resolvedPartyData.players) ? resolvedPartyData.players : [];
}
