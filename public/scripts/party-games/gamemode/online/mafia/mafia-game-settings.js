let gamemodeSettings = "mafia-day-timer:60,mafia-night-timer:60";
let gamemodeselectedRoles = "mafia-mafioso:1,";
let loadingPage = false;

const civilianToMafia = [5, 6, 8, 11, 14];
let mafiaCount = 1;
let CivilianCount = 0;

let mafiaCountMax = 0;
let civilianCountMax = 0;

const roles = getRoles();

let eighteenPlusEnabled = localStorage.getItem('settings-nsfw') === 'true';
const packButtons = document.querySelectorAll('.packs-container .button-container button');
const startGameButton = document.querySelector('.start-game-button');

const nsfwButtons = document.querySelectorAll('.pack-nsfw');
const gameSettingsNsfwButtons = document.querySelectorAll('.game-settings-pack-nsfw');

const enterUsernameContainer = document.querySelector('.waiting-container');

const inputPartyCode = document.getElementById('party-code');
const userCount = document.querySelector('.user-count');

const settingsButtons = document.querySelectorAll('.button-container button');

const gameSettingsDescriptionContainer = document.querySelector('.settings-container .container-description');
const packsDescriptionContainer = document.querySelector('.packs-container .container-description');

const gameSettingsDescription = document.querySelector('.settings-container .container-description h2');
const packsDescription = document.querySelector('.packs-container .container-description h2');

document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('.mafia-increment-container').forEach(container => {
        const decrementBtn = container.querySelector('.count-btn.decrement');
        const incrementBtn = container.querySelector('.count-btn.increment');
        const display = container.querySelector('.count-display');

        const increment = Number(container.getAttribute("data-increment"));
        const countMin = Number(container.getAttribute("data-count-min"));
        const countMax = Number(container.getAttribute("data-count-max"));

        decrementBtn.addEventListener('click', () => {
            let count = parseInt(display.textContent, 10);
            if (count > countMin) {
                const newCount = count - increment;
                display.textContent = newCount;

                if (container.classList.contains('role')) {
                    gamemodeselectedRoles = updateSettingsCount(gamemodeselectedRoles, container.id.replace(/-settings$/, ""), newCount);
                }
                else {
                    gamemodeSettings = updateSettingsCount(gamemodeSettings, container.id.replace(/-settings$/, ""), newCount);
                }

                container.setAttribute("data-count", newCount);

                if (newCount == countMin) {
                    decrementBtn.classList.add('disabled');
                }
                incrementBtn.classList.remove('disabled');

                updateOnlineParty({
                    partyType: sessionPartyType,
                    partyId: partyCode,
                    gameSettings: gamemodeSettings,
                    selectedRoles: gamemodeselectedRoles,
                });
                UpdateRoleCount();
            }
        });


        incrementBtn.addEventListener('click', () => {
            let count = parseInt(display.textContent, 10);
            if (count < countMax) {
                const newCount = count + increment;
                display.textContent = newCount;

                if (container.classList.contains('role')) {
                    gamemodeselectedRoles = updateSettingsCount(
                        gamemodeselectedRoles,
                        container.id.replace(/-settings$/, ""),
                        newCount
                    );
                } else {
                    gamemodeSettings = updateSettingsCount(
                        gamemodeSettings,
                        container.id.replace(/-settings$/, ""),
                        newCount
                    );
                }

                container.setAttribute("data-count", newCount);

                if (newCount === countMax) {
                    incrementBtn.classList.add('disabled');
                }
                decrementBtn.classList.remove('disabled');

                updateOnlineParty({
                    partyType: sessionPartyType,
                    partyId: partyCode,
                    gameSettings: gamemodeSettings,
                    selectedRoles: gamemodeselectedRoles,
                });
                UpdateRoleCount();
            }
        });

    });

    document.querySelectorAll('.game-settings-option').forEach(button => {
        button.addEventListener('click', () => {
            if (button.classList.contains('active')) {
                gamemodeSettings = updateSettingsCount(gamemodeSettings, button.id);
                console.log(gamemodeSettings);
            }
            else {
                gamemodeSettings = updateSettingsCount(gamemodeSettings, button.id, null, true);
                console.log(gamemodeSettings);
            }
            UpdateRoleCount();
        });
    });
});


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

packsSettingsTab.addEventListener('click', () => {
    if (!(packsSettingsTab.classList.contains('active'))) {
        packsContainer.classList.add('active');
        packsSettingsTab.classList.add('active');

        gameSettingsContainer.classList.remove('active');
        gameSettingsTab.classList.remove('active');

        onlineSettingsTab.classList.remove('active');
        onlineSettingsContainer.classList.remove('active');
    }
});
gameSettingsTab.addEventListener('click', () => {
    if (!(gameSettingsTab.classList.contains('active'))) {
        packsContainer.classList.remove('active');
        packsSettingsTab.classList.remove('active');

        gameSettingsContainer.classList.add('active');
        gameSettingsTab.classList.add('active');

        onlineSettingsTab.classList.remove('active');
        onlineSettingsContainer.classList.remove('active');
    }
});
onlineSettingsTab.addEventListener('click', () => {
    if (!(onlineSettingsContainer.classList.contains('active'))) {
        packsContainer.classList.remove('active');
        packsSettingsTab.classList.remove('active');

        gameSettingsContainer.classList.remove('active');
        gameSettingsTab.classList.remove('active')

        onlineSettingsTab.classList.add('active');
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
            gamemodeselectedRoles;
        }
        if (partyCode) {
            updateOnlineParty({
                partyType: sessionPartyType,
                partyId: partyCode,
                gameSettings: gamemodeSettings,
                selectedRoles: gamemodeselectedRoles,
            });
        }
    }

    else if (key && savedState === 'false') {
        button.classList.remove('active');
        if (button.closest('.packs-content-container')) {
            const mafiaRoleSettingsButton = document.querySelector(`#${button.getAttribute('data-key')}-settings`);
            mafiaRoleSettingsButton.classList.add('disabled');
        }
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
                        gamemodeselectedRoles = updateSettingsCount(gamemodeselectedRoles, key, 0);
                        console.log(gamemodeselectedRoles);
                        const dataKey = button.getAttribute('data-key');
                        const targetId = `#${dataKey}-settings`;
                        const mafiaRoleSettingsButton = document.querySelector(targetId);
                        mafiaRoleSettingsButton.classList.remove('disabled');
                    }
                }
                else {
                    if (button.closest('.game-settings-container')) {
                        if (gamemodeSettings.includes(key + ',')) {
                            gamemodeSettings = gamemodeSettings.replace(key + ',', '');
                        }
                    }
                    else if (button.closest('.packs-content-container')) {
                        if (gamemodeselectedRoles.includes(key)) {
                            gamemodeselectedRoles = updateSettingsCount(gamemodeselectedRoles, key, 0, true);
                            console.log(gamemodeselectedRoles);

                            const dataKey = button.getAttribute('data-key');
                            const targetId = `#${dataKey}-settings`;
                            const mafiaRoleSettingsButton = document.querySelector(targetId);
                            mafiaRoleSettingsButton.classList.add('disabled');
                        }
                    }
                }
                updateOnlineParty({
                    partyType: sessionPartyType,
                    partyId: partyCode,
                    gameSettings: gamemodeSettings,
                    selectedRoles: gamemodeselectedRoles,
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

inputPartyCode.addEventListener('click', () => {
    inputPartyCode.select();
});

startGameButton.addEventListener('click', () => {
    const nsfwPacksActive = Array.from(packButtons).some(button => button.classList.contains('active') && button.classList.contains('pack-nsfw'));

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


async function startOnlineGame() {
    loadingPage = true;
    const response = await fetch(`/api/party-game-mafia?partyCode=${partyCode}`);
    const data = await response.json();
    gamemodeselectedRoles = updateSettingsCount(gamemodeselectedRoles, "mafia-civilian", data[0].players.length - countRoles(gamemodeselectedRoles));
    updateOnlineParty({
        partyType: sessionPartyType,
        partyId: partyCode,
        gameSettings: gamemodeSettings,
        selectedRoles: gamemodeselectedRoles,
        isPlaying: true,
        lastPinged: new Date(),
    });
    transitionSplashScreen(removeSettingsExtensionFromCurrentURL() + "/" + partyCode, `/images/splash-screens/${startGameButton.id}.png`);
}
resizePage();
window.addEventListener("resize", () => {
    resizePage();
});

function resizePage() {
    if (window.matchMedia("(orientation: portrait)").matches) {
        gameSettingsDescriptionContainer.classList.remove('active');
        packsDescriptionContainer.classList.remove('active');
    } else {
        gameSettingsDescriptionContainer.classList.add('active');
        packsDescriptionContainer.classList.add('active');
    }
}

function StartOnlineSession() {
    onlineSettingsTab.classList.remove('disabled');
    partyCode = generatePartyCode();
    joinParty(partyCode);

    const players = [{
        computerId: deviceId,
        username: 'Player 1',
        isReady: false,
        hasConfirmed: false,
        lastPing: new Date(),
        role: 'N/A'
    }];

    updateOnlineParty({
        partyId: partyCode,
        players,
        gamemode: partyGameMode,
        gameSettings: gamemodeSettings,
        selectedRoles: gamemodeselectedRoles,
        userInstructions: "",
        isPlaying: false,
        lastPinged: new Date(),
        phase: "lobby",
        votes: [],
        generalChat: [],
        mafiaChat: [],
        timer: null,
    });

    document.querySelectorAll(".user-icon").forEach(el => el.remove());
    createUserIcon(deviceId, "Player 1", true);
    //inputPartyCode.value = "https://overexposed.app/" + partyCode;
    inputPartyCode.value = "https://overexposed.app/" + partyCode;

    enterUsernameContainer.classList.add('active');
    addElementIfNotExists(permanantElementClassArray, enterUsernameContainer);
    toggleOverlay(true);

    packsContainer.classList.remove('active');
    packsSettingsTab.classList.remove('active');

    gameSettingsContainer.classList.remove('active');
    gameSettingsTab.classList.remove('active')

    onlineSettingsTab.classList.add('active');
    onlineSettingsContainer.classList.add('active');
}

function updateSettingsCount(inputStr, target, newCount = null) {
    let found = false;

    const items = inputStr
        .split(',')
        .filter(item => {
            if (!item.trim()) return false; // Remove empty entries

            const [key, val] = item.split(':');

            // Remove any entries with count 0 automatically
            if (val !== undefined && parseInt(val, 10) === 0) {
                return false;
            }

            // Check if this is the target
            if (key === target) {
                found = true;
                // If newCount is 0, remove it by returning false here
                if (newCount === 0) return false;
                return true;
            }

            return true; // Keep all other items
        })
        .map(item => {
            const [key, val] = item.split(':');

            // Update the target with newCount (if not zero)
            if (key === target && newCount !== null && newCount !== 0) {
                return `${key}:${newCount}`;
            }

            return item;
        });

    // If target not found and newCount > 0, add it
    if (!found && newCount !== null && newCount > 0) {
        items.push(`${target}:${newCount}`);
    }

    return items.join(',');
}


function countRoles(roleString, allowedRoles = []) {
    const roles = roleString.split(',');
    let total = 0;

    for (let role of roles) {
        role = role.trim();
        if (role === '') continue;

        const [name, countStr] = role.split(':');
        const roleName = name.trim();

        // Skip if not in allowedRoles (if allowedRoles is provided)
        if (allowedRoles.length > 0 && !allowedRoles.includes(roleName)) continue;

        // Skip if explicitly marked as 0
        if (countStr === '0') continue;

        // Add count if specified, otherwise assume 1
        const count = countStr !== undefined ? parseInt(countStr, 10) : 1;
        total += count;
    }

    return total;
}


function getRoles() {
    const civilianRoles = [];
    const mafiosoRoles = [];

    const roleElements = document.querySelectorAll('.mafia-increment-container.role');

    roleElements.forEach(element => {
        const cleanId = element.id.replace(/-settings$/, '');
        if (element.classList.contains('civilian')) {
            civilianRoles.push(cleanId);
        } else if (element.classList.contains('mafia')) {
            mafiosoRoles.push(cleanId);
        }
    });

    // Return an object for dot notation access
    return {
        civilian: civilianRoles,
        mafioso: mafiosoRoles
    };
}

function UpdateRoleCount() {
    let tempMafiaMaxCount = 0;
    for (let i = 0; i < civilianToMafia.length; i++) {
        if (partyUserCount >= civilianToMafia[i]) {
            tempMafiaMaxCount++;
        }
    }
    mafiaCountMax = tempMafiaMaxCount;
    civilianCountMax = partyUserCount - mafiaCountMax

    mafiaCount = countRoles(gamemodeselectedRoles, roles.mafioso);
    CivilianCount = countRoles(gamemodeselectedRoles, roles.civilian);

    if (!CheckErrorNotEnoughPlayers()) {
        if (mafiaCount > mafiaCountMax) {
            setError(errorMafiaCount, true);
        }
        else {
            setError(errorMafiaCount, false);
        }

        if (mafiaCount == 0) {
            setError(errorMafiaNone, true);
        }
        else {
            setError(errorMafiaNone, false);
        }
    }
}

StartOnlineSession();
