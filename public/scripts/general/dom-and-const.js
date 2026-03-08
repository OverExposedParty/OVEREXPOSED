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
const headerSettingsButton = header ? header.querySelector('#settings-button') : null;
const headerHelpButton = header ? header.querySelector('#help-button') : null;
const headerExtraMenuButton = header ? header.querySelector('#extra-menu-button') : null;
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

function setupMobileNavButtonHoverFlash() {
    const isTouchLikeDevice = window.matchMedia('(hover: none), (pointer: coarse)').matches;
    if (!isTouchLikeDevice) return;

    const tapHoverClass = 'tap-hover-flash';
    const hoverFlashClass = 'touchhover';
    const hoverFlashDurationMs = 220;
    const candidateSelector = 'button';
    const buttonSelector = `.${tapHoverClass}`;
    const hoverTimeoutMap = new WeakMap();

    const markTapHoverElements = (root) => {
        if (!root || typeof root.querySelectorAll !== 'function') return;
        root.querySelectorAll(candidateSelector).forEach((element) => {
            element.classList.add(tapHoverClass);
        });
    };

    markTapHoverElements(document);

    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
                if (!(node instanceof Element)) return;
                if (node.matches(candidateSelector)) {
                    node.classList.add(tapHoverClass);
                }
                markTapHoverElements(node);
            });
        });
    });

    if (document.body) {
        observer.observe(document.body, { childList: true, subtree: true });
    }

    document.addEventListener('pointerdown', (event) => {
        const tappedButton = event.target.closest(buttonSelector);
        if (!tappedButton) return;
        if (tappedButton.disabled || tappedButton.classList.contains('disabled') || tappedButton.classList.contains('inactive')) return;

        const existingTimeout = hoverTimeoutMap.get(tappedButton);
        if (existingTimeout) {
            clearTimeout(existingTimeout);
        }

        tappedButton.classList.add(hoverFlashClass);
        const timeoutId = setTimeout(() => {
            tappedButton.classList.remove(hoverFlashClass);
            hoverTimeoutMap.delete(tappedButton);
        }, hoverFlashDurationMs);

        hoverTimeoutMap.set(tappedButton, timeoutId);
    }, { passive: true });
}

setupMobileNavButtonHoverFlash();
