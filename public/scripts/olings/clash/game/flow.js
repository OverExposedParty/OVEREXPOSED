(function (globalScope) {
  const defaultDurations = Object.freeze({
    action: 15000,
    locked: 1500,
    opponentInitialMinimum: 500,
    opponentLockBuffer: 500,
    opponentResponse: 2000,
    opponentResponseMinimum: 250,
    opponentTag: 800,
    drawResult: 5000,
    result: 5000,
    reveal: 2500,
    tag: 15000,
    tagged: 1400
  });

  function createOlingClashFlow(options = {}) {
    const stateModel = options.stateModel;
    const state = stateModel?.state;
    const resolution = options.resolution;
    const opponent = options.opponent;
    const hooks = options.hooks || {};
    const baseDurations = {
      ...defaultDurations,
      ...(options.durations || {})
    };
    const durations = { ...baseDurations };
    const random =
      typeof options.random === 'function' ? options.random : Math.random;
    const now = typeof options.now === 'function' ? options.now : Date.now;
    const schedule =
      typeof options.setTimeout === 'function'
        ? options.setTimeout
        : globalScope.setTimeout.bind(globalScope);
    const cancel =
      typeof options.clearTimeout === 'function'
        ? options.clearTimeout
        : globalScope.clearTimeout.bind(globalScope);
    let timeoutId = null;
    let opponentLockTimeoutId = null;
    let opponentLockAt = null;
    let pendingOpponentAction = null;
    let pendingOpponentQueuedTagSlot = null;
    let pendingOpponentTagSlot = null;
    let roundActionDeadline = null;
    let pendingTagOperations = [];
    let paused = Boolean(options.paused);
    let started = false;
    let awaitingFirstRound = false;
    let scheduledStep = null;
    let opponentLockStep = null;
    let phaseDurationMs = 0;
    let phaseEndsAt = null;
    let phaseRemainingMs = 0;
    let speed = 1;

    function setSpeed(multiplier = 1) {
      const normalizedSpeed = Number(multiplier);
      if (!Number.isFinite(normalizedSpeed) || normalizedSpeed <= 0) {
        return false;
      }
      speed = normalizedSpeed;
      Object.entries(baseDurations).forEach(([key, duration]) => {
        durations[key] = Math.max(0, Number(duration) || 0) / speed;
      });
      return speed;
    }

    function clearScheduledStep() {
      if (timeoutId !== null) cancel(timeoutId);
      timeoutId = null;
      scheduledStep = null;
    }

    function armScheduledStep() {
      if (paused || !scheduledStep) return;
      const delayMs = Math.max(0, scheduledStep.remainingMs);
      scheduledStep.dueAt = now() + delayMs;
      timeoutId = schedule(() => {
        const callback = scheduledStep?.callback;
        timeoutId = null;
        scheduledStep = null;
        callback?.();
      }, delayMs);
    }

    function scheduleStep(callback, delayMs) {
      clearScheduledStep();
      scheduledStep = {
        callback,
        dueAt: null,
        remainingMs: Math.max(0, Number(delayMs) || 0)
      };
      armScheduledStep();
    }

    function clearOpponentLockStep() {
      if (opponentLockTimeoutId !== null) cancel(opponentLockTimeoutId);
      opponentLockTimeoutId = null;
      opponentLockAt = null;
      opponentLockStep = null;
    }

    function armOpponentLockStep() {
      if (paused || !opponentLockStep) return;
      const delayMs = Math.max(0, opponentLockStep.remainingMs);
      opponentLockAt = now() + delayMs;
      opponentLockStep.dueAt = opponentLockAt;
      opponentLockTimeoutId = schedule(() => {
        const callback = opponentLockStep?.callback;
        opponentLockTimeoutId = null;
        opponentLockAt = null;
        opponentLockStep = null;
        callback?.();
      }, delayMs);
    }

    function scheduleOpponentLock(callback, delayMs) {
      clearOpponentLockStep();
      const normalizedDelayMs = Math.max(0, Number(delayMs) || 0);
      opponentLockStep = {
        callback,
        dueAt: null,
        remainingMs: normalizedDelayMs
      };
      armOpponentLockStep();
    }

    function render() {
      hooks.onRender?.(state);
    }

    function setPhase(phase, durationMs = 0) {
      state.phase = phase;
      phaseDurationMs = Math.max(0, Number(durationMs) || 0);
      phaseRemainingMs = phaseDurationMs;
      phaseEndsAt =
        !paused && phaseDurationMs > 0 ? now() + phaseDurationMs : null;
      hooks.onPhase?.({
        durationMs: phaseDurationMs,
        phase,
        phaseEndsAt,
        paused,
        state
      });
      return phase;
    }

    function startRound() {
      state.round += 1;
      state.selections.localAction = null;
      state.selections.localEffectChoice = null;
      state.selections.opponentAction = null;
      state.selections.opponentEffectChoice = null;
      const abilityEffectsEnabled =
        hooks.areAbilityEffectsEnabled?.() !== false;
      const roundStartEffects = abilityEffectsEnabled
        ? resolution.resolveRoundStartEffects?.(state, random) || []
        : [];
      if (roundStartEffects.length) {
        hooks.onRoundStartEffects?.({ effects: roundStartEffects, state });
      }
      pendingOpponentAction = opponent.chooseAction();
      roundActionDeadline = now() + durations.action;
      render();
      setPhase('choose-action', durations.action);
      const latestOpponentLockDelay = Math.max(
        0,
        durations.action - durations.opponentLockBuffer
      );
      const initialOpponentLockDelay = getOpponentDelay({
        maximumDelayMs: latestOpponentLockDelay,
        minimumDelayMs: Math.min(
          durations.opponentInitialMinimum,
          latestOpponentLockDelay
        )
      });
      if (initialOpponentLockDelay > 0) {
        scheduleOpponentLock(lockOpponentAction, initialOpponentLockDelay);
      } else {
        lockOpponentAction();
      }
      scheduleStep(() => {
        const timeoutSelection = hooks.onActionTimeout?.(state);
        const preferredAction =
          timeoutSelection && typeof timeoutSelection === 'object'
            ? timeoutSelection.action
            : timeoutSelection;
        const normalizedAction = resolution.normalizeAction(preferredAction);
        selectAction(
          normalizedAction || opponent.chooseAction(),
          normalizedAction &&
            timeoutSelection &&
            typeof timeoutSelection === 'object'
            ? timeoutSelection.effectChoice || null
            : null
        );
      }, durations.action);
    }

    function finishMatch(winner) {
      clearScheduledStep();
      clearOpponentLockStep();
      state.winner = winner;
      setPhase('complete');
      hooks.onResult?.({
        detail:
          winner === 'local'
            ? 'ALL OPPOSING OLINGS DEFEATED'
            : 'ALL YOUR OLINGS WERE DEFEATED',
        label: winner === 'local' ? 'VICTORY' : 'DEFEAT',
        winner
      });
      hooks.onMatchEnd?.(state);
    }

    function completeTag(side, slot, { forced = false } = {}) {
      const availableSlots = stateModel.getAvailableBenchSlots(side);
      const normalizedSlot = Number(slot);
      const selectedSlot = availableSlots.includes(normalizedSlot)
        ? normalizedSlot
        : side === 'opponent'
          ? chooseOpponentTag(availableSlots)
          : opponent.chooseTag(availableSlots);
      const outgoingOling = state.teams[side]?.[0];
      const selectedOling = state.teams[side]?.find(
        (oling) => Number(oling?.teamSlot) === Number(selectedSlot)
      );
      const tagDetails = {
        forced,
        incomingOling: selectedOling,
        outgoingOling,
        selectedSlot,
        side,
        state
      };
      const tagStart = hooks.onTagStart?.(tagDetails);
      const exitDelayMs = Math.max(0, Number(tagStart?.delayMs) || 0);

      function finishTagSwap() {
        const incomingOling = stateModel.swapActive(side, selectedSlot);
        if (!incomingOling) {
          finishMatch(side === 'local' ? 'opponent' : 'local');
          return null;
        }

        if (side === 'local') state.selections.localTagSlot = null;
        render();
        setPhase('tagged');
        hooks.onTag?.({
          ...tagDetails,
          durationMs: durations.tagged,
          incomingOling
        });
        scheduleStep(processNextTagOperation, durations.tagged);
        return incomingOling;
      }

      if (exitDelayMs > 0) {
        scheduleStep(finishTagSwap, exitDelayMs);
        return selectedOling;
      }
      return finishTagSwap();
    }

    function chooseOpponentTag(availableSlots) {
      const scriptedSlot = Number(pendingOpponentTagSlot);
      pendingOpponentTagSlot = null;
      return availableSlots.includes(scriptedSlot)
        ? scriptedSlot
        : opponent.chooseTag(availableSlots);
    }

    function setOpponentTag(slot) {
      const normalizedSlot = Number(slot);
      if (
        !stateModel.getAvailableBenchSlots('opponent').includes(normalizedSlot)
      ) {
        return false;
      }
      pendingOpponentTagSlot = normalizedSlot;
      return true;
    }

    function setOpponentQueuedTag(slot) {
      const normalizedSlot = Number(slot);
      if (
        !stateModel.getAvailableBenchSlots('opponent').includes(normalizedSlot)
      ) {
        return false;
      }
      pendingOpponentQueuedTagSlot = normalizedSlot;
      return true;
    }

    function beginForcedTag(side) {
      const availableSlots = stateModel.getAvailableBenchSlots(side);
      if (availableSlots.length === 0) {
        finishMatch(side === 'local' ? 'opponent' : 'local');
        return;
      }

      if (side === 'local' && availableSlots.length === 1) {
        completeTag(side, availableSlots[0], { forced: true });
        return;
      }

      if (side === 'opponent') {
        setPhase('opponent-tag');
        scheduleStep(
          () =>
            completeTag(side, chooseOpponentTag(availableSlots), {
              forced: true
            }),
          durations.opponentTag
        );
        return;
      }

      setPhase('choose-tag', durations.tag);
      hooks.onForcedTag?.({ availableSlots, side, state });
      scheduleStep(
        () => completeTag('local', undefined, { forced: true }),
        durations.tag
      );
    }

    function processNextTagOperation() {
      const operation = pendingTagOperations.shift();
      if (!operation) {
        startRound();
        return;
      }

      if (operation.forced) {
        beginForcedTag(operation.side);
        return;
      }

      completeTag(operation.side, operation.slot, { forced: false });
    }

    function advanceAfterResult() {
      const localDefeated = state.teams.local[0].health.heartUnits === 0;
      const opponentDefeated = state.teams.opponent[0].health.heartUnits === 0;
      const queuedLocalSlot = state.selections.localTagSlot;
      const queuedOpponentSlot = pendingOpponentQueuedTagSlot;

      pendingTagOperations = [];
      pendingOpponentQueuedTagSlot = null;
      if (localDefeated) {
        state.selections.localTagSlot = null;
        pendingTagOperations.push({ forced: true, side: 'local' });
      } else if (
        stateModel.getAvailableBenchSlots('local').includes(queuedLocalSlot)
      ) {
        pendingTagOperations.push({
          forced: false,
          side: 'local',
          slot: queuedLocalSlot
        });
      }
      if (opponentDefeated) {
        pendingTagOperations.push({ forced: true, side: 'opponent' });
      } else if (
        stateModel
          .getAvailableBenchSlots('opponent')
          .includes(queuedOpponentSlot)
      ) {
        pendingTagOperations.push({
          forced: false,
          side: 'opponent',
          slot: queuedOpponentSlot
        });
      }
      processNextTagOperation();
    }

    function resolveRound() {
      setPhase('resolving');
      const result = resolution.resolveClash(state, {
        abilityEffects: hooks.areAbilityEffectsEnabled?.() !== false,
        random
      });
      render();
      hooks.onResult?.(result);
      scheduleStep(
        advanceAfterResult,
        result?.winner === 'draw' ? durations.drawResult : durations.result
      );
      return result;
    }

    function revealActions() {
      setPhase('reveal');
      const winner = resolution.determineOutcome(
        state.selections.localAction,
        state.selections.opponentAction
      );
      let roundResolved = false;
      const resolveAtImpact = () => {
        if (paused || roundResolved || state.phase !== 'reveal') return null;
        roundResolved = true;
        clearScheduledStep();
        return resolveRound();
      };
      const setImpactFallback = (delayMs = durations.reveal) => {
        if (roundResolved || state.phase !== 'reveal') return false;
        scheduleStep(resolveAtImpact, delayMs);
        return true;
      };
      setImpactFallback();
      hooks.onReveal?.({
        durationMs: durations.reveal,
        localAction: state.selections.localAction,
        opponentAction: state.selections.opponentAction,
        resolveAtImpact,
        setImpactFallback,
        state,
        winner
      });
    }

    function getOpponentDelay({ maximumDelayMs, minimumDelayMs }) {
      const maximum = Math.max(0, Number(maximumDelayMs) || 0);
      const minimum = Math.min(
        maximum,
        Math.max(0, Number(minimumDelayMs) || 0)
      );
      if (typeof opponent.getActionDelayMs !== 'function') return 0;
      const requestedDelay = Number(
        opponent.getActionDelayMs({
          maximumDelayMs: maximum,
          minimumDelayMs: minimum
        })
      );
      if (!Number.isFinite(requestedDelay)) return maximum;
      return Math.max(minimum, Math.min(maximum, requestedDelay));
    }

    function beginReveal() {
      render();
      setPhase('locked');
      scheduleStep(revealActions, durations.locked);
    }

    function lockOpponentAction() {
      if (state.selections.opponentAction) return false;
      state.selections.opponentAction = pendingOpponentAction;
      pendingOpponentAction = null;
      if (state.selections.localAction) beginReveal();
      return true;
    }

    function accelerateOpponentLock() {
      if (state.selections.opponentAction || opponentLockAt === null) return 0;
      const currentTime = now();
      const remainingToOriginalLock = Math.max(0, opponentLockAt - currentTime);
      const remainingToLatestLock = Math.max(
        0,
        roundActionDeadline - durations.opponentLockBuffer - currentTime
      );
      const maximumDelayMs = Math.min(
        durations.opponentResponse,
        remainingToOriginalLock,
        remainingToLatestLock
      );
      if (maximumDelayMs <= 0) {
        clearOpponentLockStep();
        lockOpponentAction();
        return 0;
      }
      const delayMs = getOpponentDelay({
        maximumDelayMs,
        minimumDelayMs: Math.min(
          durations.opponentResponseMinimum,
          maximumDelayMs
        )
      });
      scheduleOpponentLock(lockOpponentAction, delayMs);
      return delayMs;
    }

    function selectAction(action, effectChoice = null) {
      if (paused || state.phase !== 'choose-action') return false;
      const normalizedAction = resolution.normalizeAction(action);
      if (!normalizedAction) return false;
      clearScheduledStep();
      state.selections.localAction = normalizedAction;
      state.selections.localEffectChoice = effectChoice
        ? { ...effectChoice }
        : null;
      hooks.onActionSubmitted?.({
        action: normalizedAction,
        effectChoice: state.selections.localEffectChoice,
        state
      });
      render();
      if (state.selections.opponentAction) {
        beginReveal();
      } else {
        const opponentDelayMs = accelerateOpponentLock();
        if (!state.selections.opponentAction) {
          setPhase('waiting', opponentDelayMs);
        }
      }
      return true;
    }

    function setOpponentAction(action) {
      if (
        !['choose-action', 'waiting'].includes(state.phase) ||
        state.selections.opponentAction
      ) {
        return false;
      }
      const normalizedAction = resolution.normalizeAction(action);
      if (!normalizedAction) return false;
      pendingOpponentAction = normalizedAction;
      return true;
    }

    function selectTag(slot, { allowWhilePaused = false } = {}) {
      if ((paused && !allowWhilePaused) || state.phase !== 'choose-action') {
        return false;
      }
      const normalizedSlot = slot === null ? null : Number(slot);
      state.selections.localTagSlot = stateModel
        .getAvailableBenchSlots('local')
        .includes(normalizedSlot)
        ? normalizedSlot
        : null;
      render();
      return normalizedSlot === null || state.selections.localTagSlot !== null;
    }

    function confirmTag(slot = state.selections.localTagSlot) {
      if (paused || state.phase !== 'choose-tag') return false;
      clearScheduledStep();
      completeTag('local', slot, { forced: true });
      return true;
    }

    function start() {
      clearScheduledStep();
      clearOpponentLockStep();
      pendingOpponentAction = null;
      pendingOpponentQueuedTagSlot = null;
      pendingOpponentTagSlot = null;
      roundActionDeadline = null;
      pendingTagOperations = [];
      started = true;
      awaitingFirstRound = paused;
      stateModel.reset();
      render();
      if (awaitingFirstRound) setPhase('waiting');
      else startRound();
      return state;
    }

    function pause() {
      if (paused) return false;
      paused = true;
      const currentTime = now();
      if (scheduledStep?.dueAt !== null && timeoutId !== null) {
        scheduledStep.remainingMs = Math.max(
          0,
          scheduledStep.dueAt - currentTime
        );
        cancel(timeoutId);
        timeoutId = null;
        scheduledStep.dueAt = null;
      }
      if (opponentLockStep?.dueAt !== null && opponentLockTimeoutId !== null) {
        opponentLockStep.remainingMs = Math.max(
          0,
          opponentLockStep.dueAt - currentTime
        );
        cancel(opponentLockTimeoutId);
        opponentLockTimeoutId = null;
        opponentLockAt = null;
        opponentLockStep.dueAt = null;
      }
      if (phaseEndsAt !== null) {
        phaseRemainingMs = Math.max(0, phaseEndsAt - currentTime);
        phaseEndsAt = null;
      }
      hooks.onPause?.({ phase: state.phase, state });
      return true;
    }

    function resume() {
      if (!paused) return false;
      paused = false;
      if (!started) return true;
      if (awaitingFirstRound) {
        awaitingFirstRound = false;
        startRound();
        return true;
      }
      phaseEndsAt = phaseRemainingMs > 0 ? now() + phaseRemainingMs : null;
      hooks.onResume?.({
        durationMs: phaseDurationMs,
        phase: state.phase,
        phaseEndsAt,
        remainingMs: phaseRemainingMs,
        state
      });
      armOpponentLockStep();
      armScheduledStep();
      return true;
    }

    function stop() {
      clearScheduledStep();
      clearOpponentLockStep();
      started = false;
      awaitingFirstRound = false;
      pendingOpponentQueuedTagSlot = null;
      pendingOpponentTagSlot = null;
    }

    return {
      confirmTag,
      defaultDurations,
      pause,
      resume,
      selectAction,
      selectTag,
      setSpeed,
      setOpponentAction,
      setOpponentQueuedTag,
      setOpponentTag,
      start,
      state,
      stop,
      get paused() {
        return paused;
      },
      get speed() {
        return speed;
      }
    };
  }

  globalScope.createOlingClashFlow = createOlingClashFlow;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = createOlingClashFlow;
  }
})(typeof window !== 'undefined' ? window : globalThis);
