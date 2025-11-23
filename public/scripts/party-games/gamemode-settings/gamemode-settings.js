let gamemodeSettings = "";
let gamemodeSelectedPacks = "";
let allUsersReady = undefined;

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

            if (!button.classList.contains('button-toggle')) return;
            const key = button.getAttribute('data-key');
            if (!localStorage.getItem(key)) {
                localStorage.setItem(key, 'false');
            }
        });
        gameRulesNsfwButtons.forEach(button => {
            button.disabled = false;
            button.classList.remove('disabled');

            if (!button.classList.contains('button-toggle')) return;
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

            if (!button.classList.contains('button-toggle')) return;
            const key = button.getAttribute('data-key');
            localStorage.setItem(key, 'false');
        });
        gameRulesNsfwButtons.forEach(button => {
            button.disabled = true;
            button.classList.add('disabled');
            button.classList.remove('active');

            if (!button.classList.contains('button-toggle')) return;
            localStorage.setItem(button.getAttribute('data-key'), 'false');
        });
    }
    if (partyCode) {
        onlingSettingsButtons.forEach(button => {
            button.classList.remove('inactive');
        });
        offlineSettingsButtons.forEach(button => {
            button.classList.add('inactive');
            button.classList.remove('active');
        });
    }
    else {
        onlingSettingsButtons.forEach(button => {
            button.disabled = true;
            button.classList.add('inactive');
            button.classList.remove('active');
        });
        offlineSettingsButtons.forEach(button => {
            button.classList.remove('inactive');
        });
    }
}
function SetGameSettingsButtons() {
    // Handle button toggles
    placeholderGamemodeSettings.querySelectorAll('.button-toggle').forEach(button => {
        const key = button.getAttribute('data-key');
        let savedState = localStorage.getItem(key);
        if (button.dataset.settingsRequired == "true") savedState = 'true';

        if (key && savedState === 'true') {
            button.classList.add('active');
            SetButtonStyle(button, false);
            if (button.closest('.rules-settings-container') && !button.classList.contains('online') && !button.classList.contains('inactive')) {
                gamemodeSettings += key + ',';
            } else if (button.closest('.packs-content-container')) {
                gamemodeSelectedPacks += key + ',';
            }

            if (partyCode) {
                updateOnlineParty({
                    partyId,
                    gameRules: gamemodeSettings,
                    selectedPacks: gamemodeSelectedPacks,
                    lastPinged: new Date(),
                });
            }
        } else if (key && savedState === 'false') {
            button.classList.remove('active');
            if (button.dataset.settingsDependency) {
                document.querySelector('.rules-settings-container').querySelector(`[data-key="${button.dataset.settingsDependency}"]`).classList.add('inactive');
            }
        }

        button.addEventListener('click', () => {
            if (!button.disabled) {
                button.classList.toggle('active');
                const key = button.getAttribute('data-key');
                const isActive = button.classList.contains('active');
                const settingsButtonDependency = document.querySelector('.rules-settings-container').querySelector(`[data-key="${button.dataset.settingsDependency}"]`)
                SetButtonStyle(button, false);
                if (button.getAttribute('data-key')) {
                    localStorage.setItem(key, isActive ? 'true' : 'false');
                    if (isActive) {
                        if (button.closest('.rules-settings-container')) {
                            gamemodeSettings += key + ',';
                        } else if (button.closest('.packs-content-container')) {
                            if (settingsButtonDependency) {
                                settingsButtonDependency.classList.remove('inactive');
                                gamemodeSettings += `${key.replace("pack-", "")}:${settingsButtonDependency.getAttribute('data-count')},`;
                            }
                            gamemodeSelectedPacks += key + ',';
                        }
                    }
                    else {
                        if (button.closest('.rules-settings-container')) {
                            gamemodeSettings = gamemodeSettings.replace(key + ',', '');

                        } else if (button.closest('.packs-content-container')) {
                            if (settingsButtonDependency) {
                                settingsButtonDependency.classList.add('inactive');
                                console.log();
                                console.log("key", key.replace("pack-", ""));
                                gamemodeSettings = removeSetting(gamemodeSettings, settingsButtonDependency.getAttribute('data-key'));
                                gamemodeSelectedPacks = gamemodeSelectedPacks.replace(key + ',', '');
                            }
                            gamemodeSelectedPacks = gamemodeSelectedPacks.replace(key + ',', '');

                        }
                    }

                    if (partyCode) {
                        updateOnlineParty({
                            partyId: partyCode,
                            gameRules: gamemodeSettings,
                            selectedPacks: gamemodeSelectedPacks,
                            lastPinged: new Date(),
                        });
                    }

                    updateStartGameButton(allUsersReady);
                }
            }
        });
    });

    // 🟦 Handle increment/decrement containers
    placeholderGamemodeSettings.querySelectorAll('.increment-container').forEach(container => {
        const key = container.getAttribute('data-key');
        const countDisplay = container.querySelector('.count-display');
        const incrementBtn = container.querySelector('.increment');
        const decrementBtn = container.querySelector('.decrement');
        let count = parseInt(container.getAttribute('data-count'));
        const increment = parseInt(container.getAttribute('data-increment'));
        const min = parseInt(container.getAttribute('data-count-min'));
        const max = parseInt(container.getAttribute('data-count-max'));
        //localStorage.setItem(key, count); //hard reset
        // Restore saved value if exists
        const savedValue = localStorage.getItem(key);
        if (savedValue) {
            count = parseInt(savedValue);
            countDisplay.textContent = savedValue;
            container.setAttribute('data-count', savedValue);
            console.log(`Restored saved value for ${key}: ${savedValue}`);
        }
        else {
            localStorage.setItem(key, count);
        }

        // Add the key:value to gamemodeSettings
        if (container.closest('.rules-settings-container') && !container.classList.contains('inactive')) {
            gamemodeSettings += `${key}:${count},`;
        }

        function updateCount(newCount) {
            count = newCount;
            container.setAttribute('data-count', count);
            countDisplay.textContent = count;
            localStorage.setItem(key, count);

            // Update gamemodeSettings string dynamically
            const regex = new RegExp(`${key}:[0-9]+,`);
            if (gamemodeSettings.match(regex)) {
                gamemodeSettings = gamemodeSettings.replace(regex, `${key}:${count},`);
            } else {
                gamemodeSettings += `${key}:${count},`;
            }
            const savedValue = localStorage.getItem(key);
            console.log(`Restored saved value for ${key}: ${savedValue}`);
            if (partyCode) {
                updateOnlineParty({
                    partyId: partyCode,
                    gameRules: gamemodeSettings,
                    selectedPacks: gamemodeSelectedPacks,
                    lastPinged: new Date(),
                });
            }
        }

        incrementBtn.addEventListener('click', () => {
            if (count + increment <= max) updateCount(count + increment);
        });

        decrementBtn.addEventListener('click', () => {
            if (count - increment >= min) updateCount(count - increment);
        });
    });

    // Online toggle logic
    if (onlineButton) {
        onlineButton.addEventListener('click', async () => {
            if (onlineButton.classList.contains('active')) {
                userCustomisationIcon.classList.remove('disabled');
                await ToggleOnlineMode(true);
            } else {
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
    const nsfwPacksActive = Array.from(nsfwButtons).some(button => button.classList.contains('active') && button.classList.contains('nsfw'));
    const nsfwgameRulesActive = Array.from(gameRulesNsfwButtons).some(button => button.classList.contains('active') && button.classList.contains('nsfw'));
    if (nsfwPacksActive || nsfwgameRulesActive) {
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

function removeSetting(str, key) {
    const regex = new RegExp(`(^|,)\\s*${key}(?::[^,\\s]*)?\\s*(,|$)`, 'g');

    let result = str.replace(regex, (match, before, after, offset, fullStr) => {
        if (after === ',' && offset + match.length === fullStr.length) {
            return '';
        }
        if (before === ',' && after === ',') {
            return ',';
        }
        return before === ',' ? '' : '';
    });

    const hadTrailingComma = str.endsWith(',');
    result = result.replace(/,{2,}/g, ',').replace(/^,|,$/g, '').trim();
    if (hadTrailingComma && !result.endsWith(',')) result += ',';
    return result;
}



