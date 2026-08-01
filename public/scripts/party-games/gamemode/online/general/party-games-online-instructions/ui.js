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
  const cardType = card.querySelector('.card-type-text');
  const showNsfwBadge = nsfwBadgeEnabledGamemodes.has(gamemode);

  cardText.textContent = questionObject.question;
  const matchedPack = applyOnlinePackTheme(questionObject.cardType);
  if (matchedPack) {
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
