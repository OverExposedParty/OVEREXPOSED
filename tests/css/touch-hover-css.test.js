const assert = require('node:assert/strict');
const test = require('node:test');

const {
  findFilesRequiringChanges,
  splitSelectors,
  transformContainer
} = require('../../scripts/quality/gate-hover-styles');

test('selector splitting preserves commas inside functional selectors', () => {
  assert.deepEqual(
    splitSelectors('.card:not(.disabled, .active):hover, button:focus-visible'),
    ['.card:not(.disabled, .active):hover', 'button:focus-visible']
  );
});

test('hover gating preserves non-hover keyboard selectors', () => {
  const transformed = transformContainer(`
.button:hover,
.button:focus-visible {
  color: red;
}
`);

  assert.match(transformed, /\.button:focus-visible\s*\{/);
  assert.match(transformed, /@media \(hover: hover\) and \(pointer: fine\)/);
  assert.equal(
    transformed.indexOf('.button:focus-visible') <
      transformed.indexOf('@media (hover: hover)'),
    true
  );
});

test('all public-facing hover styles are gated to fine pointers', () => {
  assert.deepEqual(findFilesRequiringChanges(), []);
});
