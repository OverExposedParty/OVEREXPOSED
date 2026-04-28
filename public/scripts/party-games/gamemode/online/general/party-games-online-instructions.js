let gameRules = {};
let partyRulesSettings;

const resultTimerDuration = 5000;

async function refreshCurrentPartyData({
  requireInstructions = false,
  retries = 2,
  delayMs = 150
} = {}) {
  const latestPartyData = await GetCurrentPartyData({
    requireInstructions,
    retries,
    delayMs
  });

  if (latestPartyData) {
    currentPartyData = latestPartyData;
  }

  return currentPartyData ?? null;
}

async function SendInstruction({
  instruction = null,
  updateUsersReady = null,
  updateUsersConfirmation = null,
  updateUsersVote = null,
  partyData = null,
  fetchInstruction = false,
  isPlaying = true,
  timer = null,
  byPassHost = false
}) {
  if (!byPassHost) {
    let authoritativeHostId = hostDeviceId;

    try {
      const latestPartyData = await GetCurrentPartyData({ retries: 1 });
      if (latestPartyData) {
        currentPartyData = latestPartyData;
        authoritativeHostId = latestPartyData.state?.hostComputerId ?? hostDeviceId;
        if (authoritativeHostId) {
          hostDeviceId = authoritativeHostId;
        }
      }
    } catch (error) {
      console.error('Failed to verify host before sending instruction:', error);
    }

    if (String(deviceId) !== String(authoritativeHostId)) return null;
  }

  if (timer !== null && timeout?.cancel) {
    timeout.cancel();
  }

  let updatedParty = null;

  try {
    updatedParty = await performOnlinePartyAction({
      action: 'send-instruction',
      payload: {
        instruction,
        updateUsersReady,
        updateUsersConfirmation,
        updateUsersVote,
        partyData,
        isPlaying,
        timer,
        byPassHost
      }
    });
  } catch (error) {
    if (!byPassHost && error?.message === 'Only the host can perform this action.') {
      const latestPartyData = await GetCurrentPartyData({ retries: 1 }).catch(() => null);
      const authoritativeHostId = latestPartyData?.state?.hostComputerId ?? null;
      if (authoritativeHostId) {
        hostDeviceId = authoritativeHostId;
      }
      return null;
    }

    throw error;
  }

  if (updatedParty) {
    currentPartyData = updatedParty;
  }

  if (fetchInstruction) {
    FetchInstructions();
  }

  return updatedParty;
}


function parseInstructionDeviceId(input) {
  const [instruction, deviceId] = input.split(":");
  return {
    instruction,
    deviceId
  };
}

function parseInstruction(input) {
  const [instruction, reason, deviceId] = input.split(":");
  return {
    instruction,
    reason,
    deviceId
  };
}

function parseInstructionSecondReason(input) {
  const [instruction, reason, secondReason, deviceId] = input.split(":");
  return {
    instruction,
    reason,
    secondReason,
    deviceId
  };
}

async function SetUserConfirmation({
  selectedDeviceId,
  option,
  reason = null,
  userInstruction = null
}) {
  const updatedParty = await performOnlinePartyAction({
    action: 'set-user-confirmation',
    payload: {
      selectedDeviceId,
      option,
      reason,
      userInstruction
    }
  });

  if (updatedParty) {
    currentPartyData = updatedParty;
  }
}

async function setUserBool(selectedDeviceId, userConfirmation = null, userReady = null, setInstruction = null) {
  const updatedParty = await performOnlinePartyAction({
    action: 'set-user-bool',
    payload: {
      selectedDeviceId,
      userConfirmation,
      userReady,
      setInstruction
    }
  });

  if (updatedParty) {
    currentPartyData = updatedParty;
  }
}

function ClearIcons() {
  const icons = waitingForPlayersIconContainer.querySelectorAll('.icon');
  for (let i = 0; i < icons.length; i++) {
    icons[i].classList.remove('yes');
    icons[i].classList.remove('no');
  }
}

async function ResetQuestion({
  icons = null,
  instruction = "DISPLAY_PRIVATE_CARD",
  incrementScore = 0,
  timer = null,
  playerIndex = null,
  nextPlayer = false
}) {
  const updatedParty = await performOnlinePartyAction({
    action: 'reset-question',
    payload: {
      instruction,
      incrementScore,
      timer,
      playerIndex,
      nextPlayer
    }
  });

  if (updatedParty) {
    currentPartyData = updatedParty;
  }

  if (icons !== null) {
    for (let i = 0; i < icons.length; i++) {
      icons[i]?.classList.remove('yes');
      icons[i]?.classList.remove('no');
    }
  }
}

async function PartyRestart() {
  const updatedParty = await performOnlinePartyAction({
    action: 'party-restart',
    payload: {
      resetGamemodeInstruction:
        typeof resetGamemodeInstruction === 'string' ? resetGamemodeInstruction : null
    }
  });

  if (updatedParty) {
    currentPartyData = updatedParty;
    await runOnlineFetchInstructions({ reason: 'party-restart' });
  }
}

function countWords(str) {
  if (!str) return 0;
  return str.split('-').filter(word => word.trim() !== '').length;
}

function createUserButton(id, text) {
  const button = document.createElement("button");
  button.id = id;
  button.textContent = text;
  return button;
}

function formatDashedString({ input, gamemode = null, seperator = ' ', uppercase = true }) {
  let words;

  if (gamemode === null) {
    words = input.split('-');
  } else {
    words = input.split('-').slice(countWords(gamemode));
  }

  return words
    .map(word => {
      if (!word) return '';
      return uppercase
        ? word.charAt(0).toUpperCase() + word.slice(1)
        : word.charAt(0).toLowerCase() + word.slice(1);
    })
    .join(seperator);
}

function ResetVotes(players, gamemodeMafia = false) {
  for (let i = 0; i < players.length; i++) {
    const p = players[i];
    const pState = getPlayerState(p);

    if (gamemodeMafia) {
      if (pState.status === "alive" || p.status === "alive") {
        pState.vote = null;
        p.vote = null;
      }
    } else {
      pState.vote = null;
      p.vote = null;
    }

    pState.hasConfirmed = false;
    pState.isReady = false;
    p.hasConfirmed = false;
    p.isReady = false;
  }
  return players;
}

async function SetVote({ option, sendInstruction = null, hover = false }) {
  const updatedParty = await performOnlinePartyAction({
    action: 'set-vote',
    payload: {
      option,
      sendInstruction,
      hover
    }
  });

  if (updatedParty) {
    currentPartyData = updatedParty;
  }
}

function ResetBoolVotes(players) {
  for (let i = 0; i < players.length; i++) {
    const p = players[i];
    const pState = getPlayerState(p);

    pState.vote = null;
    pState.hasConfirmed = false;
    pState.isReady = false;

    p.vote = null;
    p.hasConfirmed = false;
    p.isReady = false; // legacy mirror
  }
  return players;
}

async function SetBoolVote(bool) {
  const updatedParty = await performOnlinePartyAction({
    action: 'set-bool-vote',
    payload: {
      bool
    }
  });

  if (updatedParty) {
    currentPartyData = updatedParty;
  }
}

function formatWaitingForPlayerActionText(text) {
  if (typeof text !== 'string') return '';

  const trimmedText = text.trim();
  const actionMatch = trimmedText
    .replace(/\.+$/, '')
    .match(/^waiting for .+? to (.+)$/i);

  if (!actionMatch) return trimmedText;

  const actionText = actionMatch[1].replace(/\s+/g, ' ').trim();
  const lowerActionText = actionText.toLowerCase();

  if (lowerActionText === 'spin the drink wheel') return 'Spinning drink wheel...';
  if (lowerActionText === 'down their drink') return 'Downing drink...';

  if (lowerActionText.startsWith('take ')) {
    return `Taking ${actionText.slice(5)}...`;
  }

  const words = actionText.split(' ');
  const firstWord = words.shift()?.toLowerCase() ?? '';
  const actionVerbs = {
    answer: 'Answering',
    choose: 'Choosing',
    decide: 'Deciding',
    down: 'Downing',
    flip: 'Flipping',
    perform: 'Performing',
    read: 'Reading',
    select: 'Selecting',
    show: 'Showing',
    spin: 'Spinning',
    write: 'Writing'
  };

  if (!actionVerbs[firstWord]) return trimmedText;

  const actionObject = words.join(' ').replace(/^the\s+/i, '');
  return `${actionVerbs[firstWord]}${actionObject ? ` ${actionObject}` : ''}...`;
}

function SetWaitingForPlayer({ waitingForRoomTitle, waitingForRoomText, player }) {
  const id = getPlayerId(player);
  const icon = getPlayerIcon(player);

  waitingForPlayerTitle.textContent = waitingForRoomTitle;
  waitingForPlayerText.textContent = formatWaitingForPlayerActionText(waitingForRoomText);
  EditUserIconPartyGames({
    container: waitingForPlayerContainer,
    userId: id,
    userCustomisationString: icon
  });
}

function SetPlayerHasPassed({ playerHasPassedTitleText, playerHasPassedReasonText, player }) {
  playerHasPassedTitle.textContent = playerHasPassedTitleText;
  playerHasPassedText.textContent = playerHasPassedReasonText;

  if (!player) return;

  EditUserIconPartyGames({
    container: playerHasPassedContainer,
    userId: getPlayerId(player),
    userCustomisationString: getPlayerIcon(player)
  });
}

function getOnlineTimerWrapper(container, label = 'unknown-container') {
  if (!container) {
    debugWarn('[OE_DEBUG][online-ui][missing-container]', {
      gamemode,
      label
    });
    return null;
  }

  const timerWrapper = container.querySelector('.timer-wrapper');
  if (!timerWrapper) {
    debugWarn('[OE_DEBUG][online-ui][missing-timer-wrapper]', {
      gamemode,
      label,
      containerId: container.id ?? null,
      containerClassName: container.className ?? null
    });
    return null;
  }

  return timerWrapper;
}

function startTimerWithContainer({
  container,
  label,
  timeLeft,
  duration
}) {
  const timerWrapper = getOnlineTimerWrapper(container, label);
  if (!timerWrapper) return false;

  startTimer({
    timeLeft,
    duration,
    selectedTimer: timerWrapper
  });

  return true;
}

function stopTimerForContainer(container, label) {
  const timerWrapper = getOnlineTimerWrapper(container, label);
  if (!timerWrapper) return false;

  stopTimer(timerWrapper);
  return true;
}

const nsfwBadgeEnabledGamemodes = new Set([
  "truth-or-dare",
  "paranoia",
  "never-have-i-ever",
  "most-likely-to",
  "would-you-rather"
]);

function setOnlineNsfwCardBadge(card, isNsfw) {
  const mainImageContainer = card?.querySelector('.main-image-container');
  if (!mainImageContainer) return;

  let nsfwBadge = mainImageContainer.querySelector('.nsfw-card-icon');
  if (!nsfwBadge) {
    nsfwBadge = document.createElement('img');
    nsfwBadge.className = 'nsfw-card-icon';
    nsfwBadge.src = '/images/icons/difficulty/nsfw.svg';
    nsfwBadge.alt = 'NSFW Difficulty';
    nsfwBadge.loading = 'lazy';
    mainImageContainer.appendChild(nsfwBadge);
  }

  nsfwBadge.classList.toggle('active', Boolean(isNsfw));
}

function DisplayCard(card, questionObject) {
  const cardText = card.querySelector('.text-container');
  const cardImage = card.querySelector('.main-image');
  const cardType = card.querySelector('.card-type-text');
  const showNsfwBadge = nsfwBadgeEnabledGamemodes.has(gamemode);

  cardText.textContent = questionObject.question;
  const matchedPack = applyOnlinePackTheme(questionObject.cardType);
  if (matchedPack) {
    const imageUrl = matchedPack.packCard ? matchedPack.packCard : `/images/blank-cards/${gamemode}-blank-card.svg`;
    cardImage.src = imageUrl;
    cardText.style.color = matchedPack.packColour;
    card.querySelector('.card-type-text').style.color = matchedPack.packColour;
    if (showNsfwBadge) {
      setOnlineNsfwCardBadge(card, matchedPack.packRestriction === 'nsfw');
    }
  } else {
    debugLog("Pack not found");
    if (showNsfwBadge) {
      setOnlineNsfwCardBadge(card, false);
    }
  }
  cardType.textContent = questionObject.cardType;
}

async function ChoosingPunishment(index = null) {
  timeout?.cancel();
  stopTimerForContainer(waitingForPlayerContainer, 'waitingForPlayerContainer');

  const players = currentPartyData.players || [];
  const state = normalizeState(currentPartyData);

  if (index === null) {
    const turnIndex = state.playerTurn ?? currentPartyData.playerTurn ?? 0;
    const turnPlayer = players[turnIndex];
    if (!turnPlayer) return;
    const turnPlayerVote = getPlayerState(turnPlayer).vote ?? turnPlayer.vote;
    index = players.findIndex(player => getPlayerId(player) === turnPlayerVote);
  }

  const currentPlayer = players[index];
  if (!currentPlayer) return;

  const id = getPlayerId(currentPlayer);
  const username = getPlayerUsername(currentPlayer);

  if (id == deviceId) {
    setActiveContainers(selectPunishmentContainer);
  } else {
    SetWaitingForPlayer({
      waitingForRoomTitle: "Waiting for " + username,
      waitingForRoomText: "Choosing Punishment...",
      player: currentPlayer
    });
    setActiveContainers(waitingForPlayerContainer);
  }
}

async function ChosePunishment(index = null) {
  timeout?.cancel();
  stopTimerForContainer(waitingForPlayerContainer, 'waitingForPlayerContainer');

  const players = currentPartyData.players || [];
  let parsedInstructions = parseInstruction(
    currentPartyData.config?.userInstructions ?? currentPartyData.state?.userInstructions ?? ""
  );

  if (index === null) {
    index = players.findIndex(player => getPlayerId(player) === parsedInstructions.deviceId);
  }
  const target = players[index];
  if (!target) return;

  const id = getPlayerId(target);
  const username = getPlayerUsername(target);
  debugLog(parsedInstructions.reason);
  if (deviceId == id) {
    if (parsedInstructions.reason == "DRINK_WHEEL") {
      setActiveContainers(drinkWheelContainer);
    }
    else if (parsedInstructions.reason == "TAKE_A_SHOT") {
      completePunishmentText.textContent = "Take a shot.";
      setActiveContainers(completePunishmentContainer);
    }
    else if (parsedInstructions.reason == "TAKE_A_SIP") {
      completePunishmentText.textContent = "Take a sip.";
      setActiveContainers(completePunishmentContainer);
    }
  }
  else {
    const currentTitle = "Waiting for " + username;
    let currentText;
    if (parsedInstructions.reason == "DRINK_WHEEL") {
      currentText = "Spinning drink wheel...";
    }
    else if (parsedInstructions.reason == "TAKE_A_SHOT") {
      currentText = "Reading punishment...";
    } else {
      currentText = "Reading punishment...";
    }
    SetWaitingForPlayer({
      waitingForRoomTitle: currentTitle,
      waitingForRoomText: currentText,
      player: target
    });
    setActiveContainers(waitingForPlayerContainer);
  }
}

function CheckSettingsExists(key) {
  if (!Array.isArray(partyRulesSettings)) return false;
  return partyRulesSettings.some(rule => rule.includes(key.toLowerCase()));
}

async function AddUserIcons() {
  if (currentPartyData && Array.isArray(currentPartyData.players)) {
    for (let i = 0; i < currentPartyData.players.length; i++) {
      const p = currentPartyData.players[i];
      const id = getPlayerId(p);
      const icon = getPlayerIcon(p);
      createUserIconPartyGames({
        container: waitingForPlayersIconContainer,
        userId: id,
        userCustomisationString: icon
      });
    }
  }
}

function DisplayWaitingForPlayers(confirmation = true) {
  const players = currentPartyData.players || [];
  const index = players.findIndex(player => getPlayerId(player) === deviceId);
  if (index === -1) return;

  const icons = waitingForPlayersIconContainer.querySelectorAll('.icon');

  for (let i = 0; i < players.length; i++) {
    const player = players[i];
    const pState = getPlayerState(player);
    const check = confirmation ? pState.hasConfirmed : pState.isReady;

    if (check === true) {
      icons[i]?.classList.add('yes');
    } else if (check === false) {
      icons[i]?.classList.remove('yes');
    }
  }

  const me = players[index];
  const conn = ensureConnection(me);
  conn.lastPing = new Date();

  setActiveContainers(waitingForPlayersContainer);
}

/* ──────────────────────────────────────────────
   NORMALISERS & HELPERS FOR NESTED/LEGACY SHAPES
────────────────────────────────────────────── */

function normalizeConfig(doc) {
  if (doc.config) return { ...doc.config };
  return {
    gamemode: doc.gamemode,
    gameRules: doc.gameRules,
    selectedPacks: doc.selectedPacks,
    selectedRoles: doc.selectedRoles,
    userInstructions: doc.userInstructions,
    shuffleSeed: doc.shuffleSeed
  };
}

function normalizeState(doc) {
  const base = doc.state ? { ...doc.state } : {};
  if (base.isPlaying == null && doc.isPlaying != null) base.isPlaying = doc.isPlaying;
  if (base.lastPinged == null && doc.lastPinged != null) base.lastPinged = doc.lastPinged;
  if (base.playerTurn == null && doc.playerTurn != null) base.playerTurn = doc.playerTurn;
  if (base.timer == null && doc.timer != null) base.timer = doc.timer;
  if (base.round == null && doc.round != null) base.round = doc.round;
  if (base.roundPlayerTurn == null && doc.roundPlayerTurn != null) base.roundPlayerTurn = doc.roundPlayerTurn;
  if (base.userInstructions == null && doc.userInstructions != null) base.userInstructions = doc.userInstructions;
  if (base.vote == null && doc.vote != null) base.vote = doc.vote;
  return base;
}

function normalizeDeck(doc) {
  const base = doc.deck ? { ...doc.deck } : {};
  if (base.currentCardIndex == null && doc.currentCardIndex != null) base.currentCardIndex = doc.currentCardIndex;
  if (base.currentCardSecondIndex == null && doc.currentCardSecondIndex != null) base.currentCardSecondIndex = doc.currentCardSecondIndex;
  if (base.alternativeQuestionIndex == null && doc.alternativeQuestionIndex != null) base.alternativeQuestionIndex = doc.alternativeQuestionIndex;
  if (base.questionType == null && doc.questionType != null) base.questionType = doc.questionType;
  return base;
}

function getPlayerUsername(player) {
  return player?.identity?.username ?? player?.username ?? "";
}

function getPlayerIcon(player) {
  return player?.identity?.userIcon ?? player?.userIcon ?? "0000:0100:0200:0300";
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
  return players.findIndex(
    (player) => getPlayerId(player) === currentDeviceId
  );
}

async function bootstrapOnlineGamePage({
  requirePlaying = true,
  updateCurrentPartyData = false,
  joinRoom = true,
  announceReconnect = true
} = {}) {
  const party = await waitForOnlinePartySnapshot({
    requirePlayer: true,
    requirePlaying
  });

  if (!party) {
    ShowPartyDoesNotExistState();
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

  const myConnectionSocket = me.connection?.socketId ?? me.socketId;
  if (announceReconnect && myConnectionSocket === 'DISCONNECTED') {
    sendPartyChat({
      username: '[CONSOLE]',
      message: `${onlineUsername} has reconnected.`,
      eventType: 'connect'
    });
  }

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

function getTimeLimit(key = "time-limit") {
  if (!gameRules) return 120;
  let raw = gameRules[key];

  if ((raw === undefined || raw === null || raw === "") && key !== "time-limit") {
    raw = gameRules["time-limit"];
  }

  if (raw === undefined || raw === null || raw === "") {
    return 120;
  }

  const n = Number(raw);
  if (Number.isNaN(n)) return 120;
  return n;
}

window.bootstrapOnlineGamePage = bootstrapOnlineGamePage;
