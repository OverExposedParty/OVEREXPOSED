const assert = require('node:assert/strict');
const test = require('node:test');

const {
  buildGamemodeDistribution,
  createGamemodeDistributionPipeline,
  parseGamemodeDistributionQuery,
  registerGamemodeDistributionRoute
} = require('../../server/routes/api-oe-panel-party-games/gamemode-distribution');

test('gamemode distribution filters parse dates, exclusions, and metrics', () => {
  const parsed = parseGamemodeDistributionQuery(
    {
      preset: 'custom',
      from: '2026-01-01T00:00:00.000Z',
      to: '2026-02-01T00:00:00.000Z',
      exclude: ['mafia', 'paranoia,imposter'],
      includeUnknown: 'true',
      minimumCount: '3',
      metric: 'players',
      topN: '5',
      search: 'truth'
    },
    new Date('2026-07-30T12:00:00.000Z')
  );

  assert.equal(parsed.error, undefined);
  assert.deepEqual(parsed.filters.excludedGamemodes, [
    'mafia',
    'paranoia',
    'imposter'
  ]);
  assert.equal(parsed.filters.metric, 'players');
  assert.equal(parsed.filters.includeUnknown, true);
  assert.equal(parsed.filters.minimumCount, 3);
  assert.equal(parsed.filters.topN, 5);
  assert.equal(parsed.filters.search, 'truth');
  assert.equal(parsed.filters.from.toISOString(), '2026-01-01T00:00:00.000Z');
});

test('gamemode distribution rejects an inverted custom range', () => {
  const parsed = parseGamemodeDistributionQuery({
    preset: 'custom',
    from: '2026-02-01T00:00:00.000Z',
    to: '2026-01-01T00:00:00.000Z'
  });

  assert.match(parsed.error, /earlier/);
});

test('gamemode distribution rejects unsupported filters', () => {
  assert.match(
    parseGamemodeDistributionQuery({ preset: 'whenever' }).error,
    /preset/
  );
  assert.match(
    parseGamemodeDistributionQuery({ metric: 'minutes' }).error,
    /games or players/
  );
  assert.match(
    parseGamemodeDistributionQuery({ preset: 'custom' }).error,
    /both a from and to date/
  );
});

test('gamemode distribution pipeline aggregates games and players', () => {
  const parsed = parseGamemodeDistributionQuery(
    { preset: 'all', exclude: 'mafia' },
    new Date('2026-07-30T12:00:00.000Z')
  );
  const pipeline = createGamemodeDistributionPipeline(parsed.filters);

  assert.equal(pipeline[0].$match.archivedAt, undefined);
  assert.deepEqual(pipeline[0].$match.$and[1], {
    gamemode: { $nin: ['mafia'] }
  });
  assert.deepEqual(pipeline[1].$group.games, { $sum: 1 });
  assert.ok(pipeline[1].$group.players);
});

test('gamemode distribution uses configured colours and groups top results', () => {
  const result = buildGamemodeDistribution({
    aggregationRows: [
      { _id: 'truth-or-dare', games: 12, players: 48 },
      { _id: 'mafia', games: 8, players: 40 },
      { _id: 'paranoia', games: 4, players: 12 }
    ],
    gameModes: [
      {
        gameType: 'truth-or-dare',
        name: 'Truth or Dare',
        colours: { primary: '#123456', secondary: '#654321' }
      },
      { gameType: 'mafia', name: 'Mafia', colours: {} }
    ],
    filters: {
      metric: 'games',
      search: '',
      minimumCount: 0,
      topN: 2
    },
    formatLabel: (value) => value.replace('-', ' ')
  });

  assert.equal(result.total, 24);
  assert.equal(result.elements[0].colour, '#123456');
  assert.equal(result.elements[2].key, 'other');
  assert.equal(result.elements[2].value, 4);
  assert.equal(result.elements[0].percentage, 50);
  assert.ok(result.availableGamemodes.some((mode) => mode.key === 'paranoia'));
});

test('gamemode distribution route returns aggregated panel data', async () => {
  let handler;
  let responsePayload;
  const gameModeQuery = {
    select() {
      return this;
    },
    sort() {
      return this;
    },
    async lean() {
      return [
        {
          gameType: 'mafia',
          name: 'Mafia',
          colours: { primary: '#112233', secondary: '#223344' }
        }
      ];
    }
  };

  registerGamemodeDistributionRoute({
    app: {
      get(route, routeHandler) {
        assert.equal(route, '/api/oe-panel/party-games/gamemode-distribution');
        handler = routeHandler;
      }
    },
    archivedRoomSchema: {
      async aggregate(pipeline) {
        assert.equal(pipeline[0].$match.archivedAt, undefined);
        return [{ _id: 'mafia', games: 3, players: 12 }];
      }
    },
    GameMode: {
      find() {
        return gameModeQuery;
      }
    },
    async requireOePanelAccount() {
      return { id: 'account-one' };
    },
    formatPartyGameLabel(value) {
      return value;
    }
  });

  await handler(
    { id: 'request-one', query: { preset: 'all' } },
    {
      apiSuccess(payload) {
        responsePayload = payload;
      },
      apiError(payload) {
        assert.fail(payload.message);
      }
    }
  );

  assert.equal(responsePayload.data.total, 3);
  assert.equal(responsePayload.data.elements[0].label, 'Mafia');
  assert.equal(responsePayload.data.elements[0].colour, '#112233');
  assert.equal(responsePayload.data.range.from, null);
});
