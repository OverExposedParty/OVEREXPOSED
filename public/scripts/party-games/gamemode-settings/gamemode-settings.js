let gamemodeSettings;
let gamemodeSelectedPacks = "";
let allUsersReady = undefined;

if (partyGameMode == "never-have-i-ever") {
    gamemodeSettings = "take-a-sip,";
}
else {
    gamemodeSettings = "take-a-shot,";
}

let eighteenPlusEnabled = localStorage.getItem('settings-nsfw') === 'true';

const startGameButton = document.querySelector('.start-game-button');
const warningBox = document.getElementById('warning-box');
const warningStartButton = document.querySelector('.start-game-warning-button');

const inputPartyCode = document.getElementById('party-code');

function updateStartGameButton(allUsersReady) {
    if (typeof allUsersReady !== 'undefined') {
        if (allUsersReady && CheckErrors()) {
            startGameButton.classList.remove('disabled');
        }
        else {
            startGameButton.classList.add('disabled');
        }
        console.log(startGameButton.classList.contains('disabled'));
        return;
    }

    const anyActive = Array.from(packButtons).some(button => button.classList.contains('active'));
    setError(errorNoPacksSelected, !anyActive)
    startGameButton.classList.toggle('disabled', !anyActive);
    startGameButton.style.pointerEvents = anyActive ? 'auto' : 'none';
}

function SetGamemodeButtons() {
    if (eighteenPlusEnabled) {
        nsfwButtons.forEach(button => {
            button.disabled = false;
            button.classList.remove('disabled');

            const key = button.getAttribute('data-key');
            if (!localStorage.getItem(key)) {
                localStorage.setItem(key, 'false');
            }
        });
        gameSettingsNsfwButtons.forEach(button => {
            button.disabled = false;
            button.classList.remove('disabled');

            const key = button.getAttribute('data-key');
            if (!localStorage.getItem(key)) {
                localStorage.setItem(key, 'false');
            }
        });
    }
    else {
        nsfwButtons.forEach(button => {
            button.disabled = true;
            button.classList.add('disabled');
            button.classList.remove('active');

            const key = button.getAttribute('data-key');
            localStorage.setItem(key, 'false');
        });
        gameSettingsNsfwButtons.forEach(button => {
            button.disabled = true;
            button.classList.add('disabled');
            button.classList.remove('active');

            localStorage.setItem(button.getAttribute('data-key'), 'false');
        });
    }
    if (partyCode) {
        onlingSettingsButtons.forEach(button => {
            button.disabled = false;
            button.classList.remove('disabled');
        });
    }
    else {
        onlingSettingsButtons.forEach(button => {
            button.disabled = false;
            button.classList.add('disabled');
            button.classList.remove('active');
        });
    }
}
function SetGameSettingsButtons() {
    placeholderGamemodeSettings.querySelectorAll('button').forEach(button => {
        const key = button.getAttribute('data-key');
        const savedState = localStorage.getItem(key);

        if (key && savedState === 'true') {
            button.classList.add('active');
            if (button.closest('.game-settings-container')) {
                if (!button.classList.contains('online')) {
                    gamemodeSettings += key + ',';
                }
            }
            else if (button.closest('.packs-content-container')) {
                gamemodeSelectedPacks += key + ',';
            }
            if (partyCode) {
                updateOnlineParty({
                    partyId,
                    gameSettings: gamemodeSettings,
                    selectedPacks: gamemodeSelectedPacks,
                    lastPinged: new Date(),
                });
            }
        }

        else if (key && savedState === 'false') {
            button.classList.remove('active');
        }
        button.addEventListener('click', () => {
            if (!button.disabled) {
                button.classList.toggle('active');
                const key = button.getAttribute('data-key');
                const isActive = button.classList.contains('active');
                if (button.getAttribute('data-key')) {
                    localStorage.setItem(key, isActive ? 'true' : 'false');
                    if (isActive) {
                        if (button.closest('.game-settings-container')) {
                            gamemodeSettings += key + ',';
                        }
                        else if (button.closest('.packs-content-container')) {
                            gamemodeSelectedPacks += key + ',';
                        }
                    }
                    else {
                        if (button.closest('.game-settings-container')) {
                            if (gamemodeSettings.includes(key + ',')) {
                                gamemodeSettings = gamemodeSettings.replace(key + ',', '');
                            }
                        }
                        else if (button.closest('.packs-content-container')) {
                            if (gamemodeSelectedPacks.includes(key + ',')) {
                                gamemodeSelectedPacks = gamemodeSelectedPacks.replace(key + ',', '');
                            }
                        }
                    }
                    if (partyCode) {
                        updateOnlineParty({
                            partyId: partyCode,
                            gameSettings: gamemodeSettings,
                            selectedPacks: gamemodeSelectedPacks,
                            lastPinged: new Date(),
                        });
                    }
                    updateStartGameButton(allUsersReady);
                }
                if (isActive) {
                    playSoundEffect('buttonDeselect');
                }
                else {
                    playSoundEffect('buttonClicked');
                }
            }
        });
    });
    if (onlineButton) {
        onlineButton.addEventListener('click', async () => {
            if (onlineButton.classList.contains('active')) {
                userCustomisationIcon.classList.remove('disabled');
                await ToggleOnlineMode(true);
            }
            else {
                userCustomisationIcon.classList.add('disabled');
                await ToggleOnlineMode(false);
            }
        });
    }
}


inputPartyCode.addEventListener('click', () => {
    inputPartyCode.select();
});

startGameButton.addEventListener('click', () => {
    const nsfwPacksActive = Array.from(packButtons).some(button => button.classList.contains('active') && button.classList.contains('pack-nsfw'));

    if (nsfwPacksActive) {
        addElementIfNotExists(elementClassArray, warningBox);
        warningBox.classList.add('active');
        toggleOverlay(true);
        playSoundEffect('containerOpen');
    } else {
        if (partyCode) {
            startOnlineGame();
        }
        else {
            transitionSplashScreen(removeSettingsExtensionFromCurrentURL(), `/images/splash-screens/${startGameButton.id}.png`);
        }
    }
});
warningStartButton.addEventListener('click', () => {
    if (partyCode) {
        startOnlineGame();
    }
    else {
        transitionSplashScreen(removeSettingsExtensionFromCurrentURL(), `/images/splash-screens/${startGameButton.id}.png`);
    }
});

function removeSettingsExtensionFromCurrentURL() {
    const currentURL = window.location.href;
    if (currentURL.endsWith('/settings')) {
        const newURL = currentURL.slice(0, -'/settings'.length);
        return newURL;
    }
    return currentURL;
}

async function startOnlineGame() {
    loadingPage = true;
    await setIsPlayingForParty(partyCode, true);
    transitionSplashScreen(removeSettingsExtensionFromCurrentURL() + "/" + partyCode, `/images/splash-screens/${startGameButton.id}.png`);
}

function SetGamemodeContainer() {
    SetGameSettingsButtons();
    UpdateGamemodeContainer();
}

async function UpdateGamemodeContainer() {
    let allUsersReady;
    if (partyCode) {
        allUsersReady = await GetAllUsersReady();
    }
    updateStartGameButton(allUsersReady);
    SetGamemodeButtons();
}