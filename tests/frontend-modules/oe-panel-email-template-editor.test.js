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

test('email template editor expands its action grid, persists drafts, and swaps the sidebar inspector', async () => {
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

  try {
    window.fetch = async (url, options = {}) => {
      const body = options.body ? JSON.parse(options.body) : {};
      apiRequests.push({ url: String(url), options, body });
      const template = options.method
        ? { id: 'template-1', ...body, status: 'draft', version: 1 }
        : {
            id: 'template-1',
            ...(apiRequests[0]?.body || {}),
            name: 'Saved Email Template',
            status: 'draft',
            version: 1
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
      host.querySelectorAll('[data-email-template-section]').length,
      6
    );
    assert.match(
      host.querySelector('.oe-panel-email-preview-heading').style.fontFamily,
      /OverExposed/
    );
    assert.match(
      host.querySelector('.oe-panel-email-preview-subheading').style.fontFamily,
      /LemonMilk/
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

    const headingInput = window.document.getElementById(
      'email-template-heading-text'
    );
    headingInput.value = 'THE NEXT OVEREXPOSED DROP';
    headingInput.dispatchEvent(new window.Event('input', { bubbles: true }));
    assert.equal(
      host.querySelector('.oe-panel-email-preview-heading').textContent,
      'THE NEXT OVEREXPOSED DROP'
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
      window.document.getElementById('email-template-content-text'),
      null
    );

    const mobileButton = Array.from(
      host.querySelectorAll('.oe-panel-email-template-editor-viewport')
    ).find((button) => button.textContent === 'Mobile');
    mobileButton.click();
    assert.ok(host.querySelector('.oe-panel-email-preview-frame.mobile'));

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

    host.querySelector('[data-email-template-section="footer"]').click();
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
    assert.ok(headingLayer.draggable);
    headingLayer.querySelector('[aria-label="Move Heading up"]').click();
    const reorderedIds = Array.from(
      host.querySelectorAll('[data-email-template-section]'),
      (section) => section.dataset.emailTemplateSection
    );
    assert.ok(
      reorderedIds.indexOf('heading-2') < reorderedIds.indexOf('primaryAction')
    );

    host.querySelector('.oe-panel-email-template-editor-save').click();
    await new Promise((resolve) => window.setTimeout(resolve, 0));
    assert.equal(apiRequests.length, 1);
    assert.equal(apiRequests[0].url, '/api/oe-panel/emails/templates');
    assert.equal(apiRequests[0].options.method, 'POST');
    assert.equal(
      Object.prototype.hasOwnProperty.call(apiRequests[0].body, 'version'),
      false
    );
    assert.equal(apiRequests[0].body.name, 'Untitled Email Template');
    assert.equal(apiRequests[0].body.sections.at(-1).type, 'footer');
    assert.equal(
      new Set(apiRequests[0].body.sections.map((section) => section.id)).size,
      apiRequests[0].body.sections.length
    );
    assert.match(
      host.querySelector('.oe-panel-email-template-editor-status').textContent,
      /Draft saved · v1/
    );

    host.querySelector('.oe-panel-email-template-editor-exit').click();
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
    assert.equal(apiRequests.length, 2);
    assert.equal(
      apiRequests[1].url,
      '/api/oe-panel/emails/templates/template-1'
    );
    assert.ok(container.classList.contains('is-email-template-editor'));
    assert.equal(
      host.querySelector('.oe-panel-email-template-editor-template-name').value,
      'Saved Email Template'
    );

    host.querySelector('.oe-panel-email-template-editor-exit').click();
    assert.equal(shrinkRequests, 2);
    assert.match(host.textContent, /Templates submenu restored/);
  } finally {
    dom.window.close();
  }
});
