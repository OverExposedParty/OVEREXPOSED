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

test('deleting an email template confirms and disables templates in active use', async () => {
  const dom = new JSDOM('<!doctype html><main id="widget"></main>', {
    runScripts: 'dangerously'
  });
  const { window } = dom;
  const clearedDataKeys = [];
  const confirmations = [];
  const requests = [];

  try {
    window.OE_PANEL_DATA = {
      clear(key) {
        clearedDataKeys.push(key);
      }
    };
    window.confirm = (message) => {
      confirmations.push(message);
      return true;
    };
    window.fetch = async (url, options) => {
      requests.push({ url: String(url), options });
      return {
        ok: true,
        async json() {
          return { success: true };
        }
      };
    };
    window.eval(
      fs.readFileSync(
        path.join(scriptsDirectory, 'widgets/oe-panel-widget-helpers.js'),
        'utf8'
      )
    );
    window.OE_PANEL_WIDGET_HELPERS = window.createOePanelWidgetHelpers();
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
      id: 'email-templates',
      title: 'Templates',
      dataSource: 'emailTemplates',
      columns: [{ key: 'template', label: 'Template' }],
      expandedFields: [{ key: 'status', label: 'Status' }],
      rowActions: [
        { label: 'Open in Editor', action: 'open-email-template' },
        {
          label: 'Delete',
          action: 'delete',
          disabledWhen: { key: 'inUse', equals: true },
          disabledTitleKey: 'usageTooltip'
        }
      ],
      deleteEndpoint: '/api/oe-panel/emails/templates/{templateId}',
      deleteConfirmMessage:
        'Are you sure you want to delete this email template?',
      rows: [
        {
          templateId: 'template-1',
          template: 'Marketing Update',
          status: 'Draft',
          inUse: false,
          usageTooltip: ''
        },
        {
          templateId: 'template-verify',
          template: 'Email Confirmation',
          status: 'Published',
          inUse: true,
          usageTooltip:
            'In use by: Verify Email (Account registration and resend verification)'
        }
      ],
      fillRows: false
    });

    container.querySelectorAll('.oe-panel-data-table-row-toggle')[1].click();
    const disabledDelete = container.querySelector(
      '[data-oe-panel-table-action="delete"]'
    );
    const tooltip = disabledDelete.closest(
      '.oe-panel-data-table-expanded-action-tooltip'
    );
    assert.equal(disabledDelete.disabled, true);
    assert.equal(
      tooltip.dataset.tooltip,
      'In use by: Verify Email (Account registration and resend verification)'
    );
    disabledDelete.click();
    assert.equal(confirmations.length, 0);
    assert.equal(requests.length, 0);

    container.querySelectorAll('.oe-panel-data-table-row-toggle')[1].click();
    container.querySelectorAll('.oe-panel-data-table-row-toggle')[0].click();
    container.querySelector('[data-oe-panel-table-action="delete"]').click();
    await new Promise((resolve) => window.setTimeout(resolve, 0));

    assert.deepEqual(confirmations, [
      'Are you sure you want to delete this email template?'
    ]);
    assert.equal(requests[0].url, '/api/oe-panel/emails/templates/template-1');
    assert.equal(requests[0].options.method, 'DELETE');
    assert.deepEqual(clearedDataKeys, ['emailTemplates']);
    assert.equal(
      container.querySelectorAll('.oe-panel-data-table-row').length,
      1
    );
  } finally {
    dom.window.close();
  }
});

test('deleting an email automation confirms, refreshes data, and protects system rows', async () => {
  const dom = new JSDOM('<!doctype html><main id="widget"></main>', {
    runScripts: 'dangerously'
  });
  const { window } = dom;
  const clearedDataKeys = [];
  const requests = [];
  const confirmations = [];
  let allowDelete = false;
  let changeEvents = 0;

  try {
    window.OE_PANEL_DATA = {
      clear(key) {
        clearedDataKeys.push(key);
      }
    };
    window.confirm = (message) => {
      confirmations.push(message);
      return allowDelete;
    };
    window.fetch = async (url, options) => {
      requests.push({ url: String(url), options });
      return {
        ok: true,
        async json() {
          return { success: true, data: { deleted: true } };
        }
      };
    };
    window.addEventListener('oe-panel-email-automations-changed', () => {
      changeEvents += 1;
      window.OE_PANEL_DATA.clear('emailAutomations');
    });
    window.eval(
      fs.readFileSync(
        path.join(scriptsDirectory, 'widgets/oe-panel-widget-helpers.js'),
        'utf8'
      )
    );
    window.OE_PANEL_WIDGET_HELPERS = window.createOePanelWidgetHelpers();
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
      id: 'email-automations',
      title: 'Automations',
      dataSource: 'emailAutomations',
      columns: [{ key: 'automation', label: 'Automation' }],
      expandedFields: [{ key: 'status', label: 'Status' }],
      rowActions: [
        { label: 'Edit', action: 'edit-email-automation' },
        {
          label: 'Delete',
          action: 'delete',
          disabledWhen: { key: 'systemManagedValue', equals: true },
          disabledTitle: 'System-managed automations cannot be deleted.'
        }
      ],
      deleteEndpoint: '/api/oe-panel/emails/automations/{automationId}',
      deleteConfirmMessage: 'Are you sure you want to delete this automation?',
      rows: [
        {
          automationId: 'automation-reset',
          automation: 'Password Reset',
          status: 'Active',
          systemManagedValue: false
        },
        {
          automationId: 'system-email-verification',
          automation: 'Verify Email',
          status: 'Active',
          systemManagedValue: true
        }
      ],
      fillRows: false
    });

    const toggles = container.querySelectorAll(
      '.oe-panel-data-table-row-toggle'
    );
    toggles[1].click();
    const systemDelete = container.querySelector(
      '[data-oe-panel-table-action="delete"]'
    );
    const systemDeleteTooltip = systemDelete.closest(
      '.oe-panel-data-table-expanded-action-tooltip'
    );
    assert.equal(systemDelete.disabled, true);
    assert.equal(
      systemDeleteTooltip.dataset.tooltip,
      'System-managed automations cannot be deleted.'
    );
    container.querySelectorAll('.oe-panel-data-table-row-toggle')[1].click();
    container.querySelectorAll('.oe-panel-data-table-row-toggle')[0].click();
    const deleteButton = container.querySelector(
      '[data-oe-panel-table-action="delete"]'
    );
    deleteButton.click();
    assert.equal(requests.length, 0);
    assert.equal(
      container.querySelectorAll('.oe-panel-data-table-row').length,
      2
    );

    allowDelete = true;
    deleteButton.click();
    await new Promise((resolve) => window.setTimeout(resolve, 0));

    assert.deepEqual(confirmations, [
      'Are you sure you want to delete this automation?',
      'Are you sure you want to delete this automation?'
    ]);
    assert.equal(
      requests[0].url,
      '/api/oe-panel/emails/automations/automation-reset'
    );
    assert.equal(requests[0].options.method, 'DELETE');
    assert.deepEqual(clearedDataKeys, ['emailAutomations']);
    assert.equal(changeEvents, 1);
    assert.equal(
      container.querySelectorAll('.oe-panel-data-table-row').length,
      1
    );
  } finally {
    dom.window.close();
  }
});
