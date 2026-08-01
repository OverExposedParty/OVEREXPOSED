function getCurrentPlayerCountRestrictions() {
  return partyGamesInformation?.[partyGameMode]?.playerCountRestrictions || {};
}

const GAMEMODE_SETTINGS_ALL_READY_SOUND = 'gamemodeSettingsReadyToStart';
const GAMEMODE_SETTINGS_PLAYER_JOINED_SOUND =
  'gamemodeSettingsPlayerJoined';
const GAMEMODE_SETTINGS_PLAYER_LEFT_SOUND = 'gamemodeSettingsPlayerLeft';
let gamemodeSettingsReadySoundPartyCode = '';
let previousNonHostReadyStates = null;
let latestOnlineStartParty = null;

if (typeof window.OEAudio?.register === 'function') {
  window.OEAudio.register({
    [GAMEMODE_SETTINGS_ALL_READY_SOUND]: {
      src: '/sounds/gamemode-settings/ready-to-start.wav',
      group: 'party-games',
      preload: true,
      cooldown: 500,
      maxInstances: 1,
      priority: 'confirmation',
      conflictPolicy: 'interrupt'
    },
    [GAMEMODE_SETTINGS_PLAYER_JOINED_SOUND]: {
      src: '/sounds/gamemode-settings/player-joined.wav',
      group: 'party-games',
      preload: true,
      cooldown: 500,
      maxInstances: 1,
      priority: 'notification',
      conflictPolicy: 'queue-latest'
    },
    [GAMEMODE_SETTINGS_PLAYER_LEFT_SOUND]: {
      src: '/sounds/gamemode-settings/player-left.wav',
      group: 'party-games',
      preload: true,
      cooldown: 500,
      maxInstances: 1,
      priority: 'notification',
      conflictPolicy: 'queue-latest'
    }
  });
}

function getGamemodeSettingsPlayerId(player) {
  return String(
    player?.identity?.computerId || player?.computerId || ''
  );
}

function getGamemodeSettingsNonHostReadyStates(party) {
  const players = Array.isArray(party?.players) ? party.players : [];
  const hostComputerId = String(
    party?.state?.hostComputerId ||
      (typeof hostDeviceId !== 'undefined' ? hostDeviceId : '') ||
      getGamemodeSettingsPlayerId(players[0])
  );

  return new Map(
    players
      .filter(
        (player) =>
          getGamemodeSettingsPlayerId(player) !== hostComputerId
      )
      .map((player) => [
        getGamemodeSettingsPlayerId(player),
        player.state?.isReady === true
      ])
      .filter(([playerId]) => Boolean(playerId))
  );
}

function isCurrentDeviceGamemodeSettingsHost(party) {
  const players = Array.isArray(party?.players) ? party.players : [];
  const hostComputerId = String(
    party?.state?.hostComputerId ||
      (typeof hostDeviceId !== 'undefined' ? hostDeviceId : '') ||
      getGamemodeSettingsPlayerId(players[0])
  );

  return (
    typeof deviceId === 'undefined' ||
    !hostComputerId ||
    String(deviceId) === hostComputerId
  );
}

function playGamemodeSettingsPlayerLeftSound(
  party = typeof currentPartyData === 'undefined' ? null : currentPartyData
) {
  if (
    isCurrentDeviceGamemodeSettingsHost(party) &&
    typeof playSoundEffect === 'function'
  ) {
    playSoundEffect(GAMEMODE_SETTINGS_PLAYER_LEFT_SOUND);
  }
}

function shouldUseDedicatedGamemodeSettingsLobbyMembershipSound(
  notification = {}
) {
  const party =
    typeof currentPartyData === 'undefined' ? null : currentPartyData;
  const activeLobbyCode = String(
    (typeof partyCode === 'undefined' ? '' : partyCode) ||
      party?.partyId ||
      party?.partyCode ||
      ''
  ).toUpperCase();
  const notificationLobbyCode = String(
    notification.partyId || notification.partyCode || ''
  ).toUpperCase();

  return (
    Boolean(activeLobbyCode) &&
    activeLobbyCode === notificationLobbyCode &&
    isCurrentDeviceGamemodeSettingsHost(party)
  );
}

function syncGamemodeSettingsReadySound(
  party,
  { initializeOnly = false } = {}
) {
  const lobbyCode = String(party?.partyId || party?.partyCode || '');
  if (!lobbyCode) {
    gamemodeSettingsReadySoundPartyCode = '';
    previousNonHostReadyStates = null;
    return;
  }

  const currentReadyStates = getGamemodeSettingsNonHostReadyStates(party);
  if (lobbyCode !== gamemodeSettingsReadySoundPartyCode) {
    gamemodeSettingsReadySoundPartyCode = lobbyCode;
    previousNonHostReadyStates = currentReadyStates;
    return;
  }

  if (!previousNonHostReadyStates || initializeOnly) {
    previousNonHostReadyStates = currentReadyStates;
    return;
  }

  const currentDeviceIsHost = isCurrentDeviceGamemodeSettingsHost(party);
  const playerJoined = Array.from(currentReadyStates.keys()).some(
    (playerId) => !previousNonHostReadyStates.has(playerId)
  );
  if (
    currentDeviceIsHost &&
    playerJoined &&
    typeof playSoundEffect === 'function'
  ) {
    playSoundEffect(GAMEMODE_SETTINGS_PLAYER_JOINED_SOUND);
  }

  const players = Array.isArray(party.players) ? party.players : [];
  const restrictions = getCurrentPlayerCountRestrictions();
  const minPlayers = Number(restrictions.minPlayers);
  const maxPlayers = Number(restrictions.maxPlayers);
  const minimumPlayerCountMet =
    !Number.isFinite(minPlayers) || players.length >= minPlayers;
  const maximumPlayerCountMet =
    !Number.isFinite(maxPlayers) || players.length <= maxPlayers;
  const sameNonHostPlayers =
    currentReadyStates.size === previousNonHostReadyStates.size &&
    Array.from(currentReadyStates.keys()).every((playerId) =>
      previousNonHostReadyStates.has(playerId)
    );
  const aPlayerReadiedUp = Array.from(currentReadyStates).some(
    ([playerId, isReady]) =>
      isReady && previousNonHostReadyStates.get(playerId) === false
  );
  const allNonHostPlayersReady =
    currentReadyStates.size > 0 &&
    Array.from(currentReadyStates.values()).every(Boolean);

  if (
    !initializeOnly &&
    currentDeviceIsHost &&
    sameNonHostPlayers &&
    aPlayerReadiedUp &&
    allNonHostPlayersReady &&
    minimumPlayerCountMet &&
    maximumPlayerCountMet &&
    typeof playSoundEffect === 'function'
  ) {
    playSoundEffect(GAMEMODE_SETTINGS_ALL_READY_SOUND);
  }

  previousNonHostReadyStates = currentReadyStates;
}

window.syncGamemodeSettingsReadySound = syncGamemodeSettingsReadySound;
window.playGamemodeSettingsPlayerLeftSound =
  playGamemodeSettingsPlayerLeftSound;
window.shouldUseDedicatedGamemodeSettingsLobbyMembershipSound =
  shouldUseDedicatedGamemodeSettingsLobbyMembershipSound;

function getPlayerCountRestrictionError(playerCount) {
  const restrictions = getCurrentPlayerCountRestrictions();
  const minPlayers = Number(restrictions.minPlayers);
  const maxPlayers = Number(restrictions.maxPlayers);

  if (Number.isFinite(minPlayers) && playerCount < minPlayers) {
    return `${minPlayers - playerCount} more player${minPlayers - playerCount === 1 ? '' : 's'} needed`;
  }

  if (Number.isFinite(maxPlayers) && playerCount > maxPlayers) {
    return `Too many players (${playerCount}/${maxPlayers})`;
  }

  return '';
}

function getSelectedPackRestrictionError() {
  const buttons =
    typeof packButtons === 'undefined' ? [] : Array.from(packButtons);
  if (buttons.length === 0) return '';

  return buttons.some((button) => button.classList.contains('active'))
    ? ''
    : 'Select at least one pack';
}

function getReadinessRestrictionError(allReady) {
  if (allReady === true) return '';

  const party =
    latestOnlineStartParty ||
    (typeof currentPartyData === 'undefined' ? null : currentPartyData);
  const players = Array.isArray(party?.players) ? party.players : [];
  if (players.length === 0) {
    return 'Waiting for all players to ready up';
  }

  const hostComputerId = String(
    party?.state?.hostComputerId ||
      (typeof hostDeviceId === 'undefined' ? '' : hostDeviceId) ||
      getGamemodeSettingsPlayerId(players[0])
  );
  const nonHostPlayers = players.filter(
    (player) => getGamemodeSettingsPlayerId(player) !== hostComputerId
  );
  if (nonHostPlayers.length === 0) return '';

  const unreadyCount = nonHostPlayers.filter(
    (player) => player.state?.isReady !== true
  ).length;
  if (unreadyCount === 0) {
    return 'Waiting for all players to ready up';
  }

  return `${unreadyCount} player${unreadyCount === 1 ? '' : 's'} need${
    unreadyCount === 1 ? 's' : ''
  } to ready up`;
}

function getStartGameBlockers(allReady) {
  const blockers = [];

  if (partyCode) {
    const currentParty =
      typeof currentPartyData === 'undefined' ? null : currentPartyData;
    const hasLatestPlayers = Array.isArray(latestOnlineStartParty?.players);
    const hasCurrentPlayers = Array.isArray(currentParty?.players);
    const players = hasLatestPlayers
      ? latestOnlineStartParty.players
      : hasCurrentPlayers
        ? currentParty.players
        : [];
    const playerCountError =
      hasLatestPlayers || hasCurrentPlayers
        ? getPlayerCountRestrictionError(players.length)
        : onlinePlayerCountRestrictionsMet === false
          ? 'The player count does not meet this game’s requirements'
          : '';
    if (playerCountError) {
      blockers.push({
        id: 'player-count',
        message: playerCountError
      });
    }

    const readinessError = getReadinessRestrictionError(allReady);
    if (readinessError) {
      blockers.push({
        id: 'player-readiness',
        message: readinessError
      });
    }
  }

  const selectedPackError = getSelectedPackRestrictionError();
  if (selectedPackError) {
    blockers.push({
      id: 'selected-packs',
      message: selectedPackError
    });
  }

  return blockers;
}

function clearPlayerCountRestrictionError() {
  latestOnlineStartParty = null;
  onlinePlayerCountRestrictionsMet = true;
}

async function refreshOnlinePlayerCountRestrictions() {
  if (!partyCode) {
    clearPlayerCountRestrictionError();
    return true;
  }

  const existingData = await getExistingPartyData(partyCode);
  const latestParty = existingData?.[0];
  const currentParty =
    typeof currentPartyData === 'undefined' ? null : currentPartyData;
  latestOnlineStartParty = latestParty || null;
  const playerCount = Array.isArray(latestParty?.players)
    ? latestParty.players.length
    : Array.isArray(currentParty?.players)
      ? currentParty.players.length
      : 0;
  const errorMessage = getPlayerCountRestrictionError(playerCount);

  onlinePlayerCountRestrictionsMet = errorMessage === '';
  return onlinePlayerCountRestrictionsMet;
}

function updateStartGameButton(allReady) {
  if (typeof allReady !== 'undefined') {
    const canStart = getStartGameBlockers(allReady).length === 0;
    const shouldAllowBlockedFeedback = Boolean(partyCode && !canStart);
    if (canStart) {
      startGameButton.classList.remove('disabled');
    } else {
      startGameButton.classList.add('disabled');
    }
    startGameButton.classList.toggle(
      'start-blocked-feedback',
      shouldAllowBlockedFeedback
    );
    startGameButton.setAttribute('aria-disabled', String(!canStart));
    startGameButton.style.pointerEvents =
      canStart || shouldAllowBlockedFeedback ? 'auto' : 'none';
    if (
      !canStart &&
      typeof window.cancelGamemodeStartCountdownIfIneligible === 'function'
    ) {
      window.cancelGamemodeStartCountdownIfIneligible();
    }
    if (canStart) {
      window.dismissOeStatusPopup?.('game-start-blocked');
    }
    return;
  }

  if (
    !partyCode &&
    typeof window.cancelGamemodeStartCountdown === 'function'
  ) {
    window.cancelGamemodeStartCountdown();
  }
  const anyActive = Array.from(packButtons).some((button) =>
    button.classList.contains('active')
  );
  startGameButton.classList.toggle('disabled', !anyActive);
  startGameButton.classList.remove('start-blocked-feedback');
  startGameButton.setAttribute('aria-disabled', String(!anyActive));
  startGameButton.style.pointerEvents = anyActive ? 'auto' : 'none';
}

window.getStartGameBlockers = getStartGameBlockers;
