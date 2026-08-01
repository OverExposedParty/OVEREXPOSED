const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const { JSDOM } = require('jsdom');

const scriptsDirectory = path.join(__dirname, '../../public/scripts/oe-panel');
const supportScripts = [
  ['oe-panel-table-widget/search-tools.js', 'createOePanelTableSearchTools'],
  ['oe-panel-table-widget/expanded-row.js', 'createOePanelTableExpandedRow'],
  [
    'oe-panel-table-widget/series-renderer.js',
    'createOePanelTableSeriesRenderer'
  ]
];

test('OE panel table widget support modules load before the facade', () => {
  const page = fs.readFileSync(
    path.join(__dirname, '../../public/pages/oe-panel/oe-panel.html'),
    'utf8'
  );
  const facadeIndex = page.indexOf(
    "'/scripts/oe-panel/oe-panel-table-widget/oe-panel-table-widget.js'"
  );

  assert.ok(facadeIndex > -1);
  supportScripts.forEach(([fileName, factoryName]) => {
    const context = { window: {} };
    vm.runInNewContext(
      fs.readFileSync(path.join(scriptsDirectory, fileName), 'utf8'),
      context,
      { filename: fileName }
    );
    assert.equal(typeof context.window[factoryName], 'function');
    assert.ok(page.indexOf(`'/scripts/oe-panel/${fileName}'`) < facadeIndex);
  });
});

test('OE panel table widget facade keeps its renderer', () => {
  const context = { window: { OE_PANEL_WIDGET_HELPERS: {} } };
  supportScripts.forEach(([fileName]) => {
    vm.runInNewContext(
      fs.readFileSync(path.join(scriptsDirectory, fileName), 'utf8'),
      context,
      { filename: fileName }
    );
  });
  vm.runInNewContext(
    fs.readFileSync(
      path.join(
        scriptsDirectory,
        'oe-panel-table-widget/oe-panel-table-widget.js'
      ),
      'utf8'
    ),
    context,
    { filename: 'oe-panel-table-widget.js' }
  );

  assert.equal(
    typeof context.window.OE_PANEL_TABLE_WIDGET_RENDERER,
    'function'
  );
});

test('OE panel table widget renders and expands a data row', () => {
  const dom = new JSDOM('<!doctype html><main id="widget"></main>', {
    runScripts: 'dangerously'
  });
  const { window } = dom;
  const syncedRows = [];

  try {
    window.eval(
      fs.readFileSync(
        path.join(scriptsDirectory, 'widgets/oe-panel-widget-helpers.js'),
        'utf8'
      )
    );
    window.OE_PANEL_WIDGET_HELPERS = window.createOePanelWidgetHelpers();
    assert.equal(
      typeof window.OE_PANEL_WIDGET_HELPERS.runSyncWarningAction,
      'function'
    );
    window.OE_PANEL_WIDGET_HELPERS.runSyncWarningAction = (row) =>
      syncedRows.push(row);
    supportScripts.forEach(([fileName]) => {
      window.eval(
        fs.readFileSync(path.join(scriptsDirectory, fileName), 'utf8')
      );
    });
    window.eval(
      fs.readFileSync(
        path.join(
          scriptsDirectory,
          'oe-panel-table-widget/oe-panel-table-widget.js'
        ),
        'utf8'
      )
    );

    const container = window.document.getElementById('widget');
    window.OE_PANEL_TABLE_WIDGET_RENDERER(container, {
      id: 'accounts',
      title: 'Accounts',
      editable: true,
      columns: [{ key: 'name', label: 'Name' }],
      expandedFields: [{ key: 'name', label: 'Name', editable: true }],
      rows: [
        { id: 'account-1', name: 'Alpha' },
        {
          id: 'backup-1',
          name: 'Backup',
          syncEndpoint: '/api/oe-panel/sync'
        }
      ]
    });

    assert.match(container.textContent, /Alpha/);
    container.querySelector('.oe-panel-data-table-row-toggle').click();
    assert.ok(container.querySelector('.oe-panel-data-table-expanded-panel'));

    const editButton = container.querySelector(
      '[data-oe-panel-table-action="edit"]'
    );
    editButton.click();
    assert.equal(
      container.querySelector('[data-oe-panel-edit-field="name"]').value,
      'Alpha'
    );

    const syncRow = container.querySelectorAll('.oe-panel-data-table-row')[1];
    syncRow.click();
    syncRow.dispatchEvent(
      new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true })
    );
    assert.deepEqual(
      syncedRows.map((row) => row.id),
      ['backup-1', 'backup-1']
    );
  } finally {
    dom.window.close();
  }
});
