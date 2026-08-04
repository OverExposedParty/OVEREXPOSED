const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const { JSDOM } = require('jsdom');

const sectionsDirectory = path.join(
  __dirname,
  '../../public/scripts/oe-panel/sections'
);
const oePanelDirectory = path.join(__dirname, '../../public/scripts/oe-panel');
const hydratorFiles = [
  'section-hydrator/oe-panel-section-hydrator-catalog.js',
  'section-hydrator/oe-panel-section-hydrator-operations.js',
  'section-hydrator/oe-panel-section-hydrator-insights/emails.js',
  'section-hydrator/oe-panel-section-hydrator-insights/social.js',
  'section-hydrator/oe-panel-section-hydrator-insights/analytics.js',
  'section-hydrator/oe-panel-section-hydrator-insights/dashboard.js',
  'section-hydrator/oe-panel-section-hydrator-insights/overexposure.js',
  'section-hydrator/oe-panel-section-hydrator-insights/party-games.js',
  'section-hydrator/oe-panel-section-hydrator-insights.js',
  'section-hydrator/oe-panel-section-hydrator.js'
];
const sectionFiles = [
  'dashboard.js',
  'shop.js',
  'overexposure.js',
  'social-media.js',
  'emails.js',
  'party-games.js',
  'customisation.js',
  'achievements.js',
  'olings.js',
  'users.js',
  'moderation.js',
  'analytics.js',
  'system.js',
  'admin-logs.js'
];
const sectionNames = [
  'Dashboard',
  'Shop',
  'OverExposure',
  'Social Media',
  'Emails',
  'Party Games',
  'OE Customisation',
  'Achievements',
  'oLings',
  'Users',
  'Moderation',
  'Analytics',
  'System',
  'Admin Logs'
];

test('OE panel section modules build a complete registry in any load order', () => {
  const context = { window: {} };

  [...sectionFiles].reverse().forEach((fileName) => {
    vm.runInNewContext(
      fs.readFileSync(path.join(sectionsDirectory, fileName), 'utf8'),
      context,
      { filename: fileName }
    );
  });

  assert.deepEqual(
    Object.keys(context.window.OE_PANEL_SECTIONS),
    [...sectionNames].reverse()
  );
  assert.deepEqual(
    Object.keys(context.window.OE_PANEL_SECTIONS).sort(),
    [...sectionNames].sort()
  );

  const gridIds = Object.values(context.window.OE_PANEL_SECTIONS)
    .flat()
    .map((grid) => grid.id)
    .filter(Boolean);
  assert.equal(new Set(gridIds).size, gridIds.length);

  const partyGames = context.window.OE_PANEL_SECTIONS['Party Games'];
  const pieChart = partyGames.find((grid) => grid.id === 'party-games-grid-3');
  const quickActions = partyGames.find(
    (grid) => grid.id === 'party-games-grid-4'
  );
  const roomActivity = quickActions.actions.find(
    (action) => action.value === 'room-activity'
  );
  const table = partyGames.find((grid) => grid.id === 'party-games-grid-1');
  const roles = table.tableSeries.find((series) => series.value === 'roles');
  const exportRoles = quickActions.actions.find(
    (action) => action.value === 'export-roles'
  );

  assert.equal(pieChart.type, 'pieChart');
  assert.equal(
    pieChart.endpoint,
    '/api/oe-panel/party-games/gamemode-distribution'
  );
  assert.equal(pieChart.targetSeries, 'rooms');
  assert.equal(quickActions.visibleActions, 8);
  assert.equal(roomActivity.view, 'embedded-widget');
  assert.equal(roomActivity.widget.type, 'calendar');
  assert.equal(roles.dataSource, 'partyRoles');
  assert.equal(roles.saveEndpoint, '/api/oe-panel/game-roles/{key}');
  assert.ok(
    roles.expandedFields.some(
      (field) => field.key === 'description' && field.editable
    )
  );
  assert.equal(exportRoles.endpoint, '/api/oe-panel/game-roles/export');

  const analytics = context.window.OE_PANEL_SECTIONS.Analytics;
  const analyticsActions = analytics.find(
    (grid) => grid.id === 'analytics-grid-4'
  );
  const analyticsStatus = analyticsActions.actions.find(
    (action) => action.value === 'analytics-status'
  );

  assert.equal(analyticsActions.type, 'actions');
  assert.equal(analyticsActions.title, 'Analytics Actions');
  assert.equal(analyticsStatus.alertSource, 'alerts');
  assert.equal(analyticsStatus.countKey, 'analyticsStatusItems');
  assert.deepEqual(
    Array.from(analyticsActions.actions, (action) => action.label),
    [
      'Analytics Status',
      'Authentication',
      'Notification Performance',
      'Pack Selection',
      'Rule Usage',
      'Question Engagement'
    ]
  );
  analyticsActions.actions.slice(1).forEach((action) => {
    assert.equal(action.view, 'embedded-widget');
    assert.equal(action.widget.type, 'table');
  });

  const emails = context.window.OE_PANEL_SECTIONS.Emails;
  assert.deepEqual(
    Array.from(emails, (grid) => grid.type),
    ['stats', 'table', 'timeSeries', 'actions']
  );
  assert.equal(emails[1].title, 'Email Activity');
  assert.equal(emails[2].title, 'Performance Trends');
  const templateAction = emails[3].actions.find(
    (action) => action.value === 'templates'
  );
  assert.deepEqual(
    Array.from(templateAction.actions, (action) => action.label),
    ['Create', 'Manage']
  );
  assert.equal(templateAction.actions[0].value, 'template-create');
  assert.equal(
    templateAction.actions[0].event,
    'oe-panel-email-template-editor-request'
  );
  assert.equal(templateAction.actions[1].targetGridId, 'emails-grid-2');
  assert.equal(templateAction.actions[1].series, 'templates');
  const templateSeries = emails[1].tableSeries.find(
    (series) => series.value === 'templates'
  );
  assert.equal(templateSeries.dataSource, 'emailTemplates');
  assert.equal(templateSeries.rowKey, 'templateId');
  assert.equal(templateSeries.rowActions[0].action, 'open-email-template');
  assert.equal(templateSeries.rowActions[1].label, 'Delete');
  assert.equal(templateSeries.rowActions[1].disabledWhen.key, 'inUse');
  assert.equal(templateSeries.rowActions[1].disabledWhen.equals, true);
  assert.equal(templateSeries.rowActions[1].disabledTitleKey, 'usageTooltip');
  assert.equal(
    templateSeries.deleteEndpoint,
    '/api/oe-panel/emails/templates/{templateId}'
  );
  assert.equal(
    templateSeries.deleteConfirmMessage,
    'Are you sure you want to delete this email template?'
  );
  const automationAction = emails[3].actions.find(
    (action) => action.value === 'automations'
  );
  assert.deepEqual(
    Array.from(automationAction.actions, (action) => action.label),
    ['Manage Automations', 'Create Automation']
  );
  assert.equal(automationAction.actions[0].series, 'automations');
  assert.equal(
    automationAction.actions[1].form.submitEndpoint,
    '/api/oe-panel/emails/automations'
  );
  const automationTemplateField = automationAction.actions[1].form.fields.find(
    (field) => field.name === 'templateKey'
  );
  assert.equal(automationTemplateField.label, 'Email Template');
  assert.equal(automationTemplateField.dependsOn, 'trigger');
  assert.equal(
    automationTemplateField.optionsEndpoint,
    '/api/oe-panel/emails/automation-template-options'
  );
  const automationSeries = emails[1].tableSeries.find(
    (series) => series.value === 'automations'
  );
  assert.equal(automationSeries.dataSource, 'emailAutomations');
  assert.equal(automationSeries.rowKey, 'automationId');
  assert.deepEqual(
    Array.from(automationSeries.rowActions, ({ label, action }) => ({
      label,
      action
    })),
    [
      { label: 'Edit', action: 'edit-email-automation' },
      { label: 'Delete', action: 'delete' }
    ]
  );
  assert.equal(
    automationSeries.rowActions[1].disabledWhen.key,
    'systemManagedValue'
  );
  assert.equal(automationSeries.rowActions[1].disabledWhen.equals, true);
  assert.equal(
    automationSeries.rowActions[1].disabledTitle,
    'System-managed automations cannot be deleted.'
  );
  assert.equal(
    automationSeries.deleteEndpoint,
    '/api/oe-panel/emails/automations/{automationId}'
  );
  assert.equal(
    automationSeries.deleteConfirmMessage,
    'Are you sure you want to delete this automation?'
  );
  const audienceAction = emails[3].actions.find(
    (action) => action.value === 'audiences'
  );
  assert.deepEqual(
    Array.from(audienceAction.actions, (action) => action.label),
    [
      'Manage Audiences',
      'Create Audience',
      'Suppression List',
      'Add Suppression'
    ]
  );
  assert.equal(
    audienceAction.actions[1].event,
    'oe-panel-email-audience-editor-request'
  );
  assert.equal(audienceAction.actions[2].series, 'suppressions');
  assert.equal(
    audienceAction.actions[3].form.submitEndpoint,
    '/api/oe-panel/emails/suppressions'
  );
  const audienceSeries = emails[1].tableSeries.find(
    (series) => series.value === 'audiences'
  );
  assert.equal(audienceSeries.dataSource, 'emailAudiences');
  assert.deepEqual(
    Array.from(audienceSeries.rowActions, ({ label, action }) => ({
      label,
      action
    })),
    [
      { label: 'Preview', action: 'preview-email-audience' },
      { label: 'Edit', action: 'edit-email-audience' },
      { label: 'Duplicate', action: 'duplicate-email-audience' },
      { label: 'Delete', action: 'delete' }
    ]
  );
  assert.equal(
    audienceSeries.deleteEndpoint,
    '/api/oe-panel/emails/audiences/{audienceId}'
  );
  const suppressionSeries = emails[1].tableSeries.find(
    (series) => series.value === 'suppressions'
  );
  assert.equal(suppressionSeries.dataSource, 'emailSuppressions');
  assert.equal(suppressionSeries.rowActions[0].label, 'Remove');
});

test('email automation row edit opens the populated automation form', () => {
  const dom = new JSDOM(
    '<!doctype html><main data-oe-panel-grid="emails-grid-4"><div>Actions</div></main>',
    { runScripts: 'dangerously' }
  );
  const { window } = dom;
  let formConfig;

  try {
    window.OE_PANEL_WIDGET_HELPERS = {
      renderFormWidget(container, config) {
        formConfig = config;
        container.textContent = config.title;
      }
    };
    window.eval(
      fs.readFileSync(path.join(sectionsDirectory, 'emails.js'), 'utf8')
    );
    window.dispatchEvent(
      new window.CustomEvent('oe-panel-table-row-action', {
        detail: {
          action: 'edit-email-automation',
          row: {
            automationId: 'automation-reset',
            automation: 'Reset Password',
            triggerKey: 'password-reset-request',
            templateKey: 'password-reset',
            statusKey: 'active',
            systemManagedValue: false
          }
        }
      })
    );

    assert.equal(formConfig.title, 'Edit Automation');
    assert.equal(formConfig.method, 'PATCH');
    assert.equal(
      formConfig.submitEndpoint,
      '/api/oe-panel/emails/automations/automation-reset'
    );
    assert.deepEqual(
      Object.fromEntries(
        formConfig.fields.map((field) => [field.name, field.value])
      ),
      {
        name: 'Reset Password',
        trigger: 'password-reset-request',
        templateKey: 'password-reset',
        status: 'active'
      }
    );
    const systemConfig = window.OE_PANEL_EMAIL_AUTOMATION_FORM.createConfig({
      mode: 'edit',
      row: {
        automationId: 'system-email-verification',
        automation: 'Verify Email',
        triggerKey: 'email-verification',
        templateKey: 'verify-email',
        statusKey: 'active',
        systemManagedValue: true
      }
    });
    assert.deepEqual(
      Array.from(
        systemConfig.fields.find((field) => field.name === 'trigger').options,
        ({ value }) => value
      ),
      ['email-verification']
    );
  } finally {
    dom.window.close();
  }
});

test('email template data maps active automation usage for delete tooltips', async () => {
  const dom = new JSDOM('<!doctype html>', {
    runScripts: 'dangerously',
    url: 'https://overexposed.test/'
  });
  const { window } = dom;

  try {
    window.fetch = async () => ({
      ok: true,
      async json() {
        return {
          success: true,
          data: {
            templates: [
              {
                id: 'template-reset',
                key: 'password-reset',
                name: 'Password Reset',
                status: 'published',
                activeUses: [
                  {
                    name: 'Reset Password',
                    trigger: 'password-reset-request',
                    triggerLabel: 'Password reset request'
                  }
                ]
              }
            ]
          }
        };
      }
    });
    window.eval(
      fs.readFileSync(
        path.join(oePanelDirectory, 'core/oe-panel-data.js'),
        'utf8'
      )
    );
    const result = await window.OE_PANEL_DATA.fetchEmailTemplatesData({
      force: true
    });

    assert.equal(result.templates[0].inUse, true);
    assert.equal(
      result.templates[0].activeUsage,
      'Reset Password (Password reset request)'
    );
    assert.equal(
      result.templates[0].usageTooltip,
      'In use by: Reset Password (Password reset request)'
    );
  } finally {
    dom.window.close();
  }
});

test('OE panel loads section definitions before its runtime', () => {
  const page = fs.readFileSync(
    path.join(__dirname, '../../public/pages/oe-panel/oe-panel.html'),
    'utf8'
  );
  const runtimeIndex = page.indexOf("'/scripts/oe-panel/core/oe-panel.js'");
  const hydratorScript =
    "'/scripts/oe-panel/section-hydrator/oe-panel-section-hydrator.js'";
  const hydratorIndex = page.indexOf(hydratorScript);

  assert.ok(runtimeIndex > -1);
  assert.ok(hydratorIndex > -1);
  assert.ok(hydratorIndex < runtimeIndex);
  hydratorFiles.slice(0, -1).forEach((fileName) => {
    const scriptIndex = page.indexOf(`'/scripts/oe-panel/${fileName}'`);
    assert.ok(scriptIndex > -1, `${fileName} should be configured`);
    assert.ok(scriptIndex < hydratorIndex, `${fileName} should load first`);
  });
  sectionFiles.forEach((fileName) => {
    const script = `'/scripts/oe-panel/sections/${fileName}'`;
    const scriptIndex = page.indexOf(script);
    assert.ok(scriptIndex > -1, `${fileName} should be configured`);
    assert.ok(scriptIndex < runtimeIndex, `${fileName} should load first`);
  });
  assert.match(page.slice(runtimeIndex, runtimeIndex + 130), /zIndex:\s*2/);
});

test('OE panel section hydrator registers before the runtime composes it', () => {
  const context = { window: {} };
  const runtimePath = path.join(oePanelDirectory, 'core/oe-panel.js');

  hydratorFiles.forEach((fileName) => {
    vm.runInNewContext(
      fs.readFileSync(path.join(oePanelDirectory, fileName), 'utf8'),
      context,
      { filename: fileName }
    );
  });

  assert.equal(typeof context.window.createOePanelSectionHydrator, 'function');
  assert.match(
    fs.readFileSync(runtimePath, 'utf8'),
    /window\.createOePanelSectionHydrator/
  );
});

test('Emails hydrator forces a fresh template request', async () => {
  const context = { window: {} };
  const fileName =
    'section-hydrator/oe-panel-section-hydrator-insights/emails.js';
  let fetchOptions;
  let automationFetchOptions;
  let audienceFetchOptions;
  let suppressionFetchOptions;
  let performanceFetchOptions;
  vm.runInNewContext(
    fs.readFileSync(path.join(oePanelDirectory, fileName), 'utf8'),
    context,
    { filename: fileName }
  );
  const hydrator = context.window.createOePanelEmailInsightsHydrator({
    panelData: {
      async fetchEmailTemplatesData(options) {
        fetchOptions = options;
        return { templates: [{ template: 'Confirmation' }] };
      },
      async fetchEmailAutomationsData(options) {
        automationFetchOptions = options;
        return { automations: [{ automation: 'Verify Email' }] };
      },
      async fetchEmailAudiencesData(options) {
        audienceFetchOptions = options;
        return { audiences: [{ audience: 'Verified Players' }] };
      },
      async fetchEmailSuppressionsData(options) {
        suppressionFetchOptions = options;
        return { suppressions: [{ email: 'blocked@example.com' }] };
      },
      async fetchEmailPerformanceData(options) {
        performanceFetchOptions = options;
        return {
          stats: {
            sent: { value: '8', detail: 'Last 30 days' }
          },
          trends: { labels: ['1 Aug'], series: { sent: [8] } },
          failures: [{ email: 'failed@example.com', status: 'Failed' }]
        };
      }
    }
  });
  const nextConfig = [
    {
      id: 'emails-grid-2',
      tableSeries: [
        { value: 'templates', rows: [] },
        { value: 'automations', rows: [] },
        { value: 'audiences', rows: [] },
        { value: 'suppressions', rows: [] },
        { value: 'failures', rows: [] }
      ]
    },
    {
      id: 'emails-grid-1',
      stats: [{ key: 'sent', value: '-' }]
    },
    {
      id: 'emails-grid-3',
      labels: [],
      series: [{ key: 'sent', values: [] }]
    }
  ];

  assert.equal(await hydrator.hydrateSection('Emails', nextConfig), true);
  assert.equal(fetchOptions.force, true);
  assert.equal(automationFetchOptions.force, true);
  assert.equal(audienceFetchOptions.force, true);
  assert.equal(suppressionFetchOptions.force, true);
  assert.equal(performanceFetchOptions.force, true);
  assert.equal(nextConfig[0].tableSeries[0].rows[0].template, 'Confirmation');
  assert.equal(nextConfig[0].tableSeries[1].rows[0].automation, 'Verify Email');
  assert.equal(
    nextConfig[0].tableSeries[2].rows[0].audience,
    'Verified Players'
  );
  assert.equal(
    nextConfig[0].tableSeries[3].rows[0].email,
    'blocked@example.com'
  );
  assert.equal(nextConfig[0].tableSeries[4].rows[0].status, 'Failed');
  assert.equal(nextConfig[1].stats[0].value, '8');
  assert.deepEqual(nextConfig[2].labels, ['1 Aug']);
  assert.deepEqual(nextConfig[2].series[0].values, [8]);
});

test('Analytics hydrator populates the status action queue and count', async () => {
  const context = { window: {} };
  const fileName =
    'section-hydrator/oe-panel-section-hydrator-insights/analytics.js';
  vm.runInNewContext(
    fs.readFileSync(path.join(oePanelDirectory, fileName), 'utf8'),
    context,
    { filename: fileName }
  );
  const alerts = [
    { title: 'Google Analytics connected', severity: 'success' },
    { title: 'Signup attribution coverage', severity: 'info' }
  ];
  const authRows = [
    {
      flow: 'Sign Up',
      entryPoint: 'Account Notification',
      provider: 'Email',
      attempts: 8,
      completed: 4,
      completionRate: '50%'
    }
  ];
  const hydrator = context.window.createOePanelAnalyticsInsightsHydrator({
    panelData: {
      async fetchAnalyticsData() {
        return {
          stats: {},
          ga4: {},
          alerts,
          productAnalytics: { auth: authRows }
        };
      },
      async fetchDashboardActivityData() {
        return {};
      }
    }
  });
  const nextConfig = [
    {
      id: 'analytics-grid-4',
      alerts: [],
      alertCounts: { existing: 1 },
      actions: [
        { value: 'analytics-status' },
        {
          value: 'authentication-performance',
          widget: { type: 'table', rows: [] }
        },
        {
          value: 'notification-performance',
          widget: { type: 'table', rows: [{ notification: 'old' }] }
        }
      ]
    }
  ];

  assert.equal(await hydrator.hydrateSection('Analytics', nextConfig), true);
  assert.equal(nextConfig[0].alerts, alerts);
  assert.equal(nextConfig[0].alertCounts.existing, 1);
  assert.equal(nextConfig[0].alertCounts.analyticsStatusItems, 2);
  assert.equal(nextConfig[0].actions[1].widget.rows, authRows);
  assert.equal(nextConfig[0].actions[2].widget.rows.length, 0);
});

test('OE panel runtime initializes with the extracted section hydrator', async () => {
  const dom = new JSDOM(
    `<!doctype html>
      <button data-oe-panel-section="Example"></button>
      <h1 id="oe-panel-content-title"></h1>
      <main id="oe-panel-content-grid"></main>`,
    { runScripts: 'dangerously' }
  );
  const { window } = dom;

  window.OE_PANEL_SECTIONS = { Example: [] };
  window.OE_PANEL_WIDGETS = {};
  window.OE_PANEL_DATA = { clear() {} };
  window.OE_PANEL_GRID = {
    createPanelGrid() {
      return {
        createPanelContainer() {
          return window.document.createElement('section');
        },
        setExpandedContainer() {}
      };
    }
  };
  window.OE_PANEL_NAVIGATION = {
    updateActiveButton() {},
    bindSidebarNavigation() {},
    bindSectionLinkRequests() {}
  };

  try {
    hydratorFiles.forEach((fileName) => {
      window.eval(
        fs.readFileSync(path.join(oePanelDirectory, fileName), 'utf8')
      );
    });
    window.eval(
      fs.readFileSync(path.join(oePanelDirectory, 'core/oe-panel.js'), 'utf8')
    );
    await Promise.resolve();

    assert.equal(
      window.document.getElementById('oe-panel-content-title').textContent,
      'Example'
    );
  } finally {
    dom.window.close();
  }
});
