function initialiseOverexposureConsoleInteractions() {
    const consoleContainer = ensureOverexposureConsole();
    const chatInput = consoleContainer.querySelector('.chat-input input');
    if (!chatInput || consoleContainer.dataset.interactionsReady === 'true') return;

    const commandHistory = [];
    const maxCommandHistory = 50;
    let commandHistoryIndex = 0;
    let commandHistoryDraft = '';
    let activeConsoleSuggestion = '';
    let suggestionRefreshId = 0;

    function isEditableElement(element) {
        if (!element) return false;
        if (element.isContentEditable) return true;

        const tagName = element.tagName?.toLowerCase();
        return ['input', 'textarea', 'select'].includes(tagName);
    }

    function getConsoleSuggestionElement() {
        return consoleContainer.querySelector('.console-input-suggestion');
    }

    function getConsoleCommandSuggestions() {
        return mergeConsoleSuggestions(
            overexposureConsoleBaseSuggestions,
            getSuggestionsFromCommandState('overexposure'),
            overexposureConsoleCommandSuggestions
        );
    }

    function refreshConsoleSuggestions() {
        const refreshId = ++suggestionRefreshId;
        ensureOverexposureConsoleCommands()
            .then((suggestions) => {
                if (refreshId !== suggestionRefreshId) return;
                overexposureConsoleCommandSuggestions = suggestions;
                renderConsoleSuggestion();
            })
            .catch(() => renderConsoleSuggestion());
    }

    function findConsoleSuggestion(value) {
        const draft = String(value || '');
        const trimmedDraft = draft.trimStart();
        if (!trimmedDraft.startsWith('/')) return '';

        const normalisedDraft = trimmedDraft.toLowerCase();
        const suggestion = getConsoleCommandSuggestions().find((candidate) => {
            const normalisedCandidate = candidate.toLowerCase();
            return normalisedCandidate.startsWith(normalisedDraft)
                && normalisedCandidate !== normalisedDraft;
        });

        return suggestion || '';
    }

    function renderConsoleSuggestion() {
        const suggestionElement = getConsoleSuggestionElement();
        if (!suggestionElement) return;

        activeConsoleSuggestion = findConsoleSuggestion(chatInput.value);

        if (!activeConsoleSuggestion) {
            suggestionElement.textContent = '';
            suggestionElement.hidden = true;
            return;
        }

        suggestionElement.textContent = activeConsoleSuggestion;
        suggestionElement.hidden = false;
    }

    function setConsoleInputValue(value) {
        chatInput.value = value;
        const cursorPosition = chatInput.value.length;
        chatInput.setSelectionRange(cursorPosition, cursorPosition);
        renderConsoleSuggestion();
    }

    function acceptConsoleSuggestion() {
        const acceptedValue = /\s$/.test(activeConsoleSuggestion)
            ? activeConsoleSuggestion
            : `${activeConsoleSuggestion} `;
        setConsoleInputValue(acceptedValue);
    }

    function focusConsoleInput(initialValue = null) {
        if (!canShowSettingsConsole()) return;

        setOverexposureConsoleVisible(true);
        consoleContainer.classList.add('expanded');

        if (initialValue !== null) {
            setConsoleInputValue(initialValue);
        }

        chatInput.focus();

        refreshConsoleSuggestions();
    }

    function saveCommandHistory(command) {
        if (!command.startsWith('/')) return;

        if (commandHistory[commandHistory.length - 1] !== command) {
            commandHistory.push(command);
            if (commandHistory.length > maxCommandHistory) {
                commandHistory.shift();
            }
        }

        commandHistoryIndex = commandHistory.length;
        commandHistoryDraft = '';
    }

    function navigateCommandHistory(direction) {
        if (!commandHistory.length) return false;

        if (commandHistoryIndex === commandHistory.length) {
            commandHistoryDraft = chatInput.value;
        }

        commandHistoryIndex += direction;
        commandHistoryIndex = Math.max(0, Math.min(commandHistoryIndex, commandHistory.length));
        setConsoleInputValue(commandHistoryIndex === commandHistory.length
            ? commandHistoryDraft
            : commandHistory[commandHistoryIndex]);
        return true;
    }

    chatInput.addEventListener('keydown', async (event) => {
        if (event.key === 'Tab' && activeConsoleSuggestion) {
            event.preventDefault();
            event.stopPropagation();
            acceptConsoleSuggestion();
            return;
        }

        if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
            const direction = event.key === 'ArrowUp' ? -1 : 1;
            if (navigateCommandHistory(direction)) {
                event.preventDefault();
                event.stopPropagation();
            }
            return;
        }

        if (event.key !== 'Enter') return;

        event.preventDefault();
        event.stopPropagation();

        const message = chatInput.value.trim();
        if (!message) return;

        try {
            if (message.startsWith('/')) {
                saveCommandHistory(message);
                try {
                    await ensureOverexposureConsoleCommands();
                    await window.OverexposedCommands.runCommand(message, {
                        pageType: 'overexposure',
                        writeConsoleMessage: (_name, commandMessage, eventType) => {
                            createOverexposureConsoleMessage(commandMessage, eventType);
                        }
                    });
                }
                catch (error) {
                    console.error('Failed to run overexposure console command:', error);
                    createOverexposureConsoleMessage('Unable to run command.', 'error');
                }
            }
            else {
                createOverexposureConsoleMessage(message, 'message');
            }
        }
        finally {
            setConsoleInputValue('');
        }
    });

    chatInput.addEventListener('input', () => {
        renderConsoleSuggestion();
        refreshConsoleSuggestions();
    });

    chatInput.addEventListener('focus', () => {
        refreshConsoleSuggestions();
    });

    chatInput.addEventListener('focus', () => {
        consoleContainer.classList.add('expanded');
    });

    chatInput.addEventListener('blur', () => {
        consoleContainer.classList.remove('expanded');
    });

    document.addEventListener('keydown', (event) => {
        if (event.key !== '/' || event.ctrlKey || event.altKey || event.metaKey) return;
        if (isEditableElement(event.target) && event.target !== chatInput) return;
        if (!canShowSettingsConsole()) return;

        event.preventDefault();
        event.stopPropagation();

        if (chatInput !== document.activeElement) {
            focusConsoleInput('/');
            return;
        }

        const start = chatInput.selectionStart ?? chatInput.value.length;
        const end = chatInput.selectionEnd ?? start;
        setConsoleInputValue(`${chatInput.value.slice(0, start)}/${chatInput.value.slice(end)}`);
    });

    document.addEventListener('click', (event) => {
        if (consoleContainer.hidden || consoleContainer.contains(event.target)) return;
        consoleContainer.classList.remove('expanded');
    });

    consoleContainer.dataset.interactionsReady = 'true';
}
