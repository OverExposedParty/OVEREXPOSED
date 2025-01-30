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

const settingsVibrationCheckbox = document.getElementById('settings-vibration');
const nsfwCheckbox = document.getElementById('settings-nsfw');


const spinContainer = document.querySelector('.spin-the-wheel-container');
const coinFlipContainer = document.getElementById('coin-flip-container');

const questionZoomedContainer = document.querySelector('.question-zoomed-container');
const questionZoomedContainerText = document.querySelector('.question-zoomed-container h2');
const questionZoomedContainerPunishmentText = document.querySelector('.question-zoomed-container h3');

const subscriberFormBox = document.getElementById('subscriber-form-box');
const subscriberFormBoxSuccess = document.getElementById('subscriber-form-box-success');

// Declare the variable with the desired URL
const instagramUrl = "https://www.instagram.com/oe.app/";
const tiktokUrl = "https://www.tiktok.com/@overexposed.app";

document.addEventListener('DOMContentLoaded', function () {
    const instagramLink = document.getElementById('instagram-link');
    const tiktokLink = document.getElementById('tiktok-link');
    const vibrationSetting = document.getElementById('settings-vibration');
    const nsfwSetting = document.getElementById('settings-nsfw');

    waitForElementWithTimeout('#tiktok-link', (element) => {
        element.href = tiktokUrl;
    }, 15000);

    waitForElementWithTimeout('#instagram-link', (element) => {
        element.href = instagramUrl;
    }, 15000);

    waitForElementWithTimeout('#settings-vibration', (settingsVibrationCheckbox) => {
        if (!('vibrate' in navigator) || /iPhone|iPad|iPod|Mac/i.test(navigator.userAgent)) {
            settingsVibrationCheckbox.disabled = true;
            settingsVibrationCheckbox.nextElementSibling.style.opacity = 0.5;
        } else {
            if (localStorage.getItem('settings-vibration') === 'true') {
                settingsVibrationCheckbox.checked = true;
            }
        }
        settingsVibrationCheckbox.addEventListener('change', function () {
            localStorage.setItem('settings-vibration', settingsVibrationCheckbox.checked);
        });
    }, 15000);

    waitForElementWithTimeout('#settings-nsfw', (nsfwCheckbox) => {
        if (localStorage.getItem('settings-nsfw') === 'true') {
            nsfwCheckbox.checked = true;
        }

        nsfwCheckbox.addEventListener('change', function () {
            localStorage.setItem('settings-nsfw', nsfwCheckbox.checked);
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

let rotateIcon = document.createElement('img');
rotateIcon.setAttribute('src', '/images/icons/blue/rotate-phone-icon.svg');
rotateIcon.setAttribute('alt', 'Rotate Icon');
rotateIcon.classList.add('rotate-icon');

landscapeMessage.appendChild(messageText);
landscapeMessage.appendChild(rotateIcon);

document.body.appendChild(landscapeMessage);

function toggleSettings() {
    settingsBox.classList.toggle('active');
    addElementIfNotExists(elementClassArray, settingsBox);
    if (findActiveElementsWithClasses(classArray).length == 0) {
        overlay.classList.remove('active');
    }
    else{
        if(!(overlay.classList.contains('active'))){
            toggleOverlay();
        }
        else{
            setActiveClass(elementClassArray,settingsBox);
        }
    }

}
function toggleHelp() {
    helpContainer.classList.toggle('active');
    addElementIfNotExists(elementClassArray, helpContainer);
    if (findActiveElementsWithClasses(classArray).length == 0) {
        overlay.classList.remove('active');
    }
    else{
        if(!(overlay.classList.contains('active'))){
            toggleOverlay();
        }
        else{
            setActiveClass(elementClassArray,helpContainer);
        }
    }
}
function toggleExtraMenu() {
    extraMenuContainer.classList.toggle('active');
    addElementIfNotExists(elementClassArray, extraMenuContainer);
    if (findActiveElementsWithClasses(classArray).length == 0) {
        overlay.classList.remove('active');
        setActiveClass(elementClassArray,extraMenuContainer);
    }
    else{
        if(!(overlay.classList.contains('active'))){
            toggleOverlay();
        }
        else{
            setActiveClass(elementClassArray,extraMenuContainer);
        }
    }
}

function toggleOverlay() {
    overlay.classList.toggle('active');
    if (!overlay.classList.contains('active')) {
        elementClassArray.forEach(element => {
            if (element) {
                element.classList.remove('active');
            }
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


waitForElementWithTimeout('.settings-icon', (settingsIcon) => {
    settingsIcon.addEventListener('click', toggleSettings);
}, 15000);

waitForElementWithTimeout('.help-icon', (helpIcon) => {
    helpIcon.addEventListener('click', toggleHelp);
}, 15000);

waitForElementWithTimeout('#overlay', (overlay) => {
    overlay.addEventListener('click', toggleOverlay);
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

window.addEventListener('load', function () {
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

let classArray = ['help-container', 'extra-menu-container', 'settings-box', 'spin-the-wheel-container', 'coin-flip-container', 'question-zoomed-container'];
let elementClassArray = [];

function addElementIfNotExists(array, element) {
    if (!array.includes(element)) {
        array.push(element);
    }
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

    function waitForElement(selector, timeout = 5000) {
        return new Promise((resolve, reject) => {
            const intervalTime = 100; //ms
            let elapsedTime = 0;
    
            const interval = setInterval(() => {
                const element = document.querySelector(selector);
                if (element) {
                    clearInterval(interval);
                    resolve(element);
                }
                elapsedTime += intervalTime;
                if (elapsedTime >= timeout) {
                    clearInterval(interval);
                    reject(new Error(`Element with selector "${selector}" not found within ${timeout}ms`));
                }
            }, intervalTime);
        });
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
