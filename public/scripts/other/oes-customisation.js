let packButtons = [];
let oesButtons = {};

let fetchedPacks = false;
let fetchedSettings = false;

const packsSettingsTab = document.getElementById('packs-settings');
const oesSettingsTab = document.getElementById('oes-settings');

const packsContainer = document.querySelector('.packs-container');
const oesContainer = document.querySelector('.oes-settings-container');

if (localStorage.getItem('oes-base') === null) {
  localStorage.setItem('oes-base', 'true');
}

function renderPacks(packs) {
    packs.forEach(pack => {
        const packName = pack["pack-name"];

        // Skip the blank pack entirely
        if (packName === "blank") return;

        if (pack["pack-status"] === "active") {
            const button = document.createElement("button");
            button.textContent = packName
                .replace(/-/g, " ")
                .replace(/\b\w/g, c => c.toUpperCase());

            packsContainer.querySelector('.button-container').appendChild(button);

            packButtons.push(button);

            // Restore state from localStorage on load
            const savedState = localStorage.getItem(`oes-${packName}`);
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
                    localStorage.setItem(`oes-${packName}`, "true");

                    button.style.backgroundColor = pack["pack-colour"];
                    button.style.borderColor = pack["pack-colour"];
                } else {
                    if (oesButtons[packName]) {
                        oesButtons[packName].forEach(btn => btn.remove());
                        delete oesButtons[packName];
                    }

                    button.style.backgroundColor = '';
                    button.style.borderColor = '';

                    localStorage.setItem(`oes-${packName}`, "false");
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

    fetch(packPath)
        .then(response => response.json())
        .then(data => {
            const key = `customisation-${packName}`;
            if (!data[key]) return;

            // Prevent duplicates if already loaded
            if (oesButtons[packName]) return;

            oesButtons[packName] = []; // create new entry

            data[key].forEach(item => {
                const button = document.createElement("div");
                button.dataset.id = item.id;
                button.dataset.slot = item.slot;
                button.className = `oes-option ${item.slot}`;

                const img = document.createElement("img");
                img.src = item["file-path"];
                img.alt = item.name;

                const oesImageContainer = document.createElement("div");
                oesImageContainer.className = "oes-image-container";
                oesImageContainer.appendChild(img);
                button.appendChild(oesImageContainer);

                const oesName = document.createElement("h3");
                oesName.textContent = item.name;
                oesName.className = "oes-name";

                const oesID = document.createElement("p");
                oesID.textContent = item.id;
                oesID.className = "oes-id";

                oesImageContainer.style.backgroundColor = packColour;
                oesImageContainer.style.borderColor = packSecondaryColour;

                oesImageContainer.appendChild(oesName);
                oesImageContainer.appendChild(oesID);

                oesImageContainer.appendChild(img);

                oesContainer.querySelector('.button-container').appendChild(button);

                oesButtons[packName].push(button);
            });
        })
        .catch(error => console.error(`Error loading OES options for ${packName}:`, error));
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