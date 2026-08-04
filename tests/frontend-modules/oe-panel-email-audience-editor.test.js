const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { JSDOM } = require('jsdom');

const editorSource = fs.readFileSync(
  path.join(
    __dirname,
    '../../public/scripts/oe-panel/email-audience-editor/email-audience-editor.js'
  ),
  'utf8'
);

test('email audience editor previews filters and creates an audience', async () => {
  const dom = new JSDOM(
    '<!doctype html><main data-oe-panel-grid="emails-grid-4"><div class="oe-panel-widget"></div></main>',
    { runScripts: 'dangerously' }
  );
  const { window } = dom;
  const requests = [];
  let restored = 0;

  try {
    window.fetch = async (url, options = {}) => {
      requests.push({ url, options, body: JSON.parse(options.body || '{}') });
      return {
        ok: true,
        async json() {
          if (url.endsWith('/preview')) {
            return {
              success: true,
              data: {
                matchedCount: 12,
                suppressedCount: 2,
                eligibleCount: 10,
                preview: [
                  {
                    username: 'alex',
                    displayName: 'Alex',
                    email: 'alex@example.com'
                  }
                ]
              }
            };
          }
          return { success: true, data: { audience: { id: 'audience-1' } } };
        }
      };
    };
    window.eval(editorSource);
    const container = window.document.querySelector(
      '[data-oe-panel-grid="emails-grid-4"]'
    );
    const host = container.querySelector('.oe-panel-widget');
    window.dispatchEvent(
      new window.CustomEvent('oe-panel-email-audience-editor-request', {
        detail: {
          container,
          host,
          restore() {
            restored += 1;
          }
        }
      })
    );

    assert.ok(host.classList.contains('oe-panel-widget-form'));
    assert.ok(
      host
        .querySelector('.oe-panel-email-audience-form')
        .classList.contains('oe-panel-social-edit-panels')
    );
    assert.ok(
      host
        .querySelector('.oe-panel-email-audience-field')
        .classList.contains('oe-panel-social-edit-meta-field')
    );
    assert.ok(
      host
        .querySelector('.oe-panel-email-audience-section')
        .classList.contains('oe-panel-social-edit-panel')
    );
    assert.ok(
      host
        .querySelector('.oe-panel-email-audience-primary-action')
        .classList.contains('oe-panel-social-edit-save')
    );

    const nameInput = host.querySelector('input[type="text"]');
    nameInput.value = 'Verified Players';
    nameInput.dispatchEvent(new window.Event('input', { bubbles: true }));
    host
      .querySelector('.oe-panel-email-audience-section.preview button')
      .click();
    await new Promise((resolve) => window.setTimeout(resolve, 0));

    assert.match(
      host.querySelector('.oe-panel-email-audience-counts').textContent,
      /Matched12Suppressed2Eligible10/
    );
    assert.match(host.textContent, /alex@example\.com/);
    assert.equal(requests[0].body.requireMarketingConsent, true);
    assert.deepEqual(requests[0].body.conditions, [
      { field: 'emailVerified', operator: 'is', value: 'true' }
    ]);

    const typeSelect = Array.from(host.querySelectorAll('select')).find(
      (select) =>
        Array.from(select.options).some((option) => option.value === 'manual')
    );
    typeSelect.value = 'manual';
    typeSelect.dispatchEvent(new window.Event('change', { bubbles: true }));
    assert.equal(
      host.querySelector('.oe-panel-email-audience-section.rules').hidden,
      true
    );
    const manualInput = host.querySelector(
      '.oe-panel-email-audience-section.manual textarea'
    );
    manualInput.value = 'alex@example.com';
    host
      .querySelector('form')
      .dispatchEvent(
        new window.Event('submit', { bubbles: true, cancelable: true })
      );
    await new Promise((resolve) => window.setTimeout(resolve, 0));

    assert.equal(requests.at(-1).url, '/api/oe-panel/emails/audiences');
    assert.equal(requests.at(-1).body.type, 'manual');
    assert.equal(requests.at(-1).body.manualIdentifiers, 'alex@example.com');
    assert.equal(restored, 1);
  } finally {
    dom.window.close();
  }
});
