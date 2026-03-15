const placeholderUserCustomisation = document.getElementById('user-customisation-placeholder');

const DEFAULT_ICON = "0000:0100:0200:0300";

let userCustomisationContainer;
let usercustomisationSaveButton, userCustomisationRandomiseButton;
let userCustomisationContainerSlotColour, userCustomisationContainerSlotHead, userCustomisationContainerSlotEyes, userCustomisationContainerSlotMouth;
let userCustomisationLabelColourSlot, userCustomisationLabelHeadSlot, userCustomisationLabelEyes, userCustomisationLabelMouth;
let userCustomisationImageColourSlot, userCustomisationImageHeadSlot, userCustomisationImageEyes, userCustomisationImageMouth;
let userCustomisationOptions = [];

const userCustomisationTasks = {
  userIcons: {
    taskCompleted: false
  },
  userCustomisation: {
    taskCompleted: false
  }
};

const blankUserCustomisation = {
  colour: '/images/user-customisation/colour/blank/blank-colour.svg',
  headSlot: '/images/user-customisation/head-slot/blank/no-head-slot.svg',
  eyesSlot: '/images/user-customisation/eyes-slot/blank/no-eyes-slot.svg',
  mouthSlot: '/images/user-customisation/mouth-slot/blank/no-mouth-slot.svg'
};


const cssFilesUserCustomisation = [
  '/css/general/online/user-customisation.css',
  '/css/general/online/user-customisation-icon.css'
];

cssFilesUserCustomisation.forEach(href => {
  LoadStylesheet(href);
});

async function initialiseCustomisationPackDefaults() {
  try {
    const response = await fetch('/json-files/customisation/customisation-packs.json');
    const packs = await response.json();

    packs.forEach(pack => {
      if (localStorage.getItem(`customisation-${pack["pack-name"]}-active`) === null) {
        localStorage.setItem(`customisation-${pack["pack-name"]}-active`, 'true');
      }
    });
  } catch (error) {
    console.error('Error initialising customisation pack defaults:', error);
  }
}

fetch('/html-templates/user-customisation.html')
  .then(response => response.text())
  .then(data => {
    return new Promise(resolve => {
      placeholderUserCustomisation.insertAdjacentHTML('beforeend', data);
      requestAnimationFrame(() => {
        resolve();
      });
    });
  })
  .then(() => initialiseCustomisationPackDefaults())
  .then(() => {
    userCustomisationContainer = document.querySelector('.user-customisation-container');

    userCustomisationContainerSlotColour = userCustomisationContainer.querySelector('#colour');
    userCustomisationContainerSlotHead = userCustomisationContainer.querySelector('#head-slot');
    userCustomisationContainerSlotEyes = userCustomisationContainer.querySelector('#eyes-slot');
    userCustomisationContainerSlotMouth = userCustomisationContainer.querySelector('#mouth-slot');

    userCustomisationLabelColourSlot = userCustomisationContainerSlotColour.querySelector('.user-customisation-option-title');
    userCustomisationLabelHeadSlot = userCustomisationContainerSlotHead.querySelector('.user-customisation-option-title');
    userCustomisationLabelEyes = userCustomisationContainerSlotEyes.querySelector('.user-customisation-option-title');
    userCustomisationLabelMouth = userCustomisationContainerSlotMouth.querySelector('.user-customisation-option-title');

    userCustomisationImageColourSlot = userCustomisationContainer.querySelector('.user-customisation-character.layer-colour');
    userCustomisationImageHeadSlot = userCustomisationContainer.querySelector('.user-customisation-character.layer-head-slot');
    userCustomisationImageEyes = userCustomisationContainer.querySelector('.user-customisation-character.layer-eyes-slot');
    userCustomisationImageMouth = userCustomisationContainer.querySelector('.user-customisation-character.layer-mouth-slot');

    usercustomisationSaveButton = userCustomisationContainer.querySelector('#save-customisation');
    userCustomisationRandomiseButton = userCustomisationContainer.querySelector('#randomise-customisation');
    userCustomisationOptions = userCustomisationContainer.querySelectorAll('.user-customisation-option');
  }).then(() => {
        return waitForGlobals([
      'loadCustomisation',
      'saveCustomisation',
      'getUserIconString'
    ]);
  })
  .then(() => {
    SetScriptLoaded('/scripts/html-templates/online/html-template-user-customisation.js');
  })
  .catch(error => console.error('Error loading user customization:', error));


function loadCustomisation() {
  const saved = localStorage.getItem("user-customisation");
  return saved ? JSON.parse(saved) : {};
}

function saveCustomisation(customisation) {
  localStorage.setItem("user-customisation", JSON.stringify(customisation));
}

function getUserIconString() {
  const stored = localStorage.getItem("user-customisation");

  if (!stored) {
    return "0000:0100:0200:0300";
  }

  try {
    const data = JSON.parse(stored);

    return [
      data.colourSlotId,
      data.headSlotId,
      data.eyesSlotId,
      data.mouthSlotId
    ].join(":");
  } catch {
    return "0000:0100:0200:0300";
  }
}
