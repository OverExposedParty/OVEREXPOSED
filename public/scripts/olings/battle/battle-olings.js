(function () {
  const layout = window.createOlingBattleLayout();
  const timing = window.createOlingBattleTiming();
  const audio = window.createOlingBattleAudio();
  const { initializeBattleInteraction } = window.createOlingBattleInteraction({
    ...timing,
    playOlingBattleAttackSound: audio.playOlingBattleAttackSound
  });
  const { initializeLobbyTestMode } = window.createOlingBattleLobby({
    configureBattleOlingFlight: layout.configureBattleOlingFlight,
    initializeFlightMotion: layout.initializeFlightMotion
  });

  layout.updateBattleLayoutMetrics();
  audio.registerOlingBattleSounds();
  layout.initializeFlightMotion();
  initializeBattleInteraction();
  initializeLobbyTestMode();
  window.addEventListener('resize', layout.updateBattleLayoutMetrics);
})();
