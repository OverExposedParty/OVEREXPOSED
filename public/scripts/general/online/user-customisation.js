const rightHeaderContainer = document.querySelector('.header-icon-container.row.right');
let userCustomisationIcon;

gameContainers.push(
  userCustomisationContainer
);

const blankUserCustomisation = {
  colour: '/images/user-customisation/colour/blank/blank-colour.svg',
  headSlot: '/images/user-customisation/head-slot/blank/no-head-slot.svg',
  eyesSlot: '/images/user-customisation/eyes-slot/blank/no-eyes-slot.svg',
  mouthSlot: '/images/user-customisation/mouth-slot/blank/no-mouth-slot.svg'
};

//userCustomisationContainer.classList.add('active');

function UpdateCustomisation({ colourIndex, headSlotIndex, eyesSlotIndex, mouthSlotIndex, initialLoad = false }) {
  function getIndexById(slotArray, storageKey) {
    const savedId = localStorage.getItem(storageKey);
    const index = slotArray.findIndex(item => item.id === savedId);
    return index !== -1 ? index : 0;
  }

  if (initialLoad) {
    colourIndex = getIndexById(colourSlot, "user-customisation-colour-id");
    headSlotIndex = getIndexById(headSlot, "user-customisation-head-slot-id");
    eyesSlotIndex = getIndexById(eyesSlot, "user-customisation-eyes-slot-id");
    mouthSlotIndex = getIndexById(mouthSlot, "user-customisation-mouth-slot-id");
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
}

function applyCustomisation(slotArray, index, elements) {
  if (typeof index === "number" && index >= 0 && index < slotArray.length) {
    const item = slotArray[index];
    elements.image.src = item.filePath;
    elements.label.textContent = item.name;
    elements.container.setAttribute('data-id', item.id);
    elements.container.setAttribute('data-index', index);
  }
}

function createCustomisationString() {
  const colour = localStorage.getItem('user-customisation-colour-id');
  const head = localStorage.getItem('user-customisation-head-slot-id');
  const eyes = localStorage.getItem('user-customisation-eyes-slot-id');
  const mouth = localStorage.getItem('user-customisation-mouth-slot-id');

  return `${colour}:${head}:${eyes}:${mouth}`;
}

userCustomisationOptions.forEach(option => {
  option.querySelector('.arrow-previous').addEventListener('click', () => {
    const slotId = option.id;
    let currentIndex = parseInt(option.getAttribute('data-index')) || 0;

    if (slotId === 'colour') {
      currentIndex = (currentIndex - 1 + colourSlot.length) % colourSlot.length;
      UpdateCustomisation({ colourIndex: currentIndex });
    } else if (slotId === 'head-slot') {
      currentIndex = (currentIndex - 1 + headSlot.length) % headSlot.length;
      UpdateCustomisation({ headSlotIndex: currentIndex });
    } else if (slotId === 'eyes-slot') {
      currentIndex = (currentIndex - 1 + eyesSlot.length) % eyesSlot.length;
      UpdateCustomisation({ eyesSlotIndex: currentIndex });
    } else if (slotId === 'mouth-slot') {
      currentIndex = (currentIndex - 1 + mouthSlot.length) % mouthSlot.length;
      UpdateCustomisation({ mouthSlotIndex: currentIndex });
    }

    option.setAttribute('data-index', currentIndex);
  })

  option.querySelector('.arrow-next').addEventListener('click', () => {
    const slotId = option.id;
    let currentIndex = parseInt(option.getAttribute('data-index')) || 0;

    if (slotId === 'colour') {
      currentIndex = (currentIndex + 1 + colourSlot.length) % colourSlot.length;
      UpdateCustomisation({ colourIndex: currentIndex });
    } else if (slotId === 'head-slot') {
      currentIndex = (currentIndex + 1 + headSlot.length) % headSlot.length;
      UpdateCustomisation({ headSlotIndex: currentIndex });
    } else if (slotId === 'eyes-slot') {
      currentIndex = (currentIndex + 1 + eyesSlot.length) % eyesSlot.length;
      UpdateCustomisation({ eyesSlotIndex: currentIndex });
    } else if (slotId === 'mouth-slot') {
      currentIndex = (currentIndex + 1 + mouthSlot.length) % mouthSlot.length;
      UpdateCustomisation({ mouthSlotIndex: currentIndex });
    }

    option.setAttribute('data-index', currentIndex);
  })
});

usercustomisationSaveButton.addEventListener('click', async () => {
  localStorage.setItem("user-customisation-colour-id", userCustomisationContainerSlotColour.getAttribute('data-id'));
  localStorage.setItem("user-customisation-head-slot-id", userCustomisationContainerSlotHead.getAttribute('data-id'));
  localStorage.setItem("user-customisation-eyes-slot-id", userCustomisationContainerSlotEyes.getAttribute('data-id'));
  localStorage.setItem("user-customisation-mouth-slot-id", userCustomisationContainerSlotMouth.getAttribute('data-id'));
  toggleUserCustomisation();
  const customisationString = createCustomisationString();
  if (partyCode) {
    await UpdateUserPartyData({
      partyId: partyCode,
      computerId: deviceId,
      newUserIcon: customisationString,
      newsocketId: socket.id
    });
    if (placeholderUserCustomisation.classList.contains('waiting-room')) {
      gamemodeSettingsContainer.classList.add('active');
    }
  }
});

function toggleUserCustomisation() {
  toggleClass(userCustomisationContainer, settingsElementClassArray);
}

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
    UpdateCustomisation({
      initialLoad: true
    });
    toggleUserCustomisation();
  });
  if(hostedParty) {
    userCustomisationIcon.classList.add('disabled');
  }
}


function checkForGameSettingsUpdates(data) {
  if (partyUserCount < minPlayerCount) {
    //setError(errorNotEnoughPlayers, true);
  }
  else {
    setError(errorNotEnoughPlayers, false);
  }
  UpdateUserIcons(data);
  if (sessionPartyType == "party-mafia") { //&& partyUserCount !== data.computerIds.length
    UpdateRoleCount();
  }
}