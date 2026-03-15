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
  partySessionInProgressContainer,
  userKickedContainer
);

const url = window.location.href;
const segments = url.split('/');

waitingForHost = true;
observePartyCodeActionButtons();

function waitForScriptDataLoaded(scriptPath, { timeout = 5000 } = {}) {
  const basePath = scriptPath.split('?')[0];

  return new Promise((resolve, reject) => {
    const start = performance.now();

    function tick() {
      const script = [...document.scripts].find((candidate) => {
        const src = candidate.getAttribute('src') || '';
        return src.split('?')[0] === basePath;
      });

      if (script?.dataset.loaded === 'true') {
        resolve();
        return;
      }

      if (performance.now() - start > timeout) {
        reject(new Error(`Timed out waiting for ${basePath} to finish loading.`));
        return;
      }

      requestAnimationFrame(tick);
    }

    tick();
  });
}

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
      if (partyGameMode) {
        changeFavicon(partyGameMode, "in-game-locked");
      }
      setActiveContainers(partySessionInProgressContainer);
      document.title = "WAITING ROOM | ERROR";
      addElementIfNotExists(permanantElementClassArray, partySessionInProgressContainer);
    }

    waitForFunction("FetchHelpContainer", () => {
      FetchHelpContainer(helpContainerFile);
    });
    SetScriptLoaded('/scripts/party-games/waiting-room/waiting-room.js');
  } else {
    ShowPartyDoesNotExistState();
    document.title = "WAITING ROOM | PARTY DOES NOT EXIST";
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

async function initWaitingRoom() {
  try {
    await waitForScriptDataLoaded('/scripts/party-games/online/online-settings.js');
    await checkPartyExists();
  } catch (error) {
    console.error('Failed to initialise waiting room:', error);
    ShowPartyDoesNotExistState();
    document.title = "WAITING ROOM | ERROR";
    SetScriptLoaded('/scripts/party-games/waiting-room/waiting-room.js');
  }
}

initWaitingRoom();

function KickUser() {
  gamemodeSettingsContainer.classList.remove('active');
  setActiveContainers(userKickedContainer);
}

function replaceFaviconLink(linkId, href) {
  const existingLink = document.getElementById(linkId);
  if (!existingLink) {
    return;
  }

  const nextLink = existingLink.cloneNode(true);
  nextLink.href = versionAssetUrl(href, { cacheBustKey: "PARTY_GAMES_WAITING_ROOM" });
  existingLink.replaceWith(nextLink);
}

function changeFavicon(gamemode, variant = "lobby") {
  const faviconBasePath = `/images/meta/favicons/party-games/${gamemode}/${variant}`;
  replaceFaviconLink('favicon-ico', `${faviconBasePath}/favicon.ico`);
  replaceFaviconLink('favicon-16', `${faviconBasePath}/favicon-16x16.png`);
  replaceFaviconLink('favicon-32', `${faviconBasePath}/favicon-32x32.png`);
  replaceFaviconLink('favicon-apple', `${faviconBasePath}/apple-touch-icon.png`);
  replaceFaviconLink('favicon-manifest', `${faviconBasePath}/site.webmanifest`);
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
