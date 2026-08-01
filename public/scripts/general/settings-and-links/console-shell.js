function ensureOverexposureConsoleStyles() {
    if (document.querySelector('link[data-overexposure-console-styles="true"]')) {
        return;
    }

    const chatLogCSS = document.createElement('link');
    chatLogCSS.rel = 'stylesheet';
    chatLogCSS.href = versionAssetUrl('/css/general/online/chat-room.css');
    chatLogCSS.dataset.overexposureConsoleStyles = 'true';
    document.head.appendChild(chatLogCSS);
}

function createOverexposureConsoleMessage(message, eventType = 'info') {
    const chatMessagesContainer = document.querySelector('#overexposure-console .chat-messages');
    if (!chatMessagesContainer) return;

    const timestamp = Date.now();
    const chatMessage = document.createElement('p');
    chatMessage.setAttribute('data-timestamp', timestamp);
    chatMessage.classList.add(eventType, 'new-message', 'console-message');
    chatMessage.textContent = `[CONSOLE]: ${message}`;
    chatMessagesContainer.appendChild(chatMessage);
    chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;

    setTimeout(() => {
        chatMessage.classList.remove('new-message');
    }, 2500);
}

function ensureOverexposureConsole() {
    let consoleContainer = document.getElementById('overexposure-console');
    if (consoleContainer) {
        ensureOverexposureConsoleStyles();
        return consoleContainer;
    }

    ensureOverexposureConsoleStyles();

    consoleContainer = document.createElement('div');
    consoleContainer.className = 'chat-box overexposure-console';
    consoleContainer.id = 'overexposure-console';
    consoleContainer.hidden = true;

    const chatInputContainer = document.createElement('div');
    chatInputContainer.className = 'chat-input';

    const chatInputSuggestion = document.createElement('div');
    chatInputSuggestion.className = 'console-input-suggestion';
    chatInputSuggestion.setAttribute('aria-hidden', 'true');

    const chatInput = document.createElement('input');
    chatInput.type = 'text';
    chatInput.placeholder = 'Type a message...';
    chatInput.maxLength = 100;
    chatInput.autocomplete = 'off';
    chatInput.spellcheck = false;
    chatInputContainer.appendChild(chatInputSuggestion);
    chatInputContainer.appendChild(chatInput);

    const chatMessagesContainer = document.createElement('div');
    chatMessagesContainer.className = 'chat-messages';

    consoleContainer.appendChild(chatInputContainer);
    consoleContainer.appendChild(chatMessagesContainer);
    const headerPlaceholder = document.getElementById('header-placeholder');
    document.body.insertBefore(consoleContainer, headerPlaceholder ?? document.body.firstChild);

    return consoleContainer;
}

function setOverexposureConsoleVisible(isVisible) {
    if (!isVisible) {
        const consoleContainer = document.getElementById('overexposure-console');
        if (consoleContainer) {
            consoleContainer.hidden = true;
            consoleContainer.classList.remove('expanded');
        }
        return;
    }

    if (!canShowSettingsConsole()) {
        setOverexposureConsoleVisible(false);
        return;
    }

    const consoleContainer = ensureOverexposureConsole();
    consoleContainer.hidden = false;

    if (!consoleContainer.dataset.hasIntroMessage) {
        createOverexposureConsoleMessage('Console ready.');
        consoleContainer.dataset.hasIntroMessage = 'true';
    }
}
