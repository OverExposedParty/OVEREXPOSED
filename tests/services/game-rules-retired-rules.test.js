const assert = require('node:assert/strict');
const test = require('node:test');

const { getPublishedRules } = require('../../server/services/game-rules');

test('published game rules hide retired Truth or Dare text boxes', async () => {
  const GameRule = {
    find() {
      return {
        sort() {
          return {
            lean: async () => [
              {
                gameType: 'truth-or-dare',
                scope: 'gamemode',
                appliesTo: ['truth-or-dare'],
                key: 'text-box',
                enabled: true,
                status: 'published'
              },
              {
                gameType: 'truth-or-dare',
                scope: 'gamemode',
                appliesTo: ['truth-or-dare'],
                key: 'rounds',
                enabled: true,
                status: 'published'
              }
            ]
          };
        }
      };
    }
  };

  const rules = await getPublishedRules(GameRule, 'truth-or-dare');

  assert.deepEqual(
    rules.map((rule) => rule.key),
    ['rounds']
  );
});
