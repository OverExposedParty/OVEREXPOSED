// Game rules helpers
function getIncrementContainerValue(key) {
  if (!Array.isArray(partyRulesSettings)) return null;

  const entry = partyRulesSettings.find((rule) => {
    const [ruleKey] = rule.split(':');
    return ruleKey.includes(key);
  });

  if (!entry) return null;

  const [, value] = entry.split(':');
  return Number(value);
}

// Game page loader
async function CheckGamePage() {
  waitForFunction('SetScriptLoaded', () => {
    SetScriptLoaded('/scripts/party-games/online/online-settings.js');
  });
}

// Refreshes this player's connection and returns the server-selected host.
async function checkAndMaybeBecomeHost({ party, deviceId, onlineUsername }) {
  const players = party.players || [];
  const state = party.state ?? party;

  if (!state) return null;

  const myIndex = players.findIndex(
    (player) =>
      player.identity?.computerId === deviceId || player.computerId === deviceId
  );

  if (myIndex === -1) {
    return state.hostComputerId || null;
  }

  try {
    const data = await UpdateUserPartyData({
      partyId: party.partyId || party.partyCode || partyCode,
      computerId: deviceId,
      newUserSocketId: typeof socket?.id === 'string' ? socket.id : null
    });

    const updatedHostId = data?.updated?.state?.hostComputerId;
    if (updatedHostId) {
      return updatedHostId;
    }
  } catch (error) {
    console.error('Failed to refresh host connection:', error);
  }

  return state.hostComputerId || null;
}

async function SendPlayerDataToParty(player) {
  const playerId = getPlayerId(player) || deviceId;
  if (!playerId) return;

  const data = await UpdateUserPartyData({
    partyId: partyCode,
    computerId: playerId,
    playerPatch: player
  });

  if (data?.updated) {
    currentPartyData = data.updated;
  }
}
