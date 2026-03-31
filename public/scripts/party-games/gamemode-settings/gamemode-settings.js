// ─────────────────────────────────────────────
// State: now using object + array
// ─────────────────────────────────────────────
let gamemodeSettings = {};      // key -> true or number
let gamemodeSelectedPacks = []; // array of pack keys
let allUsersReady = undefined;

let eighteenPlusEnabled = localStorage.getItem('settings-nsfw') === 'true';

const startGameButton = document.querySelector('.start-game-button');
const warningBox = document.getElementById('warning-box');
const warningStartButton = document.querySelector('.start-game-warning-button');

const inputPartyCode = document.getElementById('party-code');
const copyPartyCodeButton = document.getElementById('party-code-copy-button');
const qrCodeButton = document.getElementById('qr-code-button');

// ─────────────────────────────────────────────
// Start button enabling / disabling
// ─────────────────────────────────────────────
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

// ─────────────────────────────────────────────
// NSFW / online / offline availability
// ─────────────────────────────────────────────
async function SetGamemodeButtons(initialLoad = false) {
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
            const key = button.getAttribute('data-key');
            localStorage.setItem(key, 'false');
            if (button.closest('.rules-settings-container')) {
                gamemodeSettings = removeSetting(gamemodeSettings, key);
            }
            SetButtonStyle(button, false);
        });
    }

    if (partyCode) {
        onlingSettingsButtons.forEach(button => {
            if ('disabled' in button) {
                button.disabled = false;
            }
            button.classList.remove('inactive');
        });
        offlineSettingsButtons.forEach(button => {
            if ('disabled' in button) {
                button.disabled = true;
            }
            button.classList.add('inactive');
            button.classList.remove('active');
        });
    } else {
        onlingSettingsButtons.forEach(button => {
            if ('disabled' in button) {
                button.disabled = true;
            }
            button.classList.add('inactive');
            button.classList.remove('active');
        });
        offlineSettingsButtons.forEach(button => {
            if ('disabled' in button) {
                button.disabled = false;
            }
            button.classList.remove('inactive');
        });
    }
    if (partyGamesInformation[partyGameMode].forceOnline === true && initialLoad) {
        await ToggleOnlineMode(true);
    }
}

// ─────────────────────────────────────────────
// Initialising / wiring all settings & packs
// ─────────────────────────────────────────────
function SetGameSettingsButtons() {
    ResetActivePacks(GetAnyPackActive());

    // Toggle buttons (packs + rules)
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

            if (
                button.closest('.rules-settings-container') &&
                !button.classList.contains('online') &&
                !button.classList.contains('inactive')
            ) {
                // toggle rule -> true
                gamemodeSettings[key] = true;
            } else if (button.closest('.packs-content-container')) {
                // pack selected
                if (!gamemodeSelectedPacks.includes(key)) {
                    gamemodeSelectedPacks.push(key);
                }
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

            if (
                button.closest('.packs-content-container') &&
                activeCount <= 1 &&
                button.classList.contains('active')
            ) {
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

                if (button.closest('.packs-content-container')) {
                    if (isActive) {
                        if (!gamemodeSelectedPacks.includes(key)) {
                            gamemodeSelectedPacks.push(key);
                            console.log('selected', gamemodeSelectedPacks);
                        }
                    } else {
                        gamemodeSelectedPacks = gamemodeSelectedPacks.filter(k => k !== key);
                    }

                    if (settingsButtonDependency) {
                        if (isActive) {
                            settingsButtonDependency.classList.remove('inactive');
                        } else {
                            settingsButtonDependency.classList.add('inactive');
                        }
                    }
                } else if (button.closest('.rules-settings-container')) {
                    // toggle rules directly in object
                    if (isActive && !button.classList.contains('inactive')) {
                        gamemodeSettings[key] = true;
                    } else {
                        gamemodeSettings = removeSetting(gamemodeSettings, key);
                    }
                }
            }

            UpdateSettings();
            SetGamemodeButtons(true);
        });
    });

    // Increment containers (numeric settings)
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
            if (savedValue !== null && /^-?\d+$/.test(savedValue)) {
                count = Number(savedValue);
                countDisplay.textContent = String(count);
                container.dataset.count = String(count);
            } else {
                localStorage.setItem(key, String(count));
                container.dataset.count = String(count);
                countDisplay.textContent = String(count);
            }
        } else {
            localStorage.setItem(key, count);
        }

        if (container.closest('.rules-settings-container') && !container.classList.contains('inactive')) {
            gamemodeSettings[key] = count;
        }

        function updateCount(newCount) {
            count = newCount;
            container.setAttribute('data-count', count);
            container.dataset.count = String(count);;
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
                userCustomisationIconButton.classList.remove('disabled');
                await ToggleOnlineMode(true);
            } else {
                userCustomisationIconButton.classList.add('disabled');
                await ToggleOnlineMode(false);
            }
        });
    }

    UpdateSettings();
}

// ─────────────────────────────────────────────
// Small UI handlers
// ─────────────────────────────────────────────

if (copyPartyCodeButton) {
    copyPartyCodeButton.addEventListener('click', async () => {
        flashButtonHoverState(copyPartyCodeButton, {
            duration: 0,
            fadeDuration: 200,
            className: 'copy-feedback-active',
            transitionClassName: 'copy-feedback-fade'
        });

        const codeToCopy = (inputPartyCode?.value || '').trim();
        if (!codeToCopy) return;
        const fullPartyUrl = `${window.location.origin}/${codeToCopy}`;

        try {
            const copied = await copyTextToClipboard(fullPartyUrl);
            if (!copied) {
                throw new Error('Clipboard copy command was not successful.');
            }
            if (typeof window.setTooltipSelectedState === 'function') {
                window.setTooltipSelectedState(copyPartyCodeButton);
            }
        } catch (err) {
            console.error('Failed to copy party URL:', err);
        }
    });
}

if (qrCodeButton) {
    qrCodeButton.addEventListener('click', async () => {
        if (!partyCode || typeof togglePartyQrCode !== 'function') return;
        const willShow = !qrCodeButton.classList.contains('active');
        togglePartyQrCode(willShow, partyCode);
    });
}

startGameButton.addEventListener('click', () => {
    const nsfwPacksActive = Array.from(nsfwButtons).some(button => button.classList.contains('active') && button.classList.contains('nsfw'));
    const nsfwgameRulesActive = Array.from(gameRulesNsfwButtons).some(button => button.classList.contains('active') && button.classList.contains('nsfw'));

    if (nsfwPacksActive || nsfwgameRulesActive) {
        addElementIfNotExists(elementClassArray, warningBox);
        showContainer(warningBox);
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

// ─────────────────────────────────────────────
// Container init / refresh
// ─────────────────────────────────────────────
async function SetGamemodeContainer() {
    SetGameSettingsButtons();
    if (partyCode) {
        allUsersReady = await GetAllUsersReady();
    }
    updateStartGameButton(allUsersReady);
    SetGamemodeButtons(true);
}

async function UpdateGamemodeContainer() {
    if (partyCode) {
        allUsersReady = await GetAllUsersReady();
    }
    updateStartGameButton(allUsersReady);
    SetGamemodeButtons();
}

// ─────────────────────────────────────────────
// Remove setting from object
// ─────────────────────────────────────────────
function removeSetting(settingsObj, key) {
    if (!settingsObj || typeof settingsObj !== 'object') return settingsObj;
    const newSettings = { ...settingsObj };
    delete newSettings[key];
    return newSettings;
}

// ─────────────────────────────────────────────
// Rebuild config objects + sync to backend
// ─────────────────────────────────────────────
async function UpdateSettings() {
    // reset to fresh object / array
    gamemodeSelectedPacks = [];
    gamemodeSettings = {};

    ResetActivePacks(GetAnyPackActive());

    // 1) ACTIVE PACK BUTTONS
    const activePackButtons = Array.from(packButtons).filter(btn =>
        btn.classList.contains('active')
    );

    activePackButtons.forEach(btn => {
        const key = btn.dataset.key;
        if (!key) return;

        // track selected packs as an array of keys
        if (!gamemodeSelectedPacks.includes(key)) {
            gamemodeSelectedPacks.push(key);
        }

        // handle settings dependency (e.g. pack requires a timer)
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
                    // keep old behaviour: use the pack key without 'pack-' as the field name
                    const alias = key.replace('pack-', '');
                    gamemodeSettings[alias] = Number(depCount);
                }
            }
        }
    });

    // 2) ACTIVE SETTINGS TOGGLE BUTTONS
    const activeSettingsButtons = Array.from(settingsButtons).filter(btn =>
        btn.classList.contains('active') &&
        btn.closest('.rules-settings-container') &&
        !btn.classList.contains('inactive')
    );

    activeSettingsButtons.forEach(btn => {
        const key = btn.dataset.key;
        if (!key) return;

        const count = btn.dataset.count;
        if (typeof count !== 'undefined' && count !== null) {
            // toggle that also has a count value – store number
            gamemodeSettings[key] = Number(count);
        } else {
            // plain toggle
            gamemodeSettings[key] = true;
        }
    });

    // 3) INCREMENT CONTAINERS (numeric settings)
    const incrementContainers = placeholderGamemodeSettings.querySelectorAll('.increment-container');

    incrementContainers.forEach(container => {
        if (
            !container.closest('.rules-settings-container') ||
            container.classList.contains('inactive')
        ) return;

        const key = container.dataset.key;
        const count = container.dataset.count || container.getAttribute('data-count');
        if (!key || typeof count === 'undefined') return;

        gamemodeSettings[key] = Number(count);
    });

    // 4) VISUAL STYLING
    packButtons.forEach(button => {
        SetButtonStyle(button, false);
    });
    settingsButtons.forEach(button => {
        SetButtonStyle(button, false);
    });

    // 5) SYNC ONLINE PARTY (now sending objects instead of strings)
    if (partyCode) {
        try {
            const existingData = await getExistingPartyData(partyCode);
            const currentPartyData = existingData[0] || {};

            const oldConfig = currentPartyData.config || {};

            const mergedConfig = {
                // keep existing gamemode or fall back to partyGameMode
                gamemode: oldConfig.gamemode || currentPartyData.gamemode || partyGameMode,
                // overwrite rules + packs with the new values we just built
                gameRules: gamemodeSettings,       // <--- object now
                selectedPacks: gamemodeSelectedPacks,  // <--- array now
                // preserve existing instructions / shuffleSeed if present
                userInstructions: oldConfig.userInstructions ?? currentPartyData.userInstructions ?? '',
                shuffleSeed: oldConfig.shuffleSeed
                    ?? currentPartyData.shuffleSeed
                    ?? window.currentOnlineShuffleSeed
                    ?? Math.floor(Math.random() * 256)
            };
            console.log('[UpdateSettings] preserving shuffleSeed=', mergedConfig.shuffleSeed, {
                oldConfigShuffleSeed: oldConfig.shuffleSeed,
                currentPartyDataShuffleSeed: currentPartyData.shuffleSeed,
                currentOnlineShuffleSeed: window.currentOnlineShuffleSeed
            });


            await updateOnlineParty({
                partyId: partyCode,
                config: mergedConfig,
                players: currentPartyData.players
            });
        } catch (err) {
            console.error('❌ Failed to update settings party config:', err);
        }
    }

    updateStartGameButton(allUsersReady);
}

// ─────────────────────────────────────────────
// Pack helpers
// ─────────────────────────────────────────────
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
