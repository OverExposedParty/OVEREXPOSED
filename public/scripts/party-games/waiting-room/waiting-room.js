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

gameContainers.push(
  partyDoesNotExistContainer,
  partySessionInProgressContainer,
  userKickedContainer
);


const url = window.location.href;
const segments = url.split('/');
partyCode = segments.pop() || segments.pop();

waitingForHost = true;

async function checkPartyExists() {
  //toggleOverlay(true);
  const response = await fetch(`/api/waiting-room?partyCode=${partyCode}`);
  const data = await response.json();
  if (data.length > 0) {
    const partyData = data[0];
    partyGameMode = partyData.gamemode;
    maxPlayerCount = partyGamesInformation[partyGameMode].playerCountRestrictions.maxPlayers;
    helpContainerFile = "party-games/" + partyGameMode + '.json';
    CreateGameSettingsButtonsScript();
    inputPartyCode = document.getElementById('party-code');
    if (partyGameMode) {
      sessionPartyType = partyGamesInformation[partyGameMode].partyType;
      document.documentElement.style.setProperty('--primarypagecolour', partyGamesInformation[partyGameMode].gamemodeColours.primary);
      document.documentElement.style.setProperty('--secondarypagecolour', partyGamesInformation[partyGameMode].gamemodeColours.secondary);
      changeFavicon(partyGameMode);
    }
    if (partyData.isPlaying === false) {
      const players = partyData.players || [];

      // Find if current device is already in players
      const playerIndex = players.findIndex(p => p.computerId === deviceId);
      console.log("playerIndex: " + playerIndex);
      console.log("players DeviceId: " + deviceId);
      console.log("players index DeviceId: " + players[0].computerId);
      const playerCount = players.length;

      if (playerCount >= 16) {
        if (playerIndex !== -1) {
          setActiveContainers(enterUsernameContainer);

          await UpdateUserPartyData({
            partyId: partyCode,
            computerId: deviceId,
            newUserReady: false,
            newUserConfirmation: false
          });
          console.log("partyCode: " + partyCode);
        } else {
          setActiveContainers(partyFullContainer)
          document.title = "WAITING ROOM | ERROR";
        }
      }
      else {
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
          console.log("partyCode: " + partyCode);
        }
        else {
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
  } else {
    setActiveContainers(partyDoesNotExistContainer);
    gamemodeSettingsContainer.classList.remove('active');
    document.title = "WAITING ROOM | PARTY DOES NOT EXIST";
    addElementIfNotExists(permanantElementClassArray, partyDoesNotExistContainer);
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
    "mafia": "mafia",
  };

  const faviconLinks = document.querySelectorAll('link[rel="icon"]');

  faviconLinks.forEach((favicon, i) => {
    const size = sizes[i % sizes.length];
    favicon.href = `/images/icons/${gamemodeFolderPath[gamemode]}/favicons/favicon-${size}.png`;

    document.documentElement.style.setProperty('--rotatedeviceicon', `url(/images/icons/${gamemodeFolderPath[gamemode]}/rotate-phone-icon.svg)`);
    document.documentElement.style.setProperty('--tiktokicon', `url(/images/icons/${gamemodeFolderPath[gamemode]}/tik-tok-icon.svg)`);
    document.documentElement.style.setProperty('--instagramicon', `url(/images/icons/${gamemodeFolderPath[gamemode]}/instagram-icon.svg)`);
  });
}

function SetGamemodeContainer() {
  UpdateGamemodeContainer()
  onlineSettingsTab.classList.remove('disabled');
  inputPartyCode.value = `https://overexposed.app/${partyCode}`;

}

function CreateGameSettingsButtonsScript() {
  const script = document.createElement("script");
  script.src = "/scripts/party-games/gamemode-settings/game-settings-buttons.js";
  script.type = "text/javascript";
  document.body.appendChild(script);
}

async function UpdateGamemodeContainer() {
  if (!partyCode) {
    return;
  }
  currentPartyData = await getWaitingRoomPartyData();

  packsContainer.querySelectorAll('button').forEach(button => {
    const inPacks = currentPartyData.selectedPacks?.includes(button.dataset.key);
    const inRoles = currentPartyData.selectedRoles?.includes(button.dataset.key);

    if (inPacks || inRoles) {
      button.classList.add('active');
    } else {
      button.classList.remove('active');
    }
    SetButtonStyle(button, false);
  });


  rulesContainer.querySelectorAll('button').forEach(button => {
    button.classList.toggle('active', currentPartyData.gameRules?.includes(button.dataset.key));
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