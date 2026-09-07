(function (globalScope) {
  const defeatedEyesPath =
    '/images/olings/builds/eyes/states/defeated-eyes.svg';
  const defaultModeSettings = Object.freeze({
    'enemy-target': Object.freeze({
      canCancel: true,
      confirmLabel: 'CHOOSE TARGET',
      side: 'opponent',
      title: 'CHOOSE AN ENEMY OLING'
    }),
    'friendly-target': Object.freeze({
      canCancel: true,
      confirmLabel: 'CHOOSE TARGET',
      side: 'local',
      title: 'CHOOSE A FRIENDLY OLING'
    }),
    tag: Object.freeze({
      canCancel: false,
      confirmLabel: 'TAG IN',
      side: 'local',
      title: 'CHOOSE YOUR NEXT OLING'
    })
  });

  function createOlingClashPicker(options = {}) {
    const healthRenderer = options.healthRenderer;
    const effectRenderer = options.effectRenderer;
    let activeConfig = null;
    let selectedIndex = null;
    let selectedChoiceKey = null;

    function getElements(root) {
      const documentRef = root?.ownerDocument || globalScope.document;
      const container =
        root?.querySelector?.('[data-clash-picker]') ||
        documentRef?.querySelector?.('[data-clash-picker]');
      return {
        choices: container?.querySelector('[data-clash-picker-choices]'),
        confirm: container?.querySelector('[data-clash-picker-confirm]'),
        container,
        description: container?.querySelector(
          '[data-clash-picker-description]'
        ),
        options: container?.querySelector('[data-clash-picker-options]'),
        title: container?.querySelector('[data-clash-picker-title]')
      };
    }

    function renderArt(container, parts = {}, { defeated = false } = {}) {
      ['flight', 'body', 'eyes', 'mouth'].forEach((partKey) => {
        const image = container.querySelector(
          `[data-picker-part="${partKey}"]`
        );
        const source =
          partKey === 'eyes' && defeated ? defeatedEyesPath : parts[partKey];
        if (image && source) image.src = source;
      });
    }

    function renderSelection(root) {
      const elements = getElements(root);
      elements.options
        ?.querySelectorAll('[data-clash-picker-option]')
        .forEach((button) => {
          const isSelected = Number(button.dataset.teamSlot) === selectedIndex;
          button.classList.toggle('is-selected', isSelected);
          button.setAttribute('aria-pressed', String(isSelected));
        });
      const selectedOling = activeConfig?.olings?.[selectedIndex];
      elements.choices
        ?.querySelectorAll('[data-clash-picker-choice]')
        .forEach((button) => {
          const isEligible = Boolean(
            selectedOling &&
            (typeof activeConfig?.isChoiceEligible !== 'function' ||
              activeConfig.isChoiceEligible(
                button.dataset.choiceKey,
                selectedOling,
                selectedIndex
              ))
          );
          const isSelected = button.dataset.choiceKey === selectedChoiceKey;
          button.disabled = !isEligible;
          button.classList.toggle('is-selected', isSelected);
          button.setAttribute('aria-checked', String(isSelected));
        });
      const choiceRequired = Boolean(activeConfig?.choiceOptions?.length);
      const selectedChoiceIsEligible =
        !choiceRequired ||
        Boolean(
          selectedChoiceKey &&
          selectedOling &&
          (typeof activeConfig?.isChoiceEligible !== 'function' ||
            activeConfig.isChoiceEligible(
              selectedChoiceKey,
              selectedOling,
              selectedIndex
            ))
        );
      if (elements.confirm) {
        elements.confirm.disabled =
          selectedIndex === null || !selectedChoiceIsEligible;
        const selectedChoice = activeConfig?.choiceOptions?.find(
          (choice) => choice.key === selectedChoiceKey
        );
        elements.confirm.textContent =
          (selectedChoice &&
            activeConfig?.getConfirmLabel?.(selectedChoice)) ||
          activeConfig?.confirmLabel ||
          'CONFIRM';
      }
    }

    function select(root, index) {
      const button = getElements(root).options?.querySelector(
        `[data-clash-picker-option][data-team-slot="${Number(index)}"]`
      );
      if (!button || button.disabled) return null;
      selectedIndex = selectedIndex === Number(index) ? null : Number(index);
      if (
        selectedChoiceKey &&
        selectedIndex !== null &&
        typeof activeConfig?.isChoiceEligible === 'function' &&
        !activeConfig.isChoiceEligible(
          selectedChoiceKey,
          activeConfig.olings[selectedIndex],
          selectedIndex
        )
      ) {
        selectedChoiceKey = null;
      }
      if (selectedIndex !== null && activeConfig?.choiceOptions?.length) {
        const selectedOling = activeConfig.olings[selectedIndex];
        const eligibleChoices = activeConfig.choiceOptions.filter(
          (choice) =>
            typeof activeConfig.isChoiceEligible !== 'function' ||
            activeConfig.isChoiceEligible(
              choice.key,
              selectedOling,
              selectedIndex
            )
        );
        if (eligibleChoices.length === 1) {
          selectedChoiceKey = eligibleChoices[0].key;
        }
      }
      renderSelection(root);
      activeConfig?.onSelect?.(selectedIndex);
      return selectedIndex;
    }

    function selectChoice(root, choiceKey) {
      const button = getElements(root).choices?.querySelector(
        `[data-clash-picker-choice][data-choice-key="${String(choiceKey)}"]`
      );
      if (!button || button.disabled) return null;
      selectedChoiceKey = button.dataset.choiceKey;
      renderSelection(root);
      activeConfig?.onChoiceSelect?.(selectedChoiceKey);
      return selectedChoiceKey;
    }

    function close(root, { cancelled = false } = {}) {
      const { container } = getElements(root);
      if (!container) return;
      container.hidden = true;
      container.setAttribute('aria-hidden', 'true');
      if (cancelled) activeConfig?.onCancel?.();
      activeConfig = null;
      selectedIndex = null;
      selectedChoiceKey = null;
    }

    function confirm(root) {
      if (!activeConfig || selectedIndex === null) return false;
      if (
        activeConfig.choiceOptions?.length &&
        (!selectedChoiceKey ||
          (typeof activeConfig.isChoiceEligible === 'function' &&
            !activeConfig.isChoiceEligible(
              selectedChoiceKey,
              activeConfig.olings[selectedIndex],
              selectedIndex
            )))
      ) {
        return false;
      }
      const config = activeConfig;
      const confirmedIndex = selectedIndex;
      const confirmedChoiceKey = selectedChoiceKey;
      close(root);
      config.onConfirm?.(
        confirmedIndex,
        config.olings[confirmedIndex],
        confirmedChoiceKey
      );
      return true;
    }

    function renderChoices(root) {
      const { choices } = getElements(root);
      if (!choices) return;
      const choiceOptions = activeConfig?.choiceOptions || [];
      const usesEffectPresentation =
        choiceOptions.length > 0 &&
        choiceOptions.every((choice) => choice.presentation === 'effect');
      const documentRef = choices.ownerDocument || globalScope.document;
      const fragment = documentRef.createDocumentFragment();
      choiceOptions.forEach((choice) => {
        const button = documentRef.createElement('button');
        button.className = 'olings-clash-picker-choice';
        button.type = 'button';
        button.dataset.clashPickerChoice = '';
        button.dataset.choiceKey = choice.key;
        button.setAttribute('role', 'radio');
        button.setAttribute('aria-checked', 'false');
        button.setAttribute(
          'aria-label',
          [choice.label, choice.meta].filter(Boolean).join(', ')
        );
        if (choice.presentation === 'ability') {
          button.classList.add('is-ability-choice');
          const label = documentRef.createElement('strong');
          const meta = documentRef.createElement('span');
          if (choice.imagePath) {
            const image = documentRef.createElement('img');
            image.src = choice.imagePath;
            image.alt = '';
            image.setAttribute('aria-hidden', 'true');
            button.append(image);
          } else {
            button.classList.add('has-no-image');
          }
          label.textContent = choice.label;
          meta.textContent = choice.meta || '';
          button.append(label, meta);
        } else if (choice.presentation === 'effect') {
          button.classList.add('is-effect-choice');
          const imagePath =
            choice.imagePath ||
            effectRenderer?.resolveIconPath?.({ key: choice.statusKey });
          if (imagePath) {
            const image = documentRef.createElement('img');
            image.className = 'olings-clash-effect__icon';
            image.src = imagePath;
            image.alt = '';
            image.draggable = false;
            image.setAttribute('aria-hidden', 'true');
            button.append(image);
          } else {
            button.classList.add('has-no-image');
          }
          const label = documentRef.createElement('strong');
          label.textContent = choice.label;
          button.append(label);
          button.title = choice.label;
        } else {
          button.textContent = choice.label;
        }
        button.addEventListener('click', () => selectChoice(root, choice.key));
        fragment.append(button);
      });
      choices.replaceChildren(fragment);
      choices.hidden = choiceOptions.length === 0;
      choices.classList.toggle('is-effect-row', usesEffectPresentation);
      choices.classList.toggle(
        'is-icon-only',
        usesEffectPresentation && choiceOptions.length > 3
      );
      if (usesEffectPresentation) {
        choices.style.setProperty(
          '--clash-picker-choice-count',
          String(choiceOptions.length)
        );
      } else {
        choices.style.removeProperty('--clash-picker-choice-count');
      }
    }

    function createOption(documentRef, oling, index, isEligible) {
      const button = documentRef.createElement('button');
      button.className = 'olings-clash-picker-option';
      button.type = 'button';
      button.dataset.clashPickerOption = '';
      button.dataset.teamSlot = String(index);
      button.disabled = !isEligible;
      button.setAttribute('aria-pressed', 'false');
      button.setAttribute(
        'aria-label',
        `${oling.name}${isEligible ? '' : ', unavailable'}`
      );
      button.innerHTML = `
        <span class="olings-clash-picker-option__art" aria-hidden="true">
          <span class="olings-clash-oling-art">
            <img class="olings-clash-oling-layer is-flight" data-picker-part="flight" alt="">
            <img class="olings-clash-oling-layer is-body" data-picker-part="body" alt="">
            <img class="olings-clash-oling-layer is-eyes" data-picker-part="eyes" alt="">
            <img class="olings-clash-oling-layer is-mouth" data-picker-part="mouth" alt="">
          </span>
        </span>
        <strong></strong>
        <span class="olings-clash-health olings-clash-picker-option__health" data-clash-health></span>
      `;
      button.querySelector('strong').textContent = oling.name;
      renderArt(button, oling.parts, {
        defeated: Number(oling.health?.heartUnits) <= 0
      });
      healthRenderer?.renderHealth(
        button.querySelector('[data-clash-health]'),
        oling.health
      );
      return button;
    }

    function open(root, config = {}) {
      const elements = getElements(root);
      if (!elements.container || !elements.options) return null;
      const mode = config.mode || 'friendly-target';
      const defaults =
        defaultModeSettings[mode] || defaultModeSettings['friendly-target'];
      const olings = Array.isArray(config.olings) ? config.olings : [];
      const isEligible =
        typeof config.isEligible === 'function'
          ? config.isEligible
          : (oling) => oling.health.heartUnits > 0;
      const documentRef =
        elements.container.ownerDocument || globalScope.document;
      const fragment = documentRef.createDocumentFragment();

      activeConfig = { ...defaults, ...config, mode, olings };
      selectedIndex = Number.isInteger(config.selectedIndex)
        ? config.selectedIndex
        : null;
      selectedChoiceKey = config.selectedChoiceKey || null;
      olings.forEach((oling, index) => {
        const option = createOption(
          documentRef,
          oling,
          index,
          Boolean(isEligible(oling, index))
        );
        option.addEventListener('click', () => select(root, index));
        fragment.append(option);
      });

      elements.options.replaceChildren(fragment);
      elements.options.hidden = Boolean(activeConfig.hideOlingOptions);
      renderChoices(root);
      elements.container.hidden = false;
      elements.container.dataset.pickerMode = mode;
      elements.container.dataset.pickerSide = activeConfig.side;
      elements.container.setAttribute('aria-hidden', 'false');
      elements.container.setAttribute('aria-label', activeConfig.title);
      if (elements.title) elements.title.textContent = activeConfig.title;
      if (elements.description) {
        elements.description.textContent = activeConfig.description || '';
        elements.description.hidden = !activeConfig.description;
      }
      if (elements.confirm) elements.confirm.onclick = () => confirm(root);
      renderSelection(root);
      return activeConfig;
    }

    return {
      close,
      canCancel: () => Boolean(activeConfig?.canCancel),
      confirm,
      defaultModeSettings,
      getSelectedIndex: () => selectedIndex,
      getSelectedChoiceKey: () => selectedChoiceKey,
      isOpen: () => Boolean(activeConfig),
      open,
      select,
      selectChoice
    };
  }

  globalScope.createOlingClashPicker = createOlingClashPicker;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = createOlingClashPicker;
  }
})(typeof window !== 'undefined' ? window : globalThis);
