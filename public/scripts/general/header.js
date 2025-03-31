let selectedButton;
let selectedColor = getComputedStyle(document.documentElement).getPropertyValue('--primarypagecolour');

const containerTitle = document.querySelector('#container-title');

const rotateMessage = document.querySelector('#landscape-message');

let extraMenuContainer = document.querySelector('.extra-menu-container');
let tiktokIcon = document.getElementById('tik-tok-icon');
let instagramIcon = document.getElementById('instagram-icon');


let header = document.querySelector('#header');
const settingsIcon = document.querySelector('.settings-icon');
const helpIcon = document.querySelector('.help-icon');
const extraMenuIcon = document.querySelector('.extra-menu-icon');


const settingsBoxLabels = document.querySelectorAll('#settings-box label');
const settingsBoxTitle = document.querySelector('#settings-title');
let settingsBox = document.querySelector('#settings-box');

const settingsSoundCheckbox = document.getElementById('settings-sound');
const nsfwCheckbox = document.getElementById('settings-nsfw');


const spinContainer = document.querySelector('.spin-the-wheel-container');
const coinFlipContainer = document.getElementById('coin-flip-container');

const questionZoomedContainer = document.querySelector('.question-zoomed-container');
const questionZoomedContainerText = document.querySelector('.question-zoomed-container h2');
const questionZoomedContainerPunishmentText = document.querySelector('.question-zoomed-container h3');

const subscriberFormBox = document.getElementById('subscriber-form-box');
const subscriberFormBoxSuccess = document.getElementById('subscriber-form-box-success');

let audioContext;
let soundBuffers = {}; 

const audioBuffers = {};

async function loadSoundEffects() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }

    const soundEffects = {
        containerOpen: '/sounds/header/container-open.wav',
        containerClose: '/sounds/header/container-close.wav',
        sliderEnabled: '/sounds/header/slider-enabled.wav',
        sliderDisabled: '/sounds/header/slider-disabled.wav',
        splashScreenUp: '/sounds/header/splash-screen-up.wav',
        splashScreenDown: '/sounds/header/splash-screen-down.wav',
        buttonClicked: '/sounds/header/button-click.wav',
        buttonDeselect: '/sounds/header/button-deselect.wav',
        cardFlip: '/sounds/homepage/card-flip.wav',
        cardCannotBePlacedHere: '/sounds/overexposure/card-cannot-be-place-here.wav',
        postIncomplete: '/sounds/overexposure/post-incomplete.wav',
        postUploaded: '/sounds/overexposure/post-uploaded.wav',
        wheelSpin: '/sounds/party-games/wheel-spin.wav',
        coinFlip: '/sounds/party-games/coin-flip.wav',
    };

    for (const [key, url] of Object.entries(soundEffects)) {
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);

            const arrayBuffer = await response.arrayBuffer();
            const decodedBuffer = await audioContext.decodeAudioData(arrayBuffer);

            soundBuffers[key] = decodedBuffer;
            console.log(`✅ Sound loaded: ${key}`);
        } catch (error) {
            console.error(`❌ Error loading sound: ${key}`, error);
        }
    }
}

async function playSoundEffect(soundKey) {
    const bool = localStorage.getItem('settings-sound');
    if (bool === 'false') {
        return;
    }

    if (audioContext.state === "suspended") {
        await audioContext.resume(); // Resume if it's blocked
    }

    const buffer = soundBuffers[soundKey];
    if (!buffer) {
        console.warn(`Sound not loaded: ${soundKey}`);
        return;
    }

    const source = audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(audioContext.destination);
    source.start(0);
}

class LocalStorageObserver {
    constructor() {
      this.listeners = [];
      this.originalSetItem = localStorage.setItem;
      this.originalGetItem = localStorage.getItem;
  
      localStorage.setItem = (key, value) => {
        const oldValue = this.originalGetItem.call(localStorage, key);
        this.originalSetItem.call(localStorage, key, value);
        this.notifyListeners(key, oldValue, value);
      };
    }
  
    addListener(callback) {
      this.listeners.push(callback);
    }

    notifyListeners(key, oldValue, newValue) {
      this.listeners.forEach((listener) => {
        listener(key, oldValue, newValue);
      });
    }
  }

window.onload = function() {
    setTimeout(() => {
    let logoContainer = document.querySelector('.logo-container');
    let partyGamesLink = document.getElementById('party-games-link');
    let overexposureLink = document.getElementById('overexposure-link');
    let insightsLink = document.getElementById('insights-link');
    let whatIsOverexposedLink = document.getElementById('what-is-overexposed-link');

    if (logoContainer) {
        logoContainer.addEventListener('click', function() {
            transitionSplashScreen('/', '/images/splash-screens/overexposed.png');
        });
    }
    
    if (partyGamesLink) {
        partyGamesLink.addEventListener('click', function() {
            transitionSplashScreen('/', '/images/splash-screens/overexposed.png');
        });
    }
    if (overexposureLink) {
        overexposureLink.addEventListener('click', function() {
            transitionSplashScreen('/overexposure', '/images/splash-screens/overexposure.png');
        });
    }
    if (insightsLink) {
        insightsLink.addEventListener('click', function() {
            transitionSplashScreen('/insights', '/images/splash-screens/insights.png');
        });
    }
    if (whatIsOverexposedLink) {
        whatIsOverexposedLink.addEventListener('click', function() {
            transitionSplashScreen('/what-is-overexposed', '/images/splash-screens/what-is-overexposed.png');
        });
    }
    console.log(whatIsOverexposedLink);
}, 500);
};


// Declare the variable with the desired URL
const instagramUrl = "https://www.instagram.com/oe.app/";
const tiktokUrl = "https://www.tiktok.com/@overexposed.app";

document.addEventListener('DOMContentLoaded', function () {
    const instagramLink = document.getElementById('instagram-link');
    const tiktokLink = document.getElementById('tiktok-link');
    const soundSetting = document.getElementById('settings-sound');
    const nsfwSetting = document.getElementById('settings-nsfw');

    waitForElementWithTimeout('#tiktok-link', (element) => {
        element.href = tiktokUrl;
    }, 15000);

    waitForElementWithTimeout('#instagram-link', (element) => {
        element.href = instagramUrl;
    }, 15000);

    waitForElementWithTimeout('#settings-sound', (settingsSoundCheckbox) => {
        if (localStorage.getItem('settings-sound') === 'true') {
            settingsSoundCheckbox.checked = true;
        }

        settingsSoundCheckbox.addEventListener('change', function () {
            localStorage.setItem('settings-sound', settingsSoundCheckbox.checked);
            if(settingsSoundCheckbox.checked){
                playSoundEffect('sliderEnabled');
            }
            else{
                playSoundEffect('sliderDisabled');
            }
        });
    }, 15000);

    waitForElementWithTimeout('#settings-nsfw', (nsfwCheckbox) => {
        if (localStorage.getItem('settings-nsfw') === 'true') {
            nsfwCheckbox.checked = true;
        }

        nsfwCheckbox.addEventListener('change', function () {
            localStorage.setItem('settings-nsfw', nsfwCheckbox.checked);
            if(nsfwCheckbox.checked){
                playSoundEffect('sliderEnabled');
            }
            else{
                playSoundEffect('sliderDisabled');
            }
        });
    }, 15000);
});

// Create the help container
let helpContainer = document.createElement('div');
helpContainer.className = 'help-container';
helpContainer.id = 'help-container';

// Create the button element
let helpTitle = document.createElement('h2');
helpTitle.className = 'help-title';
helpTitle.textContent = '';
helpContainer.appendChild(helpTitle);

let helpText = document.createElement('p');
helpText.className = 'help-text';

helpContainer.appendChild(helpText);
document.body.appendChild(helpContainer);

const overlay = document.createElement('div');
overlay.classList.add('overlay');
overlay.id = 'overlay';
overlay.innerHTML = '<p class="overlay-text">Tap empty area to close</p>';
document.body.appendChild(overlay);


// Rotate Icon
const landscapeMessage = document.createElement('div');
landscapeMessage.classList.add('landscape-message');

const messageText = document.createTextNode('Please rotate your phone to continue');

let rotateIcon = document.createElement('div');
rotateIcon.setAttribute('id', 'rotate-icon');
rotateIcon.classList.add('rotate-icon');

landscapeMessage.appendChild(messageText);
landscapeMessage.appendChild(rotateIcon);

document.body.appendChild(landscapeMessage);

function toggleClass(selectedClass,classArray) {
    selectedClass.classList.toggle('active');
    if(selectedClass.classList.contains('active')){
        if(classArray == settingsElementClassArray){
            removeAllElements(classArray);
        }
        addElementIfNotExists(classArray, selectedClass);
        playSoundEffect('containerOpen');
    }
    else{
        removeElementIfExists(classArray, selectedClass);
        playSoundEffect('containerClose');
    }

    if (elementClassArray.length == 0 && settingsElementClassArray.length == 0 && permanantElementClassArray.length == 0) {
        overlay.classList.remove('active');
    }
    else{
        if(!(overlay.classList.contains('active'))){
            toggleOverlay(true);
        }
    }
}
function toggleHelp() {
    toggleClass(helpContainer,settingsElementClassArray);
}
function toggleExtraMenu() {
    toggleClass(extraMenuContainer,settingsElementClassArray);
}
function toggleSettings() {
    toggleClass(settingsBox,settingsElementClassArray);
}

function toggleOverlay(bool) {
    console.log(permanantElementClassArray);
    if(bool === true){
        overlay.classList.add('active');
    }
    else{
        if(popUpClassArray.length > 0){
            removeAllElements(popUpClassArray)
        }
        else if(permanantElementClassArray.length == 0){
            overlay.classList.remove('active');
            playSoundEffect('containerClose');
        }
        removeAllElements(settingsElementClassArray);
        removeAllElements(elementClassArray);
    }
}

function setActiveClass(selectedElements, keepActive) {
    selectedElements.forEach(element => {
        if (element !== keepActive) {
            element.classList.remove('active');
        }
    });
}

waitForElementWithTimeout('.settings-icon', (settingsIcon) => {
    settingsIcon.addEventListener('click', toggleSettings);
}, 15000);

waitForElementWithTimeout('.help-icon', (helpIcon) => {
    helpIcon.addEventListener('click', toggleHelp);
}, 15000);

waitForElementWithTimeout('#overlay', (overlay) => {
    overlay.addEventListener('click', () => toggleOverlay(false));
}, 15000);

waitForElementWithTimeout('.extra-menu-icon', (extraMenuIcon) => {
    extraMenuIcon.addEventListener('click', toggleExtraMenu);
}, 15000);

waitForElementWithTimeout('#settings-box', (element) => {
     settingsBox = element;
}, 10000);

waitForElementWithTimeout('header', (element) => {
    header = element;
}, 10000);

waitForElementWithTimeout('.extra-menu-container', (element) => {
    extraMenuContainer = element;
}, 10000);



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

window.addEventListener('load', async function () {

    const container = document.getElementById("splash-screen-container");
    const staticSplashScreenContainer = document.getElementById("splash-screen-container-static");

    
    setTimeout(function () {
        container.classList.add('center');
    }, 50);
    await loadSoundEffects();
    setTimeout(function () {
        container.classList.remove('center');
        staticSplashScreenContainer.remove();
        container.classList.add('down');
        playSoundEffect('splashScreenDown');
    }, 300);

    setTimeout(function () {
        container.remove();
        heading.remove();
    }, 1000);
});

let classArray = ['help-container', 'extra-menu-container', 'settings-box', 'spin-the-wheel-container', 'coin-flip-container', 'question-zoomed-container', 'overexposure-container'];
let elementClassArray = [];
let popUpClassArray = [];
let settingsElementClassArray = [];
let permanantElementClassArray = [];

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

function transitionSplashScreen(link,splashScreen) {
    const container = document.createElement('div');
    container.className = 'splash-screen-container down'; 
    const img = document.createElement('img');
    img.src = splashScreen;
    container.appendChild(img);
    document.body.appendChild(container);

    setTimeout(() => {
        container.classList.remove('down');
        container.classList.add('center');
        playSoundEffect('splashScreenUp');
    }, 100); // Slight delay to ensure CSS applies

    // Listen for transition end
    container.addEventListener('transitionend', function onTransitionEnd(event) {
        if (event.propertyName === 'top') { // Ensure we're detecting the correct transition
            container.removeEventListener('transitionend', onTransitionEnd);
            window.location.href = link;
        }
    });
}

// Page Load Transition
const heading = document.createElement('div');
heading.classList.add('loading-screen');

//Make the Page size fit the page
function updateVh() {
    let vh = window.innerHeight * 0.01; // Get 1% of the viewport height
    document.documentElement.style.setProperty('--vh', `${vh}px`); // Set the value in CSS
}

window.addEventListener('load', updateVh);
window.addEventListener('resize', updateVh);