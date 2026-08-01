const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const { JSDOM } = require('jsdom');

const widgetsDirectory = path.join(
  __dirname,
  '..',
  '..',
  'public',
  'scripts',
  'oe-panel'
);
const pagePath = path.join(
  __dirname,
  '..',
  '..',
  'public',
  'pages',
  'oe-panel',
  'oe-panel.html'
);
const widgetModules = [
  ['widgets/oe-panel-widget-helpers.js', 'createOePanelWidgetHelpers'],
  ['widgets/oe-panel-widget-form.js', 'createOePanelFormWidget'],
  ['widgets/oe-panel-widget-basic.js', 'createOePanelBasicWidgets'],
  ['widgets/oe-panel-widget-data.js', 'createOePanelDataWidgets'],
  ['widgets/oe-panel-widget-time-series.js', 'createOePanelTimeSeriesWidget'],
  ['widgets/oe-panel-widget-pie-chart.js', 'createOePanelPieChartWidget'],
  ['widgets/oe-panel-widget-alerts.js', 'createOePanelAlertWidgets']
];
const actionModules = [
  ['actions/oe-panel-actions-core.js', 'createOePanelActionCore'],
  ['actions/oe-panel-actions-alerts.js', 'createOePanelActionAlerts'],
  ['actions/oe-panel-actions-queues.js', 'createOePanelActionQueues'],
  ['actions/oe-panel-actions-operations.js', 'createOePanelActionOperations'],
  [
    'actions/oe-panel-actions-embedded-widget.js',
    'createOePanelActionEmbeddedWidget'
  ],
  ['actions/oe-panel-actions-form-fields.js', 'createOePanelActionFormFields'],
  ['actions/oe-panel-actions-admin-forms.js', 'createOePanelActionAdminForms'],
  ['actions/oe-panel-actions-pack-forms.js', 'createOePanelActionPackForms'],
  ['actions/oe-panel-actions-submenu.js', 'createOePanelActionSubmenu']
];
const galleryDatabaseModules = [
  [
    'oe-panel-gallery-database-widget/gallery-renderer.js',
    'createOePanelGalleryWidgetRenderer'
  ],
  [
    'oe-panel-gallery-database-widget/database-button-list.js',
    'createOePanelDatabaseButtonListWidgetRenderer'
  ]
];

test('OE panel widget modules register their factories', () => {
  widgetModules.forEach(([filename, factoryName]) => {
    const context = { window: {} };
    vm.runInNewContext(
      fs.readFileSync(path.join(widgetsDirectory, filename), 'utf8'),
      context,
      { filename }
    );

    assert.equal(typeof context.window[factoryName], 'function');
  });
});

test('OE panel widget modules load before the registry', () => {
  const page = fs.readFileSync(pagePath, 'utf8');
  const registryIndex = page.indexOf(
    "'/scripts/oe-panel/widgets/oe-panel-widgets.js'"
  );

  assert.ok(registryIndex > -1);
  widgetModules.forEach(([filename]) => {
    const moduleIndex = page.indexOf(`'/scripts/oe-panel/${filename}'`);
    assert.ok(moduleIndex > -1, `${filename} should be configured`);
    assert.ok(moduleIndex < registryIndex, `${filename} should load first`);
  });
});

test('OE panel gallery database widget modules register and load before the facade', () => {
  const page = fs.readFileSync(pagePath, 'utf8');
  const facadeIndex = page.indexOf(
    "'/scripts/oe-panel/oe-panel-gallery-database-widget/oe-panel-gallery-database-widget.js'"
  );

  assert.ok(facadeIndex > -1);
  galleryDatabaseModules.forEach(([filename, factoryName]) => {
    const context = { window: {} };
    vm.runInNewContext(
      fs.readFileSync(path.join(widgetsDirectory, filename), 'utf8'),
      context,
      { filename }
    );

    assert.equal(typeof context.window[factoryName], 'function');
    const moduleIndex = page.indexOf(`'/scripts/oe-panel/${filename}'`);
    assert.ok(moduleIndex > -1, `${filename} should be configured`);
    assert.ok(moduleIndex < facadeIndex, `${filename} should load first`);
  });
});

test('OE panel action modules register and load before their renderer', () => {
  const page = fs.readFileSync(pagePath, 'utf8');
  const rendererIndex = page.indexOf(
    "'/scripts/oe-panel/actions/oe-panel-actions-widget.js'"
  );

  assert.ok(rendererIndex > -1);
  actionModules.forEach(([filename, factoryName]) => {
    const context = { window: {} };
    vm.runInNewContext(
      fs.readFileSync(path.join(widgetsDirectory, filename), 'utf8'),
      context,
      { filename }
    );

    assert.equal(typeof context.window[factoryName], 'function');
    const moduleIndex = page.indexOf(`'/scripts/oe-panel/${filename}'`);
    assert.ok(moduleIndex > -1, `${filename} should be configured`);
    assert.ok(moduleIndex < rendererIndex, `${filename} should load first`);
  });
});

test('OE panel widget registry renders through extracted modules', () => {
  const dom = new JSDOM('<!doctype html><main id="widget"></main>', {
    runScripts: 'dangerously'
  });
  const { window } = dom;

  try {
    widgetModules.forEach(([filename]) => {
      window.eval(
        fs.readFileSync(path.join(widgetsDirectory, filename), 'utf8')
      );
    });
    window.eval(
      fs.readFileSync(
        path.join(widgetsDirectory, 'widgets/oe-panel-widgets.js'),
        'utf8'
      )
    );

    const container = window.document.getElementById('widget');
    window.OE_PANEL_WIDGETS.render(container, {
      type: 'empty',
      id: 'empty-widget'
    });

    assert.match(container.textContent, /empty-widget/);
    assert.equal(
      typeof window.OE_PANEL_WIDGET_HELPERS.renderFormWidget,
      'function'
    );
  } finally {
    dom.window.close();
  }
});

test('OE panel time series widget renders legends and an honest empty state', () => {
  const dom = new JSDOM('<!doctype html><main id="widget"></main>', {
    runScripts: 'dangerously'
  });
  const { window } = dom;

  try {
    widgetModules.forEach(([filename]) => {
      window.eval(
        fs.readFileSync(path.join(widgetsDirectory, filename), 'utf8')
      );
    });
    window.eval(
      fs.readFileSync(
        path.join(widgetsDirectory, 'widgets/oe-panel-widgets.js'),
        'utf8'
      )
    );

    const container = window.document.getElementById('widget');
    window.OE_PANEL_WIDGETS.render(container, {
      type: 'timeSeries',
      title: 'Performance Trends',
      periodLabel: 'Last 30 days',
      emptyMessage: 'Tracking is not connected.',
      labels: ['Day 1', 'Day 30'],
      series: [
        { key: 'sent', label: 'Sent', colour: '#66ccff', values: [] },
        { key: 'clicked', label: 'Clicks', colour: '#e88bae', values: [] }
      ]
    });

    assert.match(container.textContent, /Performance Trends/);
    assert.match(container.textContent, /Last 30 days/);
    assert.match(container.textContent, /Tracking is not connected/);
    assert.equal(
      container.querySelectorAll('.oe-panel-time-series-legend-item').length,
      2
    );

    window.OE_PANEL_WIDGETS.render(container, {
      type: 'timeSeries',
      title: 'Performance Trends',
      labels: ['Day 1', 'Day 2', 'Day 3'],
      series: [
        { key: 'sent', label: 'Sent', colour: '#66ccff', values: [2, 5, 8] },
        {
          key: 'clicked',
          label: 'Clicks',
          colour: '#e88bae',
          values: [1, 3, 4]
        }
      ]
    });

    assert.equal(
      container.querySelectorAll('.oe-panel-time-series-line').length,
      2
    );
    container.querySelector('.oe-panel-time-series-legend-item').click();
    assert.equal(
      container.querySelectorAll('.oe-panel-time-series-line').length,
      1
    );
  } finally {
    dom.window.close();
  }
});

test('OE panel gallery database facade composes extracted renderers', () => {
  const dom = new JSDOM('<!doctype html><main id="widget"></main>', {
    runScripts: 'dangerously',
    url: 'https://overexposed.test/'
  });
  const { window } = dom;

  try {
    widgetModules.forEach(([filename]) => {
      window.eval(
        fs.readFileSync(path.join(widgetsDirectory, filename), 'utf8')
      );
    });
    window.eval(
      fs.readFileSync(
        path.join(widgetsDirectory, 'widgets/oe-panel-widgets.js'),
        'utf8'
      )
    );
    galleryDatabaseModules.forEach(([filename]) => {
      window.eval(
        fs.readFileSync(path.join(widgetsDirectory, filename), 'utf8')
      );
    });
    window.eval(
      fs.readFileSync(
        path.join(
          widgetsDirectory,
          'oe-panel-gallery-database-widget/oe-panel-gallery-database-widget.js'
        ),
        'utf8'
      )
    );

    assert.equal(typeof window.OE_PANEL_GALLERY_WIDGET_RENDERER, 'function');
    assert.equal(
      typeof window.OE_PANEL_DATABASE_BUTTON_LIST_WIDGET_RENDERER,
      'function'
    );

    const container = window.document.getElementById('widget');
    window.OE_PANEL_WIDGETS.render(container, {
      type: 'gallery',
      title: 'Gallery',
      items: [
        {
          key: 'alpha',
          name: 'Alpha',
          preview: '/images/example.png',
          status: 'Ready'
        }
      ]
    });
    assert.match(container.textContent, /Alpha/);

    window.OE_PANEL_WIDGETS.render(container, {
      type: 'databaseButtonList',
      title: 'Databases',
      buttons: [{ label: 'Accounts', value: 'accounts', status: 'ready' }]
    });
    assert.match(container.textContent, /Accounts/);
  } finally {
    dom.window.close();
  }
});

test('OE panel actions renderer composes its extracted modules', () => {
  const dom = new JSDOM('<!doctype html><main id="widget"></main>', {
    runScripts: 'dangerously'
  });
  const { window } = dom;

  try {
    widgetModules.forEach(([filename]) => {
      window.eval(
        fs.readFileSync(path.join(widgetsDirectory, filename), 'utf8')
      );
    });
    window.eval(
      fs.readFileSync(
        path.join(widgetsDirectory, 'widgets/oe-panel-widgets.js'),
        'utf8'
      )
    );
    actionModules.forEach(([filename]) => {
      window.eval(
        fs.readFileSync(path.join(widgetsDirectory, filename), 'utf8')
      );
    });
    window.eval(
      fs.readFileSync(
        path.join(widgetsDirectory, 'actions/oe-panel-actions-widget.js'),
        'utf8'
      )
    );

    const container = window.document.getElementById('widget');
    window.OE_PANEL_WIDGETS.render(container, {
      type: 'actions',
      title: 'Quick actions',
      actions: [{ label: 'Review items', value: 'review' }]
    });

    assert.match(container.textContent, /Quick actions/);
    assert.match(container.textContent, /Review items/);
  } finally {
    dom.window.close();
  }
});

test('OE panel pie chart renders API elements and filters the rooms table', async () => {
  const dom = new JSDOM('<!doctype html><main id="widget"></main>', {
    runScripts: 'dangerously',
    url: 'https://overexposed.test/'
  });
  const { window } = dom;
  let tableFilter = null;

  try {
    window.fetch = async () => ({
      ok: true,
      async json() {
        return {
          success: true,
          data: {
            total: 20,
            availableGamemodes: [
              { key: 'truth-or-dare', label: 'Truth or Dare' },
              { key: 'mafia', label: 'Mafia' }
            ],
            elements: [
              {
                key: 'truth-or-dare',
                label: 'Truth or Dare',
                value: 12,
                percentage: 60,
                colour: '#123456'
              },
              {
                key: 'mafia',
                label: 'Mafia',
                value: 8,
                percentage: 40,
                colour: '#654321'
              }
            ]
          }
        };
      }
    });
    window.addEventListener('oe-panel-table-search-request', (event) => {
      tableFilter = event.detail;
    });
    widgetModules.forEach(([filename]) => {
      window.eval(
        fs.readFileSync(path.join(widgetsDirectory, filename), 'utf8')
      );
    });
    window.eval(
      fs.readFileSync(
        path.join(widgetsDirectory, 'widgets/oe-panel-widgets.js'),
        'utf8'
      )
    );

    const container = window.document.getElementById('widget');
    window.OE_PANEL_WIDGETS.render(container, {
      type: 'pieChart',
      title: 'Gamemodes Played',
      endpoint: '/api/oe-panel/party-games/gamemode-distribution',
      targetGridId: 'party-games-grid-1',
      targetSeries: 'rooms',
      targetFilterField: 'gamemode'
    });
    await new Promise((resolve) => window.setTimeout(resolve, 0));

    assert.equal(container.querySelectorAll('.oe-panel-pie-slice').length, 2);
    assert.match(container.textContent, /20 games/);
    assert.match(container.textContent, /Truth or Dare/);
    assert.equal(container.querySelector('.oe-panel-pie-legend-swatch'), null);
    assert.equal(
      container
        .querySelector('.oe-panel-pie-legend')
        .style.getPropertyValue('--oe-panel-pie-legend-count'),
      '2'
    );
    assert.equal(
      container.querySelector('.oe-panel-pie-legend-item').style
        .backgroundColor,
      'rgb(18, 52, 86)'
    );

    container.querySelector('.oe-panel-pie-legend-item').click();
    assert.equal(tableFilter.gridId, 'party-games-grid-1');
    assert.equal(tableFilter.series, 'rooms');
    assert.equal(tableFilter.query, '[gamemode:Truth or Dare]');
  } finally {
    dom.window.close();
  }
});

test('OE panel actions can open and close an embedded calendar widget', () => {
  const dom = new JSDOM('<!doctype html><main id="widget"></main>', {
    runScripts: 'dangerously'
  });
  const { window } = dom;

  try {
    widgetModules.forEach(([filename]) => {
      window.eval(
        fs.readFileSync(path.join(widgetsDirectory, filename), 'utf8')
      );
    });
    window.eval(
      fs.readFileSync(
        path.join(widgetsDirectory, 'widgets/oe-panel-widgets.js'),
        'utf8'
      )
    );
    actionModules.forEach(([filename]) => {
      window.eval(
        fs.readFileSync(path.join(widgetsDirectory, filename), 'utf8')
      );
    });
    window.eval(
      fs.readFileSync(
        path.join(widgetsDirectory, 'actions/oe-panel-actions-widget.js'),
        'utf8'
      )
    );

    const container = window.document.getElementById('widget');
    window.OE_PANEL_WIDGETS.render(container, {
      type: 'actions',
      title: 'Quick Actions',
      actions: [
        {
          label: 'Room Activity',
          value: 'room-activity',
          view: 'embedded-widget',
          widget: {
            type: 'calendar',
            title: 'Rooms by day',
            counts: { '2026-07-30': 4 }
          }
        }
      ]
    });

    container.querySelector('.oe-panel-action-button').click();
    assert.ok(container.querySelector('.oe-panel-widget-calendar'));
    assert.match(container.textContent, /Rooms by day/);

    container.querySelector('.oe-panel-alert-detail-back').click();
    assert.match(container.textContent, /Quick Actions/);
    assert.match(container.textContent, /Room Activity/);
  } finally {
    dom.window.close();
  }
});
