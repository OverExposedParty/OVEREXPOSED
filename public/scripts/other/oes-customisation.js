let packButtons = [];
let oesButtons = {};

let fetchedPacks = false;
let fetchedSettings = false;

const packsSettingsTab = document.getElementById('packs-settings');
const oesSettingsTab = document.getElementById('oes-settings');

const packsContainer = document.querySelector('.packs-container');
const oesContainer = document.querySelector('.oes-settings-container');

function renderPacks(packs) {
    packs.forEach(pack => {
        const packName = pack["pack-name"];

        if (packName === "blank") return;

        if (pack["pack-status"] === "active") {
            const button = document.createElement("button");
            button.textContent = packName
                .replace(/-/g, " ")
                .replace(/\b\w/g, c => c.toUpperCase());

            packsContainer.querySelector('.button-container').appendChild(button);

            packButtons.push(button);

            const savedState = localStorage.getItem(`customisation-${packName}-active`);
            if (savedState === "true") {
                button.classList.add("active");
                button.style.backgroundColor = pack["pack-colour"];
                button.style.borderColor = pack["pack-colour"];
                renderOESOptions(packName, pack["pack-colour"], pack["pack-secondary-colour"]);
            }

            button.addEventListener('click', () => {
                const activeButtons = packButtons.filter(btn => btn.classList.contains('active'));
                if (button.classList.contains('active') && activeButtons.length === 1) {
                    return;
                }

                button.classList.toggle('active');

                if (button.classList.contains('active')) {
                    renderOESOptions(packName, pack["pack-colour"], pack["pack-secondary-colour"]);
                    localStorage.setItem(`customisation-${packName}-active`, "true");

                    button.style.backgroundColor = pack["pack-colour"];
                    button.style.borderColor = pack["pack-colour"];
                } else {
                    if (oesButtons[packName]) {
                        oesButtons[packName].forEach(btn => btn.remove());
                        delete oesButtons[packName];
                    }

                    button.style.backgroundColor = '';
                    button.style.borderColor = '';

                    localStorage.setItem(`customisation-${packName}-active`, "false");
                }
            });

            button.addEventListener('mouseenter', () => {
                button.style.backgroundColor = pack["pack-secondary-colour"];
                button.style.borderColor = pack["pack-secondary-colour"];
            });

            button.addEventListener('mouseleave', () => {
                if (!button.classList.contains('active')) {
                    button.style.backgroundColor = '';
                    button.style.borderColor = '';
                }
                else {
                    button.style.backgroundColor = pack["pack-colour"];
                    button.style.borderColor = pack["pack-colour"];
                }
            });
        }
    });
}


function renderOESOptions(packName, packColour, packSecondaryColour) {
    const packPath = `/json-files/customisation/packs/${packName}.json`;
    const storageKey = `customisation-${packName}`;

    // Clear previous buttons for this pack
    if (oesButtons[packName]) {
        oesButtons[packName].forEach(btn => btn.remove());
        delete oesButtons[packName];
    }
    oesButtons[packName] = [];

    // Load saved states from localStorage (or empty object if none)
    let savedState = JSON.parse(localStorage.getItem(storageKey)) || {};

    // 🔹 Load user customisation once
    const userCustomisation = loadCustomisation();
    const selectedIds = Object.values(userCustomisation); // e.g. ["id1","id2","id3","id4"]

    fetch(packPath)
        .then(response => response.json())
        .then(data => {
            data[storageKey].forEach(item => {
                const button = document.createElement("button");
                button.dataset.id = item.id;
                button.dataset.slot = item.slot;
                button.dataset.packColour = packColour;
                button.dataset.packSecondaryColour = packSecondaryColour;
                button.className = `oes-option ${item.slot}`;

                const oesImageContainer = document.createElement("div");
                oesImageContainer.className = "oes-image-container";

                // Make all buttons active by default
                const isActive = savedState[item.id] !== undefined ? savedState[item.id] : true;
                button.classList.toggle("active", isActive);

                // 🔹 Check if this item matches one of the saved customisation IDs
                const isSelected = selectedIds.includes(item.id);
                if (isSelected) {
                    button.classList.add("selected");
                }

                // 🔹 Different border if it matches user customisation
                oesImageContainer.style.backgroundColor = isActive ? packColour : "#666666";
                if (isSelected) {
                    oesImageContainer.style.borderColor = "var(--primarypagecolour)";
                } else {
                    oesImageContainer.style.borderColor = isActive ? packColour : "#666666";
                }

                const img = document.createElement("img");
                img.src = item["file-path"];
                img.alt = item.name;

                const oesName = document.createElement("h3");
                oesName.textContent = item.name;
                oesName.className = "oes-name";

                const oesID = document.createElement("p");
                oesID.textContent = item.id;
                oesID.className = "oes-id";

                oesImageContainer.appendChild(oesName);
                oesImageContainer.appendChild(oesID);
                oesImageContainer.appendChild(img);
                button.appendChild(oesImageContainer);

                savedState[item.id] = isActive;

                button.addEventListener("click", () => {
                    if (button.classList.contains("selected")) {
                        return;
                    }

                    const newState = button.classList.toggle("active");
                    oesImageContainer.style.backgroundColor = newState ? packColour : "#666666";
                    oesImageContainer.style.borderColor = newState ? packColour : "#666666";

                    savedState[item.id] = newState;
                    localStorage.setItem(storageKey, JSON.stringify(savedState));
                });

                button.addEventListener("mouseenter", () => {
                    oesImageContainer.style.backgroundColor = packSecondaryColour;
                    if (!button.classList.contains('selected')) {
                        oesImageContainer.style.borderColor = packSecondaryColour;
                    }
                });

                button.addEventListener("mouseleave", () => {
                    const state = button.classList.contains("active");
                    oesImageContainer.style.backgroundColor = state ? packColour : "#666666";
                    if (!button.classList.contains('selected')) {
                        oesImageContainer.style.borderColor = state ? packColour : "#666666";
                    }
                });


                oesContainer.querySelector('.button-container').appendChild(button);
                oesButtons[packName].push(button);
            });

            localStorage.setItem(storageKey, JSON.stringify(savedState));
        })
        .catch(error => console.error(`Error loading OES options for ${packName}:`, error));
}

function rerenderSelectedButtons() {
    // Get the latest saved customisation
    const userCustomisation = loadCustomisation();
    const selectedIds = Object.values(userCustomisation);

    // Loop through all packs and their OES buttons
    Object.keys(oesButtons).forEach(packName => {
        oesButtons[packName].forEach(button => {
            const oesImageContainer = button.querySelector(".oes-image-container");
            const itemId = button.dataset.id;
            const isActive = button.classList.contains("active");
            const isSelected = selectedIds.includes(itemId);

            // Always reset background based on active state
            oesImageContainer.style.backgroundColor = isActive ? button.dataset.packColour : "#666666";

            // Special border if selected
            if (isSelected) {
                oesImageContainer.style.borderColor = "var(--primarypagecolour)";
                button.classList.add("selected");
            } else {
                oesImageContainer.style.borderColor = isActive ? button.dataset.packColour : "#666666";
                button.classList.remove("selected");
            }
        });
    });
}



fetch(`/json-files/customisation/customisation-packs.json`)
    .then(response => response.json())
    .then(data => {
        renderPacks(data);
    }).then(() => {
        SetScriptLoaded("/scripts/other/oes-customisation.js");
    });

packsSettingsTab.addEventListener('click', () => {
    if (!(packsSettingsTab.classList.contains('active'))) {
        packsContainer.classList.add('active');
        packsSettingsTab.classList.add('active');

        oesContainer.classList.remove('active');
        oesSettingsTab.classList.remove('active');
    }
});

oesSettingsTab.addEventListener('click', () => {
    if (!(oesSettingsTab.classList.contains('active'))) {
        packsContainer.classList.remove('active');
        packsSettingsTab.classList.remove('active');

        oesContainer.classList.add('active');
        oesSettingsTab.classList.add('active');
    }
});

waitForFunction("FetchHelpContainer", () => {
    FetchHelpContainer('other/oes-customisation.json');
});