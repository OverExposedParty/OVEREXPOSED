const assert = require('node:assert/strict');
const test = require('node:test');

const { serializeRuleForApi } = require('../../server/services/game-rules');

test('game rule API serialization includes a normalized hidden description', () => {
  const serialized = serializeRuleForApi({
    key: 'anonymous-vote',
    description: '  Hides each vote until voting has finished.  ',
    enabled: true,
    status: 'published',
    buttonType: 'toggle',
    restriction: []
  });

  assert.equal(
    serialized['settings-description'],
    'Hides each vote until voting has finished.'
  );
});

test('game rule API serialization uses an empty hidden description by default', () => {
  const serialized = serializeRuleForApi({
    key: 'anonymous-vote',
    enabled: true,
    status: 'published',
    buttonType: 'toggle',
    restriction: []
  });

  assert.equal(serialized['settings-description'], '');
});
