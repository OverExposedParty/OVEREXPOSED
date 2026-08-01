(function () {
  function createRoamingController({
    state,
    elements,
    helpers,
    callbacks,
    constants
  }) {
    const flightMotion = window.OlingFlightMotion;
    const restVisuals = window.OlingLabRestVisuals?.create(
      constants.restVisuals
    );
    const {
      rows,
      minYRatio,
      maxYRatio,
      minSpeed,
      maxSpeed
    } = constants;
    const {
      createOlingPreview,
      isTargetSelected,
      toggleSelectedTarget
    } = helpers;
    let lastRoomMetrics = null;

    function getOlingId(oling) {
      return String(oling?.id || oling?._id || '');
    }

    function getRoomMetrics() {
      const configuredCell = Number.parseFloat(
        getComputedStyle(elements.room).getPropertyValue('--oling-lab-cell')
      );
      const fallbackCell = Number(elements.room?.clientHeight || 0) / rows;
      const cell =
        Number.isFinite(configuredCell) && configuredCell > 0
          ? configuredCell
          : fallbackCell;
      const unlockedWidth = Math.max(
        cell,
        (Number(state.lab?.columns) || 1) * cell
      );
      const roomHeight = Math.max(
        cell * rows,
        Number(elements.room?.clientHeight || 0)
      );
      const size = Math.max(72, cell * 0.34);

      return {
        cell,
        width: unlockedWidth,
        height: roomHeight,
        size,
        minX: size * 0.15,
        maxX: Math.max(size * 0.15, unlockedWidth - size * 1.15),
        minY: roomHeight * minYRatio,
        maxY: Math.max(roomHeight * minYRatio, roomHeight * maxYRatio - size)
      };
    }

    function syncRoamStatesToRoomMetrics() {
      const metrics = getRoomMetrics();
      if (!lastRoomMetrics || !lastRoomMetrics.cell || !metrics.cell) {
        lastRoomMetrics = metrics;
        return metrics;
      }

      const ratio = metrics.cell / lastRoomMetrics.cell;
      if (Number.isFinite(ratio) && ratio > 0 && Math.abs(ratio - 1) > 0.001) {
        state.olingRoam.forEach((roamState) => {
          roamState.x *= ratio;
          roamState.y *= ratio;
          roamState.vx *= ratio;
          roamState.vy *= ratio;
        });
      }

      lastRoomMetrics = metrics;
      return metrics;
    }

    function getSeededRatio(value, salt) {
      const source = `${value || 'oling'}:${salt}`;
      let hash = 0;
      for (let index = 0; index < source.length; index += 1) {
        hash = (hash * 31 + source.charCodeAt(index)) >>> 0;
      }
      return (hash % 1000) / 1000;
    }
    const roamingTargets = window.createOlingLabRoamingTargets({
      state,
      constants,
      getRoomMetrics,
      getSeededRatio,
      getOlingId
    });
    const {
      cancelAdventureDeparture,
      cancelAdventureJourney,
      cancelBedJourney,
      getBedTarget,
      getDoorTarget,
      isHeadingToAdventure,
      isHeadingToBed,
      returnFromAdventure,
      sendToAdventure,
      sendToBed
    } = roamingTargets;

    function createRoamState(oling) {
      const id = getOlingId(oling);
      const bounds = getRoomMetrics();
      const xRatio = getSeededRatio(id, 'x');
      const yRatio = getSeededRatio(id, 'y');
      const angle = getSeededRatio(id, 'angle') * Math.PI * 2;
      const speed = minSpeed + getSeededRatio(id, 'speed') * (maxSpeed - minSpeed);

      return {
        x: bounds.minX + (bounds.maxX - bounds.minX) * xRatio,
        y: bounds.minY + (bounds.maxY - bounds.minY) * yRatio,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed * 0.72,
        bedJourney: null,
        adventureJourney: null,
        adventurePending: false,
        wasSleeping: Boolean(oling?.care?.isSleeping),
        element: null,
        size: bounds.size
      };
    }

    function ensureRoamStates() {
      const activeIds = new Set(state.olings.map(getOlingId).filter(Boolean));

      [...state.olingRoam.keys()].forEach((id) => {
        if (!activeIds.has(id)) {
          restVisuals?.stop(state.olingRoam.get(id)?.element);
          state.olingRoam.delete(id);
        }
      });

      state.olings.forEach((oling) => {
        const id = getOlingId(oling);
        if (!id || state.olingRoam.has(id)) return;
        state.olingRoam.set(id, createRoamState(oling));
      });
    }

    function clampRoamState(roamState) {
      const bounds = getRoomMetrics();
      roamState.size = bounds.size;
      roamState.x = Math.min(Math.max(roamState.x, bounds.minX), bounds.maxX);
      roamState.y = Math.min(Math.max(roamState.y, bounds.minY), bounds.maxY);
    }

    function applyTransform(oling, roamState) {
      const element = roamState?.element;
      if (!element) return;
      const isSelected = isTargetSelected('oling', getOlingId(oling));
      const selectedFurnitureId =
        state.selectedTarget?.type === 'furniture'
          ? String(state.selectedTarget.id || '')
          : '';
      const isAttachedToSelectedFurniture = Boolean(
        selectedFurnitureId &&
        (
          String(oling?.care?.sleepBedPlacedId || '') === selectedFurnitureId ||
          String(roamState.bedJourney?.placedId || '') === selectedFurnitureId ||
          String(roamState.adventureJourney?.placedId || '') === selectedFurnitureId
        )
      );
      const speed = Math.hypot(roamState.vx || 0, roamState.vy || 0);
      const speedRatio = Math.min(
        1,
        Math.max(0, (speed - minSpeed) / (maxSpeed - minSpeed))
      );
      const flapDuration = (1.15 - speedRatio * 0.45) / 18;
      const flightTrait = oling?.traits?.flight;
      const configuredMotion = flightMotion?.resolveMotion(flightTrait);
      const isSleeping = Boolean(oling?.care?.isSleeping);

      element.style.setProperty('--oling-x', `${roamState.x}px`);
      element.style.setProperty('--oling-y', `${roamState.y}px`);
      element.style.setProperty('--oling-size', `${roamState.size}px`);
      if (configuredMotion === 'flutter') {
        flightMotion?.setMotionDuration(element, flapDuration);
      }
      flightMotion?.setPaused(element, isSelected || isSleeping);
      element.classList.toggle('is-selected', isSelected);
      element.classList.toggle(
        'is-attached-to-selected-furniture',
        isAttachedToSelectedFurniture
      );
      element.classList.toggle('is-coming-to-bed', Boolean(roamState.bedJourney));
      element.classList.toggle('is-sleeping', isSleeping);
      restVisuals?.sync(element, isSleeping);
    }

    function createRoamer(oling) {
      const id = getOlingId(oling);
      const roamState = state.olingRoam.get(id) || createRoamState(oling);
      state.olingRoam.set(id, roamState);

      const roamer = document.createElement('button');
      roamer.className = 'oling-lab-roamer';
      roamer.type = 'button';
      roamer.setAttribute(
        'aria-label',
        `Open ${oling?.name || oling?.personality?.name || 'Oling'} actions`
      );
      roamer.setAttribute('aria-expanded', String(isTargetSelected('oling', id)));
      roamer.dataset.olingId = id;

      const sprite = createOlingPreview(oling);
      sprite.classList.add('is-roaming');
      roamer.appendChild(sprite);
      flightMotion?.configure(roamer, oling?.traits?.flight);
      roamer.addEventListener('click', (event) => {
        event.stopPropagation();
        toggleSelectedTarget('oling', id);
      });

      if (roamState.element && roamState.element !== roamer) {
        restVisuals?.stop(roamState.element);
      }
      roamState.element = roamer;
      clampRoamState(roamState);
      applyTransform(oling, roamState);

      return roamer;
    }

    function renderOlings() {
      ensureRoamStates();
      syncRoamStatesToRoomMetrics();

      const fragment = document.createDocumentFragment();
      state.olings.forEach((oling) => {
        const id = getOlingId(oling);
        if (!id) return;
        const roamState = state.olingRoam.get(id);
        if (
          String(state.activeAdventure?.olingId || '') === id ||
          roamState?.adventurePending
        ) {
          restVisuals?.stop(roamState?.element);
          return;
        }
        fragment.appendChild(createRoamer(oling));
      });

      return fragment;
    }

    function update(timestamp) {
      if (!state.lab) {
        state.roamAnimationFrame = window.requestAnimationFrame(update);
        return;
      }

      const lastFrameAt = state.lastRoamFrameAt || timestamp;
      const deltaSeconds = Math.min(
        0.05,
        Math.max(0, (timestamp - lastFrameAt) / 1000)
      );
      state.lastRoamFrameAt = timestamp;
      const bounds = syncRoamStatesToRoomMetrics();

      state.olings.forEach((oling) => {
        const id = getOlingId(oling);
        const roamState = state.olingRoam.get(id);
        if (!roamState) return;

        if (String(state.activeAdventure?.olingId || '') === id || roamState.adventurePending) {
          if (roamState.element) roamState.element.hidden = true;
          return;
        }
        if (roamState.element) roamState.element.hidden = false;

        const sleepingBedTarget = oling?.care?.isSleeping
          ? getBedTarget(oling.care.sleepBedPlacedId, oling.care.sleepBedSlotId, bounds, id)
          : null;
        if (sleepingBedTarget) {
          roamState.bedJourney = null;
          roamState.x = sleepingBedTarget.x;
          roamState.y = sleepingBedTarget.y;
          roamState.vx = 0;
          roamState.vy = 0;
          roamState.wasSleeping = true;
        } else if (roamState.bedJourney) {
          const target = getBedTarget(
            roamState.bedJourney.placedId,
            roamState.bedJourney.sleepSlotId,
            bounds,
            id
          );
          if (!target) {
            cancelBedJourney(id);
          } else if (roamState.bedJourney.phase === 'travelling') {
            const deltaX = target.x - roamState.x;
            const deltaY = target.y - roamState.y;
            const distance = Math.hypot(deltaX, deltaY);
            const travelSpeed = Math.max(maxSpeed * 5, bounds.cell * 0.65);
            const step = Math.min(distance, travelSpeed * deltaSeconds);
            if (distance > 0) {
              roamState.vx = (deltaX / distance) * travelSpeed;
              roamState.vy = (deltaY / distance) * travelSpeed;
              roamState.x += (deltaX / distance) * step;
              roamState.y += (deltaY / distance) * step;
            }
            if (distance <= 4 || step >= distance) {
              roamState.x = target.x;
              roamState.y = target.y;
              roamState.vx = 0;
              roamState.vy = 0;
              roamState.bedJourney.phase = 'arrived';
              callbacks.onBedArrival?.(id, roamState.bedJourney.placedId);
            }
          }
        } else if (roamState.adventureJourney) {
          const target = getDoorTarget(roamState.adventureJourney.placedId, bounds, id);
          if (!target) {
            cancelAdventureJourney(id);
          } else {
            const deltaX = target.x - roamState.x;
            const deltaY = target.y - roamState.y;
            const distance = Math.hypot(deltaX, deltaY);
            const travelSpeed = Math.max(maxSpeed * 5, bounds.cell * 0.65);
            const step = Math.min(distance, travelSpeed * deltaSeconds);
            if (distance > 0) {
              roamState.vx = (deltaX / distance) * travelSpeed;
              roamState.vy = (deltaY / distance) * travelSpeed;
              roamState.x += (deltaX / distance) * step;
              roamState.y += (deltaY / distance) * step;
            }
            if (distance <= 4 || step >= distance) {
              roamState.adventurePending = true;
              callbacks.onAdventureDeparture?.(id, roamState.adventureJourney);
              roamState.adventureJourney = null;
            }
          }
        } else {
          if (roamState.wasSleeping) {
            const wakeAngle = getSeededRatio(id, 'wake-angle') * Math.PI * 2;
            const wakeSpeed = minSpeed +
              getSeededRatio(id, 'wake-speed') * (maxSpeed - minSpeed);
            roamState.vx = Math.cos(wakeAngle) * wakeSpeed;
            roamState.vy = Math.sin(wakeAngle) * wakeSpeed * 0.72;
            roamState.wasSleeping = false;
          }
          if (!isTargetSelected('oling', id)) {
          roamState.x += roamState.vx * deltaSeconds;
          roamState.y += roamState.vy * deltaSeconds;

          if (roamState.x <= bounds.minX || roamState.x >= bounds.maxX) {
            roamState.vx *= -1;
            roamState.x = Math.min(Math.max(roamState.x, bounds.minX), bounds.maxX);
          }

          if (roamState.y <= bounds.minY || roamState.y >= bounds.maxY) {
            roamState.vy *= -1;
            roamState.y = Math.min(Math.max(roamState.y, bounds.minY), bounds.maxY);
          }
          }
        }

        roamState.size = bounds.size;
        applyTransform(oling, roamState);
      });

      callbacks.updateSelectedOlingPanel();
      state.roamAnimationFrame = window.requestAnimationFrame(update);
    }

    function start() {
      if (state.roamAnimationFrame) return;
      state.lastRoamFrameAt = null;
      state.roamAnimationFrame = window.requestAnimationFrame(update);
    }

    function getRoamState(olingId) {
      return state.olingRoam.get(olingId) || null;
    }

    return {
      cancelBedJourney,
      cancelAdventureDeparture,
      cancelAdventureJourney,
      ensureRoamStates,
      getOlingId,
      getRoamState,
      isHeadingToBed,
      isHeadingToAdventure,
      renderOlings,
      sendToBed,
      sendToAdventure,
      returnFromAdventure,
      syncRoamStatesToRoomMetrics,
      start
    };
  }

  window.OlingLabRoaming = {
    create: createRoamingController
  };
})();
