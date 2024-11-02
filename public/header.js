let selectedButton;
let selectedColor = getComputedStyle(document.documentElement).getPropertyValue('--primarypagecolour');

const containerTitle = document.querySelector('#container-title');

const rotateMessage = document.querySelector('#landscape-message');
const rotateIcon = document.querySelector('#rotate-icon');

const extraMenuContainer = document.querySelector('.extra-menu-container');
const tiktokIcon = document.getElementById('tik-tok-icon');
const instagramIcon = document.getElementById('instagram-icon');


const header = document.querySelector('#header');
const settingsIcon = document.querySelector('.settings-icon');
const helpIcon = document.querySelector('.help-icon');
const extraMenuIcon = document.querySelector('.extra-menu-icon');


const settingsBoxLabels = document.querySelectorAll('#settings-box label');
const settingsBoxTitle = document.querySelector('#settings-title');
const settingsBox = document.querySelector('#settings-box');

const overlay = document.querySelector('#overlay');


const settingsVibrationCheckbox = document.getElementById('settings-vibration');
const nsfwCheckbox = document.getElementById('settings-nsfw');

const spinContainer = document.querySelector('.spin-the-wheel-container');
const coinFlipContainer = document.getElementById('coin-flip-container');

const helpContainer = document.getElementById('help-container');

const subscriberFormBox = document.getElementById('subscriber-form-box');
const subscriberFormBoxSuccess = document.getElementById('subscriber-form-box-success');

const socialMediaInstagram = 'https://www.instagram.com/oe.app/';

if (!('vibrate' in navigator) || /iPhone|iPad|iPod|Mac/i.test(navigator.userAgent)) {
    settingsVibrationCheckbox.disabled = true;
    settingsVibrationCheckbox.nextElementSibling.style.opacity = 0.5;
} else {
    if (localStorage.getItem('settings-vibration') === 'true') {
        settingsVibrationCheckbox.checked = true;
    }
}

if (localStorage.getItem('settings-nsfw') === 'true') {
    nsfwCheckbox.checked = true;
}

settingsVibrationCheckbox.addEventListener('change', function () {
    localStorage.setItem('settings-vibration', settingsVibrationCheckbox);
});

nsfwCheckbox.addEventListener('change', function () {
    localStorage.setItem('settings-nsfw', nsfwCheckbox.checked);
});

function toggleSettings() {
    if (!settingsBox.classList.contains('active')) {
        settingsBox.classList.add('active');
        overlay.classList.add('active');
        if (extraMenuContainer.classList.contains('active')) {
            extraMenuContainer.classList.remove('active');
        }
        if (helpContainer.classList.contains('active')) {
            helpContainer.classList.remove('active');
        }
    }
    else {
        settingsBox.classList.remove('active');
        if (findActiveElementsWithClasses(classArray).length == 0) {
            overlay.classList.remove('active');
        }
    }
}
function toggleHelp() {
    if (!helpContainer.classList.contains('active')) {
        helpContainer.classList.add('active');
        overlay.classList.add('active');
        if (extraMenuContainer.classList.contains('active')) {
            extraMenuContainer.classList.remove('active');
        }
        if (settingsBox.classList.contains('active')) {
            settingsBox.classList.remove('active');
        }
    }
    else {
        helpContainer.classList.remove('active');
        if (findActiveElementsWithClasses(classArray).length == 0) {
            overlay.classList.remove('active');
        }
    }
}
function toggleExtraMenu() {
    if (!extraMenuContainer.classList.contains('active')) {
        extraMenuContainer.classList.add('active');
        overlay.classList.add('active');
        if (helpContainer.classList.contains('active')) {
            helpContainer.classList.remove('active');
        }
        if (settingsBox.classList.contains('active')) {
            settingsBox.classList.remove('active');
        }
    }
    else {
        extraMenuContainer.classList.remove('active');
        if (findActiveElementsWithClasses(classArray).length == 0) {
            overlay.classList.remove('active');
        }
    }
}

function toggleOverlay() {
    overlay.classList.toggle('active');
    if (!overlay.classList.contains('active')) {
        extraMenuContainer.classList.remove('active');
        settingsBox.classList.remove('active');
        if (subscriberFormBox && subscriberFormBox.classList.contains('active')) {
            subscriberFormBox.classList.remove('active');
        }
        if (subscriberFormBoxSuccess && subscriberFormBoxSuccess.classList.contains('active')) {
            subscriberFormBoxSuccess.classList.remove('active');
        }
        if (helpContainer && helpContainer.classList.contains('active')) {
            helpContainer.classList.remove('active');
        }
        if (spinContainer && spinContainer.classList.contains('active')) {
            spinContainer.classList.remove('active');
            spinButton.classList.remove('active');
        }
        if (coinFlipContainer && coinFlipContainer.classList.contains('active')) {
            coinFlipContainer.classList.remove('active');
            coinFlipButton.classList.remove('active');
        }
    }
}

settingsIcon.addEventListener('click', toggleSettings);
helpIcon.addEventListener('click', toggleHelp);
overlay.addEventListener('click', toggleOverlay);

extraMenuIcon.addEventListener('click', toggleExtraMenu);

const buttons = document.querySelectorAll('.tts-voice-button');
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
            btn.style.borderColor = 'grey';
            btn.style.color = 'grey';
            localStorage.setItem(btn.getAttribute('data-key'), 'false');
        });

        selectButton(button);
        localStorage.setItem(button.getAttribute('data-key'), 'true');
        localStorage.setItem('selectedTTSButton', button.getAttribute('data-key'));
    });
});

function selectButton(button) {
    button.classList.add('selected');
    button.style.borderColor = getComputedStyle(document.documentElement).getPropertyValue('--primarypagecolour');
    button.style.color = getComputedStyle(document.documentElement).getPropertyValue('--primarypagecolour');
    selectedButton = button;
}

//Transition page
window.addEventListener('load', function () {
    if (!localStorage.getItem('webpage-first-time')) {
        localStorage.setItem('webpage-first-time', 'true');
        toggleSettings();
    }
    const container = document.createElement('div');
    const staticFullPageContainer = document.getElementById("full-page-container-static");
    container.className = 'full-page-container';

    container.appendChild(heading);

    document.body.appendChild(container);

    setTimeout(function () {
        container.classList.add('center');
    }, 50);

    setTimeout(function () {
        container.classList.remove('center');
        staticFullPageContainer.remove();
        container.classList.add('left');
    }, 300);

    setTimeout(function () {
        container.remove();
        heading.remove();
    }, 1000);
});

//Overlay remove
const classArray = ['help-container', 'extra-menu-container', 'settings-box', 'spin-the-wheel-container', 'coin-flip-container'];

function findActiveElementsWithClasses(classArray) {
    // Select all elements in the body
    const allElements = document.body.querySelectorAll('*');

    // Filter elements that contain all the classes from classArray
    const elementsWithClasses = Array.from(allElements).filter(element =>
        classArray.every(className => element.classList.contains(className))
    );

    // Further filter the list to only include elements with the 'active' class
    const activeElements = elementsWithClasses.filter(element =>
        element.classList.contains('active')
    );
    return activeElements;
}



