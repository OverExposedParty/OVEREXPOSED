const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { JSDOM } = require('jsdom');

const editorDirectory = path.join(
  __dirname,
  '../../public/scripts/oe-panel/email-template-editor'
);
const actionsDirectory = path.join(
  __dirname,
  '../../public/scripts/oe-panel/actions'
);
const editorStylesPath = path.join(
  __dirname,
  '../../public/css/oe-panel/oe-panel/email-template-editor.css'
);

function evaluate(window, directory, fileName) {
  window.eval(fs.readFileSync(path.join(directory, fileName), 'utf8'));
}

test('email template Create action emits an editor request with its grid host', () => {
  const dom = new JSDOM(
    '<!doctype html><section id="container"><div id="host"></div></section>',
    { runScripts: 'dangerously' }
  );
  const { window } = dom;
  let requestDetail = null;

  try {
    evaluate(window, actionsDirectory, 'oe-panel-actions-submenu.js');
    const container = window.document.getElementById('container');
    const host = window.document.getElementById('host');
    const { showActionSubmenu } = window.createOePanelActionSubmenu({
      container,
      widget: host,
      createActionBackHeader() {
        return window.document.createElement('header');
      },
      showActionList() {},
      renderFormWidget() {},
      showCreatePackForm() {},
      showCreateOePackForm() {}
    });
    window.addEventListener(
      'oe-panel-email-template-editor-request',
      (event) => {
        requestDetail = event.detail;
      }
    );

    showActionSubmenu({
      label: 'Templates',
      actions: [
        {
          label: 'Create',
          value: 'template-create',
          event: 'oe-panel-email-template-editor-request'
        }
      ]
    });
    host.querySelector('.oe-panel-action-button').click();

    assert.equal(requestDetail.container, container);
    assert.equal(requestDetail.host, host);
    assert.equal(requestDetail.actionConfig.value, 'template-create');
    assert.equal(typeof requestDetail.restore, 'function');
  } finally {
    dom.window.close();
  }
});

test('email editor menu headers use LemonMilk and the help-style back arrow', () => {
  const styles = fs.readFileSync(editorStylesPath, 'utf8');

  const inspectorTitleRule = styles.match(
    /\.oe-panel-email-template-editor-inspector-title\s*{([^}]*)}/
  )?.[1];
  assert.match(inspectorTitleRule, /500 clamp\([^;]*'LemonMilk'/s);
  assert.match(styles, /LEMONMILK-Medium\.otf'[\s\S]*?font-weight:\s*500/);
  assert.match(
    styles,
    /\.oe-panel-email-template-editor-inspector-back::before[\s\S]*?border-right:\s*16px solid currentColor/
  );
  const layerHoverRule = styles.match(
    /\.oe-panel-email-template-editor-layer:hover\s*{([^}]*)}/
  )?.[1];
  assert.match(layerHoverRule, /border-color:\s*var\(--primarypagecolour\)/);
  assert.doesNotMatch(layerHoverRule, /background\s*:|(?:^|;)\s*color\s*:/);
  assert.match(
    styles,
    /\.oe-panel-email-template-editor-drag-handle\s*{[\s\S]*?border:\s*var\(--bordersize\) solid var\(--primarypagecolour\)/
  );
  assert.match(
    styles,
    /\.oe-panel-email-template-editor-layer-row\.is-live-dragging\s*{[\s\S]*?position:\s*fixed/
  );
  assert.match(
    styles,
    /\.oe-panel-email-template-editor-layer-placeholder\s*{[\s\S]*?border:\s*var\(--bordersize\) dashed var\(--primarypagecolour\)/
  );
  assert.match(
    styles,
    /\.oe-panel-email-template-editor-viewports\s*{[\s\S]*?position:\s*absolute;[\s\S]*?top:\s*calc\(50% \+ 2\.35rem\);[\s\S]*?flex-direction:\s*column/
  );
  assert.match(
    styles,
    /\.oe-panel-email-template-settings-action\s*{[\s\S]*?border:\s*var\(--bordersize\) solid var\(--primarypagecolour\)/
  );
  const templateNameRule = styles.match(
    /\.oe-panel-email-template-editor-template-name\s*{([^}]*)}/
  )?.[1];
  assert.match(templateNameRule, /border:\s*0/);
  assert.doesNotMatch(templateNameRule, /border-bottom/);
  assert.match(
    templateNameRule,
    /500 clamp\(1\.23rem, 1\.8vw, 1\.5rem\).*'LemonMilk'/s
  );
  assert.match(templateNameRule, /text-align:\s*center/);
});

test('email editor interaction borders use the OE panel colours', () => {
  const styles = fs.readFileSync(editorStylesPath, 'utf8');
  const imageRule = styles.match(
    /\.oe-panel-email-image-picker-item\s*{([^}]*)}/
  )?.[1];
  const imageSelectedRule = styles.match(
    /\.oe-panel-email-image-picker-item\.selected,[\s\S]*?{([^}]*)}/
  )?.[1];
  const insertionRule = styles.match(
    /\.oe-panel-email-preview-insertion-button\s*{([^}]*)}/
  )?.[1];
  const selectedSectionRule = styles.match(
    /\.oe-panel-email-preview-section\.selected\s*{([^}]*)}/
  )?.[1];

  assert.match(
    imageRule,
    /border:\s*var\(--bordersize\) solid var\(--secondarypagecolour\)/
  );
  assert.match(imageSelectedRule, /border-color:\s*var\(--primarypagecolour\)/);
  assert.match(imageSelectedRule, /outline:\s*none/);
  assert.doesNotMatch(imageSelectedRule, /outline[^;]*solid/);
  assert.match(
    insertionRule,
    /border:\s*0\.1rem solid var\(--secondarypagecolour\)/
  );
  assert.match(insertionRule, /background:\s*var\(--secondarypagecolour\)/);
  assert.match(
    selectedSectionRule,
    /border-color:\s*var\(--secondarypagecolour\)/
  );
  assert.match(
    styles,
    /\.oe-panel-email-preview-insertion-button:hover\s*{[\s\S]*?background:\s*var\(--primarypagecolour\)/
  );
  assert.match(
    styles,
    /\.oe-panel-email-preview-section:hover\s*{[\s\S]*?border-color:\s*var\(--primarypagecolour\)/
  );
  assert.match(
    styles,
    /\.oe-panel-email-preview-frame\.mobile \.oe-panel-email-preview-kv-row\s*{[\s\S]*?grid-template-columns:\s*minmax\(0, 2fr\) minmax\(0, 3fr\);[\s\S]*?font-size:\s*0\.72rem/
  );
  assert.match(
    styles,
    /\.oe-panel-email-preview-frame\.mobile \.oe-panel-email-preview-kv-row > \*\s*{[\s\S]*?overflow-wrap:\s*anywhere/
  );
  assert.match(
    styles,
    /--theme-colour-control-height:\s*2\.75rem;[\s\S]*?\.oe-panel-email-editor-field\.theme-colour select\s*{[\s\S]*?height:\s*var\(--theme-colour-control-height\)/
  );
  assert.match(
    styles,
    /\.oe-panel-email-editor-field\.theme-colour input\[type='color'\]\s*{[\s\S]*?height:\s*var\(--theme-colour-control-height\)/
  );
});

test('email editor offers the expanded template categories', () => {
  const dom = new JSDOM('<!doctype html>', { runScripts: 'dangerously' });

  try {
    evaluate(dom.window, editorDirectory, 'email-template-editor-config.js');
    const categoryControl =
      dom.window.OE_PANEL_EMAIL_TEMPLATE_EDITOR_CONFIG.templateControls.find(
        (control) => control.key === 'category'
      );

    assert.deepEqual(
      Array.from(categoryControl.options, ({ value, label }) => ({
        value,
        label
      })),
      [
        { value: 'transactional', label: 'Transactional' },
        { value: 'marketing', label: 'Marketing' },
        { value: 'account-security', label: 'Account & Security' },
        { value: 'onboarding', label: 'Onboarding' },
        { value: 'party-social', label: 'Party & Social' },
        { value: 'rewards-progress', label: 'Rewards & Progress' },
        { value: 'shop-orders', label: 'Shop & Orders' },
        { value: 'product-updates', label: 'Product Updates' },
        { value: 'events', label: 'Events' },
        { value: 're-engagement', label: 'Re-engagement' }
      ]
    );
    const automationControl =
      dom.window.OE_PANEL_EMAIL_TEMPLATE_EDITOR_CONFIG.templateControls.find(
        (control) => control.key === 'automationTriggers'
      );
    assert.equal(automationControl.type, 'checkboxGroup');
    assert.deepEqual(
      Array.from(automationControl.options, ({ value }) => value),
      ['email-verification', 'password-reset-request', 'email-address-change']
    );
    Object.entries(
      dom.window.OE_PANEL_EMAIL_TEMPLATE_EDITOR_CONFIG.sectionDefinitions
    ).forEach(([type, definition]) => {
      const spacingControl = definition.controls.find(
        (control) => control.key === 'sectionSpacing'
      );
      if (type === 'spacer') {
        assert.equal(spacingControl, undefined);
        return;
      }
      assert.equal(spacingControl.label, 'Section Spacing');
      assert.deepEqual(
        Array.from(spacingControl.options, ({ value }) => value),
        ['none', 'compact', 'standard']
      );
    });
  } finally {
    dom.window.close();
  }
});

test('email template editor updates templates and protects unsaved work', async () => {
  const dom = new JSDOM(
    `<!doctype html>
      <main class="oe-panel-layout">
        <aside class="oe-panel-sidebar">
          <div class="oe-panel-sidebar-title-container">OE Panel</div>
          <nav class="oe-panel-sidebar-nav">Navigation</nav>
        </aside>
        <section class="oe-panel-content">
          <div class="oe-panel-content-title-container">Emails</div>
          <div class="oe-panel-content-grid">
            <section id="action-grid" class="oe-panel-content-container">
              <div id="action-host" class="oe-panel-widget"></div>
              <button class="oe-panel-grid-expand-button"></button>
            </section>
          </div>
        </section>
      </main>`,
    { runScripts: 'dangerously', url: 'https://overexposed.test/' }
  );
  const { window } = dom;
  let expandRequests = 0;
  let shrinkRequests = 0;
  let restoreCalls = 0;
  const apiRequests = [];
  const clearedDataKeys = [];

  try {
    window.OE_PANEL_DATA = {
      clear(key) {
        clearedDataKeys.push(key);
      }
    };
    window.fetch = async (url, options = {}) => {
      if (String(url) === '/api/oe-panel/emails/images') {
        return {
          ok: true,
          status: 200,
          async json() {
            return {
              success: true,
              data: {
                images: [
                  {
                    path: '/images/emails/branding/overexposed-logo.svg',
                    relativePath: 'branding/overexposed-logo.svg',
                    name: 'Branding Overexposed Logo',
                    type: 'branding',
                    typeLabel: 'Branding',
                    format: 'SVG',
                    categories: [],
                    defaultAlt: 'OVEREXPOSED'
                  },
                  {
                    path: '/images/emails/heroes/mascot/default.png',
                    relativePath: 'heroes/mascot/default.png',
                    name: 'Mascot Default',
                    type: 'heroes',
                    typeLabel: 'Heroes',
                    format: 'PNG',
                    categories: ['account-security'],
                    defaultAlt: 'Confirm your OVEREXPOSED email'
                  },
                  {
                    path: '/images/emails/heroes/mascot/shocked.png',
                    relativePath: 'heroes/mascot/shocked.png',
                    name: 'Mascot Shocked',
                    type: 'heroes',
                    typeLabel: 'Heroes',
                    format: 'PNG',
                    categories: ['account-security'],
                    defaultAlt: 'Reset your OVEREXPOSED password'
                  },
                  {
                    path: '/images/emails/heroes/mascot/happy.png',
                    relativePath: 'heroes/mascot/happy.png',
                    name: 'Mascot Happy',
                    type: 'heroes',
                    typeLabel: 'Heroes',
                    format: 'PNG',
                    categories: [],
                    defaultAlt: 'Happy OVEREXPOSED mascot'
                  },
                  {
                    path: '/images/emails/heroes/mascot/sleeping.png',
                    relativePath: 'heroes/mascot/sleeping.png',
                    name: 'Mascot Sleeping',
                    type: 'heroes',
                    typeLabel: 'Heroes',
                    format: 'PNG',
                    categories: [],
                    defaultAlt: 'Sleeping OVEREXPOSED mascot'
                  },
                  {
                    path: '/images/emails/heroes/mascot/waving.png',
                    relativePath: 'heroes/mascot/waving.png',
                    name: 'Mascot Waving',
                    type: 'heroes',
                    typeLabel: 'Heroes',
                    format: 'PNG',
                    categories: [],
                    defaultAlt: 'Waving OVEREXPOSED mascot'
                  }
                ]
              }
            };
          }
        };
      }
      if (String(url) === '/api/oe-panel/emails/preferences') {
        return {
          ok: true,
          status: 200,
          async json() {
            return {
              success: true,
              data: { testEmailRecipient: 'saved-recipient@example.com' }
            };
          }
        };
      }
      const body = options.body ? JSON.parse(options.body) : {};
      apiRequests.push({ url: String(url), options, body });
      if (String(url).endsWith('/test-send')) {
        return {
          ok: true,
          status: 200,
          async json() {
            return {
              success: true,
              data: { recipient: body.recipient, skipped: false }
            };
          }
        };
      }
      if (String(url).endsWith('/duplicate')) {
        const sourceBody = apiRequests.find(
          (request) => request.url === '/api/oe-panel/emails/templates'
        )?.body;
        return {
          ok: true,
          status: 201,
          async json() {
            return {
              success: true,
              data: {
                template: {
                  id: 'template-copy',
                  ...sourceBody,
                  key: '',
                  name: `${sourceBody.name} Copy`,
                  status: 'draft',
                  updatedAt: '2026-08-02T12:00:00.000Z'
                }
              }
            };
          }
        };
      }
      const template = options.method
        ? {
            id: 'template-1',
            ...body,
            status: 'draft',
            updatedAt: '2026-08-02T11:00:00.000Z'
          }
        : {
            id: 'template-1',
            ...(apiRequests[0]?.body || {}),
            name: 'Saved Email Template',
            status: 'draft'
          };
      return {
        ok: true,
        status: 201,
        async json() {
          return {
            success: true,
            data: {
              template
            }
          };
        }
      };
    };
    evaluate(window, editorDirectory, 'email-template-editor-config.js');
    evaluate(window, editorDirectory, 'email-template-editor.js');
    const container = window.document.getElementById('action-grid');
    const host = window.document.getElementById('action-host');
    container.addEventListener('oe-panel-request-expand', () => {
      expandRequests += 1;
    });
    container.addEventListener('oe-panel-request-shrink', () => {
      shrinkRequests += 1;
    });

    window.dispatchEvent(
      new window.CustomEvent('oe-panel-email-template-editor-request', {
        detail: {
          container,
          host,
          restore() {
            restoreCalls += 1;
            host.textContent = 'Templates submenu restored';
          }
        }
      })
    );
    await new Promise((resolve) => window.setTimeout(resolve, 0));

    assert.equal(expandRequests, 1);
    assert.ok(container.classList.contains('is-email-template-editor'));
    assert.ok(
      window.document
        .querySelector('.oe-panel-layout')
        .classList.contains('is-email-template-editor-open')
    );
    assert.ok(
      window.document
        .querySelector('.oe-panel-sidebar')
        .classList.contains('is-email-template-editor-mode')
    );
    assert.equal(
      host.querySelector('.oe-panel-email-template-editor-exit'),
      null
    );
    const editorHeader = window.document.querySelector(
      '.oe-panel-email-template-editor-inspector-header'
    );
    const editorBackButton = editorHeader.querySelector(
      '.oe-panel-email-template-editor-inspector-back'
    );
    assert.equal(editorBackButton.textContent, '');
    assert.equal(
      editorBackButton.getAttribute('aria-label'),
      'Back to email actions'
    );
    assert.equal(
      editorBackButton.nextElementSibling.textContent,
      'Email Editor'
    );
    assert.equal(
      host.querySelectorAll('[data-email-template-section]').length,
      6
    );
    assert.equal(
      host.querySelector('.oe-panel-email-template-editor-template-label'),
      null
    );
    assert.equal(
      host.querySelector('.oe-panel-email-template-editor-template-name')
        .tagName,
      'STRONG'
    );
    assert.equal(
      host.querySelector('.oe-panel-email-template-editor-template-name')
        .textContent,
      'Untitled Email Template'
    );
    assert.equal(
      host.querySelector('#email-template-editor-template-name'),
      null
    );
    assert.ok(
      host
        .querySelector('.oe-panel-email-template-editor-template-name')
        .nextElementSibling.classList.contains(
          'oe-panel-email-template-editor-status'
        )
    );
    assert.match(
      host.querySelector('.oe-panel-email-preview-heading').style.fontFamily,
      /OverExposed/
    );
    assert.match(
      host.querySelector('.oe-panel-email-preview-subheading').style.fontFamily,
      /LemonMilk/
    );

    const templateSettingsLink = window.document.querySelector(
      '[data-email-template-panel="template-settings"]'
    );
    assert.equal(
      templateSettingsLink.previousElementSibling.classList.contains(
        'oe-panel-email-template-editor-add-section'
      ),
      true
    );
    templateSettingsLink.click();
    assert.equal(
      window.document.querySelector(
        '.oe-panel-email-template-editor-inspector-title'
      ).textContent,
      'Template Settings'
    );
    const templateNameField = window.document.getElementById(
      'email-template-template-settings-templateName'
    );
    assert.ok(templateNameField);
    assert.equal(
      window.document.getElementById(
        'email-template-template-settings-templateKey'
      ).disabled,
      false
    );
    assert.ok(
      window.document.getElementById(
        'email-template-template-settings-category'
      )
    );
    const passwordResetTrigger = window.document.querySelector(
      '.oe-panel-email-editor-checkbox-group input[value="password-reset-request"]'
    );
    assert.ok(passwordResetTrigger);
    passwordResetTrigger.checked = true;
    passwordResetTrigger.dispatchEvent(
      new window.Event('change', { bubbles: true })
    );
    assert.match(
      window.document.querySelector(
        '.oe-panel-email-template-settings-workflow'
      ).textContent,
      /Unsaved changes/
    );
    assert.deepEqual(
      Array.from(
        window.document.querySelectorAll(
          '.oe-panel-email-template-settings-action'
        ),
        (button) => button.textContent
      ),
      [
        'UPDATE TEMPLATE',
        'PUBLISH',
        'DUPLICATE',
        'SEND TEST EMAIL',
        'DELETE TEMPLATE'
      ]
    );
    assert.equal(
      window.document.querySelector(
        '.oe-panel-email-template-settings-action.delete'
      ).disabled,
      true
    );
    const testRecipientInput = window.document.getElementById(
      'email-template-test-email-recipient'
    );
    const testSendAction = window.document.querySelector(
      '.oe-panel-email-template-settings-action.test-send'
    );
    assert.equal(testRecipientInput.type, 'email');
    assert.equal(testRecipientInput.required, true);
    assert.equal(testRecipientInput.value, 'saved-recipient@example.com');
    assert.equal(testSendAction.disabled, false);
    testRecipientInput.value = 'invalid-address';
    testRecipientInput.dispatchEvent(
      new window.Event('input', { bubbles: true })
    );
    assert.equal(testRecipientInput.getAttribute('aria-invalid'), 'true');
    assert.equal(testSendAction.disabled, true);
    assert.match(
      window.document.querySelector(
        '.oe-panel-email-template-test-recipient-message'
      ).textContent,
      /valid email address/
    );
    testRecipientInput.value = 'qa-recipient@example.com';
    testRecipientInput.dispatchEvent(
      new window.Event('input', { bubbles: true })
    );
    assert.equal(testRecipientInput.getAttribute('aria-invalid'), 'false');
    assert.equal(testSendAction.disabled, false);
    templateNameField.value = 'Campaign Template';
    templateNameField.dispatchEvent(
      new window.Event('input', { bubbles: true })
    );
    assert.equal(
      host.querySelector('.oe-panel-email-template-editor-template-name')
        .textContent,
      'Campaign Template'
    );
    window.document
      .querySelector('.oe-panel-email-template-editor-inspector-back')
      .click();

    window.document
      .querySelector('[data-email-template-panel="message"]')
      .click();
    assert.equal(
      window.document.getElementById('email-template-message-templateName'),
      null
    );
    assert.ok(window.document.getElementById('email-template-message-subject'));
    window.document
      .querySelector('.oe-panel-email-template-editor-inspector-back')
      .click();

    host.querySelector('[data-email-template-section="logo"]').click();
    const logoBackground = window.document.getElementById(
      'email-template-logo-backgroundColour'
    );
    const logoBackgroundSource = window.document.getElementById(
      'email-template-logo-backgroundColourSource'
    );
    assert.equal(
      window.document.getElementById('email-template-logo-width'),
      null
    );
    assert.equal(logoBackgroundSource.value, 'theme-primary');
    assert.equal(logoBackground.hidden, true);
    assert.equal(
      logoBackground
        .closest('.theme-colour')
        .classList.contains('shows-custom-colour'),
      false
    );
    assert.equal(
      host.querySelector('.oe-panel-email-preview-logo').style.width,
      '280px'
    );
    logoBackgroundSource.value = 'custom';
    logoBackgroundSource.dispatchEvent(
      new window.Event('change', { bubbles: true })
    );
    assert.equal(logoBackground.hidden, false);
    assert.equal(
      logoBackground
        .closest('.theme-colour')
        .classList.contains('shows-custom-colour'),
      true
    );
    logoBackground.value = '#123456';
    logoBackground.dispatchEvent(new window.Event('input', { bubbles: true }));
    assert.equal(
      host.querySelector('[data-email-template-section="logo"]').style
        .backgroundColor,
      'rgb(18, 52, 86)'
    );
    assert.equal(
      window.document.querySelector('.oe-panel-email-image-picker-tabs').hidden,
      true
    );
    assert.ok(
      window.document.querySelector('.oe-panel-email-image-picker-search')
    );
    assert.equal(
      window.document.querySelectorAll(
        '.oe-panel-email-image-picker-item[data-email-image-path]'
      ).length,
      1
    );
    const logoImagePagination = window.document.querySelector(
      '.oe-panel-email-image-picker-pagination'
    );
    assert.equal(logoImagePagination.hidden, true);
    assert.equal(
      window.document.querySelectorAll(
        '.oe-panel-email-image-picker-placeholder'
      ).length,
      3
    );
    assert.equal(
      window.document.querySelector('.oe-panel-email-image-picker-grid')
        .children.length,
      4
    );

    host.querySelector('[data-email-template-section="heading"]').click();
    assert.equal(
      window.document.querySelector(
        '.oe-panel-email-template-editor-inspector-title'
      ).textContent,
      'Heading'
    );
    assert.ok(window.document.getElementById('email-template-heading-text'));
    assert.ok(
      window.document.getElementById('email-template-heading-subheading')
    );
    assert.equal(
      window.document.getElementById('email-template-heading-fontSize').value,
      '26'
    );
    assert.equal(
      host.querySelector('.oe-panel-email-preview-heading').style.fontSize,
      '26px'
    );
    const headingSpacingInput = window.document.getElementById(
      'email-template-heading-sectionSpacing'
    );
    assert.equal(headingSpacingInput.value, 'standard');
    assert.equal(
      host.querySelector('[data-email-template-section="heading"]').style
        .paddingTop,
      '24px'
    );
    headingSpacingInput.value = 'none';
    headingSpacingInput.dispatchEvent(
      new window.Event('change', { bubbles: true })
    );
    assert.equal(
      host.querySelector('[data-email-template-section="heading"]').style
        .paddingTop,
      '0px'
    );
    assert.equal(
      host.querySelector('[data-email-template-section="heading"]').style
        .paddingBottom,
      '0px'
    );
    const subheadingSizeInput = window.document.getElementById(
      'email-template-heading-subheadingFontSize'
    );
    assert.equal(subheadingSizeInput.value, '16');
    subheadingSizeInput.value = '24';
    subheadingSizeInput.dispatchEvent(
      new window.Event('input', { bubbles: true })
    );
    assert.equal(
      host.querySelector('.oe-panel-email-preview-subheading').style.fontSize,
      '24px'
    );
    const inspectorBackButton = window.document.querySelector(
      '.oe-panel-email-template-editor-inspector-back'
    );
    assert.equal(inspectorBackButton.textContent, '');
    assert.equal(
      inspectorBackButton.getAttribute('aria-label'),
      'Back to all sections'
    );

    const headingInput = window.document.getElementById(
      'email-template-heading-text'
    );
    headingInput.value = 'THE NEXT OVEREXPOSED DROP';
    headingInput.dispatchEvent(new window.Event('input', { bubbles: true }));
    assert.equal(
      host.querySelector('.oe-panel-email-preview-heading').textContent,
      'THE NEXT OVEREXPOSED DROP'
    );
    const undoShortcut = new window.KeyboardEvent('keydown', {
      key: 'z',
      ctrlKey: true,
      bubbles: true,
      cancelable: true
    });
    window.dispatchEvent(undoShortcut);
    assert.equal(undoShortcut.defaultPrevented, true);
    assert.equal(
      host.querySelector('.oe-panel-email-preview-heading').textContent,
      'WELCOME TO OVEREXPOSED'
    );
    window.dispatchEvent(
      new window.KeyboardEvent('keydown', {
        key: 'y',
        ctrlKey: true,
        bubbles: true,
        cancelable: true
      })
    );
    assert.equal(
      host.querySelector('.oe-panel-email-preview-heading').textContent,
      'THE NEXT OVEREXPOSED DROP'
    );
    window.dispatchEvent(
      new window.KeyboardEvent('keydown', {
        key: 'z',
        ctrlKey: true,
        bubbles: true,
        cancelable: true
      })
    );
    window.dispatchEvent(
      new window.KeyboardEvent('keydown', {
        key: 'z',
        ctrlKey: true,
        shiftKey: true,
        bubbles: true,
        cancelable: true
      })
    );
    assert.equal(
      host.querySelector('.oe-panel-email-preview-heading').textContent,
      'THE NEXT OVEREXPOSED DROP'
    );

    host.querySelector('[data-email-template-section="primaryAction"]').click();
    const actionBackgroundSource = window.document.getElementById(
      'email-template-primaryAction-backgroundColourSource'
    );
    const actionBackgroundColour = window.document.getElementById(
      'email-template-primaryAction-backgroundColour'
    );
    assert.equal(
      window.document.getElementById(
        'email-template-primaryAction-borderRadius'
      ),
      null
    );
    assert.equal(
      host.querySelector('.oe-panel-email-preview-action').style.borderRadius,
      '30px'
    );
    assert.equal(actionBackgroundSource.value, 'theme-primary');
    assert.equal(actionBackgroundColour.hidden, true);
    actionBackgroundSource.value = 'custom';
    actionBackgroundSource.dispatchEvent(
      new window.Event('change', { bubbles: true })
    );
    assert.equal(actionBackgroundColour.hidden, false);
    actionBackgroundColour.value = '#123456';
    actionBackgroundColour.dispatchEvent(
      new window.Event('input', { bubbles: true })
    );
    assert.equal(
      host.querySelector('.oe-panel-email-preview-action').style
        .backgroundColor,
      'rgb(18, 52, 86)'
    );
    actionBackgroundSource.value = 'theme-secondary';
    actionBackgroundSource.dispatchEvent(
      new window.Event('change', { bubbles: true })
    );
    assert.equal(actionBackgroundColour.hidden, true);
    assert.equal(actionBackgroundColour.value, '#123456');
    assert.equal(
      host.querySelector('.oe-panel-email-preview-action').style
        .backgroundColor,
      'rgb(66, 123, 185)'
    );

    host.querySelector('[data-email-template-section="hero"]').click();
    assert.equal(
      window.document.querySelector(
        '.oe-panel-email-template-editor-inspector-title'
      ).textContent,
      'Hero Image'
    );
    assert.ok(window.document.getElementById('email-template-hero-src'));
    assert.equal(
      window.document.getElementById('email-template-hero-src').type,
      'hidden'
    );
    assert.equal(
      window.document.getElementById('email-template-hero-borderRadius'),
      null
    );
    assert.equal(
      host.querySelector('.oe-panel-email-preview-hero').style.borderRadius,
      '0px'
    );
    assert.equal(
      window.document.querySelector('.oe-panel-email-image-picker-tabs').hidden,
      true
    );
    assert.equal(
      window.document.querySelectorAll(
        '.oe-panel-email-image-picker-item[data-email-image-path]'
      ).length,
      4
    );
    assert.deepEqual(
      Array.from(
        window.document.querySelectorAll(
          '[data-email-image-path] .oe-panel-email-image-picker-name'
        ),
        (name) => name.textContent
      ),
      ['Mascot Default', 'Mascot Shocked', 'Mascot Happy', 'Mascot Sleeping']
    );
    const imagePagination = window.document.querySelector(
      '.oe-panel-email-image-picker-pagination'
    );
    assert.equal(imagePagination.hidden, false);
    imagePagination.querySelector('[aria-label="Image page 2"]').click();
    assert.deepEqual(
      Array.from(
        window.document.querySelectorAll(
          '[data-email-image-path] .oe-panel-email-image-picker-name'
        ),
        (name) => name.textContent
      ),
      ['Mascot Waving']
    );
    assert.equal(
      window.document.querySelectorAll(
        '.oe-panel-email-image-picker-placeholder'
      ).length,
      3
    );
    assert.equal(
      window.document.querySelector('.oe-panel-email-image-picker-grid')
        .children.length,
      4
    );
    const imageSearch = window.document.querySelector(
      '.oe-panel-email-image-picker-search'
    );
    imageSearch.value = 'shocked';
    imageSearch.dispatchEvent(new window.Event('input', { bubbles: true }));
    assert.equal(imagePagination.hidden, true);
    assert.deepEqual(
      Array.from(
        window.document.querySelectorAll(
          '[data-email-image-path] .oe-panel-email-image-picker-name'
        ),
        (name) => name.textContent
      ),
      ['Mascot Shocked']
    );
    window.document
      .querySelector(
        '[data-email-image-path="/images/emails/heroes/mascot/shocked.png"]'
      )
      .click();
    assert.match(
      host.querySelector('.oe-panel-email-preview-hero').src,
      /\/images\/emails\/heroes\/mascot\/shocked\.png$/
    );
    assert.equal(
      window.document
        .querySelector(
          '[data-email-image-path="/images/emails/heroes/mascot/shocked.png"]'
        )
        .classList.contains('selected'),
      true
    );
    assert.equal(
      window.document.getElementById('email-template-content-text'),
      null
    );

    const viewportToggle = host.querySelector(
      '.oe-panel-email-template-editor-viewport[data-preview-device]'
    );
    assert.equal(
      host.querySelectorAll('.oe-panel-email-template-editor-viewport').length,
      4
    );
    assert.equal(viewportToggle.textContent, '');
    assert.equal(viewportToggle.dataset.previewDevice, 'desktop');
    assert.equal(
      viewportToggle.getAttribute('aria-label'),
      'Switch to mobile preview'
    );
    assert.equal(
      viewportToggle.querySelectorAll(
        '.oe-panel-email-template-editor-device-shape'
      ).length,
      1
    );
    const actionRail = host.querySelector(
      '.oe-panel-email-template-editor-action-rail'
    );
    assert.equal(
      actionRail.parentElement,
      host.querySelector('.oe-panel-email-template-editor')
    );
    assert.equal(
      host
        .querySelector('.oe-panel-email-template-editor-toolbar')
        .contains(actionRail),
      false
    );
    assert.equal(actionRail.children.length, 5);
    const updateTemplateButton = host.querySelector(
      '.oe-panel-email-template-editor-update-template'
    );
    assert.equal(
      updateTemplateButton.getAttribute('aria-label'),
      'Update template'
    );
    assert.equal(updateTemplateButton.title, 'Update template');
    assert.ok(
      updateTemplateButton.querySelector(
        '.oe-panel-email-template-editor-update-icon'
      )
    );
    const undoHistoryButton = host.querySelector(
      '.oe-panel-email-template-editor-history-button.undo'
    );
    const redoHistoryButton = host.querySelector(
      '.oe-panel-email-template-editor-history-button.redo'
    );
    assert.equal(undoHistoryButton.getAttribute('aria-label'), 'Undo');
    assert.equal(undoHistoryButton.title, 'Undo (Ctrl+Z)');
    assert.equal(undoHistoryButton.disabled, false);
    assert.ok(
      undoHistoryButton.querySelector(
        '.oe-panel-email-template-editor-history-icon'
      )
    );
    assert.equal(redoHistoryButton.getAttribute('aria-label'), 'Redo');
    assert.equal(redoHistoryButton.title, 'Redo (Ctrl+Y)');
    assert.equal(redoHistoryButton.disabled, true);
    const previewModeToggle = host.querySelector(
      '.oe-panel-email-template-editor-preview-mode'
    );
    assert.equal(previewModeToggle.getAttribute('aria-pressed'), 'false');
    assert.equal(
      previewModeToggle.getAttribute('aria-label'),
      'Enter preview mode'
    );
    assert.ok(
      previewModeToggle.querySelector(
        '.oe-panel-email-template-editor-preview-icon'
      )
    );
    assert.equal(
      host.querySelector('.oe-panel-email-template-editor-publish'),
      null
    );
    assert.equal(
      host.querySelector('.oe-panel-email-template-editor-test-send'),
      null
    );
    viewportToggle.click();
    assert.ok(host.querySelector('.oe-panel-email-preview-frame.mobile'));
    assert.equal(viewportToggle.dataset.previewDevice, 'mobile');
    assert.equal(
      viewportToggle
        .querySelector('.oe-panel-email-template-editor-device-shape.mobile')
        .classList.contains('active'),
      true
    );
    assert.equal(
      viewportToggle.querySelectorAll(
        '.oe-panel-email-template-editor-device-shape'
      ).length,
      1
    );
    assert.equal(
      viewportToggle.getAttribute('aria-label'),
      'Switch to desktop preview'
    );
    viewportToggle.click();
    assert.ok(host.querySelector('.oe-panel-email-preview-frame.desktop'));

    previewModeToggle.click();
    assert.ok(host.querySelector('.oe-panel-email-preview-frame.readonly'));
    assert.equal(previewModeToggle.getAttribute('aria-pressed'), 'true');
    assert.equal(
      previewModeToggle.getAttribute('aria-label'),
      'Exit preview mode'
    );
    assert.equal(
      host.querySelectorAll('.oe-panel-email-preview-insertion').length,
      0
    );
    assert.equal(
      host.querySelectorAll('.oe-panel-email-preview-section-label').length,
      0
    );
    const readonlyHero = host.querySelector(
      '[data-email-template-section="hero"]'
    );
    assert.equal(readonlyHero.getAttribute('role'), null);
    assert.equal(readonlyHero.hasAttribute('tabindex'), false);
    assert.equal(readonlyHero.classList.contains('selected'), false);
    readonlyHero.click();
    assert.equal(
      window.document.querySelector(
        '.oe-panel-email-template-editor-inspector-title'
      ).textContent,
      'Hero Image'
    );

    previewModeToggle.click();
    assert.equal(previewModeToggle.getAttribute('aria-pressed'), 'false');
    assert.ok(host.querySelector('.oe-panel-email-preview-insertion'));
    assert.ok(host.querySelector('.oe-panel-email-preview-section-label'));
    assert.equal(
      host
        .querySelector('[data-email-template-section="hero"]')
        .classList.contains('selected'),
      true
    );

    const heroDeleteButton = window.document.querySelector(
      '.oe-panel-email-template-editor-delete-section'
    );
    assert.equal(heroDeleteButton.textContent, 'DELETE SECTION');
    assert.equal(heroDeleteButton.disabled, false);
    heroDeleteButton.click();
    assert.equal(
      host.querySelector('[data-email-template-section="hero"]'),
      null
    );
    assert.equal(
      host.querySelectorAll('[data-email-template-section]').length,
      5
    );
    assert.equal(
      host.querySelector('.oe-panel-email-template-editor-notice').hidden,
      false
    );
    host.querySelector('.oe-panel-email-template-editor-undo').click();
    assert.ok(host.querySelector('[data-email-template-section="hero"]'));
    assert.equal(redoHistoryButton.disabled, false);
    redoHistoryButton.click();
    assert.equal(
      host.querySelector('[data-email-template-section="hero"]'),
      null
    );
    undoHistoryButton.click();
    assert.ok(host.querySelector('[data-email-template-section="hero"]'));

    host.querySelector('.oe-panel-email-preview-insertion-button').click();
    assert.equal(
      window.document.querySelector(
        '.oe-panel-email-template-editor-inspector-title'
      ).textContent,
      'Add Section'
    );
    assert.equal(
      window.document.querySelector(
        '[data-email-template-add-section="footer"]'
      ).disabled,
      true
    );
    window.document
      .querySelector('[data-email-template-add-section="divider"]')
      .click();
    const sectionIdsAfterInsert = Array.from(
      host.querySelectorAll('[data-email-template-section]'),
      (section) => section.dataset.emailTemplateSection
    );
    assert.equal(sectionIdsAfterInsert[0], 'divider-1');
    assert.equal(
      new Set(sectionIdsAfterInsert).size,
      sectionIdsAfterInsert.length
    );
    assert.equal(
      window.document.querySelector('input[id$="-borderRadius"]'),
      null
    );
    assert.equal(
      window.document.querySelector('input[id$="-thickness"]'),
      null
    );
    assert.equal(window.document.querySelector('input[id$="-width"]'), null);
    assert.equal(
      host.querySelector('.oe-panel-email-preview-divider').style.borderRadius,
      '20px'
    );
    assert.equal(
      host.querySelector('.oe-panel-email-preview-divider').style.height,
      '6px'
    );
    assert.equal(
      host.querySelector('.oe-panel-email-preview-divider').style.width,
      '100%'
    );

    window.document
      .querySelector('.oe-panel-email-template-editor-inspector-back')
      .click();
    assert.ok(
      window.document.querySelector(
        '.oe-panel-email-template-editor-add-section'
      )
    );
    window.document
      .querySelector('.oe-panel-email-template-editor-add-section')
      .click();
    window.document
      .querySelector('[data-email-template-add-section="heading"]')
      .click();
    assert.ok(host.querySelector('[data-email-template-section="heading-2"]'));

    window.document
      .querySelector('.oe-panel-email-template-editor-inspector-back')
      .click();
    window.document
      .querySelector('.oe-panel-email-template-editor-add-section')
      .click();
    window.document
      .querySelector('[data-email-template-add-section="codeToken"]')
      .click();
    const borderWidthInput = window.document.querySelector(
      'input[id$="-borderWidth"]'
    );
    const borderColourField = window.document
      .querySelector('input[id$="-borderColour"]')
      .closest('.oe-panel-email-editor-field');
    assert.equal(borderWidthInput.value, '1');
    assert.equal(borderColourField.hidden, false);

    borderWidthInput.value = '0';
    borderWidthInput.dispatchEvent(
      new window.Event('input', { bubbles: true })
    );
    assert.equal(borderColourField.hidden, true);
    assert.equal(
      host.querySelector('.oe-panel-email-preview-code-token').style
        .borderWidth,
      '0px'
    );

    borderWidthInput.value = '12';
    borderWidthInput.dispatchEvent(
      new window.Event('input', { bubbles: true })
    );
    assert.equal(borderColourField.hidden, false);
    assert.equal(
      host.querySelector('.oe-panel-email-preview-code-token').style
        .borderWidth,
      '12px'
    );

    host.querySelector('[data-email-template-section="footer"]').click();
    assert.equal(
      window.document.querySelector('input[id$="-dividerRadius"]'),
      null
    );
    assert.equal(
      host.querySelector('.oe-panel-email-preview-footer-divider').style
        .borderRadius,
      '20px'
    );
    const footerDeleteButton = window.document.querySelector(
      '.oe-panel-email-template-editor-delete-section'
    );
    assert.equal(footerDeleteButton.disabled, true);
    assert.match(
      window.document.querySelector(
        '.oe-panel-email-template-editor-protected-note'
      ).textContent,
      /required/
    );

    window.document
      .querySelector('.oe-panel-email-template-editor-inspector-back')
      .click();
    const headingLayer = window.document.querySelector(
      '[data-email-template-layer="heading-2"]'
    );
    const headingDragHandle = headingLayer.querySelector(
      '.oe-panel-email-template-editor-drag-handle'
    );
    assert.equal(headingLayer.draggable, false);
    assert.equal(headingDragHandle.draggable, false);
    assert.equal(
      headingDragHandle.parentElement.classList.contains(
        'oe-panel-email-template-editor-layer'
      ),
      true
    );
    assert.equal(
      window.document.querySelector(
        '.oe-panel-email-template-editor-layer-move'
      ),
      null
    );
    assert.match(
      headingLayer.querySelector(
        '.oe-panel-email-template-editor-layer-description'
      ).textContent,
      /Main title and optional subheading/
    );
    assert.doesNotMatch(headingLayer.textContent, /Drag|arrows/i);

    const layerRows = Array.from(
      window.document.querySelectorAll(
        '.oe-panel-email-template-editor-layer-row'
      )
    );
    layerRows.forEach((row, index) => {
      row.getBoundingClientRect = () => ({
        left: 20,
        right: 320,
        top: 100 + index * 70,
        bottom: 164 + index * 70,
        width: 300,
        height: 64
      });
    });
    window.document.querySelector(
      '.oe-panel-email-template-editor-layers'
    ).getBoundingClientRect = () => ({
      left: 0,
      right: 350,
      top: 50,
      bottom: 750,
      width: 350,
      height: 700
    });
    const createPointerEvent = (type, clientY) => {
      const pointerEvent = new window.Event(type, {
        bubbles: true,
        cancelable: true
      });
      Object.defineProperties(pointerEvent, {
        pointerId: { value: 7 },
        button: { value: 0 },
        clientX: { value: 300 },
        clientY: { value: clientY }
      });
      return pointerEvent;
    };

    headingLayer.dispatchEvent(createPointerEvent('pointerdown', 600));
    assert.equal(
      window.document.querySelector(
        '.oe-panel-email-template-editor-layer-placeholder'
      ),
      null
    );

    const headingBounds = headingLayer.getBoundingClientRect();
    headingDragHandle.dispatchEvent(
      createPointerEvent('pointerdown', headingBounds.top + 20)
    );
    assert.equal(headingLayer.classList.contains('is-live-dragging'), true);
    assert.equal(headingLayer.style.top, `${headingBounds.top}px`);

    const primaryActionLayer = window.document.querySelector(
      '[data-email-template-layer="primaryAction"]'
    );
    const primaryActionBounds = primaryActionLayer.getBoundingClientRect();
    window.dispatchEvent(
      createPointerEvent('pointermove', primaryActionBounds.top + 1)
    );
    const livePlaceholder = window.document.querySelector(
      '.oe-panel-email-template-editor-layer-placeholder'
    );
    assert.equal(livePlaceholder.nextElementSibling, primaryActionLayer);
    assert.equal(
      headingLayer.style.top,
      `${primaryActionBounds.top + 1 - 20}px`
    );

    const footerLayer = window.document.querySelector(
      '[data-email-template-layer="footer"]'
    );
    window.dispatchEvent(createPointerEvent('pointermove', 900));
    assert.equal(livePlaceholder.nextElementSibling, footerLayer);
    window.dispatchEvent(
      createPointerEvent('pointermove', primaryActionBounds.top + 1)
    );
    assert.equal(livePlaceholder.nextElementSibling, primaryActionLayer);

    window.dispatchEvent(
      createPointerEvent('pointerup', primaryActionBounds.top + 1)
    );
    assert.equal(
      window.document.querySelector(
        '.oe-panel-email-template-editor-layer-placeholder'
      ),
      null
    );
    const reorderedIds = Array.from(
      host.querySelectorAll('[data-email-template-section]'),
      (section) => section.dataset.emailTemplateSection
    );
    assert.ok(
      reorderedIds.indexOf('heading-2') < reorderedIds.indexOf('primaryAction')
    );

    window.document
      .querySelector('[data-email-template-panel="template-settings"]')
      .click();
    updateTemplateButton.click();
    assert.equal(updateTemplateButton.disabled, true);
    await new Promise((resolve) => window.setTimeout(resolve, 0));
    assert.equal(updateTemplateButton.disabled, false);
    assert.equal(apiRequests.length, 1);
    assert.equal(apiRequests[0].url, '/api/oe-panel/emails/templates');
    assert.equal(apiRequests[0].options.method, 'POST');
    assert.equal(
      Object.prototype.hasOwnProperty.call(apiRequests[0].body, 'version'),
      false
    );
    assert.equal(apiRequests[0].body.name, 'Campaign Template');
    assert.deepEqual(apiRequests[0].body.automationTriggers, [
      'password-reset-request'
    ]);
    assert.equal(
      apiRequests[0].body.sections.find((section) => section.type === 'logo')
        .settings.backgroundColour,
      '#123456'
    );
    assert.equal(
      apiRequests[0].body.sections.find((section) => section.id === 'heading')
        .settings.sectionSpacing,
      'none'
    );
    assert.equal(
      apiRequests[0].body.sections.find(
        (section) => section.type === 'primaryAction'
      ).settings.backgroundColourSource,
      'theme-secondary'
    );
    assert.equal(
      apiRequests[0].body.sections.find(
        (section) => section.type === 'primaryAction'
      ).settings.backgroundColour,
      '#123456'
    );
    assert.equal(
      apiRequests[0].body.sections.find((section) => section.type === 'divider')
        .settings.borderRadius,
      undefined
    );
    assert.equal(
      apiRequests[0].body.sections.find((section) => section.type === 'divider')
        .settings.thickness,
      undefined
    );
    assert.equal(
      apiRequests[0].body.sections.find((section) => section.type === 'divider')
        .settings.width,
      undefined
    );
    assert.equal(
      apiRequests[0].body.sections.find(
        (section) => section.type === 'primaryAction'
      ).settings.borderRadius,
      undefined
    );
    assert.equal(
      apiRequests[0].body.sections.at(-1).settings.dividerRadius,
      undefined
    );
    assert.equal(apiRequests[0].body.sections.at(-1).type, 'footer');
    assert.equal(
      new Set(apiRequests[0].body.sections.map((section) => section.id)).size,
      apiRequests[0].body.sections.length
    );
    assert.match(
      host.querySelector('.oe-panel-email-template-editor-status').textContent,
      /Template updated/
    );
    assert.deepEqual(clearedDataKeys, ['emailTemplates']);
    assert.match(
      window.document.querySelector(
        '.oe-panel-email-template-settings-workflow'
      ).textContent,
      /Unpublished.*02 Aug 2026/s
    );
    assert.equal(
      window.document.querySelector(
        '.oe-panel-email-template-settings-action.delete'
      ).disabled,
      false
    );

    window.document
      .querySelector('.oe-panel-email-template-settings-action.test-send')
      .click();
    await new Promise((resolve) => window.setTimeout(resolve, 0));
    assert.equal(apiRequests.length, 2);
    assert.equal(
      apiRequests[1].url,
      '/api/oe-panel/emails/templates/template-1/test-send'
    );
    assert.equal(apiRequests[1].body.recipient, 'qa-recipient@example.com');
    assert.match(
      host.querySelector('.oe-panel-email-template-editor-status').textContent,
      /Test sent to qa-recipient@example\.com/
    );

    window.document
      .querySelector('.oe-panel-email-template-settings-action.duplicate')
      .click();
    await new Promise((resolve) => window.setTimeout(resolve, 0));
    assert.equal(apiRequests.length, 3);
    assert.equal(
      apiRequests[2].url,
      '/api/oe-panel/emails/templates/template-1/duplicate'
    );
    assert.equal(apiRequests[2].options.method, 'POST');
    assert.equal(
      host.querySelector('.oe-panel-email-template-editor-template-name')
        .textContent,
      'Campaign Template Copy'
    );
    assert.match(
      host.querySelector('.oe-panel-email-template-editor-status').textContent,
      /Duplicate created · Unpublished/
    );
    assert.match(
      window.document.querySelector(
        '.oe-panel-email-template-settings-workflow'
      ).textContent,
      /Unpublished.*02 Aug 2026/s
    );
    assert.deepEqual(clearedDataKeys, ['emailTemplates', 'emailTemplates']);

    window.document
      .querySelector('.oe-panel-email-template-editor-inspector-back')
      .click();
    window.document
      .querySelector('.oe-panel-email-template-editor-inspector-back')
      .click();
    assert.equal(restoreCalls, 1);
    assert.equal(shrinkRequests, 1);
    assert.equal(
      container.classList.contains('is-email-template-editor'),
      false
    );
    assert.equal(
      window.document.querySelector(
        '.oe-panel-email-template-editor-inspector'
      ),
      null
    );
    assert.match(host.textContent, /Templates submenu restored/);

    container.dataset.oePanelGrid = 'emails-grid-4';
    window.dispatchEvent(
      new window.CustomEvent('oe-panel-table-row-action', {
        detail: {
          action: 'open-email-template',
          row: { templateId: 'template-1' }
        }
      })
    );
    await new Promise((resolve) => window.setTimeout(resolve, 0));
    assert.equal(apiRequests.length, 4);
    assert.equal(
      apiRequests[3].url,
      '/api/oe-panel/emails/templates/template-1'
    );
    assert.ok(container.classList.contains('is-email-template-editor'));
    assert.equal(
      host.querySelector('.oe-panel-email-template-editor-template-name')
        .textContent,
      'Saved Email Template'
    );

    window.document
      .querySelector('[data-email-template-panel="template-settings"]')
      .click();
    const loadedTemplateNameInput = window.document.getElementById(
      'email-template-template-settings-templateName'
    );
    loadedTemplateNameInput.value = 'Updated Email Template';
    loadedTemplateNameInput.dispatchEvent(
      new window.Event('input', { bubbles: true })
    );
    const beforeUnloadEvent = new window.Event('beforeunload', {
      cancelable: true
    });
    window.dispatchEvent(beforeUnloadEvent);
    assert.equal(beforeUnloadEvent.defaultPrevented, true);

    window.document
      .querySelector('.oe-panel-email-template-editor-inspector-back')
      .click();
    const confirmMessages = [];
    let confirmResponses = [false, false];
    window.confirm = (message) => {
      confirmMessages.push(message);
      return confirmResponses.shift();
    };
    window.document
      .querySelector('.oe-panel-email-template-editor-inspector-back')
      .click();
    await new Promise((resolve) => window.setTimeout(resolve, 0));
    assert.equal(
      container.classList.contains('is-email-template-editor'),
      true
    );
    assert.match(confirmMessages[0], /Save them before leaving/);
    assert.match(confirmMessages[1], /Discard your unsaved/);

    confirmResponses = [true];
    window.document
      .querySelector('.oe-panel-email-template-editor-inspector-back')
      .click();
    await new Promise((resolve) => window.setTimeout(resolve, 0));
    assert.equal(apiRequests.length, 5);
    assert.equal(
      apiRequests[4].url,
      '/api/oe-panel/emails/templates/template-1'
    );
    assert.equal(apiRequests[4].options.method, 'PATCH');
    assert.equal(apiRequests[4].body.version, undefined);
    assert.equal(apiRequests[4].body.name, 'Updated Email Template');
    assert.equal(shrinkRequests, 2);
    assert.match(host.textContent, /Templates submenu restored/);

    window.dispatchEvent(
      new window.CustomEvent('oe-panel-table-row-action', {
        detail: {
          action: 'open-email-template',
          row: { templateId: 'template-1' }
        }
      })
    );
    await new Promise((resolve) => window.setTimeout(resolve, 0));
    assert.equal(apiRequests.length, 6);
    window.document
      .querySelector('[data-email-template-panel="template-settings"]')
      .click();
    const discardNameInput = window.document.getElementById(
      'email-template-template-settings-templateName'
    );
    discardNameInput.value = 'Discard This Change';
    discardNameInput.dispatchEvent(
      new window.Event('input', { bubbles: true })
    );
    window.document
      .querySelector('.oe-panel-email-template-editor-inspector-back')
      .click();
    confirmResponses = [false, true];
    window.document
      .querySelector('.oe-panel-email-template-editor-inspector-back')
      .click();
    await new Promise((resolve) => window.setTimeout(resolve, 0));
    assert.equal(apiRequests.length, 6);
    assert.equal(shrinkRequests, 3);
    assert.match(host.textContent, /Templates submenu restored/);
  } finally {
    dom.window.close();
  }
});
