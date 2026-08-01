(function () {
  function createOlingBattleInteraction(dependencies) {
    const {
      baseMarkerSpeed,
      defaultMatchLengthSeconds,
      getBattleTimeMultiplier,
      markerMaximumPosition,
      markerMinimumPosition,
      playOlingBattleAttackSound,
      resultBoundaryRatio,
      resultMaximumScale,
      stunDurationMilliseconds
    } = dependencies;

    function initializeBattleInteraction() {
      const arena =
        document.querySelector('.oling-battle-screen') ||
        document.querySelector('.oling-battle-arena');
      const battleShell =
        document.querySelector('.oling-battle-container') ||
        document.querySelector('.oling-battle-shell');
      const battleTimer =
        document.querySelector('.oling-battle-notch') ||
        document.querySelector('.oling-battle-timer');
      const momentumBar = document.querySelector('.battle-momentum-bar');
      const momentumTrack = document.querySelector('.momentum-track');
      const playerMarker = document.querySelector('.player-oling-head-marker');
      const resultText = document.querySelector('.battle-hit-result');
      const commandPanel =
        document.querySelector('.oling-battle-footer') ||
        document.querySelector('.oling-battle-command-panel');
      const hitMarkers = Array.from(
        document.querySelectorAll('.hit-tracker-marker')
      );
      const playerHealth = document.querySelector('.player-oling-health');
      const enemyHealth = document.querySelector('.enemy-oling-health');
      const sceneLayers = Array.from(
        arena?.querySelectorAll('.oling-battle-scene-layer') || []
      );

      if (
        !arena ||
        !momentumBar ||
        !momentumTrack ||
        !playerMarker ||
        !resultText
      ) {
        return;
      }

      let markerPosition = 50;
      let markerDirection = 1;
      let previousTimestamp = null;
      let matchStartedAt = null;
      let markerPausedUntil = 0;
      let isFullDisruption = false;
      let isBattleRunning = false;
      let isAttackPending = false;
      let battleTimeMultiplier = null;
      let resolvedHitCount = 0;
      const hitHistory = [];
      let sceneShakeTimeout = null;
      const matchLengthSeconds =
        Number(
          battleShell?.dataset.matchLength || battleTimer?.dataset.matchLength
        ) || defaultMatchLengthSeconds;
      const flightMotionRoots = Array.from(
        document.querySelectorAll(
          '.oling-battle-oling, .player-oling-head-marker-art'
        )
      );

      function setBattleTimeMultiplier(multiplier) {
        if (battleTimeMultiplier === multiplier) {
          return;
        }

        battleTimeMultiplier = multiplier;
        if (battleShell) {
          battleShell.style.setProperty(
            '--battle-time-multiplier',
            String(multiplier)
          );
          battleShell.dataset.battleTimeMultiplier = String(multiplier);
        }

        if (!window.OlingFlightMotion?.setSpeedMultiplier) {
          return;
        }

        flightMotionRoots.forEach((oling) => {
          window.OlingFlightMotion.setSpeedMultiplier(oling, multiplier);
        });
      }

      function updateMatchClock(timestamp) {
        if (matchStartedAt === null) {
          matchStartedAt = timestamp;
        }

        const elapsedSeconds = Math.max(0, (timestamp - matchStartedAt) / 1000);
        const remainingSeconds = Math.max(
          0,
          matchLengthSeconds - elapsedSeconds
        );
        const remainingRatio =
          matchLengthSeconds > 0 ? remainingSeconds / matchLengthSeconds : 0;
        const isOvertime = elapsedSeconds >= matchLengthSeconds;
        const displaySeconds = isOvertime ? 0 : Math.ceil(remainingSeconds);
        const multiplier = getBattleTimeMultiplier(remainingRatio, isOvertime);

        setBattleTimeMultiplier(multiplier);
        if (!battleTimer) return;

        battleTimer.textContent = String(displaySeconds);
        battleTimer.classList.toggle('is-overtime', isOvertime);
        battleTimer.dataset.remainingSeconds = String(
          Math.round(remainingSeconds)
        );
        battleTimer.dataset.matchLength = String(matchLengthSeconds);
        battleTimer.dataset.battleTimeMultiplier = String(multiplier);
        battleTimer.setAttribute(
          'aria-label',
          isOvertime
            ? `Battle timer, overtime, speed multiplier ${multiplier}x`
            : `Battle timer, ${displaySeconds} seconds remaining, speed multiplier ${multiplier}x`
        );
      }

      function setFullDisruption(isActive) {
        isFullDisruption = isActive;
        momentumBar.classList.toggle('is-full-disruption', isActive);

        if (isActive) {
          momentumBar.dataset.trackState = 'disruption-zone';
        } else {
          delete momentumBar.dataset.trackState;
        }
      }

      function updateBattleAnimation(timestamp) {
        if (!isBattleRunning) {
          previousTimestamp = null;
          return;
        }
        updateMatchClock(timestamp);

        if (previousTimestamp !== null && timestamp >= markerPausedUntil) {
          const elapsedSeconds = Math.min(
            (timestamp - previousTimestamp) / 1000,
            0.05
          );
          markerPosition +=
            markerDirection *
            baseMarkerSpeed *
            (battleTimeMultiplier || 1) *
            elapsedSeconds;

          if (markerPosition >= markerMaximumPosition) {
            markerPosition = markerMaximumPosition;
            markerDirection = -1;
            if (isFullDisruption) {
              setFullDisruption(false);
            }
          } else if (markerPosition <= markerMinimumPosition) {
            markerPosition = markerMinimumPosition;
            markerDirection = 1;
            if (isFullDisruption) {
              setFullDisruption(false);
            }
          }
        }

        previousTimestamp = timestamp;
        momentumBar.style.setProperty(
          '--player-marker-position',
          `${markerPosition}%`
        );
        window.requestAnimationFrame(updateBattleAnimation);
      }

      function getCurrentZone() {
        if (isFullDisruption) {
          return 'disruption';
        }

        const markerBounds = playerMarker.getBoundingClientRect();
        const trackBounds = momentumTrack.getBoundingClientRect();
        const markerCenter = markerBounds.left + markerBounds.width / 2;
        const trackPosition = Math.max(
          0,
          Math.min(
            100,
            ((markerCenter - trackBounds.left) / trackBounds.width) * 100
          )
        );

        if (trackPosition >= 42.5 && trackPosition < 57.5) {
          return 'critical';
        }

        if (
          (trackPosition >= 32.5 && trackPosition < 42.5) ||
          (trackPosition >= 57.5 && trackPosition < 67.5)
        ) {
          return 'strike';
        }

        return 'disruption';
      }

      function getResultForZone(zone) {
        if (zone === 'critical') {
          return 'CRITICAL HIT';
        }

        if (zone === 'strike') {
          return Math.random() < 0.5 ? 'HIT' : 'MISS';
        }

        return 'STUN';
      }

      function updateHealthMeter(meter, currentHealth, maxHealth) {
        if (!meter) return;

        const maximum = Math.max(1, Number(maxHealth) || 1);
        const current = Math.max(
          0,
          Math.min(maximum, Number(currentHealth) || 0)
        );
        meter.dataset.currentHealth = String(current);
        meter.dataset.maxHealth = String(maximum);
        meter.setAttribute('aria-valuemax', String(maximum));
        meter.setAttribute('aria-valuenow', String(current));
        meter
          .querySelector('span')
          ?.style.setProperty(
            '--health-level',
            `${(current / maximum) * 100}%`
          );
        const value = meter.querySelector('strong');
        if (value) value.textContent = `${current}/${maximum}`;
      }

      async function requestBattleHit(zone) {
        const matchCode = battleShell?.dataset.matchCode;
        const response = await fetch(
          `/api/olings/battles/${encodeURIComponent(matchCode)}/hit`,
          {
            method: 'POST',
            headers: {
              Accept: 'application/json',
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ zone })
          }
        );
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || payload.success === false) {
          throw new Error(
            payload.error?.message || 'That battle hit could not resolve.'
          );
        }
        return payload;
      }

      function showResultAtActivationPoint(result, zone, event) {
        const arenaBounds = arena.getBoundingClientRect();
        const commandPanelBounds = commandPanel?.getBoundingClientRect();
        const visibleArenaHeight = commandPanelBounds
          ? Math.min(
              arenaBounds.height,
              commandPanelBounds.top - arenaBounds.top
            )
          : arenaBounds.height;
        const hasPointerCoordinates =
          Number.isFinite(event?.clientX) && Number.isFinite(event?.clientY);
        const requestedX = hasPointerCoordinates
          ? event.clientX - arenaBounds.left
          : arenaBounds.width / 2;
        const requestedY = hasPointerCoordinates
          ? event.clientY - arenaBounds.top
          : visibleArenaHeight / 2;
        const tiltDirection = Math.random() < 0.5 ? -1 : 1;
        const tiltDegrees = tiltDirection * (5 + Math.random() * 30);

        resultText.className = `battle-hit-result is-${zone}`;
        resultText.textContent = result;
        resultText.style.setProperty('--result-rotation', `${tiltDegrees}deg`);
        resultText.style.left = '50%';
        resultText.style.top = '50%';

        const measuredBounds = resultText.getBoundingClientRect();
        const boundary = arenaBounds.width * resultBoundaryRatio;
        const halfWidth = (measuredBounds.width * resultMaximumScale) / 2;
        const halfHeight = (measuredBounds.height * resultMaximumScale) / 2;
        const minimumX = boundary + halfWidth;
        const maximumX = arenaBounds.width - boundary - halfWidth;
        const minimumY = boundary + halfHeight;
        const maximumY = visibleArenaHeight - boundary - halfHeight;
        const clampedX =
          minimumX <= maximumX
            ? Math.min(Math.max(requestedX, minimumX), maximumX)
            : arenaBounds.width / 2;
        const clampedY =
          minimumY <= maximumY
            ? Math.min(Math.max(requestedY, minimumY), maximumY)
            : visibleArenaHeight / 2;

        resultText.style.left = `${clampedX}px`;
        resultText.style.top = `${clampedY}px`;
        void resultText.offsetWidth;
        resultText.classList.add('is-visible');
      }

      function renderHitHistory() {
        hitMarkers.forEach((hitMarker, index) => {
          const hit = hitHistory[index];
          hitMarker.classList.remove(
            'is-critical',
            'is-strike',
            'is-disruption'
          );
          delete hitMarker.dataset.zone;
          delete hitMarker.dataset.result;
          delete hitMarker.dataset.hitSequence;

          if (!hit) {
            hitMarker.setAttribute(
              'aria-label',
              `Hit history position ${hitMarker.dataset.hitNumber}: empty`
            );
            return;
          }

          hitMarker.classList.add(`is-${hit.zone}`);
          hitMarker.dataset.zone = `${hit.zone}-zone`;
          hitMarker.dataset.result = hit.resultKey;
          hitMarker.dataset.hitSequence = String(hit.sequence);
          hitMarker.setAttribute(
            'aria-label',
            `Hit ${hit.sequence}: ${hit.result}; history position ${hitMarker.dataset.hitNumber}`
          );
        });
      }

      function addHitToHistory(zone, result) {
        resolvedHitCount += 1;
        hitHistory.unshift({
          result,
          resultKey: result.toLowerCase().replaceAll(' ', '-'),
          sequence: resolvedHitCount,
          zone
        });
        if (hitHistory.length > hitMarkers.length) {
          hitHistory.length = hitMarkers.length;
        }
        renderHitHistory();
      }

      function shakeBattleScene() {
        if (!sceneLayers.length) return;

        if (sceneShakeTimeout) window.clearTimeout(sceneShakeTimeout);
        sceneLayers.forEach((layer) => layer.classList.remove('is-shaking'));
        void arena.offsetWidth;
        sceneLayers.forEach((layer) => layer.classList.add('is-shaking'));
        sceneShakeTimeout = window.setTimeout(() => {
          sceneLayers.forEach((layer) => layer.classList.remove('is-shaking'));
          sceneShakeTimeout = null;
        }, 360);
      }

      function applyBattleHit(
        payload,
        zone,
        event,
        { showLocalFeedback = true } = {}
      ) {
        const battleResult = payload.battleResult || {};
        const result = battleResult.result || getResultForZone(zone);
        playOlingBattleAttackSound(result);
        if (showLocalFeedback) {
          shakeBattleScene();
          showResultAtActivationPoint(result, zone, event);
          momentumBar.dataset.lastZone = `${zone}-zone`;
          momentumBar.dataset.lastResult = result
            .toLowerCase()
            .replaceAll(' ', '-');
          addHitToHistory(zone, result);
        }
        if (Number.isFinite(Number(battleResult.targetCurrentHealth))) {
          const targetMeter =
            battleResult.targetSlot === battleShell?.dataset.currentPlayerSlot
              ? playerHealth
              : enemyHealth;
          updateHealthMeter(
            targetMeter,
            battleResult.targetCurrentHealth,
            battleResult.targetMaxHealth
          );
        }

        isAttackPending = false;
        if (battleResult.ended) {
          isBattleRunning = false;
          window.setTimeout(() => {
            hitHistory.length = 0;
            resolvedHitCount = 0;
            renderHitHistory();
            resultText.classList.remove('is-visible');
            document.dispatchEvent(
              new CustomEvent('oling-battle:ended', {
                detail: { battleResult, match: payload.match || null }
              })
            );
          }, 700);
        }
      }

      document.addEventListener('oling-battle:external-hit', (event) => {
        const payload = event.detail?.payload;
        const zone =
          event.detail?.zone || payload?.battleResult?.zone || 'disruption';
        if (!payload?.battleResult) return;
        applyBattleHit(payload, zone, event.detail?.sourceEvent || null, {
          showLocalFeedback: false
        });
      });

      function resolveAttack(event) {
        if (!isBattleRunning || isAttackPending) {
          return;
        }

        const zone = getCurrentZone();
        isAttackPending = true;

        if (zone === 'disruption') {
          markerPausedUntil = performance.now() + stunDurationMilliseconds;
        }
        setFullDisruption(true);

        if (!battleShell?.dataset.matchCode) {
          applyBattleHit(
            {
              battleResult: {
                damage: 0,
                ended: false,
                result: getResultForZone(zone),
                zone
              }
            },
            zone,
            event
          );
          return;
        }

        requestBattleHit(zone)
          .then((payload) => applyBattleHit(payload, zone, event))
          .catch((error) => {
            console.error('Failed to resolve Oling battle hit:', error);
            isAttackPending = false;
          });
      }

      arena.addEventListener('click', resolveAttack);
      arena.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') {
          return;
        }

        event.preventDefault();
        resolveAttack(event);
      });

      function startBattleInteraction() {
        if (isBattleRunning) return;

        isBattleRunning = true;
        isAttackPending = false;
        previousTimestamp = null;
        matchStartedAt = null;
        window.requestAnimationFrame(updateBattleAnimation);
      }

      document.addEventListener('oling-battle:start', startBattleInteraction);
      if (!battleShell?.classList.contains('is-lobby')) {
        startBattleInteraction();
      }
    }

    return { initializeBattleInteraction };
  }

  window.createOlingBattleInteraction = createOlingBattleInteraction;
})();
