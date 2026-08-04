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
    EmailAutomation: {
      STATUSES: ['active', 'inactive'],
      TRIGGERS: [
        'email-verification',
        'password-reset-request',
        'email-address-change'
      ]
    },
    EmailTemplate: {
      STATUSES: ['draft', 'published', 'archived'],
      AUTOMATION_TRIGGERS: [
        'email-verification',
        'password-reset-request',
        'email-address-change'
      ]
    },
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
    ['get', '/api/oe-panel/emails/audiences'],
    ['get', '/api/oe-panel/emails/audiences/:id'],
    ['post', '/api/oe-panel/emails/audiences/preview'],
    ['post', '/api/oe-panel/emails/audiences'],
    ['patch', '/api/oe-panel/emails/audiences/:id'],
    ['post', '/api/oe-panel/emails/audiences/:id/duplicate'],
    ['delete', '/api/oe-panel/emails/audiences/:id'],
    ['get', '/api/oe-panel/emails/suppressions'],
    ['post', '/api/oe-panel/emails/suppressions'],
    ['delete', '/api/oe-panel/emails/suppressions/:id'],
    ['get', '/api/oe-panel/emails/performance'],
    ['get', '/api/oe-panel/emails/images'],
    ['get', '/api/oe-panel/emails/preferences'],
    ['get', '/api/oe-panel/emails/automations'],
    ['get', '/api/oe-panel/emails/automation-template-options'],
    ['post', '/api/oe-panel/emails/automations'],
    ['patch', '/api/oe-panel/emails/automations/:id'],
    ['delete', '/api/oe-panel/emails/automations/:id'],
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

test('GET email performance returns tracked delivery metrics', async () => {
  let performanceOptions;
  const context = createRouteContext({
    EmailDelivery: { modelName: 'EmailDelivery' },
    async getEmailPerformance(options) {
      performanceOptions = options;
      return {
        stats: { sent: { value: '12', detail: 'Last 30 days' } },
        trends: { labels: ['1 Aug'], series: { sent: [12] } },
        failures: []
      };
    }
  });
  registerOePanelEmailRoutes(context);
  const handler = context.handlers.get('GET /api/oe-panel/emails/performance');
  let result;

  await handler(
    { id: 'email-performance-test' },
    {
      apiSuccess(payload) {
        result = payload;
      }
    }
  );

  assert.equal(performanceOptions.EmailDelivery.modelName, 'EmailDelivery');
  assert.equal(result.data.stats.sent.value, '12');
  assert.deepEqual(result.data.trends.series.sent, [12]);
});

test('GET email audiences returns persisted recipient estimates', async () => {
  const context = createRouteContext({
    EmailAudience: {
      find() {
        return {
          sort() {
            return this;
          },
          async lean() {
            return [
              {
                _id: 'audience-1',
                name: 'Verified Players',
                type: 'dynamic',
                status: 'active',
                requireMarketingConsent: true,
                conditions: [],
                estimatedRecipients: 42,
                system: {}
              }
            ];
          }
        };
      }
    }
  });
  registerOePanelEmailRoutes(context);
  const handler = context.handlers.get('GET /api/oe-panel/emails/audiences');
  let result;

  await handler(
    { id: 'email-audiences-list-test' },
    {
      apiSuccess(payload) {
        result = payload;
      }
    }
  );

  assert.equal(result.data.audiences[0].name, 'Verified Players');
  assert.equal(result.data.audiences[0].recipientCount, 42);
  assert.equal(result.data.audiences[0].requireMarketingConsent, true);
});

test('POST email suppression validates and stores an administrator block', async () => {
  let created;
  const context = createRouteContext({
    EmailSuppression: {
      REASONS: ['unsubscribed', 'bounced', 'complaint', 'blocked', 'manual'],
      async create(input) {
        created = { _id: 'suppression-1', ...input };
        return created;
      }
    }
  });
  registerOePanelEmailRoutes(context);
  const handler = context.handlers.get(
    'POST /api/oe-panel/emails/suppressions'
  );
  let result;
  let statusCode;

  await handler(
    {
      id: 'email-suppression-create-test',
      body: {
        email: ' BLOCKED@Example.COM ',
        reason: 'complaint',
        note: 'Provider complaint'
      }
    },
    {
      apiSuccess(payload, status) {
        result = payload;
        statusCode = status;
      }
    }
  );

  assert.equal(statusCode, 201);
  assert.equal(created.email, 'blocked@example.com');
  assert.equal(created.source, 'admin');
  assert.equal(result.data.suppression.reason, 'complaint');
});

test('POST email audience duplicate creates an inactive copy', async () => {
  let created;
  const current = {
    _id: 'audience-source',
    name: 'Recent Players',
    type: 'dynamic',
    status: 'active',
    match: 'all',
    requireMarketingConsent: true,
    conditions: [{ field: 'emailVerified', operator: 'is', value: true }],
    recipientIds: [],
    estimatedRecipients: 24,
    system: {}
  };
  const context = createRouteContext({
    EmailAudience: {
      findOne() {
        return {
          async lean() {
            return current;
          }
        };
      },
      async create(input) {
        created = { _id: 'audience-copy', ...input };
        return created;
      }
    }
  });
  registerOePanelEmailRoutes(context);
  const handler = context.handlers.get(
    'POST /api/oe-panel/emails/audiences/:id/duplicate'
  );
  let result;
  let statusCode;

  await handler(
    {
      id: 'email-audience-duplicate-test',
      params: { id: current._id },
      body: {}
    },
    {
      apiSuccess(payload, status) {
        result = payload;
        statusCode = status;
      }
    }
  );

  assert.equal(statusCode, 201);
  assert.equal(created.name, 'Recent Players Copy');
  assert.equal(created.status, 'inactive');
  assert.equal(result.data.audience.recipientCount, 24);
});

test('GET email images returns the discovered asset library', async () => {
  const images = [
    {
      path: '/images/emails/heroes/mascot/default.png',
      name: 'Mascot Default',
      type: 'heroes'
    }
  ];
  const context = createRouteContext({
    async listEmailImages() {
      return images;
    }
  });
  registerOePanelEmailRoutes(context);
  const handler = context.handlers.get('GET /api/oe-panel/emails/images');
  let result;

  await handler(
    { id: 'email-images-test' },
    {
      apiSuccess(payload) {
        result = payload;
      }
    }
  );

  assert.deepEqual(result.data.images, images);
});

test('GET email preferences returns the administrator test recipient', async () => {
  const context = createRouteContext({
    async requireOePanelAccount() {
      return {
        _id: 'email-preferences-admin',
        admin: { emailTemplateTestRecipient: 'qa@example.com' }
      };
    }
  });
  registerOePanelEmailRoutes(context);
  const handler = context.handlers.get('GET /api/oe-panel/emails/preferences');
  let result;

  await handler(
    { id: 'email-preferences-test' },
    {
      apiSuccess(payload) {
        result = payload;
      }
    }
  );

  assert.equal(result.data.testEmailRecipient, 'qa@example.com');
});

test('GET email automations returns the persisted verification automation', async () => {
  const verifyTemplate = {
    _id: 'template-verify',
    key: 'verify-email',
    name: 'Email Confirmation',
    status: 'published',
    system: { updatedAt: new Date('2026-08-02T12:00:00.000Z') }
  };
  const context = createRouteContext({
    EmailAutomation: {
      STATUSES: ['active', 'inactive'],
      TRIGGERS: [
        'email-verification',
        'password-reset-request',
        'email-address-change'
      ],
      find() {
        return {
          sort() {
            return this;
          },
          async lean() {
            return [
              {
                _id: 'automation-verify',
                name: 'Verify Email',
                trigger: 'email-verification',
                templateKey: 'verify-email',
                status: 'active',
                systemManaged: true,
                system: {
                  updatedAt: new Date('2026-08-03T12:00:00.000Z')
                }
              }
            ];
          }
        };
      }
    },
    EmailTemplate: {
      STATUSES: ['draft', 'published', 'archived'],
      find() {
        return {
          select() {
            return this;
          },
          async lean() {
            return [verifyTemplate];
          }
        };
      }
    }
  });
  registerOePanelEmailRoutes(context);
  const handler = context.handlers.get('GET /api/oe-panel/emails/automations');
  let result;

  await handler(
    { id: 'email-automations-test' },
    {
      apiSuccess(payload) {
        result = payload;
      }
    }
  );

  assert.equal(result.data.automations.length, 1);
  assert.deepEqual(result.data.automations[0], {
    id: 'automation-verify',
    name: 'Verify Email',
    trigger: 'email-verification',
    triggerLabel: 'Account registration and resend verification',
    templateKey: 'verify-email',
    templateId: 'template-verify',
    templateName: 'Email Confirmation',
    templateStatus: 'published',
    status: 'active',
    systemManaged: true,
    updatedAt: new Date('2026-08-03T12:00:00.000Z')
  });
});

test('GET automation template options returns compatible published templates', async () => {
  let templateQuery;
  const context = createRouteContext({
    EmailTemplate: {
      STATUSES: ['draft', 'published', 'archived'],
      AUTOMATION_TRIGGERS: [
        'email-verification',
        'password-reset-request',
        'email-address-change'
      ],
      find(query) {
        templateQuery = query;
        return {
          select() {
            return this;
          },
          sort() {
            return this;
          },
          limit() {
            return this;
          },
          async lean() {
            return [
              {
                _id: 'template-password-reset',
                key: 'password-reset',
                name: 'Password Reset',
                category: 'account-security'
              }
            ];
          }
        };
      }
    }
  });
  registerOePanelEmailRoutes(context);
  const handler = context.handlers.get(
    'GET /api/oe-panel/emails/automation-template-options'
  );
  let result;

  await handler(
    {
      id: 'email-automation-template-options-test',
      query: { trigger: 'password-reset-request' }
    },
    {
      apiSuccess(payload) {
        result = payload;
      }
    }
  );

  assert.deepEqual(templateQuery, {
    key: { $type: 'string' },
    status: 'published',
    'publishedSnapshot.html': { $type: 'string', $ne: '' },
    'system.archivedAt': null,
    automationTriggers: 'password-reset-request'
  });
  assert.deepEqual(result.data.options, [
    {
      label: 'Password Reset (Account Security)',
      value: 'password-reset',
      templateId: 'template-password-reset',
      category: 'account-security'
    }
  ]);
});

test('POST email automation links a supported trigger to a template', async () => {
  const template = {
    _id: 'template-password-reset',
    key: 'password-reset',
    name: 'Password Reset',
    status: 'published',
    automationTriggers: ['password-reset-request'],
    system: {}
  };
  let createdPayload;
  let templateQuery;
  const context = createRouteContext({
    EmailAutomation: {
      STATUSES: ['active', 'inactive'],
      TRIGGERS: [
        'email-verification',
        'password-reset-request',
        'email-address-change'
      ],
      async create(payload) {
        createdPayload = payload;
        return { _id: 'automation-password-reset', ...payload };
      }
    },
    EmailTemplate: {
      STATUSES: ['draft', 'published', 'archived'],
      findOne(query) {
        templateQuery = query;
        return {
          async lean() {
            return template;
          }
        };
      }
    }
  });
  registerOePanelEmailRoutes(context);
  const handler = context.handlers.get('POST /api/oe-panel/emails/automations');
  let result;
  let responseStatus;

  await handler(
    {
      id: 'email-automation-create-test',
      body: {
        name: 'Password Reset Automation',
        trigger: 'password-reset-request',
        templateKey: 'PASSWORD-RESET',
        status: 'active'
      }
    },
    {
      apiSuccess(payload, status) {
        result = payload;
        responseStatus = status;
      }
    }
  );

  assert.equal(responseStatus, 201);
  assert.deepEqual(templateQuery, {
    key: 'password-reset',
    status: 'published',
    'publishedSnapshot.html': { $type: 'string', $ne: '' },
    'system.archivedAt': null,
    automationTriggers: 'password-reset-request'
  });
  assert.equal(createdPayload.templateKey, 'password-reset');
  assert.equal(createdPayload.systemManaged, false);
  assert.equal(result.data.automation.trigger, 'password-reset-request');
  assert.equal(result.data.automation.templateName, 'Password Reset');
});

test('PATCH email automation updates its populated form values', async () => {
  const currentAutomation = {
    _id: 'automation-password-reset',
    name: 'Password Reset Automation',
    trigger: 'password-reset-request',
    templateKey: 'password-reset',
    status: 'active',
    systemManaged: false,
    system: {}
  };
  const template = {
    _id: 'template-password-reset-v2',
    key: 'password-reset-v2',
    name: 'Password Reset V2',
    category: 'account-security',
    publishedSnapshot: { html: '<p>Password reset</p>' },
    automationTriggers: ['password-reset-request'],
    system: {}
  };
  let updateQuery;
  let updateOperation;
  let updateOptions;
  const context = createRouteContext({
    EmailAutomation: {
      STATUSES: ['active', 'inactive'],
      TRIGGERS: [
        'email-verification',
        'password-reset-request',
        'email-address-change'
      ],
      findOne() {
        return {
          async lean() {
            return currentAutomation;
          }
        };
      },
      async findOneAndUpdate(query, operation, options) {
        updateQuery = query;
        updateOperation = operation;
        updateOptions = options;
        return {
          ...currentAutomation,
          ...operation.$set,
          system: { updatedAt: operation.$set['system.updatedAt'] }
        };
      }
    },
    EmailTemplate: {
      STATUSES: ['draft', 'published', 'archived'],
      findOne() {
        return {
          async lean() {
            return template;
          }
        };
      }
    }
  });
  registerOePanelEmailRoutes(context);
  const handler = context.handlers.get(
    'PATCH /api/oe-panel/emails/automations/:id'
  );
  let result;

  await handler(
    {
      id: 'email-automation-update-test',
      params: { id: currentAutomation._id },
      body: {
        name: 'Password Reset Updated',
        trigger: 'password-reset-request',
        templateKey: 'password-reset-v2',
        status: 'inactive'
      }
    },
    {
      apiSuccess(payload) {
        result = payload;
      }
    }
  );

  assert.deepEqual(updateQuery, {
    _id: currentAutomation._id,
    'system.archivedAt': null
  });
  assert.equal(updateOperation.$set.name, 'Password Reset Updated');
  assert.equal(updateOperation.$set.templateKey, 'password-reset-v2');
  assert.equal(updateOperation.$set.status, 'inactive');
  assert.equal(updateOperation.$set.systemManaged, false);
  assert.equal(updateOptions.upsert, false);
  assert.equal(result.data.automation.templateName, 'Password Reset V2');
  assert.equal(result.data.automation.status, 'inactive');
});

test('PATCH persisted verification automation keeps it system-managed', async () => {
  const template = {
    _id: 'template-verify',
    key: 'verify-email',
    name: 'Email Confirmation',
    category: 'account-security',
    publishedSnapshot: { html: '<p>Verify email</p>' },
    system: {}
  };
  let updateOperation;
  let updateOptions;
  let updateQuery;
  const currentAutomation = {
    _id: 'automation-verify',
    name: 'Verify Email',
    trigger: 'email-verification',
    templateKey: 'verify-email',
    status: 'active',
    systemManaged: true,
    system: {}
  };
  const context = createRouteContext({
    EmailAutomation: {
      STATUSES: ['active', 'inactive'],
      TRIGGERS: [
        'email-verification',
        'password-reset-request',
        'email-address-change'
      ],
      findOne() {
        return {
          async lean() {
            return currentAutomation;
          }
        };
      },
      async findOneAndUpdate(query, operation, options) {
        updateQuery = query;
        updateOperation = operation;
        updateOptions = options;
        return {
          _id: 'automation-verify',
          ...operation.$set,
          system: { updatedAt: operation.$set['system.updatedAt'] }
        };
      }
    },
    EmailTemplate: {
      STATUSES: ['draft', 'published', 'archived'],
      findOne() {
        return {
          async lean() {
            return template;
          }
        };
      }
    }
  });
  registerOePanelEmailRoutes(context);
  const handler = context.handlers.get(
    'PATCH /api/oe-panel/emails/automations/:id'
  );
  let result;

  await handler(
    {
      id: 'email-automation-system-update-test',
      params: { id: 'automation-verify' },
      body: {
        name: 'Verify Email',
        trigger: 'email-verification',
        templateKey: 'verify-email',
        status: 'inactive'
      }
    },
    {
      apiSuccess(payload) {
        result = payload;
      }
    }
  );

  assert.deepEqual(updateQuery, {
    _id: 'automation-verify',
    'system.archivedAt': null
  });
  assert.equal(updateOperation.$set.systemManaged, true);
  assert.equal(updateOptions.upsert, false);
  assert.equal(result.data.automation.systemManaged, true);
  assert.equal(result.data.automation.trigger, 'email-verification');
  assert.equal(result.data.automation.status, 'inactive');
});

test('DELETE email automation archives and deactivates a user automation', async () => {
  const currentAutomation = {
    _id: 'automation-password-reset',
    name: 'Password Reset Automation',
    trigger: 'password-reset-request',
    templateKey: 'password-reset',
    status: 'active',
    systemManaged: false,
    system: { archivedAt: null }
  };
  let updateOperation;
  const context = createRouteContext({
    EmailAutomation: {
      STATUSES: ['active', 'inactive'],
      TRIGGERS: [
        'email-verification',
        'password-reset-request',
        'email-address-change'
      ],
      findOne() {
        return {
          async lean() {
            return currentAutomation;
          }
        };
      },
      async findOneAndUpdate(query, operation) {
        updateOperation = operation;
        return {
          ...currentAutomation,
          status: operation.$set.status,
          system: {
            archivedAt: operation.$set['system.archivedAt'],
            updatedAt: operation.$set['system.updatedAt']
          }
        };
      }
    }
  });
  registerOePanelEmailRoutes(context);
  const handler = context.handlers.get(
    'DELETE /api/oe-panel/emails/automations/:id'
  );
  let result;

  await handler(
    {
      id: 'email-automation-delete-test',
      params: { id: currentAutomation._id }
    },
    {
      apiSuccess(payload) {
        result = payload;
      }
    }
  );

  assert.equal(updateOperation.$set.status, 'inactive');
  assert.ok(updateOperation.$set['system.archivedAt'] instanceof Date);
  assert.deepEqual(result.data, {
    deleted: true,
    id: currentAutomation._id
  });
});

test('DELETE email automation protects the built-in verification automation', async () => {
  const context = createRouteContext();
  registerOePanelEmailRoutes(context);
  const handler = context.handlers.get(
    'DELETE /api/oe-panel/emails/automations/:id'
  );
  let routeError;

  await handler(
    {
      id: 'email-automation-system-delete-test',
      params: { id: 'system-email-verification' }
    },
    {
      apiError(payload) {
        routeError = payload;
      }
    }
  );

  assert.equal(routeError.status, 400);
  assert.equal(routeError.code, 'email_automation_system_delete_forbidden');
});

test('GET email templates reports persisted active automation usage', async () => {
  let automationQuery;
  const templates = [
    {
      _id: 'template-verify',
      key: 'verify-email',
      name: 'Email Confirmation',
      status: 'published',
      system: {}
    },
    {
      _id: 'template-reset',
      key: 'password-reset',
      name: 'Password Reset',
      status: 'published',
      system: {}
    }
  ];
  const context = createRouteContext({
    EmailAutomation: {
      STATUSES: ['active', 'inactive'],
      TRIGGERS: [
        'email-verification',
        'password-reset-request',
        'email-address-change'
      ],
      find(query) {
        automationQuery = query;
        return {
          select() {
            return this;
          },
          async lean() {
            return [
              {
                _id: 'automation-verify',
                name: 'Verify Email',
                trigger: 'email-verification',
                templateKey: 'verify-email',
                systemManaged: true
              },
              {
                _id: 'automation-reset',
                name: 'Reset Password',
                trigger: 'password-reset-request',
                templateKey: 'password-reset',
                systemManaged: false
              }
            ];
          }
        };
      }
    },
    EmailTemplate: {
      STATUSES: ['draft', 'published', 'archived'],
      find() {
        return {
          sort() {
            return this;
          },
          limit() {
            return this;
          },
          async lean() {
            return templates;
          }
        };
      }
    }
  });
  registerOePanelEmailRoutes(context);
  const handler = context.handlers.get('GET /api/oe-panel/emails/templates');
  let result;

  await handler(
    { id: 'email-template-usage-list-test', query: {} },
    {
      apiSuccess(payload) {
        result = payload;
      }
    }
  );

  assert.deepEqual(automationQuery, {
    status: 'active',
    'system.archivedAt': null
  });
  assert.deepEqual(result.data.templates[0].activeUses, [
    {
      automationId: 'automation-verify',
      name: 'Verify Email',
      trigger: 'email-verification',
      triggerLabel: 'Account registration and resend verification',
      systemManaged: true
    }
  ]);
  assert.equal(result.data.templates[1].activeUses[0].name, 'Reset Password');
  assert.equal(
    result.data.templates[1].activeUses[0].triggerLabel,
    'Password reset request'
  );
});

test('DELETE email template rejects templates used by active automations', async () => {
  const template = {
    _id: 'template-reset',
    key: 'password-reset',
    name: 'Password Reset',
    system: { archivedAt: null }
  };
  let deleteAttempted = false;
  const context = createRouteContext({
    EmailAutomation: {
      STATUSES: ['active', 'inactive'],
      TRIGGERS: [
        'email-verification',
        'password-reset-request',
        'email-address-change'
      ],
      find() {
        return {
          select() {
            return this;
          },
          async lean() {
            return [
              {
                _id: 'automation-reset',
                name: 'Reset Password',
                trigger: 'password-reset-request',
                templateKey: 'password-reset'
              }
            ];
          }
        };
      }
    },
    EmailTemplate: {
      STATUSES: ['draft', 'published', 'archived'],
      findOne() {
        return {
          async lean() {
            return template;
          }
        };
      },
      async findOneAndUpdate() {
        deleteAttempted = true;
      }
    }
  });
  registerOePanelEmailRoutes(context);
  const handler = context.handlers.get(
    'DELETE /api/oe-panel/emails/templates/:id'
  );
  let routeError;

  await handler(
    { id: 'email-template-in-use-delete-test', params: { id: template._id } },
    {
      apiError(payload) {
        routeError = payload;
      }
    }
  );

  assert.equal(deleteAttempted, false);
  assert.equal(routeError.status, 409);
  assert.equal(routeError.code, 'email_template_in_use');
  assert.match(routeError.message, /Reset Password \(Password reset request\)/);
});

test('DELETE unused email template archives it after server validation', async () => {
  const template = {
    _id: 'template-marketing',
    key: 'marketing-update',
    name: 'Marketing Update',
    system: { archivedAt: null }
  };
  let updateOperation;
  const context = createRouteContext({
    EmailAutomation: {
      STATUSES: ['active', 'inactive'],
      TRIGGERS: [
        'email-verification',
        'password-reset-request',
        'email-address-change'
      ],
      find() {
        return {
          select() {
            return this;
          },
          async lean() {
            return [];
          }
        };
      }
    },
    EmailTemplate: {
      STATUSES: ['draft', 'published', 'archived'],
      findOne() {
        return {
          async lean() {
            return template;
          }
        };
      },
      async findOneAndUpdate(query, operation) {
        updateOperation = operation;
        return { ...template, status: 'archived' };
      }
    }
  });
  registerOePanelEmailRoutes(context);
  const handler = context.handlers.get(
    'DELETE /api/oe-panel/emails/templates/:id'
  );
  let result;

  await handler(
    { id: 'email-template-delete-test', params: { id: template._id } },
    {
      apiSuccess(payload) {
        result = payload;
      }
    }
  );

  assert.equal(updateOperation.$set.status, 'archived');
  assert.deepEqual(result.data, {
    deleted: true,
    id: template._id
  });
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

test('PATCH email template updates content without versioning or unpublishing', async () => {
  const current = {
    _id: 'template-published',
    ...createRequestBody(),
    status: 'published',
    publishedSnapshot: { html: '<p>Published content</p>' },
    system: {}
  };
  let updateQuery;
  let updateOperation;
  const context = createRouteContext({
    EmailTemplate: {
      STATUSES: ['draft', 'published', 'archived'],
      findOne() {
        return {
          async lean() {
            return current;
          }
        };
      },
      async findOneAndUpdate(query, update) {
        updateQuery = query;
        updateOperation = update;
        return {
          ...current,
          ...update.$set,
          name: update.$set.name,
          system: { updatedAt: update.$set['system.updatedAt'] }
        };
      }
    }
  });
  registerOePanelEmailRoutes(context);
  const handler = context.handlers.get(
    'PATCH /api/oe-panel/emails/templates/:id'
  );
  let result;

  await handler(
    {
      id: 'email-update-test',
      params: { id: current._id },
      body: { ...createRequestBody(), name: 'Updated Verification Email' }
    },
    {
      apiSuccess(payload) {
        result = payload;
      }
    }
  );

  assert.deepEqual(updateQuery, {
    _id: current._id,
    'system.archivedAt': null
  });
  assert.equal(updateOperation.$inc, undefined);
  assert.equal(updateOperation.$set.status, undefined);
  assert.equal(result.data.template.name, 'Updated Verification Email');
  assert.equal(result.data.template.status, 'published');
  assert.equal(result.data.template.version, undefined);
  assert.equal(result.data.template.publishedVersion, undefined);
});

test('duplicating a published email template creates a clean draft', async () => {
  const source = {
    _id: 'template-published',
    ...createRequestBody(),
    key: 'verify-email',
    name: 'Verification Email',
    automationTriggers: ['email-verification'],
    status: 'published',
    publishedSnapshot: { html: '<p>Published</p>' },
    system: { publishedAt: new Date('2026-07-01T10:00:00.000Z') }
  };
  let createdPayload;
  const context = createRouteContext({
    EmailTemplate: {
      STATUSES: ['draft', 'published', 'archived'],
      findOne() {
        return {
          async lean() {
            return source;
          }
        };
      },
      async create(payload) {
        createdPayload = payload;
        return { _id: 'template-copy', ...payload };
      }
    }
  });
  registerOePanelEmailRoutes(context);
  const handler = context.handlers.get(
    'POST /api/oe-panel/emails/templates/:id/duplicate'
  );
  let result;
  let responseStatus;

  await handler(
    {
      id: 'email-duplicate-test',
      params: { id: source._id },
      body: {}
    },
    {
      apiSuccess(payload, status) {
        result = payload;
        responseStatus = status;
      }
    }
  );

  assert.equal(responseStatus, 201);
  assert.equal(createdPayload.name, 'Verification Email Copy');
  assert.equal(createdPayload.status, 'draft');
  assert.deepEqual(createdPayload.automationTriggers, ['email-verification']);
  assert.equal(createdPayload.key, undefined);
  assert.equal(createdPayload.publishedSnapshot, undefined);
  assert.equal(createdPayload.system.publishedAt, undefined);
  assert.equal(result.data.template.status, 'draft');
});

test('test send validates and remembers the administrator recipient', async () => {
  const template = {
    _id: 'template-test-send',
    ...createRequestBody(),
    status: 'draft',
    system: {}
  };
  let savedAccount = false;
  let sentMessage;
  const account = {
    _id: 'email-test-send-admin',
    admin: {},
    async save() {
      savedAccount = true;
    }
  };
  const context = createRouteContext({
    EmailTemplate: {
      STATUSES: ['draft', 'published', 'archived'],
      findOne() {
        return {
          async lean() {
            return template;
          }
        };
      }
    },
    async requireOePanelAccount() {
      return account;
    },
    async sendEmail(message) {
      sentMessage = message;
      return { skipped: false };
    }
  });
  registerOePanelEmailRoutes(context);
  const handler = context.handlers.get(
    'POST /api/oe-panel/emails/templates/:id/test-send'
  );
  let routeError;

  await handler(
    {
      id: 'email-test-send-invalid',
      params: { id: template._id },
      body: { recipient: 'not-an-email' }
    },
    {
      apiError(payload) {
        routeError = payload;
      }
    }
  );

  assert.equal(routeError.status, 400);
  assert.equal(routeError.code, 'email_template_test_recipient_invalid');
  assert.equal(sentMessage, undefined);

  let result;
  await handler(
    {
      id: 'email-test-send-valid',
      params: { id: template._id },
      body: { recipient: ' QA+Email@Example.COM ' },
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

  assert.equal(sentMessage.to, 'qa+email@example.com');
  assert.equal(account.admin.emailTemplateTestRecipient, sentMessage.to);
  assert.equal(savedAccount, true);
  assert.equal(result.data.recipient, sentMessage.to);
});

test('publish compiles and stores an immutable delivery snapshot', async () => {
  const source = createRequestBody();
  const templateDocument = {
    _id: 'template-1',
    ...source,
    status: 'draft',
    system: {},
    toObject() {
      return {
        _id: this._id,
        ...source,
        status: this.status,
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
      body: {},
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
  assert.match(templateDocument.publishedSnapshot.html, /<!doctype html>/i);
  assert.equal(result.data.template.status, 'published');
});
