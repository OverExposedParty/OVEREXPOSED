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

    function getLabExpansionColumn(col) {
      const column =
        state.expansion?.columns?.find((column) => column.col === col) || null;
      return column?.eligible && !column.unlocked ? column : null;
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

    function getMovePlacement(placed, item, row, col) {
      if (!placed || !item || item.layer !== 'room' || placed.locked)
        return null;
      const width = Number(item.width || placed.width || 1);
      const height = Number(item.height || placed.height || 1);
      const anchorRow = getAnchorRow(item, row);
      const anchorCol = Number(col);
      if (anchorCol < 0 || anchorCol + width > state.lab.columns) return null;
      if (anchorRow < 0 || anchorRow + height > rows) return null;
      if (!canUseRoomRow(item, anchorRow)) return null;

      const cells = [];
      for (
        let cellRow = anchorRow;
        cellRow < anchorRow + height;
        cellRow += 1
      ) {
        for (
          let cellCol = anchorCol;
          cellCol < anchorCol + width;
          cellCol += 1
        ) {
          if (!isLabCellUnlocked(cellRow, cellCol)) return null;
          cells.push(`${cellRow}:${cellCol}`);
        }
      }

      return { row: anchorRow, col: anchorCol, width, height, cells };
    }

    function canMoveRoomItem(placed, item, row, col) {
      const placement = getMovePlacement(placed, item, row, col);
      if (!placement) return false;

      const occupied = getOccupiedMap();
      for (const cell of placement.cells) {
        const occupant = occupied.get(cell);
        if (occupant && occupant.placedId !== placed.placedId) return false;
      }

      return true;
    }

    function getRoomItemSwap(firstPlaced, secondPlaced) {
      if (
        !firstPlaced ||
        !secondPlaced ||
        firstPlaced.placedId === secondPlaced.placedId ||
        firstPlaced.locked ||
        secondPlaced.locked
      )
        return null;

      const firstItem = getItem(firstPlaced.itemId);
      const secondItem = getItem(secondPlaced.itemId);
      const firstPlacement = getMovePlacement(
        firstPlaced,
        firstItem,
        secondPlaced.row,
        secondPlaced.col
      );
      const secondPlacement = getMovePlacement(
        secondPlaced,
        secondItem,
        firstPlaced.row,
        firstPlaced.col
      );
      if (!firstPlacement || !secondPlacement) return null;

      const ignoredPlacedIds = new Set([
        firstPlaced.placedId,
        secondPlaced.placedId
      ]);
      const occupied = getOccupiedMap();
      for (const cell of [...firstPlacement.cells, ...secondPlacement.cells]) {
        const occupant = occupied.get(cell);
        if (occupant && !ignoredPlacedIds.has(occupant.placedId)) return null;
      }

      const firstCells = new Set(firstPlacement.cells);
      if (secondPlacement.cells.some((cell) => firstCells.has(cell)))
        return null;

      return {
        first: {
          placedId: firstPlaced.placedId,
          row: firstPlacement.row,
          col: firstPlacement.col
        },
        second: {
          placedId: secondPlaced.placedId,
          row: secondPlacement.row,
          col: secondPlacement.col
        }
      };
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
      getLabExpansionColumn,
      getAnchorRow,
      canPlaceRoomItem,
      canMoveRoomItem,
      getRoomItemSwap,
      getRoomPlacementBlockReason,
      getRoomItemsForSlot,
      getContainerItemsForSlot
    };
  }

  window.createOlingLabFurnitureGridState = createOlingLabFurnitureGridState;
})();
