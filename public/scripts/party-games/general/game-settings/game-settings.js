let gamemodeSettings = "take-a-shot,";
let gamemodeSelectedPacks = "";
let loadingPage = false;

const errorNotEnoughPlayers = document.getElementById('error-not-enough-players');
const errorNoPacksSelected = document.getElementById('error-no-packs-selected');

let eighteenPlusEnabled = localStorage.getItem('settings-nsfw') === 'true';
const packButtons = document.querySelectorAll('.packs-container .button-container button');
const startGameButton = document.querySelector('.start-game-button');
const warningBox = document.getElementById('warning-box');
const warningStartButton = document.querySelector('.start-game-warning-button');

const nsfwButtons = document.querySelectorAll('.pack.nsfw');
const gameSettingsNsfwButtons = document.querySelectorAll('.game-settings-pack.nsfw');

const onlineButton = document.getElementById('button-online');

const packsContainer = document.querySelector('.packs-container');
const gameSettingsContainer = document.querySelector('.settings-container');
const onlineSettingsContainer = document.querySelector('.online-game-settings-container');

const enterUsernameContainer = document.querySelector('.waiting-container');

const packsSettingsTab = document.getElementById('packs-settings');
const gameSettingsTab = document.getElementById('game-settings');
const onlineSettingTab = document.getElementById('online-settings');

const inputPartyCode = document.getElementById('party-code');
const userCount = document.querySelector('.user-count');

const settingsButtons = document.querySelectorAll('.button-container button');

function updateStartGameButton(allUsersReady) {

    if (typeof allUsersReady !== 'undefined') {
        if (allUsersReady && CheckErrors()) {
            startGameButton.classList.remove('disabled');
        }
        else {
            startGameButton.classList.add('disabled');
        }
        return;
    }

    const anyActive = Array.from(packButtons).some(button => button.classList.contains('active'));
    console.log("anyActive: " + anyActive);
    if (anyActive) {
        errorNoPacksSelected.classList.remove('active');
    }
    else {
        errorNoPacksSelected.classList.add('active');
    }
    startGameButton.classList.toggle('disabled', !anyActive);
    startGameButton.style.pointerEvents = anyActive ? 'auto' : 'none';
}

const storageObserver = new LocalStorageObserver();

// Add a listener to observe changes to 'settings-nsfw'
storageObserver.addListener((key, oldValue, newValue) => {
    if (key === 'settings-nsfw') {
        console.log(`The value of '${key}' changed from '${oldValue}' to '${newValue}'`);
        if (oldValue !== newValue) {
            eighteenPlusEnabled = newValue;
            setNSFWMode();
            console.log(`Value changed! Now NSFW is set to: ${newValue}`);
        }
    }
});

function setNSFWMode() {
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
}

setNSFWMode();

packsSettingsTab.addEventListener('click', () => {
    if (!(packsSettingsTab.classList.contains('active'))) {
        packsContainer.classList.add('active');
        packsSettingsTab.classList.add('active');

        gameSettingsContainer.classList.remove('active');
        gameSettingsTab.classList.remove('active');

        onlineSettingTab.classList.remove('active');
        onlineSettingsContainer.classList.remove('active');
    }
});
gameSettingsTab.addEventListener('click', () => {
    if (!(gameSettingsTab.classList.contains('active'))) {
        packsContainer.classList.remove('active');
        packsSettingsTab.classList.remove('active');

        gameSettingsContainer.classList.add('active');
        gameSettingsTab.classList.add('active');

        onlineSettingTab.classList.remove('active');
        onlineSettingsContainer.classList.remove('active');
    }
});
onlineSettingTab.addEventListener('click', () => {
    if (!(onlineSettingsContainer.classList.contains('active'))) {
        packsContainer.classList.remove('active');
        packsSettingsTab.classList.remove('active');

        gameSettingsContainer.classList.remove('active');
        gameSettingsTab.classList.remove('active')

        onlineSettingTab.classList.add('active');
        onlineSettingsContainer.classList.add('active');
    }
});

document.querySelectorAll('button:not(.settings-tab):not(.start-game-button)').forEach(button => {
    const key = button.getAttribute('data-key');
    const savedState = localStorage.getItem(key);

    if (key && savedState === 'true') {
        button.classList.add('active');
        if (button.closest('.game-settings-container')) {
            gamemodeSettings += key + ',';
        }
        else if (button.closest('.packs-content-container')) {
            gamemodeSelectedPacks += key + ',';
        }
        if (partyCode) {
            updateOnlineParty({
                partyId,
                gameSettings: gamemodeSettings,
                selectedPacks: gamemodeSelectedPacks,
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
                    });
                }
                updateStartGameButton();
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

updateStartGameButton();

backButton.addEventListener('click', () => {
    transitionSplashScreen('/', "/images/splash-screens/overexposed.png")
});

onlineButton.addEventListener('click', () => {
    if (onlineButton.classList.contains('active')) {
        onlineSettingTab.classList.remove('disabled');
        const newShuffleSeed = Math.floor(Math.random() * 256);  // Random number between 0 and 255
        partyCode = generatePartyCode();
        const players = [{
            computerId: deviceId,
            username: 'Player 1',
            isReady: false,
            hasConfirmed: false,
            lastPing: new Date(),
        }];

        updateOnlineParty({
            partyId: partyCode,
            players,
            gamemode: partyGameMode,
            gameSettings: gamemodeSettings,
            selectedPacks: gamemodeSelectedPacks,
            userInstructions: "",
            isPlaying: false,
            lastPinged: new Date(),
            playerTurn: 0,
            shuffleSeed: newShuffleSeed,
        });

        document.querySelectorAll(".user-icon").forEach(el => el.remove());
        createUserIcon(deviceId, "Player 1", true);
        //inputPartyCode.value = "https://overexposed.app/" + partyCode;
        inputPartyCode.value = "http://localhost:3000/" + partyCode;

        enterUsernameContainer.classList.add('active');
        addElementIfNotExists(permanantElementClassArray, enterUsernameContainer);
        toggleOverlay(true);

        packsContainer.classList.remove('active');
        packsSettingsTab.classList.remove('active');

        gameSettingsContainer.classList.remove('active');
        gameSettingsTab.classList.remove('active')

        onlineSettingTab.classList.add('active');
        onlineSettingsContainer.classList.add('active');
        joinParty(partyCode);
    }
    else {
        inputPartyCode.value = "";
        onlineSettingTab.classList.add('disabled');
        console.log(partyCode);
        deleteParty();
    }
});

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

function startOnlineGame() {
    setIsPlayingForParty(partyCode, true)
    loadingPage = true;
    transitionSplashScreen(removeSettingsExtensionFromCurrentURL() + "/" + partyCode, `/images/splash-screens/${startGameButton.id}.png`);
}