const test = require('node:test');
const assert = require('node:assert/strict');

const { __test } = require('../../server/routes/api-olings');

function createLab(overrides = {}) {
  return {
    roomLevel: 1,
    columns: 3,
    rows: 2,
    placedItems: [],
    ...overrides
  };
}

test('legacy wider labs retain every previously available square', () => {
  const unlocked = __test.getUnlockedLabCellKeys(createLab({ columns: 5 }));

  assert.equal(unlocked.length, 10);
  assert.ok(unlocked.includes('0:4'));
  assert.ok(unlocked.includes('1:4'));
});

test('individual lab squares remain independently locked', () => {
  const unlocked = __test.getUnlockedLabCellKeys(
    createLab({ columns: 4, unlockedCells: ['0:3'] })
  );

  assert.ok(unlocked.includes('0:3'));
  assert.ok(!unlocked.includes('1:3'));
});

test('lab square prices increase by column and use the current balance', () => {
  const expansion = __test.getLabExpansionDetails(
    createLab({ unlockedCells: [] }),
    { gameData: { opals: { balance: 200 } } }
  );
  const fourthColumnTop = expansion.cells.find(
    (cell) => cell.row === 0 && cell.col === 3
  );
  const fifthColumnTop = expansion.cells.find(
    (cell) => cell.row === 0 && cell.col === 4
  );

  assert.equal(fourthColumnTop.price, 150);
  assert.equal(fourthColumnTop.eligible, true);
  assert.equal(fourthColumnTop.canAfford, true);
  assert.equal(fifthColumnTop.price, 225);
  assert.equal(fifthColumnTop.eligible, false);
  assert.equal(fifthColumnTop.canAfford, false);
  assert.equal(expansion.frontierColumn, 3);
  assert.equal(expansion.visibleColumns, 4);
});

test('the next column is unavailable until both nearer squares are unlocked', () => {
  const partial = __test.getLabExpansionDetails(
    createLab({ columns: 4, unlockedCells: ['0:3'] })
  );
  const remainingNearCell = partial.cells.find(
    (cell) => cell.row === 1 && cell.col === 3
  );
  const nextColumnCell = partial.cells.find(
    (cell) => cell.row === 0 && cell.col === 4
  );

  assert.equal(remainingNearCell.eligible, true);
  assert.equal(nextColumnCell.eligible, false);
  assert.equal(partial.frontierColumn, 3);
  assert.equal(partial.visibleColumns, 4);

  const completed = __test.getLabExpansionDetails(
    createLab({ columns: 4, unlockedCells: ['0:3', '1:3'] })
  );
  const newlyAvailableCell = completed.cells.find(
    (cell) => cell.row === 0 && cell.col === 4
  );

  assert.equal(newlyAvailableCell.eligible, true);
  assert.equal(completed.frontierColumn, 4);
  assert.equal(completed.visibleColumns, 5);
});
