let selectedButton;

const rootStyles = getComputedStyle(document.documentElement);
const primaryColour = rootStyles.getPropertyValue('--primarypagecolour').trim();
const secondaryColour = rootStyles.getPropertyValue('--secondarypagecolour').trim();
const backgroundColour = rootStyles.getPropertyValue('--backgroundcolour').trim();
const secondaryBackgroundColour = rootStyles.getPropertyValue('--secondarybackgroundcolour').trim();
const warningColour = rootStyles.getPropertyValue('--warningcolour').trim();

const backButton = document.querySelector(".back-button");
const containerTitle = document.querySelector('#container-title');

const extraMenuContainer = document.querySelector('.extra-menu-container');
const tiktokIcon = document.getElementById('tik-tok-icon');
const instagramIcon = document.getElementById('instagram-icon');

const header = document.querySelector('#header');
const settingsIcon = document.querySelector('#settings-icon');
const helpIcon = document.querySelector('#help-icon');
const extraMenuIcon = document.querySelector('#extra-menu-icon');

const settingsBox = document.querySelector('#settings-box');
const settingsBoxLabels = document.querySelectorAll('#settings-box label');
const settingsBoxTitle = document.querySelector('#settings-title');

const settingsSoundCheckbox = document.getElementById('settings-sound');
const nsfwCheckbox = document.getElementById('settings-nsfw');

let elementClassArray = [];
let popUpClassArray = [];
let settingsElementClassArray = [];
let permanantElementClassArray = [];

let logoContainer = document.querySelector('.logo-container');
let partyGamesLink = document.getElementById('party-games-link');
let termsAndPrivacyLink = document.getElementById('terms-and-privacy-link');
let oesCustomisationLink = document.getElementById('oes-customisation-link');
let frequentlyAskedQuestionsLink = document.getElementById('frequently-asked-questions-link');

const instagramUrl = "https://www.instagram.com/oe.app/";
const tiktokUrl = "https://www.tiktok.com/@overexposed.app";

const instagramLink = document.getElementById('instagram-link');
const tiktokLink = document.getElementById('tiktok-link');
const soundSetting = document.getElementById('settings-sound');
const nsfwSetting = document.getElementById('settings-nsfw');

instagramLink.href = instagramUrl;
tiktokLink.href = tiktokUrl;

if (localStorage.getItem('settings-sound') === 'true') {
    settingsSoundCheckbox.checked = true;
}

settingsSoundCheckbox.addEventListener('change', function () {
    localStorage.setItem('settings-sound', settingsSoundCheckbox.checked);
    if (settingsSoundCheckbox.checked) {
        playSoundEffect('sliderEnabled');
    }
    else {
        playSoundEffect('sliderDisabled');
    }
});

if (localStorage.getItem('settings-nsfw') === 'true') {
    nsfwCheckbox.checked = true;
}

nsfwCheckbox.addEventListener('change', function () {
    localStorage.setItem('settings-nsfw', nsfwCheckbox.checked);
    if (nsfwCheckbox.checked) {
        playSoundEffect('sliderEnabled');
    }
    else {
        playSoundEffect('sliderDisabled');
    }
    if (typeof isPlaying !== "undefined" && isPlaying === false) {
        SetGamemodeButtons();
        UpdateSettings();
    }
});
if (document.querySelector('#card-bounds-checkbox')) {

    if (localStorage.getItem('settings-card-bounds') === 'true') {
        cardBoundsCheckbox.checked = true;
    }

    cardBoundsCheckbox.addEventListener('change', function () {
        localStorage.setItem('settings-card-bounds', cardBoundsCheckbox.checked);
        if (cardBoundsCheckbox.checked) {
            playSoundEffect('sliderEnabled');
        }
        else {
            playSoundEffect('sliderDisabled');
        }
    });
}

const overlay = document.createElement('div');
overlay.classList.add('overlay');
overlay.id = 'overlay';
overlay.innerHTML = '<p class="overlay-text">Tap empty area to close</p>';
document.body.appendChild(overlay);

function toggleClass(selectedClass, classArray) {
    selectedClass.classList.toggle('active');
    if (selectedClass.classList.contains('active')) {
        if (classArray == settingsElementClassArray) {
            removeAllElements(classArray);
        }
        addElementIfNotExists(classArray, selectedClass);
        playSoundEffect('containerOpen');
    }
    else {
        removeElementIfExists(classArray, selectedClass);
        playSoundEffect('containerClose');
    }

    if (elementClassArray.length == 0 && settingsElementClassArray.length == 0 && permanantElementClassArray.length == 0) {
        toggleOverlay(false);
    }
    else {
        if (!(overlay.classList.contains('active'))) {
            toggleOverlay(true);
        }
    }
}
function toggleExtraMenu() {
    toggleClass(extraMenuContainer, settingsElementClassArray);
}
function toggleSettings() {
    toggleClass(settingsBox, settingsElementClassArray);
}
function toggleHelp() {
    toggleClass(helpContainer, settingsElementClassArray);
}

function toggleOverlay(bool) {
    if (bool === true) {
        overlay.classList.add('active');
        if (backButton) {
            backButton.classList.add('inactive');
        }
    }
    else {
        if (popUpClassArray.length > 0) {
            removeAllElements(popUpClassArray)
        }
        else if (permanantElementClassArray.length == 0) {
            overlay.classList.remove('active');
            playSoundEffect('containerClose');
        }
        removeAllElements(settingsElementClassArray);
        removeAllElements(elementClassArray);

        //temp fix
        document.querySelectorAll('.floating-button').forEach(el => {
            el.classList.remove('touchhover');
        });
        if (backButton) {
            backButton.classList.remove('inactive');
        }
        document.querySelectorAll('.side-buttons .side-button').forEach(sideButton => {
            sideButton.classList.remove('active');
        });
    }
}

function setActiveClass(selectedElements, keepActive) {
    selectedElements.forEach(element => {
        if (element !== keepActive) {
            element.classList.remove('active');
        }
    });
}

settingsIcon.addEventListener('click', toggleSettings);
helpIcon.addEventListener('click', toggleHelp);
overlay.addEventListener('click', () => toggleOverlay(false));
extraMenuIcon.addEventListener('click', toggleExtraMenu);


function waitForButtons(selector, callback) {
    const observer = new MutationObserver(() => {
        const buttons = document.querySelectorAll(selector);
        if (buttons.length > 0) {
            observer.disconnect();
            callback(buttons);
        }
    });

    observer.observe(document.body, { childList: true, subtree: true });
}

function handleTTSButtons(buttons) {
    const defaultButtonIndex = 0;
    const savedKey = localStorage.getItem('selectedTTSButton');

    if (savedKey) {
        buttons.forEach(button => {
            if (button.getAttribute('data-key') === savedKey) {
                selectButton(button);
            }
        });
    } else {
        selectButton(buttons[defaultButtonIndex]);
        localStorage.setItem('selectedTTSButton', buttons[defaultButtonIndex].getAttribute('data-key'));
    }

    buttons.forEach(button => {
        button.addEventListener('click', () => {
            buttons.forEach(btn => {
                btn.classList.remove('selected');
                localStorage.setItem(btn.getAttribute('data-key'), 'false');
            });

            localStorage.setItem(button.getAttribute('data-key'), 'true');
            localStorage.setItem('selectedTTSButton', button.getAttribute('data-key'));
            selectButton(button);
        });
    });

    function selectButton(button) {
        button.classList.add('selected');
    }
}

waitForButtons('.tts-voice-button', handleTTSButtons);

function addElementIfNotExists(array, element) {
    if (!array.includes(element)) {
        array.push(element);
    }
}

function removeElementIfExists(array, element) {
    const index = array.indexOf(element);
    if (index !== -1) {
        array.splice(index, 1);
    }
}

function elementExists(array, element) {
    return Array.isArray(array) && array.includes(element);
}

function removeAllElements(array) {
    array.forEach(element => element.classList.remove("active"));
    array.length = 0;
}

function findActiveElementsWithClasses(classArray) {
    const allElements = document.body.querySelectorAll('*');
    const elementsWithClasses = Array.from(allElements).filter(element =>
        classArray.some(className => element.classList.contains(className))
    );

    const activeElements = elementsWithClasses.filter(element =>
        element.classList.contains('active')
    );

    return activeElements;
}

function removeActiveClassFromParent(childElement) {
    if (!childElement || !(childElement instanceof HTMLElement)) {
        console.error('Invalid element provided.');
        return;
    }

    const parentElement = childElement.parentElement;
    if (parentElement && parentElement.classList.contains('active')) {
        parentElement.classList.remove('active');
    }
}

function waitForElementWithTimeout(selector, callback, timeout = 10000) {
    const element = document.querySelector(selector);
    if (element) {
        callback(element);
        return;
    }

    const observer = new MutationObserver((mutationsList, observer) => {
        for (const mutation of mutationsList) {
            if (mutation.type === 'childList') {
                const element = document.querySelector(selector);
                if (element) {
                    callback(element);
                    observer.disconnect();
                    clearTimeout(timeoutId);
                    return;
                }
            }
        }
    });

    function waitForElement(selector, callback) {
        const observer = new MutationObserver((mutations, obs) => {
            const element = document.querySelector(selector);
            if (element) {
                callback(element);
                obs.disconnect(); // Stop observing once found
            }
        });

        observer.observe(document.body, { childList: true, subtree: true });
    }

    observer.observe(document.body, {
        childList: true,
        subtree: true,
    });

    const timeoutId = setTimeout(() => {
        observer.disconnect();
        console.warn(`Timeout: Element with selector "${selector}" not found within ${timeout}ms.`);
    }, timeout);
}

waitForElementWithTimeout('.settings-icon', (settingsIcon) => {
    settingsIcon.addEventListener('click', toggleSettings);
}, 15000);

if (!localStorage.getItem('cookie-consent')) {
    LoadScript('/scripts/other/cookie-consent.js');
}

//Make the Page size fit the page
function updateVh() {
    let vh = window.innerHeight * 0.01; // Get 1% of the viewport height
    document.documentElement.style.setProperty('--vh', `${vh}px`); // Set the value in CSS
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

window.addEventListener('load', updateVh);
window.addEventListener('resize', updateVh);

(async () => {
    await LoadScript('/scripts/general/splash-screen.js');
})();