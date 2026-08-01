function createPartySocketStateTools({ io }) {
  const partyJoinLocks = new Map();
  const socketPartyMemberships = new Map();
  const disconnectGraceTimers = new Map();
  const DISCONNECT_GRACE_PERIOD_MS = 45 * 1000;

  async function withPartyJoinLock(partyId, task) {
    const previous = partyJoinLocks.get(partyId) || Promise.resolve();
    const current = previous.catch(() => {}).then(task);
    const stored = current.catch(() => {});

    partyJoinLocks.set(partyId, stored);

    try {
      return await current;
    } finally {
      if (partyJoinLocks.get(partyId) === stored) {
        partyJoinLocks.delete(partyId);
      }
    }
  }

  function getSocketPartyMembershipKey(partyId, computerId) {
    return `${partyId}:${computerId}`;
  }

  function getDisconnectGraceKey(partyId, computerId) {
    return `${partyId}:${computerId}`;
  }

  function cancelDisconnectGrace(partyId, computerId) {
    const key = getDisconnectGraceKey(partyId, computerId);
    const timer = disconnectGraceTimers.get(key);
    if (timer) clearTimeout(timer);
    disconnectGraceTimers.delete(key);
  }

  function rememberSocketPartyMembership({
    socketId,
    partyId,
    computerId,
    mainModel,
    waitingRoomModel,
    logLabel
  }) {
    if (
      !socketId ||
      socketId === 'DISCONNECTED' ||
      !partyId ||
      !computerId ||
      !mainModel
    ) {
      return;
    }

    const memberships = socketPartyMemberships.get(socketId) || new Map();
    memberships.set(getSocketPartyMembershipKey(partyId, computerId), {
      partyId,
      computerId,
      mainModel,
      waitingRoomModel,
      logLabel
    });
    socketPartyMemberships.set(socketId, memberships);
  }

  function forgetSocketPartyMembership(socketId, partyId, computerId) {
    if (!socketId) return;

    const memberships = socketPartyMemberships.get(socketId);
    if (!memberships) return;

    memberships.delete(getSocketPartyMembershipKey(partyId, computerId));

    if (memberships.size === 0) {
      socketPartyMemberships.delete(socketId);
    }
  }

  function isSocketIdActive(socketId) {
    return Boolean(
      socketId &&
      socketId !== 'DISCONNECTED' &&
      io.sockets.sockets.get(socketId)
    );
  }

  function getPlayerConnectionSocketId(player) {
    return player?.connection?.socketId ?? player?.socketId ?? null;
  }

  function hasLivePartySocketId(socketId) {
    return Boolean(socketId && socketId !== 'DISCONNECTED');
  }

  function isDisconnectedPartyPlayer(player) {
    const socketId = getPlayerConnectionSocketId(player);
    const participationStatus = String(
      player?.state?.participationStatus || ''
    ).toLowerCase();

    return (
      socketId === 'DISCONNECTED' ||
      participationStatus === 'reconnecting' ||
      (!hasLivePartySocketId(socketId) &&
        participationStatus === 'disconnected')
    );
  }

  function getConnectedPartyPlayers(players = []) {
    return players.filter((player) => !isDisconnectedPartyPlayer(player));
  }

  return {
    partyJoinLocks,
    socketPartyMemberships,
    disconnectGraceTimers,
    DISCONNECT_GRACE_PERIOD_MS,
    withPartyJoinLock,
    getSocketPartyMembershipKey,
    getDisconnectGraceKey,
    cancelDisconnectGrace,
    rememberSocketPartyMembership,
    forgetSocketPartyMembership,
    isSocketIdActive,
    getPlayerConnectionSocketId,
    hasLivePartySocketId,
    isDisconnectedPartyPlayer,
    getConnectedPartyPlayers
  };
}

module.exports = { createPartySocketStateTools };
