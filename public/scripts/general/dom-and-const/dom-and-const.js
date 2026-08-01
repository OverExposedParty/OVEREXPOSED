let selectedButton;

const rootStyles = getComputedStyle(document.documentElement);
const primaryColour = rootStyles.getPropertyValue('--primarypagecolour').trim();
const secondaryColour = rootStyles
  .getPropertyValue('--secondarypagecolour')
  .trim();
const backgroundColour = rootStyles
  .getPropertyValue('--backgroundcolour')
  .trim();
const secondaryBackgroundColour = rootStyles
  .getPropertyValue('--secondarybackgroundcolour')
  .trim();
const warningColour = rootStyles.getPropertyValue('--warningcolour').trim();
const successColour = rootStyles.getPropertyValue('--successcolour').trim();
const successColourSecondary = rootStyles
  .getPropertyValue('--successcoloursecondary')
  .trim();

const backButton = document.querySelector('.back-button');
const containerTitle = document.querySelector('#container-title');

const extraMenuContainer = document.querySelector('.extra-menu-container');
const tiktokIcon = document.getElementById('tik-tok-icon');
const instagramIcon = document.getElementById('instagram-icon');

const header = document.querySelector('#header');
const headerSettingsButton = header
  ? header.querySelector('#settings-button')
  : null;
const headerHelpButton = header ? header.querySelector('#help-button') : null;
const headerExtraMenuButton = header
  ? header.querySelector('#extra-menu-button')
  : null;
const settingsBox = document.querySelector('#settings-box');
const settingsBoxLabels = document.querySelectorAll('#settings-box label');
const settingsBoxTitle = document.querySelector('#settings-title');
const helpHub = document.querySelector('#help-hub');
const helpHubBackButton = document.querySelector('#help-hub-back-button');
const helpHubTitle = document.querySelector('#help-hub-title');
const helpHubGrid = document.querySelector('#help-hub-grid');
const accountContainer = document.querySelector('#account-container');

const settingsSoundCheckbox = document.getElementById('settings-sound');
const nsfwCheckbox = document.getElementById('settings-nsfw');

let elementClassArray = [];
let popUpClassArray = [];
let settingsElementClassArray = [];
let permanantElementClassArray = [];

let logoContainer = document.querySelector('.logo-container');
let partyGamesLink = document.getElementById('party-games-link');
let olingLabLink = document.getElementById('oling-lab-link');
let shopLink = document.getElementById('shop-link');
let overexposureLink = document.getElementById('overexposure-link');
let accountLink = document.getElementById('account-link');
let termsAndPrivacyLink = document.getElementById('terms-and-privacy-link');
let oesCustomisationLink = document.getElementById('oes-customisation-link');
let frequentlyAskedQuestionsLink = document.getElementById(
  'frequently-asked-questions-link'
);

const instagramUrl = 'https://www.instagram.com/oe.app/';
const tiktokUrl = 'https://www.tiktok.com/@overexposed.app';

const instagramLink = document.getElementById('instagram-link');
const tiktokLink = document.getElementById('tiktok-link');
const soundSetting = document.getElementById('settings-sound');
const nsfwSetting = document.getElementById('settings-nsfw');

function setupButtonPressFeedback() {
  const pressableSelector = [
    'button',
    "input[type='button']",
    "input[type='reset']",
    "input[type='submit']",
    "[role='button']"
  ].join(',');
  const moveTolerancePx = 10;
  const releaseDurationMs = 110;
  const settleDurationMs = 90;
  const activePresses = new Map();
  const releaseTimeouts = new WeakMap();

  const isDisabled = (element) =>
    element.disabled ||
    element.getAttribute('aria-disabled') === 'true' ||
    element.classList.contains('disabled') ||
    element.classList.contains('inactive') ||
    element.dataset.pressFeedback === 'none' ||
    element.matches('.tool-tip[data-tooltip]');

  const findPressable = (target) => {
    if (!(target instanceof Element)) return null;
    return target.closest(pressableSelector);
  };

  const clearRelease = (element) => {
    const timeoutId = releaseTimeouts.get(element);
    if (timeoutId) clearTimeout(timeoutId);
    releaseTimeouts.delete(element);
    element.classList.remove('is-press-releasing', 'is-press-settling');
  };

  const beginPress = (element, pointerId, clientX, clientY) => {
    clearRelease(element);
    element.classList.add('is-pressed');
    activePresses.set(pointerId, { element, clientX, clientY });
  };

  const endPress = (pointerId, { animate = true } = {}) => {
    const press = activePresses.get(pointerId);
    if (!press) return;

    activePresses.delete(pointerId);
    press.element.classList.remove('is-pressed');
    if (!animate || !press.element.isConnected) return;

    press.element.classList.add('is-press-releasing');
    const timeoutId = window.setTimeout(() => {
      press.element.classList.remove('is-press-releasing');
      press.element.classList.add('is-press-settling');
      const settleTimeoutId = window.setTimeout(() => {
        press.element.classList.remove('is-press-settling');
        releaseTimeouts.delete(press.element);
      }, settleDurationMs);
      releaseTimeouts.set(press.element, settleTimeoutId);
    }, releaseDurationMs);
    releaseTimeouts.set(press.element, timeoutId);
  };

  document.addEventListener(
    'pointerdown',
    (event) => {
      if (
        event.isPrimary === false ||
        (event.pointerType === 'mouse' && event.button !== 0)
      )
        return;

      const pressable = findPressable(event.target);
      if (!pressable || isDisabled(pressable)) return;
      beginPress(pressable, event.pointerId, event.clientX, event.clientY);
    },
    { passive: true }
  );

  document.addEventListener(
    'pointermove',
    (event) => {
      const press = activePresses.get(event.pointerId);
      if (!press) return;

      const movedX = event.clientX - press.clientX;
      const movedY = event.clientY - press.clientY;
      if (Math.hypot(movedX, movedY) > moveTolerancePx) {
        endPress(event.pointerId, { animate: false });
      }
    },
    { passive: true }
  );

  document.addEventListener(
    'pointerup',
    (event) => {
      endPress(event.pointerId);
    },
    { passive: true }
  );

  document.addEventListener(
    'pointercancel',
    (event) => {
      endPress(event.pointerId, { animate: false });
    },
    { passive: true }
  );

  window.addEventListener('blur', () => {
    [...activePresses.keys()].forEach((pointerId) => {
      endPress(pointerId, { animate: false });
    });
  });
}

setupButtonPressFeedback();
