(function () {
  function createOlingLabHatchSelectors({ defaultHatchDurationMs, state }) {
    function getHatchSpeedPercent(eggSlot) {
      return (eggSlot?.influenceSlots || []).reduce((total, influence) => {
        const consumable = state?.consumables?.get(influence.itemKey);
        if (consumable?.effect?.type !== 'hatch_speed') return total;
        return total + Math.max(0, Number(consumable.effect.amount) || 0);
      }, 0);
    }
    function getConfiguredHatchDurationMs(context, egg, eggSlot = null) {
      const values = [
        egg?.metadata?.hatchMilliseconds,
        egg?.metadata?.hatchMs,
        Number(egg?.metadata?.hatchSeconds) * 1000,
        Number(egg?.metadata?.hatchMinutes) * 60 * 1000,
        context?.incubator?.hatchMilliseconds,
        context?.incubator?.hatchMs,
        Number(context?.incubator?.hatchSeconds) * 1000,
        Number(context?.incubator?.hatchMinutes) * 60 * 1000
      ];
      const duration = values.find(
        (value) => Number.isFinite(Number(value)) && Number(value) > 0
      );
      const baseDurationMs = Number(duration) || defaultHatchDurationMs;
      const speedPercent = getHatchSpeedPercent(eggSlot);
      return speedPercent > 0
        ? Math.round(baseDurationMs / (1 + speedPercent / 100))
        : baseDurationMs;
    }
    function getHatchProgress(context, eggSlot, egg) {
      if (!egg || !eggSlot?.placedAt) {
        return {
          isReady: false,
          remainingMs: 0,
          durationMs: getConfiguredHatchDurationMs(context, egg),
          startedAt: null,
          readyAt: null
        };
      }
      const startedAt = new Date(eggSlot.placedAt).getTime();
      const durationMs = getConfiguredHatchDurationMs(context, egg, eggSlot);
      const readyAt = Number.isFinite(startedAt)
        ? startedAt + durationMs
        : Date.now();
      const remainingMs = Math.max(0, readyAt - Date.now());
      return {
        isReady: remainingMs <= 0,
        remainingMs,
        durationMs,
        startedAt,
        readyAt
      };
    }
    return {
      getConfiguredHatchDurationMs,
      getHatchProgress,
      getHatchSpeedPercent
    };
  }
  window.createOlingLabHatchSelectors = createOlingLabHatchSelectors;
})();
