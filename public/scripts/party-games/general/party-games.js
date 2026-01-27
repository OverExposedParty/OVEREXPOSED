const sideButtonsContainer = document.querySelector('.side-buttons');
const sideButtonElements = sideButtonsContainer.querySelectorAll('.side-button');

let hasBeenClicked = false;

const vibrationEnabled = localStorage.getItem('settings-vibration') === 'true';

function updateTextContainer(text, cardType, punishment) {
    const textContainer = document.querySelector('.text-container');

    const punishmentEnabled = localStorage.getItem(`${gamemode}-drink-punishment`) === 'true';

    // Update the innerHTML to include the question text and optionally the punishment
    textContainer.innerHTML =
        `<span class="question-text">${text}</span>` +
        (punishmentEnabled && punishment ? `<span class="punishment-text">Punishment: ${punishment}</span>` : '');

    if (!textContainer.classList.contains('text-container')) {
        textContainer.classList.add('text-container-small');
    }

    const searchPackName = cardType.toLowerCase();

    // Find the matching pack based on the cardType
    const matchedPack = cardPackMap.find(pack => {
        const packNameLower = pack.packName.toLowerCase();
        return packNameLower === searchPackName;
    });

    if (matchedPack) {
        const imageUrl = matchedPack.packCard ? matchedPack.packCard : `/images/blank-cards/${gamemode}-blank-card.svg`;
        document.querySelector('.main-image').src = imageUrl;
        textContainer.style.color = matchedPack.packColour;
        document.querySelector('.card-type-text').style.color = matchedPack.packColour;
    } else {
        console.log("Pack not found");
    }

    document.querySelector('.card-type-text').textContent = cardType;
}

//Press Main Image Container
const mainImageContainer = document.querySelector('.main-image-container');
const mainImageContainerText = document.querySelector('.text-container')

function addSettingsExtensionToCurrentURL() {
    const currentURL = window.location.href;
    if (!currentURL.endsWith('/settings')) {
        const newURL = currentURL.endsWith('/')
            ? currentURL + 'settings'
            : currentURL + '/settings';
        return newURL;
    }
    return currentURL;
}

(async () => {
    await loadJSONFiles();

    waitForFunction("FetchHelpContainer", () => {
        FetchHelpContainer(helpContainerFile);
    });
    previousPage = {
        link: addSettingsExtensionToCurrentURL(),
        splashScreen: `/images/splash-screens/${gamemode}-settings.png`
    };

        var sidebuttonLength = sideButtonElements.length;
    if (sidebuttonLength <= 1) {
        sideButtonsContainer.classList.add('single');
    }
})();