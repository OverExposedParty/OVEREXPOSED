let gameRules = {};
let partyRulesSettings;

const resultTimerDuration = 5000;

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
  if (deviceId !== hostDeviceId && !byPassHost) return;
  currentPartyData = partyData;

  if (partyData == null) {
    const existingData = await getExistingPartyData(partyCode);
    if (!existingData || existingData.length === 0) {
      console.warn('No party data found.');
      return;
    }
    currentPartyData = existingData[0];
  }

  const players = currentPartyData.players || [];
  const meIndex = players.findIndex(p => getPlayerId(p) === deviceId);

  if (meIndex === -1) {
    console.warn('Device ID not found in players.');
    return;
  }

  // Normalise config/state/deck
  let config = normalizeConfig(currentPartyData);
  let state = normalizeState(currentPartyData);
  const deck = normalizeDeck(currentPartyData);

  // Update this player's connection
  const me = players[meIndex];
  const meConn = ensureConnection(me);
  meConn.lastPing = new Date();
  if (!meConn.socketId) {
    meConn.socketId = socket.id;
  }

  // Update all players' ready
  if (updateUsersReady !== null) {
    players.forEach(player => {
      const pState = getPlayerState(player);
      pState.isReady = updateUsersReady;
      player.isReady = updateUsersReady; // legacy mirror
    });
  }

  // Update all players' confirmation
  if (updateUsersConfirmation !== null) {
    players.forEach(player => {
      const pState = getPlayerState(player);
      pState.hasConfirmed = updateUsersConfirmation;
      player.hasConfirmed = updateUsersConfirmation; // legacy mirror
    });
  }

  // Update all players' vote
  if (updateUsersVote !== null) {
    players.forEach(player => {
      const pState = getPlayerState(player);
      pState.vote = updateUsersVote;
      player.vote = updateUsersVote; // legacy mirror
    });
  }

  // Timer lives in state
  if (timer !== null) {
    state.timer = timer;
    currentPartyData.timer = timer; // legacy mirror
    if (timeout?.cancel) {
      timeout.cancel();
    }
  }

  // Use existing userInstructions if instruction param is null
  const existingInstruction =
    config.userInstructions ??
    state.userInstructions ??
    currentPartyData.userInstructions ??
    null;

  if (instruction == null) {
    instruction = existingInstruction;
  }

  console.log("🧪 Instruction Received:", instruction);

  // Update game-level state
  state.isPlaying = isPlaying;
  state.lastPinged = new Date();

  // ✅ keep the in-memory object in sync too
  currentPartyData.config = config;
  currentPartyData.state = state;
  if (instruction != null) {
    config.userInstructions = instruction;
  }
  console.log("🧪 Instruction Sent:", instruction);
  await updateOnlineParty({
    partyId: partyCode,
    config,
    state,
    deck,
    players
  });

  if (fetchInstruction) {
    FetchInstructions();
  }
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
  const latestPartyData = await GetCurrentPartyData();
  if (latestPartyData) {
    currentPartyData = latestPartyData;
  }

  const players = currentPartyData?.players || [];
  const index = players.findIndex(player => getPlayerId(player) === selectedDeviceId);

  if (index === -1) {
    console.warn('Player not found for device ID:', selectedDeviceId);
    return;
  }

  const player = players[index];
  const pState = getPlayerState(player);
  const conn = ensureConnection(player);

  pState.isReady = true;
  pState.hasConfirmed = option;
  player.isReady = true;
  player.hasConfirmed = option; // legacy mirror
  conn.lastPing = new Date();
  player.lastPing = conn.lastPing;

  if (userInstruction != null) {
    await SendInstruction({
      instruction: `${userInstruction}:${reason}`,
      partyData: currentPartyData,
      byPassHost: true
    });
  } else {
    await SendInstruction({
      partyData: currentPartyData,
      byPassHost: true
    });
  }
}

async function setUserBool(selectedDeviceId, userConfirmation = null, userReady = null, setInstruction = null) {
  const players = currentPartyData.players || [];
  const player = players.find(p => getPlayerId(p) === selectedDeviceId);

  if (!player) {
    console.warn('Player not found for device ID:', selectedDeviceId);
    return;
  }

  const pState = getPlayerState(player);

  if (userConfirmation !== null) {
    pState.hasConfirmed = userConfirmation;
    player.hasConfirmed = userConfirmation; // legacy
  }

  if (userReady !== null) {
    pState.isReady = userReady;
    player.isReady = userReady; // legacy
  }

  const instructionString =
    currentPartyData.state?.userInstructions ??
    currentPartyData.userInstructions ??
    "";

  if (instructionString.includes(setInstruction) || setInstruction === null) {
    const config = normalizeConfig(currentPartyData);
    const state = normalizeState(currentPartyData);
    const deck = normalizeDeck(currentPartyData);

    state.lastPinged = new Date();

    await updateOnlineParty({
      partyId: partyCode,
      config,
      state,
      deck,
      players
    });
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
  playerIndex = null
}) {
  if (deviceId !== currentPartyData.state.hostComputerId) return;

  const players = currentPartyData.players || [];
  const config = normalizeConfig(currentPartyData);
  const state = normalizeState(currentPartyData);
  const deck = normalizeDeck(currentPartyData);

  const playerCount = players.length;

  // Move to next card
  deck.currentCardIndex = (deck.currentCardIndex ?? currentPartyData.currentCardIndex ?? 0) + 1;
  currentPartyData.currentCardIndex = deck.currentCardIndex; // legacy mirror
  // Add score for current or specific player
  if (state.playerTurn !== undefined && state.playerTurn !== null) {
    const idx = state.playerTurn;
    const p = players[idx];
    if (p) {
      const pState = getPlayerState(p);
      pState.score = (pState.score ?? p.score ?? 0) + incrementScore;
      p.score = pState.score; // legacy mirror
    }
  } else if (playerIndex !== null) {
    const p = players[playerIndex];
    if (p) {
      const pState = getPlayerState(p);
      pState.score = (pState.score ?? p.score ?? 0) + incrementScore;
      p.score = pState.score; // legacy mirror
    }
  }

  // Reset each player's status and icon
  for (let i = 0; i < playerCount; i++) {
    const p = players[i];
    const pState = getPlayerState(p);
    pState.isReady = false;
    pState.hasConfirmed = false;
    pState.vote = null;
    p.isReady = false;
    p.hasConfirmed = false;
    p.vote = null; // legacy
    if (icons !== null && icons[i]) {
      icons[i].classList.remove('yes');
      icons[i].classList.remove('no');
    }
  }

  if (timer !== null) {
    state.timer = timer;
    currentPartyData.timer = timer; // legacy
  }

  config.userInstructions = instruction;
  state.lastPinged = new Date();
  await updateOnlineParty({
    partyId: partyCode,
    config,
    state,
    deck,
    players
  });
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
  const response = await fetch(`/api/${sessionPartyType}?partyCode=${partyCode}`);
  const data = await response.json();
  if (!data || data.length === 0) return;

  const party = data[0];
  const players = party.players || [];
  const index = players.findIndex(player => getPlayerId(player) === deviceId);
  if (index === -1) return;

  const player = players[index];
  const pState = getPlayerState(player);

  pState.vote = option;
  pState.isReady = true;
  player.vote = option; // legacy
  player.isReady = true;

  if (hover === false) {
    pState.hasConfirmed = true;
    player.hasConfirmed = true;
  }

  const config = normalizeConfig(party);
  const state = normalizeState(party);
  const deck = normalizeDeck(party);

  state.lastPinged = new Date();

  if (sendInstruction != null) {
    await SendInstruction({
      instruction: sendInstruction,
      partyData: {
        ...party,
        config,
        state,
        deck,
        players
      },
      byPassHost: true
    });
  } else {
    await updateOnlineParty({
      partyId: partyCode,
      config,
      state,
      deck,
      players
    });
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
  const response = await fetch(`/api/${sessionPartyType}?partyCode=${partyCode}`);
  const data = await response.json();
  if (!data || data.length === 0) return;

  const party = data[0];
  const players = party.players || [];
  const index = players.findIndex(player => getPlayerId(player) === deviceId);
  if (index === -1) return;

  const player = players[index];
  const pState = getPlayerState(player);

  pState.vote = bool;
  pState.hasConfirmed = true;

  player.vote = bool; // legacy
  player.hasConfirmed = true;

  const config = normalizeConfig(party);
  const state = normalizeState(party);
  const deck = normalizeDeck(party);

  state.lastPinged = new Date();

  await updateOnlineParty({
    partyId: partyCode,
    config,
    state,
    deck,
    players
  });
}

function SetWaitingForPlayer({ waitingForRoomTitle, waitingForRoomText, player }) {
  const id = getPlayerId(player);
  const icon = getPlayerIcon(player);

  waitingForPlayerTitle.textContent = waitingForRoomTitle;
  waitingForPlayerText.textContent = waitingForRoomText;
  EditUserIconPartyGames({
    container: waitingForPlayerContainer,
    userId: id,
    userCustomisationString: icon
  });
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
    console.log("Pack not found");
    if (showNsfwBadge) {
      setOnlineNsfwCardBadge(card, false);
    }
  }
  cardType.textContent = questionObject.cardType;
}

async function ChoosingPunishment(index = null) {
  timeout?.cancel();
  stopTimer(waitingForPlayerContainer.querySelector('.timer-wrapper'));

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
  stopTimer(waitingForPlayerContainer.querySelector('.timer-wrapper'));

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
  console.log(parsedInstructions.reason);
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
  return player.state;
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
  return player?.identity?.computerId ?? null;
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

function getTimeLimit() {
  if (!gameRules) return 120;
  const raw = gameRules["time-limit"];

  if (raw === undefined || raw === null || raw === "") {
    return 120;
  }

  const n = Number(raw);
  if (Number.isNaN(n)) return 120;
  return n;
}
