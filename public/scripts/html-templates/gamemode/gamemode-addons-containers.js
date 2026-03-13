let spinButton;
let coinFlipButton;

const placeholderGamemodeAddons = document.getElementById('placeholder-gamemode-addons-container');
const gamemodeAddonContains = ['drink-wheel','lucky-coin-flip','odd-man-out']
if (placeholderGamemodeAddons.dataset.online === "false") {
    coinFlipButton = document.getElementById('coin-flip-button');
    const coinFlipEnabled = localStorage.getItem(`lucky-coin-flip`) === 'true';
    if (!coinFlipEnabled && coinFlipButton) {
        coinFlipButton.remove();
    }
    spinButton = document.getElementById('spin-button') || document.getElementById('odd-man-out-button');
    const spinWheelEnabled = localStorage.getItem(`drink-wheel`) === 'true';
    if (!spinWheelEnabled && spinButton) {
        spinButton.remove();
    }

    gamemodeAddonContains.forEach(addon => {
        const isEnabled = localStorage.getItem(`${addon}`) === "true";
        console.log(`${addon}: ${isEnabled}`);
        if (isEnabled) AddGamemodeContainers(addon);
    });
}
function AddGamemodeContainers(gamemodeAddon) {
    if (gamemodeAddon === 'odd-man-out') {
        gamemodeAddon = 'drink-wheel';
        const realAddon = 'odd-man-out'
    }
    if (!gamemodeAddonContains.includes(gamemodeAddon)) return;
    fetch(`/html-templates/party-games/gamemode-addons-containers/${gamemodeAddon}.html`)
        .then(response => response.text())
        .then(data => {
            placeholderGamemodeAddons.insertAdjacentHTML('beforeend', data);
            if (!(typeof realAddon === "undefined" || realAddon === null)) {
                gamemodeAddon = realAddon;
            }
            const gamemodeAddonScript = document.createElement('script');
            gamemodeAddonScript.src = versionAssetUrl(`/scripts/party-games/gamemode/gamemode-addons/${gamemodeAddon}.js`);
            document.body.appendChild(gamemodeAddonScript);

            if (gamemodeAddon === 'odd-man-out') gamemodeAddon = 'drink-wheel';

            const gamemodeAddonlink = document.createElement('link');
            gamemodeAddonlink.rel = 'stylesheet';
            gamemodeAddonlink.href = versionAssetUrl(`/css/party-games/gamemode/gamemode-addons/${gamemodeAddon}.css`);
            document.head.appendChild(gamemodeAddonlink);
        })
        .catch(error => console.error('Error loading header:', error));
}
