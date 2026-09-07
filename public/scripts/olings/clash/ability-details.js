(function (globalScope) {
  const catalogUrl = '/json-files/olings/clash-abilities.json';
  const actionDefinitions = Object.freeze({
    mouth: Object.freeze({ action: 'attack', label: 'ATTACK', part: 'MOUTH' }),
    body: Object.freeze({ action: 'guard', label: 'GUARD', part: 'BODY' }),
    flight: Object.freeze({ action: 'skill', label: 'SKILL', part: 'WINGS' }),
    eyes: Object.freeze({ action: 'draw', label: 'DRAW', part: 'EYES' })
  });
  const descriptionHealthAssets = Object.freeze({
    blood: Object.freeze({
      full: '/images/olings/clash/ui/health/hearts/blood/full.svg',
      half: '/images/olings/clash/ui/health/hearts/blood/half.svg'
    }),
    hearts: Object.freeze({
      full: '/images/olings/clash/ui/health/hearts/normal/full.svg',
      half: '/images/olings/clash/ui/health/hearts/normal/half.svg'
    }),
    overgrowth: Object.freeze({
      full: '/images/olings/clash/ui/health/hearts/overgrowth/full.svg',
      half: '/images/olings/clash/ui/health/hearts/overgrowth/half.svg'
    }),
    shields: Object.freeze({
      full: '/images/olings/clash/ui/health/shields/default.svg'
    })
  });
  const descriptionTokenPattern =
    /1\/2|Normal Hearts?|Blood Hearts?|Overgrowth Hearts?|Blood|Overgrowth|Hearts?|Shields?|Tags?|Burn|Suppress(?:ed)?|Block(?:ed)?|Mark(?:ed)?|Ward(?:ed)?|Steal|Junk/gi;
  const iconGlossary = Object.freeze({
    heart: Object.freeze({
      category: 'health',
      key: 'heart',
      label: 'Heart',
      description:
        "An Oling's normal health. A full Heart contains two half-heart units, and the Oling is defeated when none remain.",
      paths: descriptionHealthAssets.hearts
    }),
    'blood-heart': Object.freeze({
      category: 'health',
      key: 'blood-heart',
      label: 'Blood Heart',
      description:
        'Stored health used by Vampire abilities. Blood can be held, transferred, recovered, or converted into a permanent Heart.',
      paths: descriptionHealthAssets.blood
    }),
    'overgrowth-heart': Object.freeze({
      category: 'health',
      key: 'overgrowth-heart',
      label: 'Overgrowth Heart',
      description:
        'Extra health created by growth abilities. Incoming damage removes Overgrowth before normal Hearts.',
      paths: descriptionHealthAssets.overgrowth
    }),
    shield: Object.freeze({
      category: 'health',
      key: 'shield',
      label: 'Shield',
      description:
        'A protective layer that absorbs incoming damage before Overgrowth and normal Hearts.',
      path: descriptionHealthAssets.shields.full
    }),
    tag: Object.freeze({
      category: 'actions',
      key: 'tag',
      label: 'Tag',
      description:
        'Switch the active Oling with an available benched teammate after the current Clash resolves.',
      path: '/images/olings/clash/ui/actions/tag.svg'
    }),
    passive: Object.freeze({
      category: 'actions',
      key: 'passive',
      label: 'Passive',
      description:
        'Marks a Draw ability that activates automatically when its trigger is met. It is not selected like Attack, Guard, or Skill.',
      path: '/images/olings/clash/ui/icons/passive.svg'
    }),
    locked: Object.freeze({
      category: 'actions',
      key: 'locked',
      label: 'Locked Action',
      description:
        'Shows that an Action cannot currently be selected because an active effect is preventing it.',
      path: '/images/olings/clash/ui/icons/padlock.svg'
    }),
    bloodbound: Object.freeze({
      category: 'positive',
      key: 'bloodbound',
      label: 'Bloodbound',
      description:
        'Blood from Reclaim is waiting. The Oling recovers it after its next decisive victory and loses it after its next decisive loss.',
      path: '/images/olings/clash/ui/effects/bloodbound.svg'
    }),
    'burn-primed': Object.freeze({
      category: 'positive',
      key: 'burn-primed',
      label: 'Burn Primed',
      description:
        'The next matching Attack victory consumes this effect and applies Burn to the opponent.',
      path: '/images/olings/clash/ui/effects/burn-primed.svg'
    }),
    fortified: Object.freeze({
      category: 'positive',
      key: 'fortified',
      label: 'Fortified',
      description:
        'Fortify is protecting this Oling from the next effect that would deal bonus damage.',
      path: '/images/olings/clash/ui/effects/fortified.svg'
    }),
    reinforced: Object.freeze({
      category: 'positive',
      key: 'reinforced',
      label: 'Reinforced',
      description:
        'Reinforce is protecting a chosen Part from being disabled once.',
      path: '/images/olings/clash/ui/effects/reinforced.svg'
    }),
    warded: Object.freeze({
      category: 'positive',
      key: 'warded',
      label: 'Warded',
      description:
        'Prevents one specified matching effect, then removes the Ward.',
      path: '/images/olings/clash/ui/effects/warded.svg'
    }),
    burn: Object.freeze({
      category: 'negative',
      key: 'burn',
      label: 'Burn',
      description:
        "After this Oling's next decisive Clash, it takes one half Heart of normal damage.",
      path: '/images/olings/clash/ui/effects/burn.svg'
    }),
    blocked: Object.freeze({
      category: 'negative',
      key: 'blocked',
      label: 'Blocked',
      description:
        'Prevents effects in one specified category during its active round.',
      path: '/images/olings/clash/ui/effects/blocked.svg'
    }),
    suppressed: Object.freeze({
      category: 'negative',
      key: 'suppressed',
      label: 'Suppressed',
      description:
        "Prevents the affected Part's next valid effect activation, then removes Suppressed.",
      path: '/images/olings/clash/ui/effects/suppressed.svg'
    }),
    marked: Object.freeze({
      category: 'negative',
      key: 'marked',
      label: 'Marked',
      description:
        'Records an Action, Part, Oling, or event so another effect can respond to it later.',
      path: '/images/olings/clash/ui/effects/marked.svg'
    }),
    'steal-primed': Object.freeze({
      category: 'negative',
      key: 'steal-primed',
      label: 'Steal Primed',
      description:
        "The opponent's recorded Part is being watched. If it activates again in time, its qualifying positive effect is stolen.",
      path: '/images/olings/clash/ui/effects/steal-primed.svg'
    }),
    junk: Object.freeze({
      category: 'negative',
      key: 'junk',
      label: 'Junk',
      description:
        'Replaces the next valid Part effect activation with Junk, then removes this status.',
      path: '/images/olings/clash/ui/effects/junk.svg'
    })
  });
  const symbolCategories = Object.freeze([
    Object.freeze({
      key: 'health',
      label: 'Health & Defence'
    }),
    Object.freeze({
      key: 'actions',
      label: 'Actions & States'
    }),
    Object.freeze({
      key: 'positive',
      label: 'Positive Effects'
    }),
    Object.freeze({
      key: 'negative',
      label: 'Negative Effects'
    })
  ]);
  const descriptionEffectGlossaryKeys = Object.freeze({
    block: 'blocked',
    blocked: 'blocked',
    burn: 'burn',
    junk: 'junk',
    mark: 'marked',
    marked: 'marked',
    suppress: 'suppressed',
    suppressed: 'suppressed',
    steal: 'steal-primed',
    ward: 'warded',
    warded: 'warded'
  });
  let catalogPromise = null;
  let activeDialog = null;

  function formatTitle(value, fallback = 'None') {
    const text = String(value || '')
      .replace(/[-_]+/g, ' ')
      .trim();
    if (!text) return fallback;
    return text.replace(/\b\w/g, (character) => character.toUpperCase());
  }

  function normalizeAbilities(abilities = []) {
    return abilities.filter(
      (ability) =>
        ability?.key && ability.enabled !== false && ability.isCurrent !== false
    );
  }

  async function loadCatalog(url = catalogUrl) {
    if (!catalogPromise || url !== catalogUrl) {
      catalogPromise = globalScope
        .fetch(url, {
          credentials: 'same-origin',
          headers: { Accept: 'application/json' }
        })
        .then((response) => {
          if (!response?.ok) throw new Error('Unable to load Clash abilities.');
          return response.json();
        })
        .then((payload) => normalizeAbilities(payload?.abilities || []))
        .catch((error) => {
          catalogPromise = null;
          throw error;
        });
    }
    return catalogPromise;
  }

  function getActionDefinition(ability) {
    return (
      actionDefinitions[String(ability?.layer || '').toLowerCase()] || {
        action: 'ability',
        label: 'ABILITY',
        part: formatTitle(ability?.layer, 'TRAIT').toUpperCase()
      }
    );
  }

  function getTraitImagePath(ability) {
    if (ability?.traitImagePath) return ability.traitImagePath;
    const layer = String(ability?.layer || '').toLowerCase();
    const traitKey = String(ability?.traitKey || '').toLowerCase();
    if (!layer || !traitKey) return '';
    const filename =
      layer === 'flight' && traitKey === 'trash-balloons'
        ? 'balloons'
        : traitKey;
    return `/images/olings/builds/${layer}/base/${filename}.svg`;
  }

  function createElement(documentRef, tagName, className, textContent = '') {
    const element = documentRef.createElement(tagName);
    if (className) element.className = className;
    if (textContent) element.textContent = textContent;
    return element;
  }

  function getDescriptionToken(value, useHalfAsset = false) {
    const normalizedValue = String(value || '').toLowerCase();
    if (/^overgrowth(?: hearts?)?$/.test(normalizedValue)) {
      const definition = iconGlossary['overgrowth-heart'];
      return {
        ...definition,
        path: definition.paths[useHalfAsset ? 'half' : 'full']
      };
    }
    if (/^blood hearts?$/.test(normalizedValue)) {
      const definition = iconGlossary['blood-heart'];
      return {
        ...definition,
        path: definition.paths[useHalfAsset ? 'half' : 'full']
      };
    }
    if (normalizedValue === 'blood') {
      const definition = iconGlossary['blood-heart'];
      return { ...definition, path: definition.paths.full };
    }
    if (/^(?:normal )?hearts?$/.test(normalizedValue)) {
      const definition = iconGlossary.heart;
      return {
        ...definition,
        path: definition.paths[useHalfAsset ? 'half' : 'full']
      };
    }
    if (/^shields?$/.test(normalizedValue)) {
      return iconGlossary.shield;
    }
    if (/^tags?$/.test(normalizedValue)) {
      return iconGlossary.tag;
    }

    const glossaryKey = descriptionEffectGlossaryKeys[normalizedValue];
    return glossaryKey ? iconGlossary[glossaryKey] : null;
  }

  function createDescriptionFraction(documentRef) {
    const fraction = createElement(
      documentRef,
      'span',
      'oling-clash-ability-dialog__fraction'
    );
    const numerator = documentRef.createElement('sup');
    const denominator = documentRef.createElement('sub');
    fraction.setAttribute('aria-label', 'one half');
    numerator.textContent = '1';
    denominator.textContent = '2';
    numerator.setAttribute('aria-hidden', 'true');
    denominator.setAttribute('aria-hidden', 'true');
    fraction.append(numerator, '/', denominator);
    return fraction;
  }

  function renderDescription(container, description, { onTokenSelect } = {}) {
    const source = String(
      description || 'Ability details are not available yet.'
    );
    const documentRef = container.ownerDocument || globalScope.document;
    const fragment = documentRef.createDocumentFragment();
    let pendingHalf = false;
    let previousIndex = 0;

    source.replace(descriptionTokenPattern, (value, matchIndex) => {
      const precedingText = source.slice(previousIndex, matchIndex);
      if (pendingHalf && /\S/.test(precedingText)) pendingHalf = false;
      fragment.append(precedingText);

      if (value === '1/2') {
        fragment.append(createDescriptionFraction(documentRef));
        pendingHalf = true;
      } else {
        const token = getDescriptionToken(value, pendingHalf);
        if (token) {
          const iconButton = createElement(
            documentRef,
            'button',
            'oling-clash-ability-dialog__inline-icon-button'
          );
          const icon = createElement(
            documentRef,
            'img',
            'oling-clash-ability-dialog__inline-icon'
          );
          iconButton.type = 'button';
          iconButton.dataset.clashIconKey = token.key;
          iconButton.dataset.pressFeedback = 'none';
          iconButton.setAttribute('aria-label', `Learn about ${token.label}`);
          iconButton.title = token.label;
          icon.src = token.path;
          icon.alt = '';
          icon.draggable = false;
          icon.setAttribute('aria-hidden', 'true');
          iconButton.append(icon);
          iconButton.addEventListener('click', () => onTokenSelect?.(token));
          fragment.append(iconButton);
        } else {
          fragment.append(value);
        }
        pendingHalf = false;
      }
      previousIndex = matchIndex + value.length;
      return value;
    });
    fragment.append(source.slice(previousIndex));
    container.replaceChildren(fragment);
  }

  function renderAbilityDetail(ability) {
    if (!activeDialog) return;
    const { elements } = activeDialog;
    activeDialog.detailMode = 'ability';
    elements.detail.dataset.detailMode = 'ability';
    elements.detailArt.src = ability.imagePath || '';
    elements.detailArt.alt = `${ability.name || 'Ability'} artwork`;
    elements.detailArt.hidden = !ability.imagePath;
    elements.detailTitle.textContent = 'ABILITY DESCRIPTION';
    elements.detailBack.hidden = true;
    renderDescription(elements.description, ability.description, {
      onTokenSelect: renderIconDetail
    });
  }

  function renderIconDetail(token) {
    if (!activeDialog || !token) return;
    const { elements } = activeDialog;
    activeDialog.detailMode = 'icon';
    activeDialog.selectedIconKey = token.key;
    elements.detail.dataset.detailMode = 'icon';
    elements.detailArt.src = token.path || '';
    elements.detailArt.alt = `${token.label} icon`;
    elements.detailArt.hidden = !token.path;
    elements.detailTitle.textContent = token.label;
    elements.description.textContent = token.description;
    elements.detailBack.hidden = false;
    elements.detailBack.focus();
  }

  function close({ restoreFocus = true } = {}) {
    if (!activeDialog) return false;
    const { backdrop, handleKeydown, returnFocus } = activeDialog;
    document.removeEventListener('keydown', handleKeydown, true);
    backdrop.remove();
    document.documentElement.classList.remove('is-clash-ability-dialog-open');
    activeDialog = null;
    if (restoreFocus) returnFocus?.focus?.();
    return true;
  }

  function renderDialogAbility(index) {
    if (!activeDialog) return;
    const { abilities, elements } = activeDialog;
    const nextIndex = (index + abilities.length) % abilities.length;
    const ability = abilities[nextIndex];
    const definition = getActionDefinition(ability);
    activeDialog.index = nextIndex;

    elements.title.textContent = ability.name || 'ABILITY';
    elements.abilityArt.src = ability.imagePath || '';
    elements.abilityArt.hidden = !ability.imagePath;
    elements.abilityArt.alt = `${ability.name || 'Ability'} artwork`;
    const traitImagePath = getTraitImagePath(ability);
    elements.traitArt.src = traitImagePath;
    elements.traitArt.hidden = !traitImagePath;
    elements.traitArt.alt = `${definition.part} Oling part`;
    elements.meta.textContent = `${definition.label} • ${definition.part}`;
    activeDialog.selectedIconKey = '';
    renderAbilityDetail(ability);
    elements.position.textContent = `${nextIndex + 1}/${abilities.length}`;
    elements.dialog.setAttribute(
      'aria-label',
      `${ability.name || 'Clash ability'} details`
    );
  }

  function open({ abilities = [], initialAbilityKey = '', returnFocus } = {}) {
    const availableAbilities = normalizeAbilities(abilities);
    if (!availableAbilities.length) return null;
    close({ restoreFocus: false });

    const documentRef = globalScope.document;
    const backdrop = createElement(
      documentRef,
      'div',
      'oling-clash-ability-dialog-backdrop'
    );
    const shell = createElement(
      documentRef,
      'div',
      'oling-clash-ability-dialog-shell'
    );
    const dialog = createElement(
      documentRef,
      'section',
      'oling-clash-ability-dialog'
    );
    const header = createElement(
      documentRef,
      'header',
      'oling-clash-ability-dialog__header'
    );
    const heading = createElement(
      documentRef,
      'div',
      'oling-clash-ability-dialog__heading'
    );
    const title = createElement(documentRef, 'h2', '', 'ABILITY');
    const meta = createElement(
      documentRef,
      'p',
      'oling-clash-ability-dialog__meta'
    );
    const artwork = createElement(
      documentRef,
      'div',
      'oling-clash-ability-dialog__artwork'
    );
    const abilityArtFrame = createElement(
      documentRef,
      'div',
      'oling-clash-ability-dialog__artwork-frame'
    );
    const traitArtFrame = createElement(
      documentRef,
      'div',
      'oling-clash-ability-dialog__artwork-frame'
    );
    const abilityArt = createElement(
      documentRef,
      'img',
      'oling-clash-ability-dialog__art'
    );
    const traitArt = createElement(
      documentRef,
      'img',
      'oling-clash-ability-dialog__art'
    );
    const detail = createElement(
      documentRef,
      'section',
      'oling-clash-ability-dialog__detail'
    );
    const detailHeader = createElement(
      documentRef,
      'div',
      'oling-clash-ability-dialog__detail-header'
    );
    const detailArt = createElement(
      documentRef,
      'img',
      'oling-clash-ability-dialog__detail-art'
    );
    const detailTitle = createElement(
      documentRef,
      'h3',
      'oling-clash-ability-dialog__detail-title'
    );
    const description = createElement(
      documentRef,
      'p',
      'oling-clash-ability-dialog__description'
    );
    const descriptionCopy = createElement(
      documentRef,
      'span',
      'oling-clash-ability-dialog__description-copy'
    );
    const detailBack = createElement(
      documentRef,
      'button',
      'oling-clash-ability-dialog__detail-back'
    );
    const previous = createElement(
      documentRef,
      'button',
      'oling-clash-ability-dialog__rail is-previous'
    );
    const previousLabel = createElement(documentRef, 'span', '', 'Previous');
    const position = createElement(
      documentRef,
      'strong',
      'oling-clash-ability-dialog__position'
    );
    const next = createElement(
      documentRef,
      'button',
      'oling-clash-ability-dialog__rail is-next'
    );
    const nextLabel = createElement(documentRef, 'span', '', 'Next');

    abilityArt.alt = '';
    traitArt.alt = '';
    detailArt.alt = '';
    descriptionCopy.setAttribute('aria-live', 'polite');
    detailBack.type = 'button';
    detailBack.setAttribute('aria-label', 'Back to ability description');
    detailBack.dataset.pressFeedback = 'none';
    detailBack.hidden = true;
    previous.type = 'button';
    previous.setAttribute('aria-label', 'Previous ability');
    previous.dataset.pressFeedback = 'none';
    next.type = 'button';
    next.setAttribute('aria-label', 'Next ability');
    next.dataset.pressFeedback = 'none';
    dialog.tabIndex = -1;
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    backdrop.dataset.clashAbilityDetails = '';

    heading.append(title, meta);
    header.append(heading);
    abilityArtFrame.append(abilityArt);
    traitArtFrame.append(traitArt);
    artwork.append(abilityArtFrame, traitArtFrame);
    description.append(descriptionCopy);
    detailHeader.append(detailBack, detailTitle, detailArt);
    detail.append(detailHeader, description);
    previous.append(previousLabel);
    next.append(nextLabel);
    dialog.append(header, artwork, detail, position);
    shell.append(previous, dialog, next);
    backdrop.append(shell);
    documentRef.body.append(backdrop);

    const focusableElements = () => [
      previous,
      ...dialog.querySelectorAll('button:not([hidden])'),
      next
    ];
    const handleKeydown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        close();
        return;
      }
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        renderDialogAbility(activeDialog.index - 1);
        return;
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        renderDialogAbility(activeDialog.index + 1);
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = focusableElements();
      const first = focusable[0];
      const last = focusable.at(-1);
      if (!focusable.includes(documentRef.activeElement)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && documentRef.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && documentRef.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    activeDialog = {
      abilities: availableAbilities,
      backdrop,
      elements: {
        abilityArt,
        detail,
        detailArt,
        detailBack,
        detailTitle,
        description: descriptionCopy,
        dialog,
        meta,
        position,
        title,
        traitArt
      },
      handleKeydown,
      index: 0,
      selectedIconKey: '',
      returnFocus
    };
    const initialIndex = Math.max(
      0,
      availableAbilities.findIndex(
        (ability) => ability.key === initialAbilityKey
      )
    );
    renderDialogAbility(initialIndex);

    previous.addEventListener('click', () =>
      renderDialogAbility(activeDialog.index - 1)
    );
    next.addEventListener('click', () =>
      renderDialogAbility(activeDialog.index + 1)
    );
    detailBack.addEventListener('click', () => {
      if (!activeDialog) return;
      const iconKey = activeDialog.selectedIconKey;
      renderAbilityDetail(activeDialog.abilities[activeDialog.index]);
      activeDialog.elements.description
        .querySelector(`[data-clash-icon-key="${iconKey}"]`)
        ?.focus();
    });
    backdrop.addEventListener('click', (event) => {
      if (event.target === backdrop) close();
    });
    documentRef.addEventListener('keydown', handleKeydown, true);
    documentRef.documentElement.classList.add('is-clash-ability-dialog-open');
    dialog.focus();
    return dialog;
  }

  function createLibraryCard(documentRef, ability, abilities) {
    const definition = getActionDefinition(ability);
    const card = createElement(
      documentRef,
      'button',
      'oling-clash-ability-library__card'
    );
    const icon = createElement(
      documentRef,
      'img',
      'oling-clash-ability-library__icon'
    );
    const copy = createElement(
      documentRef,
      'span',
      'oling-clash-ability-library__copy'
    );
    const name = createElement(
      documentRef,
      'strong',
      '',
      ability.name || 'ABILITY'
    );
    const meta = createElement(
      documentRef,
      'small',
      '',
      `${definition.label} • ${definition.part}`
    );
    card.type = 'button';
    card.dataset.clashAbilityLibraryKey = ability.key;
    card.setAttribute('aria-label', `View ${ability.name} ability details`);
    icon.src = ability.imagePath || '';
    icon.alt = '';
    copy.append(name, meta);
    card.append(icon, copy);
    card.addEventListener('click', () =>
      open({ abilities, initialAbilityKey: ability.key, returnFocus: card })
    );
    return card;
  }

  async function mountLibrary(container, { abilities } = {}) {
    if (!container) return null;
    const availableAbilities = normalizeAbilities(
      abilities || (await loadCatalog())
    );
    const documentRef = container.ownerDocument || globalScope.document;
    const filters = createElement(
      documentRef,
      'div',
      'oling-clash-ability-library__filters'
    );
    const grid = createElement(
      documentRef,
      'div',
      'oling-clash-ability-library__grid'
    );
    const filterDefinitions = [
      ['all', 'ALL'],
      ['attack', 'ATTACK'],
      ['guard', 'GUARD'],
      ['skill', 'SKILL'],
      ['draw', 'DRAW']
    ];

    function renderCards(filter = 'all') {
      const filteredAbilities = availableAbilities.filter((ability) => {
        const action = getActionDefinition(ability).action;
        return filter === 'all' || action === filter;
      });
      grid.replaceChildren(
        ...filteredAbilities.map((ability) =>
          createLibraryCard(documentRef, ability, filteredAbilities)
        )
      );
    }

    filterDefinitions.forEach(([key, label], index) => {
      const button = createElement(documentRef, 'button', '', label);
      button.type = 'button';
      button.dataset.clashAbilityFilter = key;
      button.setAttribute('aria-pressed', String(index === 0));
      button.addEventListener('click', () => {
        filters.querySelectorAll('button').forEach((filterButton) => {
          filterButton.setAttribute(
            'aria-pressed',
            String(filterButton === button)
          );
        });
        renderCards(key);
      });
      filters.append(button);
    });

    container.classList.add('oling-clash-ability-library');
    container.replaceChildren(filters, grid);
    renderCards();
    return { abilities: availableAbilities, filters, grid };
  }

  function getSymbolPaths(definition) {
    return [definition.path, ...Object.values(definition.paths || {})].filter(
      (path, index, paths) => path && paths.indexOf(path) === index
    );
  }

  function createSymbolVisual(documentRef, definition, className) {
    const visual = createElement(documentRef, 'span', className);
    getSymbolPaths(definition).forEach((path) => {
      const icon = createElement(
        documentRef,
        'img',
        'oling-clash-icon-library__icon'
      );
      icon.src = path;
      icon.alt = '';
      icon.draggable = false;
      icon.setAttribute('aria-hidden', 'true');
      visual.append(icon);
    });
    return visual;
  }

  function createIconGlossaryCard(documentRef, definition, onSelect) {
    const card = createElement(
      documentRef,
      'button',
      'oling-clash-icon-library__card'
    );
    const visual = createSymbolVisual(
      documentRef,
      definition,
      'oling-clash-icon-library__visual'
    );
    const title = createElement(documentRef, 'strong', '', definition.label);
    card.type = 'button';
    card.dataset.clashIconGlossaryKey = definition.key;
    card.setAttribute('aria-label', `Learn about ${definition.label}`);
    card.append(visual, title);
    card.addEventListener('click', () => onSelect?.(definition));
    return card;
  }

  function mountSymbolGlossary(container) {
    if (!container) return null;
    const documentRef = container.ownerDocument || globalScope.document;
    const definitions = Object.values(iconGlossary);

    function renderCategories() {
      const categories = createElement(
        documentRef,
        'ul',
        'help-hub-section-list oling-clash-symbol-library__categories'
      );
      symbolCategories.forEach((category) => {
        const item = documentRef.createElement('li');
        const button = createElement(
          documentRef,
          'button',
          'help-hub-section-button',
          category.label
        );
        button.type = 'button';
        button.dataset.clashSymbolCategory = category.key;
        button.addEventListener('click', () => renderCategory(category.key));
        item.append(button);
        categories.append(item);
      });
      container.dataset.clashSymbolView = 'categories';
      delete container.dataset.clashSymbolCategory;
      container.replaceChildren(categories);
    }

    function renderCategory(categoryKey) {
      const category = symbolCategories.find(
        (entry) => entry.key === categoryKey
      );
      if (!category) return renderCategories();
      const categoryDefinitions = definitions.filter(
        (definition) => definition.category === category.key
      );
      const grid = createElement(
        documentRef,
        'div',
        'oling-clash-icon-library__grid'
      );
      grid.replaceChildren(
        ...categoryDefinitions.map((definition) =>
          createIconGlossaryCard(documentRef, definition, () =>
            renderDefinition(category.key, definition)
          )
        )
      );
      container.dataset.clashSymbolView = 'category';
      container.dataset.clashSymbolCategory = category.key;
      container.replaceChildren(grid);
      grid.querySelector('button')?.focus();
    }

    function renderDefinition(categoryKey, definition) {
      const detail = createElement(
        documentRef,
        'article',
        'oling-clash-symbol-library__detail'
      );
      const visual = createElement(
        documentRef,
        'div',
        'oling-clash-symbol-library__detail-visual'
      );
      const artwork = createSymbolVisual(
        documentRef,
        definition,
        'oling-clash-symbol-library__detail-artwork'
      );
      const label = createElement(
        documentRef,
        'strong',
        'oling-clash-symbol-library__detail-label',
        definition.label
      );
      const description = createElement(
        documentRef,
        'p',
        '',
        definition.description
      );
      visual.append(artwork, label);
      detail.dataset.clashSymbolDetail = definition.key;
      detail.dataset.clashSymbolCategory = categoryKey;
      detail.append(visual, description);
      container.dataset.clashSymbolView = 'detail';
      container.dataset.clashSymbolCategory = categoryKey;
      container.replaceChildren(detail);
    }

    container.classList.add(
      'oling-clash-icon-library',
      'oling-clash-symbol-library'
    );
    renderCategories();
    return {
      categories: symbolCategories,
      definitions,
      goBack() {
        if (container.dataset.clashSymbolView === 'detail') {
          renderCategory(container.dataset.clashSymbolCategory);
          return true;
        }
        if (container.dataset.clashSymbolView === 'category') {
          renderCategories();
          return true;
        }
        return false;
      },
      renderCategories,
      renderCategory
    };
  }

  const mountIconGlossary = mountSymbolGlossary;

  globalScope.OlingClashAbilityDetails = Object.freeze({
    close,
    getActionDefinition,
    getIconGlossary: () => Object.values(iconGlossary),
    getSymbolCategories: () => symbolCategories,
    getSymbolGlossary: () => Object.values(iconGlossary),
    isOpen: () => Boolean(activeDialog),
    loadCatalog,
    mountIconGlossary,
    mountLibrary,
    mountSymbolGlossary,
    open
  });

  globalScope.SetScriptLoaded?.('/scripts/olings/clash/ability-details.js');
})(typeof window !== 'undefined' ? window : globalThis);
