let gamemodeSettings = "";
let gamemodeSelectedPacks = "";


let eighteenPlusEnabled = localStorage.getItem('settings-nsfw') === 'true';
const packButtons = document.querySelectorAll('.packs-container .button-container button');
const startGameButton = document.querySelector('.start-game-button');
const warningBox = document.getElementById('warning-box');
const warningStartButton = document.querySelector('.start-game-warning-button');

const nsfwButtons = document.querySelectorAll('.pack-nsfw');
const gameSettingsNsfwButtons = document.querySelectorAll('.game-settings-pack-nsfw');

const backButton = document.querySelector('.back-button');
const onlineButton = document.getElementById('button-online');

const packsContainer = document.querySelector('.packs-container');
const gameSettingsContainer = document.querySelector('.settings-container');
const onlineSettingsContainer = document.querySelector('.online-game-settings-container');

const enterUsernameContainer = document.querySelector('.waiting-container');
const enterUsernameButton = enterUsernameContainer.querySelector('.waiting-button-container button');
const partyUsernameInput = document.getElementById('party-username');


const packsSettingsContainerButton = document.getElementById('packs-settings')
const gameSettingsContainerButton = document.getElementById('game-settings')
const onlineSettingsContainerButton = document.getElementById('online-settings')

const inputPartyCode = document.getElementById('party-code')

const settingsButtons = document.querySelectorAll('.button-container button');

const gameSettingsDescriptionContainer = document.querySelector('.settings-container .container-description');
const packsDescriptionContainer = document.querySelector('.packs-container .container-description');

const gameSettingsDescription = document.querySelector('.settings-container .container-description h2');
const packsDescription = document.querySelector('.packs-container .container-description h2');

function updateStartGameButton(allUsersReady) {

    if (typeof allUsersReady !== 'undefined') {
        if (allUsersReady) {
            startGameButton.classList.remove('disabled');
        }
        else {
            startGameButton.classList.add('disabled');
        }
        return;
    }

    const anyActive = Array.from(packButtons).some(button => button.classList.contains('active'));
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

packsSettingsContainerButton.addEventListener('click', () => {
    if (!(packsSettingsContainerButton.classList.contains('active'))) {
        packsContainer.classList.add('active');
        packsSettingsContainerButton.classList.add('active');

        gameSettingsContainer.classList.remove('active');
        gameSettingsContainerButton.classList.remove('active');

        onlineSettingsContainerButton.classList.remove('active');
        onlineSettingsContainer.classList.remove('active');
    }
});
gameSettingsContainerButton.addEventListener('click', () => {
    if (!(gameSettingsContainerButton.classList.contains('active'))) {
        packsContainer.classList.remove('active');
        packsSettingsContainerButton.classList.remove('active');

        gameSettingsContainer.classList.add('active');
        gameSettingsContainerButton.classList.add('active');

        onlineSettingsContainerButton.classList.remove('active');
        onlineSettingsContainer.classList.remove('active');
    }
});
onlineSettingsContainerButton.addEventListener('click', () => {
    if (!(onlineSettingsContainer.classList.contains('active'))) {
        packsContainer.classList.remove('active');
        packsSettingsContainerButton.classList.remove('active');

        gameSettingsContainer.classList.remove('active');
        gameSettingsContainerButton.classList.remove('active')

        onlineSettingsContainerButton.classList.add('active');
        onlineSettingsContainer.classList.add('active');
    }
});

document.querySelectorAll('button:not(.settings-button):not(.start-game-button)').forEach(button => {
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
                console.log("gamemodeSettings: " + gamemodeSettings);
                console.log("gamemodeSelectedPacks: " + gamemodeSelectedPacks);
                console.log("partyCode: " +partyCode);
                updateOnlineParty({
                    partyId: partyCode,
                    gameSettings: gamemodeSettings,
                    selectedPacks: gamemodeSelectedPacks,
                });
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
    transitionSplashScreen('/party-games', "/images/splash-screens/party-games.png")
});

onlineButton.addEventListener('click', () => {
    if (onlineButton.classList.contains('active')) {
        onlineSettingsContainerButton.classList.remove('disabled');
        const newShuffleSeed = Math.floor(Math.random() * 256);  // Random number between 0 and 255
        partyCode = generatePartyCode();
        updateOnlineParty({
            partyId: partyCode,
            computerIds: [deviceId],
            usernames: ['Player 1'],
            gamemode: partyGameMode,
            gameSettings: gamemodeSettings,
            selectedPacks: gamemodeSelectedPacks,
            usersReady: [false],
            userInstructions: "",
            isPlaying: false,
            lastPinged: Date.now(),
            playerTurn: 0,
            shuffleSeed: newShuffleSeed
        });
        createUserIcon(deviceId, "Player 1", true);
        inputPartyCode.value = "https://overexposed.app/" + partyCode;

        enterUsernameContainer.classList.add('active');
        addElementIfNotExists(permanantElementClassArray, enterUsernameContainer);
        overlay.classList.add('active');
    }
    else {
        onlineSettingsContainerButton.classList.add('disabled');
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
        overlay.classList.add('active');
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

settingsButtons.forEach(button => {
    button.addEventListener('mouseenter', () => {
        if (packsContainer.classList.contains('active')) {
            packsDescription.textContent = button.getAttribute('data-description');
        }
        else if (gameSettingsContainer.classList.contains('active')) {
            gameSettingsDescription.textContent = button.getAttribute('data-description');
        }
    });
    button.addEventListener('mouseleave', () => {
        if (packsContainer.classList.contains('active')) {
            packsDescription.textContent = "";
        }
        else if (gameSettingsContainer.classList.contains('active')) {
            gameSettingsDescription.textContent = "";
        }
    });
});

function removeSettingsExtensionFromCurrentURL() {
    const currentURL = window.location.href;
    if (currentURL.endsWith('/settings')) {
        const newURL = currentURL.slice(0, -'/settings'.length);
        return newURL;
    }
    return currentURL;
}
enterUsernameButton.addEventListener('click', async function () {
    const username = partyUsernameInput.value.trim();

    if (username === '') {
        console.log('Username is empty');
        return;
    }
    await UpdateUserPartyData({
        partyId: partyCode,
        computerId: deviceId,
        newUsername: username,
        newUserReady: true
    });
    enterUsernameContainer.classList.remove('active');
    removeElementIfExists(permanantElementClassArray, enterUsernameContainer);
    overlay.classList.remove('active');
});

function startOnlineGame() {
    setIsPlayingForParty(partyCode, true)
    transitionSplashScreen(removeSettingsExtensionFromCurrentURL() + "/" + partyCode, `/images/splash-screens/${startGameButton.id}.png`);
}
resizePage();
window.addEventListener("resize", () => {
    resizePage();
  });
  
function resizePage(){
    if (window.matchMedia("(orientation: portrait)").matches) {
        gameSettingsDescriptionContainer.classList.remove('active');
        packsDescriptionContainer.classList.remove('active');
    } else {
        gameSettingsDescriptionContainer.classList.add('active');
        packsDescriptionContainer.classList.add('active');
    }
}