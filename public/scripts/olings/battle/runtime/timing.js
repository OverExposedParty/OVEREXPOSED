(function () {
  function getBattleTimeMultiplier(remainingRatio, isOvertime) {
    if (isOvertime) return 2;
    if (remainingRatio > 0.75) return 1;
    if (remainingRatio > 0.5) return 1.15;
    if (remainingRatio > 0.25) return 1.35;
    return 1.6;
  }

  function createOlingBattleTiming() {
    return {
      baseMarkerSpeed: 96,
      defaultMatchLengthSeconds: 30,
      getBattleTimeMultiplier,
      markerMaximumPosition: 92,
      markerMinimumPosition: 8,
      resultBoundaryRatio: 0.04,
      resultMaximumScale: 1.35,
      stunDurationMilliseconds: 250
    };
  }

  window.createOlingBattleTiming = createOlingBattleTiming;
})();
