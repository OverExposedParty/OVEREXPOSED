const rightHeaderContainer = document.querySelector('.header-icon-container.row.right');
let userCustomisationIcon;

gameContainers = gameContainers || [];
gameContainers.push(userCustomisationContainer);

const blankUserCustomisation = {
  colour: '/images/user-customisation/colour/blank/blank-colour.svg',
  headSlot: '/images/user-customisation/head-slot/blank/no-head-slot.svg',
  eyesSlot: '/images/user-customisation/eyes-slot/blank/no-eyes-slot.svg',
  mouthSlot: '/images/user-customisation/mouth-slot/blank/no-mouth-slot.svg'
};

// 🔹 Get all inactive IDs from savedState
function getInactiveIds() {
    const inactiveIds = [];
    // Loop through all keys in localStorage
    Object.keys(localStorage).forEach(key => {
        if (key.startsWith('customisation-')) {
            const savedState = JSON.parse(localStorage.getItem(key)) || {};
            Object.keys(savedState).forEach(id => {
                if (!savedState[id]) inactiveIds.push(id);
            });
        }
    });
    return inactiveIds;
}

// 🔹 Get next valid index skipping inactive items
function getNextActiveIndex(slotArray, currentIndex, direction = 1) {
  const inactiveIds = getInactiveIds();
  let nextIndex = currentIndex;
  for (let i = 0; i < slotArray.length; i++) {
    nextIndex = (nextIndex + direction + slotArray.length) % slotArray.length;
    if (!inactiveIds.includes(slotArray[nextIndex].id)) break;
  }
  return nextIndex;
}

function UpdateCustomisation({ colourIndex, headSlotIndex, eyesSlotIndex, mouthSlotIndex, initialLoad = false }) {
  function getIndexById(slotArray, savedId) {
    const index = slotArray.findIndex(item => item.id === savedId);
    // Skip inactive items
    if (index !== -1 && getInactiveIds().includes(slotArray[index].id)) return 0;
    return index !== -1 ? index : 0;
  }

  let savedCustomisation = loadCustomisation();

  if (initialLoad) {
    colourIndex = getIndexById(colourSlot, savedCustomisation.colourSlotId);
    headSlotIndex = getIndexById(headSlot, savedCustomisation.headSlotId);
    eyesSlotIndex = getIndexById(eyesSlot, savedCustomisation.eyesSlotId);
    mouthSlotIndex = getIndexById(mouthSlot, savedCustomisation.mouthSlotId);
  }

  applyCustomisation(colourSlot, colourIndex, {
    image: userCustomisationImageColourSlot,
    label: userCustomisationLabelColourSlot,
    container: userCustomisationContainerSlotColour
  });

  applyCustomisation(headSlot, headSlotIndex, {
    image: userCustomisationImageHeadSlot,
    label: userCustomisationLabelHeadSlot,
    container: userCustomisationContainerSlotHead
  });

  applyCustomisation(eyesSlot, eyesSlotIndex, {
    image: userCustomisationImageEyes,
    label: userCustomisationLabelEyes,
    container: userCustomisationContainerSlotEyes
  });

  applyCustomisation(mouthSlot, mouthSlotIndex, {
    image: userCustomisationImageMouth,
    label: userCustomisationLabelMouth,
    container: userCustomisationContainerSlotMouth
  });

  savedCustomisation = {
    colourSlotId: userCustomisationContainerSlotColour.getAttribute("data-id"),
    headSlotId: userCustomisationContainerSlotHead.getAttribute("data-id"),
    eyesSlotId: userCustomisationContainerSlotEyes.getAttribute("data-id"),
    mouthSlotId: userCustomisationContainerSlotMouth.getAttribute("data-id")
  };

  saveCustomisation(savedCustomisation);
}

function applyCustomisation(slotArray, index, elements) {
  const inactiveIds = getInactiveIds();
  if (typeof index === "number" && index >= 0 && index < slotArray.length) {
    const item = slotArray[index];
    if (inactiveIds.includes(item.id)) return; // skip inactive items
    elements.image.src = item.filePath;
    elements.label.textContent = item.name;
    elements.container.setAttribute('data-id', item.id);
    elements.container.setAttribute('data-index', index);
  }
}

function createCustomisationString(userCustomisation) {
  return `${userCustomisation.colourSlotId}:${userCustomisation.headSlotId}:${userCustomisation.eyesSlotId}:${userCustomisation.mouthSlotId}`;
}

// Arrow navigation
userCustomisationOptions.forEach(option => {
  option.querySelector('.arrow-previous').addEventListener('click', () => {
    const slotId = option.id;
    let currentIndex = parseInt(option.getAttribute('data-index')) || 0;

    if (slotId === 'colour') {
      currentIndex = getNextActiveIndex(colourSlot, currentIndex, -1);
      UpdateCustomisation({ colourIndex: currentIndex });
    } else if (slotId === 'head-slot') {
      currentIndex = getNextActiveIndex(headSlot, currentIndex, -1);
      UpdateCustomisation({ headSlotIndex: currentIndex });
    } else if (slotId === 'eyes-slot') {
      currentIndex = getNextActiveIndex(eyesSlot, currentIndex, -1);
      UpdateCustomisation({ eyesSlotIndex: currentIndex });
    } else if (slotId === 'mouth-slot') {
      currentIndex = getNextActiveIndex(mouthSlot, currentIndex, -1);
      UpdateCustomisation({ mouthSlotIndex: currentIndex });
    }

    option.setAttribute('data-index', currentIndex);
  });

  option.querySelector('.arrow-next').addEventListener('click', () => {
    const slotId = option.id;
    let currentIndex = parseInt(option.getAttribute('data-index')) || 0;

    if (slotId === 'colour') {
      currentIndex = getNextActiveIndex(colourSlot, currentIndex, 1);
      UpdateCustomisation({ colourIndex: currentIndex });
    } else if (slotId === 'head-slot') {
      currentIndex = getNextActiveIndex(headSlot, currentIndex, 1);
      UpdateCustomisation({ headSlotIndex: currentIndex });
    } else if (slotId === 'eyes-slot') {
      currentIndex = getNextActiveIndex(eyesSlot, currentIndex, 1);
      UpdateCustomisation({ eyesSlotIndex: currentIndex });
    } else if (slotId === 'mouth-slot') {
      currentIndex = getNextActiveIndex(mouthSlot, currentIndex, 1);
      UpdateCustomisation({ mouthSlotIndex: currentIndex });
    }

    option.setAttribute('data-index', currentIndex);
  });
});

// Save button
usercustomisationSaveButton.addEventListener('click', async () => {
  const userCustomisation = {
    colourSlotId: userCustomisationContainerSlotColour.getAttribute('data-id'),
    headSlotId: userCustomisationContainerSlotHead.getAttribute('data-id'),
    eyesSlotId: userCustomisationContainerSlotEyes.getAttribute('data-id'),
    mouthSlotId: userCustomisationContainerSlotMouth.getAttribute('data-id')
  };

  localStorage.setItem("user-customisation", JSON.stringify(userCustomisation));
  toggleUserCustomisation();
  const customisationString = createCustomisationString(userCustomisation);

  if (typeof partyCode !== "undefined" && partyCode) {
    await UpdateUserPartyData({
      partyId: partyCode,
      computerId: deviceId,
      newUserIcon: customisationString
    });
    if (placeholderUserCustomisation.classList.contains('waiting-room')) {
      gamemodeSettingsContainer.classList.add('active');
    }
  } else if (typeof renderOESOptions === "function") {
    rerenderSelectedButtons();
  }
});

function toggleUserCustomisation() {
  toggleClass(userCustomisationContainer, settingsElementClassArray);
}

function toggleUserCustomisationIcon(bool) {
  if (bool === true) {
    userCustomisationIcon.classList.remove('disabled');
  } else {
    userCustomisationIcon.classList.add('disabled');
  }
}

// User icon in header
if (rightHeaderContainer) {
  userCustomisationIcon = document.createElement('div');
  userCustomisationIcon.classList.add('icon-container');

  const iconImage = document.createElement('img');
  iconImage.src = '/images/icons/user-customisation-icon.svg';
  iconImage.alt = 'User Customisation';
  iconImage.id = 'user-customisation-icon';
  userCustomisationIcon.appendChild(iconImage);
  rightHeaderContainer.appendChild(userCustomisationIcon);

  userCustomisationIcon.addEventListener('click', async () => {
    UpdateCustomisation({ initialLoad: true });
    toggleUserCustomisation();
  });

  if (typeof hostedParty !== "undefined" && hostedParty) {
    userCustomisationIcon.classList.add('disabled');
  }
}

// Optional: Game settings updates
function checkForGameSettingsUpdates(data) {
  if (partyUserCount < minPlayerCount) {
    //setError(errorNotEnoughPlayers, true);
  } else {
    setError(errorNotEnoughPlayers, false);
  }
  UpdateUserIcons(data);
  if (sessionPartyType == "party-mafia") {
    UpdateRoleCount();
  }
}
