
//Header & Settings


let selectedButton;
let selectedColor = '#66CCFF';

const containerTitle = document.querySelector('#container-title');

const rotateMessage = document.querySelector('#landscape-message');
const rotateIcon = document.querySelector('#rotate-icon');

const extraMenuContainer = document.querySelector('.extra-menu-container');
const settingsBoxLabels = document.querySelectorAll('#settings-box label');
const settingsBoxTitle = document.querySelector('#settings-title');
const settingsIcon = document.querySelector('.settings-icon');
const settingsBox = document.querySelector('#settings-box');
const overlay = document.querySelector('#overlay');
const header = document.querySelector('#header');
const settingsVibrationCheckbox = document.getElementById('settings-vibration');
const nsfwCheckbox = document.getElementById('settings-nsfw');
const extraMenuIcon = document.querySelector('.extra-menu-icon');

if (!('vibrate' in navigator) || /iPhone|iPad|iPod|Mac/i.test(navigator.userAgent)) {
    settingsVibrationCheckbox.disabled = true; // Disable the slider if Vibration API is not available or if on an Apple device
    settingsVibrationCheckbox.nextElementSibling.style.opacity = 0.5; // Optionally, dim the slider to indicate it's disabled
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
    } else {
        settingsBox.classList.remove('active');
        if (!extraMenuContainer.classList.contains('active')) {
            overlay.classList.remove('active');
        }
    }
}

function toggleOverlay() {
    overlay.classList.toggle('active');
    if (!overlay.classList.contains('active')) {
        extraMenuContainer.classList.remove('active');
        settingsBox.classList.remove('active');
    }
}

function clickOutsideHandler(event) {
    if (settingsBox.style.display === 'block' &&
        !settingsBox.contains(event.target) &&
        !settingsIcon.contains(event.target) &&
        !overlay.contains(event.target)) {
        settingsBox.style.display = 'none';
        overlay.classList.remove('active');
    }
}

settingsIcon.addEventListener('click', toggleSettings);
overlay.addEventListener('click', toggleOverlay);
document.addEventListener('click', clickOutsideHandler);

extraMenuIcon.addEventListener('click', function () {
    if (extraMenuContainer.classList.contains('active')) {
        extraMenuContainer.classList.remove('active');

        if (!settingsBox.classList.contains('active')) {
            overlay.classList.remove('active');
        }
    } else {
        extraMenuContainer.classList.add('active');
        overlay.classList.add('active');
        settingsBox.classList.remove('active');
    }
});

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
    button.style.borderColor = selectedColor;
    button.style.color = selectedColor;
    selectedButton = button;
}

