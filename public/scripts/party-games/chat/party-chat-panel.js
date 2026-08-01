(function () {
  const CHAT_MESSAGE_RECEIVED_SOUND = 'socialChatMessageReceived';
  let partyChatPanel = null;
  let hasInitialChatLogLoaded = false;
  let activePartyCode = null;
  let chatSideButton = null;
  let chatSideButtonBadge = null;
  let chatSideButtonUnreadCount = 0;
  let partyChatAvailable = null;
  let chatLogBaselinePartyCode = null;

  function getCurrentPartyCode() {
    if (window.partyCode) return window.partyCode;
    if (typeof partyCode !== 'undefined') return partyCode;
    return null;
  }

  function isTouchLikeDevice() {
    return Boolean(
      window.matchMedia?.('(hover: none), (pointer: coarse)')?.matches
    );
  }

  function clearMessages() {
    partyChatPanel?.clearMessages();
    hasInitialChatLogLoaded = false;
    chatLogBaselinePartyCode = null;
    clearChatSideButtonUnreadCount();
  }

  function isChatPanelReadable() {
    return Boolean(
      partyChatPanel &&
        !partyChatPanel.container.hidden &&
        partyChatPanel.container.classList.contains('expanded')
    );
  }

  function isChatPanelOpen() {
    return Boolean(
      partyChatPanel &&
        (!partyChatPanel.container.hidden ||
          partyChatPanel.container.classList.contains('open') ||
          partyChatPanel.container.classList.contains('expanded'))
    );
  }

  function getCurrentOnlineUsername() {
    if (window.onlineUsername) return String(window.onlineUsername);
    if (typeof onlineUsername !== 'undefined') return String(onlineUsername);
    return '';
  }

  function shouldPlayChatMessageReceivedSound(chat, messageWasAdded, isLive) {
    if (!messageWasAdded || !isLive || isChatPanelOpen()) return false;
    if (chat?.eventType !== 'message') return false;

    const senderUsername = String(chat?.username || '').trim().toLowerCase();
    const currentUsername = getCurrentOnlineUsername().trim().toLowerCase();
    return Boolean(senderUsername && senderUsername !== currentUsername);
  }

  function playChatMessageReceivedSound() {
    if (typeof window.playSoundEffect === 'function') {
      window.playSoundEffect(CHAT_MESSAGE_RECEIVED_SOUND);
    }
  }

  function canUseSharedOverlay() {
    return (
      typeof addElementIfNotExists === 'function' &&
      typeof removeElementIfExists === 'function' &&
      typeof toggleOverlay === 'function' &&
      typeof elementClassArray !== 'undefined' &&
      Array.isArray(elementClassArray)
    );
  }

  function syncChatOverlayState() {
    if (!partyChatPanel || !canUseSharedOverlay()) return;

    if (isChatPanelOpen()) {
      if (typeof showContainer === 'function') {
        showContainer(partyChatPanel.container);
      }
      addElementIfNotExists(elementClassArray, partyChatPanel.container);
      if (
        typeof overlay === 'undefined' ||
        typeof isContainerVisible !== 'function' ||
        !isContainerVisible(overlay)
      ) {
        toggleOverlay(true);
      }
      return;
    }

    if (typeof hideContainer === 'function') {
      hideContainer(partyChatPanel.container);
    }
    removeElementIfExists(elementClassArray, partyChatPanel.container);
  }

  function formatUnreadCount(count) {
    return count > 9 ? '9+' : String(count);
  }

  function updateChatSideButtonBadge() {
    if (!chatSideButtonBadge) return;

    const showBadge = chatSideButtonUnreadCount > 0;
    chatSideButtonBadge.textContent = showBadge
      ? formatUnreadCount(chatSideButtonUnreadCount)
      : '';
    chatSideButtonBadge.hidden = !showBadge;
    chatSideButton?.classList.toggle('has-unread', showBadge);
  }

  function clearChatSideButtonUnreadCount() {
    chatSideButtonUnreadCount = 0;
    updateChatSideButtonBadge();
  }

  function incrementChatSideButtonUnreadCount() {
    if (isChatPanelReadable()) {
      clearChatSideButtonUnreadCount();
      return;
    }

    chatSideButtonUnreadCount += 1;
    updateChatSideButtonBadge();
  }

  function setPartyChatAvailable(isAvailable) {
    if (!partyChatPanel) return;

    const enabled = Boolean(isAvailable);
    const shell = chatSideButton?.closest?.('.side-button-shell');
    const availabilityChanged = partyChatAvailable !== enabled;
    partyChatAvailable = enabled;

    if (!enabled) {
      const panelIsVisible =
        !partyChatPanel.container.hidden ||
        partyChatPanel.container.classList.contains('open') ||
        partyChatPanel.container.classList.contains('expanded');

      if (panelIsVisible) {
        partyChatPanel.close();
        syncChatOverlayState();
      }
      if (availabilityChanged) {
        clearMessages();
      }
    } else if (availabilityChanged) {
      refreshChatLogBaseline().catch((error) => {
        window.reportOEDebug?.(
          'error',
          'party.chat',
          'Party chat baseline refresh failed.',
          { error }
        );
      });
    }

    if (chatSideButton) {
      if (chatSideButton.hidden) {
        chatSideButton.hidden = false;
      }
      if (chatSideButton.disabled !== !enabled) {
        chatSideButton.disabled = !enabled;
      }
      chatSideButton.classList.toggle('disabled', !enabled);
      if (chatSideButton.getAttribute('aria-disabled') !== String(!enabled)) {
        chatSideButton.setAttribute('aria-disabled', String(!enabled));
      }
      const nextTabIndex = enabled ? 0 : -1;
      if (chatSideButton.tabIndex !== nextTabIndex) {
        chatSideButton.tabIndex = nextTabIndex;
      }
      if (chatSideButton.classList.contains('active')) {
        chatSideButton.classList.remove('active');
      }
    }

    if (shell) {
      shell.classList.toggle('party-chat-hidden', !enabled);
      shell.setAttribute('aria-hidden', String(!enabled));
    }
  }

  function syncActiveParty() {
    const currentPartyCode = getCurrentPartyCode();

    if (activePartyCode !== currentPartyCode) {
      clearMessages();
      activePartyCode = currentPartyCode;
    }

    return currentPartyCode;
  }

  function hasChatLogBaseline(currentPartyCode) {
    return (
      hasInitialChatLogLoaded &&
      chatLogBaselinePartyCode &&
      chatLogBaselinePartyCode === currentPartyCode
    );
  }

  function getChatEntries(chatLog) {
    if (Array.isArray(chatLog?.chat)) return chatLog.chat;
    if (Array.isArray(chatLog?.data?.chat)) return chatLog.data.chat;
    if (Array.isArray(chatLog?.generalChat)) return chatLog.generalChat;
    if (Array.isArray(chatLog?.data?.generalChat)) {
      return chatLog.data.generalChat;
    }
    return [];
  }

  async function displayLogs({ markUnread = null } = {}) {
    if (!partyChatPanel) return;
    const currentPartyCode = syncActiveParty();
    if (!currentPartyCode) return;

    const chatLog = await window.PartyChatApi.getChatLog();
    const shouldMarkUnread =
      markUnread ?? hasChatLogBaseline(currentPartyCode);

    getChatEntries(chatLog).forEach((chat) => {
      const messageWasAdded = partyChatPanel.addMessage({
        username: chat.username,
        message: chat.message,
        eventType: chat.eventType,
        timestamp: chat.timestamp,
        markUnread: shouldMarkUnread
      });

      if (messageWasAdded && shouldMarkUnread) {
        incrementChatSideButtonUnreadCount();
      }
      if (
        shouldPlayChatMessageReceivedSound(
          chat,
          messageWasAdded,
          shouldMarkUnread
        )
      ) {
        playChatMessageReceivedSound();
      }
    });

    hasInitialChatLogLoaded = true;
    chatLogBaselinePartyCode = currentPartyCode;
  }

  async function refreshChatLogBaseline() {
    return displayLogs({ markUnread: false });
  }

  async function sendMessage({ username, message, eventType }) {
    syncActiveParty();

    const result = await window.PartyChatApi.sendMessage({
      username,
      message,
      eventType
    });

    if (result.success) {
      partyChatPanel.input.value = '';
      displayLogs({ markUnread: false }).catch((error) => {
        window.reportOEDebug?.(
          'error',
          'party.chat',
          'Party chat refresh after send failed.',
          { error }
        );
      });
      return result;
    }

    if (result.error === 'NO_PARTY_CODE') {
      partyChatPanel.addMessage({
        username: '[CONSOLE]',
        message: 'UNABLE TO SEND MESSAGE: NO PARTY CODE',
        eventType: 'error',
        timestamp: Date.now()
      });
      return result;
    }

    window.reportOEDebug?.(
      'error',
      'party.chat',
      'Party chat message send failed.',
      {
        error: result.error
      }
    );
    return result;
  }

  async function deleteChat() {
    try {
      const result = await window.PartyChatApi.deleteChat();
      clearMessages();
      window.reportOEDebug?.('debug', 'party.chat', 'Party chat deleted.', {
        result
      });
      return result;
    } catch (error) {
      window.reportOEDebug?.(
        'error',
        'party.chat',
        'Party chat deletion failed.',
        {
          error
        }
      );
      return { success: false, error };
    }
  }

  function togglePartyChatPanel() {
    partyChatPanel?.toggleExpanded();
    syncChatOverlayState();
  }

  function initDefault() {
    window.reportOEDebug?.(
      'debug',
      'party.chat',
      'Default party chat initialization started.',
      { hasPanel: Boolean(partyChatPanel) }
    );
    if (partyChatPanel) {
      window.reportOEDebug?.(
        'debug',
        'party.chat',
        'Party chat already initialized.'
      );
      return window.PartyChat;
    }

    const container = document.querySelector(
      '.chat-box:not(.overexposure-console)'
    );
    const inputWrapper = container?.querySelector('.chat-input');

    if (container && !container.querySelector('.party-chat-header')) {
      const header = document.createElement('div');
      header.className = 'party-chat-header';

      const title = document.createElement('h2');
      title.className = 'party-chat-title';
      title.textContent = 'Party Chat';

      header.appendChild(title);
      container.insertBefore(header, container.firstChild);
    }

    let submitButton = container?.querySelector('.party-chat-submit-button');
    if (inputWrapper && !submitButton) {
      submitButton = document.createElement('button');
      submitButton.type = 'button';
      submitButton.className = 'party-chat-submit-button';
      submitButton.textContent = 'Enter';
      inputWrapper.appendChild(submitButton);
    }

    function canTogglePartyChat() {
      return Boolean(getCurrentPartyCode());
    }

    const autoFocusChatInput = !isTouchLikeDevice();

    partyChatPanel = window.MessagePanel.create({
      container,
      toggleable: true,
      startOpen: false,
      canToggle: canTogglePartyChat,
      autoFocusInput: autoFocusChatInput
    });
    partyChatPanel.enableToggleShortcut();
    chatSideButton = window.SideButtons?.createIconButton({
      id: 'party-chat-side-button',
      label: 'Open party chat',
      iconSrc: '/images/icons/social/chat.svg',
      onClick() {
        togglePartyChatPanel();
        if (isChatPanelReadable()) {
          clearChatSideButtonUnreadCount();
        }
        syncChatSideButtonState();
      }
    });

    if (chatSideButton) {
      chatSideButtonBadge = document.createElement('span');
      chatSideButtonBadge.className =
        'notification-count-badge side-button-badge';
      chatSideButtonBadge.hidden = true;
      chatSideButtonBadge.setAttribute('aria-hidden', 'true');
      chatSideButton.appendChild(chatSideButtonBadge);
    }

    function syncChatSideButtonState() {
      if (!chatSideButton) return;

      const canToggle = canTogglePartyChat();
      const isOpen = !partyChatPanel.container.hidden;
      setPartyChatAvailable(canToggle);
      if (!canToggle) return;

      chatSideButton.disabled = !canToggle;
      chatSideButton.classList.toggle('disabled', !canToggle);
      chatSideButton.setAttribute('aria-disabled', String(!canToggle));
      chatSideButton.tabIndex = canToggle ? 0 : -1;
      chatSideButton.classList.toggle('active', isOpen);
      chatSideButton.setAttribute(
        'aria-label',
        chatSideButtonUnreadCount > 0 && !isOpen
          ? `Open party chat, ${formatUnreadCount(chatSideButtonUnreadCount)} unread messages`
          : isOpen
            ? 'Close party chat'
            : 'Open party chat'
      );

      if (isChatPanelReadable()) {
        clearChatSideButtonUnreadCount();
      } else {
        updateChatSideButtonBadge();
      }
    }

    if (chatSideButton) {
      const chatPanelObserver = new MutationObserver(syncChatSideButtonState);
      chatPanelObserver.observe(partyChatPanel.container, {
        attributes: true,
        attributeFilter: ['class', 'hidden']
      });

      window.addEventListener('keydown', () => {
        requestAnimationFrame(syncChatSideButtonState);
      });
      window.setInterval(syncChatSideButtonState, 500);

      syncChatSideButtonState();
    }

    window.MessageInput.create({
      input: partyChatPanel.input,
      submitButton,
      refocusAfterSubmit: autoFocusChatInput,
      async onSubmit(message) {
        await sendMessage({
          username:
            window.onlineUsername ||
            (typeof onlineUsername !== 'undefined' ? onlineUsername : ''),
          message,
          eventType: 'message'
        });
      }
    });

    window.PartyChat = {
      panel: partyChatPanel,
      addMessage: partyChatPanel.addMessage,
      clearMessages,
      setAvailable: setPartyChatAvailable,
      syncActiveParty,
      displayLogs,
      refreshChatLogBaseline,
      sendMessage,
      deleteChat,
      toggle: togglePartyChatPanel
    };

    return window.PartyChat;
  }

  window.PartyChatPanel = {
    initDefault,
    setAvailable: setPartyChatAvailable
  };
})();
