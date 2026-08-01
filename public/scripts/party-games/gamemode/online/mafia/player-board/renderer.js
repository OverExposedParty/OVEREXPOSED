(function () {
  function createMafiaPlayerBoardRenderer({
    actionMenu,
    getRevealRoleOnDeath,
    getRevealRolesToDeadPlayers,
    playerBoard,
    playerBoardButton
  }) {
    function normalizePlayers(players) {
      const list = Array.isArray(players) ? players : Object.values(players);

      return list
        .map((player) => ({
          id: player?.identity?.computerId ?? '',
          accountId: player?.identity?.accountId ?? '',
          roleKey: player?.state?.roleKey ?? '',
          username: player?.identity?.username ?? '',
          status: player?.state?.status ?? '',
          userIcon: player?.identity?.userIcon ?? ''
        }))
        .filter((p) => p.id);
    }

    function ensureBoardTitle(board, boardTitle) {
      let titleEl = board.querySelector('.player-board-title');
      if (!titleEl) {
        titleEl = document.createElement('div');
        titleEl.className = 'player-board-title';
        board.prepend(titleEl);
      }
      titleEl.textContent = boardTitle;
    }

    function ensurePlayersContainer(board) {
      let container = board.querySelector('.players-container');
      if (!container) {
        container = document.createElement('div');
        container.className = 'players-container';
        board.appendChild(container);
      }
      return container;
    }

    function selectPlayerContainer(parent, id) {
      const safeId = window.CSS && CSS.escape ? CSS.escape(id) : id;
      return parent.querySelector(
        `.player-container[data-player-id="${safeId}"]`
      );
    }

    function getVisibleRole(roleKey, status, mePlayer, id) {
      if (mePlayer?.identity?.computerId === id) {
        return roleKey || 'N/A';
      }

      if (getRevealRoleOnDeath() && status === 'dead') {
        return roleKey || 'N/A';
      }

      if (mePlayer?.state?.status === 'dead' && getRevealRolesToDeadPlayers()) {
        return roleKey || 'N/A';
      }

      return '?????';
    }

    function formatBoardLabel(value) {
      return (value || 'UNKNOWN').toUpperCase();
    }

    function AddDeadEyesToString(userCustomisationString) {
      const parsed = parseCustomisationString(userCustomisationString);
      parsed.eyes = 'A202';
      return `${parsed.colour}:${parsed.head}:${parsed.eyes}:${parsed.mouth}`;
    }

    async function createPlayerContainer({
      roleKey,
      username,
      status,
      id,
      accountId,
      userIcon,
      mePlayer
    }) {
      const playerContainer = document.createElement('div');
      playerContainer.className = 'player-container';
      playerContainer.setAttribute('data-player-id', id);
      playerContainer.dataset.username = username || '';
      playerContainer.dataset.accountId = accountId || '';
      const isSelf = String(id) === String(deviceId);
      const menuContext = { id, accountId, username, userIcon };
      const showPlayerMenu =
        !isSelf && actionMenu.canOpenPlayerActionMenu(menuContext);

      const avatarContainer = document.createElement('div');
      avatarContainer.className = 'player-avatar';
      playerContainer.appendChild(avatarContainer);
      if (showPlayerMenu) {
        actionMenu.makePlayerMenuTrigger(
          avatarContainer,
          playerContainer,
          `Open ${username || 'player'} menu`
        );
      }

      let finalIcon = userIcon || '0000:0000:0000:0000';

      if (status === 'dead') {
        playerContainer.classList.add('dead');
        finalIcon = AddDeadEyesToString(finalIcon);
      }

      await createUserIconPartyGames({
        container: avatarContainer,
        userId: id,
        userCustomisationString: finalIcon
      });

      const info = document.createElement('div');
      info.className = 'player-info';

      const userContainer = document.createElement('span');
      userContainer.className = 'player-username';
      userContainer.textContent = formatBoardLabel(username);
      if (showPlayerMenu) {
        actionMenu.makePlayerMenuTrigger(
          userContainer,
          playerContainer,
          `Open ${username || 'player'} menu`
        );
      }
      info.appendChild(userContainer);

      const separator = document.createElement('span');
      separator.className = 'player-info-separator';
      separator.textContent = '|';
      info.appendChild(separator);

      const roleText = document.createElement('span');
      roleText.className = 'player-inner-text-role';
      roleText.textContent = formatBoardLabel(
        getVisibleRole(roleKey, status, mePlayer, id)
      );
      info.appendChild(roleText);

      playerContainer.appendChild(info);
      if (showPlayerMenu) {
        playerContainer.appendChild(
          actionMenu.createPlayerActionMenu(menuContext)
        );
      }

      return playerContainer;
    }

    function updatePlayerContainer(
      container,
      { roleKey, username, status, id, accountId, userIcon },
      mePlayer
    ) {
      container.dataset.username = username || '';
      container.dataset.accountId = accountId || '';

      const roleText = container.querySelector('.player-inner-text-role');
      const nextVisibleRole = formatBoardLabel(
        getVisibleRole(roleKey, status, mePlayer, id)
      );
      if (roleText && roleText.textContent !== nextVisibleRole) {
        roleText.textContent = nextVisibleRole;
      }

      const userValue = container.querySelector('.player-username');
      const nextUsername = formatBoardLabel(username);
      if (userValue && userValue.textContent !== nextUsername) {
        userValue.textContent = nextUsername;
      }

      const iconContainer =
        container.querySelector('.player-avatar') || container;

      if (status === 'dead') {
        container.classList.add('dead');
        const deadIcon = AddDeadEyesToString(userIcon || '0000:0000:0000:0000');
        EditUserIconPartyGames({
          container: iconContainer,
          userId: id,
          userCustomisationString: deadIcon
        });
      } else {
        container.classList.remove('dead');
        EditUserIconPartyGames({
          container: iconContainer,
          userId: id,
          userCustomisationString: userIcon || '0000:0000:0000:0000'
        });
      }
    }

    async function upsertPlayerContainer(parent, player) {
      let container = selectPlayerContainer(parent, player.id);
      const mePlayer = currentPartyData.players.find(
        (p) => p.identity.computerId === deviceId
      );

      if (!container) {
        container = await createPlayerContainer({
          roleKey: player.roleKey,
          username: player.username,
          status: player.status,
          id: player.id,
          accountId: player.accountId,
          userIcon: player.userIcon,
          mePlayer
        });
        parent.appendChild(container);
      } else {
        updatePlayerContainer(container, player, mePlayer);
      }
    }

    function removeStaleContainers(parent, validIdsSet) {
      const existingContainers = parent.querySelectorAll('.player-container');
      existingContainers.forEach((container) => {
        const id = container.getAttribute('data-player-id');
        if (!validIdsSet.has(id)) container.remove();
      });
    }

    function UpdatePlayerBoardButton({ userCustomisationString, userId }) {
      if (!userCustomisationString || !userId) return;
      EditUserIconPartyGames({
        container: playerBoardButton,
        userId: userId,
        userCustomisationString: userCustomisationString
      });
    }

    function SetPlayerBoardButton({ userCustomisationString, userId }) {
      if (!userCustomisationString || !userId) return;
      createUserIconPartyGames({
        container: playerBoardButton,
        userId,
        userCustomisationString
      });
    }

    function SetPlayerBoardButtonDead(userCustomisationString) {
      playerBoardButton.classList.add('dead');
      EditUserIconPartyGames({
        container: playerBoardButton,
        userId: deviceId,
        userCustomisationString: AddDeadEyesToString(userCustomisationString)
      });
    }

    function renderPlayers(players, boardTitle) {
      const index = currentPartyData.players.findIndex(
        (p) => p.identity.computerId === deviceId
      );
      const board = document.getElementById('player-board');
      if (!board) return;

      ensureBoardTitle(board, boardTitle);
      const playersContainer = ensurePlayersContainer(board);

      const normalizedPlayers = normalizePlayers(players);
      const validIds = new Set();

      normalizedPlayers.forEach((player) => {
        validIds.add(player.id);
        upsertPlayerContainer(playersContainer, player);
      });

      removeStaleContainers(playersContainer, validIds);

      const myPlayer = players[index];
      const myIcon = myPlayer?.identity?.userIcon;
      const myStatus = myPlayer?.state?.status;
      playerBoard.classList.toggle('dead', myStatus === 'dead');

      if (myStatus === 'dead') {
        SetPlayerBoardButtonDead(myIcon);
      } else {
        playerBoardButton.classList.remove('dead');
        UpdatePlayerBoardButton({
          userCustomisationString: myIcon,
          userId: myPlayer?.identity?.computerId
        });
      }
    }

    return {
      AddDeadEyesToString,
      renderPlayers,
      SetPlayerBoardButton,
      UpdatePlayerBoardButton
    };
  }

  window.createMafiaPlayerBoardRenderer = createMafiaPlayerBoardRenderer;
})();
