function createAccountFooterHintController({
  container,
  hintGrid,
  defaultLabel = 'Footer grid 2',
  saveClass = 'has-account-save',
  hintClass = 'has-account-hint',
  warningClass = 'account-footer-hint-warning',
  hintSelector = '[data-account-hint]'
} = {}) {
  function setHint(text = '', { warning = false } = {}) {
    if (!hintGrid || hintGrid.classList.contains(saveClass)) return;

    hintGrid.textContent = text;
    hintGrid.classList.toggle(hintClass, Boolean(text));
    hintGrid.classList.toggle(warningClass, Boolean(text) && warning);
    hintGrid.setAttribute(
      'aria-label',
      text ? `Current control: ${text}` : defaultLabel
    );
  }

  function clearHint() {
    setHint('');
  }

  function getHintTarget(target) {
    return target?.closest?.(hintSelector) || null;
  }

  function attach() {
    if (!container || !hintGrid) return { setHint, clearHint, detach() {} };

    const handlePointerOver = (event) => {
      const hintTarget = getHintTarget(event.target);
      if (!hintTarget) return;

      setHint(hintTarget.dataset.accountHint || '', {
        warning: hintTarget.dataset.accountHintClass === 'warning'
      });
    };

    const handlePointerOut = (event) => {
      const hintTarget = getHintTarget(event.target);
      if (!hintTarget) return;

      if (
        event.relatedTarget instanceof Node &&
        hintTarget.contains(event.relatedTarget)
      ) {
        return;
      }

      clearHint();
    };

    const handleFocusIn = (event) => {
      const hintTarget = getHintTarget(event.target);
      if (!hintTarget) return;

      setHint(hintTarget.dataset.accountHint || '', {
        warning: hintTarget.dataset.accountHintClass === 'warning'
      });
    };

    const handleFocusOut = (event) => {
      const hintTarget = getHintTarget(event.target);
      if (!hintTarget) return;

      clearHint();
    };

    container.addEventListener('pointerover', handlePointerOver);
    container.addEventListener('pointerout', handlePointerOut);
    container.addEventListener('focusin', handleFocusIn);
    container.addEventListener('focusout', handleFocusOut);

    return {
      setHint,
      clearHint,
      detach() {
        container.removeEventListener('pointerover', handlePointerOver);
        container.removeEventListener('pointerout', handlePointerOut);
        container.removeEventListener('focusin', handleFocusIn);
        container.removeEventListener('focusout', handleFocusOut);
      }
    };
  }

  return {
    setHint,
    clearHint,
    getHintTarget,
    attach
  };
}

window.createAccountFooterHintController = createAccountFooterHintController;

if (typeof SetScriptLoaded === 'function') {
  SetScriptLoaded('/scripts/general/account-footer-hints/account-footer-hints.js');
}
