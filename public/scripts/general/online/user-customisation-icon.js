const placeholderUserCustomisationIcon = document.getElementById('user-customisation-placeholder');

let colourSlot = [];
let headSlot = [];
let eyesSlot = [];
let mouthSlot = [];

async function loadActivePacks(masterJsonPath) {
  try {
    const response = await fetch(masterJsonPath);
    const packs = await response.json();

    for (const pack of packs) {
      if (pack["pack-status"] === "active") {
        const nestedResponse = await fetch(pack["pack-path"]);
        const nestedData = await nestedResponse.json();

        // Loop through all keys (pack categories) in the nested pack
        for (const packKey in nestedData) {
          if (Array.isArray(nestedData[packKey])) {
            for (const item of nestedData[packKey]) {
              const entry = {
                id: item.id,
                name: item.name,
                filePath: item["file-path"]
              };

              switch (item.slot) {
                case "colour":
                  colourSlot.push(entry);
                  break;
                case "head-slot":
                  headSlot.push(entry);
                  break;
                case "eyes-slot":
                  eyesSlot.push(entry);
                  break;
                case "mouth-slot":
                  mouthSlot.push(entry);
                  break;
                default:
                  console.warn("Unknown slot type:", item.slot);
              }
            }
          }
        }
      }
    }
    if (placeholderUserCustomisationIcon) {
      UpdateCustomisation({
        initialLoad: true
      });
    }

  } catch (error) {
    console.error("Failed to load packs:", error);
  }
}

function EditUserIconPartyGames({ container, userId, userCustomisationString }) {
  if (container.querySelector('.icon')) {
    container.querySelector('.icon').setAttribute('data-user-id', userId);
  }
  const parsed = parseCustomisationString(userCustomisationString);
  const userCustomisation = {
    colour: getFilePathByCustomisationId(parsed.colour),
    headSlot: getFilePathByCustomisationId(parsed.head),
    eyesSlot: getFilePathByCustomisationId(parsed.eyes),
    mouthSlot: getFilePathByCustomisationId(parsed.mouth),
  };
  EditImageStack(userCustomisation, userId, container);
}

async function createUserIconPartyGames({ container, userId, userCustomisationString, size = null }) {
    const userIcon = document.createElement('div');
    userIcon.className = 'icon';
    userIcon.setAttribute('data-user-id', userId);

    if (size !== null) {
      userIcon.classList.add(size);
    }

    const parsed = parseCustomisationString(userCustomisationString);
    const userCustomisation = {
      colour: getFilePathByCustomisationId(parsed.colour),
      headSlot: getFilePathByCustomisationId(parsed.head),
      eyesSlot: getFilePathByCustomisationId(parsed.eyes),
      mouthSlot: getFilePathByCustomisationId(parsed.mouth),
    };
    userIcon.appendChild(CreateImageStack(userCustomisation));
    container.appendChild(userIcon);
}

function getPartyHostComputerId(partyData = currentPartyData) {
  return partyData?.state?.hostComputerId || hostDeviceId || null;
}

function canCurrentUserKickPlayers(partyData = currentPartyData) {
  const partyHostId = getPartyHostComputerId(partyData);
  return Boolean(hostedParty || (partyHostId && String(partyHostId) === String(deviceId)));
}

function setUserIconKickButton(userIcon, { canKick = false } = {}) {
  if (!userIcon) return;

  const existingCloseBtn = userIcon.querySelector('.close-btn');
  const userId = userIcon.getAttribute('data-user-id');

  if (!canKick || !userId || String(userId) === String(deviceId)) {
    existingCloseBtn?.remove();
    return;
  }

  if (existingCloseBtn) return;

  const closeBtn = document.createElement('span');
  closeBtn.className = 'close-btn';
  closeBtn.textContent = '×';
  closeBtn.addEventListener('click', () => {
    const targetUserId = userIcon.getAttribute('data-user-id');
    if (!targetUserId || String(targetUserId) === String(deviceId)) return;
    if (!canCurrentUserKickPlayers()) return;

    RemoveUserFromParty(targetUserId);
    userIcon.remove();
  });

  const nameContainer = userIcon.querySelector('.name-container');
  if (nameContainer?.nextSibling) {
    userIcon.insertBefore(closeBtn, nameContainer.nextSibling);
  } else {
    userIcon.appendChild(closeBtn);
  }
}

function createUserIcon({ userId, username, checked = false, canKick = false }) {
  const userIcon = document.createElement('div');
  userIcon.className = 'user-icon';
  userIcon.setAttribute('data-user-id', userId);

  const nameContainer = document.createElement('div');
  nameContainer.className = 'name-container';

  const checkmark = document.createElement('span');
  checkmark.className = 'checkmark';
  if (checked) checkmark.classList.add('checked');

  const nameSpan = document.createElement('span');
  nameSpan.className = 'username';
  nameSpan.textContent = username;

  if (username.length > 10) {
    nameSpan.classList.add('long-name');
  }

  nameContainer.append(nameSpan, checkmark);
  userIcon.append(nameContainer);
  setUserIconKickButton(userIcon, { canKick });

  // Image stack from blank customisation
  userIcon.appendChild(CreateImageStack(blankUserCustomisation));
  document.getElementById('users').appendChild(userIcon);
}

function CreateImageStack(customisation) {
  const imageStack = document.createElement('div');
  imageStack.className = 'image-stack';

  const images = Object.values(customisation);
  const keys = Object.keys(customisation);

  for (let i = 0; i < keys.length; i++) {
    const img = document.createElement('img');
    img.src = images[i];
    img.alt = `User ${i + 1}`;
    img.id = toKebabCase(keys[i]);
    imageStack.appendChild(img);
  }
  return imageStack;
}

function EditImageStack(customisation, userId, container) {
  // find the icon with the correct userId
  const icon = container.querySelector(`.icon[data-user-id="${userId}"]`);
  if (!icon) return;

  const imageStack = icon.querySelector('.image-stack');
  const images = Object.values(customisation);
  const keys = Object.keys(customisation);

  for (let i = 0; i < keys.length; i++) {
    const img = imageStack.querySelector(`img:nth-child(${i + 1})`);
    if (img) {
      img.src = images[i];
      img.id = toKebabCase(keys[i]);
    }
  }
}

function editUserIcon({ userId, newUsername, userReady, userIcon }) {
  const userIconContainer = document.querySelector(`.user-icon[data-user-id="${userId}"]`);
  parsedUserIcon = parseCustomisationString(userIcon);
  if (userIconContainer) {
    const nameSpan = userIconContainer.querySelector('.username');
    if (nameSpan) {
      nameSpan.textContent = newUsername;
      if (newUsername.length > 10) {
        nameSpan.classList.add('long-name');
      }
    }

    const checkbox = userIconContainer.querySelector('.checkmark');
    if (userReady) {
      checkbox.classList.add('checked');
    }
    else {
      checkbox.classList.remove('checked');
    }
    const imageStackContainer = userIconContainer.querySelector('.image-stack');
    imageStackContainer.querySelectorAll('img').forEach((img) => {
      if (img.id === 'colour') img.src = getFilePathByCustomisationId(parsedUserIcon.colour);
      else if (img.id === 'head-slot') img.src = getFilePathByCustomisationId(parsedUserIcon.head);
      else if (img.id === 'eyes-slot') img.src = getFilePathByCustomisationId(parsedUserIcon.eyes);
      else if (img.id === 'mouth-slot') img.src = getFilePathByCustomisationId(parsedUserIcon.mouth);
      else console.warn(`Unknown customisation ID: ${img.id}`);
    });
  }
  else {
    console.warn(`User icon with ID ${userId} not found.`);
  }
}

function deleteUserIcon(userId) {
  const userIcon = document.querySelector(`.user-icon[data-user-id="${userId}"]`);
  if (userIcon) {
    userIcon.remove();
  } else {
    console.warn(`User icon with ID ${userId} not found.`);
  }
}

async function UpdateUserIcons(partyData) {
  const userIconDivs = document.querySelectorAll('.user-icon');
  const canKickPlayers = canCurrentUserKickPlayers(partyData);

  // ✅ New layout only
  const currentIds = partyData.players.map(player => player.identity.computerId);
  // Create or update icons
  for (let player of partyData.players) {
    const computerId = player.identity.computerId;
    const username = player.identity.username;
    const userIconString = player.identity.userIcon;
    const isReady = player.state.isReady;

    if (!computerId) {
      console.warn('Player missing computerId:', player);
      continue;
    }

    const userIconDiv = document.querySelector(`.user-icon[data-user-id="${computerId}"]`);

    if (!userIconDiv) {
      const isSelf = computerId == deviceId;

      createUserIcon({
        userId: computerId,
        username,
        checked: isSelf && isReady,
        canKick: canKickPlayers
      });
    }

    setUserIconKickButton(
      document.querySelector(`.user-icon[data-user-id="${computerId}"]`),
      { canKick: canKickPlayers }
    );

    // Always apply latest customisation/ready/name
    editUserIcon({
      userId: computerId,
      newUsername: username,
      userReady: isReady,
      userIcon: userIconString
    });
  }

  // Delete icons that are no longer in the party
  for (let i = 0; i < userIconDivs.length; i++) {
    const userId = userIconDivs[i].getAttribute('data-user-id');
    if (!currentIds.includes(userId)) {
      deleteUserIcon(userId);
    }
  }

  if (partyData.players.length > 4) {
    onlineSettingsContainer
      .querySelector(".container-section#users")
      .classList.add('small');
  } else {
    onlineSettingsContainer
      .querySelector(".container-section#users")
      .classList.remove('small');
  }

  userCount.textContent =
    `(${partyData.players.length}/${partyGamesInformation[partyGameMode].playerCountRestrictions.maxPlayers})`;
}


function parseCustomisationString(customisationString) {
  const [colour, head, eyes, mouth] = customisationString.split(':');

  return {
    colour,
    head,
    eyes,
    mouth
  };
}

function getFilePathByCustomisationId(customisationId) {
  if (customisationId == null) return null;

  const normalisedId = String(customisationId);

  const allItems = [
    ...colourSlot,
    ...headSlot,
    ...eyesSlot,
    ...mouthSlot
  ];
  const match = allItems.find(
    item => String(item.id) === normalisedId
  );

  return match ? match.filePath : null;
}


function toKebabCase(input) {
  return input.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
}

function createCustomisationString(userCustomisation) {
  return `${userCustomisation.colourSlotId}:${userCustomisation.headSlotId}:${userCustomisation.eyesSlotId}:${userCustomisation.mouthSlotId}`;
}

(async () => {
    try {
        await loadActivePacks('/json-files/customisation/customisation-packs.json');
        SetScriptLoaded('/scripts/general/online/user-customisation-icon.js');
        Ready.set('user-customisation-icon', true);
    } catch (err) {
        console.error("❌ Error loading user-customisation-icon scripts:", err);
    }
})();
