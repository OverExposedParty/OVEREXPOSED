(function (globalScope) {
  const defeatedEyesPath =
    '/images/olings/builds/eyes/states/defeated-eyes.svg';
  const actionParts = Object.freeze({
    attack: 'mouth',
    guard: 'body',
    skill: 'flight',
    draw: 'eyes'
  });
  const healthCueAssets = Object.freeze({
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
  const summaryTokenPattern =
    /1\/2|Normal Hearts?|Blood Hearts?|Overgrowth Hearts?|Blood|Overgrowth|Hearts?|Shields?|Tags?|Burn|Suppress(?:ed)?|Block(?:ed)?|Mark(?:ed)?|Ward(?:ed)?|Steal|Junk/gi;
  const effectTokenKeys = Object.freeze({
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
  const artLayerCache = new WeakMap();
  const elementRenderSignatures = new WeakMap();
  const effectElementPools = new WeakMap();

  function createRenderSignature(value) {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }

  function renderSignatureChanged(element, key, value) {
    if (!element) return false;
    const signature = createRenderSignature(value);
    let signatures = elementRenderSignatures.get(element);
    if (!signatures) {
      signatures = new Map();
      elementRenderSignatures.set(element, signatures);
    }
    if (signatures.get(key) === signature) return false;
    signatures.set(key, signature);
    return true;
  }

  function getAbilityLockEffect(oling, partKey) {
    return (
      (oling?.effects || []).find(
        (effect) => effect.key === 'suppressed' && effect.targetPart === partKey
      ) || null
    );
  }

  function isAbilityLocked(oling, partKey) {
    return Boolean(getAbilityLockEffect(oling, partKey));
  }

  function getActionBlockingEffect(oling, playerEffects, action, partKey) {
    return [...(oling?.effects || []), ...(playerEffects || [])].find(
      (effect) => {
        const parameters = effect?.parameters || effect?.data?.parameters || {};
        const preventsAction =
          effect?.preventsAction === true || parameters.preventsAction === true;
        if (!preventsAction) return false;

        const blockedActions = [
          ...(Array.isArray(effect.blockedActions)
            ? effect.blockedActions
            : []),
          ...(Array.isArray(parameters.blockedActions)
            ? parameters.blockedActions
            : [])
        ].map((value) => String(value).toLowerCase());
        const targetAction = String(
          effect.targetAction || parameters.targetAction || ''
        ).toLowerCase();
        const targetPart = String(
          effect.targetPart || parameters.targetPart || ''
        ).toLowerCase();

        if (blockedActions.length > 0 && !blockedActions.includes(action)) {
          return false;
        }
        if (targetAction && targetAction !== 'all' && targetAction !== action) {
          return false;
        }
        if (targetPart && targetPart !== 'all' && targetPart !== partKey) {
          return false;
        }
        return true;
      }
    );
  }

  function renderArt(container, parts = {}, { defeated = false } = {}) {
    if (!container) return;
    if (!renderSignatureChanged(container, 'Art', { defeated, parts })) return;
    let layers = artLayerCache.get(container);
    if (!layers) {
      layers = Object.fromEntries(
        ['flight', 'body', 'eyes', 'mouth'].map((partKey) => [
          partKey,
          container.querySelector(`.olings-clash-oling-layer.is-${partKey}`)
        ])
      );
      artLayerCache.set(container, layers);
    }
    ['flight', 'body', 'eyes', 'mouth'].forEach((partKey) => {
      const image = layers[partKey];
      const source =
        partKey === 'eyes' && defeated ? defeatedEyesPath : parts[partKey];
      if (image && source && image.getAttribute('src') !== source) {
        image.setAttribute('src', source);
      }
    });
  }

  function renderEffects(container, oling, effectRenderer) {
    if (!container) return;
    const documentRef = container.ownerDocument || globalScope.document;
    const effects = (oling.effects || []).filter(
      (effect) => !['bloodbound', 'reclaim'].includes(effect.key)
    );
    if (Number(oling.pendingReclaimUnits || 0) > 0) {
      effects.push({
        abbreviation: 'BLD',
        key: 'bloodbound',
        name: 'Bloodbound',
        type: 'positive'
      });
    }

    const renderSignature = JSON.stringify({
      name: oling.name,
      effects: effects.map((effect) => ({
        abbreviation: effect.abbreviation || '',
        iconPath: effectRenderer?.resolveIconPath?.(effect) || '',
        key: effect.key || '',
        name: effect.name || '',
        type: effect.type === 'negative' ? 'negative' : 'positive'
      }))
    });
    if (container.dataset.clashEffectsSignature === renderSignature) return;

    const groups = Object.fromEntries(
      ['positive', 'negative'].map((type) => {
        let group = container.querySelector(`[data-effect-group="${type}"]`);
        if (!group) {
          group = documentRef.createElement('span');
          group.className = `olings-clash-effect-group is-${type}`;
          group.dataset.effectGroup = type;
          group.setAttribute('role', 'presentation');
          container.append(group);
        }
        return [type, group];
      })
    );
    const available = new Map();
    container
      .querySelectorAll('.olings-clash-effect[data-effect-identity]')
      .forEach((element) => {
        const identity = element.dataset.effectIdentity;
        const matches = available.get(identity) || [];
        matches.push(element);
        available.set(identity, matches);
      });
    const pool = effectElementPools.get(container) || [];
    effectElementPools.set(container, pool);

    effects.forEach((effect) => {
      const type = effect.type === 'negative' ? 'negative' : 'positive';
      const iconPath = effectRenderer?.resolveIconPath?.(effect) || '';
      const identity = createRenderSignature({
        abbreviation: effect.abbreviation || '',
        iconPath,
        key: effect.key || '',
        name: effect.name || '',
        type
      });
      const identityMatches = available.get(identity) || [];
      const matchedElement = identityMatches.shift();
      const element =
        matchedElement || pool.pop() || documentRef.createElement('span');
      available.set(identity, identityMatches);
      element.className = `olings-clash-effect is-${type}`;
      element.dataset.effectAbbreviation = effect.abbreviation;
      element.dataset.effectIdentity = identity;
      element.dataset.effectKey = effect.key;
      element.setAttribute('role', 'listitem');
      element.setAttribute('aria-label', `${effect.name}, ${type} effect`);
      element.setAttribute('title', effect.name);
      if (!matchedElement) {
        element.replaceChildren();
        const icon = effectRenderer?.createIcon(documentRef, effect);
        if (icon) element.append(icon);
        else element.textContent = effect.abbreviation;
      }
      groups[type].append(element);
    });

    available.forEach((elements) => {
      elements.forEach((element) => {
        element.remove();
        if (pool.length < 12) pool.push(element);
      });
    });
    container.dataset.clashEffectsSignature = renderSignature;
    container.setAttribute('aria-label', `${oling.name} active effects`);
  }

  function getRosterOlingKey(oling, index) {
    const id = String(oling?.id || '').trim();
    if (id) return `id:${id}`;
    const teamSlot = Number(oling?.teamSlot);
    return Number.isInteger(teamSlot)
      ? `team-slot:${teamSlot}`
      : `position:${index}`;
  }

  function orderRosterSlots(roster, team) {
    const slots = [...roster.querySelectorAll('[data-clash-roster-slot]')];
    const teamKeys = team.map(getRosterOlingKey);
    const slotsByKey = new Map(
      slots
        .filter((slot) => slot.dataset.rosterOlingKey)
        .map((slot) => [slot.dataset.rosterOlingKey, slot])
    );
    const matchingSlots = teamKeys.filter((key) => slotsByKey.has(key)).length;

    // The static page starts with placeholder Olings, while an online match can
    // replace the entire team. Bind those cards once by position, then preserve
    // each card's Oling identity as the active order changes during Tags.
    if (!matchingSlots) {
      slots.forEach((slot, index) => {
        slot.dataset.rosterOlingKey = teamKeys[index] || `unused:${index}`;
      });
    } else {
      const matchedSlots = new Set(
        teamKeys.map((key) => slotsByKey.get(key)).filter(Boolean)
      );
      const freeSlots = slots.filter((slot) => !matchedSlots.has(slot));
      teamKeys
        .filter((key) => !slotsByKey.has(key))
        .forEach((key, index) => {
          if (freeSlots[index]) freeSlots[index].dataset.rosterOlingKey = key;
        });
    }

    const refreshedSlotsByKey = new Map(
      slots.map((slot) => [slot.dataset.rosterOlingKey, slot])
    );
    const orderedSlots = teamKeys.map((key, index) => {
      const slot = refreshedSlotsByKey.get(key);
      if (!slot) return null;
      const position = index === 0 ? 'active' : `bench-${index}`;
      slot.dataset.clashRosterSlot = position;
      slot.classList.toggle('is-active', index === 0);
      return slot;
    });

    orderedSlots.forEach((slot, index) => {
      if (slot && roster.children[index] !== slot) {
        roster.insertBefore(slot, roster.children[index] || null);
      }
    });

    return orderedSlots;
  }

  function createOlingClashMatchRenderer(options = {}) {
    const configureFlight =
      typeof options.configureFlight === 'function'
        ? options.configureFlight
        : null;
    const effectRenderer = options.effectRenderer;
    const healthRenderer = options.healthRenderer;
    const resolveAbility =
      typeof options.resolveAbility === 'function'
        ? options.resolveAbility
        : () => null;
    const rootElementCache = new WeakMap();
    const rosterSlotCache = new WeakMap();
    const actionButtonCache = new WeakMap();
    const createRenderScheduler =
      globalScope.createOlingClashRenderScheduler ||
      (typeof require === 'function'
        ? require('./render-scheduler')
        : null);
    const renderScheduler = createRenderScheduler({
      cancelAnimationFrame: options.cancelAnimationFrame,
      render,
      requestAnimationFrame: options.requestAnimationFrame
    });

    function getRootElements(root) {
      let elements = rootElementCache.get(root);
      if (elements) return elements;
      elements = {
        actionContainer: root.querySelector('[data-clash-actions]'),
        fighters: {
          local: root.querySelector('[data-clash-fighter="local"]'),
          opponent: root.querySelector('[data-clash-fighter="opponent"]')
        },
        lastAbilities: {
          local: root.querySelector('[data-clash-last-ability="local"]'),
          opponent: root.querySelector('[data-clash-last-ability="opponent"]')
        },
        outcome: root.querySelector('[data-clash-last-outcome]'),
        rosters: {
          local: root.querySelector('[data-clash-roster="local"]'),
          opponent: root.querySelector('[data-clash-roster="opponent"]')
        },
        round: root.querySelector('[data-clash-round]'),
        tagResources: {
          local: root.querySelector('[data-clash-tag-resource="local"]'),
          opponent: root.querySelector('[data-clash-tag-resource="opponent"]')
        }
      };
      elements.actionButtons = [
        ...(elements.actionContainer?.querySelectorAll('[data-clash-action]') ||
          [])
      ];
      rootElementCache.set(root, elements);
      return elements;
    }

    function getRosterSlotElements(slot) {
      let elements = rosterSlotCache.get(slot);
      if (elements) return elements;
      elements = {
        effects: slot.querySelector('[data-clash-effects]'),
        health: slot.querySelector('[data-clash-health]'),
        inspectTrigger: slot.querySelector('.olings-clash-roster-slot__icon'),
        name: slot.querySelector('.olings-clash-roster-slot__status > strong'),
        tag: slot.querySelector('[data-team-slot]')
      };
      rosterSlotCache.set(slot, elements);
      return elements;
    }

    function getActionButtonElements(button) {
      let elements = actionButtonCache.get(button);
      if (elements) return elements;
      elements = {
        image: button.querySelector('[data-clash-move-image]'),
        label: button.querySelector('[data-clash-move-name]')
      };
      actionButtonCache.set(button, elements);
      return elements;
    }

    function getAbilityRenderState(oling) {
      return Object.entries(actionParts).map(([action, partKey]) => {
        const ability = resolveAbility(oling, partKey);
        return {
          action,
          description: ability?.description || '',
          imagePath: ability?.imagePath || '',
          key: ability?.key || '',
          name: ability?.name || '',
          revision: ability?.revision || null
        };
      });
    }

    function createSummaryIcon(documentRef, source, className) {
      const image = documentRef.createElement('img');
      image.className = className;
      image.src = source;
      image.alt = '';
      image.draggable = false;
      image.setAttribute('aria-hidden', 'true');
      return image;
    }

    function getSummaryToken(value, useHalfAsset = false) {
      const normalizedValue = String(value || '').toLowerCase();
      if (/^overgrowth(?: hearts?)?$/.test(normalizedValue)) {
        return {
          label: 'Overgrowth Heart',
          path: healthCueAssets.overgrowth[useHalfAsset ? 'half' : 'full']
        };
      }
      if (/^blood hearts?$/.test(normalizedValue)) {
        return {
          label: 'Blood Heart',
          path: healthCueAssets.blood[useHalfAsset ? 'half' : 'full']
        };
      }
      if (normalizedValue === 'blood') {
        return { label: 'Blood Heart', path: healthCueAssets.blood.full };
      }
      if (/^(?:normal )?hearts?$/.test(normalizedValue)) {
        return {
          label: 'Heart',
          path: healthCueAssets.hearts[useHalfAsset ? 'half' : 'full']
        };
      }
      if (/^shields?$/.test(normalizedValue)) {
        return { label: 'Shield', path: healthCueAssets.shields.full };
      }
      if (/^tags?$/.test(normalizedValue)) {
        return {
          label: value,
          path: '/images/olings/clash/ui/actions/tag.svg'
        };
      }

      const effectKey = effectTokenKeys[normalizedValue];
      const effectPath = effectRenderer?.resolveIconPath?.({ key: effectKey });
      return effectPath ? { label: value, path: effectPath } : null;
    }

    function createFraction(documentRef) {
      const fraction = documentRef.createElement('span');
      const numerator = documentRef.createElement('sup');
      const denominator = documentRef.createElement('sub');
      fraction.className = 'olings-clash-action-summary__fraction';
      fraction.setAttribute('aria-label', 'one half');
      numerator.textContent = '1';
      denominator.textContent = '2';
      numerator.setAttribute('aria-hidden', 'true');
      denominator.setAttribute('aria-hidden', 'true');
      fraction.append(numerator, '/', denominator);
      return fraction;
    }

    function getCadenceEffect(result, side, abilityKey) {
      if (!abilityKey) return null;
      return (result?.effects || []).find(
        (effect) =>
          effect?.playerSlot === side && effect.abilityKey === abilityKey
      );
    }

    function isTagSynergyAbility(ability) {
      return (ability?.effects || []).some((effect) => {
        const handler = String(effect?.handler || '').toLowerCase();
        const selector = String(effect?.target?.selector || '').toLowerCase();
        return handler.includes('tag_recipient') || selector.includes('tag');
      });
    }

    function getTagSynergyState(
      ability,
      {
        blocked = false,
        disqualified = false,
        effect = null,
        resultKnown = false,
        tagQueued = false
      } = {}
    ) {
      if (!isTagSynergyAbility(ability)) return null;
      const triggered =
        effect?.targetReason === 'tag-recipient' &&
        effect?.status === 'resolved';
      return {
        live: Boolean(tagQueued) && !blocked && !disqualified && !resultKnown,
        triggered
      };
    }

    function applyTagSynergyState(container, synergyState) {
      if (!container) return;
      container.classList.toggle('has-tag-synergy', Boolean(synergyState));
      container.classList.toggle(
        'is-tag-synergy-live',
        synergyState?.live === true
      );
      container.classList.toggle(
        'is-tag-synergy-triggered',
        synergyState?.triggered === true
      );
    }

    function getTagSynergyAriaLabel(synergyState) {
      if (!synergyState) return '';
      if (synergyState.triggered) return 'Tag synergy activated.';
      if (synergyState.live) return 'Tag synergy is active for the queued Tag.';
      return 'Has Tag synergy.';
    }

    function getAbilityCadenceState(
      oling,
      ability,
      { allowPrimed = true, effect = null } = {}
    ) {
      const configuredThreshold = Number(ability?.cadence?.every);
      const effectThreshold = Number(effect?.activationThreshold);
      const threshold = Math.floor(
        effectThreshold > 1 ? effectThreshold : configuredThreshold
      );
      if (!Number.isInteger(threshold) || threshold <= 1 || !ability?.key) {
        return null;
      }

      const revision = Number(ability.revision || 1);
      const progress = (oling?.abilityProgress || []).find(
        (entry) =>
          entry?.abilityKey === ability.key &&
          Number(entry.abilityRevision || 1) === revision
      );
      const activationPrevented =
        effect?.outcome === 'effect-prevented' ||
        effect?.status === 'prevented' ||
        ['blocked', 'warded'].includes(effect?.statusResult);
      const activated = effect?.triggered === true && !activationPrevented;
      const effectProgress =
        effect?.status === 'progressed' && effect?.triggered === false
          ? Number(effect.afterActivationCount)
          : null;
      const storedProgress = Number(progress?.activationCount);
      const completed = activated
        ? threshold
        : Math.min(
            threshold - 1,
            Math.max(
              0,
              Math.floor(
                Number.isFinite(effectProgress)
                  ? effectProgress
                  : Number.isFinite(storedProgress)
                    ? storedProgress
                    : 0
              )
            )
          );

      return {
        activated,
        completed,
        primed: allowPrimed && !activated && completed === threshold - 1,
        threshold
      };
    }

    function getCadenceAriaLabel(abilityName, cadenceState) {
      if (!cadenceState) return '';
      const { activated, completed, primed, threshold } = cadenceState;
      if (activated) {
        return `${abilityName}: all ${threshold} requirements completed; activated.`;
      }
      if (primed) {
        return `${abilityName}: ${completed} of ${threshold} requirements completed; activates on the next qualifying result.`;
      }
      return `${abilityName}: ${completed} of ${threshold} requirements completed.`;
    }

    function createActivationPips(documentRef, abilityName, cadenceState) {
      if (!cadenceState) return null;
      const pips = documentRef.createElement('span');
      pips.className = 'olings-clash-activation-pips';
      pips.dataset.clashActivationPips = '';
      pips.classList.toggle('is-activated', cadenceState.activated);
      pips.setAttribute('aria-hidden', 'true');

      for (let index = 0; index < cadenceState.threshold; index += 1) {
        const pip = documentRef.createElement('span');
        const isFilled = index < cadenceState.completed;
        pip.className = 'olings-clash-activation-pip';
        pip.classList.toggle('is-filled', isFilled);
        pip.classList.toggle('is-empty', !isFilled);
        pip.textContent = isFilled ? '●' : '○';
        pips.append(pip);
      }

      pips.title = getCadenceAriaLabel(abilityName, cadenceState);
      return pips;
    }

    function renderAbilityName(container, abilityName, cadenceState) {
      if (!container) return;
      const renderSignature = JSON.stringify({
        abilityName,
        cadenceState: cadenceState || null
      });
      if (container.dataset.clashAbilityNameSignature === renderSignature) {
        return;
      }
      const documentRef = container.ownerDocument || globalScope.document;
      const pips = createActivationPips(documentRef, abilityName, cadenceState);
      container.replaceChildren(documentRef.createTextNode(abilityName));
      if (pips) container.append(pips);
      container.dataset.clashAbilityNameSignature = renderSignature;
    }

    function renderSummaryDescription(container, description) {
      const source = String(description || '');
      const documentRef = container.ownerDocument || globalScope.document;
      const fragment = documentRef.createDocumentFragment();
      let pendingHalf = false;
      let previousIndex = 0;

      source.replace(summaryTokenPattern, (value, matchIndex) => {
        const precedingText = source.slice(previousIndex, matchIndex);
        if (pendingHalf && /\S/.test(precedingText)) pendingHalf = false;
        fragment.append(precedingText);

        if (value === '1/2') {
          fragment.append(createFraction(documentRef));
          pendingHalf = true;
        } else {
          const token = getSummaryToken(value, pendingHalf);
          if (token) {
            const icon = createSummaryIcon(
              documentRef,
              token.path,
              'olings-clash-action-summary__inline-icon'
            );
            icon.alt = token.label;
            icon.removeAttribute('aria-hidden');
            icon.title = token.label;
            fragment.append(icon);
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

    function getRevealedAbilityStatus(
      side,
      winner,
      result = null,
      abilityKey = ''
    ) {
      if (winner !== 'draw' && winner !== side) return 'failed';
      if (!result) return 'revealed';

      const triggeredStatuses = result?.triggeredStatuses || [];
      const activationStatus = triggeredStatuses.find(
        (status) =>
          status?.playerSlot === side &&
          ['activation-suppressed', 'activation-replaced-with-junk'].includes(
            status.outcome
          )
      );
      if (activationStatus?.outcome === 'activation-suppressed') {
        return 'suppressed';
      }
      if (activationStatus) return 'blocked';

      const abilityEffects = (result?.effects || []).filter(
        (effect) =>
          effect?.playerSlot === side &&
          (!abilityKey || effect.abilityKey === abilityKey)
      );
      const allEffectsBlocked =
        abilityEffects.length > 0 &&
        abilityEffects.every(
          (effect) =>
            effect.outcome === 'effect-prevented' ||
            effect.status === 'prevented' ||
            ['blocked', 'warded'].includes(effect.statusResult)
        );
      if (allEffectsBlocked) return 'blocked';

      const allEffectsProgressed =
        abilityEffects.length > 0 &&
        abilityEffects.every(
          (effect) =>
            effect.status === 'progressed' && effect.triggered === false
        );
      return allEffectsProgressed ? 'progressed' : 'activated';
    }

    function getEffectCue(effect) {
      const mechanic = String(effect?.mechanic || '').toLowerCase();
      const appliedUnits = Math.max(0, Number(effect?.appliedUnits) || 0);
      const statusKey =
        effect?.displayStatusKey ||
        effect?.appliedStatusKey ||
        effect?.restoredStatusKey ||
        effect?.statusKey;
      const statusApplied = ['applied', 'refreshed'].includes(
        effect?.statusResult || effect?.appliedStatusResult
      );
      const statusPath = statusApplied
        ? effectRenderer?.resolveIconPath?.({ key: statusKey })
        : null;
      if (statusPath) {
        return {
          key: statusKey,
          label: String(statusKey || 'Effect')
            .replace(/-/g, ' ')
            .replace(/\b\w/g, (letter) => letter.toUpperCase()),
          path: statusPath
        };
      }

      if (mechanic === 'heal' && appliedUnits > 0) {
        return {
          key: 'hearts',
          label: 'Healed Heart',
          path: healthCueAssets.hearts[appliedUnits === 1 ? 'half' : 'full']
        };
      }
      if (mechanic === 'grant-overgrowth' && appliedUnits > 0) {
        return {
          key: 'overgrowth',
          label: 'Gained Overgrowth',
          path: healthCueAssets.overgrowth[appliedUnits === 1 ? 'half' : 'full']
        };
      }
      if (
        mechanic === 'grant-shield' &&
        Number(effect?.appliedShieldCount || 0) > 0
      ) {
        return {
          key: 'shield',
          label: 'Gained Shield',
          path: healthCueAssets.shields.full
        };
      }
      if (
        mechanic === 'store-resource' &&
        effect?.resource === 'blood' &&
        Number(effect?.storedResourceUnits || 0) > 0
      ) {
        if (effect?.converted && appliedUnits > 0) {
          return {
            key: 'hearts',
            label: 'Converted Blood into Heart',
            path: healthCueAssets.hearts[appliedUnits === 1 ? 'half' : 'full']
          };
        }
        return {
          key: 'blood',
          label: 'Stored Blood',
          path: healthCueAssets.blood[
            Number(effect.storedResourceUnits) === 1 ? 'half' : 'full'
          ]
        };
      }
      if (mechanic === 'transfer' && appliedUnits > 0) {
        return {
          key: 'transfer-heart',
          label: 'Transferred Heart',
          path: healthCueAssets.hearts[appliedUnits === 1 ? 'half' : 'full']
        };
      }
      return null;
    }

    function getReceivedEffectCues(result) {
      const unresolvedStatuses = new Set([
        'condition-not-met',
        'lost',
        'no-effect',
        'no-target',
        'prevented',
        'progressed'
      ]);
      const unresolvedOutcomes = new Set([
        'effect-prevented',
        'no-effect',
        'no-target'
      ]);
      const cues = { local: [], opponent: [] };
      const seen = new Set();

      [
        ...(result?.effects || []),
        ...(result?.triggeredStatuses || [])
      ].forEach((effect) => {
        if (
          unresolvedStatuses.has(effect?.status) ||
          unresolvedOutcomes.has(effect?.outcome) ||
          ['blocked', 'warded'].includes(effect?.statusResult)
        ) {
          return;
        }
        const cue = getEffectCue(effect);
        const targetSide = effect?.targetPlayerSlot || effect?.playerSlot;
        if (!cue || !cues[targetSide]) return;
        const targetTeamSlot =
          effect?.recipientTeamSlot ?? effect?.targetTeamSlot ?? 0;
        const signature = `${targetSide}:${targetTeamSlot}:${cue.key}`;
        if (seen.has(signature)) return;
        seen.add(signature);
        cues[targetSide].push({
          ...cue,
          sourceSide: effect?.playerSlot || targetSide,
          targetName: effect?.targetName || '',
          targetTeamSlot
        });
      });
      return cues;
    }

    function renderReceivedEffects(container, cues = []) {
      if (!container) return;
      const documentRef = container.ownerDocument || globalScope.document;
      const fragment = documentRef.createDocumentFragment();
      cues.forEach((cue) => {
        const icon = createSummaryIcon(
          documentRef,
          cue.path,
          'olings-clash-ability-reveal__effect'
        );
        const target = cue.targetName ? ` on ${cue.targetName}` : '';
        const label = `${cue.label}${target}`;
        icon.alt = label;
        icon.removeAttribute('aria-hidden');
        icon.title = label;
        icon.dataset.sourceSide = cue.sourceSide;
        icon.dataset.targetTeamSlot = String(cue.targetTeamSlot);
        fragment.append(icon);
      });
      container.replaceChildren(fragment);
      container.hidden = cues.length === 0;
    }

    function renderRevealedAbility(
      container,
      oling,
      action,
      status,
      cadenceEffect = null,
      outcome = ''
    ) {
      if (!container || !oling) return null;
      const normalizedAction = String(action || '').toLowerCase();
      const partKey = actionParts[normalizedAction];
      const ability = partKey ? resolveAbility(oling, partKey) : null;
      const abilityName =
        ability?.name ||
        oling?.moves?.[normalizedAction] ||
        normalizedAction.toUpperCase();
      const image = container.querySelector(
        '[data-clash-revealed-ability-image]'
      );
      const actionLabel = container.querySelector(
        '[data-clash-revealed-action]'
      );
      const name = container.querySelector(
        '[data-clash-revealed-ability-name]'
      );
      const cadenceState = getAbilityCadenceState(oling, ability, {
        allowPrimed: !['blocked', 'suppressed'].includes(status),
        effect: cadenceEffect
      });
      container.dataset.activationStatus = status;
      container.dataset.clashRevealedAction = normalizedAction;
      delete container.dataset.clashAction;
      container.dataset.abilityKey = ability?.key || '';
      container.querySelector('[data-clash-ability-state-icon]')?.remove();
      [
        'activated',
        'failed',
        'suppressed',
        'blocked',
        'progressed',
        'revealed'
      ].forEach((state) => {
        container.classList.toggle(`is-${state}`, state === status);
      });
      ['winner', 'loser', 'draw'].forEach((state) => {
        container.classList.toggle(`is-${state}`, state === outcome);
      });
      applyTagSynergyState(container, null);
      if (image) {
        image.hidden = !ability?.imagePath;
        if (ability?.imagePath) image.src = ability.imagePath;
      }
      if (actionLabel) actionLabel.textContent = normalizedAction.toUpperCase();
      renderAbilityName(name, String(abilityName).toUpperCase(), cadenceState);
      const cadenceLabel = getCadenceAriaLabel(abilityName, cadenceState);
      container.setAttribute(
        'aria-label',
        `${oling.name} selected ${abilityName}, ${normalizedAction}. ${status}. ${cadenceLabel}`.trim()
      );
      return { ability, action: normalizedAction, cadenceState, status };
    }

    function renderOpponentAbilityExplanation(root, revealedAbility, result) {
      const explanation = root?.querySelector?.(
        '[data-clash-opponent-ability-explanation]'
      );
      if (!explanation) return;

      const ability = revealedAbility?.ability;
      const description = String(ability?.description || '').trim();
      const shouldShow =
        Boolean(result) &&
        Boolean(description) &&
        ['activated', 'progressed'].includes(revealedAbility?.status);
      explanation.hidden = !shouldShow;
      if (!shouldShow) return;

      const image = explanation.querySelector(
        '[data-clash-opponent-ability-explanation-image]'
      );
      const name = explanation.querySelector(
        '[data-clash-opponent-ability-explanation-name]'
      );
      const copy = explanation.querySelector(
        '[data-clash-opponent-ability-explanation-description]'
      );
      const cadence = explanation.querySelector(
        '[data-clash-opponent-ability-explanation-cadence]'
      );
      const abilityName = String(ability?.name || '').toUpperCase();
      const cadenceState = revealedAbility?.cadenceState;

      if (image) {
        image.hidden = !ability?.imagePath;
        if (ability?.imagePath) image.src = ability.imagePath;
      }
      if (name) name.textContent = abilityName;
      if (cadence) {
        cadence.hidden = !cadenceState;
        cadence.textContent = cadenceState
          ? cadenceState.activated
            ? ' — ACTIVATED'
            : ` — PROGRESS ${cadenceState.completed}/${cadenceState.threshold}`
          : '';
      }
      if (copy) renderSummaryDescription(copy, description);
      explanation.setAttribute(
        'aria-label',
        `Opponent ability applied: ${abilityName}. ${description}`
      );
    }

    function renderAbilityReveal(
      root,
      state,
      { localAction, opponentAction, result = null, winner } = {}
    ) {
      const reveal = root?.querySelector?.('[data-clash-ability-reveal]');
      if (!reveal || !state) return null;
      const localOling = state.teams?.local?.[0];
      const opponentOling = state.teams?.opponent?.[0];
      const resolvedWinner = winner || result?.winner || null;
      const isResolved = Boolean(result);
      const isDrawResult = resolvedWinner === 'draw';
      const localRevealAction = isDrawResult ? 'draw' : localAction;
      const opponentRevealAction = isDrawResult ? 'draw' : opponentAction;
      const localAbility = resolveAbility(
        localOling,
        actionParts[String(localRevealAction || '').toLowerCase()]
      );
      const opponentAbility = resolveAbility(
        opponentOling,
        actionParts[String(opponentRevealAction || '').toLowerCase()]
      );
      const localStatus = getRevealedAbilityStatus(
        'local',
        resolvedWinner,
        result,
        localAbility?.key
      );
      const opponentStatus = getRevealedAbilityStatus(
        'opponent',
        resolvedWinner,
        result,
        opponentAbility?.key
      );
      const localCadenceEffect = getCadenceEffect(
        result,
        'local',
        localAbility?.key
      );
      const opponentCadenceEffect = getCadenceEffect(
        result,
        'opponent',
        opponentAbility?.key
      );
      const local = renderRevealedAbility(
        reveal.querySelector('[data-clash-revealed-ability="local"]'),
        localOling,
        localRevealAction,
        localStatus,
        localCadenceEffect,
        resolvedWinner === 'draw'
          ? 'draw'
          : resolvedWinner === 'local'
            ? 'winner'
            : resolvedWinner
              ? 'loser'
              : ''
      );
      const opponent = renderRevealedAbility(
        reveal.querySelector('[data-clash-revealed-ability="opponent"]'),
        opponentOling,
        opponentRevealAction,
        opponentStatus,
        opponentCadenceEffect,
        resolvedWinner === 'draw'
          ? 'draw'
          : resolvedWinner === 'opponent'
            ? 'winner'
            : resolvedWinner
              ? 'loser'
              : ''
      );
      const receivedEffects = getReceivedEffectCues(result);
      renderReceivedEffects(
        reveal.querySelector(
          '[data-clash-revealed-ability="local"] [data-clash-revealed-effects]'
        ),
        receivedEffects.local
      );
      renderReceivedEffects(
        reveal.querySelector(
          '[data-clash-revealed-ability="opponent"] [data-clash-revealed-effects]'
        ),
        receivedEffects.opponent
      );
      renderOpponentAbilityExplanation(root, opponent, result);

      const versus = reveal.querySelector('[data-clash-reveal-versus]');
      if (versus) versus.textContent = isDrawResult ? '=' : 'VS';
      reveal.hidden = false;
      reveal.classList.add('is-visible');
      reveal.classList.toggle('is-resolved', isResolved);
      reveal.classList.toggle('is-draw-result', isDrawResult);
      reveal.dataset.outcome = String(resolvedWinner || '');
      reveal.setAttribute(
        'aria-label',
        isDrawResult
          ? 'Draw. Revealed Clash abilities.'
          : 'Revealed Clash abilities.'
      );
      return { local, opponent, winner: resolvedWinner };
    }

    function renderTagResource(root, side, resource) {
      const container = getRootElements(root).tagResources[side];
      if (!container) return null;
      if (!resource) {
        container.hidden = true;
        return null;
      }

      const maximumCharges = Math.max(0, Number(resource.maximumCharges) || 0);
      const charges = Math.min(
        maximumCharges,
        Math.max(0, Number(resource.charges) || 0)
      );
      const decisiveClashesPerCharge = Math.max(
        1,
        Number(resource.decisiveClashesPerCharge) || 3
      );
      const rechargeProgress =
        charges >= maximumCharges
          ? 0
          : Math.min(
              decisiveClashesPerCharge - 1,
              Math.max(0, Number(resource.rechargeProgress) || 0)
            );
      const normalizedResource = {
        charges,
        decisiveClashesPerCharge,
        maximumCharges,
        rechargeProgress
      };
      if (
        !renderSignatureChanged(container, 'TagResource', normalizedResource)
      ) {
        return normalizedResource;
      }
      const pips = container.querySelector('[data-clash-tag-charge-pips]');
      const documentRef = container.ownerDocument || globalScope.document;
      if (pips) {
        while (pips.childElementCount < maximumCharges) {
          const pip = documentRef.createElement('span');
          pip.className = 'olings-clash-tag-resource__pip';
          pips.append(pip);
        }
        while (pips.childElementCount > maximumCharges) {
          pips.lastElementChild?.remove();
        }
        [...pips.children].forEach((pip, index) => {
          pip.classList.toggle('is-active', index < charges);
        });
      }
      const rechargePips = container.querySelector(
        '[data-clash-tag-recharge-pips]'
      );
      if (rechargePips) {
        while (rechargePips.childElementCount < decisiveClashesPerCharge) {
          const pip = documentRef.createElement('span');
          pip.className = 'olings-clash-tag-resource__recharge-pip';
          rechargePips.append(pip);
        }
        while (rechargePips.childElementCount > decisiveClashesPerCharge) {
          rechargePips.lastElementChild?.remove();
        }
        [...rechargePips.children].forEach((pip, index) => {
          pip.classList.toggle('is-active', index < rechargeProgress);
        });
      }
      container.hidden = false;
      container.classList.toggle('is-exhausted', charges === 0);
      container.setAttribute(
        'aria-label',
        `${side === 'local' ? 'Your' : 'Opponent'} Tag charges: ${charges} of ${maximumCharges}. Recharge progress: ${rechargeProgress} of ${decisiveClashesPerCharge} decisive Clashes.`
      );
      return normalizedResource;
    }

    function renderRoster(root, side, team, playerEffects = []) {
      const roster = getRootElements(root).rosters[side];
      if (!roster) return;
      if (
        !renderSignatureChanged(roster, 'Roster', {
          playerEffects,
          team
        })
      ) {
        return;
      }
      const slots = orderRosterSlots(roster, team);

      slots.forEach((slot, index) => {
        if (!slot) return;
        const oling = team[index];
        if (!oling) return;
        const { effects, health, inspectTrigger, name, tag } =
          getRosterSlotElements(slot);

        slot.dataset.olingId = oling.id;
        slot.dataset.teamSlot = String(oling.teamSlot ?? index);
        slot.dataset.rosterOlingKey = getRosterOlingKey(oling, index);
        slot.classList.toggle('is-defeated', oling.health.heartUnits === 0);
        if (name) name.textContent = oling.name;
        renderArt(slot, oling.parts, {
          defeated: oling.health.heartUnits === 0
        });
        const displayedOling =
          index === 0 && playerEffects.length
            ? {
                ...oling,
                effects: [...(oling.effects || []), ...playerEffects]
              }
            : oling;
        renderEffects(effects, displayedOling, effectRenderer);
        healthRenderer?.renderHealth(health, oling.health);
        if (inspectTrigger) {
          const olingId = String(oling.id || '').trim();
          inspectTrigger.dataset.clashInspectSide = side;
          inspectTrigger.dataset.teamSlot = String(oling.teamSlot ?? index);
          if (olingId) inspectTrigger.dataset.olingId = olingId;
          else delete inspectTrigger.dataset.olingId;
          inspectTrigger.setAttribute('role', 'button');
          inspectTrigger.setAttribute('tabindex', '0');
          inspectTrigger.setAttribute(
            'aria-label',
            `View ${oling.name} details`
          );
          inspectTrigger.setAttribute('title', `View ${oling.name} details`);
        }
        if (tag) {
          tag.dataset.teamSlot = String(oling.teamSlot ?? index);
          tag.setAttribute('aria-label', `Tag ${oling.name} into battle`);
          tag.setAttribute('title', `Tag ${oling.name}`);
        }
      });
    }

    function renderFighter(root, side, oling) {
      const fighter = getRootElements(root).fighters[side];
      if (!fighter || !oling) return;
      if (!renderSignatureChanged(fighter, 'Fighter', oling)) return;
      fighter.dataset.olingId = oling.id;
      fighter.classList.toggle('is-defeated', oling.health.heartUnits === 0);
      renderArt(fighter, oling.parts, {
        defeated: oling.health.heartUnits === 0
      });
      const motion = fighter.querySelector('.olings-clash-fighter__motion');
      configureFlight?.(motion, oling, {
        paused: oling.health.heartUnits === 0
      });
    }

    function renderActions(
      root,
      activeOling,
      selectedAction,
      playerEffects = [],
      result = null,
      tagQueued = false
    ) {
      const actionContainer = getRootElements(root).actionContainer;
      if (!actionContainer) return;
      if (
        !renderSignatureChanged(actionContainer, 'Actions', {
          activeOling,
          abilities: getAbilityRenderState(activeOling),
          playerEffects,
          result,
          selectedAction,
          tagQueued
        })
      ) {
        return;
      }
      getRootElements(root).actionButtons.forEach((button) => {
        const action = button.dataset.clashAction;
        const isPassive = action === 'draw';
        const isSelected = !isPassive && selectedAction === action;
        const partKey = actionParts[action];
        const ability = resolveAbility(activeOling, partKey);
        const moveName =
          ability?.name || activeOling?.moves?.[action] || action.toUpperCase();
        const lockEffect = getAbilityLockEffect(activeOling, partKey);
        const abilityLocked = Boolean(lockEffect);
        const actionBlockingEffect = isPassive
          ? null
          : getActionBlockingEffect(
              activeOling,
              playerEffects,
              action,
              partKey
            );
        const actionLocked = Boolean(actionBlockingEffect);
        const cadenceState = getAbilityCadenceState(activeOling, ability, {
          allowPrimed: !abilityLocked && !actionLocked,
          effect: getCadenceEffect(result, 'local', ability?.key)
        });
        const cadenceLabel = getCadenceAriaLabel(moveName, cadenceState);
        const tagSynergyState = getTagSynergyState(ability, {
          blocked: abilityLocked || actionLocked,
          effect: getCadenceEffect(result, 'local', ability?.key),
          resultKnown: Boolean(result),
          tagQueued
        });
        const tagSynergyLabel = getTagSynergyAriaLabel(tagSynergyState);
        button.classList.toggle('is-selected', isSelected);
        button.classList.toggle('is-passive', isPassive);
        button.classList.toggle('is-ability-locked', abilityLocked);
        button.classList.toggle('is-action-locked', actionLocked);
        button.dataset.abilityLocked = String(abilityLocked);
        button.dataset.actionLocked = String(actionLocked);
        applyTagSynergyState(button, tagSynergyState);
        if (isPassive) button.removeAttribute('aria-pressed');
        else button.setAttribute('aria-pressed', String(isSelected));
        const accessibleLabel = isPassive
          ? `Draw passive: ${moveName}`
          : `${action}: ${moveName}`;
        const accessibleLabelWithCadence =
          `${accessibleLabel}. ${cadenceLabel} ${tagSynergyLabel}`.trim();
        button.setAttribute(
          'aria-label',
          actionLocked
            ? `${accessibleLabelWithCadence} Action unavailable because ${
                actionBlockingEffect?.name || 'of an active effect'
              }.`
            : abilityLocked
              ? `${accessibleLabelWithCadence} Ability suppressed${
                  isPassive ? '.' : `; base ${action} remains available.`
                }`
              : accessibleLabelWithCadence
        );
        button.setAttribute(
          'title',
          actionLocked
            ? `${moveName} cannot be selected because ${
                actionBlockingEffect?.name || 'an active effect'
              } prevents this action.`
            : abilityLocked
              ? isPassive
                ? `${moveName} is suppressed and will not activate on a Draw.`
                : `${moveName} is suppressed. The base ${action} remains available.`
              : isPassive
                ? cadenceState
                  ? `${cadenceLabel} Select to view details.`
                  : `${moveName} activates automatically after a survived Draw. Select to view details.`
                : accessibleLabel
        );
        const { image, label } = getActionButtonElements(button);
        if (
          image &&
          ability?.imagePath &&
          image.getAttribute('src') !== ability.imagePath
        ) {
          image.setAttribute('src', ability.imagePath);
        }
        renderAbilityName(label, moveName, cadenceState);
        const currentStateIcon = button.querySelector(
          '[data-clash-ability-state-icon]'
        );
        const stateEffect = actionBlockingEffect || lockEffect;
        const stateIconPath = stateEffect
          ? effectRenderer?.resolveIconPath?.(stateEffect)
          : isPassive
            ? '/images/olings/clash/ui/icons/passive.svg'
            : null;
        if (stateIconPath) {
          const stateLabel = stateEffect
            ? stateEffect.name || 'Ability unavailable'
            : 'Automatic Draw ability';
          if (
            currentStateIcon?.getAttribute('src') === stateIconPath &&
            currentStateIcon.title === stateLabel
          ) {
            return;
          }
          currentStateIcon?.remove();
          const nextStateIcon = createSummaryIcon(
            button.ownerDocument || globalScope.document,
            stateIconPath,
            'olings-clash-action__state-icon'
          );
          nextStateIcon.dataset.clashAbilityStateIcon = '';
          nextStateIcon.title = stateLabel;
          button.append(nextStateIcon);
        } else {
          currentStateIcon?.remove();
        }
      });
    }

    function renderActionSummary(
      root,
      activeOling,
      selectedAction,
      { phase = 'choose-action', result = null, tagQueued = false } = {}
    ) {
      const summary = root?.querySelector?.('[data-clash-action-summary]');
      if (!summary) return null;

      if (
        !renderSignatureChanged(summary, 'ActionSummary', {
          activeOling,
          abilities: getAbilityRenderState(activeOling),
          phase,
          result,
          selectedAction,
          tagQueued
        })
      ) {
        return null;
      }

      const action = String(selectedAction || '').toLowerCase();
      const previousAction = summary.dataset.clashSummaryAction || '';
      const partKey = actionParts[action];
      const ability = partKey ? resolveAbility(activeOling, partKey) : null;
      const moveName =
        ability?.name || activeOling?.moves?.[action] || action.toUpperCase();
      const description =
        ability?.description || 'Ability details are not available yet.';
      const normalizedPhase = String(phase || '').toLowerCase();
      const hasSelection = Boolean(partKey);
      const lockEffect = hasSelection
        ? getAbilityLockEffect(activeOling, partKey)
        : null;
      const abilityLocked = Boolean(lockEffect);
      const cadenceState = getAbilityCadenceState(activeOling, ability, {
        allowPrimed: !abilityLocked,
        effect: getCadenceEffect(result, 'local', ability?.key)
      });
      const cadenceLabel = getCadenceAriaLabel(moveName, cadenceState);
      const tagSynergyState = getTagSynergyState(ability, {
        blocked: abilityLocked,
        effect: getCadenceEffect(result, 'local', ability?.key),
        resultKnown: Boolean(result),
        tagQueued
      });
      const tagSynergyLabel = getTagSynergyAriaLabel(tagSynergyState);
      const isVisible =
        hasSelection &&
        ['choose-action', 'waiting', 'locked', 'reveal', 'resolving'].includes(
          normalizedPhase
        );

      summary.classList.toggle('is-visible', isVisible);
      summary.classList.remove('is-dismissing');
      summary.classList.toggle('is-ability-locked', abilityLocked);
      applyTagSynergyState(summary, tagSynergyState);
      summary.setAttribute('aria-hidden', String(!isVisible));

      if (!hasSelection) {
        summary.removeAttribute('aria-label');
        summary.removeAttribute('data-ability-key');
        summary.removeAttribute('data-clash-summary-action');
        summary.replaceChildren();
        return null;
      }

      const documentRef = summary.ownerDocument || globalScope.document;
      const content = documentRef.createElement('div');
      const copy = documentRef.createElement('p');
      const abilityName = documentRef.createElement('strong');
      const cues = documentRef.createElement('span');
      content.className = 'olings-clash-action-summary__content';
      copy.className = 'olings-clash-action-summary__copy';
      renderSummaryDescription(copy, description);
      renderAbilityName(
        abilityName,
        action === 'draw' ? `DRAW: ${moveName}` : moveName,
        cadenceState
      );
      copy.prepend(abilityName, documentRef.createTextNode(' — '));
      cues.className = 'olings-clash-action-summary__cues';

      if (ability?.imagePath) {
        content.append(
          createSummaryIcon(
            documentRef,
            ability.imagePath,
            'olings-clash-action-summary__ability-icon'
          )
        );
      }
      content.append(copy);
      if (abilityLocked) {
        const lockIconPath = effectRenderer?.resolveIconPath?.(lockEffect);
        if (lockIconPath) {
          cues.append(
            createSummaryIcon(
              documentRef,
              lockIconPath,
              'olings-clash-action-summary__lock-icon'
            )
          );
        }
      }
      if (cues.childElementCount > 0) content.append(cues);

      summary.replaceChildren(content);
      summary.dataset.abilityKey = ability?.key || '';
      summary.dataset.clashSummaryAction = action;
      summary.classList.remove('is-updating');
      if (previousAction && previousAction !== action) {
        void summary.offsetWidth;
        summary.classList.add('is-updating');
      }
      summary.setAttribute(
        'aria-label',
        `${moveName}. ${cadenceLabel} ${tagSynergyLabel} ${description}${
          abilityLocked
            ? ` Ability suppressed; base ${action} remains available.`
            : ''
        }`
      );
      return { ability, abilityLocked, description, moveName };
    }

    function getLastRoundAbility(state, side) {
      const result = state?.lastResult;
      if (!result) return null;
      const storedAbility = result.lastAbilities?.[side];
      if (storedAbility?.name) return storedAbility;

      const selectedAction =
        result.winner === 'draw'
          ? 'draw'
          : side === 'local'
            ? result.localAction
            : result.opponentAction;
      const action = String(selectedAction || '').toLowerCase();
      const partKey = actionParts[action];
      if (!partKey) return null;

      const team = state.teams?.[side] || [];
      const requestedTeamSlot = Number(result.lastAbilityTeamSlots?.[side]);
      const oling = Number.isInteger(requestedTeamSlot)
        ? team.find(
            (candidate) => Number(candidate?.teamSlot) === requestedTeamSlot
          ) || team[0]
        : team[0];
      if (!oling) return null;
      const ability = resolveAbility(oling, partKey);
      const presentation = {
        abilityKey: ability?.key || '',
        action,
        imagePath: ability?.imagePath || '',
        name: String(
          ability?.name || oling.moves?.[action] || action
        ).toUpperCase(),
        partKey,
        teamSlot: Number(oling.teamSlot ?? team.indexOf(oling))
      };
      result.lastAbilities ||= {};
      result.lastAbilities[side] = presentation;
      return presentation;
    }

    function renderLastRoundAbility(root, state, side) {
      const container = getRootElements(root).lastAbilities[side];
      if (!container) return null;
      const presentation = getLastRoundAbility(state, side);
      if (
        !renderSignatureChanged(container, 'LastAbility', {
          presentation,
          winner: state?.lastResult?.winner
        })
      ) {
        return presentation;
      }
      container.hidden = !presentation;
      const winner = state?.lastResult?.winner;
      container.classList.toggle(
        'is-winner',
        Boolean(presentation) && winner === side
      );
      container.classList.toggle(
        'is-loser',
        Boolean(presentation) &&
          ['local', 'opponent'].includes(winner) &&
          winner !== side
      );
      container.classList.toggle(
        'is-draw',
        Boolean(presentation) && winner === 'draw'
      );
      if (!presentation) {
        delete container.dataset.teamSlot;
        delete container.dataset.partKey;
        return null;
      }

      const image = container.querySelector('[data-clash-last-ability-image]');
      const name = container.querySelector('[data-clash-last-ability-name]');
      const action = container.querySelector(
        '[data-clash-last-ability-action]'
      );
      if (image) {
        image.hidden = !presentation.imagePath;
        if (presentation.imagePath) image.src = presentation.imagePath;
        else image.removeAttribute('src');
      }
      if (name) name.textContent = presentation.name;
      if (action) action.textContent = presentation.action.toUpperCase();
      container.dataset.partKey = presentation.partKey;
      container.dataset.teamSlot = String(presentation.teamSlot);
      container.setAttribute(
        'aria-label',
        `${side === 'local' ? 'Your' : 'Opponent'} last ability: ${presentation.name}, ${presentation.action}. View ability details.`
      );
      container.title = `View ${presentation.name}`;
      return presentation;
    }

    function renderLastRoundAbilities(root, state) {
      return {
        local: renderLastRoundAbility(root, state, 'local'),
        opponent: renderLastRoundAbility(root, state, 'opponent')
      };
    }

    function render(root, state) {
      if (!root || !state) return null;
      renderTagResource(root, 'local', state.tagResources?.local);
      renderTagResource(root, 'opponent', state.tagResources?.opponent);
      renderRoster(
        root,
        'local',
        state.teams.local,
        state.playerEffects?.local
      );
      renderRoster(
        root,
        'opponent',
        state.teams.opponent,
        state.playerEffects?.opponent
      );
      renderFighter(root, 'local', state.teams.local[0]);
      renderFighter(root, 'opponent', state.teams.opponent[0]);
      renderActions(
        root,
        state.teams.local[0],
        state.selections.localAction,
        state.playerEffects?.local,
        state.phase === 'resolving' ? state.lastResult : null,
        state.selections.localTagSlot != null
      );

      const { outcome, round } = getRootElements(root);
      if (round) {
        const roundText = String(Math.max(1, state.round));
        if (round.textContent !== roundText) round.textContent = roundText;
      }
      if (outcome) {
        if (outcome.textContent !== state.lastOutcome) {
          outcome.textContent = state.lastOutcome;
        }
        const lastWinner = state.lastResult?.winner;
        const outcomeState =
          lastWinner === 'local'
            ? 'win'
            : lastWinner === 'opponent'
              ? 'loss'
              : lastWinner === 'draw'
                ? 'draw'
                : '';
        if (outcomeState) outcome.dataset.outcome = outcomeState;
        else delete outcome.dataset.outcome;
      }
      renderLastRoundAbilities(root, state);
      return state;
    }

    const cancelScheduledRender = renderScheduler.cancel;
    const flushScheduledRender = renderScheduler.flush;
    const scheduleRender = renderScheduler.schedule;

    return {
      render,
      cancelScheduledRender,
      flushScheduledRender,
      renderAbilityReveal,
      renderActionSummary,
      renderActions,
      renderArt,
      renderEffects,
      renderFighter,
      renderLastRoundAbilities,
      renderTagResource,
      renderRoster,
      scheduleRender
    };
  }

  globalScope.createOlingClashMatchRenderer = createOlingClashMatchRenderer;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = createOlingClashMatchRenderer;
  }
})(typeof window !== 'undefined' ? window : globalThis);
