(function () {
  const OVERLAY_ID = 'oling-battle-overlay';

  if (typeof window.LoadStylesheet === 'function') {
    window.LoadStylesheet('/css/olings/shared/oling-battle-overlay.css');
  }

  let overlayElement = null;

  function getPlayerName(player = {}) {
    return (
      player.username ||
      player.name ||
      player.displayName ||
      player.opponentName ||
      'this player'
    );
  }

  function createButton(label, className, onClick) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = className;
    button.textContent = label;
    button.addEventListener('click', onClick);
    return button;
  }

  function buildOverlay() {
    if (overlayElement) return;

    overlayElement = document.createElement('dialog');
    overlayElement.id = OVERLAY_ID;
    overlayElement.className = 'oling-battle-overlay oe-dialog';
    overlayElement.setAttribute('aria-labelledby', 'oling-battle-overlay-title');

    const header = document.createElement('div');
    header.className = 'oling-battle-overlay-header';

    const title = document.createElement('h2');
    title.id = 'oling-battle-overlay-title';
    title.textContent = 'Oling Battle';

    const closeButton = createButton('Close', 'oling-battle-overlay-close', close);
    closeButton.setAttribute('aria-label', 'Close Oling battle');

    header.append(title, closeButton);

    const body = document.createElement('div');
    body.className = 'oling-battle-overlay-body';

    const opponent = document.createElement('p');
    opponent.className = 'oling-battle-overlay-opponent';
    opponent.dataset.role = 'opponent';

    const status = document.createElement('p');
    status.className = 'oling-battle-overlay-status';
    status.textContent = 'Pick an Oling from your lab to start a battle.';

    const actions = document.createElement('div');
    actions.className = 'oling-battle-overlay-actions';

    const chooseButton = createButton(
      'Choose Oling',
      'oling-battle-overlay-primary',
      () => {
        overlayElement.dispatchEvent(
          new CustomEvent('oling-battle-choose-oling', {
            bubbles: true,
            detail: getCurrentContext()
          })
        );
      }
    );

    const cancelButton = createButton(
      'Not now',
      'oling-battle-overlay-secondary',
      close
    );

    actions.append(chooseButton, cancelButton);
    body.append(opponent, status, actions);
    overlayElement.append(header, body);

    document.body.appendChild(overlayElement);
    window.OeDialog?.register(overlayElement);
  }

  function getCurrentContext() {
    try {
      return JSON.parse(overlayElement?.dataset.context || '{}');
    } catch {
      return {};
    }
  }

  function setContext(context = {}) {
    const playerName = getPlayerName(context);
    overlayElement.dataset.context = JSON.stringify({
      opponentId: context.opponentId || context.userId || context.playerId || '',
      opponentName: playerName,
      source: context.source || ''
    });

    const opponent = overlayElement.querySelector('[data-role="opponent"]');
    if (opponent) {
      opponent.textContent = `Challenge ${playerName} to an Oling battle.`;
    }
  }

  function open(context = {}) {
    buildOverlay();
    setContext(context);
    if (typeof window.openOeDialog === 'function') {
      window.openOeDialog(overlayElement, {
        initialFocus: '.oling-battle-overlay-close'
      });
      return;
    }
    overlayElement.showModal();
  }

  function close() {
    if (!overlayElement?.open) return;
    if (typeof window.closeOeDialog === 'function') {
      window.closeOeDialog(overlayElement);
      return;
    }
    overlayElement.close();
  }

  window.OlingBattleOverlay = {
    open,
    close
  };
})();
