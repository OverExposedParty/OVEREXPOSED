const enterUsernameContainer = document.getElementById('enter-username');
const waitingForLeaderContainer = document.getElementById('waiting-for-leader');
const partyDoesNotExistContainer = document.getElementById('party-does-not-exist');
const partySessionInProgressContainer = document.getElementById('party-session-in-progress');
const userKickedContainer = document.getElementById('user-kicked');
const partyFullContainer = document.getElementById('party-full');
const partyUsernameInputSet = document.getElementById('party-username-waiting');

let formattedGamemode;
let sessionPartyType;

const gamemodeColors = {
  "Truth Or Dare": "#66CCFF",
  "Paranoia": "#9D8AFF",
  "Never Have I Ever": "#FF9266",
  "Most Likely To": "#FFEE66",
  "Mafia": "#A9323A",
};

const gameModeMap = {
  "Mafia": "party-game-mafia",
  "Paranoia": "party-game-paranoia",
  "Truth Or Dare": "party-game-truth-or-dare",
  "Most Likely To": "party-game-most-likely-to",
  "Never Have I Ever": "party-game-never-have-i-ever"
};

gameContainers.push(
  enterUsernameContainer,
  waitingForLeaderContainer,
  partyDoesNotExistContainer,
  partySessionInProgressContainer,
  userKickedContainer
);


const url = window.location.href;
const segments = url.split('/');
partyCode = segments.pop() || segments.pop();

waitingForHost = true;

async function checkPartyExists() {
  toggleOverlay(true);
  const response = await fetch(`/api/waiting-room?partyCode=${partyCode}`);
  const data = await response.json();
  console.log(data);

  if (data.length > 0) {
    joinParty(partyCode)
    const partyData = data[0];
    const color = gamemodeColors[partyData.gamemode];
    if (color) {
      document.documentElement.style.setProperty('--primarypagecolour', color);
    }

    sessionPartyType = gameModeMap[partyData.gamemode] || "default-party-game";
    changeFavicon(partyData.gamemode);

    if (partyData.isPlaying === false) {
      const players = partyData.players || [];

      // Find if current device is already in players
      const playerIndex = players.findIndex(p => p.computerId === deviceId);
      const playerCount = players.length;

      if (playerCount >= 8) {
        if (playerIndex !== -1) {
          setActiveContainers(enterUsernameContainer);
          addElementIfNotExists(permanantElementClassArray, enterUsernameContainer);

          await UpdateUserPartyData({
            partyId: partyCode,
            computerId: deviceId,
            newUsername: "Player" + playerIndex,
            newUserReady: false,
            newUserConfirmation: false
          });
          console.log("partyCode: " + partyCode);
        } else {
          setActiveContainers(partyFullContainer)
          addElementIfNotExists(permanantElementClassArray, partyFullContainer);
          document.title = "WAITING ROOM | ERROR";
        }
      } else {
        setActiveContainers(enterUsernameContainer);
        addElementIfNotExists(permanantElementClassArray, enterUsernameContainer);

        if (playerIndex !== -1) {
          await UpdateUserPartyData({
            partyId: partyCode,
            computerId: deviceId,
            newUsername: "NewName",
            newUserReady: false,
            newUserConfirmation: false
          });
          console.log("partyCode: " + partyCode);
        } else {
          await addUserToParty({
            partyId: partyCode,
            newComputerId: deviceId,
            newUsername: 'Player ' + (playerCount + 1),
            newUserReady: false,
            newUserConfirmation: false
          });
        }
      }
    } else {
      setActiveContainers(partySessionInProgressContainer);
      document.title = "WAITING ROOM | ERROR";
      addElementIfNotExists(permanantElementClassArray, partySessionInProgressContainer);
    }
  } else {
    partyDoesNotExistContainer.classList.add('active');
    document.title = "WAITING ROOM | ERROR";
    addElementIfNotExists(permanantElementClassArray, partyDoesNotExistContainer);
  }
}

async function getPartyData() {
  const response = await fetch(`/api/waiting-room?partyCode=${partyCode}`);
  const data = await response.json();

  return data[0];
}

checkPartyExists(partyCode);

function KickUser() {
  setActiveContainers(userKickedContainer);
}

function changeFavicon(gamemodeType) {
  const sizes = ['16x16', '32x32', '96x96', '180x180'];

  const gamemodeFolderPath = {
    "Truth Or Dare": "party-games",
    "Paranoia": "paranoia",
    "Never Have I Ever": "never-have-i-ever",
    "Most Likely To": "most-likely-to",
    "Mafia": "mafia",
  };

  const faviconLinks = document.querySelectorAll('link[rel="icon"]');

  faviconLinks.forEach((favicon, i) => {
    const size = sizes[i % sizes.length];
    favicon.href = `/images/icons/${gamemodeFolderPath[gamemodeType]}/favicons/favicon-${size}.png`;

    document.documentElement.style.setProperty('--rotatedeviceicon', `url(/images/icons/${gamemodeFolderPath[gamemodeType]}/rotate-phone-icon.svg)`);
    document.documentElement.style.setProperty('--tiktokicon', `url(/images/icons/${gamemodeFolderPath[gamemodeType]}/tik-tok-icon.svg)`);
    document.documentElement.style.setProperty('--instagramicon', `url(/images/icons/${gamemodeFolderPath[gamemodeType]}/instagram-icon.svg)`);
  });
}