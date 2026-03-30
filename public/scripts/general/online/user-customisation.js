gameContainers = gameContainers || [];
let userCustomisationInitialised = false;

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
  if (
    !userCustomisationContainerSlotColour ||
    !userCustomisationContainerSlotHead ||
    !userCustomisationContainerSlotEyes ||
    !userCustomisationContainerSlotMouth ||
    !userCustomisationImageColourSlot ||
    !userCustomisationImageHeadSlot ||
    !userCustomisationImageEyes ||
    !userCustomisationImageMouth
  ) {
    return;
  }

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
  if (!elements || !elements.image || !elements.label || !elements.container) return;
  if (typeof index === "number" && index >= 0 && index < slotArray.length) {
    const item = slotArray[index];
    if (inactiveIds.includes(item.id)) return; // skip inactive items
    elements.image.src = item.filePath;
    elements.label.textContent = item.name;
    elements.container.setAttribute('data-id', item.id);
    elements.container.setAttribute('data-index', index);
  }
}

function toggleUserCustomisation(permanant = false,) {
  if (permanant == true && !isContainerVisible(userCustomisationContainer)) {
    toggleClass(userCustomisationContainer, permanantElementClassArray);
  }
  else if (permanant == false && !isContainerVisible(userCustomisationContainer)) {
    toggleClass(userCustomisationContainer, settingsElementClassArray);
  }
  else {
    removeElementIfExists(settingsElementClassArray, userCustomisationContainer);
    removeElementIfExists(permanantElementClassArray, userCustomisationContainer);
    hideContainer(userCustomisationContainer);
    toggleOverlay(false);
  }
}

function toggleUserCustomisationIcon(bool) {
  if (bool === true) {
    userCustomisationIconButton.classList.remove('disabled');
  } else {
    userCustomisationIconButton.classList.add('disabled');
  }
}

(async () => {
  if (rightHeaderContainer) {
    SetScriptLoaded('/scripts/general/online/user-customisation.js');
    Ready.set('user-customisation', true);
  }
  
  waitForFunction("SetUserCustomisationLoaded", () => {
    SetUserCustomisationLoaded();
  })
})();

function randomiseCustomisation() {
  const inactiveIds = getInactiveIds();

  const blankFiles = new Set([
    blankUserCustomisation.colour,
    blankUserCustomisation.headSlot,
    blankUserCustomisation.eyesSlot,
    blankUserCustomisation.mouthSlot
  ]);

  function getRandomActiveIndex(slotArray) {
    const activeItems = slotArray.filter(item => {
      const isInactive = inactiveIds.includes(item.id);
      const isBlank = blankFiles.has(item.filePath);
      return !isInactive && !isBlank;
    });

    if (activeItems.length === 0) return 0;

    const randomItem = activeItems[Math.floor(Math.random() * activeItems.length)];
    return slotArray.findIndex(item => item.id === randomItem.id);
  }

  const colourIndex = getRandomActiveIndex(colourSlot);
  const headSlotIndex = getRandomActiveIndex(headSlot);
  const eyesSlotIndex = getRandomActiveIndex(eyesSlot);
  const mouthSlotIndex = getRandomActiveIndex(mouthSlot);

  UpdateCustomisation({
    colourIndex,
    headSlotIndex,
    eyesSlotIndex,
    mouthSlotIndex
  });

  userCustomisationContainerSlotColour.setAttribute("data-index", colourIndex);
  userCustomisationContainerSlotHead.setAttribute("data-index", headSlotIndex);
  userCustomisationContainerSlotEyes.setAttribute("data-index", eyesSlotIndex);
  userCustomisationContainerSlotMouth.setAttribute("data-index", mouthSlotIndex);
}

async function checkForGameSettingsUpdates(data) {
  if (partyUserCount < partyGamesInformation[partyGameMode].playerCountRestrictions.minPlayers) {
    //setError(errorNotEnoughPlayers, true);
  } else {
    setError(errorNotEnoughPlayers, false);
  }
  await UpdateUserIcons(data);
  if (sessionPartyType == "party-mafia") {
    UpdateRoleCount();
  }
}

function SetUserCustomisationLoaded() {
  if (userCustomisationInitialised) return;
  if (!userCustomisationOptions || typeof userCustomisationOptions.length !== "number" || userCustomisationOptions.length === 0) {
    setTimeout(SetUserCustomisationLoaded, 50);
    return;
  }

  if (userCustomisationContainer && !gameContainers.includes(userCustomisationContainer)) {
    gameContainers.push(userCustomisationContainer);
  }

  if (userCustomisationRandomiseButton) {
    userCustomisationRandomiseButton.addEventListener("click", () => {
      randomiseCustomisation();
    });
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
        showContainer(gamemodeSettingsContainer);
      }
    } else if (typeof renderOESOptions === "function") {
      rerenderSelectedButtons();
    }
    renderUserCustomisationHeaderIcon();
  });

  userCustomisationInitialised = true;
}
