const partyDoesNotExistContainer = document.getElementById('party-does-not-exist');
const partySessionInProgressContainer = document.getElementById('party-session-in-progress');
const userKickedContainer = document.getElementById('user-kicked');
const partyFullContainer = document.getElementById('party-full');

const gamemodeSettingsContainer = document.querySelector('.waiting-room-container');
const readyButton = document.querySelector('.start-game-button');

let inputPartyCode;
let sessionPartyType;
let partyGameMode;
let helpContainerFile = "waiting-room-error.json";
let minPlayerCount;
let waitingRoomPartyCodeObserver = null;

function hasRestriction(restrictionValue, expectedRestriction) {
  if (!restrictionValue || !expectedRestriction) return false;
  try {
    const restrictions = JSON.parse(restrictionValue);
    return Array.isArray(restrictions) && restrictions.includes(expectedRestriction);
  } catch {
    return false;
  }
}

function setupPartyCodeActionButtons() {
  inputPartyCode = inputPartyCode || document.getElementById('party-code');
  const copyPartyCodeButton = document.getElementById('party-code-copy-button');
  const qrCodeButton = document.getElementById('qr-code-button');
  if (!inputPartyCode || !copyPartyCodeButton || !qrCodeButton) return false;

  if (copyPartyCodeButton && !copyPartyCodeButton.dataset.bound) {
    copyPartyCodeButton.dataset.bound = 'true';
    copyPartyCodeButton.addEventListener('click', async () => {
      flashButtonHoverState(copyPartyCodeButton, {
        duration: 0,
        fadeDuration: 200,
        className: 'copy-feedback-active',
        transitionClassName: 'copy-feedback-fade'
      });

      const codeToCopy = (inputPartyCode?.value || '').trim();
      if (!codeToCopy) return;
      const fullPartyUrl = `${window.location.origin}/${codeToCopy}`;
      try {
        const copied = await copyTextToClipboard(fullPartyUrl);
        if (!copied) {
          throw new Error('Clipboard copy command was not successful.');
        }
      } catch (err) {
        console.error('Failed to copy party URL:', err);
      }
    });
  }

  if (qrCodeButton && !qrCodeButton.dataset.bound) {
    qrCodeButton.dataset.bound = 'true';
    qrCodeButton.addEventListener('click', () => {
      if (!partyCode || typeof togglePartyQrCode !== 'function') return;
      const willShow = !qrCodeButton.classList.contains('active');
      togglePartyQrCode(willShow, partyCode);
    });
  }
  return true;
}

function bindPartyCodeActionButtonsWithRetry(attempt = 0) {
  const maxAttempts = 80;
  const bound = setupPartyCodeActionButtons();
  if (bound || attempt >= maxAttempts) return;
  setTimeout(() => bindPartyCodeActionButtonsWithRetry(attempt + 1), 50);
}

function observePartyCodeActionButtons() {
  if (waitingRoomPartyCodeObserver) return;

  if (setupPartyCodeActionButtons()) {
    return;
  }

  waitingRoomPartyCodeObserver = new MutationObserver(() => {
    if (!setupPartyCodeActionButtons()) return;
    waitingRoomPartyCodeObserver.disconnect();
    waitingRoomPartyCodeObserver = null;
  });

  waitingRoomPartyCodeObserver.observe(document.body, {
    childList: true,
    subtree: true
  });
}

gameContainers.push(
  partyDoesNotExistContainer,
  partySessionInProgressContainer,
  userKickedContainer
);

const url = window.location.href;
const segments = url.split('/');

waitingForHost = true;
observePartyCodeActionButtons();

async function checkPartyExists() {
  const response = await fetch(`/api/waiting-room?partyCode=${partyCode}`);
  const data = await response.json();
  if (data.length > 0) {
    const partyData = data[0];

    const config = partyData.config;
    const state = partyData.state;

    partyGameMode = config.gamemode;
    console.log("config.gameRules:", config.gameRules);
    maxPlayerCount = partyGamesInformation[partyGameMode].playerCountRestrictions.maxPlayers;
    helpContainerFile = "party-games-online/waiting-rooms/" + partyGameMode + '.json';

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

    if (state.isPlaying === false) {
      const players = partyData.players || [];

      const playerIndex = players.findIndex(
        p => p.identity?.computerId === deviceId
      );
      const playerCount = players.length;

      if (playerCount >= 16) {
        if (playerIndex !== -1) {
          addElementIfNotExists(permanantElementClassArray, enterUsernameContainer);
          toggleOverlay(true);
          setActiveContainers(enterUsernameContainer);

          await UpdateUserPartyData({
            partyId: partyCode,
            computerId: deviceId,
            newUserReady: false,
            newUserConfirmation: false,
            newUserSocketId: socket.id
          });
        } else {
          setActiveContainers(partyFullContainer);
          document.title = "WAITING ROOM | ERROR";
        }
      } else {
        addElementIfNotExists(permanantElementClassArray, enterUsernameContainer);
        toggleOverlay(true);
        setActiveContainers(enterUsernameContainer);

        if (playerIndex !== -1) {
          await UpdateUserPartyData({
            partyId: partyCode,
            computerId: deviceId,
            newUsername: "-",
            newUserReady: false,
            newUserConfirmation: false,
            newUserSocketId: socket.id
          });
        } else {
          await addUserToParty({
            partyId: partyCode,
            newComputerId: deviceId,
            newUsername: "-",
            newUserIcon: "0000:0100:0200:0300",
            newUserSocketId: socket.id
          });
        }
      }

      joinParty(partyCode);
    } else {
      setActiveContainers(partySessionInProgressContainer);
      document.title = "WAITING ROOM | ERROR";
      addElementIfNotExists(permanantElementClassArray, partySessionInProgressContainer);
    }

    waitForFunction("FetchHelpContainer", () => {
      FetchHelpContainer(helpContainerFile);
    });
    SetScriptLoaded('/scripts/party-games/waiting-room/waiting-room.js');
  } else {
    setActiveContainers(partyDoesNotExistContainer);
    gamemodeSettingsContainer.classList.remove('active');
    document.title = "WAITING ROOM | PARTY DOES NOT EXIST";
    addElementIfNotExists(permanantElementClassArray, partyDoesNotExistContainer);
    SetScriptLoaded('/scripts/party-games/waiting-room/waiting-room.js');
  }
}

async function getWaitingRoomPartyData() {
  const response = await fetch(`/api/waiting-room?partyCode=${partyCode}`);
  const data = await response.json();

  if (!Array.isArray(data) || data.length === 0) {
    return null;
  }

  return data[0];
}

checkPartyExists(partyCode);

function KickUser() {
  gamemodeSettingsContainer.classList.remove('active');
  setActiveContainers(userKickedContainer);
}

function changeFavicon(gamemode) {
  const sizes = ['16x16', '32x32', '96x96', '180x180'];

  const gamemodeFolderPath = {
    "truth-or-dare": "party-games",
    "paranoia": "paranoia",
    "never-have-i-ever": "never-have-i-ever",
    "most-likely-to": "most-likely-to",
    "would-you-rather": "would-you-rather",
    "mafia": "mafia",
  };

  const faviconLinks = document.querySelectorAll('link[rel="icon"]');

  faviconLinks.forEach((favicon, i) => {
    const size = sizes[i % sizes.length];
    favicon.href = `/images/icons/${gamemodeFolderPath[gamemode]}/favicons/favicon-${size}.png`;
  });
}

function SetGamemodeContainer() {
  UpdateGamemodeContainer();
  onlineSettingsTab.classList.remove('disabled');
  rulesContainer.querySelectorAll('button').forEach(button => {
    if (hasRestriction(button.dataset.settingsRestriction, "offline")) {
      button.classList.add('inactive');
    }
  });
  rulesContainer.querySelectorAll('.increment-container').forEach(button => {
    if (hasRestriction(button.dataset.settingsRestriction, "offline")) {
      button.classList.add('inactive');
    }
  });
  inputPartyCode = inputPartyCode || document.getElementById('party-code');
  if (inputPartyCode) {
    inputPartyCode.value = partyCode;
  }
  bindPartyCodeActionButtonsWithRetry();
}

function CreateGameSettingsButtonsScript() {
  const script = document.createElement("script");
  script.src = versionAssetUrl("/scripts/party-games/gamemode-settings/game-settings-buttons.js");
  script.type = "text/javascript";
  document.body.appendChild(script);
}

async function UpdateGamemodeContainer() {
  if (!partyCode) {
    return;
  }
  currentPartyData = await getWaitingRoomPartyData();
  if (!currentPartyData) return;

  const config = currentPartyData.config;

  const selectedPacks = Array.isArray(config.selectedPacks) ? config.selectedPacks : [];
  const selectedRoles = Array.isArray(config.selectedRoles) ? config.selectedRoles : [];
  const gameRules = config.gameRules || {};

  packsContainer.querySelectorAll('button').forEach(button => {
    const key = button.dataset.key;
    const inPacks = selectedPacks.includes(key);
    const inRoles = selectedRoles.includes(key);

    if (inPacks || inRoles) {
      button.classList.add('active');
    } else {
      button.classList.remove('active');
    }
    SetButtonStyle(button, false);
  });

  rulesContainer.querySelectorAll('.increment-container').forEach(button => {
    const key = button.dataset.key;
    const value = gameRules[key];

    if (typeof value === 'number') {
      button.dataset.count = value;
      const display = button.querySelector('.count-display');
      if (display) {
        display.textContent = value;
      }
    }
  });

  rulesContainer.querySelectorAll('button').forEach(button => {
    const key = button.dataset.key;
    const raw = gameRules[key];
    const isActive = raw === true || raw === 'true';
    button.classList.toggle('active', isActive);
    SetButtonStyle(button, false);
  });
}

function PartyDisbanded() {
  partyDisbandedContainer = document.getElementById('party-disbanded-container');
  gamemodeSettingsContainer.classList.remove('active');
  setActiveContainers(partyDisbandedContainer);
}

readyButton.addEventListener('click', async () => {
  readyButton.classList.toggle('active');
  if (readyButton.classList.contains('active')) {
    newReady = true;
  } else {
    newReady = false;
  }
  if (partyCode) {
    await UpdateUserReady({
      partyId: partyCode,
      computerId: deviceId,
      newReady: newReady,
    });
  }
});
