const assert = require('node:assert/strict');
const test = require('node:test');

const partyModels = [
  require('../../models/party-games/waiting-room-schema'),
  require('../../models/party-games/party-game-truth-or-dare-schema'),
  require('../../models/party-games/party-game-paranoia-schema'),
  require('../../models/party-games/party-game-never-have-i-ever-schema'),
  require('../../models/party-games/party-game-most-likely-to-schema'),
  require('../../models/party-games/party-game-imposter-schema'),
  require('../../models/party-games/party-game-would-you-rather-schema'),
  require('../../models/party-games/party-game-mafia-schema')
];

for (const PartyModel of partyModels) {
  test(`${PartyModel.modelName} keeps party owner hashes private`, () => {
    const identitySchema = PartyModel.schema
      .path('players')
      .schema.path('identity').schema;
    const ownerHashPath = identitySchema.path('partyOwnerIdHash');

    assert.equal(ownerHashPath.instance, 'String');
    assert.equal(ownerHashPath.options.select, false);
    assert.equal(ownerHashPath.options.default, null);
  });
}
