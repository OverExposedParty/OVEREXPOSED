let hasBeenClicked = false;
let voices = [];
let ttsButtonTimeout;
let currentUtterance = null;

const vibrationEnabled = localStorage.getItem('settings-vibration') === 'true';

function stopSpeech() {
    if (responsiveVoice.isPlaying()) {
        responsiveVoice.cancel();
    }
}

function enableTTSButton() {
    const ttsButton = document.getElementById('tts-button');
    if (ttsButton.classList.contains('disabled')) {
        ttsButton.classList.remove('disabled');
    }
}

function updateTextContainer(text, cardType, punishment) {
    const textContainer = document.querySelector('.text-container');

    const punishmentEnabled = localStorage.getItem(`${gamemode}-punishment`) === 'true';
    
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
    vibrateOnClick();
}


function vibrateOnClick() {
    if (vibrationEnabled && 'vibrate' in navigator) {
        navigator.vibrate(200);
    }
}

document.querySelector('.back-button').addEventListener('click', () => {
    transitionSplashScreen(addSettingsExtensionToCurrentURL(), `/images/splash-screens/${gamemode}-settings.png`);
});

document.addEventListener('DOMContentLoaded', async () => {
const sideButtonsContainer = document.querySelector('.side-buttons');
const sideButtonElements = sideButtonsContainer.querySelectorAll('.side-button');

var sidebuttonLength = sideButtonElements.length;
console.log(sideButtonElements);
if (sidebuttonLength <= 1) {
    sideButtonsContainer.classList.add('single');
}

function disableTTSButton() {
    const ttsButton = document.getElementById('tts-button');
    if (!ttsButton.classList.contains('disabled')) {
        ttsButton.classList.add('disabled');
        clearTimeout(ttsButtonTimeout);
        ttsButtonTimeout = setTimeout(() => {
            enableTTSButton();
        }, 8000);
    }
}

function getSelectedVoice() {
    const voiceKeys = ['tts-voice-male1', 'tts-voice-male2', 'tts-voice-female1', 'tts-voice-female2'];
    voiceKeys.forEach(key => console.log(`${key}: ${localStorage.getItem(key)}`));

    const selectedVoiceKey = voiceKeys.find(key => localStorage.getItem(key) === 'true');

    console.log(`Selected Voice Key: ${selectedVoiceKey}`);

    switch (selectedVoiceKey) {
        case 'tts-voice-male1':
            return 'UK English Male';
        case 'tts-voice-male2':
            return 'US English Male';
        case 'tts-voice-female1':
            return 'UK English Female';
        case 'tts-voice-female2':
            return 'US English Female';
        default:
            return 'UK English Male';
    }
}
document.getElementById('tts-button').addEventListener('click', () => {
    const textContainerText = document.querySelector('.text-container').textContent;
    const selectedVoiceName = getSelectedVoice();

    if (selectedVoiceName) {
        responsiveVoice.speak(textContainerText, selectedVoiceName);
    } else {
        responsiveVoice.speak(textContainerText, "US English Female");
    }

    disableTTSButton();
});
await loadJSONFiles();
});

//Press Main Image Container
const mainImageContainer = document.querySelector('.main-image-container');
const mainImageContainerText = document.querySelector('.text-container')

mainImageContainer.addEventListener('click', toggleQuestionZoomedContainer);

function toggleQuestionZoomedContainer() {
    const questionZoomedContainerImg = document.querySelector('.question-zoomed-container img');
    questionZoomedContainerImg.src = document.querySelector('.main-image-container img').src;
    addElementIfNotExists(elementClassArray, questionZoomedContainer);
    if (!questionZoomedContainer.classList.contains('active')) {
        questionZoomedContainer.classList.add('active');
        playSoundEffect('containerOpen');
        questionZoomedContainerText.textContent = mainImageContainerText.textContent;
        if (!overlay.classList.contains('active')) {
            overlay.classList.add('active');
        }
    }
    else {
        questionZoomedContainer.classList.remove('active');
        if (findActiveElementsWithClasses(classArray).length == 0) {
            overlay.classList.remove('active');
        }
    }
}

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
  