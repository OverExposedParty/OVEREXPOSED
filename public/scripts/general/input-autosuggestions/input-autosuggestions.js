(function initialiseOEInputAutosuggestions() {
  function defaultNormalise(value) {
    return String(value || '').toLowerCase();
  }

  function uniqueSuggestions(values) {
    return (Array.isArray(values) ? values : [])
      .map((value) => String(value || '').trim())
      .filter(Boolean)
      .filter(
        (value, index, suggestions) =>
          suggestions.findIndex(
            (candidate) =>
              candidate.toLowerCase() === value.toLowerCase()
          ) === index
      );
  }

  function createSuggestionShell(input) {
    const existingShell = input.closest('.input-autosuggestion-shell');
    if (existingShell) {
      return {
        shell: existingShell,
        suggestion: existingShell.querySelector(
          '.input-autosuggestion-value'
        )
      };
    }

    const shell = document.createElement('span');
    shell.className = 'input-autosuggestion-shell';

    const suggestion = document.createElement('span');
    suggestion.className = 'input-autosuggestion-value';
    suggestion.hidden = true;
    suggestion.setAttribute('aria-hidden', 'true');

    input.parentNode?.insertBefore(shell, input);
    shell.append(suggestion, input);
    return { shell, suggestion };
  }

  function bind(input, options = {}) {
    if (!input || typeof input.addEventListener !== 'function') {
      return {
        accept: () => false,
        commit: () => false,
        destroy() {},
        refresh() {}
      };
    }

    input.__oeInputAutosuggestionController?.destroy?.();

    const { shell, suggestion } = createSuggestionShell(input);
    const normalise =
      typeof options.normalise === 'function'
        ? options.normalise
        : defaultNormalise;
    const onCommit =
      typeof options.onCommit === 'function' ? options.onCommit : () => {};
    let activeSuggestion = '';
    let dismissedValue = null;
    let lastCommittedValue = input.value;
    let refreshId = 0;
    let destroyed = false;
    let hasInputActivity = false;

    input.autocomplete = 'off';

    function hideSuggestion() {
      activeSuggestion = '';
      suggestion.textContent = '';
      suggestion.hidden = true;
      input.removeAttribute('aria-autocomplete');
    }

    function getSuggestionValues(value) {
      const source =
        typeof options.suggestions === 'function'
          ? options.suggestions(value, input)
          : options.suggestions;
      return Promise.resolve(source).then(uniqueSuggestions);
    }

    function findSuggestion(value, suggestions) {
      const normalisedValue = normalise(value);
      if (!normalisedValue) return '';

      return (
        suggestions.find((candidate) => {
          const normalisedCandidate = normalise(candidate);
          return (
            normalisedCandidate.startsWith(normalisedValue) &&
            normalisedCandidate !== normalisedValue
          );
        }) || ''
      );
    }

    async function refresh() {
      const value = input.value;
      if (!hasInputActivity) {
        hideSuggestion();
        return;
      }
      if (dismissedValue !== null && value === dismissedValue) {
        hideSuggestion();
        return;
      }
      dismissedValue = null;

      const currentRefreshId = ++refreshId;
      try {
        const suggestions = await getSuggestionValues(value);
        if (
          destroyed ||
          currentRefreshId !== refreshId ||
          input.value !== value
        ) {
          return;
        }

        activeSuggestion = findSuggestion(value, suggestions);
        if (!activeSuggestion) {
          hideSuggestion();
          return;
        }

        suggestion.textContent =
          `${value}${activeSuggestion.slice(value.length)}`;
        suggestion.hidden = false;
        input.setAttribute('aria-autocomplete', 'inline');
      } catch {
        if (currentRefreshId === refreshId) hideSuggestion();
      }
    }

    function setInputValue(value) {
      input.value = value;
      input.setSelectionRange?.(value.length, value.length);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }

    function accept() {
      if (!activeSuggestion) return false;
      const acceptedValue = activeSuggestion;
      hideSuggestion();
      setInputValue(acceptedValue);
      return true;
    }

    function commit() {
      const value = input.value;
      if (value === lastCommittedValue) return false;
      lastCommittedValue = value;
      onCommit(value, { input });
      return true;
    }

    function handleInput() {
      hasInputActivity = true;
      refresh();
    }

    function handleKeydown(event) {
      if (event.key === 'Tab' && activeSuggestion) {
        event.preventDefault();
        event.stopPropagation();
        accept();
        return;
      }

      if (event.key === 'Escape' && activeSuggestion) {
        event.preventDefault();
        event.stopPropagation();
        dismissedValue = input.value;
        hideSuggestion();
        return;
      }

      if (event.key !== 'Enter') return;

      event.preventDefault();
      event.stopPropagation();
      accept();
      commit();
    }

    function handleBlur() {
      hasInputActivity = false;
      hideSuggestion();
      commit();
    }

    function handleChange() {
      commit();
    }

    input.addEventListener('input', handleInput);
    input.addEventListener('keydown', handleKeydown);
    input.addEventListener('blur', handleBlur);
    input.addEventListener('change', handleChange);

    const controller = {
      accept,
      commit,
      refresh,
      sync() {
        lastCommittedValue = input.value;
        dismissedValue = null;
        hasInputActivity = false;
        hideSuggestion();
        refresh();
      },
      destroy() {
        if (destroyed) return;
        destroyed = true;
        refreshId += 1;
        hideSuggestion();
        input.removeEventListener('input', handleInput);
        input.removeEventListener('keydown', handleKeydown);
        input.removeEventListener('blur', handleBlur);
        input.removeEventListener('change', handleChange);
        delete input.__oeInputAutosuggestionController;
        if (shell.contains(input) && shell.parentNode) {
          shell.parentNode.insertBefore(input, shell);
          shell.remove();
        }
      }
    };

    input.__oeInputAutosuggestionController = controller;
    refresh();
    return controller;
  }

  window.OEInputAutosuggestions = Object.freeze({ bind });
})();
