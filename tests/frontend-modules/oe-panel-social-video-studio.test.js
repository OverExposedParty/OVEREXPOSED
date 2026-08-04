const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const { JSDOM } = require('jsdom');

const studioPath = path.join(
  __dirname,
  '../../public/scripts/oe-panel/oe-panel-social-video-studio/oe-panel-social-video-studio.js'
);
const studioSupportPaths = [
  path.join(
    __dirname,
    '../../public/scripts/oe-panel/oe-panel-social-video-studio/controls.js'
  ),
  path.join(
    __dirname,
    '../../public/scripts/oe-panel/oe-panel-social-video-studio/crop-helpers.js'
  ),
  path.join(
    __dirname,
    '../../public/scripts/oe-panel/oe-panel-social-video-studio/upload-view.js'
  )
];
const editorPath = path.join(
  __dirname,
  '../../public/scripts/oe-panel/oe-panel-social-video-editor/oe-panel-social-video-editor.js'
);
const editorSupportPaths = [
  path.join(
    __dirname,
    '../../public/scripts/oe-panel/oe-panel-social-video-editor/preview.js'
  ),
  path.join(
    __dirname,
    '../../public/scripts/oe-panel/oe-panel-social-video-editor/export.js'
  )
];
const widgetPath = path.join(
  __dirname,
  '../../public/scripts/oe-panel/oe-panel-social-creation-widget/oe-panel-social-creation-widget.js'
);
const widgetSupportPaths = [
  path.join(
    __dirname,
    '../../public/scripts/oe-panel/oe-panel-social-creation-widget/alerts-view.js'
  ),
  path.join(
    __dirname,
    '../../public/scripts/oe-panel/oe-panel-social-creation-widget/idea-view.js'
  ),
  path.join(
    __dirname,
    '../../public/scripts/oe-panel/oe-panel-social-creation-widget/download-icon.js'
  )
];
const pagePath = path.join(
  __dirname,
  '../../public/pages/oe-panel/oe-panel.html'
);

test('social video studio registers its view factory', () => {
  const context = { window: {} };
  studioSupportPaths.forEach((supportPath) => {
    vm.runInNewContext(fs.readFileSync(supportPath, 'utf8'), context, {
      filename: path.basename(supportPath)
    });
  });
  vm.runInNewContext(fs.readFileSync(studioPath, 'utf8'), context, {
    filename: 'oe-panel-social-video-studio.js'
  });

  assert.equal(
    typeof context.window.createOePanelSocialVideoControls,
    'function'
  );
  assert.equal(
    typeof context.window.createOePanelSocialVideoCropHelpers,
    'function'
  );
  assert.equal(
    typeof context.window.createOePanelSocialVideoUploadView,
    'function'
  );
  assert.equal(
    typeof context.window.createOePanelSocialVideoStudio,
    'function'
  );
});

test('social video editor registers its view factory', () => {
  const context = { window: {} };
  editorSupportPaths.forEach((supportPath) => {
    vm.runInNewContext(fs.readFileSync(supportPath, 'utf8'), context, {
      filename: path.basename(supportPath)
    });
  });
  vm.runInNewContext(fs.readFileSync(editorPath, 'utf8'), context, {
    filename: 'oe-panel-social-video-editor.js'
  });

  assert.equal(
    typeof context.window.createOePanelSocialVideoEditor,
    'function'
  );
});

test('social creation widget accepts the loaded video studio factory', () => {
  const context = { window: {} };
  editorSupportPaths.forEach((supportPath) => {
    vm.runInNewContext(fs.readFileSync(supportPath, 'utf8'), context, {
      filename: path.basename(supportPath)
    });
  });
  vm.runInNewContext(fs.readFileSync(editorPath, 'utf8'), context, {
    filename: 'oe-panel-social-video-editor.js'
  });
  studioSupportPaths.forEach((supportPath) => {
    vm.runInNewContext(fs.readFileSync(supportPath, 'utf8'), context, {
      filename: path.basename(supportPath)
    });
  });
  vm.runInNewContext(fs.readFileSync(studioPath, 'utf8'), context, {
    filename: 'oe-panel-social-video-studio.js'
  });
  widgetSupportPaths.forEach((supportPath) => {
    vm.runInNewContext(fs.readFileSync(supportPath, 'utf8'), context, {
      filename: path.basename(supportPath)
    });
  });
  vm.runInNewContext(fs.readFileSync(widgetPath, 'utf8'), context, {
    filename: 'oe-panel-social-creation-widget.js'
  });

  assert.equal(
    typeof context.window.OE_PANEL_SOCIAL_CREATION_WIDGET_RENDERER,
    'function'
  );
});

test('social video studio loads before the social creation widget', () => {
  const page = fs.readFileSync(pagePath, 'utf8');
  const studioIndex = page.indexOf(
    "'/scripts/oe-panel/oe-panel-social-video-studio/oe-panel-social-video-studio.js'"
  );
  const editorIndex = page.indexOf(
    "'/scripts/oe-panel/oe-panel-social-video-editor/oe-panel-social-video-editor.js'"
  );
  const widgetIndex = page.indexOf(
    "'/scripts/oe-panel/oe-panel-social-creation-widget/oe-panel-social-creation-widget.js'"
  );
  const studioSupportIndexes = [
    "'/scripts/oe-panel/oe-panel-social-video-studio/controls.js'",
    "'/scripts/oe-panel/oe-panel-social-video-studio/crop-helpers.js'",
    "'/scripts/oe-panel/oe-panel-social-video-studio/upload-view.js'"
  ].map((scriptPath) => page.indexOf(scriptPath));
  const widgetSupportIndexes = [
    "'/scripts/oe-panel/oe-panel-social-creation-widget/alerts-view.js'",
    "'/scripts/oe-panel/oe-panel-social-creation-widget/idea-view.js'",
    "'/scripts/oe-panel/oe-panel-social-creation-widget/download-icon.js'"
  ].map((scriptPath) => page.indexOf(scriptPath));
  const previewIndex = page.indexOf(
    "'/scripts/oe-panel/oe-panel-social-video-editor/preview.js'"
  );
  const exportIndex = page.indexOf(
    "'/scripts/oe-panel/oe-panel-social-video-editor/export.js'"
  );

  assert.ok(editorIndex > -1);
  assert.ok(previewIndex > -1);
  assert.ok(exportIndex > previewIndex);
  assert.ok(editorIndex > exportIndex);
  studioSupportIndexes.forEach((supportIndex) => {
    assert.ok(supportIndex > editorIndex);
    assert.ok(studioIndex > supportIndex);
  });
  assert.ok(studioIndex > editorIndex);
  widgetSupportIndexes.forEach((supportIndex) => {
    assert.ok(supportIndex > studioIndex);
    assert.ok(widgetIndex > supportIndex);
  });
  assert.ok(widgetIndex > studioIndex);
});

test('social creation widget support modules register before the facade', () => {
  const context = { window: {} };

  widgetSupportPaths.forEach((supportPath) => {
    vm.runInNewContext(fs.readFileSync(supportPath, 'utf8'), context, {
      filename: path.basename(supportPath)
    });
  });

  assert.equal(typeof context.window.createOePanelSocialAlertsView, 'function');
  assert.equal(typeof context.window.createOePanelSocialIdeaView, 'function');
  assert.equal(
    typeof context.window.createOePanelSocialDownloadIcon,
    'function'
  );
});

test('social video editor composes its preview, controls, and export modules', () => {
  const dom = new JSDOM(
    '<div id="container"><section id="widget"></section><p id="status"></p></div>',
    {
      runScripts: 'outside-only',
      url: 'https://overexposed.test/'
    }
  );
  const { window } = dom;
  window.requestAnimationFrame = (callback) => callback();

  editorSupportPaths.forEach((supportPath) => {
    window.eval(fs.readFileSync(supportPath, 'utf8'));
  });
  window.eval(fs.readFileSync(editorPath, 'utf8'));

  const container = window.document.getElementById('container');
  const widget = window.document.getElementById('widget');
  const status = window.document.getElementById('status');
  const showEditView = window.createOePanelSocialVideoEditor({
    session: {
      uploadedVideoState: {
        url: 'blob:video-preview',
        crop: { aspectRatio: '16 / 9', playbackControls: true }
      }
    },
    clearActiveEditLeaveGuard() {},
    showUploadVideoView() {},
    actionConfig: {},
    getBackHeaderTitle: () => 'Back',
    appendCenteredBackHeaderTitle() {},
    createVideoControls: () => window.document.createElement('div'),
    widget,
    applyVideoCrop() {},
    container,
    status
  });

  showEditView();

  assert.ok(widget.querySelector('.oe-panel-social-edit-preview'));
  assert.ok(widget.querySelector('.oe-panel-social-edit-export-progress'));
  assert.equal(
    widget.querySelector('.oe-panel-social-edit-save').disabled,
    true
  );

  const fileName = widget.querySelector('.oe-panel-social-edit-meta-input');
  fileName.value = 'launch-video';
  fileName.dispatchEvent(new window.Event('input', { bubbles: true }));
  assert.equal(
    widget.querySelector('.oe-panel-social-edit-save').disabled,
    false
  );
  dom.window.close();
});
