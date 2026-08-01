(function () {
  const initialDevicePixelRatio = window.devicePixelRatio || 1;

  function updateBattleLayoutMetrics() {
    const currentDevicePixelRatio = window.devicePixelRatio || 1;
    const zoomCompensation = initialDevicePixelRatio / currentDevicePixelRatio;
    const header = document.getElementById('header');
    const headerHeight = header?.getBoundingClientRect?.().height || 0;
    const availableHeight = Math.max(
      window.innerHeight - headerHeight,
      320 * zoomCompensation
    );

    document.documentElement.style.setProperty(
      '--oling-battle-zoom-compensation',
      String(zoomCompensation)
    );
    if (headerHeight > 0) {
      document.documentElement.style.setProperty(
        '--oling-battle-header-height',
        `${headerHeight}px`
      );
    }
    document.documentElement.style.setProperty(
      '--oling-battle-available-height',
      `${availableHeight}px`
    );
  }

  function initializeFlightMotion() {
    const flightMotion = window.OlingFlightMotion;
    if (!flightMotion?.configure) return;

    document.querySelectorAll('.oling-battle-oling').forEach((oling) => {
      flightMotion.configure(oling, {
        flightType: oling.dataset.flightType,
        flightMotion: oling.dataset.flightMotion,
        flightSpeed: oling.dataset.flightSpeed
      });
    });
  }

  function configureBattleOlingFlight(container, oling) {
    if (!container || !oling) return;

    const flightTrait = {
      flightType: oling.flightType || container.dataset.flightType,
      flightMotion: oling.flightMotion || container.dataset.flightMotion,
      flightSpeed: oling.flightSpeed || container.dataset.flightSpeed
    };

    container.dataset.flightType = flightTrait.flightType || '';
    container.dataset.flightMotion = flightTrait.flightMotion || '';
    container.dataset.flightSpeed = String(flightTrait.flightSpeed || 1);

    window.OlingFlightMotion?.configure?.(container, flightTrait);
  }

  function createOlingBattleLayout() {
    return {
      configureBattleOlingFlight,
      initializeFlightMotion,
      updateBattleLayoutMetrics
    };
  }

  window.createOlingBattleLayout = createOlingBattleLayout;
})();
