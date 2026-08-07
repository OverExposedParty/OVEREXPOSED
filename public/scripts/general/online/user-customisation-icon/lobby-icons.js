function createUserIcon({
  userId,
  username,
  accountId = '',
  userIcon: userIconString = USER_ICON_DEFAULT_STRING,
  checked = false,
  disconnected = false,
  signingIn = false,
  canKick = false
}) {
  const userIcon = document.createElement('div');
  userIcon.className = 'user-icon';
  userIcon.setAttribute('data-user-id', userId);
  userIcon.dataset.username = username || '';
  userIcon.dataset.accountId = accountId || '';
  const isSelf = String(userId) === String(deviceId);
  const menuContext = {
    userId,
    username,
    accountId,
    userIcon: userIconString,
    canKick,
    onKick: (targetUserId, tile) => {
      if (!targetUserId || String(targetUserId) === String(deviceId)) return;
      if (!canCurrentUserKickPlayers()) return;
      RemoveUserFromParty(targetUserId);
      tile?.remove();
    }
  };
  const showActionMenu =
    !isSelf && (canOpenOnlineUserActionMenu(menuContext) || canKick);

  const nameContainer = document.createElement('div');
  nameContainer.className = 'name-container';
  if (showActionMenu) {
    makeOnlineUserActionTrigger(
      nameContainer,
      userIcon,
      `Open ${username || 'player'} menu`
    );
  }

  const checkmark = document.createElement('span');
  checkmark.className = 'checkmark';
  setCheckmarkStatus(checkmark, { checked, disconnected, signingIn });

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
  const imageStack = CreateImageStack(blankUserCustomisation);
  if (showActionMenu) {
    makeOnlineUserActionTrigger(
      imageStack,
      userIcon,
      `Open ${username || 'player'} menu`
    );
  }
  userIcon.appendChild(imageStack);
  syncOnlineUserActionMenu(userIcon, menuContext);
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

function editUserIcon({
  userId,
  newUsername,
  userReady,
  userDisconnected = false,
  userSigningIn = false,
  userIcon
}) {
  const userIconContainer = document.querySelector(
    `.user-icon[data-user-id="${userId}"]`
  );
  const parsedUserIcon = parseCustomisationString(
    userIcon || USER_ICON_DEFAULT_STRING
  );
  if (userIconContainer) {
    const nameSpan = userIconContainer.querySelector('.username');
    if (nameSpan) {
      nameSpan.textContent = newUsername;
      if (newUsername.length > 10) {
        nameSpan.classList.add('long-name');
      }
    }

    const checkbox = userIconContainer.querySelector('.checkmark');
    setCheckmarkStatus(checkbox, {
      checked: Boolean(userReady),
      disconnected: Boolean(userDisconnected),
      signingIn: Boolean(userSigningIn)
    });
    const imageStackContainer = userIconContainer.querySelector('.image-stack');
    imageStackContainer.querySelectorAll('img').forEach((img) => {
      if (img.id === 'colour')
        img.src = getFilePathByCustomisationId(parsedUserIcon.colour, 'colour');
      else if (img.id === 'head-slot')
        img.src = getFilePathByCustomisationId(parsedUserIcon.head, 'headSlot');
      else if (img.id === 'eyes-slot')
        img.src = getFilePathByCustomisationId(parsedUserIcon.eyes, 'eyesSlot');
      else if (img.id === 'mouth-slot')
        img.src = getFilePathByCustomisationId(
          parsedUserIcon.mouth,
          'mouthSlot'
        );
      else console.warn(`Unknown customisation ID: ${img.id}`);
    });
  } else {
    console.warn(`User icon with ID ${userId} not found.`);
  }
}

function deleteUserIcon(userId) {
  const userIcon = document.querySelector(
    `.user-icon[data-user-id="${userId}"]`
  );
  if (userIcon) {
    userIcon.remove();
  } else {
    console.warn(`User icon with ID ${userId} not found.`);
  }
}

async function UpdateUserIcons(partyData) {
  const players = Array.isArray(partyData?.players) ? partyData.players : [];
  const usersContainer =
    document.querySelector(
      '.online-game-settings-container .container-section#users'
    ) || document.getElementById('users');
  if (!usersContainer) return;

  const canKickPlayers = canCurrentUserKickPlayers(partyData);

  if (window.OELobbyPlayerList?.render && usersContainer) {
    usersContainer
      .querySelectorAll(':scope > .user-icon:not(.oe-lobby-player-tile)')
      .forEach((icon) => icon.remove());

    window.OELobbyPlayerList.render(usersContainer, players, {
      currentUserId: deviceId,
      canKick: (player) => {
        const computerId = player.userId || player.identity?.computerId;
        return canKickPlayers && String(computerId) !== String(deviceId);
      },
      onKick: (targetUserId, tile) => {
        if (!targetUserId || String(targetUserId) === String(deviceId)) return;
        if (!canCurrentUserKickPlayers()) return;

        RemoveUserFromParty(targetUserId);
        tile?.remove();
      }
    });

    if (players.length > 4) {
      usersContainer.classList.add('small');
    } else {
      usersContainer.classList.remove('small');
    }

    updateLobbyUserCount(players.length);
    return;
  }

  const userIconDivs = document.querySelectorAll('.user-icon');

  // ✅ New layout only
  const currentIds = players
    .map((player) => player.identity?.computerId)
    .filter(Boolean);
  // Create or update icons
  for (let player of players) {
    const computerId = player.identity?.computerId;
    const accountId = player.identity?.accountId || '';
    const username = player.identity?.username || 'Player';
    const userIconString =
      player.identity?.userIcon || USER_ICON_DEFAULT_STRING;
    const isReady = player.state?.isReady === true;
    const socketId = player.connection?.socketId ?? player.socketId ?? '';
    const participationStatus = String(
      player.state?.participationStatus || player.participationStatus || ''
    ).toLowerCase();
    const hasDisconnectedSocket = socketId === 'DISCONNECTED';
    const hasLiveSocket = Boolean(socketId) && !hasDisconnectedSocket;
    const isSigningIn = participationStatus === 'reconnecting';
    const isDisconnected =
      isSigningIn ||
      hasDisconnectedSocket ||
      (!hasLiveSocket && participationStatus === 'disconnected');

    if (!computerId) {
      console.warn('Player missing computerId:', player);
      continue;
    }

    const userIconDiv = document.querySelector(
      `.user-icon[data-user-id="${computerId}"]`
    );

    if (!userIconDiv) {
      const isSelf = computerId == deviceId;

      createUserIcon({
        userId: computerId,
        username,
        accountId,
        userIcon: userIconString,
        checked: isSelf && isReady,
        disconnected: isDisconnected,
        signingIn: isSigningIn,
        canKick: canKickPlayers
      });
    }

    const latestUserIconDiv = document.querySelector(
      `.user-icon[data-user-id="${computerId}"]`
    );
    if (latestUserIconDiv) {
      latestUserIconDiv.dataset.username = username;
      latestUserIconDiv.dataset.accountId = accountId;
      syncOnlineUserActionMenu(latestUserIconDiv, {
        userId: computerId,
        username,
        accountId,
        userIcon: userIconString,
        canKick: canKickPlayers,
        onKick: (targetUserId, tile) => {
          if (!targetUserId || String(targetUserId) === String(deviceId)) return;
          if (!canCurrentUserKickPlayers()) return;
          RemoveUserFromParty(targetUserId);
          tile?.remove();
        }
      });
    }

    setUserIconKickButton(
      latestUserIconDiv,
      { canKick: canKickPlayers }
    );

    // Always apply latest customisation/ready/name
    editUserIcon({
      userId: computerId,
      newUsername: username,
      userReady: isReady,
      userDisconnected: isDisconnected,
      userSigningIn: isSigningIn,
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

  if (players.length > 4) {
    usersContainer.classList.add('small');
  } else {
    usersContainer.classList.remove('small');
  }

  updateLobbyUserCount(players.length);
}

function updateLobbyUserCount(playerCount) {
  const countElement = document.querySelector('.user-count');
  if (!countElement) return;

  const currentGamemode =
    typeof partyGameMode === 'undefined' ? '' : partyGameMode;
  const gamemodeInformation =
    typeof partyGamesInformation === 'undefined'
      ? null
      : partyGamesInformation[currentGamemode];
  const maxPlayers = gamemodeInformation?.playerCountRestrictions?.maxPlayers;

  if (Number.isFinite(maxPlayers)) {
    countElement.textContent = `(${playerCount}/${maxPlayers})`;
  }
}
