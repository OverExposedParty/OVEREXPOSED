(function () {
  const SIDE_BUTTONS_CONTAINER_CLASS = 'side-buttons';
  const SIDE_BUTTON_SELECTOR = '.side-button:not(.disabled), .tts-button:not(.disabled)';

  function getActionableButtons(container) {
    return Array.from(container.querySelectorAll(SIDE_BUTTON_SELECTOR)).filter(
      (button) => !button.hidden && button.getAttribute('aria-disabled') !== 'true'
    );
  }

  function pressSideButton(button) {
    if (!button) return;

    if (typeof button.click === 'function') {
      button.click();
      return;
    }

    button.dispatchEvent(new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      view: window
    }));
  }

  function handleContainerClick(event) {
    const container = event.currentTarget;
    const clickedButton = event.target.closest?.('.side-button, .tts-button');

    if (clickedButton) return;

    const buttons = getActionableButtons(container);
    if (buttons.length !== 1) return;

    event.stopPropagation();
    pressSideButton(buttons[0]);
  }

  function handleShellClick(event) {
    const clickedButton = event.target.closest?.('.side-button, .tts-button');
    if (clickedButton) return;

    const button = event.currentTarget.querySelector(SIDE_BUTTON_SELECTOR);
    if (!button) return;

    event.stopPropagation();
    pressSideButton(button);
  }

  function prepareShell(shell) {
    if (shell.dataset.sideButtonShellReady === 'true') return shell;

    shell.dataset.sideButtonShellReady = 'true';
    shell.addEventListener('click', handleShellClick);
    return shell;
  }

  function wrapButton(button) {
    if (!button) return null;

    const existingShell = button.closest('.side-button-shell');
    if (existingShell) return prepareShell(existingShell);

    const shell = document.createElement('div');
    shell.className = 'side-button-shell';
    button.parentNode.insertBefore(shell, button);
    shell.appendChild(button);
    return prepareShell(shell);
  }

  function normalizeContainer(container) {
    container
      .querySelectorAll(':scope > .side-button, :scope > .tts-button')
      .forEach(wrapButton);
    container.querySelectorAll(':scope > .side-button-shell').forEach(prepareShell);
  }

  function prepareContainer(container) {
    if (container.dataset.sideButtonsDrawerReady === 'true') return container;

    container.dataset.sideButtonsDrawerReady = 'true';
    container.addEventListener('click', handleContainerClick);
    normalizeContainer(container);
    return container;
  }

  function getContainer() {
    let container = document.querySelector(`.${SIDE_BUTTONS_CONTAINER_CLASS}`);

    if (!container) {
      container = document.createElement('div');
      container.className = SIDE_BUTTONS_CONTAINER_CLASS;
      document.body.appendChild(container);
    }

    return prepareContainer(container);
  }

  function createIconButton({ id, label, iconSrc, onClick }) {
    const existingButton = id ? document.getElementById(id) : null;
    if (existingButton) return existingButton;

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'side-button side-button-icon';

    if (id) button.id = id;
    if (label) button.setAttribute('aria-label', label);

    if (iconSrc) {
      const iconContainer = document.createElement('span');
      iconContainer.className = 'side-button-icon-container';

      const icon = document.createElement('img');
      icon.src = typeof versionAssetUrl === 'function' ? versionAssetUrl(iconSrc) : iconSrc;
      icon.alt = '';
      icon.setAttribute('aria-hidden', 'true');
      iconContainer.appendChild(icon);
      button.appendChild(iconContainer);
    }

    if (typeof onClick === 'function') {
      button.addEventListener('click', (event) => {
        event.stopPropagation();
        onClick(event);
      });
    }

    const shell = document.createElement('div');
    shell.className = 'side-button-shell';
    shell.appendChild(button);

    prepareShell(shell);
    getContainer().appendChild(shell);
    return button;
  }

  document
    .querySelectorAll(`.${SIDE_BUTTONS_CONTAINER_CLASS}`)
    .forEach(prepareContainer);

  window.SideButtons = {
    getContainer,
    normalizeContainer,
    createIconButton
  };
})();
