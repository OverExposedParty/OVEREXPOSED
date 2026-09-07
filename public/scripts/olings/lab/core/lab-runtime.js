(function () {
  window.createOlingLabRuntime = () => {
    const tutorialMode =
      String(window.location?.pathname || '').replace(/\/+$/, '') ===
      '/olings/lab/tutorial';
    const constants = window.createOlingLabConfig(window.location);
    const state = window.createOlingLabState(constants, tutorialMode);
    const elements = window.getOlingLabElements(document);
    const selection = window.createOlingLabSelection({ state, elements });

    const getLabImageAssetUrl = (assetUrl) =>
      String(assetUrl || '').replace(
        '/images/olings/lab/furniture/ceiling-lights/basic-hanging-light.svg',
        '/images/olings/lab/furniture/ceiling-lights/basic-hanging-light/basic-hanging-light.svg'
      );
    const setStatus = (message) => {
      if (elements.status) elements.status.textContent = message;
    };
    const clearTimer = (key) => {
      if (!state[key]) return;
      window.clearInterval(state[key]);
      state[key] = null;
    };
    const parsePayload = (response) =>
      response.json().then((payload) => {
        if (!response.ok || payload.success === false) {
          throw new Error(payload.error?.message || 'Lab request failed');
        }
        return payload;
      });

    return {
      constants,
      state,
      elements,
      getLabImageAssetUrl,
      setStatus,
      clearHatchTimer: () => clearTimer('hatchTimerInterval'),
      clearRestTimer: () => clearTimer('restTimerInterval'),
      clearAdventureTimer: () => clearTimer('adventureTimerInterval'),
      parsePayload,
      ...selection,
      bindEvents: (dependencies) =>
        window.bindOlingLabEvents({
          state,
          elements,
          closeSelectedTarget: selection.closeSelectedTarget,
          ...dependencies
        })
    };
  };
})();
