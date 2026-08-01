const assert = require('node:assert/strict');
const test = require('node:test');

const {
  serializePackMetadataForApi,
  serializePackMetadataForJson
} = require('../../server/services/game-packs');

function createPack(description) {
  return {
    gameType: 'truth-or-dare',
    slug: 'classic',
    key: 'truth-or-dare-classic',
    description,
    enabled: true,
    status: 'published',
    assets: {}
  };
}

test('game pack JSON serialization includes a normalized hidden description', () => {
  const serialized = serializePackMetadataForJson(
    createPack('  A balanced collection of prompts.  ')
  );

  assert.equal(
    serialized['pack-description'],
    'A balanced collection of prompts.'
  );
});

test('game pack API serialization preserves the hidden description', () => {
  const serialized = serializePackMetadataForApi(
    createPack('A balanced collection of prompts.')
  );

  assert.equal(
    serialized['pack-description'],
    'A balanced collection of prompts.'
  );
});

test('game pack serialization uses an empty hidden description by default', () => {
  const serialized = serializePackMetadataForJson(createPack());

  assert.equal(serialized['pack-description'], '');
});
