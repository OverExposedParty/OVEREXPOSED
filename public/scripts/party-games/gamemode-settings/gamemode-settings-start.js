const GAMEMODE_START_COUNTDOWN_SECONDS = 5;
const GAMEMODE_START_COUNTDOWN_LANE = 'gamemode-settings-countdown';
const GAMEMODE_START_COUNTDOWN_SOUNDS = Object.freeze({
  5: 'gamemodeSettingsCountdownFive',
  4: 'gamemodeSettingsCountdownFour',
  3: 'gamemodeSettingsCountdownThree',
  2: 'gamemodeSettingsCountdownTwo',
  1: 'gamemodeSettingsCountdownOne'
});
let activeGamemodeStartCountdown = null;
let gamemodeStartCountdownGeneration = 0;

if (typeof window.OEAudio?.register === 'function') {
  window.OEAudio.register({
    gamemodeSettingsCountdownFive: {
      src: '/sounds/gamemode-settings/countdown/five.wav',
      group: 'party-games',
      preload: true,
      maxInstances: 1,
      lane: GAMEMODE_START_COUNTDOWN_LANE,
      priority: 'phase',
      conflictPolicy: 'interrupt'
    },
    gamemodeSettingsCountdownFour: {
      src: '/sounds/gamemode-settings/countdown/four.wav',
      group: 'party-games',
      preload: true,
      maxInstances: 1,
      lane: GAMEMODE_START_COUNTDOWN_LANE,
      priority: 'phase',
      conflictPolicy: 'interrupt'
    },
    gamemodeSettingsCountdownThree: {
      src: '/sounds/gamemode-settings/countdown/three.wav',
      group: 'party-games',
      preload: true,
      maxInstances: 1,
      lane: GAMEMODE_START_COUNTDOWN_LANE,
      priority: 'phase',
      conflictPolicy: 'interrupt'
    },
    gamemodeSettingsCountdownTwo: {
      src: '/sounds/gamemode-settings/countdown/two.wav',
      group: 'party-games',
      preload: true,
      maxInstances: 1,
      lane: GAMEMODE_START_COUNTDOWN_LANE,
      priority: 'phase',
      conflictPolicy: 'interrupt'
    },
    gamemodeSettingsCountdownOne: {
      src: '/sounds/gamemode-settings/countdown/one.wav',
      group: 'party-games',
      preload: true,
      maxInstances: 1,
      lane: GAMEMODE_START_COUNTDOWN_LANE,
      priority: 'phase',
      conflictPolicy: 'interrupt'
    },
    gamemodeSettingsStartBlocked: {
      src: '/sounds/gamemode-settings/start-blocked.wav',
      group: 'party-games',
      preload: true,
      maxInstances: 1,
      lane: GAMEMODE_START_COUNTDOWN_LANE,
      priority: 'confirmation',
      conflictPolicy: 'interrupt'
    }
  });
}

function stopGamemodeStartCountdownAudio() {
  if (typeof window.OEAudio?.stopLane === 'function') {
    window.OEAudio.stopLane(GAMEMODE_START_COUNTDOWN_LANE);
  }
}

function playGamemodeSettingsStartBlockedSound() {
  if (typeof playSoundEffect === 'function') {
    playSoundEffect('gamemodeSettingsStartBlocked');
  }
}

function getGamemodeStartHostAvatar() {
  const party =
    typeof currentPartyData === 'undefined' ? null : currentPartyData;
  const players = Array.isArray(party?.players) ? party.players : [];
  const hostComputerId = String(
    party?.state?.hostComputerId ||
      (typeof hostDeviceId === 'undefined' ? '' : hostDeviceId) ||
      players[0]?.identity?.computerId ||
      players[0]?.computerId ||
      ''
  );
  const host =
    players.find(
      (player) =>
        String(player?.identity?.computerId || player?.computerId || '') ===
        hostComputerId
    ) ||
    players[0] ||
    null;
  const fallbackIcon =
    typeof getStoredUserIconString === 'function'
      ? getStoredUserIconString()
      : window.USER_ICON_DEFAULT_STRING || '0000:0100:0200:0300';

  return {
    userId:
      host?.identity?.computerId ||
      host?.computerId ||
      hostComputerId ||
      'party-host',
    userCustomisationString:
      host?.identity?.userIcon ||
      host?.userIcon ||
      host?.oeIcon ||
      fallbackIcon,
    label: `${host?.identity?.username || host?.username || 'Host'}'s OE`
  };
}

function showGamemodeStartBlockedNotification() {
  const blockers =
    typeof window.getStartGameBlockers === 'function'
      ? window.getStartGameBlockers(allUsersReady)
      : [];
  const messages = blockers.length
    ? blockers.map((blocker) => blocker.message)
    : ['The current party settings do not allow the game to start'];

  window.showOeStatusPopup?.({
    key: 'game-start-blocked',
    label: 'Start blocked',
    title: "Can't start yet",
    messages,
    tone: 'attention',
    duration: 6500,
    sound: false,
    avatar: getGamemodeStartHostAvatar()
  });
}

function showGamemodeStartFailureNotification(error) {
  window.showOeStatusPopup?.({
    key: 'game-start-blocked',
    label: 'Start failed',
    title: "The game couldn't start",
    messages: [
      String(error?.message || 'Please check the party and try again.')
    ],
    tone: 'error',
    duration: 6500,
    sound: false,
    avatar: getGamemodeStartHostAvatar()
  });
}

function restoreGamemodeStartCountdownButton(countdown) {
  if (!countdown?.button) return;

  countdown.button.textContent = countdown.originalText;
  countdown.button.classList.remove('countdown-active');
  if (countdown.originalAriaLabel === null) {
    countdown.button.removeAttribute('aria-label');
  } else {
    countdown.button.setAttribute('aria-label', countdown.originalAriaLabel);
  }
  if (countdown.originalAriaLive === null) {
    countdown.button.removeAttribute('aria-live');
  } else {
    countdown.button.setAttribute('aria-live', countdown.originalAriaLive);
  }
}

function cancelGamemodeStartCountdown() {
  const countdown = activeGamemodeStartCountdown;
  if (!countdown) return false;

  gamemodeStartCountdownGeneration += 1;
  if (countdown.timerId !== null) {
    window.clearTimeout(countdown.timerId);
  }
  activeGamemodeStartCountdown = null;
  stopGamemodeStartCountdownAudio();
  restoreGamemodeStartCountdownButton(countdown);
  playGamemodeSettingsStartBlockedSound();
  return true;
}

function canContinueGamemodeStartCountdown() {
  if (!partyCode || startGameButton.classList.contains('disabled')) {
    return false;
  }
  if (typeof window.getStartGameBlockers === 'function') {
    return window.getStartGameBlockers(allUsersReady).length === 0;
  }
  return allUsersReady === true && onlinePlayerCountRestrictionsMet === true;
}

function renderGamemodeStartCountdownTick(countdown) {
  countdown.button.textContent = `STARTING IN ${countdown.remaining}`;
  countdown.button.setAttribute(
    'aria-label',
    `Starting game in ${countdown.remaining} second${
      countdown.remaining === 1 ? '' : 's'
    }. Click to cancel.`
  );

  const soundKey = GAMEMODE_START_COUNTDOWN_SOUNDS[countdown.remaining];
  if (soundKey && typeof playSoundEffect === 'function') {
    playSoundEffect(soundKey);
  }
}

async function completeGamemodeStartCountdown(countdown, generation) {
  if (
    activeGamemodeStartCountdown !== countdown ||
    generation !== gamemodeStartCountdownGeneration
  ) {
    return;
  }
  if (!canContinueGamemodeStartCountdown()) {
    cancelGamemodeStartCountdown();
    return;
  }

  activeGamemodeStartCountdown = null;
  restoreGamemodeStartCountdownButton(countdown);
  await startOnlineGame();
}

function advanceGamemodeStartCountdown(countdown, generation) {
  if (
    activeGamemodeStartCountdown !== countdown ||
    generation !== gamemodeStartCountdownGeneration
  ) {
    return;
  }
  if (!canContinueGamemodeStartCountdown()) {
    cancelGamemodeStartCountdown();
    return;
  }

  countdown.remaining -= 1;
  if (countdown.remaining <= 0) {
    countdown.timerId = null;
    completeGamemodeStartCountdown(countdown, generation);
    return;
  }

  renderGamemodeStartCountdownTick(countdown);
  countdown.timerId = window.setTimeout(
    () => advanceGamemodeStartCountdown(countdown, generation),
    1000
  );
}

function startGamemodeStartCountdown(button, { fromWarning = false } = {}) {
  if (activeGamemodeStartCountdown) {
    if (activeGamemodeStartCountdown.button === button) {
      cancelGamemodeStartCountdown();
    }
    return false;
  }
  if (!button || !canContinueGamemodeStartCountdown()) {
    return false;
  }

  window.dismissOeStatusPopup?.('game-start-blocked');
  gamemodeStartCountdownGeneration += 1;
  const generation = gamemodeStartCountdownGeneration;
  const countdown = {
    button,
    fromWarning,
    remaining: GAMEMODE_START_COUNTDOWN_SECONDS,
    timerId: null,
    originalText: button.textContent,
    originalAriaLabel: button.getAttribute('aria-label'),
    originalAriaLive: button.getAttribute('aria-live')
  };
  activeGamemodeStartCountdown = countdown;
  button.classList.add('countdown-active');
  button.setAttribute('aria-live', 'assertive');
  renderGamemodeStartCountdownTick(countdown);
  countdown.timerId = window.setTimeout(
    () => advanceGamemodeStartCountdown(countdown, generation),
    1000
  );
  return true;
}

function cancelGamemodeStartCountdownIfIneligible() {
  if (
    activeGamemodeStartCountdown &&
    !canContinueGamemodeStartCountdown()
  ) {
    cancelGamemodeStartCountdown();
  }
}

window.startGamemodeStartCountdown = startGamemodeStartCountdown;
window.cancelGamemodeStartCountdown = cancelGamemodeStartCountdown;
window.cancelGamemodeStartCountdownIfIneligible =
  cancelGamemodeStartCountdownIfIneligible;
window.isGamemodeStartCountdownActive = () =>
  Boolean(activeGamemodeStartCountdown);

function trackGamemodeStarted() {
  const gameMode =
    typeof partyGameMode === 'string'
      ? partyGameMode
      : typeof gamemode === 'string'
        ? gamemode
        : '';
  window.OEAnalytics?.track(
    'game.started',
    {
      selectedPacks: Array.isArray(gamemodeSelectedPacks)
        ? [...gamemodeSelectedPacks]
        : [],
      availablePacks: Array.isArray(packButtons)
        ? packButtons.map((button) => button.dataset.key).filter(Boolean)
        : [],
      selectedRules:
        gamemodeSettings && typeof gamemodeSettings === 'object'
          ? { ...gamemodeSettings }
          : {}
    },
    {
      gameMode,
      playMode: partyCode ? 'online' : 'offline'
    }
  );
  window.OEAnalytics?.flush({ keepalive: true });
}

function bindGamemodeSettingsActions() {
  if (copyPartyCodeButton) {
    copyPartyCodeButton.dataset.sound = 'none';
    copyPartyCodeButton.addEventListener('click', async () => {
      flashButtonHoverState(copyPartyCodeButton, {
        duration: 0,
        fadeDuration: 200,
        className: 'copy-feedback-active',
        transitionClassName: 'copy-feedback-fade'
      });

      const codeToCopy = (inputPartyCode?.value || '').trim();
      if (!codeToCopy) return;
      const fullPartyUrl = `${window.location.origin}/${codeToCopy}`;

      try {
        const copied = await copyTextToClipboard(fullPartyUrl);
        if (!copied) {
          throw new Error('Clipboard copy command was not successful.');
        }
        if (typeof window.setTooltipSelectedState === 'function') {
          window.setTooltipSelectedState(copyPartyCodeButton);
        }
        playSoundEffect('socialCopyLink');
      } catch (err) {
        console.error('Failed to copy party URL:', err);
        playInteractionSound('error');
      }
    });
  }

  if (qrCodeButton) {
    qrCodeButton.addEventListener('click', async () => {
      if (!partyCode || typeof togglePartyQrCode !== 'function') return;
      const willShow = !qrCodeButton.classList.contains('active');
      togglePartyQrCode(willShow, partyCode);
    });
  }

  startGameButton.dataset.sound = 'none';
  startGameButton.addEventListener('click', () => {
    if (
      activeGamemodeStartCountdown?.button === startGameButton
    ) {
      cancelGamemodeStartCountdown();
      return;
    }
    if (startGameButton.classList.contains('disabled')) {
      if (partyCode) {
        playGamemodeSettingsStartBlockedSound();
        showGamemodeStartBlockedNotification();
      }
      return;
    }

    const nsfwPacksActive = Array.from(nsfwButtons).some(
      (button) =>
        button.classList.contains('active') && button.classList.contains('nsfw')
    );
    const nsfwgameRulesActive = Array.from(gameRulesNsfwButtons).some(
      (button) =>
        button.classList.contains('active') && button.classList.contains('nsfw')
    );

    if (nsfwPacksActive || nsfwgameRulesActive) {
      addElementIfNotExists(elementClassArray, warningBox);
      showContainer(warningBox);
      toggleOverlay(true);
    } else {
      if (partyCode) {
        startGamemodeStartCountdown(startGameButton);
      } else {
        playInteractionSound('confirm');
        trackGamemodeStarted();
        transitionSplashScreen(
          removeSettingsExtensionFromCurrentURL(),
          `/images/splash-screens/${startGameButton.id}.png`
        );
      }
    }
  });

  warningStartButton.dataset.sound = 'none';
  warningStartButton.addEventListener('click', () => {
    if (
      activeGamemodeStartCountdown?.button === warningStartButton
    ) {
      cancelGamemodeStartCountdown();
      return;
    }
    if (startGameButton.classList.contains('disabled')) {
      if (partyCode) {
        playGamemodeSettingsStartBlockedSound();
        showGamemodeStartBlockedNotification();
      }
      return;
    }

    if (partyCode) {
      startGamemodeStartCountdown(warningStartButton, {
        fromWarning: true
      });
    } else {
      playInteractionSound('confirm');
      trackGamemodeStarted();
      transitionSplashScreen(
        removeSettingsExtensionFromCurrentURL(),
        `/images/splash-screens/${startGameButton.id}.png`
      );
    }
  });

  const countdownOverlay = document.getElementById('overlay');
  if (
    countdownOverlay &&
    countdownOverlay.dataset.gamemodeCountdownBound !== 'true'
  ) {
    countdownOverlay.dataset.gamemodeCountdownBound = 'true';
    countdownOverlay.addEventListener('click', () => {
      if (activeGamemodeStartCountdown?.fromWarning) {
        cancelGamemodeStartCountdown();
      }
    });
  }
}

function removeSettingsExtensionFromCurrentURL() {
  const currentURL = new URL(window.location.href);
  const normalizedPath = currentURL.pathname.replace(/\/$/, '');
  if (normalizedPath.endsWith('/settings')) {
    currentURL.pathname = normalizedPath.slice(0, -'/settings'.length) || '/';
    currentURL.search = '';
    currentURL.hash = '';
    return currentURL.toString().replace(/\/$/, '');
  }
  return currentURL.toString();
}

function closeStartWarningIfOpen() {
  if (!warningBox || !isContainerVisible(warningBox)) {
    return;
  }

  removeElementIfExists(elementClassArray, warningBox);
  hideContainer(warningBox);
}

async function startOnlineGame({ bypassPlayerRestrictions = false } = {}) {
  if (partyCode && !bypassPlayerRestrictions) {
    const playerCountIsValid = await refreshOnlinePlayerCountRestrictions();
    if (!playerCountIsValid) {
      closeStartWarningIfOpen();
      updateStartGameButton(allUsersReady);
      showGamemodeStartBlockedNotification();
      return;
    }
  }

  try {
    loadingPage = true;
    await startOnlinePartyGame(partyCode, { bypassPlayerRestrictions });
    trackGamemodeStarted();
    playInteractionSound('confirm');
    transitionSplashScreen(
      removeSettingsExtensionFromCurrentURL() + '/' + partyCode,
      `/images/splash-screens/${startGameButton.id}.png`
    );
  } catch (error) {
    loadingPage = false;
    console.error('Failed to start online game:', error);
    playInteractionSound('error');
    await refreshOnlinePlayerCountRestrictions();
    closeStartWarningIfOpen();
    updateStartGameButton(allUsersReady);
    showGamemodeStartFailureNotification(error);
  }
}
