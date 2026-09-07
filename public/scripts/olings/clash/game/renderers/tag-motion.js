(function (globalScope) {
  function getRelativeRect(element, rootRect) {
    const bounds = element?.getBoundingClientRect?.();
    if (!bounds) return null;
    return {
      height: bounds.height,
      left: bounds.left - rootRect.left,
      top: bounds.top - rootRect.top,
      width: bounds.width
    };
  }

  function createGhost(
    documentRef,
    source,
    start,
    end,
    type,
    side,
    forced,
    reusableGhost = null
  ) {
    const art = source?.querySelector?.('.olings-clash-oling-art');
    if (!art || !start || !end || start.width <= 0 || start.height <= 0) {
      return null;
    }

    const ghost = reusableGhost || documentRef.createElement('div');
    const direction = side === 'local' ? 1 : -1;
    const deltaX = end.left - start.left + (end.width - start.width) / 2;
    const deltaY = end.top - start.top + (end.height - start.height) / 2;
    const endScale = Math.max(0.05, end.width / start.width);
    const middleScale = 1 + (endScale - 1) * 0.48;
    const middleX = deltaX * 0.48;
    const arcOffset = type === 'outgoing' ? (forced ? 28 : 12) : -28;
    const middleY = deltaY * 0.48 + arcOffset;
    const overshootX = deltaX + direction * 12;
    const overshootY = deltaY - 10;

    ghost.className = `olings-clash-tag-ghost is-${type}`;
    ghost.style.left = `${start.left}px`;
    ghost.style.top = `${start.top}px`;
    ghost.style.width = `${start.width}px`;
    ghost.style.height = `${start.height}px`;
    ghost.style.setProperty('--clash-tag-x', `${deltaX}px`);
    ghost.style.setProperty('--clash-tag-y', `${deltaY}px`);
    ghost.style.setProperty('--clash-tag-mid-x', `${middleX}px`);
    ghost.style.setProperty('--clash-tag-mid-y', `${middleY}px`);
    ghost.style.setProperty('--clash-tag-end-scale', String(endScale));
    ghost.style.setProperty('--clash-tag-mid-scale', String(middleScale));
    ghost.style.setProperty('--clash-tag-over-x', `${overshootX}px`);
    ghost.style.setProperty('--clash-tag-over-y', `${overshootY}px`);
    ghost.style.setProperty('--clash-tag-over-scale', String(endScale * 1.05));
    ghost.setAttribute('aria-hidden', 'true');
    ghost.replaceChildren(art.cloneNode(true));
    return ghost;
  }

  function getOffscreenRect(fighterRect, surfaceRect, side, scale) {
    const width = fighterRect.width * scale;
    const height = fighterRect.height * scale;
    return {
      height,
      left:
        side === 'local' ? -width - 24 : Math.max(0, surfaceRect.width) + 24,
      top: fighterRect.top + (fighterRect.height - height) / 2,
      width
    };
  }

  function intersects(first, second) {
    const firstBounds = first?.getBoundingClientRect?.();
    const secondBounds = second?.getBoundingClientRect?.();
    if (!firstBounds || !secondBounds) return false;
    const firstRight =
      firstBounds.right ?? firstBounds.left + firstBounds.width;
    const firstBottom =
      firstBounds.bottom ?? firstBounds.top + firstBounds.height;
    const secondRight =
      secondBounds.right ?? secondBounds.left + secondBounds.width;
    const secondBottom =
      secondBounds.bottom ?? secondBounds.top + secondBounds.height;
    return (
      firstBounds.left <= secondRight &&
      firstRight >= secondBounds.left &&
      firstBounds.top <= secondBottom &&
      firstBottom >= secondBounds.top
    );
  }

  function finishRosterCardMotion(entry) {
    entry?.roster?.classList.remove('is-tag-reordering');
    [entry?.incomingRosterCard, entry?.outgoingRosterCard].forEach((card) => {
      card?.classList.remove(
        'is-roster-tag-sliding-out',
        'is-roster-tag-sliding-in'
      );
      card?.style.removeProperty('--clash-roster-tag-duration');
    });
  }

  function createOlingClashTagMotion(options = {}) {
    const schedule =
      typeof options.setTimeout === 'function'
        ? options.setTimeout
        : globalScope.setTimeout.bind(globalScope);
    const cancel =
      typeof options.clearTimeout === 'function'
        ? options.clearTimeout
        : globalScope.clearTimeout.bind(globalScope);
    const requestFrame =
      typeof options.requestAnimationFrame === 'function'
        ? options.requestAnimationFrame
        : typeof globalScope.requestAnimationFrame === 'function'
          ? globalScope.requestAnimationFrame.bind(globalScope)
          : (callback) => schedule(callback, 16);
    const cancelFrame =
      typeof options.cancelAnimationFrame === 'function'
        ? options.cancelAnimationFrame
        : typeof globalScope.cancelAnimationFrame === 'function'
          ? globalScope.cancelAnimationFrame.bind(globalScope)
          : cancel;
    const onCollision =
      typeof options.onCollision === 'function' ? options.onCollision : null;
    const prefersReducedMotion =
      typeof options.prefersReducedMotion === 'boolean'
        ? options.prefersReducedMotion
        : Boolean(
            globalScope.matchMedia?.('(prefers-reduced-motion: reduce)')
              ?.matches
          );
    const prepared = new Map();
    const stagePool = [];
    const ghostPool = [];

    function recycleEntry(entry) {
      if (!entry) return;
      entry.stage?.remove();
      entry.stage?.classList.remove('is-exiting', 'is-forced', 'is-playing');
      entry.stage?.style.removeProperty('--clash-tag-duration');
      entry.outgoing?.remove();
      entry.outgoing?.replaceChildren();
      if (entry.outgoing && ghostPool.length < 2) {
        ghostPool.push(entry.outgoing);
      }
      entry.stage?.replaceChildren();
      if (entry.stage && stagePool.length < 2) stagePool.push(entry.stage);
    }

    function clear(root) {
      const entry = prepared.get(root);
      if (entry?.timer !== undefined) cancel(entry.timer);
      if (entry?.collisionTimer !== undefined) cancel(entry.collisionTimer);
      if (entry?.collisionFrame !== undefined) {
        cancelFrame(entry.collisionFrame);
      }
      recycleEntry(entry);
      entry?.fighterArt?.classList.remove('is-tag-motion-hidden');
      entry?.fighterArt?.classList.remove('is-tag-incoming');
      entry?.fighterArt?.style.removeProperty('--clash-tag-incoming-start-x');
      entry?.fighterArt?.style.removeProperty('--clash-tag-incoming-start-y');
      entry?.fighterArt?.style.removeProperty(
        '--clash-tag-incoming-start-scale'
      );
      entry?.fighterArt?.style.removeProperty(
        '--clash-tag-incoming-early-scale'
      );
      entry?.fighterArt?.style.removeProperty('--clash-tag-incoming-over-x');
      entry?.fighterArt?.style.removeProperty('--clash-tag-incoming-over-y');
      entry?.fighter?.classList.remove('is-tag-transitioning');
      entry?.fighter?.style.removeProperty('--clash-tag-duration');
      finishRosterCardMotion(entry);
      prepared.delete(root);
    }

    function exit(root, { durationMs = 280 } = {}) {
      const entry = prepared.get(root);
      if (!entry || prefersReducedMotion) return null;
      const duration = Math.max(120, Number(durationMs) || 280);
      entry.roster?.classList.add('is-tag-reordering');
      [entry.incomingRosterCard, entry.outgoingRosterCard].forEach((card) => {
        card?.style.setProperty('--clash-roster-tag-duration', `${duration}ms`);
        card?.classList.remove('is-roster-tag-sliding-in');
        card?.classList.add('is-roster-tag-sliding-out');
      });
      entry.stage.style.setProperty('--clash-tag-duration', `${duration}ms`);
      entry.stage.classList.toggle('is-forced', entry.forced);
      entry.stage.classList.add('is-exiting');
      entry.fighterArt.classList.add('is-tag-motion-hidden');
      entry.fighter.classList.add('is-tag-transitioning');
      entry.exitStarted = true;
      entry.exitDurationMs = duration;
      return { durationMs: duration, forced: entry.forced, side: entry.side };
    }

    function emitCollision(root, entry) {
      if (entry.collided || prepared.get(root) !== entry) return false;
      entry.collided = true;
      if (entry.collisionTimer !== undefined) {
        cancel(entry.collisionTimer);
        entry.collisionTimer = undefined;
      }
      if (entry.collisionFrame !== undefined) {
        cancelFrame(entry.collisionFrame);
        entry.collisionFrame = undefined;
      }
      try {
        Promise.resolve(
          onCollision?.({ forced: entry.forced, root, side: entry.side })
        ).catch(() => {});
      } catch (_error) {
        // Audio failure must not interrupt the Tag animation.
      }
      return true;
    }

    function watchForCollision(root, entry, duration) {
      if (!onCollision) return;
      const check = () => {
        entry.collisionFrame = undefined;
        if (prepared.get(root) !== entry || entry.collided) return;
        if (intersects(entry.outgoing, entry.incoming)) {
          emitCollision(root, entry);
          return;
        }
        entry.collisionFrame = requestFrame(check);
      };
      entry.collisionFrame = requestFrame(check);
      entry.collisionTimer = schedule(
        () => emitCollision(root, entry),
        Math.round(duration * 0.6)
      );
    }

    function prepare(
      root,
      { forced = false, selectedSlot, side = 'local' } = {}
    ) {
      clear(root);
      const surface = root?.querySelector?.('.olings-clash-game__surface');
      const fighter = root?.querySelector?.(`[data-clash-fighter="${side}"]`);
      const fighterArt = fighter?.querySelector?.('.olings-clash-fighter__art');
      const rosterSlots = root?.querySelectorAll?.(
        `[data-clash-roster="${side}"] [data-clash-roster-slot]`
      );
      const selectedRosterSlot = [...(rosterSlots || [])].find(
        (slot) =>
          slot.dataset.teamSlot === String(selectedSlot) ||
          slot.querySelector?.('[data-team-slot]')?.dataset.teamSlot ===
            String(selectedSlot)
      );
      const rosterIcon = (
        selectedRosterSlot || rosterSlots?.[Number(selectedSlot)]
      )?.querySelector?.('.olings-clash-roster-slot__icon');
      const roster = selectedRosterSlot?.closest?.('[data-clash-roster]');
      const activeRosterSlot = roster?.querySelector?.(
        '[data-clash-roster-slot="active"]'
      );
      if (
        !surface ||
        !fighterArt ||
        !rosterIcon ||
        !roster ||
        !activeRosterSlot
      ) {
        return null;
      }

      const surfaceRect = surface.getBoundingClientRect();
      const fighterRect = getRelativeRect(fighterArt, surfaceRect);
      if (!fighterRect) return null;
      const outgoingSource = forced
        ? fighter.querySelector('.olings-clash-fighter__motion') || fighterArt
        : fighterArt;
      const outgoingStartRect =
        getRelativeRect(outgoingSource, surfaceRect) || fighterRect;
      const outgoingEndRect = getOffscreenRect(
        outgoingStartRect,
        surfaceRect,
        side,
        0.86
      );
      const incomingStartRect = getOffscreenRect(
        fighterRect,
        surfaceRect,
        side,
        0.9
      );
      const fighterCenterX = fighterRect.left + fighterRect.width / 2;
      const fighterCenterY = fighterRect.top + fighterRect.height / 2;
      const incomingCenterX =
        incomingStartRect.left + incomingStartRect.width / 2;
      const incomingCenterY =
        incomingStartRect.top + incomingStartRect.height / 2;
      const incomingStartScale = Math.max(
        0.05,
        incomingStartRect.width / fighterRect.width
      );
      const documentRef = surface.ownerDocument || globalScope.document;
      const stage = stagePool.pop() || documentRef.createElement('div');
      stage.className = 'olings-clash-tag-motion';
      stage.dataset.tagSide = side;
      stage.dataset.tagForced = String(Boolean(forced));
      stage.setAttribute('aria-hidden', 'true');

      const reusableGhost = ghostPool.pop() || null;
      const outgoing = createGhost(
        documentRef,
        outgoingSource,
        outgoingStartRect,
        outgoingEndRect,
        'outgoing',
        side,
        forced,
        reusableGhost
      );
      if (!outgoing) {
        if (reusableGhost && ghostPool.length < 2) {
          ghostPool.push(reusableGhost);
        }
        stage.replaceChildren();
        if (stagePool.length < 2) stagePool.push(stage);
        return null;
      }
      stage.append(outgoing);
      surface.append(stage);

      fighterArt.style.setProperty(
        '--clash-tag-incoming-start-x',
        `${incomingCenterX - fighterCenterX}px`
      );
      fighterArt.style.setProperty(
        '--clash-tag-incoming-start-y',
        `${incomingCenterY - fighterCenterY}px`
      );
      fighterArt.style.setProperty(
        '--clash-tag-incoming-start-scale',
        String(incomingStartScale)
      );
      fighterArt.style.setProperty(
        '--clash-tag-incoming-early-scale',
        String(incomingStartScale * 1.04)
      );
      fighterArt.style.setProperty(
        '--clash-tag-incoming-over-x',
        `${side === 'local' ? 12 : -12}px`
      );
      fighterArt.style.setProperty('--clash-tag-incoming-over-y', '-10px');

      const entry = {
        fighter,
        fighterArt,
        forced: Boolean(forced),
        incoming: fighterArt,
        incomingRosterCard: selectedRosterSlot,
        outgoing,
        outgoingRosterCard: activeRosterSlot,
        roster,
        rosterIcon,
        side,
        stage,
        surface,
        timer: undefined
      };
      prepared.set(root, entry);
      return entry;
    }

    function play(root, { durationMs = 1400 } = {}) {
      const entry = prepared.get(root);
      if (!entry) return null;
      const duration = Math.max(400, Number(durationMs) || 1400);
      entry.stage.style.setProperty('--clash-tag-duration', `${duration}ms`);
      entry.fighter.style.setProperty('--clash-tag-duration', `${duration}ms`);
      entry.stage.classList.toggle('is-forced', entry.forced);
      entry.stage.classList.remove('is-exiting');
      entry.stage.classList.add('is-playing');
      entry.fighterArt.classList.remove('is-tag-motion-hidden');
      entry.fighterArt.classList.add('is-tag-incoming');
      entry.fighter.classList.add('is-tag-transitioning');
      if (entry.exitStarted) {
        [entry.incomingRosterCard, entry.outgoingRosterCard].forEach((card) => {
          card?.style.setProperty(
            '--clash-roster-tag-duration',
            `${duration}ms`
          );
          card?.classList.remove('is-roster-tag-sliding-out');
          card?.classList.add('is-roster-tag-sliding-in');
        });
      }
      watchForCollision(root, entry, duration);
      entry.timer = schedule(() => clear(root), duration);
      return { durationMs: duration, forced: entry.forced, side: entry.side };
    }

    return {
      clear,
      exit,
      getPoolStats: () => ({
        ghosts: ghostPool.length,
        stages: stagePool.length
      }),
      play,
      prepare
    };
  }

  globalScope.createOlingClashTagMotion = createOlingClashTagMotion;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = createOlingClashTagMotion;
  }
})(typeof window !== 'undefined' ? window : globalThis);
