(function () {
  function createOlingBattleLobbyContext(dependencies) {
    const { configureBattleOlingFlight, initializeFlightMotion } = dependencies;

      const battleShell =
        document.querySelector('.oling-battle-container') ||
        document.querySelector('.oling-battle-shell');
      const battleTimer =
        document.querySelector('.oling-battle-notch') ||
        document.querySelector('.oling-battle-timer');
      const arena =
        document.querySelector('.oling-battle-screen.oling-battle-arena') ||
        document.querySelector('.oling-battle-arena');
      const battleFooter = document.querySelector(
        '.oling-battle-command-panel'
      );
      const lobbyScreen = document.querySelector('.oling-battle-lobby-screen');
      const lobbyFooter = document.querySelector('.oling-battle-lobby-footer');
      const noOlingState = document.querySelector('.oling-battle-no-oling');

      if (!battleShell || !lobbyScreen || !lobbyFooter) {
        return;
      }

      const lobbyActions = document.querySelector(
        '.oling-battle-lobby-actions'
      );
      const lobbyCode = document.querySelector('.oling-battle-lobby-code');
      const copyButton = document.querySelector('.oling-battle-lobby-copy');
      const qrButton = document.querySelector('.oling-battle-lobby-qr');
      const qrPanel = lobbyScreen.querySelector('.oling-battle-lobby-qr-panel');
      const qrPanelClose = lobbyScreen.querySelector(
        '.oling-battle-lobby-qr-close'
      );
      const qrPanelImage = lobbyScreen.querySelector(
        '.oling-battle-lobby-qr-image'
      );
      const qrPanelCode = lobbyScreen.querySelector(
        '.oling-battle-lobby-qr-code'
      );
      const qrPanelUrl = lobbyScreen.querySelector(
        '.oling-battle-lobby-qr-url'
      );
      const readyButton = document.querySelector('.oling-battle-lobby-ready');
      const matchup = lobbyScreen.querySelector('.oling-battle-lobby-matchup');
      const playerOlingButton = lobbyScreen.querySelector(
        '.oling-battle-lobby-player-oling'
      );
      const playerSelectTrigger = lobbyScreen.querySelector(
        '.oling-battle-lobby-player-select-trigger'
      );
      const lobbyKickButton = lobbyScreen.querySelector(
        '.oling-battle-lobby-kick'
      );
      const enemyOlingButton = lobbyScreen.querySelector(
        '.oling-battle-lobby-enemy-oling'
      );
      const enemySelectTrigger = lobbyScreen.querySelector(
        '.oling-battle-lobby-enemy-select-trigger'
      );
      const picker = lobbyScreen.querySelector(
        '.oling-battle-lobby-oling-picker'
      );
      const pickerPreview = lobbyScreen.querySelector(
        '.oling-battle-lobby-oling-picker-preview'
      );
      const enemyPicker = lobbyScreen.querySelector(
        '.oling-battle-lobby-enemy-picker'
      );
      const enemyPickerPreview = enemyPicker?.querySelector(
        '.oling-battle-lobby-oling-picker-preview'
      );
      const playerDescriptionPanel = lobbyScreen.querySelector(
        '.oling-battle-lobby-player-description'
      );
      const playerDescriptionStats = playerDescriptionPanel?.querySelector(
        '.oling-battle-lobby-description-stats'
      );
      const previousOlingButton = lobbyScreen.querySelector(
        '.oling-battle-lobby-oling-arrow.is-previous'
      );
      const nextOlingButton = lobbyScreen.querySelector(
        '.oling-battle-lobby-oling-arrow.is-next'
      );
      const energyMeter = document.querySelector('.oling-battle-lobby-energy');
      const energyFill = document.querySelector(
        '.oling-battle-lobby-energy-fill'
      );
      const energyValue = document.querySelector(
        '.oling-battle-lobby-energy-value'
      );
      const playerBattleOling = document.querySelector('.player-oling');
      const enemyBattleOling = document.querySelector('.enemy-oling');
      const playerBattleTitle = document.querySelector('.is-player-oling h2');
      const enemyBattleTitle = document.querySelector('.is-enemy-oling h2');
      const playerBattleHealth = document.querySelector('.player-oling-health');
      const enemyBattleHealth = document.querySelector('.enemy-oling-health');
      const playerMarkerArt = document.querySelector(
        '.player-oling-head-marker-art'
      );
      const playerMarkerStem = document.querySelector('.player-marker-stem');
      const playerLobbyOe = lobbyScreen.querySelector(
        '.oling-battle-lobby-party.is-players .oling-battle-lobby-oe'
      );
      const playerLobbyName = lobbyScreen.querySelector(
        '.oling-battle-lobby-party.is-players .oling-battle-lobby-side-label .username'
      );
      const playerReadyCheckmark = lobbyScreen.querySelector(
        '.oling-battle-lobby-party.is-players .checkmark'
      );
      const enemyLobbyParty = lobbyScreen.querySelector(
        '.oling-battle-lobby-party.is-enemies'
      );
      const descriptionPanel = enemyLobbyParty?.querySelector(
        '.oling-battle-lobby-oling-description:not(.oling-battle-lobby-player-description)'
      );
      const descriptionStats = descriptionPanel?.querySelector(
        '.oling-battle-lobby-description-stats'
      );
      const enemyLobbyOe = enemyLobbyParty?.querySelector(
        '.oling-battle-lobby-oe'
      );
      const enemyLobbyName = enemyLobbyParty?.querySelector(
        '.oling-battle-lobby-side-label .username'
      );
      const enemyReadyCheckmark = enemyLobbyParty?.querySelector('.checkmark');

      const fakePlayerOlings = window.getOlingBattleDemoOlings();
      const matchCodeFromPath = window.location.pathname
        .match(/\/olings\/battle\/([A-Za-z0-9]{3}-[A-Za-z0-9]{3})\/?$/)?.[1]
        ?.toUpperCase();
      const savedOlingId = localStorage.getItem('oling-battle-selected-oling');
      let playerOlings = fakePlayerOlings;
      let selectedOlingIndex = Math.max(
        0,
        playerOlings.findIndex((oling) => oling.id === savedOlingId)
      );
      let battleMatch = null;
      let currentAccount = null;
      let opponentOling = null;
      let oeLibraryLookupPromise = null;
      let battleSocket = null;
      let countdownInterval = null;
      let opponentEnterTimeout = null;
      let lastRenderedOpponentKey = null;
      let isStartingBattle = false;
      let lobbyDetailMode = 'default';


    return {
      ...dependencies,
      battleShell,
      battleTimer,
      arena,
      battleFooter,
      lobbyScreen,
      lobbyFooter,
      noOlingState,
      lobbyActions,
      lobbyCode,
      copyButton,
      qrButton,
      qrPanel,
      qrPanelClose,
      qrPanelImage,
      qrPanelCode,
      qrPanelUrl,
      readyButton,
      matchup,
      playerOlingButton,
      playerSelectTrigger,
      lobbyKickButton,
      enemyOlingButton,
      enemySelectTrigger,
      picker,
      pickerPreview,
      enemyPicker,
      enemyPickerPreview,
      playerDescriptionPanel,
      playerDescriptionStats,
      previousOlingButton,
      nextOlingButton,
      energyMeter,
      energyFill,
      energyValue,
      playerBattleOling,
      enemyBattleOling,
      playerBattleTitle,
      enemyBattleTitle,
      playerBattleHealth,
      enemyBattleHealth,
      playerMarkerArt,
      playerMarkerStem,
      playerLobbyOe,
      playerLobbyName,
      playerReadyCheckmark,
      enemyLobbyParty,
      descriptionPanel,
      descriptionStats,
      enemyLobbyOe,
      enemyLobbyName,
      enemyReadyCheckmark,
      fakePlayerOlings,
      matchCodeFromPath,
      savedOlingId,
      playerOlings,
      selectedOlingIndex,
      battleMatch,
      currentAccount,
      opponentOling,
      oeLibraryLookupPromise,
      battleSocket,
      countdownInterval,
      opponentEnterTimeout,
      lastRenderedOpponentKey,
      isStartingBattle,
      lobbyDetailMode,
      configureBattleOlingFlight,
      initializeFlightMotion
    };
  }

  window.createOlingBattleLobbyContext = createOlingBattleLobbyContext;
})();
