(function (globalScope) {
  const collisionProgress = 0.78;
  const travelStartProgress = 0.18;
  const combatActiveClass = 'is-clash-combat-active';
  const motionClasses = Object.freeze([
    'is-clash-bracing',
    'is-clash-combatant',
    'is-clash-drawing',
    'is-clash-loser',
    'is-clash-motion-held',
    'is-clash-winner'
  ]);

  function getFighters(root) {
    return {
      local: root?.querySelector?.('[data-clash-fighter="local"]'),
      opponent: root?.querySelector?.('[data-clash-fighter="opponent"]')
    };
  }

  function getCenterX(element) {
    const bounds = element?.getBoundingClientRect?.();
    return bounds ? bounds.left + bounds.width / 2 : 0;
  }

  function setMotionValue(fighter, key, value) {
    fighter?.style?.setProperty(key, `${value}px`);
  }

  function clearMotionClasses(fighter) {
    fighter?.classList?.remove(...motionClasses);
  }

  function createOlingClashCombatMotion(options = {}) {
    const schedule =
      typeof options.setTimeout === 'function'
        ? options.setTimeout
        : globalScope.setTimeout.bind(globalScope);
    const cancel =
      typeof options.clearTimeout === 'function'
        ? options.clearTimeout
        : globalScope.clearTimeout.bind(globalScope);
    const onCollision =
      typeof options.onCollision === 'function' ? options.onCollision : null;
    const timers = new Map();
    const heldRoots = new WeakSet();

    function clearTimers(root) {
      const rootTimers = timers.get(root);
      if (rootTimers) {
        Object.values(rootTimers).forEach((timer) => {
          if (timer !== undefined && timer !== null) cancel(timer);
        });
      }
      timers.delete(root);
    }

    function clear(root) {
      clearTimers(root);
      heldRoots.delete(root);
      root?.classList?.remove(combatActiveClass);
      Object.values(getFighters(root)).forEach(clearMotionClasses);
    }

    function hold(root) {
      const fighters = Object.values(getFighters(root)).filter(Boolean);
      if (!fighters.length) return false;
      fighters.forEach((fighter) =>
        fighter.classList.add('is-clash-motion-held')
      );
      heldRoots.add(root);
      return true;
    }

    function release(root) {
      const fighters = Object.values(getFighters(root)).filter(Boolean);
      if (!fighters.length) return false;
      heldRoots.delete(root);
      clearTimers(root);
      fighters.forEach((fighter) =>
        fighter.classList.remove('is-clash-motion-held')
      );
      const cleanupTimer = schedule(() => {
        timers.delete(root);
        root?.classList?.remove(combatActiveClass);
        fighters.forEach(clearMotionClasses);
      }, 700);
      timers.set(root, { cleanupTimer });
      return true;
    }

    function renderPhase(root, phase) {
      const normalizedPhase = String(phase || '').toLowerCase();
      const fighters = Object.values(getFighters(root)).filter(Boolean);
      if (normalizedPhase === 'locked') {
        fighters.forEach((fighter) =>
          fighter.classList.add('is-clash-bracing')
        );
      }
      if (
        [
          'choose-action',
          'choose-tag',
          'complete',
          'opponent-tag',
          'tagged',
          'waiting'
        ].includes(normalizedPhase)
      ) {
        clear(root);
      }
      return normalizedPhase;
    }

    function configureTravel(fighters, winner) {
      const localCenter = getCenterX(fighters.local);
      const opponentCenter = getCenterX(fighters.opponent);
      const measuredDistance = Math.abs(opponentCenter - localCenter);
      const fallbackWidth = Number(
        rootWidth(fighters.local?.closest?.('[data-clash-game]'))
      );
      const distance = measuredDistance || Math.max(240, fallbackWidth * 0.47);
      const strikeDistance = distance * 0.68;
      const drawDistance = distance * 0.38;
      const knockDistance = Math.min(44, Math.max(20, distance * 0.045));

      ['local', 'opponent'].forEach((side) => {
        const fighter = fighters[side];
        const direction = side === 'local' ? 1 : -1;
        const contactDistance =
          winner === 'draw' ? drawDistance : strikeDistance;
        setMotionValue(fighter, '--clash-motion-windup', direction * -14);
        setMotionValue(
          fighter,
          '--clash-motion-approach',
          direction * contactDistance * 0.74
        );
        setMotionValue(
          fighter,
          '--clash-motion-contact',
          direction * contactDistance
        );
        setMotionValue(
          fighter,
          '--clash-motion-bounce',
          direction * contactDistance * 0.92
        );
        setMotionValue(
          fighter,
          '--clash-motion-knockback',
          direction * -knockDistance
        );
      });
    }

    function rootWidth(root) {
      const bounds = root?.getBoundingClientRect?.();
      return bounds?.width || root?.clientWidth || 0;
    }

    function play(
      root,
      {
        durationMs = 3200,
        onCollision: playCollision = null,
        winner = 'draw'
      } = {}
    ) {
      clearTimers(root);
      heldRoots.delete(root);
      const fighters = getFighters(root);
      if (!fighters.local || !fighters.opponent) return null;
      root?.classList?.remove(combatActiveClass);
      Object.values(fighters).forEach((fighter) =>
        fighter.classList.remove(
          'is-clash-combatant',
          'is-clash-drawing',
          'is-clash-loser',
          'is-clash-motion-held',
          'is-clash-winner'
        )
      );
      const normalizedWinner = ['local', 'opponent'].includes(winner)
        ? winner
        : 'draw';
      configureTravel(fighters, normalizedWinner);
      Object.values(fighters).forEach((fighter) =>
        fighter.classList.add('is-clash-combatant')
      );

      if (normalizedWinner === 'draw') {
        Object.values(fighters).forEach((fighter) =>
          fighter.classList.add('is-clash-drawing')
        );
      } else {
        fighters[normalizedWinner].classList.add('is-clash-winner');
        const loser = normalizedWinner === 'local' ? 'opponent' : 'local';
        fighters[loser].classList.add('is-clash-loser');
      }

      const normalizedDuration = Math.max(300, Number(durationMs) || 3200);
      Object.values(fighters).forEach((fighter) =>
        fighter.style.setProperty(
          '--clash-combat-duration',
          `${normalizedDuration}ms`
        )
      );
      const cleanupTimer = schedule(() => {
        timers.delete(root);
        if (heldRoots.has(root)) return;
        root?.classList?.remove(combatActiveClass);
        Object.values(fighters).forEach(clearMotionClasses);
      }, normalizedDuration);
      const collisionTimer = schedule(
        () => {
          [onCollision, playCollision].forEach((collisionHandler) => {
            if (typeof collisionHandler !== 'function') return;
            try {
              Promise.resolve(
                collisionHandler({
                  root,
                  winner: normalizedWinner
                })
              ).catch(() => {});
            } catch (_error) {
              // Collision side effects must not interrupt the combat animation.
            }
          });
        },
        Math.round(normalizedDuration * collisionProgress)
      );
      const panelMoveTimer = schedule(
        () => root?.classList?.add(combatActiveClass),
        Math.round(normalizedDuration * travelStartProgress)
      );
      timers.set(root, { cleanupTimer, collisionTimer, panelMoveTimer });
      return { durationMs: normalizedDuration, winner: normalizedWinner };
    }

    return { clear, hold, play, release, renderPhase };
  }

  globalScope.createOlingClashCombatMotion = createOlingClashCombatMotion;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = createOlingClashCombatMotion;
  }
})(typeof window !== 'undefined' ? window : globalThis);
