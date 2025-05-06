let hostedParty = false;

const { protocol, hostname } = window.location;
const socket = io(`${protocol}//${hostname}:3000`);

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
    // Step 1: Get existing party data
    const existingData = await getExistingPartyData(partyId);

    // Ensure that existingData[0] (or whatever index you need) is used correctly
    const currentPartyData = existingData[0] || {}; // Ensure we get the first item (if it's an array)

    // Step 2: Append new data to existing arrays
    const updatedComputerIds = [...(currentPartyData.computerIds || []), newComputerId];
    const updatedUsernames = [...(currentPartyData.usernames || []), newUsername];
    const updatedUsersReady = [...(currentPartyData.usersReady || []), newUserReady];

    console.log('Updated data:', { updatedComputerIds, updatedUsernames, updatedUsersReady });  // Debug log

    // Step 3: Update using existing update function
    return updateOnlineParty({
      partyId,
      computerIds: updatedComputerIds,
      usernames: updatedUsernames,
      usersReady: updatedUsersReady,
      gamemode: currentPartyData.gamemode || 'Truth Or Dare',  // Include gamemode from existing data
      isPlaying: currentPartyData.isPlaying || false,    // Include isPlaying from existing data
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
    console.log('Existing data:', JSON.stringify(existingData, null, 2));  // Debug log

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
      //Paranoia Page
      if (data[0].isPlaying) {
        if(data[0].userInstructions == "SHOW_PUBLIC_CARD"){

        }
        else if(data[0].userInstructions == "NEXT_USER_TURN"){
          const selectedQuestionObj = getNextQuestion();
          updateTextContainer(selectedQuestionObj.question, selectedQuestionObj.cardType);

          if(data[0].computerIds[data[0].playerTurn] == deviceId){
            gameContainerPrivate.classList.add('active');
          }
          else{
            waitingForPlayerContainer.classList.add('active');
            waitingForPlayerTitle.textContent = "Waiting for " + data[0].usernames[data[0].playerTurn]
            waitingForPlayerText.textContent = "Reading Card...";
          }
        }
      }
      //Game Settings page
      else {
        if (hostedParty) {
          checkForGameSettingsUpdates(data[0]);
        }
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
    console.log(partyCode);
    const res = await fetch(`/api/party-games?partyCode=${partyCode}`, {
      method: 'DELETE',
    });

    const existingData = await getExistingPartyData(partyCode);
    if (!existingData || existingData.length === 0) {
      console.warn('No party data found.');
      return;
    }

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
