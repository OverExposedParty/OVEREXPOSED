// party-api.js

async function getExistingPartyData(partyId, partyType = sessionPartyType) {
  try {
    const res = await fetch(`/api/${partyType}?partyCode=${partyId}`);
    const existingData = await res.json();
    return existingData;
  } catch (err) {
    console.error('❌ Failed to fetch existing party data:', err);
    throw err;
  }
}

async function GetCurrentPartyData() {
  const existingData = await getExistingPartyData(partyCode);
  if (!existingData || existingData.length === 0) {
    console.warn('No party data found.');
    return;
  }
  return existingData[0];
}

async function reserveUniquePartyCode() {
  const res = await fetch('/api/party-code/reserve', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    }
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || 'Failed to reserve unique party code');
  }

  const data = await res.json();
  return data.partyCode;
}

async function getPartyChatLog() {
  try {
    const res = await fetch(`/api/chat/${partyCode}`);
    const existingData = await res.json();
    return existingData;
  } catch (err) {
    console.error('❌ Failed to fetch existing party data:', err);
    throw err;
  }
}

function updateOnlineParty({
  partyType = sessionPartyType,
  partyId,
  config,
  state,
  deck,
  players
}) {
  const isDeckGame = !partyType?.startsWith('party-game-mafia');
      console.log("config:", config);
  const payload = {
    partyId,
    ...(isDeckGame && deck !== undefined && { deck }),
    ...(config !== undefined && { config }),
    ...(state !== undefined && { state }),
    ...(players !== undefined && { players })
  };
    console.log("players", players);
  postToBothEndpoints(
    payload,
    `/api/${partyType}?partyCode=${partyId}`,
    `/api/waiting-room?partyCode=${partyId}`
  );
}

async function addUserToParty({
  partyId,
  newComputerId,
  newUsername,
  newUserIcon,
  newScore,
  newUserReady = false,
  newUserConfirmation = false,
  newUserSocketId = null
}) {
  try {
    const existingData = await getExistingPartyData(partyId);
    const currentPartyData = existingData[0] || {};

    const players = currentPartyData.players || [];

    // Check if user already exists by computerId (now nested under identity)
    const existingIndex = players.findIndex(
      p => p.identity?.computerId === newComputerId
    );

    if (existingIndex !== -1) {
      // User exists, update their info instead
      return UpdateUserPartyData({
        partyId,
        computerId: newComputerId,
        newUsername,
        newUserIcon,
        newScore,
        newUserReady,
        newUserConfirmation,
        newUserSocketId
      });
    }

    // Create new nested player object
    const newPlayer = {
      identity: {
        computerId: newComputerId,
        username: newUsername,
        userIcon: newUserIcon ?? '0000:0100:0200:0300'
      },
      connection: {
        socketId: newUserSocketId,
        lastPing: new Date()
      },
      state: {
        isReady: newUserReady,
        hasConfirmed: newUserConfirmation,
        // for Truth or Dare; Mafia can just ignore or schema can include it
        score: newScore ?? 0
      }
      // Mafia's nightPhase / role / status defaults will be filled in server-side
    };

    const updatedPlayers = [...players, newPlayer];

    return updateOnlineParty({
      partyId,
      players: updatedPlayers
    });
  } catch (err) {
    console.error('❌ Append failed:', err);
    throw err;
  }
}

async function UpdateUserReady({ partyId, computerId, newReady, newConfirmation }) {
  try {
    await UpdateUserPartyData({
      partyId,
      computerId,
      newUserReady: newReady,
      newUserConfirmation: newConfirmation
    });
  } catch (err) {
    console.error('❌ Failed to update user ready status:', err);
  }
}

async function UpdateUserPartyData({
  partyId,
  computerId,
  newUsername,
  newUserIcon,
  newUserReady,
  newUserConfirmation,
  newScore,
  newUserSocketId
}) {
  try {
    const existingData = await getExistingPartyData(partyId);

    if (!existingData || existingData.length === 0) {
      throw new Error('No party data found.');
    }

    const currentPartyData = existingData[0];
    const players = currentPartyData.players || [];

    const index = players.findIndex(
      player => player.identity?.computerId === computerId
    );

    if (index === -1) {
      throw new Error(`Computer ID "${computerId}" not found in party.`);
    }

    const player = players[index];

    if (newUsername !== undefined) {
      player.identity = player.identity || {};
      player.identity.username = newUsername;
    }

    if (newUserIcon !== undefined) {
      player.identity = player.identity || {};
      player.identity.userIcon = newUserIcon;
    }

    if (newUserReady !== undefined) {
      player.state = player.state || {};
      player.state.isReady = newUserReady;
    }

    if (newUserConfirmation !== undefined) {
      player.state = player.state || {};
      player.state.hasConfirmed = newUserConfirmation;
    }

    if (newScore !== undefined) {
      player.state = player.state || {};
      player.state.score = newScore;
    }

    if (newUserSocketId !== undefined) {
      player.connection = player.connection || {};
      player.connection.socketId = newUserSocketId;
    }

    player.connection = player.connection || {};
    player.connection.lastPing = new Date();


    return updateOnlineParty({
      partyId,
      players
    });
  } catch (err) {
    console.error('❌ Update by computerId failed:', err);
    throw err;
  }
}

async function removeUserFromParty(partyId, computerIdToRemove, partyType = sessionPartyType) {
  const url = `/api/${partyType}/remove-user`;
  const payload = { partyId, computerIdToRemove };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const error = await res.json();
    console.error('Failed to remove user:', error);
    return;
  }

  const partyRes = await fetch(`/api/${partyType}?partyCode=${partyId}`);
  const data = await partyRes.json();
  const party = data[0];

  allUsersReady = party.players.every(
    player => player.state?.isReady === true
  );

  if (party.players.length === 0) {
    DeleteParty();
  } else {
    updateStartGameButton(allUsersReady);
  }
}

async function checkAndDeleteEmptyParty(partyId) {
  try {
    const existingData = await getExistingPartyData(partyId);
    if (!existingData || existingData.length === 0) {
      console.warn('No party data found.');
      return;
    }

    const currentPartyData = existingData[0];
    const players = currentPartyData.players || [];

    const isEmpty = players.length === 0;

    if (isEmpty) {
      await DeleteParty(partyId);
    } else {
      console.log(`Party "${partyId}" still has users. No action taken.`);
    }
  } catch (err) {
    console.error('❌ Error checking or deleting empty party:', err);
  }
}

function DeleteParty() {
  if (!partyCode) return;
  hostedParty = false;
  const payload = JSON.stringify({ partyCode });
  const blob = new Blob([payload], { type: 'application/json' });

  socket.emit('delete-party', partyCode);
  partyCode = null;
  console.log('🚀 Party deleted');
  navigator.sendBeacon(`/api/${sessionPartyType}/delete`, blob);
}

async function setIsPlayingForParty(partyId, newIsPlayingValue) {
  try {
    const existingData = await getExistingPartyData(partyId);

    if (!existingData || existingData.length === 0) {
      throw new Error(`No party found with ID ${partyId}`);
    }

    const currentPartyData = existingData[0];

    const currentState =
      currentPartyData.state ??
      {
        isPlaying: currentPartyData.isPlaying,
        lastPinged: currentPartyData.lastPinged,
        phase: currentPartyData.phase,
        timer: currentPartyData.timer,
        playerTurn: currentPartyData.playerTurn,
        currentCardIndex: currentPartyData.currentCardIndex,
        currentCardSecondIndex: currentPartyData.currentCardSecondIndex,
        questionType: currentPartyData.questionType
      };

    const updatedState = {
      ...currentState,
      isPlaying: newIsPlayingValue,
      lastPinged: Date.now(),
      hostComputerIdList: getAllDeviceIDs(currentPartyData)
    };

    await updateOnlineParty({
      partyId,
      state: updatedState
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
    const players = currentPartyData.players || [];

    const index = players.findIndex(
      player => player.identity?.computerId === deviceId
    );
    if (index === -1) {
      throw new Error(`Device ID "${deviceId}" not found in party.`);
    }

    players[index].connection = players[index].connection || {};
    players[index].connection.lastPing = new Date();

    return updateOnlineParty({
      partyId,
      players
    });
  } catch (err) {
    console.error('❌ Failed to ping user in party:', err);
    throw err;
  }
}

async function GetAllUsersReady() {
  const partyRes = await fetch(`/api/${sessionPartyType}?partyCode=${partyCode}`);
  const data = await partyRes.json();
  const party = data[0];
  if (!party) return true;

  if (party.players.length === 1) return false;

  return party.players
    .slice(1)
    .every(player => player.state?.isReady === true);
}

function getAllDeviceIDs(currentPartyData) {
  return currentPartyData.players.map(player => player.identity.computerId);
}
