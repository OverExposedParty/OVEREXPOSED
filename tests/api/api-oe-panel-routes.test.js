const assert = require('node:assert/strict');
const test = require('node:test');

const {
  registerOePanelModerationRoutes
} = require('../../server/routes/api-oe-panel/moderation-routes');
const {
  registerOePanelSystemRoutes
} = require('../../server/routes/api-oe-panel/system-routes');
const {
  registerOePanelOverexposureRoutes
} = require('../../server/routes/api-oe-panel/overexposure-routes');
const {
  registerOePanelSocialMediaRoutes
} = require('../../server/routes/api-oe-panel-social-media');
const {
  registerOePanelAchievementRoutes
} = require('../../server/routes/api-oe-panel-achievements');

function createRouteContext() {
  const routes = [];
  const app = {};

  ['get', 'post', 'patch', 'delete'].forEach((method) => {
    app[method] = (route) => routes.push([method, route]);
  });

  return {
    app,
    routes,
    OE_PANEL_EXPORT_UPLOAD: {
      single: () => (_req, _res, next) => next()
    },
    OE_PANEL_SVG_UPLOAD: {
      single: () => (_req, _res, next) => next()
    }
  };
}

test('OE panel moderation routes preserve their endpoint contract', () => {
  const context = createRouteContext();

  registerOePanelModerationRoutes(context);

  assert.deepEqual(context.routes, [['get', '/api/oe-panel/moderation']]);
});

test('GET /api/oe-panel/moderation formats second-based durations', async () => {
  let moderationHandler;
  const app = {
    get(path, handler) {
      if (path === '/api/oe-panel/moderation') moderationHandler = handler;
    }
  };
  const createQuery = (result) => ({
    sort() {
      return this;
    },
    select() {
      return this;
    },
    limit() {
      return this;
    },
    async lean() {
      return result;
    }
  });
  let aggregateCallCount = 0;
  const oldestCreatedAt = new Date(Date.now() - 3660 * 1000);
  const Report = {
    async countDocuments() {
      return 0;
    },
    findOne() {
      return createQuery({ system: { createdAt: oldestCreatedAt } });
    },
    aggregate() {
      aggregateCallCount += 1;
      return Promise.resolve(
        aggregateCallCount === 1 ? [{ averageMs: 3660 * 1000 }] : []
      );
    },
    find() {
      return createQuery([]);
    }
  };
  const context = {
    app,
    Report,
    Account: {
      async countDocuments() {
        return 0;
      }
    },
    archivedRoomSchema: {
      find() {
        return createQuery([]);
      }
    },
    async requireOePanelAccount() {
      return { _id: 'admin-1' };
    },
    getPartyGameRoomSources() {
      return [];
    },
    serializeArchivedRoom(room) {
      return room;
    }
  };

  registerOePanelModerationRoutes(context);
  assert.equal(typeof moderationHandler, 'function');

  let result;
  let routeError;
  await moderationHandler(
    { id: 'moderation-duration-test' },
    {
      apiSuccess(payload) {
        result = payload;
      },
      apiError(payload) {
        routeError = payload;
      }
    }
  );

  assert.equal(routeError, undefined);
  assert.equal(result.data.stats.oldestWaiting, '1h 1m');
  assert.equal(result.data.stats.averageResolution, '1h 1m');
});

test('OE panel system routes preserve their endpoint contract and order', () => {
  const context = createRouteContext();

  registerOePanelSystemRoutes(context);

  assert.deepEqual(context.routes, [
    ['get', '/api/oe-panel/system'],
    ['patch', '/api/oe-panel/system/config/:key']
  ]);
});

test('OE panel Overexposure routes preserve their endpoint contract and order', () => {
  const context = createRouteContext();

  registerOePanelOverexposureRoutes(context);

  assert.deepEqual(context.routes, [
    ['get', '/api/oe-panel/overexposure'],
    ['delete', '/api/oe-panel/overexposure-posts/:publicId'],
    ['patch', '/api/oe-panel/reports/:reportId']
  ]);
});

test('OE panel social media routes preserve their endpoint contract and order', () => {
  const context = createRouteContext();

  registerOePanelSocialMediaRoutes(context);

  assert.deepEqual(context.routes, [
    ['get', '/api/oe-panel/social-media'],
    ['post', '/api/oe-panel/social-media'],
    ['patch', '/api/oe-panel/social-media/:id'],
    ['delete', '/api/oe-panel/social-media/:id'],
    ['post', '/api/oe-panel/social-media/export-video']
  ]);
});

test('OE panel achievement routes preserve their endpoint contract and order', () => {
  const context = createRouteContext();

  registerOePanelAchievementRoutes(context);

  assert.deepEqual(context.routes, [
    ['get', '/api/oe-panel/achievements'],
    ['post', '/api/oe-panel/achievements'],
    ['post', '/api/oe-panel/achievements/export']
  ]);
});

test('GET /api/oe-panel/achievements returns panel data after route composition', async () => {
  let achievementHandler;
  const app = {
    get(path, handler) {
      if (path === '/api/oe-panel/achievements') achievementHandler = handler;
    },
    post() {}
  };
  const createFindQuery = (rows = []) => ({
    sort() {
      return this;
    },
    async lean() {
      return rows;
    }
  });
  const Achievement = {
    find() {
      return createFindQuery();
    }
  };
  const Account = {
    async countDocuments() {
      return 0;
    },
    async aggregate() {
      return [];
    }
  };
  const emptyContentModel = {
    find() {
      return createFindQuery();
    }
  };
  const context = {
    app,
    Account,
    Achievement,
    models: {
      Achievement,
      GameMode: emptyContentModel,
      GamePack: emptyContentModel,
      GameRule: emptyContentModel,
      OlingConsumable: emptyContentModel
    },
    OE_PANEL_SVG_UPLOAD: {
      single() {
        return (_req, _res, next) => next();
      }
    },
    async requireOePanelAccount() {
      return { _id: 'admin-1' };
    },
    formatOePanelDateTime() {
      return '-';
    }
  };

  registerOePanelAchievementRoutes(context);
  assert.equal(typeof achievementHandler, 'function');

  let result;
  let routeError;
  await achievementHandler(
    { id: 'achievement-list-test' },
    {
      apiSuccess(payload) {
        result = payload;
      },
      apiError(payload) {
        routeError = payload;
      }
    }
  );

  assert.equal(routeError, undefined);
  assert.deepEqual(result.data.library, []);
  assert.equal(result.data.stats.totalAchievements, 0);
});
