(function (globalScope) {
  const phaseLabels = Object.freeze({
    'choose-action': 'CHOOSE ACTION',
    'choose-target': 'CHOOSE TARGET',
    'choose-tag': 'CHOOSE TAG',
    'locking-in': 'LOCKING IN',
    locked: 'LOCKED IN',
    'opponent-tag': 'OPPONENT TAGGING',
    starting: 'PREPARING CLASH',
    waiting: 'WAITING FOR OPPONENT',
    reveal: 'REVEAL',
    resolving: 'RESOLVING',
    tagged: 'TAGGING IN',
    complete: 'CLASH COMPLETE'
  });

  function normalizePhase(value) {
    return String(value || 'waiting')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  function getPhaseLabel(phase) {
    const normalizedPhase = normalizePhase(phase);
    if (phaseLabels[normalizedPhase]) return phaseLabels[normalizedPhase];
    return normalizedPhase.replace(/-/g, ' ').toUpperCase() || 'WAITING';
  }

  function normalizeResultText(value) {
    return (
      String(value || 'NO RESULT')
        .trim()
        .toUpperCase() || 'NO RESULT'
    );
  }

  function createOlingClashPhaseRenderer() {
    function renderPhase(container, phase) {
      if (!container) return null;

      const normalizedPhase = normalizePhase(phase);
      const label = getPhaseLabel(normalizedPhase);
      const labelElement = container.querySelector('[data-clash-phase-label]');
      const detailElement = container.querySelector(
        '[data-clash-result-detail]'
      );
      const abilityReveal = container.querySelector(
        '[data-clash-ability-reveal]'
      );
      const opponentAbilityExplanation = container.parentElement?.querySelector(
        '[data-clash-opponent-ability-explanation]'
      );
      const lockInIcon = container.querySelector('[data-clash-lock-in-icon]');
      const isLocked = normalizedPhase === 'locked';

      container.dataset.phase = normalizedPhase;
      container.dataset.displayMode = 'decision';
      delete container.dataset.result;
      container.classList.remove('is-result');
      container.setAttribute('aria-label', `Turn phase: ${label}`);
      if (labelElement) {
        labelElement.textContent = label;
        labelElement.hidden = isLocked;
      }
      if (lockInIcon) {
        lockInIcon.hidden = !isLocked;
        if (isLocked) {
          lockInIcon.classList.remove('is-animating');
          void lockInIcon.offsetWidth;
          lockInIcon.classList.add('is-animating');
        } else {
          lockInIcon.classList.remove('is-animating');
        }
      }
      if (detailElement) {
        detailElement.textContent = '';
        detailElement.hidden = true;
      }
      if (abilityReveal && !['reveal', 'resolving'].includes(normalizedPhase)) {
        abilityReveal.hidden = true;
        abilityReveal.classList.remove('is-visible', 'is-resolved');
      }
      if (
        opponentAbilityExplanation &&
        !['reveal', 'resolving'].includes(normalizedPhase)
      ) {
        opponentAbilityExplanation.hidden = true;
      }
      return { label, phase: normalizedPhase };
    }

    function renderResult(container, result, detail = '') {
      if (!container) return null;

      const label = normalizeResultText(result);
      const detailText = String(detail || '').trim();
      const labelElement = container.querySelector(
        '[data-clash-decision-label]'
      );
      const detailElement = container.querySelector(
        '[data-clash-result-detail]'
      );
      const lockInIcon = container.querySelector('[data-clash-lock-in-icon]');

      container.dataset.displayMode = 'result';
      container.dataset.result = normalizePhase(label);
      container.classList.add('is-result');
      container.setAttribute(
        'aria-label',
        `Clash result: ${label}${detailText ? `. ${detailText}` : ''}`
      );
      if (labelElement) {
        labelElement.hidden = false;
        labelElement.textContent = label;
      }
      if (lockInIcon) {
        lockInIcon.hidden = true;
        lockInIcon.classList.remove('is-animating');
      }
      if (detailElement) {
        detailElement.textContent = detailText;
        detailElement.hidden = !detailText;
      }

      return { detail: detailText, result: label };
    }

    function initialize(root = globalScope.document) {
      const container = root?.querySelector?.('[data-clash-phase]');
      if (!container) return null;
      return renderPhase(container, container.dataset.phase);
    }

    return {
      getPhaseLabel,
      initialize,
      normalizePhase,
      normalizeResultText,
      phaseLabels,
      renderPhase,
      renderResult
    };
  }

  globalScope.createOlingClashPhaseRenderer = createOlingClashPhaseRenderer;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = createOlingClashPhaseRenderer;
  }
})(typeof window !== 'undefined' ? window : globalThis);
