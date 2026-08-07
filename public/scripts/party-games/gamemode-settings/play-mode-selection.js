(function () {
  const selectionCloseDelay = 220;
  const boundContainers = new WeakSet();
  let activePartySession = null;
  let activePartyActionHandler = null;
  let resumeOfflineMode = false;

  try {
    window.localStorage?.removeItem('online');
  } catch {
    // Storage can be unavailable in restricted browser contexts.
  }

  try {
    const currentUrl = new URL(window.location.href);
    const requestedPlayMode = currentUrl.searchParams.get('playMode');
    if (requestedPlayMode === 'offline') {
      currentUrl.searchParams.delete('playMode');
      window.history.replaceState(
        window.history.state,
        '',
        `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`
      );
      resumeOfflineMode =
        typeof partyGameMode === 'string' &&
        (typeof partyGamesInformation === 'undefined' ||
          partyGamesInformation?.[partyGameMode]?.forceOnline !== true);
      if (resumeOfflineMode) {
        window.syncOfflinePartyGameSwitcherButton?.(partyGameMode);
      }
    }
  } catch {
    // Ignore malformed or unavailable navigation state and show mode selection.
  }

  function wait(milliseconds) {
    return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
  }

  function getOnlineButton(container) {
    return container?.querySelector('.mode-selection-button--online') || null;
  }

  function getOnlineAction() {
    return activePartySession ? 'active-party' : 'create-party';
  }

  function getSessionPartyCode(session) {
    return String(session?.partyCode || session?.code || '')
      .trim()
      .toUpperCase();
  }

  function getSessionGamemodeName(session) {
    const explicitName = String(session?.modeName || '').trim();
    if (explicitName) return explicitName;

    return String(session?.gamemode || session?.key || '')
      .trim()
      .replace(/[-_]+/g, ' ')
      .replace(/\b\w/g, (character) => character.toUpperCase());
  }

  function syncOnlineHelpState(option, hasActiveParty, session) {
    const title = option.querySelector('.mode-selection-help-title');
    const description = option.querySelector(
      '.mode-selection-help-description'
    );
    const details = option.querySelector('.mode-selection-party-details');
    const helpButton = option.querySelector('.mode-selection-help-button');
    const backButton = option.querySelector('.mode-selection-help-back');
    const partyCode = getSessionPartyCode(session);
    const gamemodeName = getSessionGamemodeName(session);
    const role =
      session?.isHost === true
        ? 'Host'
        : session?.isHost === false
          ? 'Participant'
          : 'Player';

    if (title) title.textContent = hasActiveParty ? 'Party Active' : 'Online';
    if (description) description.hidden = hasActiveParty;
    if (details) details.hidden = !hasActiveParty;
    if (helpButton) {
      helpButton.setAttribute(
        'aria-label',
        hasActiveParty
          ? 'Active party details'
          : 'Help with Online mode'
      );
    }
    if (backButton) {
      backButton.setAttribute(
        'aria-label',
        hasActiveParty ? 'Back to active party' : 'Back to Online'
      );
    }

    const fieldValues = {
      gamemode: gamemodeName || 'Party game',
      code: partyCode || 'Unavailable',
      status: String(session?.statusText || 'Active'),
      role
    };
    Object.entries(fieldValues).forEach(([field, value]) => {
      const fieldElement = details?.querySelector(
        `[data-party-field="${field}"]`
      );
      if (fieldElement) fieldElement.textContent = value;
    });
  }

  function syncOnlineCardState(onlineButton) {
    const option = onlineButton.closest('.mode-selection-option--online');
    if (!option) return;

    const hasActiveParty = Boolean(activePartySession);
    const partyCode = getSessionPartyCode(activePartySession);
    const gamemodeName = getSessionGamemodeName(activePartySession);
    const primaryColour = String(
      activePartySession?.primaryColour || ''
    ).trim();
    const secondaryColour = String(
      activePartySession?.secondaryColour || ''
    ).trim();

    option.classList.toggle('has-active-party', hasActiveParty);
    syncOnlineHelpState(option, hasActiveParty, activePartySession);
    option.style.removeProperty('--primarypagecolour');
    option.style.removeProperty('--secondarypagecolour');
    onlineButton.style.removeProperty('--primarypagecolour');
    onlineButton.style.removeProperty('--secondarypagecolour');
    if (hasActiveParty) {
      if (primaryColour) {
        option.style.setProperty('--primarypagecolour', primaryColour);
      }
      if (secondaryColour) {
        option.style.setProperty(
          '--secondarypagecolour',
          secondaryColour
        );
      }
      onlineButton.setAttribute(
        'aria-label',
        [
          'Manage active party',
          gamemodeName,
          partyCode,
          activePartySession?.statusText
        ]
          .filter(Boolean)
          .join('. ')
      );
      return;
    }

    onlineButton.setAttribute(
      'aria-label',
      onlineButton.dataset.defaultAriaLabel || 'Play online'
    );
  }

  function syncOnlineAction(container) {
    const onlineButton = getOnlineButton(container);
    if (!onlineButton) return;

    const action = getOnlineAction();
    const partyCode = getSessionPartyCode(activePartySession);
    syncOnlineCardState(onlineButton);
    onlineButton.dataset.modeAction = action;
    if (partyCode) {
      onlineButton.dataset.activePartyCode = partyCode;
    } else {
      delete onlineButton.dataset.activePartyCode;
    }

    window.dispatchEvent(
      new CustomEvent('oe-mode-selection-online-action-changed', {
        detail: {
          action,
          session: activePartySession,
          button: onlineButton
        }
      })
    );
  }

  function setActivePartySession(session) {
    activePartySession = session || null;
    document
      .querySelectorAll('.mode-selection-container')
      .forEach(syncOnlineAction);
  }

  async function openActivePartyManager(container) {
    if (typeof window.refreshActivePartyLobbyLock === 'function') {
      await window.refreshActivePartyLobbyLock();
    }

    const session = activePartySession;
    if (!session) return false;

    if (typeof window.ActivePartyConflictDialog?.open !== 'function') {
      throw new Error('Active party management is not ready yet.');
    }

    const isParticipant = session.isHost === false;
    window.ActivePartyConflictDialog.open({
      partyCode: getSessionPartyCode(session),
      gamemode: session.gamemode || session.key,
      returnPath: session.returnPath || session.lobbyPath,
      statusText: session.statusText,
      source: 'party-management',
      conflictType: isParticipant ? 'participant' : 'owner',
      opener: getOnlineButton(container),
      onLeave:
        isParticipant &&
        typeof window.leaveActivePartyLobby === 'function'
          ? () => window.leaveActivePartyLobby(session)
          : null,
      onEnd:
        !isParticipant &&
        typeof window.endActiveOwnedParty === 'function'
          ? () => window.endActiveOwnedParty(session)
          : null
    });
    return false;
  }

  async function runOnlineAction(container, { onProgressComplete } = {}) {
    const onlineButton = getOnlineButton(container);
    const action = onlineButton?.dataset.modeAction || getOnlineAction();

    if (action === 'active-party') {
      if (activePartyActionHandler) {
        return activePartyActionHandler(activePartySession, {
          container,
          button: onlineButton
        });
      }
      return openActivePartyManager(container);
    }

    if (typeof ToggleOnlineMode !== 'function') {
      throw new Error('Online mode is not ready yet.');
    }
    return ToggleOnlineMode(true, {
      onProgress({ value, label } = {}) {
        window.ModeSelectionView.setProgress(container, value, label);
      },
      onProgressComplete
    });
  }

  async function handleModeRequest(container, mode) {
    if (container.dataset.selectionPending === 'true') return;

    const onlineButton = getOnlineButton(container);
    const isOnlineCreation =
      mode === 'online' &&
      (onlineButton?.dataset.modeAction || getOnlineAction()) ===
        'create-party';

    window.ModeSelectionView.setSelected(container, mode);
    window.ModeSelectionView.setBusy(container, true);
    if (isOnlineCreation) {
      window.ModeSelectionView.setProgress(
        container,
        5,
        'Starting online lobby'
      );
    }

    if (mode === 'offline') {
      if (typeof partyGameMode === 'string') {
        window.syncOfflinePartyGameSwitcherButton?.(partyGameMode);
      }
      await wait(selectionCloseDelay);
      window.ModeSelectionView.close(container);
      return;
    }

    if (mode !== 'online') {
      window.ModeSelectionView.reset(container);
      return;
    }

    try {
      let progressCompletionHandled = false;
      const onlineEnabled = await runOnlineAction(container, {
        onProgressComplete: isOnlineCreation
          ? async () => {
              progressCompletionHandled = true;
              await window.ModeSelectionView.waitForProgressCompletion(
                container,
                { holdMilliseconds: 0 }
              );
            }
          : null
      });
      if (onlineEnabled === false) {
        window.ModeSelectionView.reset(container);
        return;
      }

      if (isOnlineCreation && !progressCompletionHandled) {
        window.ModeSelectionView.setProgress(container, 100, 'Lobby ready');
        await window.ModeSelectionView.waitForProgressCompletion(container);
      }
      await wait(selectionCloseDelay);
      window.ModeSelectionView.close(container);
    } catch (error) {
      window.ModeSelectionView.reset(container);
      console.error('Failed to start online mode:', error);
    }
  }

  async function completeOnlineSelection() {
    const container = document.querySelector(
      '.mode-selection-container.is-visible'
    );
    if (!container || container.dataset.selectionPending === 'true') return;

    window.ModeSelectionView.setSelected(container, 'online');
    window.ModeSelectionView.setBusy(container, true);
    await wait(selectionCloseDelay);
    window.ModeSelectionView.close(container);
  }

  function bind(container) {
    if (!container || boundContainers.has(container)) return;
    boundContainers.add(container);
    syncOnlineAction(container);

    container.addEventListener('oe-play-mode-request', (event) => {
      handleModeRequest(container, event.detail?.mode);
    });
  }

  window.addEventListener('oe-active-party-lobby-state-changed', (event) => {
    setActivePartySession(event.detail?.session || null);
  });

  window.PartyPlayModeController = {
    bind,
    completeOnlineSelection,
    getOnlineAction,
    shouldSkipInitialSelection() {
      return resumeOfflineMode;
    },
    setActivePartyActionHandler(handler) {
      activePartyActionHandler =
        typeof handler === 'function' ? handler : null;
    },
    setActivePartySession
  };
})();
