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
  assert.equal(
    templateSeries.rowActions[0].action,
    'open-email-template'
  );
  assert.equal(
    templateSeries.deleteEndpoint,
    '/api/oe-panel/emails/templates/{templateId}'
  );
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
