(function () {
  const DEFAULT_ICON = window.USER_ICON_DEFAULT_STRING || '0000:0100:0200:0300';
  const BLANK_CUSTOMISATION = window.blankUserCustomisation || {
    colour: '/images/user-customisation/colour/blank/blank-colour.svg',
    headSlot: '/images/user-customisation/head-slot/blank/no-head-slot.svg',
    eyesSlot: '/images/user-customisation/eyes-slot/blank/no-eyes-slot.svg',
    mouthSlot: '/images/user-customisation/mouth-slot/blank/no-mouth-slot.svg'
  };

  if (typeof window.LoadStylesheet === 'function') {
    window.LoadStylesheet('/css/general/online/lobby-player-list.css');
  }

  function parseIconString(iconString = DEFAULT_ICON) {
    const [colour, head, eyes, mouth] = String(iconString || DEFAULT_ICON).split(':');
    return { colour, head, eyes, mouth };
  }

  function getSlotPath(slotId, slotName) {
    if (typeof window.getFilePathByCustomisationId === 'function') {
      return window.getFilePathByCustomisationId(slotId, slotName);
    }

    return BLANK_CUSTOMISATION[slotName];
  }

  function getCustomisation(iconString = DEFAULT_ICON) {
    const parsed = parseIconString(iconString);
    return {
      colour: getSlotPath(parsed.colour, 'colour'),
      headSlot: getSlotPath(parsed.head, 'headSlot'),
      eyesSlot: getSlotPath(parsed.eyes, 'eyesSlot'),
      mouthSlot: getSlotPath(parsed.mouth, 'mouthSlot')
    };
  }

  function createFallbackImageStack(customisation) {
    const stack = document.createElement('div');
    stack.className = 'image-stack';

    Object.entries(customisation).forEach(([key, src], index) => {
      const image = document.createElement('img');
      image.src = src;
      image.alt = '';
      image.id = key.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
      image.style.zIndex = String(index);
      stack.appendChild(image);
    });

    return stack;
  }

  function createImageStack(iconString = DEFAULT_ICON) {
    const customisation = getCustomisation(iconString);
    if (typeof window.CreateImageStack === 'function') {
      return window.CreateImageStack(customisation);
    }

    return createFallbackImageStack(customisation);
  }

  function escapeSelectorValue(value) {
    if (window.CSS?.escape) {
      return window.CSS.escape(String(value));
    }

    return String(value).replace(/["\\]/g, '\\$&');
  }

  function normalisePlayer(player = {}) {
    const socketId = player.connection?.socketId ?? player.socketId ?? '';
    const participationStatus = String(
      player.state?.participationStatus || player.participationStatus || ''
    ).toLowerCase();
    const hasDisconnectedSocket = socketId === 'DISCONNECTED';
    const hasLiveSocket = Boolean(socketId) && !hasDisconnectedSocket;
    const isReconnecting =
      player.isReconnecting === true || participationStatus === 'reconnecting';

    return {
      userId:
        player.userId ||
        player.computerId ||
        player.identity?.computerId ||
        player.id ||
        '',
      username:
        player.username ||
        player.identity?.username ||
        player.name ||
        'Player',
      accountId: player.accountId || player.identity?.accountId || '',
      userIcon:
        player.userIcon ||
        player.identity?.userIcon ||
        player.icon ||
        DEFAULT_ICON,
      isReady: Boolean(
        player.isReady ??
          player.ready ??
          player.state?.isReady
      ),
      isDisconnected:
        player.isDisconnected === true ||
        isReconnecting ||
        hasDisconnectedSocket ||
        (!hasLiveSocket && participationStatus === 'disconnected'),
      isReconnecting
    };
  }

  function createDisconnectedStatusIcon() {
    const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    icon.classList.add('disconnect-status-icon');
    icon.setAttribute('viewBox', '0 0 16 16');
    icon.setAttribute('aria-hidden', 'true');
    icon.setAttribute('focusable', 'false');

    const circle = document.createElementNS(
      'http://www.w3.org/2000/svg',
      'circle'
    );
    circle.setAttribute('cx', '8');
    circle.setAttribute('cy', '8');
    circle.setAttribute('r', '5.5');
    icon.appendChild(circle);

    return icon;
  }

  function setTileStatus(
    tile,
    {
      isReady = false,
      isDisconnected = false,
      isReconnecting = false
    } = {}
  ) {
    tile.dataset.ready = String(Boolean(isReady));
    tile.dataset.disconnected = String(Boolean(isDisconnected));
    tile.dataset.signingIn = String(Boolean(isReconnecting));
    const checkmark = tile.querySelector('.checkmark');
    if (checkmark) {
      checkmark.replaceChildren();
      if (isDisconnected) checkmark.appendChild(createDisconnectedStatusIcon());
    }
    checkmark?.classList.toggle('checked', Boolean(isReady) && !isDisconnected);
    checkmark?.classList.toggle('disconnected', Boolean(isDisconnected));
    checkmark?.setAttribute(
      'aria-label',
      isReconnecting
        ? 'Signing in'
        : isDisconnected
          ? 'Disconnected'
          : isReady
            ? 'Ready'
            : 'Not ready'
    );
  }

  function setKickButton(tile) {
    const existing = tile.querySelector('.close-btn');
    existing?.remove();
  }

  function syncPlayerActionMenu(tile, player, options = {}) {
    if (typeof window.syncOnlineUserActionMenu !== 'function') return;

    window.syncOnlineUserActionMenu(tile, {
      userId: player.userId,
      username: player.username,
      accountId: player.accountId,
      userIcon: player.userIcon,
      canKick: Boolean(options.canKick),
      onKick: options.onKick
    });
  }

  function createTile(player, options = {}) {
    const data = normalisePlayer(player);
    const tile = document.createElement('div');
    tile.className = 'user-icon oe-lobby-player-tile';
    tile.dataset.userId = data.userId;
    tile.dataset.username = data.username;
    tile.dataset.accountId = data.accountId;

    const nameContainer = document.createElement('div');
    nameContainer.className = 'name-container';

    const username = document.createElement('span');
    username.className = 'username';
    username.textContent = data.username;
    if (data.username.length > 10) username.classList.add('long-name');

    const checkmark = document.createElement('span');
    checkmark.className = 'checkmark';
    nameContainer.append(username, checkmark);

    tile.append(nameContainer, createImageStack(data.userIcon));
    setTileStatus(tile, data);
    setKickButton(tile, options);
    syncPlayerActionMenu(tile, data, options);

    return tile;
  }

  function updateTile(tile, player, options = {}) {
    const data = normalisePlayer(player);
    tile.dataset.username = data.username;
    tile.dataset.accountId = data.accountId;

    const username = tile.querySelector('.username');
    if (username) {
      username.textContent = data.username;
      username.classList.toggle('long-name', data.username.length > 10);
    }

    const existingStack = tile.querySelector('.image-stack');
    existingStack?.replaceWith(createImageStack(data.userIcon));
    setTileStatus(tile, data);
    setKickButton(tile, options);
    syncPlayerActionMenu(tile, data, options);
  }

  function render(container, players = [], options = {}) {
    if (!container) return [];

    container.classList.add('oe-lobby-player-list');
    const list = Array.isArray(players) ? players.map(normalisePlayer) : [];
    const activeIds = new Set(list.map((player) => String(player.userId)));

    [...container.querySelectorAll('.oe-lobby-player-tile')].forEach((tile) => {
      if (!activeIds.has(String(tile.dataset.userId || ''))) {
        tile.remove();
      }
    });

    list.forEach((player) => {
      if (!player.userId) return;
      let tile = container.querySelector(
        `.oe-lobby-player-tile[data-user-id="${escapeSelectorValue(player.userId)}"]`
      );
      const tileOptions = {
        ...options,
        canKick:
          typeof options.canKick === 'function'
            ? options.canKick(player)
            : Boolean(options.canKick)
      };

      if (tile) {
        updateTile(tile, player, tileOptions);
      } else {
        tile = createTile(player, tileOptions);
        container.appendChild(tile);
      }
    });

    return [...container.querySelectorAll('.oe-lobby-player-tile')];
  }

  window.OELobbyPlayerList = {
    createTile,
    render,
    updateTile
  };

  if (typeof window.SetScriptLoaded === 'function') {
    window.SetScriptLoaded('/scripts/general/online/lobby-player-list.js');
  }
  window.Ready?.set?.('lobby-player-list');
})();
