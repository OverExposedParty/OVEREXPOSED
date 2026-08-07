const assert = require('node:assert/strict');
const test = require('node:test');

const {
  createApiRouteContext
} = require('../../server/routes/api-route-context');

test('API route context preserves its public helper contract', () => {
  const context = createApiRouteContext({
    app: {},
    models: {},
    runtime: {}
  });

  assert.equal(Object.keys(context).length, 233);
  assert.equal(Object.hasOwn(context, 'getEmailVerifiedRedirect'), false);
  assert.equal(Object.hasOwn(context, 'AnalyticsEvent'), true);
  assert.equal(Object.hasOwn(context, 'EmailAudience'), true);
  assert.equal(Object.hasOwn(context, 'EmailAutomation'), true);
  assert.equal(Object.hasOwn(context, 'EmailSuppression'), true);
  assert.equal(Object.hasOwn(context, 'EmailTemplate'), true);
  assert.equal(Object.hasOwn(context, 'EmailDelivery'), true);
  assert.equal(Object.hasOwn(context, 'emailConnection'), true);
  [
    'createGamePackUpdatePayload',
    'createGameRoleUpdatePayload',
    'buildOverexposurePostReport',
    'serializeOePanelUser',
    'assertAuthThrottle',
    'establishAccountSession',
    'serializeAccount',
    'serializeActiveRoom',
    'recordEmailConversion',
    'createMarketingUnsubscribeUrl'
  ].forEach((key) => assert.equal(typeof context[key], 'function', key));
});

test('role panel payloads preserve nullable descriptions and validate selection integers', () => {
  const context = createApiRouteContext({
    app: {},
    models: {},
    runtime: {}
  });

  assert.deepEqual(
    context.createGameRoleUpdatePayload({
      description: '  ',
      faction: 'civilian',
      defaultCount: '2',
      fillRemaining: 'no'
    }),
    {
      update: {
        description: null,
        faction: 'civilian',
        'selection.fillRemaining': false,
        'selection.defaultCount': 2
      }
    }
  );
  assert.match(
    context.createGameRoleUpdatePayload({ increment: 0 }).error,
    /valid integers/
  );
});

test('party content panel serializers retain descriptions as metadata', () => {
  const context = createApiRouteContext({
    app: {},
    models: {},
    runtime: {}
  });

  const role = context.serializePartyRoleForPanel({
    gameType: 'mafia',
    key: 'inspector',
    title: 'Inspector',
    description: null,
    faction: 'civilian',
    enabled: true,
    status: 'published',
    selection: {
      defaultCount: 1,
      increment: 1,
      minimum: 0,
      maximum: 15,
      fillRemaining: false
    },
    assets: {}
  });

  assert.equal(role.description, '');
  assert.equal(role.details.description, '');
  assert.equal(role.defaultCount, '1');
});

test('archived room duration ends at recorded activity instead of cleanup time', () => {
  const context = createApiRouteContext({
    app: {},
    models: {},
    runtime: {}
  });
  const room = context.serializeArchivedRoom({
    partyId: 'ABC-123',
    gameId: 'GAME-ONE',
    gamemode: 'never-have-i-ever',
    archivedAt: new Date('2026-08-05T12:30:00.000Z'),
    session: {
      createdAt: new Date('2026-08-05T12:00:00.000Z'),
      endedAt: new Date('2026-08-05T12:10:00.000Z')
    },
    state: {},
    players: []
  });

  assert.equal(room.timeLapsed, '10m');
});

test('room panel serializers include visual player and configuration snapshots', () => {
  const context = createApiRouteContext({
    app: {},
    models: {},
    runtime: {}
  });
  const archivedRoom = context.serializeArchivedRoom({
    partyId: 'ROOM-ONE',
    gameId: 'GAME-ONE',
    gamemode: 'mafia',
    archivedAt: new Date('2026-08-05T12:30:00.000Z'),
    session: {
      gameModeRelease: {
        version: '2.1.0',
        releaseId: 'mafia@2.1.0+release',
        runtimeBuild: 'build-created',
        contentHash: 'content-hash',
        capturedAt: new Date('2026-08-05T11:55:00.000Z')
      }
    },
    config: {
      selectedPacks: ['classic-mafia'],
      gameRules: { discussionTimer: 60 },
      roleCounts: { mafia: 1 }
    },
    state: {},
    errors: [
      {
        message: 'Vote failed',
        runtimeBuild: 'build-error',
        gameModeRelease: {
          version: '2.1.0',
          releaseId: 'mafia@2.1.0+release',
          runtimeBuild: 'build-created',
          contentHash: 'content-hash',
          capturedAt: new Date('2026-08-05T11:55:00.000Z')
        }
      }
    ],
    players: [
      { username: 'Legacy Player', isHost: true },
      {
        username: 'Snapshot Player',
        userIcon: '1000:1100:1200:1300',
        accountId: 'account-one'
      }
    ]
  });

  assert.equal(archivedRoom.hostUser, 'Legacy Player');
  assert.deepEqual(archivedRoom.roomVisual.selectedPacks, ['classic-mafia']);
  assert.equal(archivedRoom.roomVisual.gameRules.discussionTimer, 60);
  assert.equal(archivedRoom.roomVisual.roleCounts.mafia, 1);
  assert.equal(archivedRoom.gameModeVersion, '2.1.0');
  assert.equal(archivedRoom.releaseId, 'mafia@2.1.0+release');
  assert.equal(archivedRoom.errors[0].buildChanged, true);
  assert.equal(archivedRoom.errors[0].runtimeBuild, 'build-error');
  assert.deepEqual(
    archivedRoom.roomVisual.players.map((player) => player.userIcon),
    ['0000:0100:0200:0300', '1000:1100:1200:1300']
  );
  assert.deepEqual(
    archivedRoom.roomVisual.players.map((player) => player.accountType),
    ['Guest', 'Account']
  );
});

test('game pack payloads create and replace editable questions without losing metadata', () => {
  const context = createApiRouteContext({
    app: {},
    models: {},
    runtime: {}
  });

  const created = context.createGamePackCreatePayload({
    gameType: 'truth-or-dare',
    slug: 'new-pack',
    title: 'New Pack',
    description: 'A short pack description.',
    questions: [
      {
        question: 'Tell us a secret.',
        type: 'truth',
        alternatives: ['Pass'],
        punishment: 'Take a sip'
      }
    ]
  });
  assert.equal(created.error, undefined);
  assert.equal(created.pack.description, 'A short pack description.');
  assert.deepEqual(created.pack.questions, [
    {
      question: 'Tell us a secret.',
      type: 'truth',
      alternatives: ['Pass'],
      punishment: 'Take a sip'
    }
  ]);

  const updated = context.createGamePackUpdatePayload({
    questions: [{ question: 'Complete the dare.', type: 'dare' }]
  });
  assert.deepEqual(updated.update.questions, [
    {
      question: 'Complete the dare.',
      type: 'dare',
      alternatives: [],
      punishment: null
    }
  ]);
  assert.match(
    context.createGamePackUpdatePayload({
      questions: [{ question: '   ' }]
    }).error,
    /cannot be blank/
  );
});

test('OAuth session establishment receives account helpers after composition', async () => {
  const updates = [];
  const Account = {
    async updateOne(filter, update) {
      updates.push({ filter, update });
    }
  };
  const context = createApiRouteContext({
    app: {},
    models: { Account },
    runtime: {}
  });
  const cookies = [];
  const account = {
    _id: 'account-1',
    profile: {},
    security: { sessions: [], loginHistory: [] }
  };

  await context.establishAccountSession(
    {
      id: 'request-1',
      headers: {},
      ip: '127.0.0.1',
      secure: false,
      get(name) {
        return name === 'user-agent' ? 'route-context-test' : null;
      }
    },
    {
      cookie(name, value, options) {
        cookies.push({ name, value, options });
      }
    },
    account
  );

  assert.equal(updates.length, 2);
  assert.equal(cookies.length, 1);
  assert.equal(cookies[0].name, 'oe_session');
  assert.equal(typeof cookies[0].value, 'string');
  assert.ok(cookies[0].value.length > 20);
});
