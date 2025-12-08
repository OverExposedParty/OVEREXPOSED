let gamemodeSettings = "";
let gamemodeSelectedPacks = "";
let allUsersReady = undefined;

let eighteenPlusEnabled = localStorage.getItem('settings-nsfw') === 'true';

const startGameButton = document.querySelector('.start-game-button');
const warningBox = document.getElementById('warning-box');
const warningStartButton = document.querySelector('.start-game-warning-button');

const inputPartyCode = document.getElementById('party-code');

function updateStartGameButton(allReady) {
    if (typeof allReady !== 'undefined') {
        if (allReady && CheckErrors()) {
            startGameButton.classList.remove('disabled');
        } else {
            startGameButton.classList.add('disabled');
        }
        startGameButton.style.pointerEvents = startGameButton.classList.contains('disabled') ? 'none' : 'auto';
        return;
    }

    const anyActive = Array.from(packButtons).some(button => button.classList.contains('active'));
    setError(errorNoPacksSelected, !anyActive);
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
            SetButtonStyle(button, false);
        });
    } else {
        nsfwButtons.forEach(button => {
            button.disabled = true;
            button.classList.add('disabled');
            button.classList.remove('active');

            if (!button.classList.contains('button-toggle')) return;
            const key = button.getAttribute('data-key');
            localStorage.setItem(key, 'false');
            SetButtonStyle(button, false);
        });
        gameRulesNsfwButtons.forEach(button => {
            button.disabled = true;
            button.classList.add('disabled');
            button.classList.remove('active');

            if (!button.classList.contains('button-toggle')) return;
            localStorage.setItem(button.getAttribute('data-key'), 'false');
            if (button.closest('.rules-settings-container')) {
                gamemodeSettings = removeSetting(gamemodeSettings, button.getAttribute('data-key'));
            }
            SetButtonStyle(button, false);
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
    } else {
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
    ResetActivePacks(GetAnyPackActive());

    placeholderGamemodeSettings.querySelectorAll('.button-toggle').forEach(button => {
        const key = button.getAttribute('data-key');
        let savedState = localStorage.getItem(key) || 'true';

        if (eighteenPlusEnabled === false && button.classList.contains('nsfw')) {
            savedState = 'false';
            localStorage.setItem(key, 'false');
        }
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
                document
                    .querySelector('.rules-settings-container')
                    .querySelector(`[data-key="${button.dataset.settingsDependency}"]`)
                    .classList.add('inactive');
            }
        }

        button.addEventListener('click', () => {
            if (button.disabled) return;

            const activeCount = packButtons.filter(btn => btn.classList.contains('active')).length;

            if (button.closest('.packs-content-container') &&
                activeCount <= 1 &&
                button.classList.contains('active')) {
                return;
            }

            button.classList.toggle('active');
            const key = button.getAttribute('data-key');
            const isActive = button.classList.contains('active');
            const settingsButtonDependency = document
                .querySelector('.rules-settings-container')
                ?.querySelector(`[data-key="${button.dataset.settingsDependency}"]`);

            SetButtonStyle(button, false);

            if (key) {
                localStorage.setItem(key, isActive ? 'true' : 'false');

                if (button.closest('.packs-content-container') && settingsButtonDependency) {
                    if (isActive) {
                        settingsButtonDependency.classList.remove('inactive');
                    } else {
                        settingsButtonDependency.classList.add('inactive');
                    }
                }
            }

            UpdateSettings();
            SetGamemodeButtons();
        });
    });

    placeholderGamemodeSettings.querySelectorAll('.increment-container').forEach(container => {
        const key = container.getAttribute('data-key');
        const countDisplay = container.querySelector('.count-display');
        const incrementBtn = container.querySelector('.increment');
        const decrementBtn = container.querySelector('.decrement');
        let count = parseInt(container.getAttribute('data-count'));
        const increment = parseInt(container.getAttribute('data-increment'));
        const min = parseInt(container.getAttribute('data-count-min'));
        const max = parseInt(container.getAttribute('data-count-max'));

        const savedValue = localStorage.getItem(key);
        if (savedValue) {
            count = parseInt(savedValue);
            countDisplay.textContent = savedValue;
            container.setAttribute('data-count', savedValue);
        } else {
            localStorage.setItem(key, count);
        }

        if (container.closest('.rules-settings-container') && !container.classList.contains('inactive')) {
            gamemodeSettings += `${key}:${count},`;
        }

        function updateCount(newCount) {
            count = newCount;
            container.setAttribute('data-count', count);
            container.dataset.count = count;
            countDisplay.textContent = count;
            localStorage.setItem(key, count);
            UpdateSettings();
        }

        incrementBtn.addEventListener('click', () => {
            if (count + increment <= max) updateCount(count + increment);
        });

        decrementBtn.addEventListener('click', () => {
            if (count - increment >= min) updateCount(count - increment);
        });
    });

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

    UpdateSettings();
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
        } else {
            transitionSplashScreen(removeSettingsExtensionFromCurrentURL(), `/images/splash-screens/${startGameButton.id}.png`);
        }
    }
});

warningStartButton.addEventListener('click', () => {
    if (partyCode) {
        startOnlineGame();
    } else {
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

function UpdateSettings() {
    gamemodeSelectedPacks = '';
    gamemodeSettings = '';
    ResetActivePacks(GetAnyPackActive());
    const activePackButtons = Array.from(packButtons).filter(btn =>
        btn.classList.contains('active')
    );

    activePackButtons.forEach(btn => {
        const key = btn.dataset.key;
        if (!key) return;

        gamemodeSelectedPacks += key + ',';

        const dependencyKey = btn.dataset.settingsDependency;
        if (dependencyKey) {
            const settingsButtonDependency = document
                .querySelector('.rules-settings-container')
                ?.querySelector(`[data-key="${dependencyKey}"]`);

            if (settingsButtonDependency) {
                settingsButtonDependency.classList.remove('inactive');

                const depCount =
                    settingsButtonDependency.dataset.count ||
                    settingsButtonDependency.getAttribute('data-count');

                if (depCount) {
                    gamemodeSettings += `${key.replace('pack-', '')}:${depCount},`;
                }
            }
        }
    });

    const activeSettingsButtons = Array.from(settingsButtons).filter(btn =>
        btn.classList.contains('active') &&
        btn.closest('.rules-settings-container') &&
        !btn.classList.contains('inactive')
    );

    activeSettingsButtons.forEach(btn => {
        const key = btn.dataset.key;
        if (!key) return;

        const count = btn.dataset.count;
        if (count) {
            gamemodeSettings += `${key}:${count},`;
        } else {
            gamemodeSettings += `${key},`;
        }
    });

    const incrementContainers = placeholderGamemodeSettings.querySelectorAll('.increment-container');

    incrementContainers.forEach(container => {
        if (!container.closest('.rules-settings-container') ||
            container.classList.contains('inactive')) return;

        const key = container.dataset.key;
        const count = container.dataset.count || container.getAttribute('data-count');
        if (!key || typeof count === 'undefined') return;

        const regex = new RegExp(`${key}:[^,]*,?`, 'g');
        gamemodeSettings = gamemodeSettings.replace(regex, '');
        gamemodeSettings += `${key}:${count},`;
    });

    if (gamemodeSelectedPacks.endsWith(',')) {
        gamemodeSelectedPacks = gamemodeSelectedPacks.slice(0, -1);
    }
    if (gamemodeSettings.endsWith(',')) {
        gamemodeSettings = gamemodeSettings.slice(0, -1);
    }

    packButtons.forEach(button => {
        SetButtonStyle(button, false);
    });
    settingsButtons.forEach(button => {
        SetButtonStyle(button, false);
    });

    if (partyCode) {
        updateOnlineParty({
            partyId: partyCode,
            selectedPacks: gamemodeSelectedPacks,
            gameRules: gamemodeSettings,
            lastPinged: new Date(),
        });
    }
    updateStartGameButton(allUsersReady);
}

function GetAnyPackActive() {
    const anyPackTrue = packButtons.some(btn => {
        const key = btn.getAttribute('data-key');
        if (!key) return false;

        const isNSFW = btn.classList.contains('nsfw');
        const savedState = localStorage.getItem(key) === 'true';

        if (eighteenPlusEnabled === false && isNSFW) return false;

        return savedState;
    });
    return anyPackTrue;
}
function ResetActivePacks(anyPackTrue) {
    if (!anyPackTrue && packButtons.length > 0) {
        const first = packButtons[0];
        packButtons.forEach(btn => {
            const key = btn.getAttribute('data-key');
            if (!key) return;

            if (btn === first) {
                localStorage.setItem(key, 'true');
                btn.classList.add('active');
                SetButtonStyle(btn, false);
            } else {
                localStorage.setItem(key, 'false');
                btn.classList.remove('active');
                SetButtonStyle(btn, false);
            }
        });
    }
}
