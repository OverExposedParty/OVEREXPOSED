(function () {
  function createOlingLabRoamingTargets({
    state,
    constants,
    getRoomMetrics,
    getSeededRatio,
    getOlingId
  }) {
    const { minSpeed, maxSpeed } = constants;

    function getRestPlacementPoint(bed, seed) {
      const placement = bed?.restPlacement;
      if (!placement?.totalPixels || !Array.isArray(placement.runs)) {
        return null;
      }
      const pointIndex = Math.min(
        placement.totalPixels - 1,
        Math.floor(
          getSeededRatio(seed, 'rest-placement') * placement.totalPixels
        )
      );
      const run = placement.runs.find(
        (candidate) => pointIndex < candidate.totalPixels
      );
      if (!run) return null;
      const previousTotal = run.totalPixels - (run.end - run.start);
      return {
        x: run.start + (pointIndex - previousTotal) + 0.5,
        y: run.y + 0.5
      };
    }

    function getFurnitureGridPlacement(item) {
      if (item?.usesFullGridArtboard) {
        return { x: 0, y: 0, width: 512, height: 512 };
      }
      const placement = item?.gridPlacement;
      const width = Number(placement?.width);
      const height = Number(placement?.height);
      if (!(width > 0) || !(height > 0)) {
        return { x: 0, y: 0, width: 512, height: 512 };
      }
      return {
        x: Number(placement.x) || 0,
        y: Number(placement.y) || 0,
        width,
        height
      };
    }

    function mapPointThroughFurnitureGridPlacement(item, point) {
      const placement = getFurnitureGridPlacement(item);
      return {
        x: placement.x + (Number(point?.x) / 512) * placement.width,
        y: placement.y + (Number(point?.y) / 512) * placement.height
      };
    }

    function getBedTarget(
      placedId,
      sleepSlotId = null,
      bounds = getRoomMetrics(),
      restSeed = ''
    ) {
      const placedBed = state.lab?.placedItems?.find(
        (placed) => String(placed?.placedId || '') === String(placedId || '')
      );
      if (!placedBed) return null;
      const bed = state.catalog?.get(placedBed.itemId);
      const sleepSlots =
        Array.isArray(bed?.sleepSlots) && bed.sleepSlots.length
          ? bed.sleepSlots
          : [{ slotId: 'sleep-1', x: 256, y: 256 }];
      const sleepSlot =
        sleepSlots.find(
          (slot) => String(slot.slotId) === String(sleepSlotId || '')
        ) || sleepSlots[0];
      const restPoint = getRestPlacementPoint(
        bed,
        `${restSeed}:${placedId}:${sleepSlot.slotId}`
      );
      const placementPoint = mapPointThroughFurnitureGridPlacement(bed, {
        x: restPoint?.x ?? (Number(sleepSlot.x) || 256),
        y: restPoint?.y ?? (Number(sleepSlot.y) || 256)
      });
      return {
        x:
          (Number(placedBed.col) +
            (placementPoint.x / 512) * Number(placedBed.width || 1)) *
            bounds.cell -
          bounds.size / 2,
        y:
          (Number(placedBed.row) +
            (placementPoint.y / 512) * Number(placedBed.height || 1)) *
            bounds.cell -
          bounds.size / 2
      };
    }

    function getDoorTarget(placedId, bounds = getRoomMetrics(), seed = '') {
      const placedDoor = state.lab?.placedItems?.find(
        (placed) => String(placed?.placedId || '') === String(placedId || '')
      );
      if (!placedDoor) return null;
      const door = state.catalog?.get(placedDoor.itemId);
      const exitPoint = getRestPlacementPoint(
        { restPlacement: door?.exitPlacement },
        `${seed}:${placedId}:exit`
      );
      if (!exitPoint) return null;
      return {
        x:
          (Number(placedDoor.col) +
            (exitPoint.x / 512) * Number(placedDoor.width || 1)) *
            bounds.cell -
          bounds.size / 2,
        y:
          (Number(placedDoor.row) +
            (exitPoint.y / 512) * Number(placedDoor.height || 1)) *
            bounds.cell -
          bounds.size / 2
      };
    }

    function getAvailableBedSlotId(placedId, olingId) {
      const placedBed = state.lab?.placedItems?.find(
        (placed) => String(placed?.placedId || '') === String(placedId || '')
      );
      const bed = state.catalog?.get(placedBed?.itemId);
      const sleepSlots =
        Array.isArray(bed?.sleepSlots) && bed.sleepSlots.length
          ? bed.sleepSlots
          : [{ slotId: 'sleep-1', x: 256, y: 256 }];
      const occupiedSlotIds = new Set();

      state.olings.forEach((oling) => {
        if (
          String(getOlingId(oling)) !== String(olingId) &&
          oling?.care?.isSleeping &&
          String(oling.care.sleepBedPlacedId || '') === String(placedId || '')
        ) {
          occupiedSlotIds.add(String(oling.care.sleepBedSlotId || 'sleep-1'));
        }
      });
      state.olingRoam.forEach((roamState, id) => {
        if (
          String(id) !== String(olingId) &&
          String(roamState?.bedJourney?.placedId || '') ===
            String(placedId || '')
        ) {
          occupiedSlotIds.add(
            String(roamState.bedJourney.sleepSlotId || 'sleep-1')
          );
        }
      });

      return (
        sleepSlots.find((slot) => !occupiedSlotIds.has(String(slot.slotId)))
          ?.slotId || null
      );
    }

    function isPointInBedRestArea(placedBed, bed, x, y, bounds) {
      if (!placedBed || !bed || !bounds?.cell) return false;
      const width = Math.max(1, Number(placedBed.width || 1));
      const height = Math.max(1, Number(placedBed.height || 1));
      const itemLocalX =
        ((x / bounds.cell - Number(placedBed.col || 0)) / width) * 512;
      const itemLocalY =
        ((y / bounds.cell - Number(placedBed.row || 0)) / height) * 512;
      const gridPlacement = getFurnitureGridPlacement(bed);
      const localX =
        ((itemLocalX - gridPlacement.x) / gridPlacement.width) * 512;
      const localY =
        ((itemLocalY - gridPlacement.y) / gridPlacement.height) * 512;
      if (localX < 0 || localX >= 512 || localY < 0 || localY >= 512) {
        return false;
      }

      const placement = bed.restPlacement;
      if (!placement?.totalPixels || !Array.isArray(placement.runs)) {
        return true;
      }
      const pixelX = Math.floor(localX);
      const pixelY = Math.floor(localY);
      return placement.runs.some(
        (run) =>
          Number(run.y) === pixelY &&
          pixelX >= Number(run.start) &&
          pixelX < Number(run.end)
      );
    }

    function isPointOverBed(placedId, x, y, bounds = getRoomMetrics()) {
      const placedBed = state.lab?.placedItems?.find(
        (placed) => String(placed?.placedId || '') === String(placedId || '')
      );
      const bed = state.catalog?.get(placedBed?.itemId);
      if (!placedBed || (bed?.type !== 'bed' && bed?.category !== 'bed')) {
        return false;
      }
      return isPointInBedRestArea(placedBed, bed, x, y, bounds);
    }

    function getMatchingDragInteraction(item, draggableType, action = '') {
      const normalizedType = String(draggableType || '');
      const normalizedAction = String(action || '');
      return (
        Array.isArray(item?.dragInteractions) ? item.dragInteractions : []
      ).find(
        (interaction) =>
          Array.isArray(interaction?.accepts) &&
          interaction.accepts.some(
            (acceptedType) => String(acceptedType) === normalizedType
          ) &&
          (!normalizedAction ||
            String(interaction?.action || '') === normalizedAction)
      );
    }

    function rectanglesOverlap(first, second) {
      return Boolean(
        first &&
        second &&
        first.left < second.right &&
        first.right > second.left &&
        first.top < second.bottom &&
        first.bottom > second.top
      );
    }

    function getPlacedItemGridPlacementBounds(placedItem, item, bounds) {
      if (!placedItem || !bounds?.cell) return null;
      const placement = getFurnitureGridPlacement(item);
      const itemWidth = Math.max(1, Number(placedItem.width || 1));
      const itemHeight = Math.max(1, Number(placedItem.height || 1));
      const scaleX = (itemWidth * bounds.cell) / 512;
      const scaleY = (itemHeight * bounds.cell) / 512;
      const left =
        Number(placedItem.col || 0) * bounds.cell + placement.x * scaleX;
      const top =
        Number(placedItem.row || 0) * bounds.cell + placement.y * scaleY;
      return {
        left,
        top,
        right: left + placement.width * scaleX,
        bottom: top + placement.height * scaleY
      };
    }

    function getFurnitureDragInteractionTarget(
      { draggableType, draggableId, action = '', x, y, width, height },
      bounds = getRoomMetrics()
    ) {
      const draggableBounds = {
        left: Number(x),
        top: Number(y),
        right: Number(x) + Math.max(0, Number(width) || 0),
        bottom: Number(y) + Math.max(0, Number(height) || 0)
      };
      if (
        !Object.values(draggableBounds).every(Number.isFinite) ||
        draggableBounds.right <= draggableBounds.left ||
        draggableBounds.bottom <= draggableBounds.top
      ) {
        return null;
      }

      for (const placedItem of state.lab?.placedItems || []) {
        const item = state.catalog?.get(placedItem?.itemId);
        const interaction = getMatchingDragInteraction(
          item,
          draggableType,
          action
        );
        if (
          !interaction ||
          interaction.collisionArea !== 'placement-grid' ||
          !rectanglesOverlap(
            draggableBounds,
            getPlacedItemGridPlacementBounds(placedItem, item, bounds)
          )
        ) {
          continue;
        }

        if (
          interaction.action === 'rest' &&
          interaction.snapTarget === 'rest-grid'
        ) {
          const sleepSlotId = getAvailableBedSlotId(
            placedItem.placedId,
            draggableId
          );
          if (!sleepSlotId) continue;
          const target = getBedTarget(
            placedItem.placedId,
            sleepSlotId,
            bounds,
            draggableId
          );
          if (!target) continue;
          return {
            placedId: String(placedItem.placedId),
            itemId: String(placedItem.itemId),
            action: 'rest',
            sleepSlotId: String(sleepSlotId),
            target
          };
        }
      }

      return null;
    }

    function getBedDropTarget(x, y, olingId, bounds = getRoomMetrics()) {
      const placedBeds = (state.lab?.placedItems || []).filter((placed) => {
        const bed = state.catalog?.get(placed?.itemId);
        return (
          (bed?.type === 'bed' || bed?.category === 'bed') &&
          !getMatchingDragInteraction(bed, 'oling', 'rest')
        );
      });

      for (const placedBed of placedBeds) {
        const bed = state.catalog?.get(placedBed.itemId);
        if (!isPointInBedRestArea(placedBed, bed, x, y, bounds)) continue;
        const sleepSlotId = getAvailableBedSlotId(placedBed.placedId, olingId);
        if (!sleepSlotId) continue;
        const target = getBedTarget(
          placedBed.placedId,
          sleepSlotId,
          bounds,
          olingId
        );
        if (!target) continue;
        return {
          placedId: String(placedBed.placedId),
          sleepSlotId: String(sleepSlotId),
          target
        };
      }
      return null;
    }

    function sendToBed(olingId, placedId) {
      const roamState = state.olingRoam.get(String(olingId));
      const sleepSlotId = getAvailableBedSlotId(placedId, olingId);
      if (
        !roamState ||
        !sleepSlotId ||
        !getBedTarget(placedId, sleepSlotId, getRoomMetrics(), olingId)
      ) {
        return false;
      }
      roamState.bedJourney = {
        placedId: String(placedId),
        sleepSlotId,
        phase: 'travelling',
        previousVx: roamState.vx,
        previousVy: roamState.vy
      };
      return true;
    }

    function cancelBedJourney(olingId) {
      const roamState = state.olingRoam.get(String(olingId));
      if (!roamState?.bedJourney) return false;
      roamState.vx = roamState.bedJourney.previousVx || minSpeed;
      roamState.vy = roamState.bedJourney.previousVy || minSpeed * 0.5;
      roamState.bedJourney = null;
      return true;
    }

    function isHeadingToBed(olingId, placedId = null) {
      const journey = state.olingRoam.get(String(olingId))?.bedJourney;
      if (!journey) return false;
      return placedId === null || String(journey.placedId) === String(placedId);
    }

    function sendToAdventure(olingId, placedId, adventure) {
      const roamState = state.olingRoam.get(String(olingId));
      if (!roamState || !getDoorTarget(placedId, getRoomMetrics(), olingId)) {
        return false;
      }
      roamState.adventureJourney = {
        placedId: String(placedId),
        adventure,
        previousVx: roamState.vx,
        previousVy: roamState.vy
      };
      return true;
    }

    function cancelAdventureJourney(olingId) {
      const roamState = state.olingRoam.get(String(olingId));
      if (!roamState?.adventureJourney) return false;
      roamState.vx = roamState.adventureJourney.previousVx || minSpeed;
      roamState.vy = roamState.adventureJourney.previousVy || minSpeed * 0.5;
      roamState.adventureJourney = null;
      return true;
    }

    function cancelAdventureDeparture(olingId) {
      const roamState = state.olingRoam.get(String(olingId));
      if (!roamState) return false;
      roamState.adventurePending = false;
      const angle =
        getSeededRatio(olingId, 'adventure-departure-cancelled') * Math.PI * 2;
      roamState.vx = Math.cos(angle) * minSpeed;
      roamState.vy = Math.sin(angle) * minSpeed * 0.72;
      return true;
    }

    function isHeadingToAdventure(olingId) {
      return Boolean(state.olingRoam.get(String(olingId))?.adventureJourney);
    }

    function returnFromAdventure(olingId, placedId) {
      const roamState = state.olingRoam.get(String(olingId));
      const target = getDoorTarget(placedId, getRoomMetrics(), olingId);
      if (!roamState || !target) return false;
      const angle = getSeededRatio(olingId, 'adventure-return') * Math.PI * 2;
      const speed =
        minSpeed +
        getSeededRatio(olingId, 'adventure-return-speed') *
          (maxSpeed - minSpeed);
      roamState.x = target.x;
      roamState.y = target.y;
      roamState.vx = Math.cos(angle) * speed;
      roamState.vy = Math.sin(angle) * speed * 0.72;
      return true;
    }

    return {
      cancelAdventureDeparture,
      cancelAdventureJourney,
      cancelBedJourney,
      getBedDropTarget,
      getBedTarget,
      getDoorTarget,
      getFurnitureDragInteractionTarget,
      isPointOverBed,
      isHeadingToAdventure,
      isHeadingToBed,
      returnFromAdventure,
      sendToAdventure,
      sendToBed
    };
  }

  window.createOlingLabRoamingTargets = createOlingLabRoamingTargets;
})();
