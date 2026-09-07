(function () {
  const DEFAULT_ASSISTANT = Object.freeze({
    label: 'OE Assistant',
    image: '/images/emails/heroes/mascot/default.png'
  });

  function createRoot(id) {
    const safeId = String(id || 'site')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, '-');
    const root = document.createElement('div');
    root.id = `oe-tutorial-${safeId}`;
    root.className = 'oe-tutorial-root';
    root.dataset.oeTutorialId = safeId;
    root.hidden = true;
    document.body.appendChild(root);
    return root;
  }

  function create(options = {}) {
    const id = String(options.id || '').trim();
    if (!id) throw new Error('A tutorial id is required.');
    if (!window.OETutorialStorage || !window.OETutorialTarget) {
      throw new Error('Tutorial storage and target modules must load first.');
    }

    const steps = Array.isArray(options.steps) ? [...options.steps] : [];
    const assistant = { ...DEFAULT_ASSISTANT, ...(options.assistant || {}) };
    const preview = options.preview?.enabled ? options.preview : null;
    const storage = window.OETutorialStorage.create({
      id,
      key: options.storageKey,
      version: options.version
    });
    const root = createRoot(id);
    const backdrop = document.createElement('div');
    backdrop.className = 'oe-tutorial-backdrop';
    backdrop.dataset.oeTutorialBackdrop = '';
    backdrop.hidden = true;
    backdrop.setAttribute('aria-hidden', 'true');
    document.body.insertBefore(backdrop, root);
    let currentStepIndex = 0;
    let active = false;
    let previouslyFocused = null;
    let removeAdvanceTrigger = null;
    let restoreElevatedElements = [];

    root.innerHTML = `
      <div class="oe-tutorial-preview" data-oe-tutorial-preview hidden>
        <span><strong data-oe-tutorial-preview-label></strong> <span data-oe-tutorial-preview-copy></span></span>
        <a data-oe-tutorial-preview-exit></a>
      </div>
      <svg class="oe-tutorial-target" data-oe-tutorial-target aria-hidden="true">
        <ellipse data-oe-tutorial-ring-primary pathLength="1"></ellipse>
        <ellipse data-oe-tutorial-ring-secondary pathLength="1"></ellipse>
      </svg>
      <div class="oe-tutorial-annotation" data-oe-tutorial-annotation aria-hidden="true"></div>
      <section class="oe-tutorial-dialogue" data-oe-tutorial-dialogue
        role="dialog" aria-labelledby="${root.id}-title"
        aria-describedby="${root.id}-copy">
        <button class="oe-tutorial-notch" data-oe-tutorial-notch type="button"
          aria-expanded="true" aria-label="Hide tutorial dialogue">
          <span data-oe-tutorial-notch-label>Hide</span>
        </button>
        <div class="oe-tutorial-assistant" data-oe-tutorial-assistant>
          <p data-oe-tutorial-assistant-label></p>
          <img data-oe-tutorial-assistant-image alt="" />
        </div>
        <div class="oe-tutorial-message" data-oe-tutorial-message>
          <button class="oe-tutorial-skip" data-oe-tutorial-skip type="button">Skip</button>
          <div class="oe-tutorial-copy-block">
            <p class="oe-tutorial-eyebrow" data-oe-tutorial-eyebrow></p>
            <h1 id="${root.id}-title" data-oe-tutorial-title></h1>
            <p id="${root.id}-copy" data-oe-tutorial-copy></p>
          </div>
          <div class="oe-tutorial-controls">
            <span class="oe-tutorial-progress" data-oe-tutorial-progress></span>
            <button class="oe-tutorial-next" data-oe-tutorial-next type="button"></button>
          </div>
        </div>
      </section>
    `;

    const dialogue = root.querySelector('[data-oe-tutorial-dialogue]');
    const assistantPanel = root.querySelector('[data-oe-tutorial-assistant]');
    const message = root.querySelector('[data-oe-tutorial-message]');
    const eyebrow = root.querySelector('[data-oe-tutorial-eyebrow]');
    const title = root.querySelector('[data-oe-tutorial-title]');
    const copy = root.querySelector('[data-oe-tutorial-copy]');
    const progress = root.querySelector('[data-oe-tutorial-progress]');
    const next = root.querySelector('[data-oe-tutorial-next]');
    const skip = root.querySelector('[data-oe-tutorial-skip]');
    const notch = root.querySelector('[data-oe-tutorial-notch]');
    const notchLabel = root.querySelector('[data-oe-tutorial-notch-label]');
    const previewElement = root.querySelector('[data-oe-tutorial-preview]');

    root.querySelector('[data-oe-tutorial-assistant-label]').textContent =
      assistant.label;
    root.querySelector('[data-oe-tutorial-assistant-image]').src =
      assistant.image;

    if (preview) {
      previewElement.hidden = false;
      root.querySelector('[data-oe-tutorial-preview-label]').textContent =
        preview.label || 'Tutorial preview';
      root.querySelector('[data-oe-tutorial-preview-copy]').textContent =
        preview.copy || '';
      const exit = root.querySelector('[data-oe-tutorial-preview-exit]');
      exit.href = preview.exitHref || '/';
      exit.textContent = preview.exitLabel || 'Exit preview';
    }

    function getCurrentStep() {
      return steps[currentStepIndex] || null;
    }

    function isStepAvailable(step) {
      if (!step) return false;
      if (typeof step.when !== 'function') return true;
      try {
        return step.when() !== false;
      } catch (error) {
        console.error(`Failed to evaluate tutorial step "${step.id}":`, error);
        return false;
      }
    }

    function seekAvailableStep(direction = 1) {
      while (
        currentStepIndex >= 0 &&
        currentStepIndex < steps.length &&
        !isStepAvailable(getCurrentStep())
      ) {
        currentStepIndex += direction;
      }
      return getCurrentStep();
    }

    const target = window.OETutorialTarget.create({
      root,
      getStep: getCurrentStep,
      isActive: () => active
    });

    function clearAdvanceTrigger() {
      removeAdvanceTrigger?.();
      removeAdvanceTrigger = null;
    }

    function resolveEventTarget(value) {
      if (!value || value === 'window') return window;
      if (value === 'document') return document;
      if (typeof value === 'function') return value();
      if (typeof value === 'string') return document.querySelector(value);
      return value;
    }

    function resolveElements(value) {
      const resolved = typeof value === 'function' ? value() : value;
      if (!resolved) return [];
      if (typeof resolved === 'string') {
        return [...document.querySelectorAll(resolved)];
      }
      if (resolved instanceof window.Element) return [resolved];
      if (typeof resolved[Symbol.iterator] === 'function') {
        return [...resolved].flatMap(resolveElements);
      }
      return [];
    }

    function snapshotInlineProperty(element, property) {
      return {
        priority: element.style.getPropertyPriority(property),
        value: element.style.getPropertyValue(property)
      };
    }

    function restoreInlineProperty(element, property, snapshot) {
      if (snapshot.value) {
        element.style.setProperty(property, snapshot.value, snapshot.priority);
      } else {
        element.style.removeProperty(property);
      }
    }

    function clearStepPresentation() {
      restoreElevatedElements.reverse().forEach((restore) => restore());
      restoreElevatedElements = [];
      backdrop.hidden = true;
      backdrop.classList.remove('is-contained');
      backdrop.style.removeProperty('--oe-tutorial-backdrop-blur');
      backdrop.style.removeProperty('--oe-tutorial-backdrop-colour');
      if (backdrop.parentElement !== document.body) {
        document.body.insertBefore(backdrop, root);
      }
    }

    function applyStepPresentation(step) {
      clearStepPresentation();
      if (!step?.backdrop) return;

      const backdropOptions = step.backdrop === true ? {} : step.backdrop || {};
      const backdropContainer =
        resolveElements(backdropOptions.container)[0] || document.body;
      backdropContainer.insertBefore(backdrop, backdropContainer.firstChild);
      backdrop.classList.toggle(
        'is-contained',
        backdropContainer !== document.body
      );
      backdrop.hidden = false;
      if (backdropOptions.blur) {
        backdrop.style.setProperty(
          '--oe-tutorial-backdrop-blur',
          String(backdropOptions.blur)
        );
      }
      if (backdropOptions.colour) {
        backdrop.style.setProperty(
          '--oe-tutorial-backdrop-colour',
          String(backdropOptions.colour)
        );
      }

      resolveElements(step.releaseStacking).forEach((element) => {
        const bottom = snapshotInlineProperty(element, 'bottom');
        const left = snapshotInlineProperty(element, 'left');
        const right = snapshotInlineProperty(element, 'right');
        const top = snapshotInlineProperty(element, 'top');
        const transform = snapshotInlineProperty(element, 'transform');
        const transition = snapshotInlineProperty(element, 'transition');
        const zIndex = snapshotInlineProperty(element, 'z-index');
        const rect = element.getBoundingClientRect();
        const layoutLeft = element.offsetLeft;
        const layoutTop = element.offsetTop;
        element.style.setProperty('transition', 'none');
        element.style.setProperty('transform', 'none');
        const untransformedRect = element.getBoundingClientRect();
        element.style.setProperty(
          'left',
          `${layoutLeft + rect.left - untransformedRect.left}px`
        );
        element.style.setProperty(
          'top',
          `${layoutTop + rect.top - untransformedRect.top}px`
        );
        element.style.setProperty('right', 'auto');
        element.style.setProperty('bottom', 'auto');
        element.style.setProperty('z-index', 'auto');
        restoreElevatedElements.push(() => {
          restoreInlineProperty(element, 'bottom', bottom);
          restoreInlineProperty(element, 'left', left);
          restoreInlineProperty(element, 'right', right);
          restoreInlineProperty(element, 'top', top);
          restoreInlineProperty(element, 'transform', transform);
          restoreInlineProperty(element, 'z-index', zIndex);
          element.getBoundingClientRect();
          restoreInlineProperty(element, 'transition', transition);
        });
      });

      resolveElements(step.elevate).forEach((element) => {
        const position = snapshotInlineProperty(element, 'position');
        const zIndex = snapshotInlineProperty(element, 'z-index');
        const wasElevated = element.classList.contains(
          'is-oe-tutorial-elevated'
        );
        if (window.getComputedStyle(element).position === 'static') {
          element.style.setProperty('position', 'relative');
        }
        element.style.setProperty('z-index', '2147483601');
        element.classList.add('is-oe-tutorial-elevated');
        restoreElevatedElements.push(() => {
          restoreInlineProperty(element, 'position', position);
          restoreInlineProperty(element, 'z-index', zIndex);
          if (!wasElevated) {
            element.classList.remove('is-oe-tutorial-elevated');
          }
        });
      });
    }

    function bindAdvanceTrigger(step) {
      clearAdvanceTrigger();
      if (!step?.advanceOn) return;
      const config =
        typeof step.advanceOn === 'string'
          ? { event: step.advanceOn }
          : step.advanceOn;
      const source = resolveEventTarget(config.target);
      if (!source?.addEventListener || !config.event) return;

      const handler = (event) => {
        if (
          typeof config.predicate === 'function' &&
          !config.predicate(event)
        ) {
          return;
        }
        clearAdvanceTrigger();
        advance();
      };
      source.addEventListener(config.event, handler);
      removeAdvanceTrigger = () =>
        source.removeEventListener(config.event, handler);
    }

    function setCollapsed(collapsed) {
      root.classList.toggle('is-collapsed', collapsed);
      notch.setAttribute('aria-expanded', String(!collapsed));
      notch.setAttribute(
        'aria-label',
        collapsed ? 'Show tutorial dialogue' : 'Hide tutorial dialogue'
      );
      notchLabel.textContent = collapsed ? 'Show' : 'Hide';
      message.inert = collapsed;
      message.setAttribute('aria-hidden', String(collapsed));
      assistantPanel.setAttribute('aria-hidden', String(collapsed));
      const step = getCurrentStep();
      dialogue.setAttribute(
        'aria-modal',
        String(!collapsed && Boolean(step?.modal))
      );
    }

    function renderStep() {
      const step = getCurrentStep();
      if (!step) {
        finish();
        return;
      }

      eyebrow.textContent = step.eyebrow || '';
      title.textContent = step.title || '';
      copy.textContent = step.copy || '';
      const availableSteps = steps.filter(isStepAvailable);
      progress.textContent = `${availableSteps.indexOf(step) + 1} / ${availableSteps.length}`;
      next.textContent = step.action || 'Continue';
      next.hidden = step.actionRequired === true;
      dialogue.dataset.step = step.id || String(currentStepIndex + 1);
      root.dataset.dialoguePlacement =
        step.dialoguePlacement === 'top' ? 'top' : 'bottom';
      root.classList.toggle('is-modal', Boolean(step.modal));
      dialogue.setAttribute('aria-modal', String(Boolean(step.modal)));
      bindAdvanceTrigger(step);
      applyStepPresentation(step);
      window.requestAnimationFrame(target.refresh);
      step.onEnter?.({ tutorial: api, step, index: currentStepIndex });
    }

    function refreshPresentation() {
      if (!active || !getCurrentStep()) return false;
      applyStepPresentation(getCurrentStep());
      window.requestAnimationFrame(target.refresh);
      return true;
    }

    function goToIndex(nextIndex) {
      const normalizedIndex = Number(nextIndex);
      if (
        !Number.isInteger(normalizedIndex) ||
        normalizedIndex < 0 ||
        normalizedIndex >= steps.length
      ) {
        return false;
      }
      const direction = normalizedIndex < currentStepIndex ? -1 : 1;
      clearAdvanceTrigger();
      getCurrentStep()?.onExit?.({
        tutorial: api,
        step: getCurrentStep(),
        index: currentStepIndex
      });
      clearStepPresentation();
      currentStepIndex = normalizedIndex;
      seekAvailableStep(direction);
      if (!getCurrentStep()) return false;
      renderStep();
      return true;
    }

    function goTo(stepId) {
      return goToIndex(steps.findIndex((step) => step.id === stepId));
    }

    function previous() {
      if (currentStepIndex <= 0) return false;
      return goToIndex(currentStepIndex - 1);
    }

    function start(startOptions = {}) {
      if (active || !steps.length) return;
      active = true;
      const requestedIndex = steps.findIndex(
        (step) => step.id === startOptions.stepId
      );
      currentStepIndex = requestedIndex >= 0 ? requestedIndex : 0;
      seekAvailableStep();
      if (!getCurrentStep()) {
        active = false;
        return;
      }
      previouslyFocused = document.activeElement;
      root.hidden = false;
      root.classList.add('is-active');
      setCollapsed(false);
      document.body.classList.add('has-oe-tutorial');
      renderStep();
      window.requestAnimationFrame(() => next.focus());
    }

    function finish(finishOptions = {}) {
      if (!active) return;
      const completed = finishOptions.completed !== false;
      clearAdvanceTrigger();
      getCurrentStep()?.onExit?.({
        tutorial: api,
        step: getCurrentStep(),
        index: currentStepIndex
      });
      clearStepPresentation();
      active = false;
      root.classList.remove(
        'is-active',
        'has-target',
        'is-modal',
        'is-collapsed'
      );
      root.hidden = !preview;
      document.body.classList.remove('has-oe-tutorial');
      if (completed && options.rememberCompletion !== false) {
        storage.markCompleted();
      }
      options.onFinish?.({ tutorial: api, completed });
      if (previouslyFocused?.focus) previouslyFocused.focus();
    }

    function advance() {
      clearAdvanceTrigger();
      const step = getCurrentStep();
      step?.onExit?.({ tutorial: api, step, index: currentStepIndex });
      clearStepPresentation();
      currentStepIndex += 1;
      seekAvailableStep();
      renderStep();
    }

    function toggleCollapsed() {
      setCollapsed(!root.classList.contains('is-collapsed'));
      notch.focus();
    }

    function handleKeydown(event) {
      if (!active) return;
      if (event.key === 'Escape') finish();
      if (event.key !== 'Tab') return;

      const focusable = root.classList.contains('is-collapsed')
        ? [notch]
        : [notch, skip, next];
      const index = focusable.indexOf(document.activeElement);
      if (event.shiftKey && index <= 0) {
        event.preventDefault();
        focusable[focusable.length - 1].focus();
      } else if (!event.shiftKey && index === focusable.length - 1) {
        event.preventDefault();
        focusable[0].focus();
      }
    }

    next.addEventListener('click', advance);
    skip.addEventListener('click', finish);
    notch.addEventListener('click', toggleCollapsed);
    document.addEventListener('keydown', handleKeydown);

    const api = {
      id,
      root,
      storage,
      start,
      finish,
      goTo,
      goToIndex,
      advance,
      previous,
      refreshTarget: target.refresh,
      refreshPresentation,
      hasCompleted: storage.hasCompleted,
      resetCompletion: storage.clear,
      destroy() {
        finish({ completed: false });
        clearStepPresentation();
        target.destroy();
        document.removeEventListener('keydown', handleKeydown);
        backdrop.remove();
        root.remove();
      },
      get active() {
        return active;
      },
      get currentStep() {
        return getCurrentStep();
      },
      get currentStepIndex() {
        return currentStepIndex;
      },
      get steps() {
        return steps.slice();
      }
    };

    return api;
  }

  window.OETutorial = { create };
})();
