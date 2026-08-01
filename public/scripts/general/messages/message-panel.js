(function () {
  function isPortraitMode() {
    return window.innerHeight >= window.innerWidth;
  }

  function createMessagePanel({
    container,
    messageSelector = '.chat-messages',
    inputSelector = '.chat-input input',
    inputWrapperSelector = '.chat-input',
    maxHighlightedMessages = 3,
    maxUnreadBadgeCount = 9,
    toggleable = false,
    startOpen = true,
    canToggle = () => true,
    autoFocusInput = true
  }) {
    if (!container) {
      throw new Error('Message panel container not found.');
    }

    const messagesContainer = container.querySelector(messageSelector);
    const input = container.querySelector(inputSelector);
    const inputWrapper = container.querySelector(inputWrapperSelector);

    if (!messagesContainer || !input || !inputWrapper) {
      throw new Error('Message panel markup is incomplete.');
    }

    let unreadMessageCount = 0;
    let toggleShortcutEnabled = false;
    let isOpen = startOpen;

    if (toggleable) {
      container.classList.add('chat-toggleable');
      container.classList.toggle('open', isOpen);
      container.hidden = !isOpen;
    }

    const badge = document.createElement('div');
    badge.className = 'chat-input-badge';
    inputWrapper.appendChild(badge);
    input.maxLength = 100;

    function updateUnreadBadge() {
      const showBadge =
        isPortraitMode() && unreadMessageCount > 0 && !container.hidden;
      badge.textContent =
        unreadMessageCount > maxUnreadBadgeCount
          ? `${maxUnreadBadgeCount}+`
          : String(unreadMessageCount);
      badge.hidden = !showBadge;
      badge.style.display = showBadge ? 'flex' : 'none';
    }

    function clearUnreadMessages() {
      unreadMessageCount = 0;
      updateUnreadBadge();
    }

    function clearMessages() {
      messagesContainer.replaceChildren();
      clearUnreadMessages();
    }

    function scrollToBottom() {
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    function setExpanded(isExpanded) {
      if (toggleable && isExpanded) {
        isOpen = true;
        container.hidden = false;
        container.classList.add('open');
      }

      container.classList.toggle('expanded', isExpanded);

      if (isExpanded) {
        scrollToBottom();
        clearUnreadMessages();
      }
    }

    function toggleExpanded() {
      if (toggleable && !isOpen && !canToggle()) {
        return;
      }

      if (toggleable && isOpen) {
        isOpen = false;
        container.classList.remove('open', 'expanded');
        container.hidden = true;
        return;
      }

      setExpanded(!container.classList.contains('expanded'));

      if (autoFocusInput && container.classList.contains('expanded')) {
        input.focus();
      }
    }

    function addMessage({
      username,
      message,
      eventType = 'message',
      timestamp = Date.now(),
      markUnread = true
    }) {
      if (messagesContainer.querySelector(`[data-timestamp="${timestamp}"]`)) {
        return false;
      }

      const date = new Date(timestamp);
      const timeString = date.toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit'
      });

      const messageElement = document.createElement('p');
      messageElement.setAttribute('data-timestamp', timestamp);
      messageElement.classList.add(eventType);

      if (eventType === 'disconnect') {
        messageElement.classList.add('disconnected');
      } else if (eventType === 'reconnect' || eventType === 'connect') {
        messageElement.classList.add('reconnected');
      }

      messageElement.textContent = `${timeString} ${username}: ${message}`;
      messageElement.classList.add('new-message');
      messagesContainer.appendChild(messageElement);

      const newMessages = messagesContainer.querySelectorAll('.new-message');
      if (newMessages.length > maxHighlightedMessages) {
        const excess = newMessages.length - maxHighlightedMessages;
        for (let i = 0; i < excess; i++) {
          newMessages[i].classList.remove('new-message');
        }
      }

      setTimeout(() => {
        messageElement.classList.remove('new-message');
      }, 10000);

      scrollToBottom();

      if (
        markUnread &&
        isPortraitMode() &&
        !container.classList.contains('expanded')
      ) {
        unreadMessageCount += 1;
        updateUnreadBadge();
      }

      return true;
    }

    function handleDocumentClick(event) {
      if (toggleable && !isOpen) return;

      if (toggleable) {
        if (!container.contains(event.target)) {
          isOpen = false;
          container.classList.remove('open', 'expanded');
          container.hidden = true;
          return;
        }

        setExpanded(true);
        return;
      }

      if (isPortraitMode()) {
        setExpanded(input.contains(event.target));
        return;
      }

      if (
        input.contains(event.target) ||
        messagesContainer.contains(event.target)
      ) {
        setExpanded(true);
      } else {
        setExpanded(false);
      }
    }

    function handleResize() {
      if (!isPortraitMode()) {
        clearUnreadMessages();
      }
      updateUnreadBadge();
    }

    function handleShortcut(event) {
      if (toggleShortcutEnabled && event.key === 'Escape' && isOpen) {
        event.preventDefault();
        isOpen = false;
        container.classList.remove('open', 'expanded');
        container.hidden = true;
        return;
      }

      if (!toggleShortcutEnabled || event.key.toLowerCase() !== 't') return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;

      const activeElement = document.activeElement;
      const isTyping =
        activeElement &&
        (activeElement.tagName === 'INPUT' ||
          activeElement.tagName === 'TEXTAREA' ||
          activeElement.isContentEditable);

      if (isTyping) return;

      event.preventDefault();
      toggleExpanded();
    }

    document.addEventListener('click', handleDocumentClick);
    window.addEventListener('resize', handleResize);
    input.addEventListener('focus', () => setExpanded(true));
    window.addEventListener('keydown', handleShortcut);
    updateUnreadBadge();

    return {
      container,
      messagesContainer,
      input,
      addMessage,
      clearMessages,
      clearUnreadMessages,
      scrollToBottom,
      setExpanded,
      toggleExpanded,
      open() {
        if (!canToggle()) return;

        isOpen = true;
        container.hidden = false;
        container.classList.add('open');
        setExpanded(true);
        if (autoFocusInput) {
          input.focus();
        }
      },
      close() {
        isOpen = false;
        container.classList.remove('open', 'expanded');
        container.hidden = true;
      },
      enableToggleShortcut() {
        toggleShortcutEnabled = true;
      }
    };
  }

  window.MessagePanel = {
    create: createMessagePanel
  };
})();
