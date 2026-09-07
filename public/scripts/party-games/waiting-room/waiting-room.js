const partySessionInProgressContainer = document.getElementById(
  'party-session-in-progress'
);
const userKickedContainer = document.getElementById('user-kicked');
const partyDisbandedContainer = document.getElementById(
  'party-disbanded-container'
);
const partyFullContainer = document.getElementById('party-full');

const gamemodeSettingsContainer = document.querySelector(
  '.waiting-room-container'
);
const readyButton = document.querySelector('.start-game-button');

function setWaitingRoomReadyControlAvailable(isAvailable) {
  if (!readyButton) return;

  readyButton.dataset.waitingRoomInitializing = String(!isAvailable);
  readyButton.disabled = !isAvailable;
  readyButton.classList.toggle('disabled', !isAvailable);
  readyButton.setAttribute('aria-disabled', String(!isAvailable));
}

setWaitingRoomReadyControlAvailable(false);

const WAITING_ROOM_READY_SOUND = 'gamemodeSettingsReady';
const WAITING_ROOM_UNREADY_SOUND = 'gamemodeSettingsUnready';

if (typeof window.OEAudio?.register === 'function') {
  window.OEAudio.register({
    [WAITING_ROOM_READY_SOUND]: {
      src: '/sounds/gamemode-settings/ready.wav',
      group: 'party-games',
      preload: true,
      priority: 'confirmation',
      conflictPolicy: 'interrupt'
    },
    [WAITING_ROOM_UNREADY_SOUND]: {
      src: '/sounds/gamemode-settings/unready.wav',
      group: 'party-games',
      preload: true,
      priority: 'confirmation',
      conflictPolicy: 'interrupt'
    }
  });
}

let inputPartyCode;
let sessionPartyType;
let partyGameMode;
let minPlayerCount;
let waitingRoomPartyCodeObserver = null;
let waitingRoomDisbandMonitor = null;
let waitingRoomInitializationPromise = null;
const WAITING_ROOM_DISBAND_FALLBACK_INTERVAL_MS = 10000;

const url = window.location.href;
const segments = url.split('/');

waitingForHost = true;
observePartyCodeActionButtons();

const waitingRoomLateJoinBriefing = window.createWaitingRoomLateJoinBriefing({
  getPartyCode: () => partyCode,
  getPartyGameMode: () => partyGameMode,
  getMaxPlayerCount: () => maxPlayerCount,
  getGamemodeSettingsContainer: () => gamemodeSettingsContainer,
  promptWaitingRoomUserForCustomOeIcon
});

const lateJoinBriefingContainer =
  waitingRoomLateJoinBriefing.briefingContainer;

gameContainers.push(
  partySessionInProgressContainer,
  userKickedContainer,
  lateJoinBriefingContainer
);

function ShowWaitingRoomStartupError() {
  window.PartyChatReady?.then((partyChat) => {
    partyChat?.setAvailable?.(false);
  });

  document.documentElement.style.setProperty('--primarypagecolour', '#999999');
  document.documentElement.style.setProperty(
    '--secondarypagecolour',
    '#666666'
  );

  const statusContainer =
    typeof ensureOnlineStatusContainer === 'function'
      ? ensureOnlineStatusContainer({
          id: 'waiting-room-startup-error',
          title: 'Unable to join party',
          description: 'Refresh and try joining again.'
        })
      : null;

  setActiveContainers();
  if (statusContainer) {
    const content = statusContainer.querySelector('.content-container');
    if (content && !content.querySelector('[data-waiting-room-retry]')) {
      const retryButton = document.createElement('button');
      retryButton.type = 'button';
      retryButton.dataset.waitingRoomRetry = 'true';
      retryButton.textContent = 'RETRY JOINING';
      retryButton.addEventListener('click', () => initWaitingRoom());
      content.appendChild(retryButton);
    }
    showContainer(statusContainer);
  } else {
    ShowPartyDoesNotExistState();
  }
  document.title = 'WAITING ROOM | ERROR';
}

async function checkPartyExists() {
  const partyData = await getWaitingRoomPartyData({
    retries: 12,
    delayMs: 250,
    requireUsable: true
  });
  if (partyData) {
    const config = partyData.config;
    const state = partyData.state;

    partyGameMode = config.gamemode;
    rememberWaitingRoomGamemode(partyCode, partyGameMode);
    debugLog('config.gameRules:', config.gameRules);
    maxPlayerCount =
      partyGamesInformation[partyGameMode].playerCountRestrictions.maxPlayers;
    CreateGameSettingsButtonsScript();
    inputPartyCode = document.getElementById('party-code');
    bindPartyCodeActionButtonsWithRetry();

    if (partyGameMode) {
      sessionPartyType = partyGamesInformation[partyGameMode].partyType;
      document.documentElement.style.setProperty(
        '--primarypagecolour',
        partyGamesInformation[partyGameMode].gamemodeColours.primary
      );
      document.documentElement.style.setProperty(
        '--secondarypagecolour',
        partyGamesInformation[partyGameMode].gamemodeColours.secondary
      );
      changeFavicon(partyGameMode);
    }

    if (
      state.isPlaying === false &&
      typeof getHostedOnlineSettingsAccess === 'function' &&
      typeof redirectOnlinePartyToLobby === 'function'
    ) {
      const access = await getHostedOnlineSettingsAccess(partyData);
      if (access.isHost) {
        redirectOnlinePartyToLobby(partyData);
        return;
      }
    }

    if (state.isPlaying === false) {
      const players = partyData.players || [];
      const currentPlayerComputerId =
        window.resolveOnlinePartyActorId?.(partyData, deviceId) || deviceId;

      const playerIndex = players.findIndex(
        (player) =>
          String(player.identity?.computerId || player.computerId || '') ===
          String(currentPlayerComputerId)
      );
      const playerCount = players.length;
      const resolvedUsername = await resolveOnlineUsername(players);
      const resolvedUserIcon = getStoredUserIconString();

      if (playerCount >= maxPlayerCount) {
        if (playerIndex !== -1) {
          await UpdateUserPartyData({
            partyId: partyCode,
            computerId: currentPlayerComputerId,
            newUsername: resolvedUsername,
            newUserIcon: resolvedUserIcon,
            newUserReady: false,
            newUserConfirmation: false,
            newUserSocketId: socket.id
          });
          onlineUsername = resolvedUsername;
          showContainer(gamemodeSettingsContainer);
        } else {
          setActiveContainers(partyFullContainer);
          document.title = 'WAITING ROOM | ERROR';
        }
      } else {
        if (playerIndex !== -1) {
          await UpdateUserPartyData({
            partyId: partyCode,
            computerId: currentPlayerComputerId,
            newUsername: resolvedUsername,
            newUserIcon: resolvedUserIcon,
            newUserReady: false,
            newUserConfirmation: false,
            newUserSocketId: socket.id
          });
        } else {
          try {
            await addUserToParty({
              partyId: partyCode,
              newComputerId: deviceId,
              newUsername: resolvedUsername,
              newUserIcon: resolvedUserIcon,
              newUserSocketId: socket.id
            });
          } catch (error) {
            const latestPartyData = await getWaitingRoomPartyData().catch(
              () => null
            );
            const hasJoined = latestPartyData?.players?.some(
              (player) =>
                String(player.identity?.computerId || player.computerId || '') ===
                String(
                  window.resolveOnlinePartyActorId?.(
                    latestPartyData,
                    deviceId
                  ) || deviceId
                )
            );
            if (!hasJoined) throw error;
            console.warn(
              'Join request reported an error after the player was added:',
              error
            );
          }

          try {
            const partyChat = await window.PartyChatReady;
            await partyChat?.sendMessage({
              username: '[CONSOLE]',
              message: `${resolvedUsername} has joined the party.`,
              eventType: 'connect'
            });
          } catch (error) {
            console.warn('Failed to send waiting room join chat message:', error);
          }
        }
        onlineUsername = resolvedUsername;
        showContainer(gamemodeSettingsContainer);
      }

      await joinParty(partyCode);
      currentPartyData = await getWaitingRoomPartyData();
      window.syncOnlinePartyIdentity?.(currentPartyData);
      if (currentPartyData && typeof UpdateUserIcons === 'function') {
        await UpdateUserIcons(currentPartyData);
      }
      promptWaitingRoomUserForCustomOeIcon();
      startWaitingRoomDisbandMonitor();
      setWaitingRoomReadyControlAvailable(true);
    } else if (
      waitingRoomLateJoinBriefing.isActiveRoundLateJoinGamemode(partyGameMode)
    ) {
      const players = partyData.players || [];
      const currentPlayerComputerId =
        window.resolveOnlinePartyActorId?.(partyData, deviceId) || deviceId;
      const existingPlayer = players.find(
        (player) =>
          String(player.identity?.computerId || player.computerId || '') ===
          String(currentPlayerComputerId)
      );

      if (!existingPlayer && players.length >= maxPlayerCount) {
        setActiveContainers(partyFullContainer);
        document.title = 'WAITING ROOM | PARTY FULL';
      } else if (!existingPlayer) {
        await waitingRoomLateJoinBriefing.showActiveGameBriefing(partyData);
        startWaitingRoomDisbandMonitor();
        return;
      } else {
        const resolvedUsername = await resolveOnlineUsername(players);
        const resolvedUserIcon = getStoredUserIconString();

        await addUserToParty({
          partyId: partyCode,
          newComputerId: currentPlayerComputerId,
          newUsername: resolvedUsername,
          newUserIcon: resolvedUserIcon,
          newUserSocketId: socket.id
        });

        onlineUsername = resolvedUsername;
        await joinParty(partyCode);
        loadingPage = true;
        transitionSplashScreen(
          `/${formatPackName(partyGameMode)}/${partyCode}`,
          `/images/splash-screens/party-games/${formatPackName(partyGameMode)}/game.png`
        );
        return;
      }
    } else {
      if (partyGameMode) {
        changeFavicon(partyGameMode, 'in-game-locked');
      }
      setActiveContainers(partySessionInProgressContainer);
      document.title = 'WAITING ROOM | ERROR';
      addElementIfNotExists(
        permanantElementClassArray,
        partySessionInProgressContainer,
        { sound: false }
      );
    }

    SetScriptLoaded('/scripts/party-games/waiting-room/waiting-room.js');
  } else {
    ShowPartyDoesNotExistState();
    document.title = 'WAITING ROOM | PARTY DOES NOT EXIST';
    SetScriptLoaded('/scripts/party-games/waiting-room/waiting-room.js');
  }
}

async function initWaitingRoom() {
  if (waitingRoomInitializationPromise) return waitingRoomInitializationPromise;

  setWaitingRoomReadyControlAvailable(false);
  waitingRoomInitializationPromise = (async () => {
    try {
      document.getElementById('waiting-room-startup-error')?.remove();
      if (window.OEReady?.waitFor) {
        await window.OEReady.waitFor(
          ['online-settings', 'gamemode-settings-template'],
          { timeoutMs: 30000 }
        );
      } else {
        await Promise.all([
          waitForScriptDataLoaded(
            '/scripts/party-games/online/online-settings.js',
            { timeout: 30000 }
          ),
          waitForScriptDataLoaded(
            '/scripts/html-templates/gamemode-settings/gamemode-settings-template.js',
            { timeout: 30000 }
          )
        ]);
      }
      await waitForOnlineCore();
      await checkPartyExists();
    } catch (error) {
      console.error('Failed to initialise waiting room:', error);
      ShowWaitingRoomStartupError();
      SetScriptLoaded('/scripts/party-games/waiting-room/waiting-room.js');
    } finally {
      waitingRoomInitializationPromise = null;
    }
  })();

  return waitingRoomInitializationPromise;
}

initWaitingRoom();
window.addEventListener('online', () => {
  if (document.getElementById('waiting-room-startup-error')) {
    initWaitingRoom();
  }
});

readyButton.dataset.sound = 'none';
readyButton.addEventListener('click', async () => {
  if (!partyCode || readyButton.disabled) return;

  const wasReady = readyButton.classList.contains('active');
  const newReady = !wasReady;
  readyButton.classList.toggle('active', newReady);

  const updated = await UpdateUserReady({
    partyId: partyCode,
    computerId: deviceId,
    newReady
  });

  if (!updated) {
    readyButton.classList.toggle('active', wasReady);
    playInteractionSound('error');
    return;
  }

  playSoundEffect(
    newReady ? WAITING_ROOM_READY_SOUND : WAITING_ROOM_UNREADY_SOUND
  );
});
