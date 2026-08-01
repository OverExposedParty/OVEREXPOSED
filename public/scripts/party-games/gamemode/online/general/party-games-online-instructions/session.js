function normalizeConfig(doc) {
  if (doc.config) return { ...doc.config };
  return {
    gamemode: doc.gamemode,
    gameRules: doc.gameRules,
    selectedPacks: doc.selectedPacks,
    roleCounts: doc.roleCounts,
    userInstructions: doc.userInstructions,
    shuffleSeed: doc.shuffleSeed
  };
}

function normalizeState(doc) {
  const base = doc.state ? { ...doc.state } : {};
  if (base.isPlaying == null && doc.isPlaying != null)
    base.isPlaying = doc.isPlaying;
  if (base.lastPinged == null && doc.lastPinged != null)
    base.lastPinged = doc.lastPinged;
  if (base.playerTurn == null && doc.playerTurn != null)
    base.playerTurn = doc.playerTurn;
  if (base.timer == null && doc.timer != null) base.timer = doc.timer;
  if (base.speakingRound == null) {
    base.speakingRound = doc.speakingRound ?? base.round ?? doc.round ?? 0;
  }
  if (base.speakingPlayerTurn == null) {
    base.speakingPlayerTurn =
      doc.speakingPlayerTurn ??
      base.roundPlayerTurn ??
      doc.roundPlayerTurn ??
      0;
  }
  if (base.completedRounds == null && doc.completedRounds != null) {
    base.completedRounds = doc.completedRounds;
  }
  if (base.userInstructions == null && doc.userInstructions != null)
    base.userInstructions = doc.userInstructions;
  if (base.vote == null && doc.vote != null) base.vote = doc.vote;
  return base;
}

function normalizeDeck(doc) {
  const base = doc.deck ? { ...doc.deck } : {};
  if (base.currentCardIndex == null && doc.currentCardIndex != null)
    base.currentCardIndex = doc.currentCardIndex;
  if (base.currentCardSecondIndex == null && doc.currentCardSecondIndex != null)
    base.currentCardSecondIndex = doc.currentCardSecondIndex;
  if (
    base.alternativeQuestionIndex == null &&
    doc.alternativeQuestionIndex != null
  )
    base.alternativeQuestionIndex = doc.alternativeQuestionIndex;
  if (base.questionType == null && doc.questionType != null)
    base.questionType = doc.questionType;
  return base;
}

function getPlayerUsername(player) {
  return player?.identity?.username ?? player?.username ?? '';
}

function getPlayerIcon(player) {
  return (
    player?.identity?.userIcon ?? player?.userIcon ?? '0000:0100:0200:0300'
  );
}

function getPlayerState(player) {
  return player?.state ?? player ?? {};
}

function ensureConnection(player) {
  if (!player.connection) {
    player.connection = {
      socketId: player.socketId ?? null,
      lastPing: player.lastPing ? new Date(player.lastPing) : new Date()
    };
  }
  return player.connection;
}

function getPlayerId(player) {
  return player?.identity?.computerId ?? player?.computerId ?? null;
}

function getPlayerUsername(player) {
  return player?.identity?.username ?? player?.username ?? '';
}

function getPlayerIcon(player) {
  return player?.identity?.userIcon ?? player?.userIcon ?? '';
}

function getPartyConfig(party) {
  return party.config ?? party;
}

function getPartyState(party) {
  return party.state ?? party;
}

function getPartyDeck(party) {
  return party.deck ?? party;
}

function findOnlinePlayerIndex(players = [], currentDeviceId = deviceId) {
  return players.findIndex((player) => getPlayerId(player) === currentDeviceId);
}

async function bootstrapOnlineGamePage({
  requirePlaying = true,
  updateCurrentPartyData = false,
  joinRoom = true
} = {}) {
  const party = await waitForOnlinePartySnapshot({
    requirePlayer: false,
    requirePlaying: false
  });

  if (!party) {
    ShowPartyDoesNotExistState();
    return null;
  }

  const initialState = getPartyState(party);
  if (
    requirePlaying &&
    initialState.isPlaying !== true &&
    initialState.phase === 'lobby'
  ) {
    currentPartyData = party;
    redirectOnlinePartyToLobby(party, {
      forceWaitingRoom:
        String(initialState.hostComputerId || '') !== String(deviceId)
    });
    return null;
  }

  if (updateCurrentPartyData) {
    currentPartyData = party;
  }

  const players = party.players || [];
  const config = getPartyConfig(party);
  const state = getPartyState(party);
  const deck = getPartyDeck(party);

  if (players.length === 0) {
    console.warn('No players in party.');
    return null;
  }

  isPlaying = !!state.isPlaying;

  const index = findOnlinePlayerIndex(players);
  if (index === -1) {
    console.warn('Current device not found in players.');
    ShowGameAlreadyStartedState();
    return null;
  }

  const me = players[index];
  onlineUsername = getPlayerUsername(me);

  const resolvedHostId = await checkAndMaybeBecomeHost({
    party,
    deviceId,
    onlineUsername
  });

  hostDeviceId = resolvedHostId || getPlayerId(players[0]) || '';

  const meConn = ensureConnection(me);
  meConn.socketId = socket.id;
  me.socketId = socket.id;

  if (joinRoom) {
    await joinParty(partyCode);
  }

  return {
    party,
    players,
    config,
    state,
    deck,
    index,
    me,
    resolvedHostId: hostDeviceId,
    onlineUsername
  };
}

function getUserInstructions(party) {
  const config = getPartyConfig(party);
  const state = getPartyState(party);

  return (
    config.userInstructions ??
    state.userInstructions ??
    party.userInstructions ??
    ''
  );
}

function getTimeLimit(key = 'time-limit') {
  if (!gameRules) return 120;
  let raw = gameRules[key];

  if (
    (raw === undefined || raw === null || raw === '') &&
    key !== 'time-limit'
  ) {
    raw = gameRules['time-limit'];
  }

  if (raw === undefined || raw === null || raw === '') {
    return 120;
  }

  const n = Number(raw);
  if (Number.isNaN(n)) return 120;
  return n;
}

window.bootstrapOnlineGamePage = bootstrapOnlineGamePage;
