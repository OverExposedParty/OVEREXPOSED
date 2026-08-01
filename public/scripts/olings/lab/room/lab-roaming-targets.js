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
      const x = restPoint?.x ?? (Number(sleepSlot.x) || 256);
      const y = restPoint?.y ?? (Number(sleepSlot.y) || 256);
      return {
        x:
          (Number(placedBed.col) + (x / 512) * Number(placedBed.width || 1)) *
            bounds.cell -
          bounds.size / 2,
        y:
          (Number(placedBed.row) + (y / 512) * Number(placedBed.height || 1)) *
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
      roamState.vy =
        roamState.adventureJourney.previousVy || minSpeed * 0.5;
      roamState.adventureJourney = null;
      return true;
    }

    function cancelAdventureDeparture(olingId) {
      const roamState = state.olingRoam.get(String(olingId));
      if (!roamState) return false;
      roamState.adventurePending = false;
      const angle =
        getSeededRatio(olingId, 'adventure-departure-cancelled') *
        Math.PI *
        2;
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
      getBedTarget,
      getDoorTarget,
      isHeadingToAdventure,
      isHeadingToBed,
      returnFromAdventure,
      sendToAdventure,
      sendToBed
    };
  }

  window.createOlingLabRoamingTargets = createOlingLabRoamingTargets;
})();
