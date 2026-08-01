(function () {
  const PROMPTS = {
    kicked: {
      id: 'user-kicked',
      title: "You've been kicked",
      description: ''
    },
    disbanded: {
      id: 'party-disbanded-container',
      title: 'Party disbanded',
      description: ''
    }
  };

  if (typeof window.LoadStylesheet === 'function') {
    window.LoadStylesheet('/css/general/online/session-status-prompts.css');
  }

  function getPromptMount() {
    return (
      document.querySelector('.main-container') ||
      document.querySelector('.battle-olings-page') ||
      document.body
    );
  }

  function hideElement(element) {
    if (!element) return;
    element.classList.remove('is-visible');
    element.style.setProperty('--container-display', 'none');
    element.hidden = true;
  }

  function showElement(element) {
    if (!element) return;
    element.hidden = false;
    element.style.setProperty('--container-display', 'flex');
    element.classList.add('is-visible');
  }

  function ensurePrompt(type, options = {}) {
    const config = PROMPTS[type] || PROMPTS.disbanded;
    let prompt = document.getElementById(options.id || config.id);

    if (!prompt) {
      prompt = document.createElement('section');
      prompt.id = options.id || config.id;
      getPromptMount().appendChild(prompt);
    }

    prompt.classList.add('oe-session-status-prompt', 'online-status-container');
    prompt.setAttribute('role', 'alert');
    prompt.setAttribute('aria-live', 'assertive');

    const title = options.title || config.title;
    const description = options.description ?? config.description;
    const heading = document.createElement('h2');
    heading.textContent = title;

    const content = document.createElement('div');
    content.className = 'content-container';
    content.appendChild(heading);

    if (description) {
      const text = document.createElement('p');
      text.textContent = description;
      content.appendChild(text);
    }

    prompt.replaceChildren(content);
    return prompt;
  }

  function hideKnownStatusPrompts(except = null) {
    Object.values(PROMPTS).forEach(({ id }) => {
      const prompt = document.getElementById(id);
      if (prompt && prompt !== except) hideElement(prompt);
    });
  }

  function hideSiblings(prompt) {
    const mount = prompt.parentElement;
    if (!mount) return;

    Array.from(mount.children).forEach((child) => {
      if (child === prompt) return;
      hideElement(child);
    });
  }

  function disableSharedOnlineUi() {
    if (typeof window.togglePartyQrCode === 'function') {
      window.togglePartyQrCode(false);
    }

    window.PartyChatReady?.then?.((partyChat) => {
      partyChat?.setAvailable?.(false);
    });
  }

  function showPrompt(type, options = {}) {
    disableSharedOnlineUi();
    const prompt = ensurePrompt(type, options);
    hideKnownStatusPrompts(prompt);

    if (typeof window.setActiveContainers === 'function' && options.useActiveContainers) {
      if (Array.isArray(window.gameContainers) && !window.gameContainers.includes(prompt)) {
        window.gameContainers.push(prompt);
      }
      window.setActiveContainers(prompt);
      showElement(prompt);
    } else {
      hideSiblings(prompt);
      showElement(prompt);
    }

    document.body.classList.add('party-missing-state');
    prompt.focus?.();
    return prompt;
  }

  function showKicked(options = {}) {
    return showPrompt('kicked', options);
  }

  function showDisbanded(options = {}) {
    if (typeof window.setPartyDoesNotExistFavicons === 'function') {
      window.setPartyDoesNotExistFavicons();
    } else if (typeof window.setDisbandedFavicons === 'function') {
      window.setDisbandedFavicons();
    }

    document.documentElement.style.setProperty('--primarypagecolour', '#999999');
    document.documentElement.style.setProperty('--secondarypagecolour', '#666666');
    return showPrompt('disbanded', options);
  }

  window.OESessionStatusPrompts = {
    ensurePrompt,
    hideElement,
    showDisbanded,
    showElement,
    showKicked,
    showPrompt
  };
})();
