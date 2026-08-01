const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const pagePath = path.join(
  __dirname,
  '../../public/pages/oe-panel/oe-panel.html'
);

function readPageScripts() {
  const page = fs.readFileSync(pagePath, 'utf8');
  const match = page.match(/window\.pageScripts\s*=\s*({[\s\S]*?});/);
  assert.ok(match, 'OE panel should declare window.pageScripts');

  return vm.runInNewContext(`(${match[1]})`);
}

test('OE panel facades load in a later layer than their split dependencies', () => {
  const scripts = readPageScripts();
  const widgetFacade = '/scripts/oe-panel/widgets/oe-panel-widgets.js';
  const dependencyGroups = [
    {
      facade: widgetFacade,
      dependencies: [
        '/scripts/oe-panel/widgets/oe-panel-widget-helpers.js',
        '/scripts/oe-panel/widgets/oe-panel-widget-form.js',
        '/scripts/oe-panel/widgets/oe-panel-widget-basic.js',
        '/scripts/oe-panel/widgets/oe-panel-widget-data.js',
        '/scripts/oe-panel/widgets/oe-panel-widget-time-series.js',
        '/scripts/oe-panel/widgets/oe-panel-widget-pie-chart.js',
        '/scripts/oe-panel/widgets/oe-panel-widget-alerts.js'
      ]
    },
    {
      facade:
        '/scripts/oe-panel/oe-panel-gallery-database-widget/oe-panel-gallery-database-widget.js',
      dependencies: [
        widgetFacade,
        '/scripts/oe-panel/oe-panel-gallery-database-widget/gallery-renderer.js',
        '/scripts/oe-panel/oe-panel-gallery-database-widget/database-button-list.js'
      ]
    },
    {
      facade:
        '/scripts/oe-panel/oe-panel-table-widget/oe-panel-table-widget.js',
      dependencies: [
        widgetFacade,
        '/scripts/oe-panel/oe-panel-table-widget/search-tools.js',
        '/scripts/oe-panel/oe-panel-table-widget/expanded-row.js',
        '/scripts/oe-panel/oe-panel-table-widget/series-renderer.js'
      ]
    },
    {
      facade: '/scripts/oe-panel/actions/oe-panel-actions-widget.js',
      dependencies: [
        widgetFacade,
        '/scripts/oe-panel/actions/oe-panel-actions-core.js',
        '/scripts/oe-panel/actions/oe-panel-actions-alerts.js',
        '/scripts/oe-panel/actions/oe-panel-actions-queues.js',
        '/scripts/oe-panel/actions/oe-panel-actions-operations.js',
        '/scripts/oe-panel/actions/oe-panel-actions-embedded-widget.js',
        '/scripts/oe-panel/actions/oe-panel-actions-form-fields.js',
        '/scripts/oe-panel/actions/oe-panel-actions-admin-forms.js',
        '/scripts/oe-panel/actions/oe-panel-actions-pack-forms.js',
        '/scripts/oe-panel/actions/oe-panel-actions-submenu.js'
      ]
    },
    {
      facade:
        '/scripts/oe-panel/email-template-editor/email-template-editor.js',
      dependencies: [
        '/scripts/oe-panel/email-template-editor/email-template-editor-config.js'
      ]
    },
    {
      facade:
        '/scripts/oe-panel/oe-panel-social-video-editor/oe-panel-social-video-editor.js',
      dependencies: [
        '/scripts/oe-panel/oe-panel-social-video-editor/preview.js',
        '/scripts/oe-panel/oe-panel-social-video-editor/export.js'
      ]
    },
    {
      facade: '/scripts/oe-panel/oe-panel-social-video-studio/upload-view.js',
      dependencies: [
        '/scripts/oe-panel/oe-panel-social-video-editor/oe-panel-social-video-editor.js',
        '/scripts/oe-panel/oe-panel-social-video-studio/controls.js',
        '/scripts/oe-panel/oe-panel-social-video-studio/crop-helpers.js'
      ]
    },
    {
      facade:
        '/scripts/oe-panel/oe-panel-social-video-studio/oe-panel-social-video-studio.js',
      dependencies: [
        '/scripts/oe-panel/oe-panel-social-video-studio/upload-view.js'
      ]
    },
    {
      facade:
        '/scripts/oe-panel/oe-panel-social-creation-widget/oe-panel-social-creation-widget.js',
      dependencies: [
        widgetFacade,
        '/scripts/oe-panel/oe-panel-social-video-studio/oe-panel-social-video-studio.js',
        '/scripts/oe-panel/oe-panel-social-creation-widget/alerts-view.js',
        '/scripts/oe-panel/oe-panel-social-creation-widget/idea-view.js',
        '/scripts/oe-panel/oe-panel-social-creation-widget/download-icon.js'
      ]
    },
    {
      facade:
        '/scripts/oe-panel/section-hydrator/oe-panel-section-hydrator-insights.js',
      dependencies: [
        '/scripts/oe-panel/section-hydrator/oe-panel-section-hydrator-insights/social.js',
        '/scripts/oe-panel/section-hydrator/oe-panel-section-hydrator-insights/analytics.js',
        '/scripts/oe-panel/section-hydrator/oe-panel-section-hydrator-insights/dashboard.js',
        '/scripts/oe-panel/section-hydrator/oe-panel-section-hydrator-insights/overexposure.js',
        '/scripts/oe-panel/section-hydrator/oe-panel-section-hydrator-insights/party-games.js'
      ]
    },
    {
      facade: '/scripts/oe-panel/section-hydrator/oe-panel-section-hydrator.js',
      dependencies: [
        '/scripts/oe-panel/section-hydrator/oe-panel-section-hydrator-catalog.js',
        '/scripts/oe-panel/section-hydrator/oe-panel-section-hydrator-operations.js',
        '/scripts/oe-panel/section-hydrator/oe-panel-section-hydrator-insights.js'
      ]
    }
  ];

  dependencyGroups.forEach(({ facade, dependencies }) => {
    assert.ok(scripts[facade], `${facade} should be configured`);
    dependencies.forEach((dependency) => {
      assert.ok(scripts[dependency], `${dependency} should be configured`);
      assert.ok(
        Number(scripts[dependency].zIndex) < Number(scripts[facade].zIndex),
        `${dependency} must complete before ${facade}`
      );
    });
  });
});
