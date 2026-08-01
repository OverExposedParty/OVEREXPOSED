const assert = require('node:assert/strict');
const test = require('node:test');

const {
  registerOePanelEmailRoutes
} = require('../../server/routes/api-oe-panel-emails');

function createRequestBody() {
  return {
    name: 'Verification Email',
    subject: 'Confirm your email',
    category: 'transactional',
    preheader: 'Confirm your account',
    theme: {},
    sections: [
      {
        id: 'footer',
        type: 'footer',
        settings: {
          text: 'OVEREXPOSED',
          privacyLabel: 'Privacy',
          privacyHref: '/terms-and-privacy',
          unsubscribeLabel: 'Unsubscribe',
          unsubscribeHref: '{{UNSUBSCRIBE_URL}}',
          fontSize: 12,
          colour: '#a8a8a8'
        }
      }
    ]
  };
}

function createRouteContext(overrides = {}) {
  const handlers = new Map();
  const routes = [];
  const app = {};
  ['get', 'post', 'patch', 'delete'].forEach((method) => {
    app[method] = (path, handler) => {
      routes.push([method, path]);
      handlers.set(`${method.toUpperCase()} ${path}`, handler);
    };
  });
  return {
    app,
    handlers,
    routes,
    EmailTemplate: { STATUSES: ['draft', 'published', 'archived'] },
    async requireOePanelAccount() {
      return { _id: 'admin-1', email: 'admin@overexposed.test' };
    },
    requireOePanelPermission() {
      return true;
    },
    ...overrides
  };
}

test('OE panel email routes preserve their endpoint contract', () => {
  const context = createRouteContext();

  registerOePanelEmailRoutes(context);

  assert.deepEqual(context.routes, [
    ['get', '/api/oe-panel/emails/templates'],
    ['post', '/api/oe-panel/emails/templates'],
    ['get', '/api/oe-panel/emails/templates/:id'],
    ['patch', '/api/oe-panel/emails/templates/:id'],
    ['post', '/api/oe-panel/emails/templates/:id/duplicate'],
    ['post', '/api/oe-panel/emails/templates/:id/publish'],
    ['post', '/api/oe-panel/emails/templates/:id/preview'],
    ['post', '/api/oe-panel/emails/templates/:id/test-send'],
    ['delete', '/api/oe-panel/emails/templates/:id']
  ]);
});

test('POST email template creates a protected MongoDB draft', async () => {
  let createdPayload;
  const templateDocument = {
    _id: 'template-1',
    name: 'Verification Email',
    category: 'transactional',
    status: 'draft',
    subject: 'Confirm your email',
    preheader: 'Confirm your account',
    theme: {},
    sections: createRequestBody().sections,
    version: 1,
    system: {}
  };
  const context = createRouteContext({
    EmailTemplate: {
      STATUSES: ['draft', 'published', 'archived'],
      async create(payload) {
        createdPayload = payload;
        return templateDocument;
      }
    }
  });
  registerOePanelEmailRoutes(context);
  const handler = context.handlers.get('POST /api/oe-panel/emails/templates');
  let result;
  let status;
  let routeError;

  await handler(
    { id: 'email-create-test', body: createRequestBody() },
    {
      apiSuccess(payload, responseStatus) {
        result = payload;
        status = responseStatus;
      },
      apiError(payload) {
        routeError = payload;
      }
    }
  );

  assert.equal(routeError, undefined);
  assert.equal(status, 201);
  assert.equal(createdPayload.status, 'draft');
  assert.equal(createdPayload.system.createdBy, 'admin-1');
  assert.equal(result.data.template.id, 'template-1');
});

test('publish compiles and stores an immutable delivery snapshot', async () => {
  const source = createRequestBody();
  const templateDocument = {
    _id: 'template-1',
    ...source,
    status: 'draft',
    version: 4,
    system: {},
    toObject() {
      return {
        _id: this._id,
        ...source,
        status: this.status,
        version: this.version,
        system: this.system
      };
    },
    async save() {
      return this;
    }
  };
  const context = createRouteContext({
    EmailTemplate: {
      STATUSES: ['draft', 'published', 'archived'],
      async findOne() {
        return templateDocument;
      }
    }
  });
  registerOePanelEmailRoutes(context);
  const handler = context.handlers.get(
    'POST /api/oe-panel/emails/templates/:id/publish'
  );
  let result;
  let routeError;

  await handler(
    {
      id: 'email-publish-test',
      body: { version: 4 },
      params: { id: 'template-1' },
      protocol: 'https',
      get: () => 'overexposed.example'
    },
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
  assert.equal(templateDocument.status, 'published');
  assert.equal(templateDocument.publishedVersion, 4);
  assert.equal(templateDocument.publishedSnapshot.version, 4);
  assert.match(templateDocument.publishedSnapshot.html, /<!doctype html>/i);
  assert.equal(result.data.template.status, 'published');
});
