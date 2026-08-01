(function initialiseOeDialogManager() {
  const dialogState = new WeakMap();
  const openDialogs = [];

  function syncBodyState() {
    document.body.classList.toggle('oe-dialog-open', openDialogs.length > 0);
  }

  function getFocusableElement(dialog, preferredSelector) {
    if (preferredSelector) {
      const preferred = dialog.querySelector(preferredSelector);
      if (preferred && !preferred.disabled) return preferred;
    }

    return dialog.querySelector(
      'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'
    );
  }

  function open(dialog, options = {}) {
    if (!(dialog instanceof HTMLDialogElement)) {
      throw new TypeError('openOeDialog requires an HTMLDialogElement');
    }

    const existingState = dialogState.get(dialog);
    dialogState.set(dialog, {
      dismissible: options.dismissible !== false,
      initialFocus: options.initialFocus || null,
      opener: options.opener || document.activeElement,
      onClose: options.onClose || existingState?.onClose || null
    });
    dialog.classList.add('oe-dialog');

    if (!dialog.open) dialog.showModal();
    if (!openDialogs.includes(dialog)) openDialogs.push(dialog);
    syncBodyState();

    window.requestAnimationFrame(() => {
      getFocusableElement(dialog, options.initialFocus)?.focus({
        preventScroll: true
      });
    });
  }

  function close(dialog, returnValue = '') {
    if (!(dialog instanceof HTMLDialogElement) || !dialog.open) return;
    dialog.close(returnValue);
  }

  function openContent(content, options = {}) {
    if (!(content instanceof HTMLElement)) return null;

    let dialog = content.closest('dialog.oe-dialog');
    if (!dialog) {
      dialog = document.createElement('dialog');
      dialog.className = `oe-dialog ${options.hostClass || 'oe-dialog-content-host'}`;
      const labelledBy = content.getAttribute('aria-labelledby');
      if (labelledBy) dialog.setAttribute('aria-labelledby', labelledBy);
      content.removeAttribute('aria-modal');
      content.removeAttribute('role');
      content.before(dialog);
      dialog.appendChild(content);
      register(dialog, {
        onClose: () => {
          options.onClose?.();
          if (options.remove !== false) dialog.remove();
        }
      });
    }

    open(dialog, {
      dismissible: options.dismissible,
      initialFocus: options.initialFocus,
      opener: options.opener
    });
    return dialog;
  }

  function closeContent(content, returnValue = '') {
    const dialog = content?.closest?.('dialog.oe-dialog');
    if (dialog) close(dialog, returnValue);
  }

  function register(dialog, options = {}) {
    if (
      !(dialog instanceof HTMLDialogElement) ||
      dialog.dataset.oeDialogReady
    ) {
      return dialog;
    }

    dialog.dataset.oeDialogReady = 'true';
    dialog.classList.add('oe-dialog');
    dialogState.set(dialog, {
      dismissible: options.dismissible !== false,
      initialFocus: options.initialFocus || null,
      opener: null,
      onClose: options.onClose || null
    });

    dialog.addEventListener('cancel', (event) => {
      if (dialogState.get(dialog)?.dismissible === false) {
        event.preventDefault();
      }
    });

    dialog.addEventListener('click', (event) => {
      if (event.target !== dialog) return;
      if (dialogState.get(dialog)?.dismissible === false) return;

      const bounds = dialog.getBoundingClientRect();
      const clickedInside =
        event.clientX >= bounds.left &&
        event.clientX <= bounds.right &&
        event.clientY >= bounds.top &&
        event.clientY <= bounds.bottom;
      if (!clickedInside) close(dialog, 'backdrop');
    });

    dialog.addEventListener('close', () => {
      const index = openDialogs.lastIndexOf(dialog);
      if (index >= 0) openDialogs.splice(index, 1);
      syncBodyState();

      const state = dialogState.get(dialog);
      state?.onClose?.(dialog.returnValue);
      if (state?.opener?.isConnected) state.opener.focus?.();
    });

    return dialog;
  }

  window.OeDialog = { close, closeContent, open, openContent, register };
  window.openOeDialog = open;
  window.closeOeDialog = close;

  document.querySelectorAll('dialog[data-oe-dialog]').forEach((dialog) => {
    register(dialog, {
      dismissible: dialog.dataset.oeDialogDismissible !== 'false'
    });
  });

  if (typeof window.SetScriptLoaded === 'function') {
    window.SetScriptLoaded('/scripts/general/oe-dialog/oe-dialog.js');
  }
})();
