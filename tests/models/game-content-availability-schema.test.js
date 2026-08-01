const assert = require('node:assert/strict');
const test = require('node:test');

const GamePack = require('../../models/game-config/game-pack-schema');
const GameRole = require('../../models/game-config/game-role-schema');
const GameRule = require('../../models/game-config/game-rule-schema');

test('pack, rule, and role schemas default to always available', () => {
  const documents = [
    new GamePack({
      gameType: 'truth-or-dare',
      slug: 'classic',
      key: 'truth-or-dare-classic',
      title: 'Classic'
    }),
    new GameRule({
      gameType: 'truth-or-dare',
      key: 'rounds',
      title: 'Rounds',
      buttonType: 'increment'
    }),
    new GameRole({
      gameType: 'mafia',
      key: 'civilian',
      title: 'Civilian',
      faction: 'civilian'
    })
  ];

  documents.forEach((document) => {
    assert.equal(document.availability.mode, 'always');
    assert.equal(document.availability.availableFrom, null);
    assert.equal(document.availability.availableUntil, null);
  });
});

test('fixed availability rejects an end that is not later than its start', async () => {
  const pack = new GamePack({
    gameType: 'truth-or-dare',
    slug: 'seasonal',
    key: 'truth-or-dare-seasonal',
    title: 'Seasonal',
    availability: {
      mode: 'fixed',
      availableFrom: new Date('2026-11-01T00:00:00.000Z'),
      availableUntil: new Date('2026-10-01T00:00:00.000Z')
    }
  });

  await assert.rejects(pack.validate(), /later than availableFrom/);
});

test('annual availability validates leap days and IANA timezones', async () => {
  const role = new GameRole({
    gameType: 'mafia',
    key: 'seasonal-role',
    title: 'Seasonal Role',
    faction: 'neutral',
    availability: {
      mode: 'annual',
      timeZone: 'Europe/London',
      annualFrom: { month: 2, day: 29, hour: 0 },
      annualUntil: { month: 3, day: 1, hour: 0 }
    }
  });

  await assert.doesNotReject(role.validate());
  role.availability.timeZone = 'Not/A_Timezone';
  await assert.rejects(role.validate(), /valid IANA timezone/);
});
