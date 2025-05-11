hostedParty = true;
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
    removeUserFromParty(partyCode, userIcon.getAttribute('data-user-id'));
    userIcon.remove(); // Remove the user icon when clicked
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
    if(userReady){
      checkbox.classList.add('checked');
    }
    else{
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
  const allUsersReady = partyData.usersReady.every(userReady => userReady === true);
  updateStartGameButton(allUsersReady);
  const userIconDivs = document.querySelectorAll('.user-icon');
  for (let i = 0; i < partyData.computerIds.length; i++) {
    const userIconDiv = document.querySelector(`.user-icon[data-user-id="${partyData.computerIds[i]}"]`);
    if(!userIconDiv){
      createUserIcon(partyData.computerIds[i], partyData.usernames[i]) 
    }
    else{
      editUserIcon(partyData.computerIds[i], partyData.usernames[i], partyData.usersReady[i]) 
    }
  }
  for (let i = 0; i < userIconDivs.length; i++) {
    if (!partyData.computerIds.includes(userIconDivs[i].getAttribute('data-user-id'))) {
      deleteUserIcon(partyData.computerIds[i])
    }
  }
  userCount.textContent = "(" + partyData.computerIds.length + "/8)";
}
function checkForGameSettingsUpdates(data) {
    UpdateUserIcons(data);
}

window.addEventListener('beforeunload', () => {
  if (!partyCode) return;

  if (!existingData || existingData.length === 0) {
    console.warn('No party data found.');
    return;
  }
  deleteParty();
});