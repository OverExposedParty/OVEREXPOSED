const {
  STARTER_LAB_COLUMNS,
  LAB_ROWS,
  LAB_MIN_COLUMNS,
  LAB_MAX_COLUMNS,
  LAB_PURCHASE_MAX_COLUMNS,
  LAB_COLUMN_PRICES
} = require('../lab-catalog');
const { clampInteger } = require('./defaults');

function getLabCellKey(row, col) {
  return `${row}:${col}`;
}

function getUnlockedLabCellKeys(lab) {
  const explicitCells = Array.isArray(lab?.unlockedCells)
    ? lab.unlockedCells
    : null;
  const unlocked = new Set();

  for (let row = 0; row < LAB_ROWS; row += 1) {
    for (let col = 0; col < STARTER_LAB_COLUMNS; col += 1) {
      unlocked.add(getLabCellKey(row, col));
    }
  }

  if (explicitCells) {
    explicitCells.forEach((value) => {
      const match = /^(\d+):(\d+)$/.exec(String(value || ''));
      if (!match) return;
      const row = Number(match[1]);
      const col = Number(match[2]);
      if (row < 0 || row >= LAB_ROWS || col < 0 || col >= LAB_MAX_COLUMNS) {
        return;
      }
      unlocked.add(getLabCellKey(row, col));
    });
  } else {
    const legacyColumns = clampInteger(
      lab?.columns,
      LAB_MIN_COLUMNS,
      LAB_MAX_COLUMNS,
      STARTER_LAB_COLUMNS
    );
    for (let row = 0; row < LAB_ROWS; row += 1) {
      for (let col = STARTER_LAB_COLUMNS; col < legacyColumns; col += 1) {
        unlocked.add(getLabCellKey(row, col));
      }
    }
  }

  return [...unlocked].sort((left, right) => {
    const [leftRow, leftCol] = left.split(':').map(Number);
    const [rightRow, rightCol] = right.split(':').map(Number);
    return leftCol - rightCol || leftRow - rightRow;
  });
}

function getLabExpansionDetails(lab, account = null) {
  const unlockedCells = new Set(getUnlockedLabCellKeys(lab));
  const balance = Math.max(
    0,
    Math.floor(Number(account?.gameData?.opals?.balance) || 0)
  );
  const cells = [];
  let frontierColumn = null;

  for (
    let col = STARTER_LAB_COLUMNS;
    col < LAB_PURCHASE_MAX_COLUMNS;
    col += 1
  ) {
    const columnIsComplete = Array.from({ length: LAB_ROWS }, (_, row) =>
      unlockedCells.has(getLabCellKey(row, col))
    ).every(Boolean);
    if (!columnIsComplete) {
      frontierColumn = col;
      break;
    }
  }

  for (
    let col = STARTER_LAB_COLUMNS;
    col < LAB_PURCHASE_MAX_COLUMNS;
    col += 1
  ) {
    const price = LAB_COLUMN_PRICES[col + 1] || null;
    for (let row = 0; row < LAB_ROWS; row += 1) {
      const key = getLabCellKey(row, col);
      cells.push({
        key,
        row,
        col,
        price,
        unlocked: unlockedCells.has(key),
        eligible: col === frontierColumn,
        canAfford: Boolean(price && balance >= price)
      });
    }
  }

  return {
    balance,
    maximumColumns: LAB_PURCHASE_MAX_COLUMNS,
    frontierColumn,
    visibleColumns: Math.max(
      Number(lab?.columns) || STARTER_LAB_COLUMNS,
      frontierColumn === null ? STARTER_LAB_COLUMNS : frontierColumn + 1
    ),
    cells
  };
}

function getItemCells(item) {
  const cells = [];
  for (let row = item.row; row < item.row + item.height; row += 1) {
    for (let col = item.col; col < item.col + item.width; col += 1) {
      cells.push(`${row}:${col}`);
    }
  }
  return cells;
}

module.exports = {
  getLabCellKey,
  getUnlockedLabCellKeys,
  getLabExpansionDetails,
  getItemCells
};
