(function (globalScope) {
  function createTeamDragController(options = {}) {
    const documentRef = options.document || globalScope.document;
    const holdMs = Math.max(0, Number(options.holdMs) || 180);
    const lobby = options.lobby;
    const teamSlots = options.teamSlots || [];
    let drag = null;
    let suppressClickUntil = 0;

    function positionGhost(event) {
      if (!drag?.ghost) return;
      drag.ghost.style.left = `${event.clientX}px`;
      drag.ghost.style.top = `${event.clientY}px`;
    }

    function getDropSlot(event) {
      const elementAtPoint = documentRef.elementFromPoint?.(
        event.clientX,
        event.clientY
      );
      const target = elementAtPoint || event.target;
      const slot = target?.closest?.('.olings-clash-team-slot');
      const slotIndex = teamSlots.indexOf(slot);
      return slotIndex >= 0 ? slotIndex : -1;
    }

    function markDropSlot(slotIndex) {
      teamSlots.forEach((slot, index) => {
        slot.classList.toggle(
          'is-drag-over',
          index === slotIndex && index !== drag?.fromSlotIndex
        );
      });
      if (drag) drag.toSlotIndex = slotIndex;
    }

    function begin(event) {
      if (!drag || drag.active) return;
      const slot = teamSlots[drag.fromSlotIndex];
      const button = slot?.querySelector('button');
      if (!button || !options.hasOling?.(drag.fromSlotIndex)) return;
      const rect = button.getBoundingClientRect();
      const ghost = button.cloneNode(true);
      ghost.classList.add('olings-clash-team-drag-ghost');
      ghost.setAttribute('aria-hidden', 'true');
      ghost.style.width = `${rect.width}px`;
      ghost.style.height = `${rect.height}px`;
      documentRef.body.append(ghost);
      slot.classList.add('is-dragging');
      button.setAttribute('aria-grabbed', 'true');
      globalScope.OlingFlightMotion?.setPaused?.(button, true);
      drag.active = true;
      drag.ghost = ghost;
      lobby?.classList.add('is-dragging-team-oling');
      positionGhost(event);
      markDropSlot(getDropSlot(event));
    }

    function clear({ dropped = false } = {}) {
      if (!drag) return;
      globalScope.clearTimeout(drag.holdTimer);
      const { active, fromSlotIndex, toSlotIndex, ghost } = drag;
      const sourceButton = teamSlots[fromSlotIndex]?.querySelector('button');
      if (sourceButton) {
        sourceButton.setAttribute('aria-grabbed', 'false');
        globalScope.OlingFlightMotion?.setPaused?.(sourceButton, false);
      }
      ghost?.remove();
      teamSlots.forEach((slot) =>
        slot.classList.remove('is-dragging', 'is-drag-over')
      );
      lobby?.classList.remove('is-dragging-team-oling');
      drag = null;
      if (active) {
        suppressClickUntil = Date.now() + 250;
        if (dropped && toSlotIndex >= 0) {
          options.onSwap?.(fromSlotIndex, toSlotIndex);
        }
      }
    }

    function pointerDown(event, slotIndex) {
      if (
        drag ||
        !options.hasOling?.(slotIndex) ||
        lobby?.classList.contains('is-selecting-oling') ||
        (event.pointerType === 'mouse' && event.button !== 0)
      ) {
        return;
      }
      drag = {
        active: false,
        fromSlotIndex: slotIndex,
        ghost: null,
        holdTimer: globalScope.setTimeout(() => begin(event), holdMs),
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        toSlotIndex: slotIndex
      };
    }

    function pointerMove(event) {
      if (!drag || event.pointerId !== drag.pointerId) return;
      if (!drag.active) {
        const distance = Math.hypot(
          event.clientX - drag.startX,
          event.clientY - drag.startY
        );
        if (distance > 8) clear();
        return;
      }
      event.preventDefault();
      positionGhost(event);
      markDropSlot(getDropSlot(event));
    }

    function pointerUp(event) {
      if (!drag || event.pointerId !== drag.pointerId) return;
      if (drag.active) markDropSlot(getDropSlot(event));
      clear({ dropped: true });
    }

    return {
      clear,
      pointerDown,
      pointerMove,
      pointerUp,
      shouldSuppressClick: () => Date.now() < suppressClickUntil
    };
  }

  globalScope.createOlingClashTeamDragController = createTeamDragController;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = createTeamDragController;
  }
})(typeof window !== 'undefined' ? window : globalThis);
