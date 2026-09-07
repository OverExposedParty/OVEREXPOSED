const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const script = fs.readFileSync(
  path.join(
    __dirname,
    '../../public/scripts/olings/lab/data/hatch-selectors.js'
  ),
  'utf8'
);

test('Oling Lab hatch progress includes saved hatch-speed influences', () => {
  const context = { window: {} };
  vm.runInNewContext(script, context, { filename: 'hatch-selectors.js' });
  const selectors = context.window.createOlingLabHatchSelectors({
    defaultHatchDurationMs: 2 * 60 * 60 * 1000,
    state: {
      consumables: new Map([
        ['oling-blanket', { effect: { type: 'hatch_speed', amount: 25 } }]
      ])
    }
  });

  assert.equal(
    selectors.getConfiguredHatchDurationMs(
      {},
      {},
      {
        influenceSlots: [{ slotKey: 'influence-1', itemKey: 'oling-blanket' }]
      }
    ),
    96 * 60 * 1000
  );
});
