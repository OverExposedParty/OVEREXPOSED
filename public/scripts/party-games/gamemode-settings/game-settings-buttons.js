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

        // Return the next fetch so it can be chained
        return fetch(`/json-files/party-games/settings/${partyGameMode}.json`);
    })
    .then(response => response.json())
    .then(data => {
        data[`${partyGameMode}-settings`].forEach(setting => {
            if (setting["settings-active"]) {
                if (!(setting["settings-name"] === "online" && placeholderGamemodeSettings.dataset.template.includes('waiting-room'))) {
                    let button;
                    if (setting["button-type"] === "toggle") {
                        button = document.createElement("button");
                        button.className = `game-settings-pack ${setting["settings-restriction"]}`;
                        button.dataset.primaryColor = setting["settings-colour"];
                        button.dataset.secondaryColor = setting["settings-secondary-colour"];
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
                        container.id = setting["settings-name"];
                        container.dataset.primaryColor = setting["settings-colour"];
                        container.dataset.secondaryColor = setting["settings-secondary-colour"];

                        // Set data attributes (with sensible fallbacks)
                        container.dataset.count = setting["button-initial-value"] || 60;
                        container.dataset.increment = setting["button-increment-value"] || 30;
                        container.dataset.countMin = setting["button-minimum-value"] || 30;
                        container.dataset.countMax = setting["button-maximum-value"] || 180;


                        // Label
                        const label = document.createElement("span");
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

                    if (setting["settings-restriction"] === "nsfw") gameRulesNsfwButtons.push(button);
                    if (setting["settings-restriction"] === "online") onlingSettingsButtons.push(button);
                    if (setting["settings-name"] === "online") {
                        button.id = "button-online";
                        onlineButton = button;
                    } else {
                        button.dataset.key = `${partyGameMode}-${setting["settings-name"]}`;
                        settingsButtons.push(button);
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
