(function (globalScope) {
  const partDefinitions = Object.freeze([
    Object.freeze({ action: 'attack', key: 'mouth', label: 'MOUTH' }),
    Object.freeze({ action: 'guard', key: 'body', label: 'BODY' }),
    Object.freeze({ action: 'skill', key: 'flight', label: 'WINGS' }),
    Object.freeze({ action: 'draw', key: 'eyes', label: 'EYES' })
  ]);
  const actionParts = Object.freeze({
    attack: 'mouth',
    draw: 'eyes',
    guard: 'body',
    skill: 'flight'
  });
  const abilityStateIcons = Object.freeze({
    disabled: '/images/olings/clash/ui/effects/suppressed.svg',
    inactive: '/images/olings/clash/ui/icons/padlock.svg',
    primed: '/images/olings/clash/ui/icons/passive.svg',
    protected: '/images/olings/clash/ui/effects/warded.svg'
  });

  function formatTitle(value) {
    return String(value || '')
      .replace(/[-_]+/g, ' ')
      .replace(/\b\w/g, (character) => character.toUpperCase());
  }

  function getTraitKey(partSource) {
    const filename = String(partSource || '')
      .split('/')
      .pop()
      ?.replace(/\.[^.]+$/, '');
    return filename || '';
  }

  function getBuildPrefix(oling) {
    return (
      ['mouth', 'body', 'eyes']
        .map((partKey) => getTraitKey(oling?.parts?.[partKey]).split('-')[0])
        .find(Boolean) || ''
    );
  }

  function createOlingClashInspector(options = {}) {
    const effectRenderer = options.effectRenderer;
    const healthRenderer = options.healthRenderer;
    const request =
      typeof options.fetch === 'function'
        ? options.fetch
        : globalScope.fetch?.bind(globalScope);
    let abilitiesByTrait = new Map();
    let activeContext = null;
    let selectedPartKey = 'mouth';
    let returnFocus = null;

    function getElements(root) {
      const backdrop = root?.querySelector?.('[data-clash-inspector]');
      return {
        backdrop,
        content: backdrop?.querySelector('[data-clash-inspector-content]'),
        dialog: backdrop?.querySelector('.olings-clash-inspector'),
        position: backdrop?.querySelector('[data-clash-inspector-position]')
      };
    }

    function setAbilityCatalog(abilities = []) {
      abilitiesByTrait = new Map(
        abilities
          .filter((ability) => ability?.traitKey)
          .map((ability) => [ability.traitKey, ability])
      );
      return abilitiesByTrait.size;
    }

    async function loadAbilityCatalog(
      url = '/json-files/olings/clash-abilities.json'
    ) {
      if (!request) return 0;
      const response = await request(url, {
        headers: { Accept: 'application/json' }
      });
      if (!response?.ok) return 0;
      const payload = await response.json();
      const count = setAbilityCatalog(payload?.abilities || []);
      if (activeContext) render(activeContext.root);
      return count;
    }

    function getAbility(oling, partKey) {
      const traitKey = getTraitKey(oling?.parts?.[partKey]);
      const prefixedTraitKey = `${getBuildPrefix(oling)}-${traitKey}`;
      return (
        abilitiesByTrait.get(traitKey) ||
        abilitiesByTrait.get(prefixedTraitKey) ||
        null
      );
    }

    function getRoleLabel(oling) {
      const counts = new Map();
      partDefinitions.forEach(({ key }) => {
        const ability = getAbility(oling, key);
        (ability?.roleTags || []).forEach((role) => {
          counts.set(role, (counts.get(role) || 0) + 1);
        });
      });
      return [...counts.entries()]
        .sort(
          (left, right) => right[1] - left[1] || left[0].localeCompare(right[0])
        )
        .slice(0, 2)
        .map(([role]) => formatTitle(role).toUpperCase())
        .join(' / ');
    }

    function createArt(documentRef, oling) {
      const art = documentRef.createElement('div');
      const name = documentRef.createElement('h2');
      art.className = 'olings-clash-inspector-art';
      name.id = 'olings-clash-inspector-title';
      name.dataset.clashInspectorTitle = '';
      name.textContent = oling.name;
      const stack = documentRef.createElement('div');
      stack.className = 'olings-clash-oling-art';
      ['flight', 'body', 'eyes', 'mouth'].forEach((partKey) => {
        const image = documentRef.createElement('img');
        image.className = `olings-clash-oling-layer is-${partKey}`;
        image.src = oling.parts?.[partKey] || '';
        image.alt = '';
        stack.append(image);
      });
      const role = documentRef.createElement('small');
      role.dataset.clashInspectorRole = '';
      role.textContent = getRoleLabel(oling);
      role.hidden = !role.textContent;
      art.append(name, stack, role);
      return art;
    }

    function getPositionLabel(context) {
      const teamLabel = context.side === 'local' ? 'YOUR TEAM' : 'OPPONENT';
      const position =
        Number(context.oling?.health?.heartUnits || 0) === 0
          ? 'DEFEATED'
          : context.index === 0
            ? 'ACTIVE'
            : 'BENCH';
      return `${teamLabel} · ${position}`;
    }

    function getLastMove(context) {
      if (context.oling?.lastMove?.action) return context.oling.lastMove;
      const result = context.state?.lastResult;
      if (!result) return null;
      const teamSlot = Number(context.oling?.teamSlot ?? context.index);
      const recordedTeamSlot = Number(
        result.lastAbilityTeamSlots?.[context.side]
      );
      if (
        Number.isInteger(recordedTeamSlot)
          ? recordedTeamSlot !== teamSlot
          : context.index !== 0
      ) {
        return null;
      }
      const isDraw = result.winner === 'draw';
      const selectedAction =
        context.side === 'local' ? result.localAction : result.opponentAction;
      return {
        action: isDraw ? 'draw' : selectedAction,
        activationStatus: result.activationStatus?.[context.side] || '',
        outcome: isDraw
          ? 'draw'
          : result.winner === context.side
            ? 'win'
            : 'loss',
        round: Number(
          result.round || Math.max(1, Number(context.state?.round || 1) - 1)
        )
      };
    }

    function getAbilityProgress(oling, ability) {
      if (!ability?.key) return 0;
      const progress = (oling?.abilityProgress || []).find(
        (entry) => entry?.abilityKey === ability.key
      );
      return Math.max(0, Number(progress?.activationCount || 0));
    }

    function createCadencePips(documentRef, oling, ability) {
      const threshold = Math.max(0, Number(ability?.cadence?.every || 0));
      if (threshold < 2) return null;
      const completed = Math.min(threshold, getAbilityProgress(oling, ability));
      const pips = documentRef.createElement('span');
      pips.className = 'olings-clash-activation-pips';
      pips.setAttribute('aria-label', `Progress ${completed} of ${threshold}`);
      for (let index = 0; index < threshold; index += 1) {
        const pip = documentRef.createElement('span');
        pip.className = `olings-clash-activation-pip${index < completed ? ' is-filled' : ''}`;
        pip.textContent = index < completed ? '●' : '○';
        pip.setAttribute('aria-hidden', 'true');
        pips.append(pip);
      }
      return pips;
    }

    function getAbilityStates(oling, partKey, ability) {
      const states = [];
      const effects = oling?.effects || [];
      if (
        effects.some(
          (effect) =>
            effect?.key === 'suppressed' && effect?.targetPart === partKey
        )
      ) {
        states.push({ key: 'disabled', label: 'DISABLED' });
      }
      if (
        effects.some(
          (effect) =>
            effect?.key === 'warded' &&
            (!effect?.targetPart || effect.targetPart === partKey)
        )
      ) {
        states.push({ key: 'protected', label: 'PROTECTED' });
      }
      const threshold = Math.max(0, Number(ability?.cadence?.every || 0));
      if (
        threshold > 1 &&
        getAbilityProgress(oling, ability) === threshold - 1
      ) {
        states.push({ key: 'primed', label: 'PRIMED' });
      }
      if (Number(oling?.health?.heartUnits || 0) === 0) {
        states.push({ key: 'inactive', label: 'INACTIVE' });
      }
      return states;
    }

    function createLastMovePanel(documentRef, context) {
      const section = documentRef.createElement('section');
      const heading = documentRef.createElement('h3');
      const move = getLastMove(context);
      section.className = 'olings-clash-inspector-last-move';
      heading.textContent = 'LAST MOVE';
      section.append(heading);
      if (!move?.action || !actionParts[move.action]) {
        const empty = documentRef.createElement('p');
        empty.textContent = 'NO MOVE USED YET';
        section.classList.add('is-empty');
        section.append(empty);
        return section;
      }

      const ability = getAbility(context.oling, actionParts[move.action]);
      const button = documentRef.createElement('button');
      const image = documentRef.createElement('img');
      const copy = documentRef.createElement('span');
      const name = documentRef.createElement('strong');
      const action = documentRef.createElement('small');
      const meta = documentRef.createElement('span');
      const outcome = documentRef.createElement('strong');
      const round = documentRef.createElement('small');
      const outcomeLabel =
        move.outcome === 'win'
          ? 'WON'
          : move.outcome === 'loss'
            ? 'LOST'
            : 'DRAW';
      button.type = 'button';
      button.className = `olings-clash-inspector-last-move__card is-${move.outcome || 'draw'}`;
      button.dataset.clashInspectorAbility = actionParts[move.action];
      button.dataset.clashInspectorLastMove = '';
      image.src = ability?.imagePath || '';
      image.alt = '';
      image.hidden = !ability?.imagePath;
      name.textContent =
        ability?.name || context.oling.moves?.[move.action] || move.action;
      action.textContent = move.action.toUpperCase();
      outcome.textContent = outcomeLabel;
      round.textContent = `ROUND ${Math.max(1, Number(move.round || 1))}`;
      copy.append(name, action);
      meta.append(outcome, round);
      if (move.activationStatus === 'activated') {
        const activated = documentRef.createElement('em');
        activated.textContent = 'ACTIVATED';
        meta.append(activated);
      }
      button.append(image, copy, meta);
      section.append(button);
      return section;
    }

    function createAbilityCard(documentRef, context, definition) {
      const { action, key, label } = definition;
      const ability = getAbility(context.oling, key);
      const button = documentRef.createElement('button');
      const type = documentRef.createElement('small');
      const image = documentRef.createElement('img');
      const name = documentRef.createElement('strong');
      const states = documentRef.createElement('span');
      button.type = 'button';
      button.className = 'olings-clash-inspector-ability';
      button.classList.toggle('is-selected', selectedPartKey === key);
      button.dataset.clashInspectorAbility = key;
      button.setAttribute('aria-pressed', String(selectedPartKey === key));
      type.textContent = `${label} · ${action.toUpperCase()}`;
      image.src = ability?.imagePath || '';
      image.alt = '';
      image.hidden = !ability?.imagePath;
      name.textContent =
        ability?.name || context.oling.moves?.[action] || 'ABILITY';
      states.className = 'olings-clash-inspector-ability__states';
      getAbilityStates(context.oling, key, ability).forEach((state) => {
        const badge = documentRef.createElement('em');
        const icon = documentRef.createElement('img');
        badge.className = `is-${state.key}`;
        badge.title = state.label;
        badge.setAttribute('aria-label', state.label);
        icon.src = abilityStateIcons[state.key] || abilityStateIcons.inactive;
        icon.alt = '';
        icon.setAttribute('aria-hidden', 'true');
        badge.append(icon);
        states.append(badge);
      });
      const cadence = createCadencePips(documentRef, context.oling, ability);
      if (cadence) name.append(cadence);
      button.append(type, image, name);
      if (states.childElementCount > 0) button.append(states);
      return button;
    }

    function createAbilityDetail(documentRef, context) {
      const definition =
        partDefinitions.find(({ key }) => key === selectedPartKey) ||
        partDefinitions[0];
      const ability = getAbility(context.oling, definition.key);
      const detail = documentRef.createElement('section');
      const heading = documentRef.createElement('h3');
      const action = documentRef.createElement('small');
      const description = documentRef.createElement('p');
      detail.className = 'olings-clash-inspector-ability-detail';
      detail.dataset.clashInspectorAbilityDetail = definition.key;
      heading.textContent =
        ability?.name || context.oling.moves?.[definition.action] || 'ABILITY';
      action.textContent = `${definition.label} · ${definition.action.toUpperCase()}`;
      description.textContent =
        ability?.description || 'Ability details are not available yet.';
      detail.append(heading, action, description);
      return detail;
    }

    function getActiveEffects(context) {
      const effects = [
        ...(context.oling?.effects || []),
        ...(context.state?.playerEffects?.[context.side] || [])
      ].filter((effect) => !['bloodbound', 'reclaim'].includes(effect.key));
      if (Number(context.oling?.pendingReclaimUnits || 0) > 0) {
        effects.push({
          abbreviation: 'BLD',
          key: 'bloodbound',
          name: 'Bloodbound',
          type: 'positive'
        });
      }
      return effects;
    }

    function createActiveEffectsPanel(documentRef, context) {
      const effects = getActiveEffects(context);
      const section = documentRef.createElement('section');
      const heading = documentRef.createElement('h3');
      const list = documentRef.createElement('div');
      section.className = 'olings-clash-inspector-active-effects';
      heading.textContent = 'CURRENT STATUS';
      list.className = 'olings-clash-inspector-active-effects__list';
      if (effects.length === 0) {
        const empty = documentRef.createElement('p');
        empty.className = 'olings-clash-inspector-active-effects__empty';
        empty.textContent = 'NO ACTIVE EFFECTS';
        list.append(empty);
      }
      effects.forEach((effect) => {
        const item = documentRef.createElement('article');
        const iconHolder = documentRef.createElement('strong');
        const copy = documentRef.createElement('span');
        const name = documentRef.createElement('strong');
        const detail = documentRef.createElement('small');
        const icon = effectRenderer?.createIcon(documentRef, effect);
        item.className = `is-${effect.type || 'neutral'}`;
        if (icon) iconHolder.append(icon);
        else iconHolder.textContent = effect.abbreviation || 'FX';
        name.textContent = effect.name || formatTitle(effect.key);
        detail.textContent = [
          effect.targetPart ? formatTitle(effect.targetPart).toUpperCase() : '',
          effect.remaining !== null &&
          effect.remaining !== undefined &&
          Number.isFinite(Number(effect.remaining))
            ? `${Number(effect.remaining)} REMAINING`
            : ''
        ]
          .filter(Boolean)
          .join(' · ');
        detail.hidden = !detail.textContent;
        item.setAttribute(
          'aria-label',
          [name.textContent, detail.textContent].filter(Boolean).join(', ')
        );
        item.title = [name.textContent, detail.textContent]
          .filter(Boolean)
          .join(' — ');
        copy.append(name, detail);
        item.append(iconHolder, copy);
        list.append(item);
      });
      section.append(heading, list);
      return section;
    }

    function createOverviewPanel(documentRef, context) {
      const panel = documentRef.createElement('section');
      const profile = documentRef.createElement('section');
      const art = createArt(documentRef, context.oling);
      const vitality = documentRef.createElement('section');
      const vitalityHeading = documentRef.createElement('h3');
      const resources = documentRef.createElement('div');
      const statuses = createActiveEffectsPanel(documentRef, context);
      const abilitiesSection = documentRef.createElement('section');
      const abilitiesHeading = documentRef.createElement('h3');
      const abilities = documentRef.createElement('div');
      panel.className = 'olings-clash-inspector-overview';
      panel.dataset.clashInspectorPanel = 'overview';
      profile.className = 'olings-clash-inspector-profile';
      art.classList.add('olings-clash-inspector-profile__art');
      vitality.className = 'olings-clash-inspector-vitality';
      vitalityHeading.textContent = 'VITALITY';
      resources.className = 'olings-clash-health olings-clash-inspector-health';
      resources.dataset.clashHealth = '';
      healthRenderer?.renderHealth(resources, context.oling.health);
      vitality.append(vitalityHeading, resources);
      profile.append(art, vitality, statuses);
      abilitiesSection.className = 'olings-clash-inspector-abilities';
      abilitiesHeading.textContent = 'ABILITIES';
      abilities.className = 'olings-clash-inspector-abilities__grid';
      abilities.append(
        ...partDefinitions.map((definition) =>
          createAbilityCard(documentRef, context, definition)
        )
      );
      abilitiesSection.append(
        abilitiesHeading,
        abilities,
        createAbilityDetail(documentRef, context)
      );
      panel.append(
        profile,
        createLastMovePanel(documentRef, context),
        abilitiesSection
      );
      return panel;
    }

    function render(root) {
      if (!activeContext) return null;
      const elements = getElements(root);
      if (!elements.backdrop || !elements.content) return null;
      const documentRef =
        elements.backdrop.ownerDocument || globalScope.document;
      const context = activeContext;
      if (elements.position) {
        elements.position.textContent = getPositionLabel(context);
      }
      const panel = createOverviewPanel(documentRef, context);
      elements.content.replaceChildren(panel);
      return panel;
    }

    function selectAbility(root, partKey) {
      if (!partDefinitions.some(({ key }) => key === partKey)) return null;
      selectedPartKey = partKey;
      const panel = render(root);
      root
        ?.querySelector?.(
          `[data-clash-inspector-ability="${selectedPartKey}"]:not([data-clash-inspector-last-move])`
        )
        ?.focus?.();
      return panel;
    }

    function close(root) {
      const elements = getElements(root);
      if (!elements.backdrop) return;
      elements.backdrop.hidden = true;
      elements.backdrop.setAttribute('aria-hidden', 'true');
      activeContext = null;
      selectedPartKey = 'mouth';
      const focusTarget = returnFocus;
      returnFocus = null;
      focusTarget?.focus?.();
    }

    function open(root, context = {}) {
      if (!context.oling) return null;
      const elements = getElements(root);
      if (!elements.backdrop) return null;
      activeContext = { ...context, root };
      selectedPartKey =
        actionParts[getLastMove(activeContext)?.action] || 'mouth';
      returnFocus = context.returnFocus || null;
      elements.backdrop.hidden = false;
      elements.backdrop.setAttribute('aria-hidden', 'false');
      render(root);
      elements.dialog?.focus?.();
      return activeContext;
    }

    return {
      close,
      getAbility,
      getRoleLabel,
      isOpen: () => Boolean(activeContext),
      loadAbilityCatalog,
      open,
      partDefinitions,
      render,
      selectAbility,
      setAbilityCatalog
    };
  }

  globalScope.createOlingClashInspector = createOlingClashInspector;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = createOlingClashInspector;
  }
})(typeof window !== 'undefined' ? window : globalThis);
