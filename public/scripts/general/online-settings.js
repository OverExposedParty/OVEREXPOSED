let hostedParty = false;
let waitingForHost = false;

const { protocol, hostname } = window.location;
let socket;
if (hostname === 'overexposed.app') {
  socket = io(`${protocol}//${hostname}`);
} else {
  socket = io(`${protocol}//${hostname}:3000`);
}

socket.on('connect', () => {
  console.log('Socket connected successfully');
});

socket.on('connect_error', (err) => {
  console.error('Socket connection error:', err);
});

// Listen for confirmation that the user joined the party
socket.on('joined-party', (data) => {
  console.log(data.message);  // Log success message from the server
});

let partyCode;
let lastKnownPing = null;

async function getExistingPartyData(partyId) {
  try {
    const res = await fetch(`/api/party-games?partyCode=${partyId}`);
    const existingData = await res.json();
    return existingData;
  } catch (err) {
    console.error('❌ Failed to fetch existing party data:', err);
    throw err;
  }
}

function generateDeviceFingerprint() {
  const fingerprint = [
    navigator.userAgent,
    navigator.language,
    screen.width,
    screen.height,
    screen.colorDepth,
    new Date().getTimezoneOffset(),
    navigator.platform,
  ].join('|');

  return hashString(fingerprint.trim());
}

function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const chr = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0; // Convert to 32bit integer
  }
  return 'dev_' + Math.abs(hash).toString(36).trim(); // Trim here too
}

const deviceId = generateDeviceFingerprint().trim();
console.log('deviceID:', `'${deviceId}'`); // Logs with quotes to verify spacing


function generatePartyCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';

  for (let i = 0; i < 3; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  code += '-';

  for (let i = 0; i < 3; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function updateOnlineParty({
  partyId,
  computerIds,
  gamemode,
  usernames,
  gameSettings,
  selectedPacks,
  usersReady,
  userInstructions,
  isPlaying,
  lastPinged,
  usersLastPing,
  playerTurn,
  shuffleSeed
}) {
  const payload = {
    partyId, // Required
    ...(computerIds !== undefined && { computerIds }),
    ...(gamemode !== undefined && { gamemode }),
    ...(usernames !== undefined && { usernames }),
    ...(gameSettings !== undefined && { gameSettings }),
    ...(selectedPacks !== undefined && { selectedPacks }),
    ...(usersReady !== undefined && { usersReady }),
    ...(userInstructions !== undefined && { userInstructions }),
    ...(isPlaying !== undefined && { isPlaying }),
    ...(lastPinged !== undefined && { lastPinged }),
    ...(usersLastPing !== undefined && { usersLastPing }),
    ...(playerTurn !== undefined && { playerTurn }),
    ...(shuffleSeed !== undefined && { shuffleSeed })
  };
  return fetch(`/api/party-games?partyCode=${partyId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  })
    .then(res => res.json())
    .then(data => {
      console.log('✅ Saved/Updated party:', data);
      return data;
    })
    .catch(err => {
      console.error('❌ Save/Update failed:', err);
      throw err;
    });
}

async function addUserToParty({ partyId, newComputerId, newUsername, newUserReady }) {
  try {
    const existingData = await getExistingPartyData(partyId);
    const currentPartyData = existingData[0] || {};

    const { computerIds = [], usernames = [], usersReady = [] } = currentPartyData;

    // Check if user already exists (based on device ID)
    const existingIndex = computerIds.indexOf(newComputerId);
    userPingToParty(deviceId, partyCode);
    if (existingIndex !== -1) {
      // User already exists, update their info instead
      return UpdateUserPartyData({
        partyId,
        computerId: newComputerId,
        newUsername,
        newUserReady,
      });
    }

    const updatedComputerIds = [...computerIds, newComputerId];
    const updatedUsernames = [...usernames, newUsername];

    // Ensure usersReady stays in sync by appending to it only
    const updatedUsersReady = [...usersReady, newUserReady];

    console.log('Updated data:', { updatedComputerIds, updatedUsernames, updatedUsersReady });

    return updateOnlineParty({
      partyId,
      computerIds: updatedComputerIds,
      usernames: updatedUsernames,
      usersReady: updatedUsersReady,
      gamemode: currentPartyData.gamemode || 'Truth Or Dare',
      isPlaying: currentPartyData.isPlaying || false,
      lastPinged: Date.now(),
      shuffleSeed: currentPartyData.shuffleSeed
    });
  } catch (err) {
    console.error('❌ Append failed:', err);
    throw err;
  }
}


async function UpdateUserPartyData({ partyId, computerId, newUsername, newUserReady }) {
  try {
    // Step 1: Fetch existing party data
    const existingData = await getExistingPartyData(partyId);
    const partyIndex = existingData.indexOf(partyId);

    if (!existingData || existingData.length === 0) {
      throw new Error('No party data found.');
    }
    console.log("partyCode: " + partyId);
    const currentPartyData = existingData[0]; // Access the actual party data object
    console.log("currentPartyData: " + existingData[0].partyId);
    const { computerIds = [], usernames = [], usersReady = [] } = currentPartyData;

    // Step 2: Find index of the given computerId (device ID)
    const index = computerIds.indexOf(computerId);

    if (index === -1) {
      throw new Error(`Computer ID "${computerId}" not found in party.`);
    }
    userPingToParty(deviceId, partyCode);
    // Step 3: Update values at the found index
    if (newUsername !== undefined) usernames[index] = newUsername;
    if (newUserReady !== undefined) usersReady[index] = newUserReady;

    // Step 4: Send updated data back to the server
    return updateOnlineParty({
      partyId,
      computerIds,
      usernames,
      usersReady,
      gamemode: currentPartyData.gamemode || 'default',
      isPlaying: currentPartyData.isPlaying || false,
      lastPinged: Date.now(),
      shuffleSeed: currentPartyData.shuffleSeed
    });

  } catch (err) {
    console.error('❌ Update by computerId failed:', err);
    throw err;
  }
}

async function removeUserFromParty(partyId, computerIdToRemove) {
  const url = `/api/party-games/remove-user`;
  const payload = JSON.stringify({ partyId, computerIdToRemove });
  const blob = new Blob([payload], { type: 'application/json' });
  navigator.sendBeacon(url, blob);

  const res = await fetch(`/api/party-games?partyCode=${partyId}`);
  const data = await res.json();
  const allUsersReady = data[0].usersReady.every(userReady => userReady === true);
  if (data[0].computerIds.length >= 1) {
    deleteParty();
  }
  else {
    updateStartGameButton(allUsersReady);
  }
}

// When a party update is received
socket.on("party-updated", async (change) => {
  if (partyCode) {
    const res = await fetch(`/api/party-games?partyCode=${partyCode}`);
    const data = await res.json();
    if (!data || data.length === 0) return;

    const latestPing = data[0].lastPinged;
    if (lastKnownPing && new Date(latestPing).getTime() !== new Date(lastKnownPing).getTime()) {
      console.log('🟢 Party data changed!');
      userPingToParty(deviceId, partyCode);
      //Paranoia Page
      if (data[0].isPlaying) {
        if(data[0].userInstructions == "DISPLAY_PUBLIC_CARD"){ 

        }
        else if(data[0].userInstructions == "NEXT_USER_TURN"){
          NextUserTurn();
        }
        else if (data[0].userInstructions.includes("USER_HAS_PASSED")) {
          UserHasPassed(data[0].userInstructions);
        }
        else if (data[0].userInstructions.includes("USER_SELECTED_FOR_PUNISHMENT")) {
          UserSelectedForPunishment(data[0].userInstructions);
        }
        else if (data[0].userInstructions.includes("WAITING_FOR_PLAYER")) {
          WaitingForPlayer(data[0].userInstructions);
        }
        else if (data[0].userInstructions.includes("CHOSE_PUNISHMENT")) {
          ChosePunishment(data[0].userInstructions);
        }
        else if (data[0].userInstructions.includes("CHOOSING_PUNISHMENT")) {
          ChoosingPunishment(data[0].userInstructions);
        }
        else if(waitingForHost){
          if (hostname === 'overexposed.app') {
            transitionSplashScreen(`${protocol}//${hostname}` + "/" + data[0].gamemode + "/" + partyCode, `/images/splash-screens/${formatPackName(data[0].gamemode)}.png`);
          } else {
            transitionSplashScreen(`${protocol}//${hostname}:3000` + "/" + data[0].gamemode + "/" + partyCode, `/images/splash-screens/${formatPackName(data[0].gamemode)}.png`);
          }
        }
        await updateOnlineParty({
          userInstructions: "",
        });
      }
      }
      //Game Settings page
      else {
        if (hostedParty) {
          checkForGameSettingsUpdates(data[0]);
        }
      // Handle update (refresh UI, show message, etc.)
    }
    lastKnownPing = latestPing;
  }
});


function joinParty(partyCode) {
  console.log(`Joining party: ${partyCode}`);
  socket.emit('join-party', partyCode);  // Emit the join-party event
}
async function checkAndDeleteEmptyParty(partyId) {
  try {
    const existingData = await getExistingPartyData(partyId);
    if (!existingData || existingData.length === 0) {
      console.warn('No party data found.');
      return;
    }

    const currentPartyData = existingData[0];
    const { computerIds = [], usernames = [], usersReady = [] } = currentPartyData;

    const isEmpty = computerIds.length === 0 && usernames.length === 0 && usersReady.length === 0;

    if (isEmpty) {
      deleteParty();
    } else {
      console.log(`Party "${partyId}" still has users. No action taken.`);
    }
  } catch (err) {
    console.error('❌ Error checking or deleting empty party:', err);
  }
}

async function deleteParty() {
  try {
    const existingData = await getExistingPartyData(partyCode);
    if (!existingData || existingData.length === 0) {
      console.warn('No party data found.');
      return;
    }
    for(let i = 0;i<existingData[0].computerIds.length;i++){
      deleteUserIcon(existingData[0].computerIds[i]);
    }
    const res = await fetch(`/api/party-games?partyCode=${partyCode}`, {
      method: 'DELETE',
    });

    const currentPartyData = existingData[0];
    if (currentPartyData.isPlaying == true) {
      return;
    }

    if (!res.ok) {
      throw new Error('Failed to delete party');
    }
    if (hostedParty) {
      gameSettingsContainer.classList.add('active');
      gameSettingsContainerButton.classList.add('active');
      onlineSettingsContainerButton.classList.remove('active');
      onlineSettingsContainer.classList.remove('active');
      onlineSettingsContainerButton.classList.add('disabled');
      onlineButton.classList.remove('active');
    }
    // Optionally, clear the party code from the session or app state if needed
    console.log(`Party with code ${partyCode} deleted successfully`);

    // Emit the delete event via socket
    socket.emit('delete-party', partyCode);
  } catch (err) {
    console.error('❌ Error deleting party:', err);
  }
}

async function setIsPlayingForParty(partyId, newIsPlayingValue) {
  try {
    const existingData = await getExistingPartyData(partyId);

    if (!existingData || existingData.length === 0) {
      throw new Error(`No party found with ID ${partyId}`);
    }

    const currentPartyData = existingData[0];

    await updateOnlineParty({
      partyId,
      computerIds: currentPartyData.computerIds,
      usernames: currentPartyData.usernames,
      usersReady: currentPartyData.usersReady,
      gamemode: currentPartyData.gamemode,
      isPlaying: newIsPlayingValue,
      lastPinged: Date.now(),
      shuffleSeed: currentPartyData.shuffleSeed
    });

    console.log(`✅ isPlaying updated to ${newIsPlayingValue} for party ${partyId}`);
  } catch (error) {
    console.error('❌ Failed to update isPlaying:', error);
  }
}

async function userPingToParty(deviceId, partyId) {
  try {
    const existingData = await getExistingPartyData(partyId);
    if (!existingData || existingData.length === 0) {
      throw new Error('No party data found.');
    }

    const currentPartyData = existingData[0];
    const { computerIds = [], usersLastPing = [] } = currentPartyData;

    const index = computerIds.indexOf(deviceId);
    if (index === -1) {
      throw new Error(`Device ID "${deviceId}" not found in party.`);
    }

    usersLastPing[index] = Date.now();

    return updateOnlineParty({
      partyId,
      usersLastPing,
    });
  } catch (err) {
    console.error('❌ Failed to ping user in party:', err);
    throw err;
  }
}


function formatPackName(name) {
  return name.toLowerCase().replace(/\s+/g, '-');
}

