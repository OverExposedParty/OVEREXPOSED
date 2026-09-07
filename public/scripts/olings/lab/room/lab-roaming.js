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
      maxSpeed,
      dragHoldDelayMs = 220,
      carryFollowLagMs = 80,
      releaseGlide = {}
    } = constants;
    const releaseGlideConfig = {
      sampleWindowMs: 110,
      velocityScale: 0.82,
      minSpeed: 45,
      maxSpeed: 900,
      decelerationMs: 260,
      edgeBounce: 0.35,
      edgeTangentialDamping: 0.9,
      edgeImpactSoundThresholdRatio: 0.25,
      maxBounces: 2,
      ...releaseGlide
    };
    const {
      createOlingPreview,
      closeSelectedTarget,
      isTargetSelected,
      openOlingMenu,
      resolveMenuConfig = () => ({}),
      canUseLabInteraction = () => true,
      shouldRenderOlings = () => true
    } = helpers;
    let lastRoomMetrics = null;
    const playSound = (key) => {
      if (!key || typeof window.playSoundEffect !== 'function') return;
      Promise.resolve(window.playSoundEffect(key)).catch(() => {});
    };

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
        minX: 0,
        maxX: Math.max(0, unlockedWidth - size),
        minY: 0,
        maxY: Math.max(0, roomHeight - size),
        spawnMinX: size * 0.15,
        spawnMaxX: Math.max(size * 0.15, unlockedWidth - size * 1.15),
        spawnMinY: roomHeight * minYRatio,
        spawnMaxY: Math.max(
          roomHeight * minYRatio,
          roomHeight * maxYRatio - size
        )
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
          if (roamState.carry) {
            roamState.carry.targetCenterX *= ratio;
            roamState.carry.targetCenterY *= ratio;
          }
          if (roamState.releaseGlide) {
            roamState.releaseGlide.resumeVx *= ratio;
            roamState.releaseGlide.resumeVy *= ratio;
          }
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
      getBedDropTarget,
      getBedTarget,
      getDoorTarget,
      getFurnitureDragInteractionTarget,
      isHeadingToAdventure,
      isHeadingToBed,
      isPointOverBed,
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
      const speed =
        minSpeed + getSeededRatio(id, 'speed') * (maxSpeed - minSpeed);

      return {
        x: bounds.spawnMinX + (bounds.spawnMaxX - bounds.spawnMinX) * xRatio,
        y: bounds.spawnMinY + (bounds.spawnMaxY - bounds.spawnMinY) * yRatio,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed * 0.72,
        bedJourney: null,
        restReturn: null,
        adventureJourney: null,
        adventurePending: false,
        wasSleeping: Boolean(oling?.care?.isSleeping),
        activity: oling?.care?.isSleeping ? 'sleeping' : 'idle',
        carry: null,
        releaseGlide: null,
        podCaptureHover: false,
        motionBlend: oling?.care?.isSleeping ? 0 : 1,
        suppressClick: false,
        element: null,
        size: bounds.size
      };
    }

    const isActiveOling = (oling) => oling?.residency?.state !== 'stored';

    function ensureRoamStates() {
      const activeIds = new Set(
        state.olings.filter(isActiveOling).map(getOlingId).filter(Boolean)
      );

      [...state.olingRoam.keys()].forEach((id) => {
        if (!activeIds.has(id)) {
          restVisuals?.stop(state.olingRoam.get(id)?.element);
          state.olingRoam.delete(id);
        }
      });

      state.olings.forEach((oling) => {
        if (!isActiveOling(oling)) return;
        const id = getOlingId(oling);
        if (!id || state.olingRoam.has(id)) return;
        state.olingRoam.set(id, createRoamState(oling));
      });
    }

    function clampPositionToRoom(x, y, bounds = getRoomMetrics()) {
      return {
        x: Math.min(Math.max(x, bounds.minX), bounds.maxX),
        y: Math.min(Math.max(y, bounds.minY), bounds.maxY)
      };
    }

    function clampRoamState(roamState, bounds = getRoomMetrics()) {
      roamState.size = bounds.size;
      const position = clampPositionToRoom(roamState.x, roamState.y, bounds);
      roamState.x = position.x;
      roamState.y = position.y;
    }

    function setVisualMotionPlaybackRate(element, playbackRate) {
      const rate = Math.max(0.04, Number(playbackRate) || 0.04);
      const animatedElements = [
        element?.querySelector('.oling-lab-oling-preview.is-roaming'),
        element?.querySelector('.oling-flight-motion-layer')
      ].filter(Boolean);

      animatedElements.forEach((animatedElement) => {
        const animations = animatedElement.getAnimations?.() || [];
        animations.forEach((animation) => {
          try {
            if (typeof animation.updatePlaybackRate === 'function') {
              animation.updatePlaybackRate(rate);
            } else {
              animation.playbackRate = rate;
            }
          } catch {
            // Stable CSS durations remain the fallback where WAAPI is absent.
          }
        });
      });
    }

    function getCurrentFloatOffset(roamState) {
      const element = roamState?.element;
      const preview = element?.querySelector(
        '.oling-lab-oling-preview.is-roaming'
      );
      if (!element?.getBoundingClientRect || !preview?.getBoundingClientRect) {
        return { x: 0, y: 0 };
      }

      const elementRect = element.getBoundingClientRect();
      const previewRect = preview.getBoundingClientRect();
      const elementCenterX = elementRect.left + elementRect.width / 2;
      const elementCenterY = elementRect.top + elementRect.height / 2;
      const previewCenterX = previewRect.left + previewRect.width / 2;
      const previewCenterY = previewRect.top + previewRect.height / 2;
      const offsetX = previewCenterX - elementCenterX;
      const offsetY = previewCenterY - elementCenterY;

      return {
        x: Number.isFinite(offsetX) ? offsetX : 0,
        y: Number.isFinite(offsetY) ? offsetY : 0
      };
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
        (String(oling?.care?.sleepBedPlacedId || '') === selectedFurnitureId ||
          String(roamState.bedJourney?.placedId || '') ===
            selectedFurnitureId ||
          String(roamState.restReturn?.placedId || '') ===
            selectedFurnitureId ||
          String(roamState.adventureJourney?.placedId || '') ===
            selectedFurnitureId)
      );
      const speed = Math.hypot(roamState.vx || 0, roamState.vy || 0);
      const speedRatio = Math.min(
        1,
        Math.max(0, (speed - minSpeed) / (maxSpeed - minSpeed))
      );
      const flapDuration = (1.15 - speedRatio * 0.45) / 18;
      const flightTrait = oling?.traits?.flight;
      const configuredMotion = flightMotion?.resolveMotion(flightTrait);
      const isSleeping = Boolean(
        oling?.care?.isSleeping &&
        !roamState.carry?.wakeRequested &&
        !roamState.releaseGlide &&
        roamState.activity !== 'returning-to-sleep' &&
        !String(roamState.activity || '').startsWith('waking-')
      );
      const isCarried = roamState.activity === 'carried';
      const isReleaseGliding = Boolean(roamState.releaseGlide);
      const isPodCaptureHover = Boolean(roamState.podCaptureHover);
      const motionBlend = Math.min(
        1,
        Math.max(0, Number(roamState.motionBlend ?? 1))
      );
      const visualMotionRate = isSleeping && !isCarried ? 1 : motionBlend;
      const carryMotionPaused = isCarried && motionBlend <= 0.04;

      element.style.setProperty('--oling-x', `${roamState.x}px`);
      element.style.setProperty('--oling-y', `${roamState.y}px`);
      element.style.setProperty('--oling-size', `${roamState.size}px`);
      if (configuredMotion === 'flutter') {
        flightMotion?.setMotionDuration(element, flapDuration);
      }
      setVisualMotionPlaybackRate(element, visualMotionRate);
      flightMotion?.setPaused(
        element,
        isSleeping || isSelected || carryMotionPaused
      );
      element.classList.toggle('is-selected', isSelected);
      element.classList.toggle('is-carried', isCarried);
      element.classList.toggle('is-gliding', isReleaseGliding);
      element.classList.toggle('is-pod-hover-target', isPodCaptureHover);
      element.classList.toggle(
        'is-attached-to-selected-furniture',
        isAttachedToSelectedFurniture
      );
      element.classList.toggle(
        'is-coming-to-bed',
        Boolean(roamState.bedJourney || roamState.restReturn)
      );
      element.classList.toggle('is-sleeping', isSleeping);
      element.dataset.olingActivity = isCarried
        ? 'carried'
        : isReleaseGliding
          ? 'gliding'
          : roamState.activity === 'pod-capture-pending'
            ? 'pod-capture-pending'
            : isSleeping
              ? 'sleeping'
              : 'idle';
      restVisuals?.sync(element, isSleeping);
    }

    function getPointerRoomPosition(event) {
      const roomRect = elements.room.getBoundingClientRect();
      return {
        x: event.clientX - roomRect.left,
        y: event.clientY - roomRect.top
      };
    }

    function recordCarryPointerSamples(carry, event) {
      if (!carry) return;
      const coalescedEvents =
        typeof event.getCoalescedEvents === 'function'
          ? event.getCoalescedEvents()
          : [];
      const pointerEvents = coalescedEvents.length ? coalescedEvents : [event];
      const sampleWindowMs = Math.max(
        16,
        Number(releaseGlideConfig.sampleWindowMs) || 110
      );

      pointerEvents.forEach((pointerEvent) => {
        const at = Number(pointerEvent.timeStamp);
        if (!Number.isFinite(at)) return;
        const pointer = getPointerRoomPosition(pointerEvent);
        const previousSample = carry.pointerSamples.at(-1);
        const sample = { x: pointer.x, y: pointer.y, at };
        if (previousSample && at <= previousSample.at) {
          if (at === previousSample.at) {
            carry.pointerSamples[carry.pointerSamples.length - 1] = sample;
          }
          return;
        }
        carry.pointerSamples.push(sample);
        const cutoff = at - sampleWindowMs;
        while (
          carry.pointerSamples.length > 2 &&
          carry.pointerSamples[1].at < cutoff
        ) {
          carry.pointerSamples.shift();
        }
      });
    }

    function getCarryReleaseVelocity(carry, event) {
      if (
        !carry?.active ||
        window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches
      ) {
        return null;
      }
      recordCarryPointerSamples(carry, event);
      const samples = carry.pointerSamples;
      const lastSample = samples.at(-1);
      if (!lastSample) return null;
      const sampleWindowMs = Math.max(
        16,
        Number(releaseGlideConfig.sampleWindowMs) || 110
      );
      const cutoff = lastSample.at - sampleWindowMs;
      const recentSamples = samples.filter((sample) => sample.at >= cutoff);
      const firstSample =
        recentSamples.length > 1
          ? recentSamples[0]
          : samples[samples.length - 2];
      const elapsedMs = lastSample.at - Number(firstSample?.at);
      if (!firstSample || !Number.isFinite(elapsedMs) || elapsedMs < 16) {
        return null;
      }

      const velocityScale = Math.max(
        0,
        Number(releaseGlideConfig.velocityScale) || 0
      );
      let vx = ((lastSample.x - firstSample.x) / elapsedMs) * 1000;
      let vy = ((lastSample.y - firstSample.y) / elapsedMs) * 1000;
      vx *= velocityScale;
      vy *= velocityScale;
      const speed = Math.hypot(vx, vy);
      const minimumSpeed = Math.max(
        0,
        Number(releaseGlideConfig.minSpeed) || 0
      );
      if (!Number.isFinite(speed) || speed < minimumSpeed) return null;
      const maximumSpeed = Math.max(
        minimumSpeed,
        Number(releaseGlideConfig.maxSpeed) || 900
      );
      if (speed > maximumSpeed) {
        const scale = maximumSpeed / speed;
        vx *= scale;
        vy *= scale;
      }
      return { vx, vy };
    }

    function startReleaseGlide(roamState, carry, velocity) {
      if (!velocity) return false;
      roamState.releaseGlide = {
        resumeVx: carry.previousVx,
        resumeVy: carry.previousVy,
        wakePending: Boolean(carry.wakePromise),
        bounces: 0
      };
      roamState.vx = velocity.vx;
      roamState.vy = velocity.vy;
      roamState.activity = 'release-glide';
      return true;
    }

    function finishReleaseGlide(roamState) {
      const glide = roamState.releaseGlide;
      if (!glide) return;
      roamState.vx = Number.isFinite(glide.resumeVx)
        ? glide.resumeVx
        : minSpeed;
      roamState.vy = Number.isFinite(glide.resumeVy) ? glide.resumeVy : 0;
      roamState.releaseGlide = null;
      roamState.activity = glide.wakePending ? 'waking-from-carry' : 'idle';
    }

    function advanceReleaseGlide(roamState, bounds, deltaSeconds) {
      const glide = roamState.releaseGlide;
      if (!glide) return;
      roamState.x += roamState.vx * deltaSeconds;
      roamState.y += roamState.vy * deltaSeconds;

      const hitX = roamState.x < bounds.minX || roamState.x > bounds.maxX;
      const hitY = roamState.y < bounds.minY || roamState.y > bounds.maxY;
      if (hitX || hitY) {
        const impactSpeed = Math.max(
          hitX ? Math.abs(roamState.vx) : 0,
          hitY ? Math.abs(roamState.vy) : 0
        );
        const canBounce =
          glide.bounces <
          Math.max(0, Number(releaseGlideConfig.maxBounces) || 0);
        const bounce = canBounce
          ? Math.min(1, Math.max(0, Number(releaseGlideConfig.edgeBounce) || 0))
          : 0;
        const tangentialDamping = Math.min(
          1,
          Math.max(0, Number(releaseGlideConfig.edgeTangentialDamping) || 0)
        );
        const impactSoundThreshold =
          Math.max(
            0,
            Number(releaseGlideConfig.edgeImpactSoundThresholdRatio) || 0
          ) * Math.max(0, Number(maxSpeed) || 0);
        if (canBounce && impactSpeed >= impactSoundThreshold) {
          playSound('olingLabRoamingEdgeHit');
        }
        if (hitX) {
          roamState.x = Math.min(
            Math.max(roamState.x, bounds.minX),
            bounds.maxX
          );
          roamState.vx *= -bounce;
          if (!hitY) roamState.vy *= tangentialDamping;
        }
        if (hitY) {
          roamState.y = Math.min(
            Math.max(roamState.y, bounds.minY),
            bounds.maxY
          );
          roamState.vy *= -bounce;
          if (!hitX) roamState.vx *= tangentialDamping;
        }
        glide.bounces += 1;
      }

      const decelerationSeconds =
        Math.max(16, Number(releaseGlideConfig.decelerationMs) || 260) / 1000;
      const decay = Math.exp(-deltaSeconds / decelerationSeconds);
      roamState.vx *= decay;
      roamState.vy *= decay;
      if (
        Math.hypot(roamState.vx, roamState.vy) <
        Math.max(0, Number(releaseGlideConfig.minSpeed) || 0)
      ) {
        finishReleaseGlide(roamState);
      }
    }

    function canCarryOling(id, roamState) {
      const activity = String(roamState?.activity || 'idle');
      return Boolean(
        id &&
        canUseLabInteraction('olingDragging') &&
        roamState &&
        (activity === 'idle' || activity === 'sleeping') &&
        !roamState.podCaptureHover &&
        !state.editMode &&
        String(state.activeAdventure?.olingId || '') !== id &&
        !roamState.adventurePending &&
        !roamState.adventureJourney &&
        !roamState.bedJourney
      );
    }

    function requestCarryWake(oling, roamState, carry) {
      if (carry.wakeRequested || !oling?.care?.isSleeping) return;
      carry.wakeRequested = true;
      carry.wakePromise = Promise.resolve(
        callbacks.onCarryWake?.(getOlingId(oling), carry.sleepBedPlacedId) ??
          true
      ).then((didWake) => {
        carry.wakeFailed = didWake === false;
        if (didWake === false && roamState.activity === 'waking-from-carry') {
          roamState.activity = 'sleeping';
        }
        return didWake !== false;
      });
    }

    function settleCarriedOlingOnBed(oling, roamState, carry, dropTarget) {
      roamState.vx = 0;
      roamState.vy = 0;
      const beginBedJourney = (canSleep) => {
        if (!canSleep) {
          roamState.bedJourney = null;
          roamState.activity = 'sleeping';
          return;
        }
        roamState.activity = 'idle';
        roamState.bedJourney = {
          placedId: dropTarget.placedId,
          sleepSlotId: dropTarget.sleepSlotId,
          phase: 'travelling',
          previousVx: carry.previousVx,
          previousVy: carry.previousVy
        };
      };

      if (carry.wakePromise) {
        roamState.activity = 'waking-to-bed';
        carry.wakePromise.then(beginBedJourney);
      } else {
        beginBedJourney(true);
      }
      applyTransform(oling, roamState);
    }

    function getCarryPointerTarget(carry, roamState, bounds) {
      return clampPositionToRoom(
        carry.targetCenterX - roamState.size / 2,
        carry.targetCenterY - roamState.size / 2,
        bounds
      );
    }

    function syncCarryDragInteraction(oling, roamState, bounds) {
      const carry = roamState.carry;
      if (!carry?.active) return null;
      carry.dragInteraction = getFurnitureDragInteractionTarget(
        {
          draggableType: 'oling',
          draggableId: getOlingId(oling),
          action: 'rest',
          x: carry.targetCenterX - roamState.size / 2,
          y: carry.targetCenterY - roamState.size / 2,
          width: roamState.size,
          height: roamState.size
        },
        bounds
      );
      return carry.dragInteraction;
    }

    function finishCarry(oling, roamState, event, { cancelled = false } = {}) {
      const carry = roamState.carry;
      if (!carry || event.pointerId !== carry.pointerId) return;
      window.clearTimeout?.(carry.holdTimer);
      if (roamState.element?.hasPointerCapture?.(event.pointerId)) {
        roamState.element.releasePointerCapture(event.pointerId);
      }
      if (!carry.active) {
        roamState.carry = null;
        return;
      }
      roamState.suppressClick = true;
      const storageDropTarget = cancelled
        ? null
        : callbacks.getOlingStorageDropTarget?.(oling, event) || null;
      callbacks.onOlingDragEnd?.(oling);
      roamState.carry = null;
      const bounds = getRoomMetrics();
      const dropTarget = cancelled
        ? null
        : carry.dragInteraction?.action === 'rest'
          ? carry.dragInteraction
          : getBedDropTarget(
              roamState.x + roamState.size / 2,
              roamState.y + roamState.size / 2,
              getOlingId(oling),
              bounds
            );
      const remainedAsleep =
        carry.wasSleeping && !carry.wakeRequested && oling?.care?.isSleeping;
      const releaseVelocity =
        !cancelled && !dropTarget && !remainedAsleep
          ? getCarryReleaseVelocity(carry, event)
          : null;

      if (!cancelled && !storageDropTarget) playSound('uiDragPlace');

      if (storageDropTarget) {
        roamState.releaseGlide = null;
        roamState.activity = 'pod-capture-pending';
        applyTransform(oling, roamState);
        Promise.resolve(
          callbacks.onOlingStorageDrop?.(oling, storageDropTarget)
        )
          .then((captured) => {
            if (captured === false && state.olingRoam.has(getOlingId(oling))) {
              roamState.activity = 'idle';
              applyTransform(oling, roamState);
            }
          })
          .catch(() => {
            if (!state.olingRoam.has(getOlingId(oling))) return;
            roamState.activity = 'idle';
            applyTransform(oling, roamState);
          });
      } else if (remainedAsleep) {
        roamState.activity = 'returning-to-sleep';
        roamState.restReturn = {
          placedId: carry.sleepBedPlacedId,
          sleepSlotId: oling?.care?.sleepBedSlotId || null
        };
        applyTransform(oling, roamState);
      } else if (dropTarget) {
        settleCarriedOlingOnBed(oling, roamState, carry, dropTarget);
      } else {
        const isGliding = startReleaseGlide(roamState, carry, releaseVelocity);
        if (!isGliding) {
          roamState.activity = carry.wakePromise ? 'waking-from-carry' : 'idle';
        }
        applyTransform(oling, roamState);
        carry.wakePromise?.then((didWake) => {
          const glide = roamState.releaseGlide;
          if (glide) {
            glide.wakePending = false;
            if (!didWake) {
              finishReleaseGlide(roamState);
              roamState.activity = 'sleeping';
            }
          } else if (roamState.activity === 'waking-from-carry') {
            roamState.activity = didWake ? 'idle' : 'sleeping';
          }
        });
      }
      event.preventDefault();
      event.stopPropagation();
    }

    function attachCarryInteraction(roamer, oling, roamState) {
      const id = getOlingId(oling);
      roamer.addEventListener('dragstart', (event) => event.preventDefault());
      roamer.addEventListener('pointerdown', (event) => {
        if (
          !event.isPrimary ||
          (event.pointerType === 'mouse' && event.button !== 0) ||
          !canCarryOling(id, roamState)
        ) {
          return;
        }
        const delay = Number.isFinite(Number(dragHoldDelayMs))
          ? Math.max(0, Number(dragHoldDelayMs))
          : 220;
        const carry = {
          pointerId: event.pointerId,
          startClientX: event.clientX,
          startClientY: event.clientY,
          targetCenterX: roamState.x + roamState.size / 2,
          targetCenterY: roamState.y + roamState.size / 2,
          lastFollowFrameAt: null,
          pointerSamples: [],
          pointerDistance: 0,
          previousVx: roamState.vx,
          previousVy: roamState.vy,
          wasSleeping: Boolean(oling?.care?.isSleeping),
          sleepBedPlacedId: oling?.care?.sleepBedPlacedId || null,
          active: false,
          wakeRequested: false,
          wakeFailed: false,
          wakePromise: null,
          dragInteraction: null,
          holdElapsed: delay === 0,
          holdTimer: null
        };
        roamState.carry = carry;
        if (!carry.holdElapsed && typeof window.setTimeout === 'function') {
          carry.holdTimer = window.setTimeout(() => {
            if (roamState.carry === carry) carry.holdElapsed = true;
          }, delay);
        } else {
          carry.holdElapsed = true;
        }
        recordCarryPointerSamples(carry, event);
        roamer.setPointerCapture?.(event.pointerId);
        event.stopPropagation();
      });
      roamer.addEventListener('pointermove', (event) => {
        const carry = roamState.carry;
        if (!carry || event.pointerId !== carry.pointerId) return;
        recordCarryPointerSamples(carry, event);
        const distance = Math.hypot(
          event.clientX - carry.startClientX,
          event.clientY - carry.startClientY
        );
        if (!carry.active && (!carry.holdElapsed || distance < 6)) return;
        if (!carry.active) {
          const floatOffset = getCurrentFloatOffset(roamState);
          roamState.x += floatOffset.x;
          roamState.y += floatOffset.y;
          clampRoamState(roamState);
          carry.active = true;
          roamState.activity = 'carried';
          closeSelectedTarget?.();
          playSound('olingLabRoamingPickup1');
        }

        const pointer = getPointerRoomPosition(event);
        carry.targetCenterX = pointer.x;
        carry.targetCenterY = pointer.y;
        carry.pointerDistance = distance;
        syncCarryDragInteraction(oling, roamState, getRoomMetrics());
        callbacks.onOlingDragMove?.(oling, event);
        applyTransform(oling, roamState);
        event.preventDefault();
        event.stopPropagation();
      });
      roamer.addEventListener('pointerup', (event) =>
        finishCarry(oling, roamState, event)
      );
      roamer.addEventListener('pointercancel', (event) =>
        finishCarry(oling, roamState, event, { cancelled: true })
      );
    }

    function createRoamer(oling) {
      const id = getOlingId(oling);
      const roamState = state.olingRoam.get(id) || createRoamState(oling);
      state.olingRoam.set(id, roamState);

      const roamer = document.createElement('button');
      roamer.className = 'oling-lab-roamer';
      roamer.type = 'button';
      roamer.dataset.pressFeedback = 'none';
      roamer.setAttribute('aria-label', `Inspect ${oling?.name || 'Oling'}`);
      roamer.setAttribute(
        'aria-expanded',
        String(isTargetSelected('oling', id))
      );
      roamer.dataset.olingId = id;
      const footprintTheme = resolveMenuConfig({ theme: 'oling-profile' });
      if (footprintTheme.primaryColour) {
        roamer.style.setProperty(
          '--oling-footprint-primary-colour',
          footprintTheme.primaryColour
        );
      }
      if (footprintTheme.secondaryColour) {
        roamer.style.setProperty(
          '--oling-footprint-secondary-colour',
          footprintTheme.secondaryColour
        );
      }

      const footprintLabel = document.createElement('span');
      footprintLabel.className =
        'oling-lab-furniture-footprint-label oling-lab-oling-footprint-label';
      footprintLabel.setAttribute('aria-hidden', 'true');
      footprintLabel.append(
        Object.assign(document.createElement('span'), {
          className:
            'oling-lab-furniture-footprint-type oling-lab-oling-footprint-type',
          textContent: 'Oling'
        }),
        Object.assign(document.createElement('strong'), {
          className:
            'oling-lab-furniture-footprint-name oling-lab-oling-footprint-name',
          textContent: oling?.name || 'Oling'
        })
      );
      roamer.appendChild(footprintLabel);

      const sprite = createOlingPreview(oling);
      sprite.classList.add('is-roaming');
      roamer.appendChild(sprite);
      flightMotion?.configure(roamer, oling?.traits?.flight);
      attachCarryInteraction(roamer, oling, roamState);
      roamer.addEventListener('click', (event) => {
        event.stopPropagation();
        if (!canUseLabInteraction('olingMenus')) return;
        if (roamState.suppressClick) {
          roamState.suppressClick = false;
          event.preventDefault();
          return;
        }
        openOlingMenu?.(id);
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
      if (!shouldRenderOlings()) return fragment;
      state.olings.forEach((oling) => {
        if (!isActiveOling(oling)) return;
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
      if (!shouldRenderOlings()) {
        state.lastRoamFrameAt = timestamp;
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
        if (!isActiveOling(oling)) return;
        const id = getOlingId(oling);
        const roamState = state.olingRoam.get(id);
        if (!roamState) return;

        if (
          String(state.activeAdventure?.olingId || '') === id ||
          roamState.adventurePending
        ) {
          if (roamState.element) roamState.element.hidden = true;
          return;
        }
        if (roamState.element) roamState.element.hidden = false;

        const isCarried = roamState.activity === 'carried';
        const isReleaseGliding = Boolean(roamState.releaseGlide);
        const isPodCaptureHover = Boolean(roamState.podCaptureHover);
        const isPodCapturePending =
          roamState.activity === 'pod-capture-pending';
        const isWakingFromCarry = String(roamState.activity || '').startsWith(
          'waking-'
        );
        const isSleeping = Boolean(oling?.care?.isSleeping);
        if (!Number.isFinite(roamState.motionBlend)) {
          roamState.motionBlend = isSleeping ? 0 : 1;
        }
        const targetMotionBlend =
          isCarried ||
          (isWakingFromCarry && !isReleaseGliding) ||
          (isSleeping && !isReleaseGliding)
            ? 0
            : 1;
        const blendDuration =
          targetMotionBlend > roamState.motionBlend ? 0.55 : 0.32;
        const blendStep = 1 - Math.exp(-deltaSeconds / blendDuration);
        roamState.motionBlend +=
          (targetMotionBlend - roamState.motionBlend) * blendStep;

        const sleepingBedTarget = oling?.care?.isSleeping
          ? getBedTarget(
              oling.care.sleepBedPlacedId,
              oling.care.sleepBedSlotId,
              bounds,
              id
            )
          : null;
        if (isCarried) {
          const carry = roamState.carry;
          if (carry?.active) {
            const dragInteraction = syncCarryDragInteraction(
              oling,
              roamState,
              bounds
            );
            const followDeltaSeconds =
              carry.lastFollowFrameAt === null
                ? 0
                : Math.min(
                    0.05,
                    Math.max(0, (timestamp - carry.lastFollowFrameAt) / 1000)
                  );
            carry.lastFollowFrameAt = timestamp;
            const configuredLagSeconds =
              Math.max(0, Number(carryFollowLagMs) || 0) / 1000;
            const followStep =
              configuredLagSeconds > 0
                ? 1 - Math.exp(-followDeltaSeconds / configuredLagSeconds)
                : 1;
            const target = dragInteraction?.target
              ? clampPositionToRoom(
                  dragInteraction.target.x,
                  dragInteraction.target.y,
                  bounds
                )
              : getCarryPointerTarget(carry, roamState, bounds);
            roamState.x += (target.x - roamState.x) * followStep;
            roamState.y += (target.y - roamState.y) * followStep;
            clampRoamState(roamState, bounds);
            if (
              carry.wasSleeping &&
              !carry.wakeRequested &&
              carry.pointerDistance >= Math.max(12, roamState.size * 0.2) &&
              !isPointOverBed(
                carry.sleepBedPlacedId,
                roamState.x + roamState.size / 2,
                roamState.y + roamState.size / 2,
                bounds
              )
            ) {
              requestCarryWake(oling, roamState, carry);
            }
          }
        } else if (isReleaseGliding) {
          advanceReleaseGlide(roamState, bounds, deltaSeconds);
        } else if (isWakingFromCarry) {
          // Keep the displayed release position while the wake request settles.
        } else if (isPodCaptureHover || isPodCapturePending) {
          // A pod suspends travel while the Oling keeps its visual hover motion.
        } else if (roamState.restReturn) {
          const target = getBedTarget(
            roamState.restReturn.placedId,
            roamState.restReturn.sleepSlotId,
            bounds,
            id
          );
          if (!target) {
            roamState.restReturn = null;
            roamState.activity = 'sleeping';
          } else {
            const deltaX = target.x - roamState.x;
            const deltaY = target.y - roamState.y;
            const distance = Math.hypot(deltaX, deltaY);
            const travelSpeed = Math.max(maxSpeed * 5, bounds.cell * 0.65);
            const step = Math.min(distance, travelSpeed * deltaSeconds);
            if (distance > 0) {
              roamState.x += (deltaX / distance) * step;
              roamState.y += (deltaY / distance) * step;
            }
            if (distance <= 4 || step >= distance) {
              roamState.x = target.x;
              roamState.y = target.y;
              roamState.restReturn = null;
              roamState.activity = 'sleeping';
            }
          }
        } else if (sleepingBedTarget) {
          roamState.activity = 'sleeping';
          roamState.bedJourney = null;
          roamState.x = sleepingBedTarget.x;
          roamState.y = sleepingBedTarget.y;
          roamState.vx = 0;
          roamState.vy = 0;
          roamState.wasSleeping = true;
        } else if (roamState.bedJourney) {
          roamState.activity = 'idle';
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
          roamState.activity = 'idle';
          const target = getDoorTarget(
            roamState.adventureJourney.placedId,
            bounds,
            id
          );
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
          roamState.activity = 'idle';
          if (roamState.wasSleeping) {
            const wakeAngle = getSeededRatio(id, 'wake-angle') * Math.PI * 2;
            const wakeSpeed =
              minSpeed +
              getSeededRatio(id, 'wake-speed') * (maxSpeed - minSpeed);
            roamState.vx = Math.cos(wakeAngle) * wakeSpeed;
            roamState.vy = Math.sin(wakeAngle) * wakeSpeed * 0.72;
            roamState.wasSleeping = false;
          }
          if (!isTargetSelected('oling', id)) {
            roamState.x += roamState.vx * deltaSeconds * roamState.motionBlend;
            roamState.y += roamState.vy * deltaSeconds * roamState.motionBlend;

            if (roamState.x <= bounds.minX || roamState.x >= bounds.maxX) {
              roamState.vx *= -1;
              roamState.x = Math.min(
                Math.max(roamState.x, bounds.minX),
                bounds.maxX
              );
            }

            if (roamState.y <= bounds.minY || roamState.y >= bounds.maxY) {
              roamState.vy *= -1;
              roamState.y = Math.min(
                Math.max(roamState.y, bounds.minY),
                bounds.maxY
              );
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

    function setPodCaptureHover(olingId, enabled) {
      const id = String(olingId || '');
      const roamState = state.olingRoam.get(id);
      if (!roamState) return false;
      roamState.podCaptureHover = Boolean(enabled);
      const oling = (state.olings || []).find(
        (candidate) => getOlingId(candidate) === id
      );
      if (oling) applyTransform(oling, roamState);
      return true;
    }

    function cancelActiveInteractions() {
      state.olingRoam.forEach((roamState) => {
        if (roamState?.releaseGlide) {
          const wasSleeping = roamState.wasSleeping;
          finishReleaseGlide(roamState);
          roamState.activity = wasSleeping ? 'sleeping' : 'idle';
        }
        const carry = roamState?.carry;
        if (!carry) return;
        window.clearTimeout?.(carry.holdTimer);
        if (roamState.element?.hasPointerCapture?.(carry.pointerId)) {
          roamState.element.releasePointerCapture(carry.pointerId);
        }
        roamState.carry = null;
        roamState.activity = roamState.wasSleeping ? 'sleeping' : 'idle';
        roamState.vx = carry.previousVx || roamState.vx;
        roamState.vy = carry.previousVy || roamState.vy;
      });
    }

    return {
      cancelBedJourney,
      cancelAdventureDeparture,
      cancelAdventureJourney,
      ensureRoamStates,
      getOlingId,
      getRoamState,
      setPodCaptureHover,
      isHeadingToBed,
      isHeadingToAdventure,
      renderOlings,
      sendToBed,
      sendToAdventure,
      returnFromAdventure,
      syncRoamStatesToRoomMetrics,
      cancelActiveInteractions,
      start
    };
  }

  window.OlingLabRoaming = {
    create: createRoamingController
  };
})();
