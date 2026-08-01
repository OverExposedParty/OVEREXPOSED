function closeOnlineUserActionMenus(exceptUserIcon = null) {
  document.querySelectorAll('.user-icon.menu-open').forEach((userIcon) => {
    if (userIcon !== exceptUserIcon) {
      userIcon.classList.remove('menu-open');
    }
  });
}

function toggleOnlineUserActionMenu(userIcon) {
  const isOpen = userIcon.classList.contains('menu-open');
  closeOnlineUserActionMenus(userIcon);
  userIcon.classList.toggle('menu-open', !isOpen);
}

function handleOnlineUserActionTrigger(event, userIcon) {
  if (!userIcon.querySelector('.user-action-menu')) return;
  event.stopPropagation();
  toggleOnlineUserActionMenu(userIcon);
}

function handleOnlineUserActionTriggerKeydown(event, userIcon) {
  if (event.key !== 'Enter' && event.key !== ' ') return;

  event.preventDefault();
  handleOnlineUserActionTrigger(event, userIcon);
}

function createOnlineUserActionMenu(context = {}) {
  const menu = document.createElement('div');
  menu.className = 'user-action-menu';
  menu.setAttribute('role', 'menu');

  const profileActions = canOpenOnlineUserActionMenu(context)
    ? [
        {
          label: 'Add friend',
          handler: async () => {
            try {
              await updateOnlinePublicFriendRelationship(
                context.accountId,
                'send'
              );
            } catch (error) {
              console.warn(error);
            }
          }
        },
        { label: 'View Profile', handler: () => openOnlinePublicProfile(context) },
        { label: 'Block', danger: true }
      ]
    : [];
  const actions = [...profileActions];

  if (context.canKick) {
    actions.push({
      label: 'Kick',
      danger: true,
      handler: () => {
        if (!context.userId || String(context.userId) === String(deviceId)) return;
        if (!canCurrentUserKickPlayers()) return;
        if (typeof context.onKick === 'function') {
          context.onKick(context.userId, context.userIconElement || null);
          return;
        }
        RemoveUserFromParty(context.userId);
        context.userIconElement?.remove();
      }
    });
  }

  actions.forEach((action) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'user-action-menu-button';
    if (action.disabled) {
      button.disabled = true;
      button.title = action.title || '';
      button.setAttribute('aria-disabled', 'true');
    }
    if (action.danger) {
      button.classList.add('is-danger');
    }
    button.textContent = action.label;
    button.setAttribute('role', 'menuitem');
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      closeOnlineUserActionMenus();
      action.handler?.();
    });
    menu.appendChild(button);
  });

  menu.addEventListener('click', (event) => {
    event.stopPropagation();
  });

  return menu;
}

function makeOnlineUserActionTrigger(element, userIcon, label) {
  if (element.classList.contains('user-action-trigger')) return;

  element.classList.add('user-action-trigger');
  element.setAttribute('role', 'button');
  element.setAttribute('tabindex', '0');
  element.setAttribute('aria-haspopup', 'menu');
  element.setAttribute('aria-label', label);
  element.addEventListener('click', (event) => {
    handleOnlineUserActionTrigger(event, userIcon);
  });
  element.addEventListener('keydown', (event) => {
    handleOnlineUserActionTriggerKeydown(event, userIcon);
  });
}

function syncOnlineUserActionMenu(userIcon, context = {}) {
  if (!userIcon) return;

  const userId = context.userId ?? userIcon.getAttribute('data-user-id') ?? '';
  const canKick =
    Boolean(context.canKick) &&
    String(userId) !== String(deviceId);
  const menuContext = {
    ...context,
    userId,
    userIconElement: userIcon
  };
  const showActionMenu =
    String(userId) !== String(deviceId) &&
    (canOpenOnlineUserActionMenu(menuContext) || canKick);
  const existingMenu = userIcon.querySelector('.user-action-menu');

  if (!showActionMenu) {
    existingMenu?.remove();
    userIcon.classList.remove('menu-open');
    return;
  }

  const nameContainer = userIcon.querySelector('.name-container');
  const imageStack = userIcon.querySelector(':scope > .image-stack');

  if (nameContainer) {
    makeOnlineUserActionTrigger(
      nameContainer,
      userIcon,
      `Open ${menuContext.username || 'player'} menu`
    );
  }

  if (imageStack) {
    makeOnlineUserActionTrigger(
      imageStack,
      userIcon,
      `Open ${menuContext.username || 'player'} menu`
    );
  }

  const nextMenu = createOnlineUserActionMenu({
    ...menuContext,
    canKick
  });
  if (existingMenu) {
    existingMenu.replaceWith(nextMenu);
  } else {
    userIcon.appendChild(nextMenu);
  }
}


function syncExistingLobbyPlayerActionMenus() {
  document.querySelectorAll('.oe-lobby-player-tile').forEach((tile) => {
    const userId = tile.getAttribute('data-user-id') || '';
    const canKick =
      String(userId) !== String(deviceId) &&
      typeof canCurrentUserKickPlayers === 'function' &&
      canCurrentUserKickPlayers();

    syncOnlineUserActionMenu(tile, {
      userId,
      username: tile.dataset.username || 'Player',
      accountId: tile.dataset.accountId || '',
      canKick,
      onKick: (targetUserId, targetTile) => {
        if (!targetUserId || String(targetUserId) === String(deviceId)) return;
        if (!canCurrentUserKickPlayers()) return;
        RemoveUserFromParty(targetUserId);
        targetTile?.remove();
      }
    });
  });
}
