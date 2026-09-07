(function (globalScope) {
  const abilityCadences = Object.freeze({
    'moss-canopy': Object.freeze({ every: 2, mode: 'cumulative' }),
    'stone-crush': Object.freeze({ every: 2, mode: 'cumulative' }),
    'stone-harden': Object.freeze({ every: 2, mode: 'cumulative' }),
    'vampire-bloodsuck': Object.freeze({ every: 2, mode: 'cumulative' })
  });

  function getAbilityProgress(oling, abilityKey, abilityRevision = 1) {
    if (!Array.isArray(oling.abilityProgress)) oling.abilityProgress = [];
    let progress = oling.abilityProgress.find(
      (entry) =>
        entry.abilityKey === abilityKey &&
        Number(entry.abilityRevision) === Number(abilityRevision)
    );
    if (!progress) {
      progress = {
        abilityKey,
        abilityRevision,
        activationCount: 0,
        data: {}
      };
      oling.abilityProgress.push(progress);
    }
    if (!progress.data || typeof progress.data !== 'object') progress.data = {};
    return progress;
  }

  function advanceAbilityCadence(
    oling,
    abilityKey,
    abilityRevision = 1,
    options = {}
  ) {
    const cadence = abilityCadences[abilityKey] || {
      every: 1,
      mode: 'cumulative'
    };
    const progress = getAbilityProgress(oling, abilityKey, abilityRevision);
    const beforeActivationCount = Math.max(
      0,
      Math.floor(Number(progress.activationCount) || 0)
    );
    const qualifies = options.qualifies !== false;
    if (!qualifies) {
      if (cadence.mode === 'consecutive') progress.activationCount = 0;
      return {
        ...cadence,
        beforeActivationCount,
        afterActivationCount: progress.activationCount,
        triggered: false
      };
    }
    const triggered = beforeActivationCount + 1 >= cadence.every;
    progress.activationCount = triggered ? 0 : beforeActivationCount + 1;
    return {
      ...cadence,
      beforeActivationCount,
      afterActivationCount: progress.activationCount,
      triggered
    };
  }

  function consumePreventedCadence(oling, moveName) {
    const abilityByMove = {
      bloodsuck: ['vampire-bloodsuck', 1],
      canopy: ['moss-canopy', 2],
      crush: ['stone-crush', 1],
      harden: ['stone-harden', 2]
    };
    const ability = abilityByMove[moveName];
    if (!oling || !ability) return null;
    return advanceAbilityCadence(oling, ability[0], ability[1]);
  }

  function getMissingHeartUnits(oling) {
    return Math.max(
      0,
      Number(oling?.health?.maxHeartUnits || 0) -
        Number(oling?.health?.heartUnits || 0)
    );
  }

  function createCadence() {
    return {
      advanceAbilityCadence,
      consumePreventedCadence,
      getAbilityProgress,
      getMissingHeartUnits
    };
  }

  globalScope.createOlingClashAbilityCadence = createCadence;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = createCadence;
  }
})(typeof window !== 'undefined' ? window : globalThis);
