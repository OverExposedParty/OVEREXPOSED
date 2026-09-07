(function (globalScope) {
  const actionKeys = Object.freeze(['attack', 'guard', 'skill']);
  const sideKeys = Object.freeze(['local', 'opponent']);

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function normalizeKey(value) {
    return String(value || '')
      .trim()
      .toLowerCase();
  }

  function titleCase(value) {
    return normalizeKey(value)
      .split(/[-_\s]+/)
      .filter(Boolean)
      .map((part) => part[0].toUpperCase() + part.slice(1))
      .join(' ');
  }

  function toNonNegativeNumber(value, label) {
    const number = Number(value);
    if (!Number.isFinite(number) || number < 0) {
      throw new Error(`${label} must be a non-negative number.`);
    }
    return number;
  }

  function toHeartUnits(value, label = 'Hearts') {
    const hearts = toNonNegativeNumber(value, label);
    const units = hearts * 2;
    if (!Number.isInteger(units)) {
      throw new Error(`${label} must use half-Heart increments.`);
    }
    return units;
  }

  function formatHearts(units) {
    const hearts = Math.max(0, Number(units) || 0) / 2;
    return Number.isInteger(hearts) ? String(hearts) : String(hearts);
  }

  function createOlingClashDebug(options = {}) {
    const snapshots = new Map();
    const stateModel = options.stateModel;
    const resolution = options.resolution;

    function getState() {
      const state = stateModel?.state;
      if (!state) throw new Error('The Olings Clash state is unavailable.');
      return state;
    }

    function ensureMutable() {
      if (options.isOnline?.()) {
        throw new Error(
          'State-changing Clash commands are disabled during online matches.'
        );
      }
    }

    function normalizeSide(side) {
      const normalized = normalizeKey(side);
      if (!sideKeys.includes(normalized)) {
        throw new Error('Side must be local or opponent.');
      }
      return normalized;
    }

    function resolveSlot(side, slot = 'active') {
      const normalizedSide = normalizeSide(side);
      const normalizedSlot = normalizeKey(slot || 'active');
      const slotAliases = {
        active: 0,
        'bench-1': 1,
        bench1: 1,
        'bench-2': 2,
        bench2: 2
      };
      const slotIndex = Object.hasOwn(slotAliases, normalizedSlot)
        ? slotAliases[normalizedSlot]
        : Number(normalizedSlot);
      const team = getState().teams?.[normalizedSide];
      if (
        !Array.isArray(team) ||
        !Number.isInteger(slotIndex) ||
        slotIndex < 0 ||
        slotIndex >= team.length
      ) {
        throw new Error('Slot must be active, bench-1, or bench-2.');
      }
      return { oling: team[slotIndex], side: normalizedSide, slotIndex };
    }

    function render() {
      options.render?.(getState());
      return getState();
    }

    function getStatus() {
      const state = getState();
      return {
        online: Boolean(options.isOnline?.()),
        paused: Boolean(options.isPaused?.()),
        phase: state.phase,
        round: state.round,
        selectedAction:
          options.getPendingAction?.() || state.selections?.localAction || null,
        speed: Number(options.getSpeed?.() || 1),
        winner: state.winner || null
      };
    }

    function pause() {
      ensureMutable();
      if (!options.pause?.()) throw new Error('The Clash is already paused.');
      return getStatus();
    }

    function resume() {
      ensureMutable();
      if (!options.resume?.()) throw new Error('The Clash is already running.');
      return getStatus();
    }

    function reset() {
      ensureMutable();
      options.reset?.();
      return getState();
    }

    function select(action) {
      ensureMutable();
      const normalizedAction = normalizeKey(action);
      if (!actionKeys.includes(normalizedAction)) {
        throw new Error('Ability type must be attack, guard, or skill.');
      }
      if (!options.selectAction?.(normalizedAction)) {
        throw new Error('An ability cannot be selected during this phase.');
      }
      return normalizedAction;
    }

    function confirm() {
      ensureMutable();
      if (!options.confirmAction?.()) {
        throw new Error('Select a valid ability before confirming.');
      }
      return true;
    }

    function forceResult(outcome) {
      ensureMutable();
      const normalizedOutcome = normalizeKey(outcome);
      const selectedAction = normalizeKey(options.getPendingAction?.());
      if (!['win', 'loss', 'draw'].includes(normalizedOutcome)) {
        throw new Error('Result must be win, loss, or draw.');
      }
      if (!actionKeys.includes(selectedAction)) {
        throw new Error('Select an ability before forcing a result.');
      }
      const opponentActions = {
        win: { attack: 'skill', guard: 'attack', skill: 'guard' },
        loss: { attack: 'guard', guard: 'skill', skill: 'attack' },
        draw: {
          attack: 'attack',
          guard: 'guard',
          skill: 'skill'
        }
      };
      const opponentAction = opponentActions[normalizedOutcome][selectedAction];
      if (!options.setOpponentAction?.(opponentAction)) {
        throw new Error(
          'The opponent action cannot be changed during this phase.'
        );
      }
      return {
        opponentAction,
        outcome: normalizedOutcome,
        selectedAction
      };
    }

    function tag(side, slot) {
      ensureMutable();
      const target = resolveSlot(side, slot);
      if (target.slotIndex === 0) {
        throw new Error('Choose bench-1 or bench-2 when tagging.');
      }
      if (Number(target.oling?.health?.heartUnits || 0) <= 0) {
        throw new Error(
          `${target.oling?.name || 'That Oling'} is knocked out.`
        );
      }
      const teamSlot = Number(target.oling?.teamSlot ?? target.slotIndex);
      options.prepareTag?.(target.side, teamSlot);
      if (target.side === 'local') options.panelDown?.();
      const incoming = stateModel.swapActive(target.side, teamSlot);
      if (!incoming) throw new Error('That Oling cannot be tagged in.');
      render();
      const durationMs = Number(options.playTag?.(target.side) || 0);
      if (target.side === 'local') options.panelUp?.(durationMs);
      return incoming;
    }

    function knockout(side, slot = 'active') {
      ensureMutable();
      const target = resolveSlot(side, slot);
      const previousUnits = Number(target.oling.health?.heartUnits || 0);
      target.oling.health.heartUnits = 0;
      target.oling.health.overgrowthUnits = 0;
      target.oling.health.shieldCount = 0;
      render();
      if (target.slotIndex === 0 && target.side === 'local') {
        options.panelDown?.();
      }
      if (target.slotIndex === 0 && previousUnits > 0) {
        options.animateDamage?.(target.side, {
          damageType: 'normal',
          defeated: true,
          heartDamageUnits: previousUnits
        });
      }
      return target.oling;
    }

    function setHealth(side, slot, hearts) {
      ensureMutable();
      const target = resolveSlot(side, slot);
      const units = toHeartUnits(hearts);
      target.oling.health.heartUnits = units;
      target.oling.health.maxHeartUnits = Math.max(
        Number(target.oling.health.maxHeartUnits || 0),
        units,
        1
      );
      render();
      return target.oling.health;
    }

    function damage(side, slot, hearts) {
      ensureMutable();
      const target = resolveSlot(side, slot);
      const units = toHeartUnits(hearts, 'Damage');
      if (units === 0) throw new Error('Damage must be greater than zero.');
      const damageRecord = resolution?.applyNormalDamage?.(
        target.oling.health,
        units
      );
      if (!damageRecord?.health) {
        throw new Error('The Clash damage resolver is unavailable.');
      }
      target.oling.health = damageRecord.health;
      render();
      if (target.slotIndex === 0) {
        options.animateDamage?.(target.side, damageRecord);
      }
      return damageRecord;
    }

    function setShield(side, slot, count) {
      ensureMutable();
      const target = resolveSlot(side, slot);
      const normalizedCount = toNonNegativeNumber(count, 'Shield count');
      if (!Number.isInteger(normalizedCount)) {
        throw new Error('Shield count must be a whole number.');
      }
      target.oling.health.shieldCount = normalizedCount;
      render();
      return target.oling.health;
    }

    function setOvergrowth(side, slot, hearts) {
      ensureMutable();
      const target = resolveSlot(side, slot);
      target.oling.health.overgrowthUnits = toHeartUnits(hearts, 'Overgrowth');
      render();
      return target.oling.health;
    }

    function addEffect(side, slot, effectKey, effectType = 'positive') {
      ensureMutable();
      const target = resolveSlot(side, slot);
      const key = normalizeKey(effectKey);
      const type = normalizeKey(effectType || 'positive');
      if (!key) throw new Error('Provide an effect key.');
      if (!['positive', 'negative'].includes(type)) {
        throw new Error('Effect type must be positive or negative.');
      }
      if (!Array.isArray(target.oling.effects)) target.oling.effects = [];
      target.oling.effects = target.oling.effects.filter(
        (effect) => normalizeKey(effect?.key) !== key
      );
      const name = titleCase(key);
      const effect = {
        abbreviation: name
          .split(' ')
          .map((part) => part[0])
          .join('')
          .slice(0, 3)
          .toUpperCase(),
        key,
        name,
        type
      };
      target.oling.effects.push(effect);
      render();
      return effect;
    }

    function removeEffect(side, slot, effectKey) {
      ensureMutable();
      const target = resolveSlot(side, slot);
      const key = normalizeKey(effectKey);
      const effects = Array.isArray(target.oling.effects)
        ? target.oling.effects
        : [];
      const previousLength = effects.length;
      target.oling.effects = effects.filter(
        (effect) => normalizeKey(effect?.key) !== key
      );
      if (target.oling.effects.length === previousLength) {
        throw new Error(`Effect ${key || '(missing)'} was not found.`);
      }
      render();
      return key;
    }

    function panelDown() {
      ensureMutable();
      return options.panelDown?.();
    }

    function panelUp() {
      ensureMutable();
      return options.panelUp?.(0);
    }

    function animateTag(side, slot) {
      ensureMutable();
      const target = resolveSlot(side, slot);
      if (target.slotIndex === 0) {
        throw new Error('Choose bench-1 or bench-2 for a Tag animation.');
      }
      options.prepareTag?.(
        target.side,
        Number(target.oling?.teamSlot ?? target.slotIndex)
      );
      return options.playTag?.(target.side);
    }

    function animateDamage(side, slot, layer, amount) {
      ensureMutable();
      const target = resolveSlot(side, slot);
      if (target.slotIndex !== 0) {
        throw new Error(
          'Damage feedback can only be shown on the active Oling.'
        );
      }
      const normalizedLayer = normalizeKey(layer);
      if (!['hearts', 'overgrowth', 'shields'].includes(normalizedLayer)) {
        throw new Error('Layer must be hearts, overgrowth, or shields.');
      }
      const normalizedAmount =
        normalizedLayer === 'shields'
          ? toNonNegativeNumber(amount, 'Amount')
          : toHeartUnits(amount, 'Amount');
      if (!Number.isInteger(normalizedAmount) || normalizedAmount <= 0) {
        throw new Error('Amount must be greater than zero.');
      }
      const damageRecord = {
        destroyedShields: normalizedLayer === 'shields' ? normalizedAmount : 0,
        heartDamageUnits: normalizedLayer === 'hearts' ? normalizedAmount : 0,
        overgrowthDamageUnits:
          normalizedLayer === 'overgrowth' ? normalizedAmount : 0
      };
      options.animateDamage?.(target.side, damageRecord);
      return damageRecord;
    }

    function setSpeed(multiplier = 1) {
      ensureMutable();
      const speed = toNonNegativeNumber(multiplier, 'Speed');
      if (speed <= 0) throw new Error('Speed must be greater than zero.');
      if (!options.setSpeed?.(speed)) {
        throw new Error('The Clash speed controller is unavailable.');
      }
      return speed;
    }

    function getTutorial() {
      const tutorial = options.getTutorial?.();
      if (!tutorial) throw new Error('Open the Olings Clash tutorial first.');
      return tutorial;
    }

    function tutorialStep(stepNumber) {
      ensureMutable();
      const number = Number(stepNumber);
      if (!Number.isInteger(number) || number < 1) {
        throw new Error('Tutorial step must be a positive whole number.');
      }
      const tutorial = getTutorial();
      if (!tutorial.goToIndex?.(number - 1)) {
        throw new Error(`Tutorial step ${number} does not exist.`);
      }
      return tutorial.currentStep;
    }

    function tutorialNext() {
      ensureMutable();
      const tutorial = getTutorial();
      tutorial.advance();
      return tutorial.currentStep;
    }

    function tutorialPrevious() {
      ensureMutable();
      const tutorial = getTutorial();
      if (!tutorial.previous?.()) throw new Error('Already at the first step.');
      return tutorial.currentStep;
    }

    function tutorialRestart() {
      ensureMutable();
      options.reset?.();
      const tutorial = getTutorial();
      if (!tutorial.goToIndex?.(0)) {
        throw new Error('The tutorial has no steps.');
      }
      return tutorial.currentStep;
    }

    function tutorialList() {
      const tutorial = getTutorial();
      return (tutorial.steps || []).map((step, index) => ({
        current: step === tutorial.currentStep,
        id: step.id || `step-${index + 1}`,
        number: index + 1,
        title: step.title || ''
      }));
    }

    function saveSnapshot(name) {
      ensureMutable();
      const key = normalizeKey(name);
      if (!key) throw new Error('Provide a snapshot name.');
      snapshots.set(key, {
        state: clone(getState()),
        ui: clone(options.getUiState?.() || {})
      });
      return key;
    }

    function restoreSnapshot(name) {
      ensureMutable();
      const key = normalizeKey(name);
      const snapshot = snapshots.get(key);
      if (!snapshot)
        throw new Error(`Snapshot ${key || '(missing)'} was not found.`);
      options.pause?.();
      const state = getState();
      Object.keys(state).forEach((stateKey) => delete state[stateKey]);
      Object.assign(state, clone(snapshot.state));
      options.restoreUiState?.(clone(snapshot.ui));
      render();
      return state;
    }

    function listSnapshots() {
      return [...snapshots.keys()].sort();
    }

    function deleteSnapshot(name) {
      ensureMutable();
      const key = normalizeKey(name);
      if (!snapshots.delete(key)) {
        throw new Error(`Snapshot ${key || '(missing)'} was not found.`);
      }
      return key;
    }

    function printState() {
      return clone(getState());
    }

    async function copyState() {
      const serialized = JSON.stringify(getState(), null, 2);
      const clipboard = options.clipboard || globalScope.navigator?.clipboard;
      if (!clipboard?.writeText) {
        throw new Error('Clipboard access is unavailable in this browser.');
      }
      await clipboard.writeText(serialized);
      return serialized;
    }

    const api = {
      actionKeys,
      addEffect,
      animateDamage,
      animateTag,
      confirm,
      copyState,
      damage,
      deleteSnapshot,
      forceResult,
      formatHearts,
      getStatus,
      health: setHealth,
      knockout,
      listSnapshots,
      panel: {
        down: panelDown,
        up: panelUp
      },
      pause,
      printState,
      removeEffect,
      reset,
      restoreSnapshot,
      resume,
      saveSnapshot,
      select,
      shield: setShield,
      snapshot: saveSnapshot,
      speed: setSpeed,
      status: getStatus,
      setHealth,
      setOvergrowth,
      setShield,
      setSpeed,
      sideKeys,
      tag,
      overgrowth: setOvergrowth,
      restore: restoreSnapshot,
      tutorial: {
        list: tutorialList,
        next: tutorialNext,
        previous: tutorialPrevious,
        restart: tutorialRestart,
        step: tutorialStep
      }
    };

    return api;
  }

  globalScope.createOlingClashDebug = createOlingClashDebug;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = createOlingClashDebug;
  }
})(typeof window !== 'undefined' ? window : globalThis);
