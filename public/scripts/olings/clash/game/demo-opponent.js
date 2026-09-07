(function (globalScope) {
  const actions = Object.freeze(['attack', 'guard', 'skill']);
  const defaultActionDelayRange = Object.freeze({
    maximum: 1800,
    minimum: 900
  });

  function getRandomValue(random) {
    return Math.max(0, Math.min(0.999999, Number(random()) || 0));
  }

  function chooseFrom(values, random) {
    if (!Array.isArray(values) || values.length === 0) return null;
    const randomValue = getRandomValue(random);
    return values[Math.floor(randomValue * values.length)];
  }

  function normalizeDelay(value, fallback) {
    const numericValue = Number(value);
    return Number.isFinite(numericValue) && numericValue >= 0
      ? numericValue
      : fallback;
  }

  function createOlingClashDemoOpponent(options = {}) {
    const random =
      typeof options.random === 'function' ? options.random : Math.random;
    const minimumActionDelayMs = normalizeDelay(
      options.minimumActionDelayMs,
      defaultActionDelayRange.minimum
    );
    const maximumActionDelayMs = Math.max(
      minimumActionDelayMs,
      normalizeDelay(
        options.maximumActionDelayMs,
        defaultActionDelayRange.maximum
      )
    );

    return {
      actions,
      chooseAction() {
        return chooseFrom(actions, random);
      },
      chooseTag(availableSlots) {
        return chooseFrom(availableSlots, random);
      },
      getActionDelayMs(delayOptions = {}) {
        const minimumDelayMs = normalizeDelay(
          delayOptions.minimumDelayMs,
          minimumActionDelayMs
        );
        const maximumDelayMs = Math.max(
          minimumDelayMs,
          normalizeDelay(delayOptions.maximumDelayMs, maximumActionDelayMs)
        );
        const range = maximumDelayMs - minimumDelayMs;
        return Math.round(minimumDelayMs + range * getRandomValue(random));
      }
    };
  }

  globalScope.createOlingClashDemoOpponent = createOlingClashDemoOpponent;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = createOlingClashDemoOpponent;
  }
})(typeof window !== 'undefined' ? window : globalThis);
