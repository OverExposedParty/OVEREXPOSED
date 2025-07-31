hostedParty = true;
let partyUserCount = 0;

function createUserIcon(userId, username, checked = false) {
  const userIcon = document.createElement('div');
  userIcon.className = 'user-icon';
  userIcon.setAttribute('data-user-id', userId); // Add userId as a data attribute

  const checkmark = document.createElement('span');
  checkmark.className = 'checkmark';
  if (checked) {
    checkmark.classList.add('checked');
  }

  const nameSpan = document.createElement('span');
  nameSpan.className = 'username';
  nameSpan.textContent = username;

  const closeBtn = document.createElement('span');
  closeBtn.className = 'close-btn';
  closeBtn.textContent = '×';
  closeBtn.addEventListener('click', () => {
    if (userIcon.getAttribute('data-user-id') != deviceId) {
      removeUserFromParty(partyCode, userIcon.getAttribute('data-user-id'));
      userIcon.remove(); // Remove the user icon when clicked
    }
  });

  // Do NOT add a click listener to checkmark — it is purely visual now
  userIcon.appendChild(checkmark);
  userIcon.appendChild(nameSpan);
  userIcon.appendChild(closeBtn);

  document.getElementById('users').appendChild(userIcon);
}

function editUserIcon(userId, newUsername, userReady) {
  const userIcon = document.querySelector(`.user-icon[data-user-id="${userId}"]`);
  if (userIcon) {
    const nameSpan = userIcon.querySelector('.username');
    if (nameSpan) {
      nameSpan.textContent = newUsername;
    }

    const checkbox = userIcon.querySelector('.checkmark');
    if (userReady) {
      checkbox.classList.add('checked');
    }
    else {
      checkbox.classList.remove('checked');
    }
  } else {
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
  const allUsersReady = partyData.players.every(player => player.isReady === true);
  updateStartGameButton(allUsersReady);

  const userIconDivs = document.querySelectorAll('.user-icon');
  const currentIds = partyData.players.map(player => player.computerId);
  // Create or update icons
  for (let player of partyData.players) {
    const userIconDiv = document.querySelector(`.user-icon[data-user-id="${player.computerId}"]`);
    if (!userIconDiv) {
      createUserIcon(player.computerId, player.username);
    } else {
      editUserIcon(player.computerId, player.username, player.isReady);
    }
  }

  // Delete icons that are no longer in the party
  for (let i = 0; i < userIconDivs.length; i++) {
    const userId = userIconDivs[i].getAttribute('data-user-id');
    if (!currentIds.includes(userId)) {
      deleteUserIcon(userId);
    }
  }

  userCount.textContent = `(${partyData.players.length}/8)`;
}

function checkForGameSettingsUpdates(data) {
  if (partyUserCount < minPlayerCount) {
    //errorNotEnoughPlayers.classList.add('active');
  }
  else {
    errorNotEnoughPlayers.classList.remove('active');
  }
  UpdateUserIcons(data);
  if (sessionPartyType == "party-mafia") { //&& partyUserCount !== data.computerIds.length
    UpdateRoleCount();
  }
}

window.addEventListener('beforeunload', function () {
  if (partyCode == null || loadingPage) return;
  deleteParty();
});