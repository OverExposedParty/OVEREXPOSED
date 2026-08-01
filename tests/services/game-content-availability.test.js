const assert = require('node:assert/strict');
const test = require('node:test');

const {
  filterAvailableContent,
  isGameContentAvailable,
  parseAvailabilityInput,
  pruneUnavailablePartyContent,
  serializeAvailability
} = require('../../server/services/game-content-availability');

function fixed(from, until) {
  return {
    availability: {
      mode: 'fixed',
      availableFrom: from,
      availableUntil: until
    }
  };
}

function annual(from, until, timeZone = 'UTC') {
  return {
    availability: {
      mode: 'annual',
      timeZone,
      annualFrom: from,
      annualUntil: until
    }
  };
}

test('always and fixed availability use inclusive starts and exclusive ends', () => {
  assert.equal(isGameContentAvailable({}), true);
  const content = fixed('2026-10-31T18:00:00.000Z', '2026-11-01T02:00:00.000Z');

  assert.equal(
    isGameContentAvailable(content, new Date('2026-10-31T17:59:59.999Z')),
    false
  );
  assert.equal(
    isGameContentAvailable(content, new Date('2026-10-31T18:00:00.000Z')),
    true
  );
  assert.equal(
    isGameContentAvailable(content, new Date('2026-11-01T02:00:00.000Z')),
    false
  );
});

test('annual availability evaluates wall-clock time in its IANA timezone', () => {
  const content = annual(
    { month: 7, day: 1, hour: 18 },
    { month: 7, day: 1, hour: 20 },
    'Europe/London'
  );

  assert.equal(
    isGameContentAvailable(content, new Date('2026-07-01T16:59:59.999Z')),
    false
  );
  assert.equal(
    isGameContentAvailable(content, new Date('2026-07-01T17:00:00.000Z')),
    true
  );
  assert.equal(
    isGameContentAvailable(content, new Date('2026-07-01T19:00:00.000Z')),
    false
  );
});

test('annual availability supports windows that wrap across New Year', () => {
  const content = annual(
    { month: 12, day: 20, hour: 0 },
    { month: 1, day: 5, hour: 0 }
  );

  assert.equal(
    isGameContentAvailable(content, new Date('2026-12-25T12:00:00.000Z')),
    true
  );
  assert.equal(
    isGameContentAvailable(content, new Date('2027-01-04T23:59:59.999Z')),
    true
  );
  assert.equal(
    isGameContentAvailable(content, new Date('2027-01-05T00:00:00.000Z')),
    false
  );
  assert.equal(
    isGameContentAvailable(content, new Date('2027-06-01T00:00:00.000Z')),
    false
  );
});

test('February 29 annual windows occur only during leap years', () => {
  const content = annual(
    { month: 2, day: 29, hour: 0 },
    { month: 3, day: 1, hour: 0 }
  );

  assert.equal(
    isGameContentAvailable(content, new Date('2028-02-29T12:00:00.000Z')),
    true
  );
  assert.equal(
    isGameContentAvailable(content, new Date('2027-02-28T12:00:00.000Z')),
    false
  );
});

test('availability input parses fixed and XXXX annual boundaries', () => {
  const fixedResult = parseAvailabilityInput({
    availabilityMode: 'fixed',
    availableFrom: '2026-10-31T18:00:00.000Z',
    availableUntil: ''
  });
  assert.equal(fixedResult.error, undefined);
  assert.equal(
    fixedResult.availability.availableFrom.toISOString(),
    '2026-10-31T18:00:00.000Z'
  );

  const annualResult = parseAvailabilityInput({
    availabilityMode: 'annual',
    availabilityTimeZone: 'Europe/London',
    availableFrom: 'XXXX-10-31T18:00:00',
    availableUntil: 'XXXX-11-01T02:00:00'
  });
  assert.equal(annualResult.error, undefined);
  assert.deepEqual(serializeAvailability(annualResult.availability), {
    mode: 'annual',
    timeZone: 'Europe/London',
    availableFrom: 'XXXX-10-31T18:00:00',
    availableUntil: 'XXXX-11-01T02:00:00'
  });
});

test('availability input rejects invalid ranges and partial recurring years', () => {
  assert.match(
    parseAvailabilityInput({
      availabilityMode: 'fixed',
      availableFrom: '2026-11-01T02:00:00.000Z',
      availableUntil: '2026-10-31T18:00:00.000Z'
    }).error,
    /later than/
  );
  assert.match(
    parseAvailabilityInput({
      availabilityMode: 'annual',
      availabilityTimeZone: 'UTC',
      availableFrom: '20XX-10-31T18:00:00',
      availableUntil: 'XXXX-11-01T02:00:00'
    }).error,
    /XXXX/
  );
});

test('explicit include keys grandfather unavailable catalogue items', () => {
  const items = [
    { key: 'always' },
    {
      key: 'seasonal',
      ...fixed('2026-01-01T00:00:00.000Z', '2026-02-01T00:00:00.000Z')
    }
  ];
  const at = new Date('2026-03-01T00:00:00.000Z');

  assert.deepEqual(
    filterAvailableContent(items, { at }).map((item) => item.key),
    ['always']
  );
  assert.deepEqual(
    filterAvailableContent(items, { at, includeKeys: ['seasonal'] }).map(
      (item) => item.key
    ),
    ['always', 'seasonal']
  );
});

test('return-to-lobby pruning removes expired scheduled selections only', async () => {
  const model = (records) => ({
    find() {
      return { lean: async () => records };
    }
  });
  const expiredAvailability = {
    mode: 'fixed',
    availableUntil: new Date('2026-02-01T00:00:00.000Z')
  };
  const config = {
    gamemode: 'mafia',
    selectedPacks: ['seasonal-pack', 'classic'],
    gameRules: {
      'seasonal-rule': true,
      'seasonal-rule-game-rule-time-limit': 30,
      rounds: 10
    },
    roleCounts: { civilian: 0, mafioso: 1, 'seasonal-role': 1 }
  };

  await pruneUnavailablePartyContent({
    config,
    GamePack: model([
      { slug: 'seasonal-pack', availability: expiredAvailability }
    ]),
    GameRule: model([
      { key: 'seasonal-rule', availability: expiredAvailability }
    ]),
    GameRole: model([
      { key: 'seasonal-role', availability: expiredAvailability }
    ]),
    at: new Date('2026-03-01T00:00:00.000Z')
  });

  assert.deepEqual(config.selectedPacks, ['classic']);
  assert.deepEqual(config.gameRules, { rounds: 10 });
  assert.deepEqual(config.roleCounts, { civilian: 0, mafioso: 1 });
});
