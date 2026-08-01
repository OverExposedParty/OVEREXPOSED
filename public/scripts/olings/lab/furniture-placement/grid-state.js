(function () {
  function createOlingLabFurnitureGridState({
    state,
    rows,
    getItem,
    isPlaced
  }) {
    function createPlacedId(itemId) {
      if (window.crypto?.randomUUID)
        return `${itemId}_${window.crypto.randomUUID()}`;
      return `${itemId}_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
    }

    function getOccupiedMap() {
      const occupied = new Map();

      state.lab.placedItems.forEach((item) => {
        for (let row = item.row; row < item.row + item.height; row += 1) {
          for (let col = item.col; col < item.col + item.width; col += 1) {
            occupied.set(`${row}:${col}`, item);
          }
        }
      });

      return occupied;
    }

    function isLabCellUnlocked(row, col) {
      const key = `${row}:${col}`;
      return Array.isArray(state.lab?.unlockedCells)
        ? state.lab.unlockedCells.includes(key)
        : col < Number(state.lab?.columns || 0);
    }

    function getLabExpansionCell(row, col) {
      const cell =
        state.expansion?.cells?.find(
          (cell) => cell.row === row && cell.col === col
        ) || null;
      return cell?.eligible && !cell.unlocked ? cell : null;
    }

    function getAnchorRow(item, row) {
      return Number(item?.height || 1) >= rows ? 0 : row;
    }

    function getAllowedRoomRows(item) {
      if (Array.isArray(item?.allowedRows) && item.allowedRows.length) {
        return item.allowedRows.map(Number);
      }
      if (item?.category === 'table' || item?.type === 'table') return [1];
      return Array.from({ length: rows }, (_, row) => row);
    }

    function canUseRoomRow(item, row) {
      return getAllowedRoomRows(item).includes(Number(row));
    }

    function canPlaceRoomItem(item, row, col) {
      if (!item || item.layer !== 'room' || item.locked) return false;
      if (!state.owned.has(item.id) || isPlaced(item.id)) return false;

      const width = Number(item.width || 1);
      const height = Number(item.height || 1);
      const anchorRow = getAnchorRow(item, row);
      if (col < 0 || col + width > state.lab.columns) return false;
      if (anchorRow < 0 || anchorRow + height > rows) return false;
      if (!canUseRoomRow(item, anchorRow)) return false;

      const occupied = getOccupiedMap();
      for (
        let cellRow = anchorRow;
        cellRow < anchorRow + height;
        cellRow += 1
      ) {
        for (let cellCol = col; cellCol < col + width; cellCol += 1) {
          if (!isLabCellUnlocked(cellRow, cellCol)) return false;
          if (occupied.has(`${cellRow}:${cellCol}`)) return false;
        }
      }

      return true;
    }

    function canMoveRoomItem(placed, item, row, col) {
      if (!placed || !item || item.layer !== 'room' || placed.locked)
        return false;
      const width = Number(item.width || placed.width || 1);
      const height = Number(item.height || placed.height || 1);
      const anchorRow = getAnchorRow(item, row);
      if (col < 0 || col + width > state.lab.columns) return false;
      if (anchorRow < 0 || anchorRow + height > rows) return false;
      if (!canUseRoomRow(item, anchorRow)) return false;

      const occupied = getOccupiedMap();
      for (
        let cellRow = anchorRow;
        cellRow < anchorRow + height;
        cellRow += 1
      ) {
        for (let cellCol = col; cellCol < col + width; cellCol += 1) {
          if (!isLabCellUnlocked(cellRow, cellCol)) return false;
          const occupant = occupied.get(`${cellRow}:${cellCol}`);
          if (occupant && occupant.placedId !== placed.placedId) return false;
        }
      }

      return true;
    }

    function getRoomPlacementBlockReason(item, row, col) {
      if (!item || item.layer !== 'room' || item.locked) return 'Unavailable';
      if (isPlaced(item.id)) return 'Placed';
      if (!state.owned.has(item.id)) return 'Not owned';

      const width = Number(item.width || 1);
      const height = Number(item.height || 1);
      const anchorRow = getAnchorRow(item, row);
      if (col < 0 || col + width > state.lab.columns) return 'No space';
      if (anchorRow < 0 || anchorRow + height > rows) return 'No space';
      if (!canUseRoomRow(item, anchorRow)) {
        const allowedRows = getAllowedRoomRows(item);
        if (allowedRows.length === 1)
          return allowedRows[0] === 0 ? 'Top row' : 'Bottom row';
        return 'Wrong row';
      }

      const occupied = getOccupiedMap();
      for (
        let cellRow = anchorRow;
        cellRow < anchorRow + height;
        cellRow += 1
      ) {
        for (let cellCol = col; cellCol < col + width; cellCol += 1) {
          if (!isLabCellUnlocked(cellRow, cellCol)) return 'Locked';
          if (occupied.has(`${cellRow}:${cellCol}`)) return 'Blocked';
        }
      }

      return '';
    }

    function getRoomItemsForSlot(row, col) {
      return [...state.owned]
        .map(getItem)
        .filter((item) => item && item.layer === 'room' && !item.locked)
        .filter((item) => canPlaceRoomItem(item, row, col));
    }

    function containerSlotAcceptsItem(slotDefinition, item) {
      const acceptedTypes = Array.isArray(slotDefinition?.accepts)
        ? slotDefinition.accepts
        : [];
      if (!acceptedTypes.length) return true;
      return acceptedTypes.includes(item?.type || item?.category);
    }

    function getContainerItemsForSlot(slotDefinition) {
      const slotId = slotDefinition?.slotId || slotDefinition;
      return [...state.owned]
        .map(getItem)
        .filter((item) => item && item.layer === 'container')
        .filter((item) => {
          const acceptedSlots = Array.isArray(item.acceptedSlots)
            ? item.acceptedSlots
            : [];
          return (
            acceptedSlots.includes(slotId) &&
            containerSlotAcceptsItem(slotDefinition, item)
          );
        });
    }

    return {
      createPlacedId,
      getOccupiedMap,
      isLabCellUnlocked,
      getLabExpansionCell,
      getAnchorRow,
      canPlaceRoomItem,
      canMoveRoomItem,
      getRoomPlacementBlockReason,
      getRoomItemsForSlot,
      getContainerItemsForSlot
    };
  }

  window.createOlingLabFurnitureGridState =
    createOlingLabFurnitureGridState;
})();
