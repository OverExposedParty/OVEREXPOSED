(function () {
  function createOlingLabHatchControls(dependencies) {
    const {
      elements,
      getIncubatorContext,
      getIncubatorEggSlot,
      getEgg,
      getHatchProgress,
      formatDuration,
      actions,
      clearHatchTimer,
      state,
      createInlineAction,
      hatchEggFromIncubator,
      removeEggFromIncubator,
      startHatchingStagedEgg
    } = dependencies;

    function updateIncubatorCountdown(
      context,
      root = state.incubatorPanelOpen
        ? elements.incubatorPanelContent
        : elements.menuContent
    ) {
      if (!context || !root) return;
      const liveContext =
        getIncubatorContext(context.parentPlacedId) || context;
      const eggSlot = getIncubatorEggSlot(liveContext);
      const egg = eggSlot?.itemKey ? getEgg(eggSlot.itemKey) : null;
      const isStarted = Boolean(egg && eggSlot?.placedAt);
      const hatchProgress = getHatchProgress(liveContext, eggSlot, egg);
      const statusText = egg
        ? !isStarted
          ? 'Ready to Start'
          : hatchProgress.isReady
            ? 'Ready'
            : 'Incubating'
        : 'Waiting';
      const timeText = egg
        ? !isStarted
          ? 'Not started'
          : hatchProgress.isReady
            ? 'Ready'
            : formatDuration(hatchProgress.remainingMs)
        : '-';

      root
        .querySelectorAll('[data-oling-hatch-countdown]')
        .forEach((element) => {
          const readyAt = Number(element.dataset.olingHatchReadyAt || 0);
          const remainingMs = readyAt
            ? Math.max(0, readyAt - Date.now())
            : hatchProgress.remainingMs;
          element.textContent = !isStarted
            ? 'Ready to start'
            : remainingMs <= 0
              ? 'Ready to hatch'
              : formatDuration(remainingMs);
        });
      root.querySelectorAll('[data-oling-hatch-status]').forEach((element) => {
        element.textContent = statusText;
      });
      root.querySelectorAll('[data-oling-hatch-time]').forEach((element) => {
        const readyAt = Number(element.dataset.olingHatchReadyAt || 0);
        const remainingMs = readyAt
          ? Math.max(0, readyAt - Date.now())
          : hatchProgress.remainingMs;
        element.textContent =
          egg && !isStarted
            ? 'Not started'
            : egg && remainingMs <= 0
              ? 'Ready'
              : readyAt
                ? formatDuration(remainingMs)
                : timeText;
      });
      root
        .querySelectorAll('[data-oling-incubator-progress]')
        .forEach((element) => {
          const readyAt = Number(element.dataset.olingHatchReadyAt || 0);
          const durationMs = Math.max(
            1,
            Number(element.dataset.olingHatchDuration || 1)
          );
          const remainingMs = readyAt
            ? Math.max(0, readyAt - Date.now())
            : hatchProgress.remainingMs;
          const elapsedRatio = isStarted ? 1 - remainingMs / durationMs : 0;
          element.style.setProperty(
            '--oling-incubator-progress',
            `${Math.max(0, Math.min(1, elapsedRatio)) * 100}%`
          );
        });

      root
        .querySelectorAll('.oling-lab-hatch-details-panel')
        .forEach((panel) => {
          panel.classList.toggle(
            'is-ready',
            Boolean(isStarted && hatchProgress.isReady)
          );
          const note = panel.querySelector('[data-oling-hatch-note]');
          if (note) {
            note.textContent = egg
              ? !isStarted
                ? 'Press Start Hatching when you are ready.'
                : hatchProgress.isReady
                  ? 'This egg is ready to hatch.'
                  : 'Hatch unlocks when the timer reaches zero.'
              : 'Choose an egg from your inventory.';
          }

          const actions = panel.querySelector('[data-oling-hatch-actions]');
          syncIncubatorHatchActions(actions, liveContext, egg, hatchProgress, {
            fallback: 'remove'
          });
        });

      elements.menuFooter
        ?.querySelectorAll(
          '.oling-lab-container-action-area[data-oling-active-tab="Incubate"]'
        )
        .forEach((actions) => {
          syncIncubatorHatchActions(actions, liveContext, egg, hatchProgress);
        });

      elements.incubatorPanelFooter
        ?.querySelectorAll('[data-oling-hatch-actions]')
        .forEach((actions) => {
          syncIncubatorHatchActions(actions, liveContext, egg, hatchProgress, {
            fallback: 'incubating'
          });
        });

      if (!egg) clearHatchTimer();
    }

    function startIncubatorCountdown(context) {
      clearHatchTimer();
      const eggSlot = getIncubatorEggSlot(context);
      if (!eggSlot?.itemKey) return;

      updateIncubatorCountdown(context);
      if (!eggSlot.placedAt) return;
      state.hatchTimerInterval = window.setInterval(() => {
        const nextContext = getIncubatorContext(context.parentPlacedId);
        const liveContext = nextContext || context;
        const liveEggSlot = getIncubatorEggSlot(liveContext);
        if (!liveEggSlot?.itemKey || !liveEggSlot.placedAt) {
          clearHatchTimer();
          return;
        }
        updateIncubatorCountdown(liveContext);
      }, 1000);
    }

    function createHatchEggAction(context) {
      return createInlineAction(
        'Hatch Oling',
        () => hatchEggFromIncubator(context),
        {
          className: 'is-hatch-action',
          disabled: state.hatching,
          soundIntent: 'confirm'
        }
      );
    }

    function syncIncubatorHatchActions(
      actions,
      context,
      egg,
      hatchProgress,
      options = {}
    ) {
      if (!actions) return;
      const eggSlot = getIncubatorEggSlot(context);
      const isStarted = Boolean(egg && eggSlot?.placedAt);
      const isReady = Boolean(isStarted && hatchProgress.isReady);
      const signature = [
        isReady ? 'ready' : isStarted ? 'incubating' : 'inserted',
        options.fallback || 'none',
        egg?.key || '',
        state.hatching ? 'hatching' : ''
      ].join(':');
      if (actions.dataset.ready === signature) return;
      actions.dataset.ready = signature;
      actions.replaceChildren();

      if (isReady) {
        actions.appendChild(createHatchEggAction(context));
      } else if (egg && !isStarted) {
        actions.appendChild(
          createInlineAction(
            'Start Hatching',
            () => startHatchingStagedEgg(context),
            { className: 'is-hatch-action', soundIntent: 'confirm' }
          )
        );
      } else if (options.fallback === 'remove') {
        actions.appendChild(
          createInlineAction(
            'Remove Egg',
            () => removeEggFromIncubator(context),
            {
              className: 'is-remove-action',
              disabled: !egg,
              soundIntent: 'deselect'
            }
          )
        );
      } else if (options.fallback === 'incubating' && egg) {
        actions.appendChild(
          createInlineAction('Incubating…', () => {}, {
            disabled: true,
            sound: false
          })
        );
      }
    }

    const getSampleHatchReceiptPreview = () =>
      window.getOlingLabSampleHatchReceiptPreview();

    return {
      updateIncubatorCountdown,
      startIncubatorCountdown,
      createHatchEggAction,
      syncIncubatorHatchActions,
      getSampleHatchReceiptPreview
    };
  }

  window.createOlingLabHatchControls = createOlingLabHatchControls;
})();
