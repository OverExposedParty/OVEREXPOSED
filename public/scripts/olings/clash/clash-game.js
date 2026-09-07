(function () {
  const gameRoot = document.querySelector('[data-clash-game]');
  if (!gameRoot) return;
  const isTutorial = /^\/olings\/clash\/tutorial\/?$/i.test(
    window.location.pathname
  );
  const tutorialGameplay = {
    abilityEffects: !isTutorial,
    abilityInformation: !isTutorial
  };
  const actionParts = Object.freeze({
    attack: 'mouth',
    draw: 'eyes',
    guard: 'body',
    skill: 'flight'
  });

  function applyTutorialStartingExtras(root) {
    if (!isTutorial || !root?.querySelector) return;

    const activeLocal = root.querySelector(
      '[data-clash-roster="local"] [data-clash-roster-slot="active"]'
    );
    const firstLocalBench = root.querySelector(
      '[data-clash-roster="local"] [data-clash-roster-slot="bench-1"]'
    );
    const activeLocalHealth = root.querySelector(
      '[data-clash-roster="local"] [data-clash-roster-slot="active"] [data-clash-health]'
    );
    const firstLocalBenchHealth = firstLocalBench?.querySelector(
      '[data-clash-health]'
    );
    const activeEnemyHealth = root.querySelector(
      '[data-clash-roster="opponent"] [data-clash-roster-slot="active"] [data-clash-health]'
    );
    const secondEnemyHealth = root.querySelector(
      '[data-clash-roster="opponent"] [data-clash-roster-slot="bench-1"] [data-clash-health]'
    );
    const thirdEnemy = root.querySelector(
      '[data-clash-roster="opponent"] [data-clash-roster-slot="bench-2"]'
    );
    const thirdEnemyHealth = thirdEnemy?.querySelector('[data-clash-health]');

    function applyLocalOlingPreset(slot, { moves, name, partPrefix }) {
      if (!slot) return;
      Object.entries(moves).forEach(([action, move]) => {
        slot.dataset[`move${action[0].toUpperCase()}${action.slice(1)}`] = move;
      });
      ['flight', 'body', 'eyes', 'mouth'].forEach((part) => {
        const layer = slot.querySelector(
          `.olings-clash-oling-layer.is-${part}`
        );
        if (layer) {
          layer.src = `/images/olings/builds/${part}/base/${partPrefix}-${part === 'flight' ? 'wings' : part}.svg`;
        }
      });
      const nameElement = slot.querySelector(
        '.olings-clash-roster-slot__status > strong'
      );
      if (nameElement) nameElement.textContent = name;
      slot
        .querySelector('[data-clash-effects]')
        ?.setAttribute('aria-label', `${name} active effects`);
      const tagButton = slot.querySelector('[data-clash-tag-button]');
      if (tagButton) {
        tagButton.setAttribute('aria-label', `Tag ${name} into battle`);
        tagButton.title = `Tag ${name}`;
      }
    }

    applyLocalOlingPreset(activeLocal, {
      moves: {
        attack: 'CRUSH',
        draw: 'HARDEN',
        guard: 'FORTIFY',
        skill: 'REINFORCE'
      },
      name: 'PEBBLE',
      partPrefix: 'stone'
    });
    applyLocalOlingPreset(firstLocalBench, {
      moves: {
        attack: 'MEND',
        draw: 'CANOPY',
        guard: 'CLEANSE',
        skill: 'WILD GROWTH'
      },
      name: 'MOSSY',
      partPrefix: 'moss'
    });
    if (activeLocalHealth) {
      activeLocalHealth.dataset.heartUnits = '1';
      activeLocalHealth.dataset.overgrowthUnits = '0';
      activeLocalHealth.dataset.shieldCount = '0';
    }
    if (firstLocalBenchHealth) {
      firstLocalBenchHealth.dataset.heartUnits = '6';
      firstLocalBenchHealth.dataset.overgrowthUnits = '0';
      firstLocalBenchHealth.dataset.shieldCount = '0';
    }
    if (activeEnemyHealth) {
      activeEnemyHealth.dataset.heartUnits = '6';
      activeEnemyHealth.dataset.overgrowthUnits = '0';
      activeEnemyHealth.dataset.shieldCount = '0';
    }
    if (secondEnemyHealth) {
      secondEnemyHealth.dataset.heartUnits = '6';
      secondEnemyHealth.dataset.overgrowthUnits = '0';
      secondEnemyHealth.dataset.shieldCount = '0';
    }
    if (thirdEnemy) {
      thirdEnemy.dataset.moveAttack = 'MEND';
      thirdEnemy.dataset.moveDraw = 'CANOPY';
      thirdEnemy.dataset.moveGuard = 'CLEANSE';
      thirdEnemy.dataset.moveSkill = 'WILD GROWTH';
      thirdEnemy.dataset.flightType = 'wings';
      thirdEnemy.dataset.flightMotion = 'flutter';
      thirdEnemy.dataset.flightSpeed = '1';
      ['flight', 'body', 'eyes', 'mouth'].forEach((part) => {
        const layer = thirdEnemy.querySelector(
          `.olings-clash-oling-layer.is-${part}`
        );
        if (layer)
          layer.src = `/images/olings/builds/${part}/base/moss-${part === 'flight' ? 'wings' : part}.svg`;
      });
      const name = thirdEnemy.querySelector(
        '.olings-clash-roster-slot__status > strong'
      );
      if (name) name.textContent = 'MOSS';
      const effects = thirdEnemy.querySelector('[data-clash-effects]');
      effects?.setAttribute('aria-label', 'Moss active effects');
    }
    if (thirdEnemyHealth) {
      thirdEnemyHealth.dataset.overgrowthUnits = '2';
      thirdEnemyHealth.dataset.shieldCount = '0';
    }
  }

  if (isTutorial) {
    const page = document.querySelector('.olings-clash-page');
    const lobby = document.querySelector('.olings-clash-lobby');
    page?.classList.remove('is-lobby');
    if (lobby) {
      lobby.hidden = true;
      lobby.setAttribute('aria-hidden', 'true');
    }
    gameRoot.hidden = false;
    gameRoot.setAttribute('aria-hidden', 'false');
    gameRoot.removeAttribute('data-clash-online');
    gameRoot.setAttribute('data-clash-tutorial', '');
  }

  applyTutorialStartingExtras(gameRoot);

  const clashAudio = window.createOlingClashAudio?.();
  let clashAudioRegistration = null;
  function ensureClashAudioRegistered() {
    if (!clashAudioRegistration) {
      clashAudioRegistration =
        clashAudio?.register?.() || Promise.resolve(false);
    }
    return clashAudioRegistration;
  }
  ['pointerdown', 'keydown'].forEach((eventName) => {
    window.addEventListener(eventName, ensureClashAudioRegistered, {
      capture: true,
      once: true
    });
  });
  const effectRenderer = window.createOlingClashEffectRenderer?.();
  const damageFeedback = window.createOlingClashDamageFeedback?.();
  const combatMotion = window.createOlingClashCombatMotion?.({
    onCollision: () => clashAudio?.playCollision()
  });
  const tagMotion = window.createOlingClashTagMotion?.({
    onCollision: () => clashAudio?.playTag()
  });
  const rosterTagExitDurationMs = 280;
  const healthRenderer = window.createOlingClashHealthRenderer?.();
  const phaseRenderer = window.createOlingClashPhaseRenderer?.();
  const timer = window.createOlingClashTimer?.();
  const stateModel = window.createOlingClashState?.({ root: gameRoot });
  const resolution = window.createOlingClashResolution?.();
  const opponent = window.createOlingClashDemoOpponent?.();
  let inspector = window.createOlingClashInspector?.({
    effectRenderer,
    healthRenderer
  });
  let inspectorLoadPromise = null;
  let abilityCatalogPromise = null;

  function initializeInspector() {
    if (!inspector && window.createOlingClashInspector) {
      inspector = window.createOlingClashInspector({
        effectRenderer,
        healthRenderer
      });
      if (window.OlingClashGame) window.OlingClashGame.inspector = inspector;
    }
    return inspector;
  }

  function ensureInspectorLoaded() {
    if (initializeInspector()) return Promise.resolve(inspector);
    if (inspectorLoadPromise) return inspectorLoadPromise;

    inspectorLoadPromise = new Promise((resolve) => {
      const script = document.createElement('script');
      const version = String(window.WEBSITE_CACHE_VERSION || '').trim();
      script.src = `/build/olings/clash/clash-inspector.js${
        version ? `?v=${encodeURIComponent(version)}` : ''
      }`;
      script.async = true;
      script.addEventListener('load', () => resolve(initializeInspector()), {
        once: true
      });
      script.addEventListener('error', () => resolve(null), { once: true });
      document.head.append(script);
    });
    return inspectorLoadPromise;
  }

  function ensureAbilityCatalogLoaded() {
    if (!abilityCatalogPromise) {
      abilityCatalogPromise = ensureInspectorLoaded()
        .then((loadedInspector) => loadedInspector?.loadAbilityCatalog?.() || 0)
        .then((count) => {
          matchRenderer?.render(gameRoot, stateModel?.state);
          renderActionSelection();
          if (inspector?.isOpen()) inspector.render(gameRoot);
          return count;
        })
        .catch(() => 0);
    }
    return abilityCatalogPromise;
  }

  function getFlightTrait(oling = {}) {
    const trait =
      oling.flightTrait ||
      oling.traits?.flight ||
      oling.snapshot?.traits?.flight ||
      oling.source?.traits?.flight ||
      {};
    return {
      flightMotion: oling.flightMotion || trait.flightMotion || '',
      flightSpeed: oling.flightSpeed || trait.flightSpeed || 1,
      flightType: oling.flightType || trait.flightType || ''
    };
  }

  function configureActiveOlingFlight(container, oling, options = {}) {
    if (!container || !oling) return null;
    const flightLayer = container.querySelector(
      '.olings-clash-oling-layer.is-flight'
    );
    return window.OlingFlightMotion?.configure?.(
      container,
      getFlightTrait(oling),
      {
        flightLayer,
        paused: Boolean(options.paused)
      }
    );
  }

  function resolveClashAbility(oling, partKey) {
    const snapshotAbility = oling?.snapshot?.abilities?.find(
      (ability) => ability?.layer === partKey
    );
    const catalogAbility = inspector?.getAbility(oling, partKey) || null;
    if (!snapshotAbility) return catalogAbility;

    const snapshotRevision = Number(snapshotAbility.revision);
    const catalogRevision = Number(catalogAbility?.revision);
    const matchesCurrentCatalog =
      catalogAbility?.key === snapshotAbility.key &&
      Number.isInteger(snapshotRevision) &&
      snapshotRevision === catalogRevision;
    if (!matchesCurrentCatalog) return snapshotAbility;

    return {
      ...snapshotAbility,
      description: catalogAbility.description || snapshotAbility.description,
      imagePath: catalogAbility.imagePath || snapshotAbility.imagePath,
      name: catalogAbility.name || snapshotAbility.name
    };
  }

  const matchRenderer = window.createOlingClashMatchRenderer?.({
    configureFlight: configureActiveOlingFlight,
    effectRenderer,
    healthRenderer,
    resolveAbility: resolveClashAbility
  });

  function renderMatchState(state, { defer = false } = {}) {
    if (defer && typeof matchRenderer?.scheduleRender === 'function') {
      return matchRenderer.scheduleRender(gameRoot, state);
    }
    return matchRenderer?.render(gameRoot, state);
  }
  const picker = window.createOlingClashPicker?.({
    effectRenderer,
    healthRenderer
  });
  const pickerContainer = gameRoot.querySelector('[data-clash-picker]');
  const phaseContainer = gameRoot.querySelector('[data-clash-phase]');
  const timerContainer = gameRoot.querySelector('[data-clash-timer]');
  const actionContainer = gameRoot.querySelector('[data-clash-actions]');
  const actionButtons = [
    ...(actionContainer?.querySelectorAll('[data-clash-action]') || [])
  ];
  const actionConfirmButton = gameRoot.querySelector(
    '[data-clash-action-confirm]'
  );
  const opponentActionTarget = gameRoot.querySelector(
    '[data-clash-action-confirm-target]'
  );
  const tagButtons = [...gameRoot.querySelectorAll('[data-clash-tag-button]')];
  const tagSpinStopHandlers = new WeakMap();
  const endGame = gameRoot.querySelector('[data-clash-end-game]');
  const endGameResult = gameRoot.querySelector('[data-clash-end-result]');
  const endGameDetail = gameRoot.querySelector('[data-clash-end-detail]');
  const matchControls = gameRoot.querySelector('[data-clash-match-controls]');
  const rematchButton = gameRoot.querySelector('[data-clash-rematch]');
  const backLobbyButton = gameRoot.querySelector('[data-clash-back-lobby]');
  const clashMenuAction = document.querySelector('[data-clash-menu-action]');
  const forfeitDialog = document.querySelector('[data-clash-forfeit-dialog]');
  const forfeitEyebrow = forfeitDialog?.querySelector(
    '[data-clash-forfeit-eyebrow]'
  );
  const forfeitTitle = forfeitDialog?.querySelector(
    '[data-clash-forfeit-title]'
  );
  const forfeitCopy = forfeitDialog?.querySelector('[data-clash-forfeit-copy]');
  const forfeitStatus = forfeitDialog?.querySelector(
    '[data-clash-forfeit-status]'
  );
  const forfeitCancelButton = forfeitDialog?.querySelector(
    '[data-clash-forfeit-cancel]'
  );
  const forfeitConfirmButton = forfeitDialog?.querySelector(
    '[data-clash-forfeit-confirm]'
  );
  let selectedTagButton = null;
  let pendingAction = null;
  let inspectedAction = null;
  let resultAction = null;
  let resultActionFailed = false;
  let flow = null;
  let onlineMatch = null;
  let onlineAccountId = '';
  let onlineActionPending = false;
  let onlineReplacementPending = false;
  let onlineRoundTimeout = null;
  let onlineDeadlineWatchdog = null;
  let onlineExpiredDeadlineKey = '';
  let onlineDraftQueue = Promise.resolve();
  let queuedOnlineMatch = null;
  const queuedOnlineReplacementPayloads = [];
  let lastOnlineRoundKey = '';
  let lastOnlineReplacementKey = '';
  let rematchRequestPending = false;
  let gameplayPaused = isTutorial;
  let tutorialActionInputEnabled = false;
  let tutorialConfirmSuppressed = false;
  let tutorialTagInputEnabled = false;
  let localTagPanelExitReadyAt = 0;
  let localTagPanelTimer = null;
  let forfeitRequestPending = false;
  let forfeitPreviousFocus = null;
  let handledForfeitArchiveId = null;

  healthRenderer?.initialize(gameRoot);

  function clearOnlineDeadlineWatchdog({ clearKey = false } = {}) {
    if (onlineDeadlineWatchdog !== null) {
      window.clearTimeout(onlineDeadlineWatchdog);
    }
    onlineDeadlineWatchdog = null;
    if (clearKey) onlineExpiredDeadlineKey = '';
  }

  function createOnlineDeadlineContext(match = onlineMatch) {
    const deadline = Date.parse(match?.phaseEndsAt);
    const round = Number(match?.round);
    if (
      !match?.matchCode ||
      !match?.gameId ||
      match.status !== 'active' ||
      match.phase !== 'selection' ||
      !Number.isInteger(round) ||
      round < 1 ||
      !Number.isFinite(deadline)
    ) {
      return null;
    }
    return {
      gameId: String(match.gameId),
      matchCode: String(match.matchCode),
      phaseEndsAt: new Date(deadline).toISOString(),
      round
    };
  }

  function onlineDeadlineContextMatches(context, match = onlineMatch) {
    const current = createOnlineDeadlineContext(match);
    return Boolean(
      context &&
      current &&
      context.gameId === current.gameId &&
      context.matchCode === current.matchCode &&
      context.phaseEndsAt === current.phaseEndsAt &&
      context.round === current.round
    );
  }

  function getOnlineDeadlineContextKey(context) {
    if (!context) return '';
    return [
      context.gameId,
      context.matchCode,
      context.round,
      context.phaseEndsAt
    ].join(':');
  }

  function queueOnlineSelectionDraft(effectChoice = null) {
    const context = createOnlineDeadlineContext();
    if (!context || getOnlinePlayers().local?.selectionCommitted) {
      return Promise.resolve(null);
    }
    const draft = {
      action: pendingAction || null,
      effectChoice,
      tagTeamSlot: getSelectedTagTeamSlot()
    };
    onlineDraftQueue = onlineDraftQueue
      .catch(() => null)
      .then(async () => {
        if (!onlineDeadlineContextMatches(context)) return null;
        const response = await fetch(
          `/api/olings/clashes/${encodeURIComponent(context.matchCode)}/action-draft`,
          {
            method: 'POST',
            credentials: 'same-origin',
            headers: {
              Accept: 'application/json',
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(draft)
          }
        );
        const payload = (await response.json().catch(() => ({}))) || {};
        if (!response.ok || payload.success === false) return null;
        return payload.match || null;
      });
    return onlineDraftQueue;
  }

  function getCurrentPhase() {
    return (
      stateModel?.state?.phase || phaseContainer?.dataset.phase || 'waiting'
    );
  }

  function getActionPanelTransitionMs() {
    if (!actionContainer) return 0;
    const style = window.getComputedStyle(actionContainer);
    const durations = String(style.transitionDuration || '')
      .split(',')
      .map((value) => value.trim())
      .map((value) =>
        value.endsWith('ms')
          ? Number.parseFloat(value)
          : Number.parseFloat(value) * 1000
      );
    const delays = String(style.transitionDelay || '')
      .split(',')
      .map((value) => value.trim())
      .map((value) =>
        value.endsWith('ms')
          ? Number.parseFloat(value)
          : Number.parseFloat(value) * 1000
      );
    return Math.max(
      0,
      ...durations.map(
        (duration, index) =>
          (Number.isFinite(duration) ? duration : 0) +
          (Number.isFinite(delays[index % Math.max(delays.length, 1)])
            ? delays[index % Math.max(delays.length, 1)]
            : 0)
      )
    );
  }

  function beginLocalTagActionPanelExit() {
    if (!actionContainer) return 0;
    if (actionContainer.classList.contains('is-tag-switching')) {
      return Math.max(0, localTagPanelExitReadyAt - Date.now());
    }
    if (localTagPanelTimer !== null) {
      window.clearTimeout(localTagPanelTimer);
      localTagPanelTimer = null;
    }
    actionContainer.classList.add('is-tag-switching');
    actionContainer.setAttribute('aria-hidden', 'true');
    const transitionMs = getActionPanelTransitionMs();
    localTagPanelExitReadyAt = Date.now() + transitionMs;
    return transitionMs;
  }

  function finishLocalTagActionPanelEntry() {
    if (!actionContainer) return false;
    if (localTagPanelTimer !== null) {
      window.clearTimeout(localTagPanelTimer);
      localTagPanelTimer = null;
    }
    localTagPanelExitReadyAt = 0;
    actionContainer.classList.remove('is-tag-switching');
    actionContainer.removeAttribute('aria-hidden');
    return true;
  }

  function scheduleLocalTagActionPanelEntry(
    durationMs,
    { completedTagSlot = null } = {}
  ) {
    if (!actionContainer) {
      if (completedTagSlot !== null) finishTagButtonSpin(completedTagSlot);
      return false;
    }
    if (localTagPanelTimer !== null) {
      window.clearTimeout(localTagPanelTimer);
    }
    const delayMs = Math.max(0, Number(durationMs) || 0);
    const finishEntry = () => {
      const finished = finishLocalTagActionPanelEntry();
      if (completedTagSlot !== null) {
        finishTagButtonSpin(completedTagSlot);
      }
      return finished;
    };
    if (delayMs <= 0) return finishEntry();
    localTagPanelTimer = window.setTimeout(finishEntry, delayMs);
    return true;
  }

  function renderActionSelection() {
    const phase = getCurrentPhase();
    const submittedAction = stateModel?.state?.selections?.localAction || null;
    const selectedAction =
      phase === 'choose-action'
        ? pendingAction
        : resultAction || submittedAction || pendingAction;
    const summaryAction =
      phase === 'choose-action'
        ? inspectedAction || selectedAction
        : phase === 'locked'
          ? submittedAction || pendingAction
          : selectedAction || submittedAction;
    const canChooseAction = !gameplayPaused || tutorialActionInputEnabled;
    const canConfirm =
      canChooseAction && phase === 'choose-action' && Boolean(pendingAction);

    actionButtons.forEach((button) => {
      const isPassive = button.hasAttribute('data-clash-passive');
      const isSelected = button.dataset.clashAction === selectedAction;
      button.classList.toggle('is-selected', isSelected);
      button.classList.toggle(
        'is-unsuccessful',
        isSelected && resultActionFailed && !isPassive
      );
      if (isPassive) button.removeAttribute('aria-pressed');
      else button.setAttribute('aria-pressed', String(isSelected));
    });
    if (actionConfirmButton) {
      actionConfirmButton.disabled = !canConfirm;
    }
    actionContainer?.classList.toggle(
      'is-confirm-ready',
      canConfirm && !tutorialConfirmSuppressed
    );
    if (opponentActionTarget) {
      opponentActionTarget.classList.toggle('is-confirm-ready', canConfirm);
      opponentActionTarget.setAttribute('aria-disabled', String(!canConfirm));
      opponentActionTarget.setAttribute('tabindex', canConfirm ? '0' : '-1');
      opponentActionTarget.setAttribute(
        'aria-label',
        canConfirm
          ? `Confirm ${pendingAction} against the opponent`
          : 'Select an ability before targeting the opponent'
      );
    }
    matchRenderer?.renderActionSummary?.(
      gameRoot,
      stateModel?.state?.teams?.local?.[0],
      tutorialGameplay.abilityInformation ? summaryAction : null,
      {
        phase,
        result: phase === 'resolving' ? stateModel?.state?.lastResult : null,
        tagQueued: stateModel?.state?.selections?.localTagSlot != null
      }
    );
  }

  function configureTutorialGameplay(config = {}) {
    if (!isTutorial) return null;
    ['abilityEffects', 'abilityInformation'].forEach((key) => {
      if (typeof config[key] === 'boolean') {
        tutorialGameplay[key] = config[key];
      }
    });
    renderActionSelection();
    return { ...tutorialGameplay };
  }

  function toggleAction(action) {
    if (
      (gameplayPaused && !tutorialActionInputEnabled) ||
      getCurrentPhase() !== 'choose-action'
    ) {
      return null;
    }
    const normalizedAction = String(action || '').toLowerCase();
    if (!['attack', 'guard', 'skill'].includes(normalizedAction)) return null;
    inspectedAction = null;
    const isDeselecting = pendingAction === normalizedAction;
    pendingAction = isDeselecting ? null : normalizedAction;
    if (isDeselecting) clashAudio?.playAbilityDeselect();
    else clashAudio?.playAbilitySelect();
    renderActionSelection();
    if (onlineMatch?.matchCode) queueOnlineSelectionDraft();
    return pendingAction;
  }

  function submitClashAction(action, effectChoice = null) {
    if (onlineMatch?.matchCode) {
      submitOnlineAction(action, effectChoice).catch((error) => {
        onlineActionPending = false;
        if (
          [
            'oling_clash_selection_closed',
            'oling_clash_selection_committed',
            'oling_clash_selection_stale'
          ].includes(error?.code)
        ) {
          handleOnlineDeadlineExpired(createOnlineDeadlineContext());
          return;
        }
        if (stateModel?.state) stateModel.state.phase = 'choose-action';
        updatePhase({
          phase: 'choose-action',
          phaseDurationMs: getOnlineFlowDurations().action,
          phaseEndsAt: onlineMatch?.phaseEndsAt
        });
        showResult('ACTION FAILED', error?.message || 'Please try again.');
      });
      return true;
    }
    return Boolean(flow?.selectAction(action, effectChoice));
  }

  function getActionTargetTeamSlot(index) {
    return Number(stateModel?.state?.teams?.local?.[index]?.teamSlot ?? index);
  }

  function createRandomRequiredEffectChoice(action) {
    if (!tutorialGameplay.abilityEffects) return null;
    const normalizedAction = String(action || '')
      .trim()
      .toLowerCase();
    const activeOling = stateModel?.state?.teams?.local?.[0];
    const moveName = String(activeOling?.moves?.[normalizedAction] || '')
      .trim()
      .toLowerCase();
    let abilityKey = null;
    let choices = [];
    if (
      normalizedAction === 'guard' &&
      moveName === 'cleanse' &&
      typeof resolution?.getValidCleanseChoices === 'function'
    ) {
      abilityKey = 'moss-cleanse';
      choices = resolution.getValidCleanseChoices(stateModel.state.teams.local);
    } else if (
      normalizedAction === 'skill' &&
      moveName === 'reinforce' &&
      typeof resolution?.getValidPartWardChoices === 'function'
    ) {
      abilityKey = 'stone-reinforce';
      choices = resolution.getValidPartWardChoices(
        stateModel.state.teams.local
      );
    } else if (
      normalizedAction === 'skill' &&
      moveName === 'transfusion' &&
      typeof resolution?.getValidHeartTransferChoices === 'function'
    ) {
      abilityKey = 'vampire-transfusion';
      choices = resolution.getValidHeartTransferChoices(
        stateModel.state.teams.local,
        1
      );
    }
    if (!abilityKey || choices.length === 0) return null;
    const choice = choices[Math.floor(Math.random() * choices.length)];
    return {
      abilityKey,
      targetTeamSlot: getActionTargetTeamSlot(choice.abilityTargetTeamSlot),
      optionKey: choice.optionKey
    };
  }

  function confirmAction() {
    if (
      gameplayPaused ||
      getCurrentPhase() !== 'choose-action' ||
      !pendingAction
    ) {
      return false;
    }
    const activeOling = stateModel?.state?.teams?.local?.[0];
    const moveName = String(activeOling?.moves?.[pendingAction] || '')
      .trim()
      .toLowerCase();
    if (!tutorialGameplay.abilityEffects) {
      return submitClashAction(pendingAction);
    }
    if (
      pendingAction === 'guard' &&
      moveName === 'cleanse' &&
      typeof resolution?.getValidCleanseChoices === 'function'
    ) {
      const choices = resolution.getValidCleanseChoices(
        stateModel.state.teams.local
      );
      if (choices.length === 0) {
        return submitClashAction(pendingAction);
      }
      if (choices.length === 1) {
        const [choice] = choices;
        return submitClashAction('guard', {
          abilityKey: 'moss-cleanse',
          targetTeamSlot: getActionTargetTeamSlot(choice.abilityTargetTeamSlot),
          optionKey: choice.optionKey
        });
      }
      const eligibleTargetIndexes = [
        ...new Set(choices.map((choice) => choice.abilityTargetTeamSlot))
      ];
      const choiceOptions = [
        ...new Map(
          choices.map((choice) => [
            choice.optionKey,
            {
              imagePath:
                effectRenderer?.resolveIconPath?.({
                  key: choice.statusKey
                }) || '',
              key: choice.optionKey,
              label: String(
                choice.statusName || choice.optionKey
              ).toUpperCase(),
              presentation: 'effect',
              statusKey: choice.statusKey
            }
          ])
        ).values()
      ];
      return Boolean(
        openPicker({
          choiceOptions,
          confirmLabel: 'CONFIRM CLEANSE',
          isChoiceEligible: (choiceKey, _oling, index) =>
            choices.some(
              (choice) =>
                choice.abilityTargetTeamSlot === index &&
                choice.optionKey === choiceKey
            ),
          isEligible: (_oling, index) =>
            choices.some((choice) => choice.abilityTargetTeamSlot === index),
          hideOlingOptions: eligibleTargetIndexes.length === 1,
          mode: 'friendly-target',
          onConfirm: (index, _oling, optionKey) =>
            submitClashAction('guard', {
              abilityKey: 'moss-cleanse',
              targetTeamSlot: getActionTargetTeamSlot(index),
              optionKey
            }),
          selectedIndex:
            eligibleTargetIndexes.length === 1
              ? eligibleTargetIndexes[0]
              : null,
          title: 'CHOOSE A STATUS TO CLEANSE'
        })
      );
    }
    if (
      pendingAction === 'skill' &&
      moveName === 'reinforce' &&
      typeof resolution?.getValidPartWardChoices === 'function'
    ) {
      const choices = resolution.getValidPartWardChoices(
        stateModel.state.teams.local
      );
      if (choices.length === 1) {
        const [choice] = choices;
        return submitClashAction('skill', {
          abilityKey: 'stone-reinforce',
          targetTeamSlot: getActionTargetTeamSlot(choice.abilityTargetTeamSlot),
          optionKey: choice.optionKey
        });
      }
      const abilityChoices = [
        { action: 'attack', key: 'mouth', partLabel: 'MOUTH' },
        { action: 'guard', key: 'body', partLabel: 'BODY' },
        { action: 'skill', key: 'flight', partLabel: 'WINGS' },
        { action: 'draw', key: 'eyes', partLabel: 'EYES' }
      ].map(({ action, key, partLabel }) => {
        const ability = resolveClashAbility(activeOling, key);
        return {
          imagePath: ability?.imagePath || '',
          key,
          label: String(
            ability?.name || activeOling?.moves?.[action] || action
          ).toUpperCase(),
          meta: `${partLabel} · ${action.toUpperCase()}`,
          presentation: 'ability'
        };
      });
      return Boolean(
        openPicker({
          choiceOptions: abilityChoices,
          confirmLabel: 'CHOOSE AN ABILITY',
          description:
            'Prevent this ability from being disabled once. The Ward is consumed when triggered.',
          getConfirmLabel: (choice) => `PROTECT ${choice.label}`,
          hideOlingOptions: true,
          isChoiceEligible: (choiceKey, _oling, index) =>
            choices.some(
              (choice) =>
                choice.abilityTargetTeamSlot === index &&
                choice.optionKey === choiceKey
            ),
          isEligible: (_oling, index) =>
            choices.some((choice) => choice.abilityTargetTeamSlot === index),
          mode: 'ability-protect',
          olings: [activeOling],
          onConfirm: (index, _oling, optionKey) =>
            submitClashAction('skill', {
              abilityKey: 'stone-reinforce',
              targetTeamSlot: getActionTargetTeamSlot(index),
              optionKey
            }),
          selectedIndex: 0,
          title: 'CHOOSE AN ABILITY TO PROTECT'
        })
      );
    }
    if (
      pendingAction !== 'skill' ||
      moveName !== 'transfusion' ||
      typeof resolution?.getValidHeartTransferChoices !== 'function'
    ) {
      return submitClashAction(pendingAction);
    }

    const choices = resolution.getValidHeartTransferChoices(
      stateModel.state.teams.local,
      1
    );
    if (choices.length === 0) {
      return Boolean(flow?.selectAction(pendingAction));
    }
    if (choices.length === 1) {
      const [choice] = choices;
      return submitClashAction('skill', {
        abilityKey: 'vampire-transfusion',
        targetTeamSlot: getActionTargetTeamSlot(choice.abilityTargetTeamSlot),
        optionKey: choice.optionKey
      });
    }
    const eligibleTargetIndexes = [
      ...new Set(choices.map((choice) => choice.abilityTargetTeamSlot))
    ];

    return Boolean(
      openPicker({
        choiceOptions: [
          { key: 'self-to-bench', label: 'GIVE 1/2 HEART' },
          { key: 'bench-to-self', label: 'RECEIVE 1/2 HEART' }
        ],
        confirmLabel: 'CONFIRM TRANSFUSION',
        isChoiceEligible: (choiceKey, _oling, index) =>
          choices.some(
            (choice) =>
              choice.abilityTargetTeamSlot === index &&
              choice.optionKey === choiceKey
          ),
        isEligible: (_oling, index) =>
          index > 0 &&
          choices.some((choice) => choice.abilityTargetTeamSlot === index),
        hideOlingOptions: eligibleTargetIndexes.length === 1,
        mode: 'friendly-target',
        onConfirm: (index, _oling, optionKey) =>
          submitClashAction('skill', {
            abilityKey: 'vampire-transfusion',
            targetTeamSlot: getActionTargetTeamSlot(index),
            optionKey
          }),
        selectedIndex:
          eligibleTargetIndexes.length === 1 ? eligibleTargetIndexes[0] : null,
        title: 'CHOOSE TRANSFUSION'
      })
    );
  }

  function getSelectedTagTeamSlot() {
    return selectedTagButton?.dataset.teamSlot || null;
  }

  function finalizeTagButtonSpin(button) {
    if (!button) return false;
    const icon = button.querySelector('.olings-clash-tag__icon');
    const stopHandler = tagSpinStopHandlers.get(button);
    if (icon && stopHandler) {
      icon.removeEventListener('animationiteration', stopHandler);
    }
    tagSpinStopHandlers.delete(button);
    button.classList.remove('is-tag-spinning', 'is-tag-finishing-spin');
    return true;
  }

  function startTagButtonSpin(button) {
    if (!button) return false;
    const icon = button.querySelector('.olings-clash-tag__icon');
    const stopHandler = tagSpinStopHandlers.get(button);
    if (icon && stopHandler) {
      icon.removeEventListener('animationiteration', stopHandler);
    }
    tagSpinStopHandlers.delete(button);
    button.classList.remove('is-tag-finishing-spin');
    button.classList.add('is-tag-spinning');
    return true;
  }

  function finishTagButtonSpin(teamSlot = null) {
    const buttons =
      teamSlot === null
        ? tagButtons.filter((button) =>
            button.classList.contains('is-tag-spinning')
          )
        : tagButtons.filter(
            (button) => button.dataset.teamSlot === String(teamSlot)
          );
    buttons.forEach((button) => {
      if (
        !button.classList.contains('is-tag-spinning') ||
        tagSpinStopHandlers.has(button)
      ) {
        return;
      }
      const icon = button.querySelector('.olings-clash-tag__icon');
      if (
        !icon ||
        window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
      ) {
        finalizeTagButtonSpin(button);
        return;
      }
      const stopAfterCurrentRotation = () => finalizeTagButtonSpin(button);
      tagSpinStopHandlers.set(button, stopAfterCurrentRotation);
      button.classList.add('is-tag-finishing-spin');
      icon.addEventListener('animationiteration', stopAfterCurrentRotation, {
        once: true
      });
    });
    return buttons.length > 0;
  }

  function emitTagSelectionChange() {
    const EventConstructor =
      gameRoot.ownerDocument?.defaultView?.CustomEvent || window.CustomEvent;
    gameRoot.dispatchEvent(
      new EventConstructor('oling-clash:tag-selection-change', {
        bubbles: true,
        detail: { teamSlot: getSelectedTagTeamSlot() }
      })
    );
    if (onlineMatch?.matchCode) queueOnlineSelectionDraft();
  }

  function renderTagSelection() {
    tagButtons.forEach((button) => {
      const isSelected = button === selectedTagButton;
      button.classList.toggle('is-selected', isSelected);
      button
        .closest('[data-clash-roster-slot]')
        ?.classList.toggle('is-tag-queued', isSelected);
      button.setAttribute('aria-pressed', String(isSelected));
    });
  }

  function syncTagSelection(state) {
    const previousButton = selectedTagButton;
    const selectedSlot = state?.selections?.localTagSlot;
    selectedTagButton = tagButtons.find(
      (button) => button.dataset.teamSlot === String(selectedSlot)
    );
    if (selectedTagButton) {
      if (previousButton && previousButton !== selectedTagButton) {
        finishTagButtonSpin(previousButton.dataset.teamSlot);
      }
      startTagButtonSpin(selectedTagButton);
    }
    renderTagSelection();
  }

  function clearTagSelection({ emit = true } = {}) {
    if (!selectedTagButton) return null;
    const previousSlot = selectedTagButton.dataset.teamSlot;
    selectedTagButton = null;
    renderTagSelection();
    finishTagButtonSpin(previousSlot);
    if (emit) emitTagSelectionChange();
    return null;
  }

  function selectTag(teamSlot, { emit = true } = {}) {
    const nextButton = tagButtons.find(
      (button) => button.dataset.teamSlot === String(teamSlot)
    );
    if (!nextButton || nextButton.disabled) return getSelectedTagTeamSlot();

    const previousButton = selectedTagButton;
    selectedTagButton = nextButton === selectedTagButton ? null : nextButton;
    renderTagSelection();
    if (previousButton && previousButton !== selectedTagButton) {
      finishTagButtonSpin(previousButton.dataset.teamSlot);
    }
    if (selectedTagButton) startTagButtonSpin(selectedTagButton);
    if (emit) emitTagSelectionChange();
    return getSelectedTagTeamSlot();
  }

  function isLivingBenchSlot(button) {
    if (!stateModel) return true;
    const slot = Number(button.dataset.teamSlot);
    return stateModel.getAvailableBenchSlots('local').includes(slot);
  }

  function hasLocalTagCharge() {
    const resource = stateModel?.state?.tagResources?.local;
    return !resource || Number(resource.charges) > 0;
  }

  function setTagAvailability(phase) {
    const canQueueTag = phase === 'choose-action' && hasLocalTagCharge();
    if (!canQueueTag && phase === 'choose-tag') clearTagSelection();
    tagButtons.forEach((button) => {
      button.disabled = !canQueueTag || !isLivingBenchSlot(button);
    });
  }

  function renderPhaseControls(phase) {
    const isChoosingAction = phase === 'choose-action';
    const isComplete = phase === 'complete';
    const isFightActive = [
      'reveal',
      'resolving',
      'choose-tag',
      'opponent-tag',
      'tagged'
    ].includes(phase);

    actionButtons.forEach((button) => {
      const isBlockedByEffect = button.dataset.actionLocked === 'true';
      const isTutorialPassive =
        tutorialActionInputEnabled && button.hasAttribute('data-clash-passive');
      button.disabled =
        (gameplayPaused && !tutorialActionInputEnabled) ||
        !isChoosingAction ||
        isBlockedByEffect ||
        isTutorialPassive;
    });
    if (actionContainer) {
      actionContainer.hidden = isComplete;
      actionContainer.classList.toggle('is-fight-active', isFightActive);
    }
    if (matchControls) matchControls.hidden = !isComplete;
    renderTagSelection();
    if (gameplayPaused && !tutorialTagInputEnabled) {
      tagButtons.forEach((button) => {
        button.disabled = true;
      });
    }
    renderActionSelection();
  }

  function setGameplayPaused(paused) {
    gameplayPaused = Boolean(paused);
    gameRoot.classList.toggle('is-tutorial-paused', gameplayPaused);
    gameRoot.setAttribute('aria-busy', String(gameplayPaused));
    if (gameplayPaused) timer?.stop({ hide: true });
    renderPhaseControls(getCurrentPhase());
    return gameplayPaused;
  }

  function pauseTutorial() {
    if (!isTutorial) return false;
    tutorialActionInputEnabled = false;
    tutorialTagInputEnabled = false;
    gameRoot.classList.remove(
      'is-tutorial-action-input',
      'is-tutorial-tag-input'
    );
    flow?.pause();
    setGameplayPaused(true);
    return true;
  }

  function setTutorialActionInput(enabled) {
    if (!isTutorial) return false;
    tutorialActionInputEnabled = Boolean(enabled && gameplayPaused);
    if (tutorialActionInputEnabled) tutorialTagInputEnabled = false;
    gameRoot.classList.toggle(
      'is-tutorial-action-input',
      tutorialActionInputEnabled
    );
    gameRoot.classList.toggle('is-tutorial-tag-input', tutorialTagInputEnabled);
    renderPhaseControls(getCurrentPhase());
    return tutorialActionInputEnabled;
  }

  function setTutorialConfirmSuppressed(suppressed) {
    if (!isTutorial) return false;
    tutorialConfirmSuppressed = Boolean(suppressed);
    renderActionSelection();
    return tutorialConfirmSuppressed;
  }

  function setTutorialTagInput(enabled) {
    if (!isTutorial) return false;
    tutorialTagInputEnabled = Boolean(enabled && gameplayPaused);
    if (tutorialTagInputEnabled) tutorialActionInputEnabled = false;
    gameRoot.classList.toggle(
      'is-tutorial-action-input',
      tutorialActionInputEnabled
    );
    gameRoot.classList.toggle('is-tutorial-tag-input', tutorialTagInputEnabled);
    setTagAvailability(getCurrentPhase());
    renderPhaseControls(getCurrentPhase());
    return tutorialTagInputEnabled;
  }

  function resumeTutorial() {
    if (!isTutorial) return false;
    tutorialActionInputEnabled = false;
    tutorialTagInputEnabled = false;
    gameplayPaused = false;
    gameRoot.classList.remove(
      'is-tutorial-paused',
      'is-tutorial-action-input',
      'is-tutorial-tag-input'
    );
    gameRoot.setAttribute('aria-busy', 'false');
    const resumed = flow?.resume();
    if (!resumed) renderPhaseControls(getCurrentPhase());
    return true;
  }

  function setTutorialOpponentToLose() {
    if (!isTutorial || !pendingAction) return false;
    const losingActionByLocalAction = {
      attack: 'skill',
      guard: 'attack',
      skill: 'guard'
    };
    return Boolean(
      flow?.setOpponentAction?.(losingActionByLocalAction[pendingAction])
    );
  }

  function setTutorialOpponentToDraw() {
    if (!isTutorial || !pendingAction) return false;
    return Boolean(flow?.setOpponentAction?.(pendingAction));
  }

  function setTutorialOpponentToWin() {
    if (!isTutorial || !pendingAction) return false;
    const winningActionByLocalAction = {
      attack: 'guard',
      guard: 'skill',
      skill: 'attack'
    };
    return Boolean(
      flow?.setOpponentAction?.(winningActionByLocalAction[pendingAction])
    );
  }

  function setTutorialOpponentQueuedTagSlot(teamSlot) {
    if (!isTutorial) return false;
    return Boolean(flow?.setOpponentQueuedTag?.(Number(teamSlot)));
  }

  function setTutorialOpponentTagSlot(teamSlot) {
    if (!isTutorial) return false;
    return Boolean(flow?.setOpponentTag?.(Number(teamSlot)));
  }

  function setTutorialSelectedAction(action) {
    const normalizedAction = String(action || '').toLowerCase();
    if (
      !isTutorial ||
      !gameplayPaused ||
      getCurrentPhase() !== 'choose-action' ||
      !['attack', 'guard', 'skill'].includes(normalizedAction)
    ) {
      return false;
    }
    pendingAction = normalizedAction;
    inspectedAction = normalizedAction;
    renderActionSelection();
    return true;
  }

  function updatePhase({ phase, phaseEndsAt, phaseDurationMs } = {}) {
    const phaseState = phaseRenderer?.renderPhase(
      phaseContainer,
      phase || phaseContainer?.dataset.phase
    );
    const normalizedPhase = phaseState?.phase || String(phase || 'waiting');
    if (phaseContainer && normalizedPhase === 'locked') {
      phaseContainer.style.setProperty(
        '--clash-lock-duration',
        `${Math.max(1, Number(phaseDurationMs) || 1500)}ms`
      );
    }
    setTagAvailability(normalizedPhase);
    renderPhaseControls(normalizedPhase);

    const showsDecisionTimer = normalizedPhase === 'choose-action';
    if (timer && timerContainer && showsDecisionTimer && phaseEndsAt) {
      timer.start(timerContainer, { phaseDurationMs, phaseEndsAt });
    } else {
      timer?.stop({ hide: true });
    }

    return phaseState;
  }

  function showResult(result, detail = '') {
    const resultState =
      typeof result === 'object' && result !== null
        ? result
        : { detail, result };
    timer?.stop({ hide: true });
    return phaseRenderer?.renderResult(
      phaseContainer,
      resultState.result || resultState.label,
      resultState.detail
    );
  }

  let onlineMatchNormalizer = null;
  function getOnlineMatchNormalizer() {
    if (!onlineMatchNormalizer) {
      onlineMatchNormalizer = window.createOlingClashOnlineMatchNormalizer?.({
        getAccountId: () => onlineAccountId,
        getMatch: () => onlineMatch
      });
    }
    if (!onlineMatchNormalizer) {
      throw new Error('The Oling Clash online normalizer is unavailable.');
    }
    return onlineMatchNormalizer;
  }
  const formatOnlineKey = (...args) =>
    getOnlineMatchNormalizer().formatOnlineKey(...args);
  const getOnlineMatchPhase = (...args) =>
    getOnlineMatchNormalizer().getOnlineMatchPhase(...args);
  const getOnlinePlayers = (...args) =>
    getOnlineMatchNormalizer().getOnlinePlayers(...args);
  const normalizeOnlineEffect = (...args) =>
    getOnlineMatchNormalizer().normalizeOnlineEffect(...args);
  const normalizeOnlineOling = (...args) =>
    getOnlineMatchNormalizer().normalizeOnlineOling(...args);
  const normalizeOnlineTagResource = (...args) =>
    getOnlineMatchNormalizer().normalizeOnlineTagResource(...args);
  const normalizeOnlineTeam = (...args) =>
    getOnlineMatchNormalizer().normalizeOnlineTeam(...args);
  const onlinePlayerNeedsReplacement = (...args) =>
    getOnlineMatchNormalizer().onlinePlayerNeedsReplacement(...args);

  function getLatestOnlineRoundResult(match) {
    if (match?.latestRoundResult) return match.latestRoundResult;
    const events = Array.isArray(match?.events) ? match.events : [];
    for (let index = events.length - 1; index >= 0; index -= 1) {
      const event = events[index];
      if (event?.type !== 'round-resolved') continue;
      return event.payload?.payload || event.payload || null;
    }
    return null;
  }

  function getOnlineMoveActivationStatus(result, playerSlot, outcome) {
    if (outcome === 'loss') return 'failed';
    const playerSlots = Array.isArray(playerSlot) ? playerSlot : [playerSlot];
    const activationStatus = (result?.triggeredStatuses || []).find(
      (status) =>
        playerSlots.includes(status?.playerSlot) &&
        ['activation-suppressed', 'activation-replaced-with-junk'].includes(
          status.outcome
        )
    );
    if (activationStatus?.outcome === 'activation-suppressed') {
      return 'suppressed';
    }
    if (activationStatus) return 'blocked';
    const activations = (result?.activations || []).filter((activation) =>
      playerSlots.includes(activation?.playerSlot)
    );
    const abilityKeys = new Set(
      activations.map((activation) => activation?.abilityKey).filter(Boolean)
    );
    const effects = (result?.effects || []).filter(
      (effect) =>
        (playerSlots.includes(effect?.playerSlot) ||
          playerSlots.includes(effect?.stolenFromPlayerSlot)) &&
        (abilityKeys.has(effect?.abilityKey) ||
          abilityKeys.has(effect?.redirectedByAbilityKey))
    );
    if (
      effects.length > 0 &&
      effects.every(
        (effect) =>
          effect.outcome === 'effect-prevented' ||
          effect.status === 'prevented' ||
          ['blocked', 'warded'].includes(effect.statusResult)
      )
    ) {
      return 'blocked';
    }
    if (
      effects.length > 0 &&
      effects.every(
        (effect) => effect.status === 'progressed' && effect.triggered === false
      )
    ) {
      return 'progressed';
    }
    const inactiveStatuses = new Set([
      'condition-not-met',
      'no-effect',
      'no-target',
      'prevented',
      'progressed'
    ]);
    return effects.some(
      (effect) =>
        effect?.triggered !== false &&
        !inactiveStatuses.has(effect?.status) &&
        effect?.outcome !== 'effect-prevented' &&
        !['blocked', 'warded'].includes(effect?.statusResult)
    )
      ? 'activated'
      : 'revealed';
  }

  function getOnlineLastMoves(match, player) {
    const moves = new Map();
    if (!player?.slot) return moves;
    if (Array.isArray(player.lastMoves)) {
      player.lastMoves.forEach((move) => {
        const teamSlot = Number(move?.teamSlot);
        if (!Number.isInteger(teamSlot) || !actionParts[move?.action]) return;
        moves.set(teamSlot, {
          action: move.action,
          activationStatus: move.activationStatus || 'revealed',
          outcome: move.outcome || 'draw',
          round: Number(move.round || 1)
        });
      });
      return moves;
    }
    let activeTeamSlot = Number(player.activeTeamSlot);
    const events = Array.isArray(match?.events) ? match.events : [];
    for (let index = events.length - 1; index >= 0; index -= 1) {
      const event = events[index];
      const payload = event?.payload?.payload || event?.payload || null;
      if (event?.type === 'replacement-selected') {
        if (payload?.playerSlot === player.slot) {
          activeTeamSlot = Number(payload.previousTeamSlot ?? activeTeamSlot);
        }
        continue;
      }
      if (event?.type !== 'round-resolved' || !payload) continue;
      const tag = (payload.tags || []).find(
        (candidate) => candidate?.playerSlot === player.slot
      );
      const playedTeamSlot = Number(tag?.previousTeamSlot ?? activeTeamSlot);
      const isDraw = payload.outcome === 'draw' || !payload.winnerSlot;
      const selectedAction = payload.actions?.[player.slot];
      const action = isDraw ? 'draw' : selectedAction;
      if (
        Number.isInteger(playedTeamSlot) &&
        actionParts[action] &&
        !moves.has(playedTeamSlot)
      ) {
        const outcome = isDraw
          ? 'draw'
          : payload.winnerSlot === player.slot
            ? 'win'
            : 'loss';
        moves.set(playedTeamSlot, {
          action,
          activationStatus: getOnlineMoveActivationStatus(
            payload,
            player.slot,
            outcome
          ),
          outcome,
          round: Number(payload.round || event.payload?.round || 1)
        });
      }
      activeTeamSlot = playedTeamSlot;
    }
    return moves;
  }

  function createOnlineDisplayResult(result = {}, players = {}) {
    const localSlot = players.local?.slot;
    const opponentSlot = players.opponent?.slot;
    const localAction = result.actions?.[localSlot] || null;
    const opponentAction = result.actions?.[opponentSlot] || null;
    const winner = result.winnerSlot
      ? result.winnerSlot === localSlot
        ? 'local'
        : 'opponent'
      : 'draw';
    const winningAction = String(
      result.actions?.[result.winnerSlot] || ''
    ).toUpperCase();
    const getPreviousActiveTeamSlot = (player) => {
      const tag = (result.tags || []).find(
        (candidate) => candidate.playerSlot === player?.slot
      );
      return Number(tag?.previousTeamSlot ?? player?.activeTeamSlot ?? 0);
    };
    return {
      detail:
        winner === 'draw'
          ? 'BOTH ACTIVE OLINGS TAKE DAMAGE'
          : winner === 'local'
            ? 'YOUR ACTION WINS'
            : 'THE OPPONENT ACTION WINS',
      effects: result.effects || [],
      triggeredStatuses: result.triggeredStatuses || [],
      label:
        winner === 'draw'
          ? 'DRAW'
          : winningAction
            ? `${winningAction} WINS`
            : 'DECISIVE RESULT',
      localAction,
      activationStatus: {
        local: getOnlineMoveActivationStatus(
          result,
          [localSlot, 'local'],
          winner === 'draw' ? 'draw' : winner === 'local' ? 'win' : 'loss'
        ),
        opponent: getOnlineMoveActivationStatus(
          result,
          [opponentSlot, 'opponent'],
          winner === 'draw' ? 'draw' : winner === 'opponent' ? 'win' : 'loss'
        )
      },
      lastAbilityTeamSlots: {
        local: getPreviousActiveTeamSlot(players.local),
        opponent: getPreviousActiveTeamSlot(players.opponent)
      },
      opponentAction,
      round: Number(result.round || 1),
      winner
    };
  }

  function setOnlineLastRoundResult(displayResult) {
    if (!displayResult || !stateModel?.state) return null;
    stateModel.state.lastOutcome = displayResult.label || 'NO RESULT';
    stateModel.state.lastResult = displayResult;
    ['local', 'opponent'].forEach((side) => {
      const teamSlot = Number(displayResult.lastAbilityTeamSlots?.[side]);
      const oling = stateModel.state.teams?.[side]?.find(
        (candidate) => Number(candidate?.teamSlot) === teamSlot
      );
      const action =
        displayResult.winner === 'draw'
          ? 'draw'
          : side === 'local'
            ? displayResult.localAction
            : displayResult.opponentAction;
      if (!oling || !actionParts[action]) return;
      oling.lastMove = {
        action,
        activationStatus: displayResult.activationStatus?.[side] || '',
        outcome:
          displayResult.winner === 'draw'
            ? 'draw'
            : displayResult.winner === side
              ? 'win'
              : 'loss',
        round: Number(displayResult.round || 1)
      };
    });
    const outcome = gameRoot.querySelector('[data-clash-last-outcome]');
    if (outcome) outcome.textContent = stateModel.state.lastOutcome;
    matchRenderer?.renderLastRoundAbilities?.(gameRoot, stateModel.state);
    return displayResult;
  }

  function getOnlineFlowDurations() {
    return {
      action: 15000,
      drawResult: 5000,
      locked: 1500,
      opponentResponse: 2000,
      opponentResponseMinimum: 250,
      result: 5000,
      reveal: 2500,
      tagged: 1400,
      ...(flow?.defaultDurations || {})
    };
  }

  function renderEndGamePlayer(side, player, winner) {
    const container = endGame?.querySelector(
      `[data-clash-end-player="${side}"]`
    );
    if (!container || !player) return;
    const name = container.querySelector('[data-clash-end-player-name]');
    const oe = container.querySelector('[data-clash-end-player-oe]');
    if (name)
      name.textContent =
        side === 'local' ? 'YOU' : player.username || 'OPPONENT';
    if (oe) {
      const layers =
        window.OlingClashOeLayers?.createLayers?.(player.oeIcon, {
          className: 'olings-clash-player__oe-layer'
        }) || [];
      oe.replaceChildren(...layers);
    }
    container.classList.toggle('is-winner', winner === side);
    container.classList.toggle(
      'is-loser',
      winner !== 'draw' && winner !== side
    );
    container.classList.toggle('is-draw', winner === 'draw');
  }

  function syncClashMenuAction() {
    if (!clashMenuAction) return false;
    const showForTutorial = isTutorial;
    const showForOnlineMatch =
      Boolean(onlineMatch?.matchCode) &&
      onlineMatch.status === 'active' &&
      !isOnlineEndGameVisible();
    clashMenuAction.hidden = !(showForTutorial || showForOnlineMatch);
    clashMenuAction.classList.toggle('is-clash-forfeit', showForOnlineMatch);
    clashMenuAction.textContent = showForTutorial
      ? 'EXIT TUTORIAL'
      : 'FORFEIT CLASH';
    return !clashMenuAction.hidden;
  }

  function setForfeitRequestPending(pending) {
    forfeitRequestPending = Boolean(pending);
    if (forfeitCancelButton)
      forfeitCancelButton.disabled = forfeitRequestPending;
    if (forfeitConfirmButton) {
      forfeitConfirmButton.disabled = forfeitRequestPending;
      forfeitConfirmButton.textContent = forfeitRequestPending
        ? isTutorial
          ? 'EXITING'
          : 'FORFEITING'
        : isTutorial
          ? 'EXIT TUTORIAL'
          : 'FORFEIT CLASH';
    }
  }

  function closeForfeitDialog({ restoreFocus = true } = {}) {
    if (!forfeitDialog || forfeitRequestPending) return false;
    forfeitDialog.hidden = true;
    document.removeEventListener('keydown', handleForfeitDialogKeydown);
    if (forfeitStatus) {
      forfeitStatus.hidden = true;
      forfeitStatus.textContent = '';
    }
    if (restoreFocus && forfeitPreviousFocus?.focus) {
      forfeitPreviousFocus.focus();
    }
    forfeitPreviousFocus = null;
    return true;
  }

  function handleForfeitDialogKeydown(event) {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeForfeitDialog();
      return;
    }
    if (event.key !== 'Tab' || !forfeitDialog) return;
    const focusable = [forfeitCancelButton, forfeitConfirmButton].filter(
      (element) => element && !element.disabled
    );
    if (!focusable.length) return;
    const currentIndex = focusable.indexOf(document.activeElement);
    if (event.shiftKey && currentIndex <= 0) {
      event.preventDefault();
      focusable[focusable.length - 1].focus();
    } else if (!event.shiftKey && currentIndex === focusable.length - 1) {
      event.preventDefault();
      focusable[0].focus();
    }
  }

  function openForfeitDialog() {
    if (!forfeitDialog || !syncClashMenuAction()) return false;
    const extraMenu = document.querySelector('.extra-menu-container');
    if (
      extraMenu &&
      typeof window.isContainerVisible === 'function' &&
      window.isContainerVisible(extraMenu)
    ) {
      window.toggleExtraMenu?.();
    }
    if (forfeitEyebrow) {
      forfeitEyebrow.textContent = isTutorial
        ? 'TUTORIAL OPTIONS'
        : 'MATCH OPTIONS';
    }
    if (forfeitTitle) {
      forfeitTitle.textContent = isTutorial
        ? 'EXIT THIS TUTORIAL?'
        : 'FORFEIT THIS CLASH?';
    }
    if (forfeitCopy) {
      forfeitCopy.textContent = isTutorial
        ? 'Your tutorial progress will not be marked as complete.'
        : 'This will end the match immediately and count as a loss.';
    }
    setForfeitRequestPending(false);
    forfeitPreviousFocus = document.activeElement;
    forfeitDialog.hidden = false;
    document.addEventListener('keydown', handleForfeitDialogKeydown);
    forfeitCancelButton?.focus();
    return true;
  }

  function navigateToClashLobby() {
    if (typeof window.transitionSplashScreen === 'function') {
      window.transitionSplashScreen(
        '/olings/clash/settings',
        '/images/splash-screens/olings/clash/settings.png'
      );
      return;
    }
    window.location.assign('/olings/clash/settings');
  }

  function handleOnlineForfeit(payload = {}) {
    const archiveId = String(payload.archiveId || '');
    if (archiveId && archiveId === handledForfeitArchiveId) {
      return null;
    }
    const resolvedMatch = payload.match || payload.resolvedMatch || null;
    const rematchMatch = payload.rematchMatch || null;
    const result = payload.result || payload.forfeitResult || {};
    if (!resolvedMatch) return null;
    if (archiveId) handledForfeitArchiveId = archiveId;
    if (onlineRoundTimeout) {
      window.clearTimeout(onlineRoundTimeout);
      onlineRoundTimeout = null;
    }
    clearOnlineDeadlineWatchdog({ clearKey: true });
    queuedOnlineMatch = null;
    onlineActionPending = false;
    onlineMatch = resolvedMatch;
    applyOnlineMatch(resolvedMatch, {
      phaseOverride: 'complete',
      preserveEndGame: true
    });
    const endState = showOnlineEndGame(result);
    if (rematchMatch) onlineMatch = rematchMatch;
    syncClashMenuAction();
    return endState;
  }

  async function submitOnlineForfeit() {
    const matchCode = onlineMatch?.matchCode;
    if (!matchCode || forfeitRequestPending) return null;
    setForfeitRequestPending(true);
    if (forfeitStatus) {
      forfeitStatus.hidden = true;
      forfeitStatus.textContent = '';
    }
    try {
      const response = await fetch(
        `/api/olings/clashes/${encodeURIComponent(matchCode)}/forfeit`,
        {
          method: 'POST',
          credentials: 'same-origin',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({})
        }
      );
      const payload = (await response.json().catch(() => ({}))) || {};
      if (!response.ok || payload.success === false || !payload.resolvedMatch) {
        throw new Error(
          payload.error?.message || 'This Clash could not be forfeited.'
        );
      }
      setForfeitRequestPending(false);
      closeForfeitDialog({ restoreFocus: false });
      return handleOnlineForfeit({
        archiveId: payload.archiveId,
        forfeitResult: payload.forfeitResult,
        match: payload.resolvedMatch,
        rematchMatch: payload.match
      });
    } catch (error) {
      setForfeitRequestPending(false);
      if (forfeitStatus) {
        forfeitStatus.textContent =
          error?.message || 'This Clash could not be forfeited.';
        forfeitStatus.hidden = false;
      }
      return null;
    }
  }

  function confirmForfeit() {
    if (forfeitRequestPending) return null;
    if (!isTutorial) return submitOnlineForfeit();
    window.OlingClashTutorial?.finish?.({ completed: false });
    flow?.stop();
    closePicker();
    closeInspector();
    closeForfeitDialog({ restoreFocus: false });
    navigateToClashLobby();
    return true;
  }

  function hideOnlineEndGame() {
    if (endGame) endGame.hidden = true;
    endGame
      ?.querySelectorAll('[data-clash-end-player]')
      .forEach((container) =>
        container.classList.remove('is-winner', 'is-loser', 'is-draw')
      );
    if (matchControls) matchControls.hidden = true;
    if (rematchButton) {
      rematchButton.disabled = false;
      rematchButton.textContent = 'REMATCH';
    }
    if (backLobbyButton) backLobbyButton.disabled = false;
    rematchRequestPending = false;
    syncClashMenuAction();
  }

  function isOnlineEndGameVisible() {
    return Boolean(endGame && !endGame.hidden);
  }

  function showOnlineEndGame(result = {}) {
    if (!endGame) return null;
    const players = getOnlinePlayers();
    if (!players.local || !players.opponent) return null;
    const defeatedSlots = new Set(result.defeatedPlayerSlots || []);
    const localDefeated = defeatedSlots.has(players.local.slot);
    const opponentDefeated = defeatedSlots.has(players.opponent.slot);
    const winner =
      localDefeated === opponentDefeated
        ? 'draw'
        : localDefeated
          ? 'opponent'
          : 'local';
    renderEndGamePlayer('local', players.local, winner);
    renderEndGamePlayer('opponent', players.opponent, winner);
    if (endGameResult) {
      endGameResult.textContent =
        winner === 'draw' ? 'DRAW' : winner === 'local' ? 'VICTORY' : 'DEFEAT';
    }
    if (endGameDetail) {
      const forfeitedPlayerSlot = result.forfeitedPlayerSlot || null;
      const localForfeited = forfeitedPlayerSlot === players.local.slot;
      endGameDetail.textContent =
        result.endReason === 'surrender'
          ? localForfeited
            ? 'YOU FORFEITED THE CLASH'
            : 'YOUR OPPONENT FORFEITED THE CLASH'
          : winner === 'draw'
            ? 'BOTH TEAMS WERE DEFEATED'
            : winner === 'local'
              ? 'ALL OPPOSING OLINGS DEFEATED'
              : 'ALL YOUR OLINGS WERE DEFEATED';
    }
    endGame.hidden = false;
    if (matchControls) matchControls.hidden = false;
    if (rematchButton) {
      rematchButton.disabled = false;
      rematchButton.textContent = 'REMATCH';
    }
    if (backLobbyButton) backLobbyButton.disabled = false;
    stateModel.state.phase = 'complete';
    stateModel.state.winner = winner;
    renderPhaseControls('complete');
    clashAudio?.playMatchResult(winner);
    syncClashMenuAction();
    return { players, winner };
  }

  async function mutateOnlineRematch(accepted) {
    const matchCode = onlineMatch?.matchCode;
    if (!matchCode) throw new Error('This Clash lobby is no longer available.');
    const response = await fetch(
      `/api/olings/clashes/${encodeURIComponent(matchCode)}/rematch`,
      {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ accepted })
      }
    );
    const payload = (await response.json().catch(() => ({}))) || {};
    if (!response.ok || payload.success === false || !payload.match) {
      throw new Error(
        payload.error?.message || 'The rematch request could not be updated.'
      );
    }
    return payload.match;
  }

  function handleOnlineRematchUpdate(match, accountId = onlineAccountId) {
    if (!match) return null;
    onlineAccountId = String(accountId || onlineAccountId || '');
    onlineMatch = match;
    if (match.status === 'active') {
      hideOnlineEndGame();
      return applyOnlineMatch(match);
    }
    const players = getOnlinePlayers(match);
    const accepted = Boolean(players.local?.rematchAccepted);
    if (rematchButton) {
      rematchButton.disabled = accepted || rematchRequestPending;
      rematchButton.textContent = accepted ? 'WAITING FOR OPPONENT' : 'REMATCH';
    }
    return match;
  }

  function syncRematchMatch(match) {
    if (typeof window.OlingsClashLobby?.syncMatch === 'function') {
      window.OlingsClashLobby.syncMatch(match);
      return match;
    }
    if (match?.status !== 'active') {
      const updatedMatch = handleOnlineRematchUpdate(match);
      const isRoomRoute = /^\/olings\/clash\/[a-z0-9]{3}-[a-z0-9]{3}\/?$/i.test(
        window.location.pathname
      );
      const hasOfflineSession = Boolean(
        window.sessionStorage.getItem('olings-clash-offline-match')
      );
      if (isRoomRoute || hasOfflineSession) {
        const path = isRoomRoute
          ? window.location.pathname
          : '/olings/clash/settings';
        const shouldNavigate = window.dispatchEvent(
          new CustomEvent('olings-clash:waiting-room', {
            cancelable: true,
            detail: { path }
          })
        );
        if (shouldNavigate) {
          if (typeof window.transitionSplashScreen === 'function') {
            window.transitionSplashScreen(
              path,
              '/images/splash-screens/olings/clash/settings.png'
            );
          } else if (isRoomRoute) window.location.reload();
          else window.location.assign(path);
        }
      }
      return updatedMatch;
    }
    return handleOnlineRematchUpdate(match);
  }

  async function requestOnlineRematch() {
    if (rematchRequestPending) return null;
    rematchRequestPending = true;
    if (rematchButton) {
      rematchButton.disabled = true;
      rematchButton.textContent = 'REQUESTING REMATCH';
    }
    try {
      const match = await mutateOnlineRematch(true);
      rematchRequestPending = false;
      return syncRematchMatch(match);
    } catch (error) {
      rematchRequestPending = false;
      if (rematchButton) {
        rematchButton.disabled = false;
        rematchButton.textContent = 'REMATCH';
      }
      if (endGameDetail) {
        endGameDetail.textContent = error?.message || 'REMATCH FAILED';
      }
      return null;
    }
  }

  async function returnOnlineToLobby() {
    if (rematchRequestPending) return null;
    rematchRequestPending = true;
    if (backLobbyButton) backLobbyButton.disabled = true;
    try {
      const match = await mutateOnlineRematch(false);
      hideOnlineEndGame();
      return syncRematchMatch(match);
    } catch (error) {
      rematchRequestPending = false;
      if (backLobbyButton) backLobbyButton.disabled = false;
      if (endGameDetail) {
        endGameDetail.textContent = error?.message || 'LOBBY RETURN FAILED';
      }
      return null;
    }
  }

  function applyOnlineMatch(
    match,
    { phaseOverride = null, preserveEndGame = false } = {}
  ) {
    if (!match || !stateModel || !matchRenderer) return null;
    const previousPhase = stateModel.state.phase;
    const previousRound = stateModel.state.round;
    const draftAction = pendingAction;
    const draftInspectedAction = inspectedAction;
    const draftSelection = {
      effectChoice: stateModel.state.selections.localEffectChoice,
      localAction: stateModel.state.selections.localAction,
      tagTeamSlot: stateModel.state.selections.localTagSlot
    };
    const actionWasPending = onlineActionPending;
    onlineMatch = match;
    if (!preserveEndGame) hideOnlineEndGame();
    const players = getOnlinePlayers(match);
    if (!players.local || !players.opponent) return null;
    const incomingDeadlineContext = createOnlineDeadlineContext(match);
    const incomingDeadlineKey = getOnlineDeadlineContextKey(
      incomingDeadlineContext
    );
    if (
      match.phase !== 'selection' ||
      players.local.selectionCommitted ||
      (onlineExpiredDeadlineKey &&
        onlineExpiredDeadlineKey !== incomingDeadlineKey)
    ) {
      clearOnlineDeadlineWatchdog({ clearKey: true });
    }
    const state = stateModel.state;
    state.teams.local = normalizeOnlineTeam(players.local, state.teams.local);
    state.teams.opponent = normalizeOnlineTeam(
      players.opponent,
      state.teams.opponent
    );
    const localLastMoves = getOnlineLastMoves(match, players.local);
    const opponentLastMoves = getOnlineLastMoves(match, players.opponent);
    state.teams.local.forEach((oling) => {
      oling.lastMove = localLastMoves.get(Number(oling.teamSlot)) || null;
    });
    state.teams.opponent.forEach((oling) => {
      oling.lastMove = opponentLastMoves.get(Number(oling.teamSlot)) || null;
    });
    state.tagResources ||= {};
    state.tagResources.local = normalizeOnlineTagResource(players.local, match);
    state.tagResources.opponent = normalizeOnlineTagResource(
      players.opponent,
      match
    );
    state.playerEffects.local = (players.local.statuses || []).map(
      normalizeOnlineEffect
    );
    state.playerEffects.opponent = (players.opponent.statuses || []).map(
      normalizeOnlineEffect
    );
    const incomingRound = Math.max(1, Number(match.round || 1));
    const serverDraft =
      Number(players.local.selectionDraft?.round) === incomingRound
        ? players.local.selectionDraft
        : null;
    const preserveLocalDraft =
      previousRound === incomingRound &&
      match.status === 'active' &&
      match.phase === 'selection' &&
      !players.local.selection;
    state.round = incomingRound;
    state.selections.localAction =
      players.local.selection?.action ||
      serverDraft?.action ||
      (preserveLocalDraft ? draftSelection.localAction : null);
    state.selections.localEffectChoice = players.local.selection?.effectChoice
      ? { ...players.local.selection.effectChoice }
      : serverDraft?.effectChoice
        ? { ...serverDraft.effectChoice }
        : preserveLocalDraft
          ? draftSelection.effectChoice
          : null;
    state.selections.localTagSlot = players.local.selection
      ? (players.local.selection.tagTeamSlot ?? null)
      : serverDraft
        ? (serverDraft.tagTeamSlot ?? null)
        : preserveLocalDraft
          ? draftSelection.tagTeamSlot
          : null;
    state.selections.opponentAction = null;
    state.selections.opponentEffectChoice = null;
    state.winner = match.winnerAccountId
      ? String(match.winnerAccountId) === String(onlineAccountId)
        ? 'local'
        : 'opponent'
      : null;
    const latestRoundResult = getLatestOnlineRoundResult(match);
    if (latestRoundResult) {
      setOnlineLastRoundResult(
        createOnlineDisplayResult(latestRoundResult, players)
      );
    } else if (state.round <= 1) {
      state.lastOutcome = 'NO RESULT';
      state.lastResult = null;
    }
    const isAwaitingDeadlineResolution = Boolean(
      incomingDeadlineKey &&
      incomingDeadlineKey === onlineExpiredDeadlineKey &&
      match.phase === 'selection' &&
      !players.local.selectionCommitted
    );
    state.phase =
      phaseOverride ||
      (isAwaitingDeadlineResolution
        ? 'locking-in'
        : preserveLocalDraft && actionWasPending
          ? 'waiting'
          : getOnlineMatchPhase(match, players));
    if (
      state.phase === 'choose-action' &&
      (previousPhase !== 'choose-action' || previousRound !== state.round)
    ) {
      resultAction = null;
      resultActionFailed = false;
    }
    pendingAction = players.local.selection
      ? null
      : serverDraft?.action || (preserveLocalDraft ? draftAction : null);
    inspectedAction = preserveLocalDraft ? draftInspectedAction : null;
    onlineActionPending = Boolean(
      players.local.selectionCommitted ||
      isAwaitingDeadlineResolution ||
      (preserveLocalDraft && actionWasPending)
    );
    renderMatchState(state, { defer: true });
    syncTagSelection(state);
    combatMotion?.renderPhase(gameRoot, state.phase);
    const durations = getOnlineFlowDurations();
    updatePhase({
      phase: state.phase,
      phaseDurationMs:
        state.phase === 'choose-action' ? durations.action : undefined,
      phaseEndsAt:
        state.phase === 'choose-action' ? match.phaseEndsAt : undefined
    });
    if (
      state.phase === 'choose-action' &&
      (previousPhase !== 'choose-action' || previousRound !== state.round)
    ) {
      clashAudio?.playChooseAction();
    }
    renderActionSelection();
    syncClashMenuAction();
    if (!phaseOverride && state.phase === 'choose-tag') {
      openOnlineReplacementPicker();
    } else if (
      !phaseOverride &&
      picker?.isOpen() &&
      gameRoot.querySelector('[data-clash-picker]')?.dataset.pickerMode ===
        'tag'
    ) {
      closePicker();
    }
    return state;
  }

  function useOnlineMatch(match, accountId = onlineAccountId) {
    if (!match) return null;
    onlineAccountId = String(accountId || onlineAccountId || '');
    flow?.stop();
    if (onlineRoundTimeout) {
      queuedOnlineMatch = match;
      return stateModel?.state || null;
    }
    onlineMatch = match;
    const state =
      match.status === 'active' || match.status === 'completed'
        ? applyOnlineMatch(match)
        : null;
    syncClashMenuAction();
    return state;
  }

  function isResolvingOnlineRound() {
    return Boolean(onlineRoundTimeout);
  }

  function scheduleOnlineRoundStep(callback, durationMs) {
    if (onlineRoundTimeout) window.clearTimeout(onlineRoundTimeout);
    onlineRoundTimeout = window.setTimeout(
      () => {
        onlineRoundTimeout = null;
        callback();
      },
      Math.max(0, Number(durationMs) || 0)
    );
  }

  function setOnlinePlaybackPhase(phase, durationMs = 0) {
    if (stateModel?.state) stateModel.state.phase = phase;
    combatMotion?.renderPhase(gameRoot, phase);
    updatePhase({
      phase,
      phaseDurationMs: durationMs || undefined,
      phaseEndsAt: durationMs ? Date.now() + durationMs : undefined
    });
  }

  function createOnlinePlaybackMatch(match, tags = []) {
    if (!match) return null;
    return {
      ...match,
      players: (match.players || []).map((player) => {
        const tag = tags.find((item) => item.playerSlot === player.slot);
        return {
          ...player,
          activeTeamSlot: tag?.previousTeamSlot ?? player.activeTeamSlot,
          team: player.team || []
        };
      })
    };
  }

  function applyOnlineTagChargeUpdates(match, updates = []) {
    if (!match || !Array.isArray(updates) || !updates.length) return match;
    return {
      ...match,
      players: (match.players || []).map((player) => {
        const update = updates.find((item) => item.playerSlot === player.slot);
        if (!update) return player;
        return {
          ...player,
          tagCharges: update.charges,
          tagRechargeProgress: update.rechargeProgress
        };
      })
    };
  }

  function orientOnlineResult(result, players, tags = []) {
    const orientSlot = (slot) => {
      if (slot === players.local?.slot) return 'local';
      if (slot === players.opponent?.slot) return 'opponent';
      return slot;
    };
    const activeSlots = new Map(
      [players.local, players.opponent].filter(Boolean).map((player) => {
        const tag = tags.find((item) => item.playerSlot === player.slot);
        return [player.slot, tag?.previousTeamSlot ?? player.activeTeamSlot];
      })
    );
    const orientTarget = (record = {}) => {
      const targetSlot = record.targetPlayerSlot || record.playerSlot;
      const activeTeamSlot = activeSlots.get(targetSlot);
      return {
        ...record,
        playerSlot: orientSlot(record.playerSlot),
        sourcePlayerSlot: orientSlot(record.sourcePlayerSlot),
        targetPlayerSlot: orientSlot(record.targetPlayerSlot),
        ...(record.teamSlot !== undefined &&
        Number(record.teamSlot) === Number(activeTeamSlot)
          ? { teamSlot: 0 }
          : {}),
        ...(record.targetTeamSlot !== undefined &&
        Number(record.targetTeamSlot) === Number(activeTeamSlot)
          ? { targetTeamSlot: 0 }
          : {})
      };
    };
    return {
      ...result,
      damage: (result.damage || []).map(orientTarget),
      effects: (result.effects || []).map(orientTarget),
      triggeredStatuses: (result.triggeredStatuses || []).map(orientTarget)
    };
  }

  function handleOnlineRoundResult(payload = {}) {
    const result = payload.result || payload.roundResult || payload;
    if (!result?.round || !stateModel?.state) return null;
    const roundKey = `${payload.gameId || onlineMatch?.gameId || ''}:${result.round}`;
    if (roundKey === lastOnlineRoundKey) return result;
    lastOnlineRoundKey = roundKey;
    clearOnlineDeadlineWatchdog({ clearKey: true });
    const tagChargeUpdates = Array.isArray(result.tagChargeUpdates)
      ? result.tagChargeUpdates
      : [];
    const resolvedMatch = applyOnlineTagChargeUpdates(
      payload.match || null,
      tagChargeUpdates
    );
    const fallbackMatch = applyOnlineTagChargeUpdates(
      queuedOnlineMatch || onlineMatch,
      tagChargeUpdates
    );
    const players = getOnlinePlayers(resolvedMatch || fallbackMatch);
    const localSlot = players.local?.slot;
    const tags = Array.isArray(result.tags) ? result.tags : [];
    const orientedResult = orientOnlineResult(result, players, tags);
    const displayResult = createOnlineDisplayResult(orientedResult, players);
    const { localAction, opponentAction, winner } = displayResult;
    resultAction = null;
    resultActionFailed = false;
    const durations = getOnlineFlowDurations();
    const playbackMatch = createOnlinePlaybackMatch(
      resolvedMatch || fallbackMatch,
      tags
    );

    const finishPlayback = () => {
      finishTagButtonSpin();
      const nextMatch = applyOnlineTagChargeUpdates(
        queuedOnlineMatch,
        tagChargeUpdates
      );
      queuedOnlineMatch = null;
      const isComplete =
        Boolean(payload.completed) || resolvedMatch?.status === 'completed';
      if (isComplete) {
        if (resolvedMatch) {
          applyOnlineMatch(resolvedMatch, {
            phaseOverride: 'complete',
            preserveEndGame: true
          });
        }
        showOnlineEndGame(result);
        return;
      }
      const activeMatch = nextMatch || resolvedMatch;
      if (activeMatch?.status === 'active') applyOnlineMatch(activeMatch);
      document.dispatchEvent(
        new CustomEvent('olings-clash:online-round-finished', {
          detail: { match: activeMatch }
        })
      );
    };

    const playTag = (tagIndex) => {
      const tag = tags[tagIndex];
      if (!tag || !playbackMatch) {
        finishPlayback();
        return;
      }
      const side = tag.playerSlot === localSlot ? 'local' : 'opponent';
      const player = playbackMatch.players?.find(
        (item) => item.slot === tag.playerSlot
      );
      const incomingOling = stateModel.state.teams[side]?.find(
        (oling) => Number(oling.teamSlot) === Number(tag.incomingTeamSlot)
      );
      tagMotion?.prepare(gameRoot, {
        forced: tag.reason === 'defeat-replacement',
        selectedSlot: tag.incomingTeamSlot,
        side
      });
      const exitDurationMs =
        tagMotion?.exit?.(gameRoot, {
          durationMs: rosterTagExitDurationMs
        })?.durationMs || 0;
      const finishTagHandoff = () => {
        if (player) player.activeTeamSlot = tag.incomingTeamSlot;
        applyOnlineMatch(playbackMatch, {
          phaseOverride: 'tagged',
          preserveEndGame: true
        });
        tagMotion?.play(gameRoot, { durationMs: durations.tagged });
        showResult(
          `${incomingOling?.name || 'OLING'} TAGS IN`,
          side === 'local' ? 'YOUR TEAM' : 'OPPONENT TEAM'
        );
        scheduleOnlineRoundStep(() => {
          if (side === 'local') finishTagButtonSpin(tag.incomingTeamSlot);
          playTag(tagIndex + 1);
        }, durations.tagged);
      };
      if (exitDurationMs > 0) {
        scheduleOnlineRoundStep(finishTagHandoff, exitDurationMs);
      } else {
        finishTagHandoff();
      }
    };

    let resultResolved = false;
    const resolveResult = () => {
      if (resultResolved) return false;
      resultResolved = true;
      if (playbackMatch) {
        applyOnlineMatch(playbackMatch, {
          phaseOverride: 'resolving',
          preserveEndGame: true
        });
      } else {
        setOnlinePlaybackPhase('resolving');
      }
      stateModel.state.selections.localAction = localAction;
      stateModel.state.selections.opponentAction = opponentAction;
      setOnlineLastRoundResult(displayResult);
      matchRenderer.renderActions?.(
        gameRoot,
        stateModel.state.teams.local[0],
        localAction,
        stateModel.state.playerEffects?.local,
        displayResult,
        stateModel.state.selections.localTagSlot != null
      );
      resultAction = winner === 'draw' ? 'draw' : localAction;
      resultActionFailed = winner === 'opponent';
      renderActionSelection();
      matchRenderer.renderAbilityReveal?.(gameRoot, stateModel.state, {
        localAction,
        opponentAction,
        result: displayResult,
        winner
      });
      const damagePackets = damageFeedback?.emitResult(gameRoot, {
        ...orientedResult,
        localAction,
        opponentAction,
        winner
      });
      clashAudio?.playDamage(damagePackets || []);
      clashAudio?.playResources(result.effects, damagePackets || []);
      clashAudio?.playStatuses(result, damagePackets || []);
      showResult(displayResult);
      scheduleOnlineRoundStep(
        () => playTag(0),
        winner === 'draw' ? durations.drawResult : durations.result
      );
      return true;
    };

    const revealActions = () => {
      setOnlinePlaybackPhase('reveal', durations.reveal);
      stateModel.state.selections.localAction = localAction;
      stateModel.state.selections.opponentAction = opponentAction;
      renderActionSelection();
      matchRenderer.renderAbilityReveal?.(gameRoot, stateModel.state, {
        localAction,
        opponentAction,
        winner
      });
      clashAudio?.playReveal(winner);
      combatMotion?.play(gameRoot, {
        durationMs: durations.reveal + 700,
        onCollision: resolveResult,
        winner
      });
      showResult('ABILITIES REVEALED');
      scheduleOnlineRoundStep(resolveResult, durations.reveal);
    };

    const beginLockedPhase = () => {
      renderActionSelection();
      setOnlinePlaybackPhase('locked', durations.locked);
      clashAudio?.playLockIn();
      scheduleOnlineRoundStep(revealActions, durations.locked);
    };
    const responseDelayMs = Math.max(0, Number(result.responseDelayMs) || 0);
    closePicker();
    closeInspector();
    if (responseDelayMs > 0) {
      setOnlinePlaybackPhase('waiting', responseDelayMs);
      scheduleOnlineRoundStep(beginLockedPhase, responseDelayMs);
    } else {
      beginLockedPhase();
    }
    return displayResult;
  }

  function openOnlineReplacementPicker() {
    if (
      !onlineMatch?.matchCode ||
      onlineMatch.phase !== 'replacement' ||
      onlineReplacementPending ||
      !onlinePlayerNeedsReplacement(getOnlinePlayers(onlineMatch).local)
    ) {
      return null;
    }
    closeInspector();
    clashAudio?.playChooseTag();
    return openPicker({
      confirmLabel: 'TAG IN',
      isEligible: (oling, index) =>
        index > 0 && Number(oling.health?.heartUnits) > 0,
      mode: 'tag',
      olings: stateModel.state.teams.local,
      onConfirm: (_index, oling) => {
        submitOnlineReplacement(oling?.teamSlot);
      },
      side: 'local',
      title: 'CHOOSE YOUR NEXT OLING'
    });
  }

  function handleOnlineReplacement(payload = {}) {
    const replacement = payload.replacement;
    const resolvedMatch = payload.match;
    if (!replacement || !resolvedMatch || !stateModel?.state) return null;
    const replacementKey = `${payload.gameId || resolvedMatch.gameId || ''}:${resolvedMatch.round}:${replacement.playerSlot}:${replacement.incomingTeamSlot}`;
    if (
      replacementKey === lastOnlineReplacementKey ||
      queuedOnlineReplacementPayloads.some(
        (queued) => queued.replacementKey === replacementKey
      )
    ) {
      return replacement;
    }
    if (onlineRoundTimeout) {
      queuedOnlineReplacementPayloads.push({ payload, replacementKey });
      return replacement;
    }
    lastOnlineReplacementKey = replacementKey;
    onlineReplacementPending = false;
    const players = getOnlinePlayers(resolvedMatch);
    const side =
      replacement.playerSlot === players.local?.slot ? 'local' : 'opponent';
    const playbackMatch = createOnlinePlaybackMatch(resolvedMatch, [
      replacement
    ]);
    const durations = getOnlineFlowDurations();
    const incomingOling = normalizeOnlineTeam(
      resolvedMatch.players?.find(
        (player) => player.slot === replacement.playerSlot
      ) || {}
    ).find(
      (oling) => Number(oling.teamSlot) === Number(replacement.incomingTeamSlot)
    );

    closePicker();
    closeInspector();
    if (side === 'local') beginLocalTagActionPanelExit();
    tagMotion?.prepare(gameRoot, {
      forced: true,
      selectedSlot: replacement.incomingTeamSlot,
      side
    });
    const exitDurationMs =
      tagMotion?.exit?.(gameRoot, {
        durationMs: rosterTagExitDurationMs
      })?.durationMs || 0;
    const finishReplacementHandoff = () => {
      const playbackPlayer = playbackMatch?.players?.find(
        (player) => player.slot === replacement.playerSlot
      );
      if (playbackPlayer) {
        playbackPlayer.activeTeamSlot = replacement.incomingTeamSlot;
      }
      applyOnlineMatch(playbackMatch, {
        phaseOverride: 'tagged',
        preserveEndGame: true
      });
      tagMotion?.play(gameRoot, { durationMs: durations.tagged });
      showResult(
        `${incomingOling?.name || 'OLING'} TAGS IN`,
        side === 'local' ? 'YOUR TEAM' : 'OPPONENT TEAM'
      );
      scheduleOnlineRoundStep(() => {
        if (side === 'local') finishLocalTagActionPanelEntry();
        const queuedReplacement = queuedOnlineReplacementPayloads.shift();
        if (queuedReplacement) {
          handleOnlineReplacement(queuedReplacement.payload);
          return;
        }
        const nextMatch = queuedOnlineMatch || resolvedMatch;
        queuedOnlineMatch = null;
        applyOnlineMatch(nextMatch);
        document.dispatchEvent(
          new CustomEvent('olings-clash:online-replacement-finished', {
            detail: { match: nextMatch, replacement }
          })
        );
      }, durations.tagged);
    };
    if (exitDurationMs > 0) {
      scheduleOnlineRoundStep(finishReplacementHandoff, exitDurationMs);
    } else {
      finishReplacementHandoff();
    }
    return replacement;
  }

  async function submitOnlineReplacement(teamSlot) {
    if (
      !onlineMatch?.matchCode ||
      onlineReplacementPending ||
      !Number.isInteger(Number(teamSlot))
    ) {
      return null;
    }
    onlineReplacementPending = true;
    try {
      const response = await fetch(
        `/api/olings/clashes/${encodeURIComponent(onlineMatch.matchCode)}/replacement`,
        {
          method: 'POST',
          credentials: 'same-origin',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ teamSlot: Number(teamSlot) })
        }
      );
      const payload = (await response.json().catch(() => ({}))) || {};
      if (!response.ok || payload.success === false) {
        const error = new Error(
          payload.error?.message || 'That Oling could not be Tagged in.'
        );
        error.code = payload.error?.code;
        throw error;
      }
      handleOnlineReplacement({
        gameId: payload.match?.gameId,
        match: payload.match,
        replacement: payload.replacement
      });
      return payload;
    } catch (error) {
      onlineReplacementPending = false;
      if (onlineMatch?.phase === 'replacement') openOnlineReplacementPicker();
      return null;
    }
  }

  async function submitOnlineAction(action, effectChoice = null) {
    if (!onlineMatch?.matchCode || onlineActionPending) return null;
    clearOnlineDeadlineWatchdog({ clearKey: true });
    onlineActionPending = true;
    resultAction = null;
    resultActionFailed = false;
    stateModel.state.selections.localAction = action || null;
    stateModel.state.phase = 'waiting';
    clashAudio?.playActionSubmitted();
    updatePhase({ phase: 'waiting' });
    renderActionSelection();
    const response = await fetch(
      `/api/olings/clashes/${encodeURIComponent(onlineMatch.matchCode)}/action`,
      {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action,
          effectChoice,
          tagTeamSlot: getSelectedTagTeamSlot()
        })
      }
    );
    const payload = (await response.json().catch(() => ({}))) || {};
    if (!response.ok || payload.success === false) {
      const error = new Error(
        payload.error?.message || 'That Clash action could not be submitted.'
      );
      error.code = payload.error?.code;
      error.details = payload.error?.details;
      throw error;
    }
    onlineActionPending = false;
    clearOnlineDeadlineWatchdog({ clearKey: true });
    if (payload.roundResult) {
      handleOnlineRoundResult({
        completed: Boolean(payload.archiveId),
        gameId: payload.resolvedMatch?.gameId || payload.match?.gameId,
        match: payload.resolvedMatch,
        result: payload.roundResult
      });
    }
    useOnlineMatch(payload.match, onlineAccountId);
    return payload;
  }

  async function refreshOnlineDeadlineState(deadlineContext) {
    const bufferedMatch = queuedOnlineMatch;
    if (bufferedMatch) {
      queuedOnlineMatch = null;
      return useOnlineMatch(bufferedMatch, onlineAccountId);
    }

    const matchCode =
      deadlineContext?.matchCode || onlineMatch?.matchCode || null;
    if (!matchCode) return null;
    try {
      const response = await fetch(
        `/api/olings/clashes/${encodeURIComponent(matchCode)}`,
        {
          cache: 'no-store',
          method: 'GET',
          credentials: 'same-origin',
          headers: { Accept: 'application/json' }
        }
      );
      const payload = (await response.json().catch(() => ({}))) || {};
      if (!response.ok || payload.success === false || !payload.match) {
        return null;
      }
      if (queuedOnlineMatch) {
        const latestBufferedMatch = queuedOnlineMatch;
        queuedOnlineMatch = null;
        return useOnlineMatch(latestBufferedMatch, onlineAccountId);
      }
      if (!onlineDeadlineContextMatches(deadlineContext)) {
        return stateModel?.state || null;
      }
      return useOnlineMatch(payload.match, onlineAccountId);
    } catch (_error) {
      return !onlineDeadlineContextMatches(deadlineContext)
        ? stateModel?.state || null
        : null;
    }
  }

  function scheduleOnlineDeadlineWatchdog(deadlineContext) {
    clearOnlineDeadlineWatchdog();
    onlineDeadlineWatchdog = window.setTimeout(async () => {
      onlineDeadlineWatchdog = null;
      if (
        !onlineDeadlineContextMatches(deadlineContext) ||
        onlineExpiredDeadlineKey !==
          getOnlineDeadlineContextKey(deadlineContext)
      ) {
        return;
      }
      await refreshOnlineDeadlineState(deadlineContext);
      if (
        onlineDeadlineContextMatches(deadlineContext) &&
        onlineExpiredDeadlineKey ===
          getOnlineDeadlineContextKey(deadlineContext)
      ) {
        scheduleOnlineDeadlineWatchdog(deadlineContext);
      }
    }, 1250);
  }

  function handleOnlineDeadlineExpired(
    deadlineContext = createOnlineDeadlineContext()
  ) {
    if (
      !onlineDeadlineContextMatches(deadlineContext) ||
      getOnlinePlayers().local?.selectionCommitted
    ) {
      return false;
    }
    const deadlineKey = getOnlineDeadlineContextKey(deadlineContext);
    if (!deadlineKey) return false;
    onlineExpiredDeadlineKey = deadlineKey;
    onlineActionPending = true;
    closePicker();
    if (stateModel?.state) stateModel.state.phase = 'locking-in';
    updatePhase({ phase: 'locking-in' });
    renderActionSelection();
    scheduleOnlineDeadlineWatchdog(deadlineContext);
    return true;
  }

  tagButtons.forEach((button) => {
    button.setAttribute('aria-pressed', 'false');
    button.addEventListener('click', () => selectTag(button.dataset.teamSlot));
  });

  actionButtons.forEach((button) => {
    if (!button.hasAttribute('data-clash-passive')) {
      button.setAttribute('aria-pressed', 'false');
    }
    button.addEventListener('click', () => {
      if (button.hasAttribute('data-clash-passive')) {
        if (getCurrentPhase() !== 'choose-action') return;
        inspectedAction = button.dataset.clashAction;
        renderActionSelection();
        return;
      }
      toggleAction(button.dataset.clashAction);
    });
  });
  actionConfirmButton?.addEventListener('click', confirmAction);
  opponentActionTarget?.addEventListener('click', confirmAction);
  opponentActionTarget?.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    confirmAction();
  });

  gameRoot.addEventListener('oling-clash:tag-selection-change', (event) => {
    if (onlineMatch?.matchCode) {
      if (stateModel?.state?.selections) {
        const value = event.detail?.teamSlot;
        stateModel.state.selections.localTagSlot =
          value === null || value === undefined ? null : Number(value);
        matchRenderer?.render(gameRoot, stateModel.state);
        renderActionSelection();
      }
      return;
    }
    flow?.selectTag(event.detail?.teamSlot ?? null, {
      allowWhilePaused: isTutorial && tutorialTagInputEnabled
    });
  });
  timerContainer?.addEventListener('oling-clash:timer-expired', () => {
    if (
      !onlineMatch?.matchCode ||
      getCurrentPhase() !== 'choose-action' ||
      onlineActionPending
    ) {
      return;
    }
    handleOnlineDeadlineExpired(createOnlineDeadlineContext());
  });
  function showPermanentPickerOverlay() {
    if (
      !pickerContainer ||
      typeof addElementIfNotExists !== 'function' ||
      typeof permanantElementClassArray === 'undefined'
    ) {
      return false;
    }
    const gameStyle = window.getComputedStyle(gameRoot);
    [
      '--clash-game-ink',
      '--clash-game-panel',
      '--clash-game-panel-deep',
      '--clash-game-text-on-primary'
    ].forEach((property) => {
      pickerContainer.style.setProperty(
        property,
        gameStyle.getPropertyValue(property)
      );
    });
    pickerContainer.classList.add('is-clash-permanent-overlay');
    document.body.append(pickerContainer);
    addElementIfNotExists(permanantElementClassArray, pickerContainer, {
      sound: false
    });
    return true;
  }

  function hidePermanentPickerOverlay() {
    if (!pickerContainer) return false;
    if (
      typeof removeElementIfExists === 'function' &&
      typeof permanantElementClassArray !== 'undefined'
    ) {
      removeElementIfExists(permanantElementClassArray, pickerContainer, {
        sound: false
      });
    }
    pickerContainer.classList.remove(
      'is-clash-permanent-overlay',
      'is-visible'
    );
    if (!gameRoot.contains(pickerContainer)) gameRoot.append(pickerContainer);
    return true;
  }

  function closePicker(options) {
    picker?.close(gameRoot, options);
    hidePermanentPickerOverlay();
    if (phaseContainer) phaseContainer.hidden = false;
  }

  function openPicker(config = {}) {
    if (!picker || !stateModel) return null;
    const mode = config.mode || 'friendly-target';
    const side =
      config.side || (mode === 'enemy-target' ? 'opponent' : 'local');
    const userOnConfirm = config.onConfirm;
    const userOnCancel = config.onCancel;
    const openedPicker = picker.open(gameRoot, {
      ...config,
      mode,
      olings: config.olings || stateModel.state.teams[side],
      onCancel() {
        hidePermanentPickerOverlay();
        if (phaseContainer) phaseContainer.hidden = false;
        userOnCancel?.();
      },
      onConfirm(index, oling, choiceKey) {
        hidePermanentPickerOverlay();
        if (phaseContainer) phaseContainer.hidden = false;
        userOnConfirm?.(index, oling, choiceKey);
      },
      side
    });
    if (openedPicker) {
      if (mode === 'tag') showPermanentPickerOverlay();
      if (phaseContainer) phaseContainer.hidden = true;
    }
    return openedPicker;
  }

  gameRoot.addEventListener(
    'click',
    (event) => {
      if (
        !picker?.isOpen?.() ||
        !picker?.canCancel?.() ||
        pickerContainer?.contains(event.target)
      ) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      closePicker({ cancelled: true });
    },
    true
  );

  function closeInspector() {
    inspector?.close(gameRoot);
  }

  function openInspector(side, teamSlot, returnFocus = null) {
    if (!inspector) {
      void ensureInspectorLoaded().then(() =>
        openInspector(side, teamSlot, returnFocus)
      );
      return null;
    }
    if (!stateModel || picker?.isOpen()) return null;
    void ensureAbilityCatalogLoaded();
    const index = Number(teamSlot);
    const oling = stateModel.state.teams[side]?.[index];
    if (!oling) return null;
    return inspector.open(gameRoot, {
      index,
      oling,
      returnFocus,
      side,
      state: stateModel.state,
      visibility: { queuedTag: side === 'local' }
    });
  }

  function openOlingInspector(
    side,
    { olingId = '', teamSlot = null } = {},
    returnFocus = null
  ) {
    if (!['local', 'opponent'].includes(side)) return null;
    const team = stateModel?.state?.teams?.[side] || [];
    const normalizedOlingId = String(olingId || '').trim();
    let index = normalizedOlingId
      ? team.findIndex(
          (oling) => String(oling?.id || '').trim() === normalizedOlingId
        )
      : -1;
    if (index < 0 && teamSlot !== null && teamSlot !== undefined) {
      const normalizedTeamSlot = Number(teamSlot);
      if (Number.isFinite(normalizedTeamSlot)) {
        index = team.findIndex(
          (oling) => Number(oling?.teamSlot) === normalizedTeamSlot
        );
      }
    }
    if (index < 0) return null;
    return openInspector(side, index, returnFocus);
  }

  function openLastRoundAbilityInspector(trigger) {
    const side = trigger?.dataset?.clashLastAbility;
    return openOlingInspector(
      side,
      { teamSlot: trigger?.dataset?.teamSlot },
      trigger
    );
  }

  function openRosterOlingInspector(trigger) {
    return openOlingInspector(
      trigger?.dataset?.clashInspectSide,
      {
        olingId: trigger?.dataset?.olingId,
        teamSlot: trigger?.dataset?.teamSlot
      },
      trigger
    );
  }

  gameRoot.addEventListener('click', (event) => {
    const lastAbilityTrigger = event.target.closest?.(
      '[data-clash-last-ability]'
    );
    if (lastAbilityTrigger) {
      openLastRoundAbilityInspector(lastAbilityTrigger);
      return;
    }
    const inspectTrigger = event.target.closest?.('[data-clash-inspect-side]');
    if (inspectTrigger) {
      openRosterOlingInspector(inspectTrigger);
      return;
    }
    const ability = event.target.closest?.('[data-clash-inspector-ability]');
    if (ability) {
      inspector?.selectAbility(gameRoot, ability.dataset.clashInspectorAbility);
    }
  });
  ['pointerover', 'focusin'].forEach((eventName) => {
    gameRoot.addEventListener(
      eventName,
      (event) => {
        if (
          event.target.closest?.(
            '[data-clash-action], [data-clash-inspect-side], [data-clash-last-ability]'
          )
        ) {
          void ensureAbilityCatalogLoaded();
        }
      },
      { passive: true }
    );
  });
  gameRoot.addEventListener('keydown', (event) => {
    const inspectTrigger = event.target.closest?.('[data-clash-inspect-side]');
    if (inspectTrigger && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      openRosterOlingInspector(inspectTrigger);
    }
    if (event.key === 'Escape' && inspector?.isOpen()) closeInspector();
  });
  gameRoot
    .querySelector('[data-clash-inspector]')
    ?.addEventListener('click', (event) => {
      if (event.target === event.currentTarget) closeInspector();
    });

  rematchButton?.addEventListener('click', () => {
    requestOnlineRematch();
  });

  backLobbyButton?.addEventListener('click', () => {
    returnOnlineToLobby();
  });

  clashMenuAction?.addEventListener('click', openForfeitDialog);
  forfeitCancelButton?.addEventListener('click', () => {
    closeForfeitDialog();
  });
  forfeitConfirmButton?.addEventListener('click', confirmForfeit);
  forfeitDialog?.addEventListener('click', (event) => {
    if (event.target === event.currentTarget) closeForfeitDialog();
  });

  if (stateModel && resolution && opponent && matchRenderer) {
    flow = window.createOlingClashFlow?.({
      hooks: {
        areAbilityEffectsEnabled() {
          return tutorialGameplay.abilityEffects;
        },
        onActionSubmitted() {
          clashAudio?.playActionSubmitted();
        },
        onActionTimeout() {
          const timeoutSelection = {
            action: pendingAction,
            effectChoice: createRandomRequiredEffectChoice(pendingAction)
          };
          closePicker();
          return timeoutSelection;
        },
        onMatchEnd(state) {
          finishTagButtonSpin();
          clashAudio?.playMatchResult(state?.winner);
          closePicker();
          closeInspector();
          renderPhaseControls('complete');
        },
        onPause() {
          setGameplayPaused(true);
        },
        onForcedTag({ side, state }) {
          openPicker({
            confirmLabel: 'TAG IN',
            isEligible: (oling, index) =>
              index > 0 && oling.health.heartUnits > 0,
            mode: 'tag',
            olings: state.teams[side],
            onConfirm: (_index, oling) => flow?.confirmTag(oling?.teamSlot),
            side,
            title: 'CHOOSE YOUR NEXT OLING'
          });
        },
        onPhase({ durationMs, paused, phase, phaseEndsAt }) {
          if (phase === 'choose-action') {
            if (stateModel?.state?.selections?.localTagSlot == null) {
              finishTagButtonSpin();
            }
            pendingAction = null;
            inspectedAction = null;
            resultAction = null;
            resultActionFailed = false;
          }
          combatMotion?.renderPhase(gameRoot, phase);
          updatePhase({
            phase,
            phaseDurationMs: durationMs,
            phaseEndsAt
          });
          if (isTutorial) {
            gameRoot.dispatchEvent(
              new CustomEvent('olings-clash:tutorial-phase', {
                bubbles: true,
                detail: { phase }
              })
            );
          }
          if (!paused && phase === 'choose-action') {
            clashAudio?.playChooseAction();
          }
          if (!paused && phase === 'choose-tag') clashAudio?.playChooseTag();
          if (!paused && phase === 'locked') clashAudio?.playLockIn();
        },
        onRender(state) {
          renderMatchState(state, { defer: true });
          syncTagSelection(state);
          renderActionSelection();
          if (inspector?.isOpen()) inspector.render(gameRoot);
        },
        onResume({ durationMs, phase, phaseEndsAt }) {
          updatePhase({ phase, phaseDurationMs: durationMs, phaseEndsAt });
        },
        onResult(result) {
          if (result?.winner === 'draw') resultAction = 'draw';
          else if (result?.localAction) resultAction = result.localAction;
          resultActionFailed = result?.winner === 'opponent';
          renderActionSelection();
          const localHeartUnits = Number(
            stateModel?.state?.teams?.local?.[0]?.health?.heartUnits
          );
          if (Number.isFinite(localHeartUnits) && localHeartUnits <= 0) {
            beginLocalTagActionPanelExit();
          }
          matchRenderer.renderAbilityReveal?.(gameRoot, stateModel.state, {
            localAction: result?.localAction,
            opponentAction: result?.opponentAction,
            result,
            winner: result?.winner
          });
          const damagePackets =
            damageFeedback?.emitResult(gameRoot, result) || [];
          if (isTutorial) {
            gameRoot.dispatchEvent(
              new CustomEvent('olings-clash:tutorial-round-result', {
                bubbles: true,
                detail: { damagePackets, result }
              })
            );
          }
          clashAudio?.playDamage(damagePackets);
          clashAudio?.playResources(result?.effects, damagePackets);
          clashAudio?.playStatuses(result, damagePackets);
          showResult(result);
        },
        onReveal({
          durationMs,
          localAction,
          opponentAction,
          resolveAtImpact,
          setImpactFallback,
          winner
        }) {
          renderActionSelection();
          matchRenderer.renderAbilityReveal?.(gameRoot, stateModel.state, {
            localAction,
            opponentAction,
            winner
          });
          showResult('ABILITIES REVEALED');
          clashAudio?.playReveal(winner);
          let revealPlaybackStarted = false;
          const resumeRevealPlayback = () => {
            if (revealPlaybackStarted) return false;
            revealPlaybackStarted = true;
            setImpactFallback?.(Number(durationMs || 0) + 700);
            combatMotion?.play(gameRoot, {
              durationMs: Number(durationMs || 0) + 700,
              onCollision: resolveAtImpact,
              winner
            });
            return true;
          };

          if (isTutorial) {
            const shouldStartImmediately = gameRoot.dispatchEvent(
              new CustomEvent('olings-clash:tutorial-abilities-revealed', {
                bubbles: true,
                cancelable: true,
                detail: {
                  localAction,
                  opponentAction,
                  resumeRevealPlayback,
                  winner
                }
              })
            );
            if (shouldStartImmediately) resumeRevealPlayback();
          } else {
            resumeRevealPlayback();
          }
        },
        onTag({ durationMs, incomingOling, selectedSlot, side }) {
          closePicker();
          tagMotion?.play(gameRoot, { durationMs });
          if (side === 'local') {
            scheduleLocalTagActionPanelEntry(durationMs, {
              completedTagSlot: selectedSlot
            });
          }
          showResult(
            `${incomingOling.name} TAGS IN`,
            side === 'local' ? 'YOUR TEAM' : 'OPPONENT TEAM'
          );
        },
        onTagStart({ forced, selectedSlot, side }) {
          tagMotion?.prepare(gameRoot, { forced, selectedSlot, side });
          const exitDurationMs =
            tagMotion?.exit?.(gameRoot, {
              durationMs: rosterTagExitDurationMs
            })?.durationMs || 0;
          const panelDelayMs =
            side === 'local' ? beginLocalTagActionPanelExit() : 0;
          return { delayMs: Math.max(exitDurationMs, panelDelayMs) };
        }
      },
      opponent,
      paused: isTutorial,
      resolution,
      stateModel
    });
  }

  if (flow && !gameRoot.hasAttribute('data-clash-online')) {
    if (window.OERotateDevice?.blocked) {
      window.OERotateDevice.waitUntilAllowed().then(() => flow.start());
    } else {
      flow.start();
    }
  } else {
    const previewDurationMs = Number(
      phaseContainer?.dataset.phaseDurationMs || 0
    );
    updatePhase({
      phase: phaseContainer?.dataset.phase,
      phaseDurationMs: previewDurationMs,
      phaseEndsAt:
        previewDurationMs > 0 ? Date.now() + previewDurationMs : undefined
    });
  }

  window.requestIdleCallback?.(
    () => {
      if (!document.hidden) void ensureAbilityCatalogLoaded();
    },
    { timeout: 2500 }
  );

  function restartGame() {
    clashAudio?.clear();
    damageFeedback?.clear(gameRoot);
    combatMotion?.clear(gameRoot);
    tagMotion?.clear(gameRoot);
    finishTagButtonSpin();
    finishLocalTagActionPanelEntry();
    pendingAction = null;
    resultAction = null;
    resultActionFailed = false;
    return flow?.start();
  }

  function renderDebugState(state) {
    matchRenderer?.render(gameRoot, state);
    syncTagSelection(state);
    combatMotion?.renderPhase(gameRoot, state?.phase);
    renderActionSelection();
    if (inspector?.isOpen()) inspector.render(gameRoot);
    return state;
  }

  function selectDebugAction(action) {
    if (getCurrentPhase() !== 'choose-action') return false;
    const normalizedAction = String(action || '')
      .trim()
      .toLowerCase();
    if (!['attack', 'guard', 'skill'].includes(normalizedAction)) return false;
    pendingAction = normalizedAction;
    inspectedAction = null;
    renderActionSelection();
    return pendingAction;
  }

  function pauseDebugGame() {
    if (isTutorial) return pauseTutorial();
    return Boolean(flow?.pause());
  }

  function resumeDebugGame() {
    if (isTutorial) return resumeTutorial();
    if (!flow?.paused) return false;
    setGameplayPaused(false);
    return Boolean(flow.resume());
  }

  function confirmDebugAction() {
    if (gameplayPaused) {
      if (isTutorial) resumeTutorial();
      else resumeDebugGame();
    }
    return confirmAction();
  }

  function prepareDebugTag(side, slotIndex) {
    return tagMotion?.prepare(gameRoot, {
      forced: false,
      selectedSlot: slotIndex,
      side
    });
  }

  function playDebugTag() {
    const durationMs = Math.max(400, 1400 / Number(flow?.speed || 1));
    tagMotion?.play(gameRoot, { durationMs });
    clashAudio?.playTag();
    return durationMs;
  }

  function animateDebugDamage(side, damage) {
    const result = {
      localDamage: side === 'local' ? damage : null,
      opponentDamage: side === 'opponent' ? damage : null
    };
    const packets = damageFeedback?.emitResult(gameRoot, result) || [];
    clashAudio?.playDamage(packets);
    return packets;
  }

  const clashDebug = window.createOlingClashDebug?.({
    animateDamage: animateDebugDamage,
    clipboard: window.navigator?.clipboard,
    confirmAction: confirmDebugAction,
    getPendingAction: () => pendingAction,
    getSpeed: () => flow?.speed || 1,
    getTutorial: () => window.OlingClashTutorial,
    getUiState: () => ({
      inspectedAction,
      pendingAction,
      resultAction,
      resultActionFailed
    }),
    isOnline: () =>
      Boolean(
        onlineMatch?.matchCode || gameRoot.hasAttribute('data-clash-online')
      ),
    isPaused: () => Boolean(gameplayPaused || flow?.paused),
    panelDown: beginLocalTagActionPanelExit,
    panelUp: scheduleLocalTagActionPanelEntry,
    pause: pauseDebugGame,
    playTag: playDebugTag,
    prepareTag: prepareDebugTag,
    render: renderDebugState,
    reset: restartGame,
    resolution,
    restoreUiState: (ui = {}) => {
      pendingAction = ui.pendingAction || null;
      inspectedAction = ui.inspectedAction || null;
      resultAction = ui.resultAction || null;
      resultActionFailed = Boolean(ui.resultActionFailed);
    },
    resume: resumeDebugGame,
    selectAction: selectDebugAction,
    setOpponentAction: (action) => flow?.setOpponentAction?.(action),
    setSpeed: (speed) => flow?.setSpeed?.(speed),
    stateModel
  });

  if (clashDebug) window.OlingClashDebug = clashDebug;

  window.OlingClashGame = {
    ...(window.OlingClashGame || {}),
    audio: clashAudio,
    clearTagSelection,
    combatMotion,
    configureTutorialGameplay,
    confirmAction,
    damageFeedback,
    debug: clashDebug,
    flow,
    getSelectedTagTeamSlot,
    health: healthRenderer,
    handleOnlineForfeit,
    handleOnlineReplacement,
    handleOnlineRoundResult,
    handleOnlineRematchUpdate,
    hideOnlineEndGame,
    inspector,
    isResolvingOnlineRound,
    isOnlineEndGameVisible,
    match: matchRenderer,
    openPicker,
    openInspector,
    pauseTutorial,
    phase: phaseRenderer,
    picker,
    resolution,
    restart: restartGame,
    resumeTutorial,
    selectAction: toggleAction,
    setTutorialActionInput,
    setTutorialConfirmSuppressed,
    setTutorialOpponentToDraw,
    setTutorialOpponentToLose,
    setTutorialOpponentToWin,
    setTutorialOpponentQueuedTagSlot,
    setTutorialOpponentTagSlot,
    setTutorialSelectedAction,
    setTutorialTagInput,
    selectTag,
    showOnlineEndGame,
    showResult,
    state: stateModel?.state,
    tagMotion,
    timer,
    toggleAction,
    updatePhase,
    useOnlineMatch
  };

  syncClashMenuAction();

  window.dispatchEvent(new CustomEvent('olings-clash:ready'));

  if (isTutorial) {
    window.dispatchEvent(new CustomEvent('olings-clash:tutorial-ready'));
  }

  window.addEventListener(
    'pagehide',
    () => {
      flow?.stop();
      if (onlineRoundTimeout) window.clearTimeout(onlineRoundTimeout);
      clearOnlineDeadlineWatchdog({ clearKey: true });
      timer?.stop();
      matchRenderer?.cancelScheduledRender?.(gameRoot);
      clashAudio?.clear();
      damageFeedback?.clear(gameRoot);
      combatMotion?.clear(gameRoot);
      tagMotion?.clear(gameRoot);
    },
    { once: true }
  );
})();
