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
    if (!document.querySelector('script[src="/scripts/general/online/user-customisation-icon.js"]:not([data-standalone="true"])')) {
      SetScriptLoaded("/scripts/general/online/user-customisation-icon.js");
    }
    else {
      userCustomisationTasks.userIcons.taskCompleted = true;
      CheckUserCustomisationLoaded();
    }

  } catch (error) {
    console.error("Failed to load packs:", error);
  }
}

const packsLoadedPromise = loadActivePacks('/json-files/customisation/customisation-packs.json');

function EditUserIconPartyGames({ container, userId, userCustomisationString }) {
  packsLoadedPromise.then(() => {
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
  });
}
function createUserIconPartyGames({ container, userId, userCustomisationString, size = null }) {
  packsLoadedPromise.then(() => {
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
  });
}

function createUserIcon({ userId, username, checked = false }) {
  const userIcon = document.createElement('div');
  userIcon.className = 'user-icon';
  userIcon.setAttribute('data-user-id', userId);

  // Name + close button
  const closeBtn = document.createElement('span');
  closeBtn.className = 'close-btn';
  closeBtn.textContent = '×';
  closeBtn.addEventListener('click', () => {
    if (userIcon.getAttribute('data-user-id') != deviceId) {
      RemoveUserFromParty(userIcon.getAttribute('data-user-id'));
      userIcon.remove();
    }
  });

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
  userIcon.append(nameContainer, closeBtn);

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

function UpdateUserIcons(partyData) {
  const userIconDivs = document.querySelectorAll('.user-icon');
  const currentIds = partyData.players.map(player => player.computerId);
  // Create or update icons
  for (let player of partyData.players) {
    const userIconDiv = document.querySelector(`.user-icon[data-user-id="${player.computerId}"]`);
    if (!userIconDiv) {
      let newChecked;
      if (player.computerId == deviceId) {
        newChecked = true
      }
      else {
        newChecked = false
      }
      createUserIcon({
        userId: player.computerId,
        username: player.username,
        checked: false
      });
      //console.log('Created user icon for', player.username);
    }
    else {
      editUserIcon({
        userId: player.computerId,
        newUsername: player.username,
        userReady: player.isReady,
        userIcon: player.userIcon
      });
      //console.log('Edited user icon for', player.username);
    }
  }

  // Delete icons that are no longer in the party
  for (let i = 0; i < userIconDivs.length; i++) {
    const userId = userIconDivs[i].getAttribute('data-user-id');
    if (!currentIds.includes(userId)) {
      deleteUserIcon(userId);
    }
  }
  if (partyData.players.length > 4) {
    onlineSettingsContainer.querySelector(".container-section#users").classList.add('small');
  }
  else {
    onlineSettingsContainer.querySelector(".container-section#users").classList.remove('small');
  }
  userCount.textContent = `(${partyData.players.length}/${partyGamesInformation[partyGameMode].playerCountRestrictions.maxPlayers})`;
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

  const allItems = [
    ...colourSlot,
    ...headSlot,
    ...eyesSlot,
    ...mouthSlot
  ];
  const match = allItems.find(item => item.id === customisationId);
  return match ? match.filePath : null;
}

function toKebabCase(input) {
  return input.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
}
