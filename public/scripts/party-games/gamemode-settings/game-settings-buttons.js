let nsfwButtons = [];
let onlingSettingsButtons = [];
let gameRulesNsfwButtons = [];

let packButtons = [];
let settingsButtons = [];
let onlineButton;

let fetchedPacks = false;
let fetchedSettings = false;

const packsSettingsTab = document.getElementById('packs-settings');
const rulesSettingsTab = document.getElementById('rules-settings');
const onlineSettingsTab = document.getElementById('online-settings');

fetch(`/json-files/party-games/packs/${partyGameMode}.json`)
    .then(response => response.json())
    .then(data => {
        data[`${partyGameMode}-packs`].forEach(pack => {
            if (pack["pack-active"]) {
                const button = document.createElement("button");
                button.dataset.key = `${partyGameMode}-${pack["pack-name"]}`;
                button.className = `pack ${pack["pack-restriction"]}`;
                button.dataset.primaryColor = pack["pack-colour"];
                button.dataset.secondaryColor = pack["pack-secondary-colour"];
                button.classList.add('sound-toggle');
                button.textContent = pack["pack-name"]
                    .replace(/-/g, " ")
                    .replace(/\b\w/g, c => c.toUpperCase())
                    + " " + "!".repeat(pack["pack-difficulty"] || 0);
                packsContainer.querySelector('.button-container').appendChild(button);
                if (pack["pack-restriction"] === "nsfw") nsfwButtons.push(button);
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

        // Return the next fetch so it can be chained
        return fetch(`/json-files/party-games/settings/${partyGameMode}.json`);
    })
    .then(response => response.json())
    .then(data => {
        data[`${partyGameMode}-settings`].forEach(setting => {
            if (setting["settings-active"]) {
                if (!(setting["settings-name"] === "online" && placeholderGamemodeSettings.dataset.template.includes('waiting-room'))) {
                    const button = document.createElement("button");
                    button.className = `game-settings-pack ${setting["settings-restriction"]}`;
                    button.dataset.primaryColor = setting["settings-colour"];
                    button.dataset.secondaryColor = setting["settings-secondary-colour"];
                    button.classList.add('sound-toggle');
                    button.textContent = setting["settings-name"].replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());
                    rulesContainer.querySelector('.button-container').appendChild(button);

                    if (setting["settings-restriction"] === "nsfw") gameRulesNsfwButtons.push(button);
                    if (setting["settings-restriction"] === "online") onlingSettingsButtons.push(button);
                    if (setting["settings-name"] === "online") {
                        button.id = "button-online";
                        onlineButton = button;
                    } else {
                        button.dataset.key = `${partyGameMode}-${setting["settings-name"]}`;
                        settingsButtons.push(button);
                    }
                    if (window.innerWidth > window.innerHeight) {
                        button.addEventListener('mouseenter', () => {
                            SetButtonStyle(button, true);
                        })

                        button.addEventListener('mouseleave', () => {
                            SetButtonStyle(button, false);
                        })
                    }
                }
            }
        });

        fetchedSettings = true;
        if (fetchedPacks && fetchedSettings) {
            SetGamemodeContainer();
        }
    })
    .catch(error => console.error('Error loading JSON:', error));


packsSettingsTab.addEventListener('click', () => {
    if (!(packsSettingsTab.classList.contains('active'))) {
        packsContainer.classList.add('active');
        packsSettingsTab.classList.add('active');

        rulesContainer.classList.remove('active');
        rulesSettingsTab.classList.remove('active');

        onlineSettingsTab.classList.remove('active');
        onlineSettingsContainer.classList.remove('active');
    }
});
rulesSettingsTab.addEventListener('click', () => {
    if (!(rulesSettingsTab.classList.contains('active'))) {
        packsContainer.classList.remove('active');
        packsSettingsTab.classList.remove('active');

        rulesContainer.classList.add('active');
        rulesSettingsTab.classList.add('active');

        onlineSettingsTab.classList.remove('active');
        onlineSettingsContainer.classList.remove('active');
    }
});
onlineSettingsTab.addEventListener('click', () => {
    if (!(onlineSettingsContainer.classList.contains('active'))) {
        packsContainer.classList.remove('active');
        packsSettingsTab.classList.remove('active');

        rulesContainer.classList.remove('active');
        rulesSettingsTab.classList.remove('active')

        onlineSettingsTab.classList.add('active');
        onlineSettingsContainer.classList.add('active');
    }
});

function SetButtonStyle(button, isHovering) {
    if (button.classList.contains('disabled')) return;
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