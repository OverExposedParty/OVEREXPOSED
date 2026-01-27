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
