function createPartyPlayerTools(context) {
  function getPartyPlayerId(player) {
    return player?.identity?.computerId ?? player?.computerId ?? null;
  }

  function getPartyPlayerAccountId(player) {
    const accountId = player?.identity?.accountId ?? player?.accountId ?? null;
    const accountIdString = accountId ? String(accountId) : '';
    return /^[a-f\d]{24}$/i.test(accountIdString) ? accountIdString : null;
  }

  function getPartyPlayerState(player) {
    if (!player.state || typeof player.state !== 'object') {
      player.state = {};
    }
    return player.state;
  }

  function ensurePartyPlayerConnection(player) {
    if (!player.connection || typeof player.connection !== 'object') {
      player.connection = {
        socketId: player?.socketId ?? null,
        lastPing: new Date()
      };
    }
    return player.connection;
  }

  return {
    getPartyPlayerId,
    getPartyPlayerAccountId,
    getPartyPlayerState,
    ensurePartyPlayerConnection
  };
}

module.exports = { createPartyPlayerTools };
