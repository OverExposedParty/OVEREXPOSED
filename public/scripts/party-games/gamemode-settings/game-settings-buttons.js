let nsfwButtons = [];
let onlingSettingsButtons = [];
let offlineSettingsButtons = [];
let gameRulesNsfwButtons = [];

let packButtons = [];
let settingsButtons = [];
let roleButtons = [];
let roleCatalog = new Map();
let gamemodeRoleCounts = {};

let fetchedPacks = false;
let fetchedSettings = false;
let fetchedRoles = false;
let gamemodeSettingsInitialized = false;
let gamemodeSettingsInitializationPromise = null;

const packsSettingsTab = document.getElementById('packs-settings');
const rulesSettingsTab = document.getElementById('rules-settings');
const onlineSettingsTab = document.getElementById('online-settings');

function normalizeRestrictions(restrictions) {
    if (Array.isArray(restrictions)) {
        return restrictions.map(restriction => String(restriction).trim()).filter(Boolean);
    }
    return [];
}

async function initializeGamemodeSettingsWhenReady() {
    if (gamemodeSettingsInitialized) return;
    if (gamemodeSettingsInitializationPromise) {
        return gamemodeSettingsInitializationPromise;
    }

    gamemodeSettingsInitializationPromise = (async () => {
        const setGamemodeContainer = window.SetGamemodeContainer;
        const missingDependencies = [];

        if (typeof setGamemodeContainer !== 'function') {
            missingDependencies.push('SetGamemodeContainer');
        }
        if (!packsContainer) {
            missingDependencies.push('packsContainer');
        }
        if (!rulesContainer) {
            missingDependencies.push('rulesContainer');
        }
        if (!placeholderGamemodeSettings) {
            missingDependencies.push('placeholderGamemodeSettings');
        }

        if (missingDependencies.length > 0) {
            throw new Error(
                `Gamemode settings initialization missing: ${missingDependencies.join(', ')}`
            );
        }

        await gameSettingsButtonsReady;
        await setGamemodeContainer();
        gamemodeSettingsInitialized = true;
    })();

    try {
        await gamemodeSettingsInitializationPromise;
    } catch (error) {
        gamemodeSettingsInitializationPromise = null;
        throw error;
    }
}

window.initializeGamemodeSettingsWhenReady = initializeGamemodeSettingsWhenReady;

function unwrapApiData(payload) {
    return payload?.data || payload || {};
}

async function fetchJson(path) {
    const response = await fetch(path);
    if (!response.ok) {
        throw new Error(`Failed to fetch ${path}: ${response.status}`);
    }
    return response.json();
}

function getPartyContentAccessQuery() {
    const code = String(
        typeof partyCode === 'undefined' ? '' : partyCode
    ).trim();
    return code ? `?partyCode=${encodeURIComponent(code)}` : '';
}

async function fetchGamePacksData() {
    const key = `${partyGameMode}-packs`;
    if (partyGameMode === 'mafia') return { [key]: [] };
    const payload = await fetchJson(
        `/api/party-game-packs/${partyGameMode}${getPartyContentAccessQuery()}`
    );
    const data = unwrapApiData(payload);
    return Array.isArray(data[key]) ? data : { [key]: [] };
}

async function fetchGameRolesData() {
    const key = `${partyGameMode}-roles`;
    if (partyGameMode !== 'mafia') return { [key]: [] };
    const payload = await fetchJson(
        `/api/party-game-roles/${partyGameMode}${getPartyContentAccessQuery()}`
    );
    const data = unwrapApiData(payload);
    return Array.isArray(data[key]) ? data : { [key]: [] };
}

async function fetchGameRulesData() {
    const key = `${partyGameMode}-settings`;
    const payload = await fetchJson(
        `/api/party-game-rules/${partyGameMode}${getPartyContentAccessQuery()}`
    );
    const data = unwrapApiData(payload);
    return Array.isArray(data[key]) ? data : { [key]: [] };
}

function createRoleIncrementControl(role) {
    const key = String(role["role-name"] || '').trim();
    if (!key || role["role-fill-remaining"]) return null;

    const container = document.createElement("div");
    container.className = "increment-container role";
    container.dataset.contentType = "role";
    container.dataset.key = key;
    container.id = `role-${key}`;
    container.dataset.primaryColor =
        role["role-colour"] || "var(--primarypagecolour)";
    container.dataset.secondaryColor =
        role["role-secondary-colour"] || "var(--secondarypagecolour)";
    container.dataset.count = role["role-default-count"] ?? 0;
    container.dataset.increment = role["role-increment"] ?? 1;
    container.dataset.countMin = role["role-minimum"] ?? 0;
    container.dataset.countMax = role["role-maximum"] ?? 20;

    const label = document.createElement("label");
    label.className = "settings-name";
    label.textContent = role["role-title"] || key
        .replace(/-/g, " ")
        .replace(/\b\w/g, character => character.toUpperCase());
    label.style.color = container.dataset.primaryColor;

    const wrapper = document.createElement("div");
    wrapper.className = "count-wrapper";
    wrapper.style.backgroundColor = container.dataset.secondaryColor;

    const decrementBtn = document.createElement("button");
    decrementBtn.className = "count-btn decrement";
    decrementBtn.textContent = "-";
    decrementBtn.style.backgroundColor = container.dataset.primaryColor;
    decrementBtn.style.borderColor = container.dataset.primaryColor;

    const countDisplay = document.createElement("div");
    countDisplay.className = "count-display";
    countDisplay.textContent = container.dataset.count;

    const incrementBtn = document.createElement("button");
    incrementBtn.className = "count-btn increment";
    incrementBtn.textContent = "+";
    incrementBtn.style.backgroundColor = container.dataset.primaryColor;
    incrementBtn.style.borderColor = container.dataset.primaryColor;

    wrapper.append(decrementBtn, countDisplay, incrementBtn);
    container.append(label, wrapper);
    packsContainer.querySelector('.button-container').appendChild(container);
    roleButtons.push(container);
    return container;
}

const gameSettingsButtonsReady = fetchGamePacksData()
    .then(data => {
        const packs = Array.isArray(data[`${partyGameMode}-packs`])
            ? data[`${partyGameMode}-packs`]
            : [];
        packs.forEach(pack => {
            if (pack["pack-active"]) {
                const button = document.createElement("button");
                button.dataset.key = pack["pack-name"];
                if (pack["pack-restriction"]) {
                    button.className = `pack ${pack["pack-restriction"]}`;
                }
                button.dataset.primaryColor = pack["pack-colour"];
                button.dataset.secondaryColor = pack["pack-secondary-colour"];
                if (pack["settings-dependency"]) {
                    button.dataset.settingsDependency = pack["settings-dependency"];
                }
                button.classList.add('sound-toggle');
                button.classList.add('button-toggle');
                button.textContent = pack["pack-name"]
                    .replace(/-/g, " ")
                    .replace(/\b\w/g, c => c.toUpperCase());
                if (pack["pack-difficulty"]) {
                    CreateDifficultyImages(button, pack["pack-difficulty"]);
                }
                packsContainer.querySelector('.button-container').appendChild(button);
                if (pack["pack-restriction"] === "nsfw") {
                    nsfwButtons.push(button);
                    button.appendChild(CreateDifficultyImage("nsfw"));
                }
                packButtons.push(button);

                if (window.innerWidth > window.innerHeight) {
                    button.addEventListener('mouseenter', () => {
                        SetButtonStyle(button, true);
                    })

                    button.addEventListener('mouseleave', () => {
                        SetButtonStyle(button, false);
                    })
                }
            }
        });
        fetchedPacks = true;

        return fetchGameRolesData();
    })
    .then(data => {
        const roles = Array.isArray(data[`${partyGameMode}-roles`])
            ? data[`${partyGameMode}-roles`]
            : [];
        roleCatalog = new Map();
        roles.forEach(role => {
            if (!role["role-active"]) return;
            const key = String(role["role-name"] || '').trim();
            if (!key) return;
            roleCatalog.set(key, role);
            createRoleIncrementControl(role);
        });
        fetchedRoles = true;

        return fetchGameRulesData();
    })
    .then(data => {
        const settings = Array.isArray(data[`${partyGameMode}-settings`])
            ? data[`${partyGameMode}-settings`]
            : [];
        settings.forEach(setting => {
            if (
                partyGameMode === 'mafia' &&
                roleCatalog.has(setting["settings-name"])
            ) {
                return;
            }
            if (setting["settings-active"]) {
                // Online is selected before settings and is not a game rule.
                if (setting["settings-name"] !== "online") {
                    let button;
                    const restrictions = normalizeRestrictions(setting["settings-restriction"]);
                    if (setting["button-type"] === "toggle") {
                        button = document.createElement("button");
                        button.className = "game-settings-pack";
                        if (restrictions.length > 0) {
                            button.classList.add(...restrictions);
                            button.dataset.settingsRestriction = JSON.stringify(restrictions);
                        }
                        if(setting["settings-required"]) {
                            button.dataset.settingsRequired = setting["settings-required"];
                        }
                        button.dataset.primaryColor = setting["settings-colour"];
                        button.dataset.secondaryColor = setting["settings-secondary-colour"];
                        if (setting["game-rule-time-limit"] !== undefined && setting["game-rule-time-limit"] !== null) {
                            button.dataset.gameRuleTimeLimit = setting["game-rule-time-limit"];
                        }
                        button.classList.add('sound-toggle');
                        button.classList.add('button-toggle');
                        button.textContent = setting["settings-name"].replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());

                        rulesContainer.querySelector('.button-container').appendChild(button);

                        if (window.innerWidth > window.innerHeight) {
                            button.addEventListener('mouseenter', () => {
                                SetButtonStyle(button, true);
                            })

                            button.addEventListener('mouseleave', () => {
                                SetButtonStyle(button, false);
                            })
                        }
                    }
                    else if (setting["button-type"] === "increment") {
                        const container = document.createElement("div");
                        container.classList.add('button-increment');
                        container.className = "increment-container setting";
                        container.dataset.key = setting["settings-name"];
                        if (restrictions.length > 0) {
                            container.classList.add(...restrictions);
                            container.dataset.settingsRestriction = JSON.stringify(restrictions);
                        }
                        container.id = setting["settings-name"];
                        container.dataset.primaryColor = setting["settings-colour"];
                        container.dataset.secondaryColor = setting["settings-secondary-colour"];
                        if (setting["game-rule-time-limit"] !== undefined && setting["game-rule-time-limit"] !== null) {
                            container.dataset.gameRuleTimeLimit = setting["game-rule-time-limit"];
                        }

                        // Set data attributes (with sensible fallbacks)
                        container.dataset.count = setting["button-initial-value"] ?? 60;
                        container.dataset.increment = setting["button-increment-value"] ?? 30;
                        container.dataset.countMin = setting["button-minimum-value"] ?? 30;
                        container.dataset.countMax = setting["button-maximum-value"] ?? 180;
                        // Label
                        const label = document.createElement("label");
                        label.className = "settings-name";
                        label.textContent = setting["settings-name"]
                            .replace(/-/g, " ")
                            .replace(/\b\w/g, c => c.toUpperCase());
                        container.appendChild(label);

                        // Count wrapper
                        const wrapper = document.createElement("div");
                        wrapper.className = "count-wrapper";

                        const decrementBtn = document.createElement("button");
                        decrementBtn.className = "count-btn decrement";
                        decrementBtn.textContent = "-";

                        const countDisplay = document.createElement("div");
                        countDisplay.className = "count-display";
                        countDisplay.textContent = container.dataset.count;

                        const incrementBtn = document.createElement("button");
                        incrementBtn.className = "count-btn increment";
                        incrementBtn.textContent = "+";
                        if (setting["button-designation"] === "neautral") {
                            label.style.color = 'var(--primarypagecolour)';

                            wrapper.style.backgroundColor = 'var(--secondarypagecolour)';

                            incrementBtn.style.backgroundColor = 'var(--primarypagecolour)';
                            decrementBtn.style.backgroundColor = 'var(--primarypagecolour)';

                            incrementBtn.style.borderColor = 'var(--primarypagecolour)';
                            decrementBtn.style.borderColor = 'var(--primarypagecolour)';
                        }
                        else {
                            label.style.color = container.dataset.primaryColor;

                            wrapper.style.backgroundColor = container.dataset.secondaryColor;

                            incrementBtn.style.backgroundColor = container.dataset.primaryColor;
                            decrementBtn.style.backgroundColor = container.dataset.primaryColor;

                            incrementBtn.style.borderColor = container.dataset.primaryColor;
                            decrementBtn.style.borderColor = container.dataset.primaryColor;
                        }

                        wrapper.appendChild(decrementBtn);
                        wrapper.appendChild(countDisplay);
                        wrapper.appendChild(incrementBtn);
                        container.appendChild(wrapper);

                        // Append to container
                        rulesContainer.querySelector('.button-container').appendChild(container);

                        // Logic for increment/decrement
                        incrementBtn.addEventListener("click", () => {
                            let current = parseInt(container.dataset.count);
                            const increment = parseInt(container.dataset.increment);
                            const max = parseInt(container.dataset.countMax);

                            if (current + increment <= max) {
                                current += increment;
                                container.dataset.count = current;
                                countDisplay.textContent = current;
                            }
                        });

                        decrementBtn.addEventListener("click", () => {
                            let current = parseInt(container.dataset.count);
                            const increment = parseInt(container.dataset.increment);
                            const min = parseInt(container.dataset.countMin);
                            if (current - increment >= min) {
                                current -= increment;
                                container.dataset.count = current;
                                countDisplay.textContent = current;
                            }
                        });

                        // Assign container as button reference for later tracking
                        button = container;
                    }
                    if (restrictions.includes("nsfw")) gameRulesNsfwButtons.push(button);
                    if (restrictions.includes("online")) onlingSettingsButtons.push(button);
                    if (restrictions.includes("offline")) offlineSettingsButtons.push(button);

                    button.dataset.key = setting["settings-name"];
                    settingsButtons.push(button);
                }
            }
        });

        fetchedSettings = true;
    })
    .catch(error => {
        console.error('Error loading party game settings:', error);
        fetchedPacks = true;
        fetchedSettings = true;
        fetchedRoles = true;
        return Promise.resolve();
    });

if (window.OEReady) {
    window.OEReady.register('game-settings-buttons', gameSettingsButtonsReady);
}

packsSettingsTab.addEventListener('click', () => {
    if (packsSettingsTab.classList.contains('disabled')) return;

    if (!(packsSettingsTab.classList.contains('active'))) {
        showContainer(packsContainer);
        packsSettingsTab.classList.add('active');

        hideContainer(rulesContainer);
        rulesSettingsTab.classList.remove('active');

        onlineSettingsTab.classList.remove('active');
        hideContainer(onlineSettingsContainer);
    }
});
rulesSettingsTab.addEventListener('click', () => {
    if (rulesSettingsTab.classList.contains('disabled')) return;

    if (!(rulesSettingsTab.classList.contains('active'))) {
        hideContainer(packsContainer);
        packsSettingsTab.classList.remove('active');

        showContainer(rulesContainer);
        rulesSettingsTab.classList.add('active');

        onlineSettingsTab.classList.remove('active');
        hideContainer(onlineSettingsContainer);
    }
});
onlineSettingsTab.addEventListener('click', () => {
    if (onlineSettingsTab.classList.contains('disabled')) return;

    if (!isContainerVisible(onlineSettingsContainer)) {
        hideContainer(packsContainer);
        packsSettingsTab.classList.remove('active');

        hideContainer(rulesContainer);
        rulesSettingsTab.classList.remove('active')

        onlineSettingsTab.classList.add('active');
        showContainer(onlineSettingsContainer);
    }
});

function SetButtonStyle(button, isHovering) {
    if (button.classList.contains('disabled') || !button.classList.contains('button-toggle')) return;
    if (isHovering) {
        button.style.backgroundColor = button.getAttribute('data-secondary-color');
        button.style.borderColor = button.getAttribute('data-secondary-color');
        button.style.color = '#999999';
    }
    else {
        if (button.classList.contains('active')) {
            button.style.backgroundColor = button.getAttribute('data-primary-color');
            button.style.borderColor = button.getAttribute('data-primary-color');
            button.style.color = 'var(--backgroundcolour)';
        }
        else {
            button.style.backgroundColor = 'var(--backgroundcolour)';
            button.style.borderColor = 'var(--backgroundcolour)';
            button.style.color = '#999999';
        }
    }
}

function CreateDifficultyImage(image) {
    const img = document.createElement('img');
    img.src = `/images/icons/difficulty/${image}.svg`;
    img.alt = 'Difficulty Icon';
    img.className = 'difficulty-icon';
    return img;
}

function CreateDifficultyImages(button, difficultyString) {
    const images = difficultyString.split(', ');

    images.forEach(image => {
        button.appendChild(CreateDifficultyImage(image));
    });
}
