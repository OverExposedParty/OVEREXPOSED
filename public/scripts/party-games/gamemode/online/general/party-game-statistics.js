let partyGameStatisticsButton;

let partyGameStatisticsContainer, partyGameStatisticsTitle, scoreboardContainer, partyGameStatisticsEndGameButton, partyGameStatisticsGameSettingsButton, partyGameStatisticsWaitingForHost, partyGameStatisticsMainMenuButton;
let partyGameStatisticsTabs, partyGameStatisticsResultsTab, partyGameStatisticsOpalsTab, partyGameStatisticsXpTab, partyGameStatisticsResultsPanel, partyGameStatisticsOpalsPanel, partyGameStatisticsXpPanel;
let partyGameRewardEmpty, partyGameRewardEmptyReason, partyGameRewardCompleted, partyGameRewardParticipation, partyGameRewardObjective, partyGameCapReductionRow, partyGameCapReductionLabel, partyGameCapReductionAmount, partyGameRewardTotal;
let partyGameXpEmpty, partyGameXpEmptyReason, partyGameXpLevelRow, partyGameXpCurrentLevel, partyGameXpLevelUp, partyGameXpLevelBefore, partyGameXpLevelAfter, partyGameXpProgress, partyGameXpProgressText, partyGameXpProgressTrack, partyGameXpProgressFill, partyGameXpTotalRow, partyGameXpTotal;
let scoreImpactFeed;
let partyGameScoreSnapshot = new Map();
let partyGameScoreImpactTimeouts = new Set();
let partyGamePreviousLeaderId = null;

initPartyGameStatisticsButton();
loadPartyGameStatisticsTemplate();

function initPartyGameStatisticsButton() {
    if (partyGameStatisticsButton?.isConnected) return partyGameStatisticsButton;

    partyGameStatisticsButton =
        document.getElementById('party-game-statistics-button') ||
        CreatePartyGameStatisticsButton(getPartyGameStatisticsGamemode());

    if (partyGameStatisticsButton.dataset.statisticsToggleReady !== 'true') {
        partyGameStatisticsButton.dataset.statisticsToggleReady = 'true';
        partyGameStatisticsButton.addEventListener('click', () => {
            window.dispatchEvent(new CustomEvent('oe-party-game-statistics-toggle'));
        });
    }

    if (window.__partyGameStatisticsToggleListenerReady !== true) {
        window.__partyGameStatisticsToggleListenerReady = true;
        window.addEventListener('oe-party-game-statistics-toggle', togglePartyGameStatisticsPanel);
    }

    return partyGameStatisticsButton;
}

function togglePartyGameStatisticsPanel() {
    if (!partyGameStatisticsContainer) {
        console.warn('Party game statistics panel is not ready yet.');
        return;
    }

    if (!isContainerVisible(partyGameStatisticsContainer)) {
        showContainer(partyGameStatisticsContainer);
        addElementIfNotExists(settingsElementClassArray, partyGameStatisticsContainer);
        toggleOverlay(true);
    } else {
        hideContainer(partyGameStatisticsContainer);
        removeElementIfExists(settingsElementClassArray, partyGameStatisticsContainer);
    }
}

function setPartyGameStatisticsButtonHidden(isHidden) {
    partyGameStatisticsButton =
        partyGameStatisticsButton ||
        document.getElementById('party-game-statistics-button');

    if (!partyGameStatisticsButton) return;
    partyGameStatisticsButton.hidden = Boolean(isHidden);
    partyGameStatisticsButton.setAttribute('aria-hidden', isHidden ? 'true' : 'false');
}

// Scoreboard template
function loadPartyGameStatisticsTemplate() {
    return fetch('/html-templates/party-games/party-game-statistics.html')
    .then(response => response.text())
    .then(data => {
        const statisticsTemplateMount = document.getElementById('header-placeholder') || document.body;
        statisticsTemplateMount.insertAdjacentHTML('beforeend', data);

        partyGameStatisticsContainer = statisticsTemplateMount.querySelector('#party-game-statistics-container');
        if (!partyGameStatisticsContainer) {
            throw new Error('Party game statistics container was not found after template load.');
        }

        partyGameStatisticsTitle = partyGameStatisticsContainer.querySelector('h1');
        scoreboardContainer = partyGameStatisticsContainer.querySelector('#scoreboard-container');
        partyGameStatisticsEndGameButton = partyGameStatisticsContainer.querySelector('#end-game');
        partyGameStatisticsGameSettingsButton = partyGameStatisticsContainer.querySelector('#statistics-game-settings');
        partyGameStatisticsWaitingForHost = partyGameStatisticsContainer.querySelector('#statistics-waiting-for-host');
        partyGameStatisticsMainMenuButton = partyGameStatisticsContainer.querySelector('#statistics-main-menu');
        partyGameStatisticsTabs = partyGameStatisticsContainer.querySelector('#game-over-tabs');
        partyGameStatisticsResultsTab = partyGameStatisticsContainer.querySelector('#game-over-results-tab');
        partyGameStatisticsOpalsTab = partyGameStatisticsContainer.querySelector('#game-over-opals-tab');
        partyGameStatisticsXpTab = partyGameStatisticsContainer.querySelector('#game-over-xp-tab');
        partyGameStatisticsResultsPanel = partyGameStatisticsContainer.querySelector('#game-over-results-panel');
        partyGameStatisticsOpalsPanel = partyGameStatisticsContainer.querySelector('#game-over-opals-panel');
        partyGameStatisticsXpPanel = partyGameStatisticsContainer.querySelector('#game-over-xp-panel');
        partyGameRewardEmpty = partyGameStatisticsContainer.querySelector('#game-over-reward-empty');
        partyGameRewardEmptyReason = partyGameStatisticsContainer.querySelector('#game-over-reward-empty-reason');
        partyGameRewardCompleted = partyGameStatisticsContainer.querySelector('#game-over-reward-completed');
        partyGameRewardParticipation = partyGameStatisticsContainer.querySelector('#game-over-reward-participation');
        partyGameRewardObjective = partyGameStatisticsContainer.querySelector('#game-over-reward-objective');
        partyGameCapReductionRow = partyGameStatisticsContainer.querySelector('#game-over-cap-reduction');
        partyGameCapReductionLabel = partyGameStatisticsContainer.querySelector('#game-over-cap-reduction-label');
        partyGameCapReductionAmount = partyGameStatisticsContainer.querySelector('#game-over-cap-reduction-amount');
        partyGameRewardTotal = partyGameStatisticsContainer.querySelector('#game-over-reward-total');
        partyGameXpEmpty = partyGameStatisticsContainer.querySelector('#game-over-xp-empty');
        partyGameXpEmptyReason = partyGameStatisticsContainer.querySelector('#game-over-xp-empty-reason');
        partyGameXpLevelRow = partyGameStatisticsContainer.querySelector('#game-over-xp-level-row');
        partyGameXpCurrentLevel = partyGameStatisticsContainer.querySelector('#game-over-xp-current-level');
        partyGameXpLevelUp = partyGameStatisticsContainer.querySelector('#game-over-xp-level-up');
        partyGameXpLevelBefore = partyGameStatisticsContainer.querySelector('#game-over-xp-level-before');
        partyGameXpLevelAfter = partyGameStatisticsContainer.querySelector('#game-over-xp-level-after');
        partyGameXpProgress = partyGameStatisticsContainer.querySelector('#game-over-xp-progress');
        partyGameXpProgressText = partyGameStatisticsContainer.querySelector('#game-over-xp-progress-text');
        partyGameXpProgressTrack = partyGameStatisticsContainer.querySelector('#game-over-xp-progress-track');
        partyGameXpProgressFill = partyGameStatisticsContainer.querySelector('#game-over-xp-progress-fill');
        partyGameXpTotalRow = partyGameStatisticsContainer.querySelector('#game-over-xp-total-row');
        partyGameXpTotal = partyGameStatisticsContainer.querySelector('#game-over-xp-total');
        scoreImpactFeed = typeof window.getOePopupFeed === 'function'
            ? window.getOePopupFeed()
            : statisticsTemplateMount.querySelector('#score-impact-feed');

        partyGameStatisticsMainMenuButton?.addEventListener('click', () => {
            if (typeof RemoveUserFromParty === 'function') {
                RemoveUserFromParty(deviceId, { exitIntent: 'main-menu' });
            }
            loadingPage = true;
            transitionSplashScreen('/', '/images/splash-screens/overexposed.png');
        });

        partyGameStatisticsResultsTab?.addEventListener('click', () => {
            setPartyGameStatisticsView('results');
        });

        partyGameStatisticsOpalsTab?.addEventListener('click', () => {
            setPartyGameStatisticsView('opals');
        });

        partyGameStatisticsXpTab?.addEventListener('click', () => {
            setPartyGameStatisticsView('xp');
        });

        partyGameStatisticsGameSettingsButton?.addEventListener('click', async () => {
            if (partyGameStatisticsGameSettingsButton.disabled) return;

            partyGameStatisticsGameSettingsButton.disabled = true;
            window.onlinePartyReturningToLobby = true;
            loadingPage = true;
            try {
                const updatedParty = await ReturnOnlinePartyToLobby();
                if (updatedParty) {
                    redirectOnlinePartyToLobby(updatedParty);
                } else {
                    window.onlinePartyReturningToLobby = false;
                    loadingPage = false;
                }
            } catch (error) {
                window.onlinePartyReturningToLobby = false;
                loadingPage = false;
                partyGameStatisticsGameSettingsButton.disabled = false;
                console.error('Failed to return party to game settings:', error);
            }
        });

        partyGameStatisticsEndGameButton?.addEventListener('click', async () => {
            debugLog("END GAME BUTTON PRESSED");

            updatePartyGameStatisticsEndGameButtonState();

            if (partyGameStatisticsEndGameButton.classList.contains('disabled')) {
                return;
            }

            try {
                const latestPartyData = await GetCurrentPartyData({ retries: 1 });
                if (latestPartyData) {
                    currentPartyData = latestPartyData;
                }

                updatePartyGameStatisticsEndGameButtonState(latestPartyData);

                if (partyGameStatisticsEndGameButton.classList.contains('disabled')) {
                    console.warn('End game skipped because this device is not the current host.');
                    return;
                }

                await EndOnlineGame();
            } catch (error) {
                console.error('Failed to end game:', error);
            }
        });

        renderPartyGameRewards(null);
        renderPartyGameXp(null);
    }).then(() => {
        document.addEventListener('pointerdown', dismissPartyGameScoreImpactFeed);
        setPartyGameStatisticsMode(getPartyGameStatisticsMode());
    }).catch(error => {
        console.error('Error loading party game statistics template:', error);
    });
}

function getPartyGameStatisticsGamemode() {
    return (
        document.getElementById('placeholder-card-container')?.dataset?.gamemode ||
        (typeof cardContainerGamemode !== 'undefined' ? cardContainerGamemode : '') ||
        (typeof gamemode !== 'undefined' ? gamemode : '')
    );
}

function getPartyGameStatisticsHostId(partyData) {
    const resolvedPartyData = partyData ?? (
        typeof currentPartyData !== 'undefined' ? currentPartyData : null
    );
    const fallbackHostId = typeof hostDeviceId !== 'undefined' ? hostDeviceId : null;
    return resolvedPartyData?.state?.hostComputerId ?? fallbackHostId;
}

function getPartyGameStatisticsMode(partyData) {
    const resolvedPartyData = partyData ?? (
        typeof currentPartyData !== 'undefined' ? currentPartyData : null
    );
    return resolvedPartyData?.state?.phase === 'game-over' ? 'game-over' : 'live';
}

function updatePartyGameStatisticsEndGameButtonState(partyData) {
    if (!partyGameStatisticsEndGameButton) return;

    const resolvedPartyData = partyData ?? (
        typeof currentPartyData !== 'undefined' ? currentPartyData : null
    );
    const authoritativeHostId = getPartyGameStatisticsHostId(resolvedPartyData);
    if (authoritativeHostId) {
        hostDeviceId = authoritativeHostId;
    }

    const canEndGame =
        typeof isPlaying !== 'undefined' &&
        isPlaying === true &&
        authoritativeHostId &&
        typeof deviceId !== 'undefined' &&
        String(deviceId) === String(authoritativeHostId);

    partyGameStatisticsEndGameButton.classList.toggle('disabled', !canEndGame);

    const isGameOver = resolvedPartyData?.state?.phase === 'game-over';
    const isCurrentHost =
        authoritativeHostId &&
        typeof deviceId !== 'undefined' &&
        String(deviceId) === String(authoritativeHostId);
    if (partyGameStatisticsGameSettingsButton) {
        partyGameStatisticsGameSettingsButton.hidden = !isGameOver || !isCurrentHost;
    }
    if (partyGameStatisticsWaitingForHost) {
        partyGameStatisticsWaitingForHost.hidden = !isGameOver || Boolean(isCurrentHost);
    }
}

function SetPartyGameStatistics() {
    if (typeof currentPartyData == "undefined" || currentPartyData == null) return;
    if (!Array.isArray(currentPartyData.players)) return;

    setPartyGameStatisticsMode(getPartyGameStatisticsMode(currentPartyData));
    renderPartyGameScoreboard();
    const rewardSummary = getCurrentPlayerPartyGameRewardSummary();
    renderPartyGameRewards(rewardSummary);
    renderPartyGameXp(rewardSummary);
    partyGameScoreSnapshot = getPartyGameScoreSnapshot();
    partyGamePreviousLeaderId = getPartyGameLeaderId();

    updatePartyGameStatisticsEndGameButtonState();
}

async function UpdatePartyGameStatistics() {
    if (typeof currentPartyData == "undefined" || currentPartyData == null) return;
    if (!Array.isArray(currentPartyData.players)) return;

    const previousScores = partyGameScoreSnapshot;
    const previousLeaderId = partyGamePreviousLeaderId;
    const scoreDeltas = getPartyGameScoreDeltas(previousScores);

    renderPartyGameScoreboard();
    const rewardSummary = getCurrentPlayerPartyGameRewardSummary();
    renderPartyGameRewards(rewardSummary);
    renderPartyGameXp(rewardSummary);
    partyGameScoreSnapshot = getPartyGameScoreSnapshot();
    partyGamePreviousLeaderId = getPartyGameLeaderId();

    if (scoreDeltas.length > 0) {
        ShowPartyGameScoreImpact(scoreDeltas, previousLeaderId);
    }

    updatePartyGameStatisticsEndGameButtonState();
}

function SetPartyGameStatisticsGameOver(options = {}) {
    debugLog("GAME IS OVER - SHOWING STATISTICS");
    hidePartyGameScoreImpact();

    setPartyGameStatisticsMode('game-over', options);
    renderPartyGameScoreboard();
    const rewardSummary = getCurrentPlayerPartyGameRewardSummary();
    renderPartyGameRewards(rewardSummary);
    renderPartyGameXp(rewardSummary);
    partyGameScoreSnapshot = getPartyGameScoreSnapshot();
    partyGamePreviousLeaderId = getPartyGameLeaderId();

    setActiveContainers();

    // Local client flag
    isPlaying = false;

    // Try to mirror into nested state too (for consistency)
    const resolvedPartyData = typeof currentPartyData !== 'undefined' ? currentPartyData : null;
    if (resolvedPartyData?.state) {
        resolvedPartyData.state.isPlaying = false;
        resolvedPartyData.state.phase = 'game-over';
    }

    window.setTimeout(() => window.checkActiveLobby?.(), 0);

    setPartyGameStatisticsButtonHidden(true);
    removeAllElements(popUpClassArray);
    removeAllElements(settingsElementClassArray);
    removeAllElements(elementClassArray);
    removeElementIfExists(settingsElementClassArray, partyGameStatisticsContainer);
    addElementIfNotExists(permanantElementClassArray, partyGameStatisticsContainer);
    showContainer(partyGameStatisticsContainer);
    toggleOverlay(true);
}

function setPartyGameStatisticsMode(mode = 'live', options = {}) {
    const isGameOver = mode === 'game-over';
    const authoritativeHostId = getPartyGameStatisticsHostId();
    const isCurrentHost =
        authoritativeHostId &&
        typeof deviceId !== 'undefined' &&
        String(deviceId) === String(authoritativeHostId);

    if (partyGameStatisticsTitle) {
        partyGameStatisticsTitle.textContent = isGameOver
            ? (options.title || 'Game Over')
            : 'Party Game Statistics';
    }

    setPartyGameStatisticsButtonHidden(isGameOver);

    if (partyGameStatisticsEndGameButton) {
        partyGameStatisticsEndGameButton.hidden = isGameOver;
    }

    if (partyGameStatisticsMainMenuButton) {
        partyGameStatisticsMainMenuButton.hidden = !isGameOver;
    }

    if (partyGameStatisticsGameSettingsButton) {
        partyGameStatisticsGameSettingsButton.hidden = !isGameOver || !isCurrentHost;
        partyGameStatisticsGameSettingsButton.disabled = false;
    }

    if (partyGameStatisticsWaitingForHost) {
        partyGameStatisticsWaitingForHost.hidden = !isGameOver || Boolean(isCurrentHost);
    }

    if (partyGameStatisticsTabs) {
        partyGameStatisticsTabs.hidden = !isGameOver;
    }

    setPartyGameStatisticsView('results');

    partyGameStatisticsContainer?.classList.toggle('game-over-statistics', isGameOver);
}

function setPartyGameStatisticsView(view = 'results') {
    const showOpals = view === 'opals';
    const showXp = view === 'xp';
    const showResults = !showOpals && !showXp;

    if (partyGameStatisticsResultsPanel) {
        partyGameStatisticsResultsPanel.hidden = !showResults;
    }
    if (partyGameStatisticsOpalsPanel) {
        partyGameStatisticsOpalsPanel.hidden = !showOpals;
    }
    if (partyGameStatisticsXpPanel) {
        partyGameStatisticsXpPanel.hidden = !showXp;
    }

    if (partyGameStatisticsResultsTab) {
        partyGameStatisticsResultsTab.classList.toggle('active', showResults);
        partyGameStatisticsResultsTab.setAttribute('aria-selected', String(showResults));
    }
    if (partyGameStatisticsOpalsTab) {
        partyGameStatisticsOpalsTab.classList.toggle('active', showOpals);
        partyGameStatisticsOpalsTab.setAttribute('aria-selected', String(showOpals));
    }
    if (partyGameStatisticsXpTab) {
        partyGameStatisticsXpTab.classList.toggle('active', showXp);
        partyGameStatisticsXpTab.setAttribute('aria-selected', String(showXp));
    }
}
