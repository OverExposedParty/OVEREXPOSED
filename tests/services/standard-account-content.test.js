const assert = require('node:assert/strict');
const test = require('node:test');

const {
  CONTENT_ACCESS_LEVELS,
  getFeatureAccessLevel,
  getGamemodeAccessLevel,
  shouldTrackStandardAccountProgress
} = require('../../models/content/standard-account-content');

test('standard account progression follows configured content access', () => {
  assert.equal(
    getGamemodeAccessLevel('truth-or-dare'),
    CONTENT_ACCESS_LEVELS.STANDARD
  );
  assert.equal(getGamemodeAccessLevel('imposter'), CONTENT_ACCESS_LEVELS.BETA);
  assert.equal(getGamemodeAccessLevel('mafia'), CONTENT_ACCESS_LEVELS.OWNER);
  assert.equal(getFeatureAccessLevel('shop'), CONTENT_ACCESS_LEVELS.BETA);
  assert.equal(
    getFeatureAccessLevel('overexposure'),
    CONTENT_ACCESS_LEVELS.BETA
  );
  assert.equal(
    getFeatureAccessLevel('party-games.prompt-heist'),
    CONTENT_ACCESS_LEVELS.BETA
  );

  assert.equal(
    shouldTrackStandardAccountProgress({ gamemode: 'truth-or-dare' }),
    true
  );
  assert.equal(
    shouldTrackStandardAccountProgress({ gamemode: 'imposter' }),
    false
  );
  assert.equal(
    shouldTrackStandardAccountProgress({ gamemode: 'mafia' }),
    false
  );
  assert.equal(shouldTrackStandardAccountProgress({ feature: 'shop' }), false);
  assert.equal(
    shouldTrackStandardAccountProgress({ feature: 'overexposure' }),
    false
  );
  assert.equal(
    shouldTrackStandardAccountProgress({
      gamemode: 'truth-or-dare',
      feature: 'party-games.prompt-heist'
    }),
    false
  );
});
