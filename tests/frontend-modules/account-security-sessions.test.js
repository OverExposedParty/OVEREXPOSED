const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const { JSDOM } = require('jsdom');

const scriptDirectory = path.join(
  __dirname,
  '../../public/scripts/general/account-container'
);

function loadScript(context, filename) {
  const source = fs.readFileSync(path.join(scriptDirectory, filename), 'utf8');
  new vm.Script(source, { filename }).runInContext(context);
}

test('account security panel renders current and revocable sessions', async () => {
  const dom = new JSDOM(
    '<!doctype html><body><div id="account-expanded-content"></div></body>',
    { runScripts: 'outside-only', url: 'https://overexposed.app/' }
  );
  const context = dom.getInternalVMContext();
  const requests = [];
  context.accountExpandedContent = dom.window.document.getElementById(
    'account-expanded-content'
  );
  context.setAccountFooterHint = () => {};
  context.fetch = async (url, options = {}) => {
    requests.push({ url, options });
    return {
      ok: true,
      async json() {
        return {
          sessions: [
            {
              id: 'current-session-id-1',
              manageable: true,
              current: true,
              device: {
                browser: 'Chrome 126',
                os: 'Windows',
                deviceType: 'Desktop'
              },
              createdAt: '2026-07-30T12:00:00.000Z',
              lastUsedAt: new Date().toISOString()
            },
            {
              id: 'another-session-id1',
              manageable: true,
              current: false,
              device: {
                browser: 'Safari 18',
                os: 'iOS 18',
                deviceType: 'Mobile'
              },
              createdAt: '2026-07-29T12:00:00.000Z',
              lastUsedAt: '2026-07-31T11:00:00.000Z'
            }
          ]
        };
      }
    };
  };

  loadScript(context, 'account-container-core.js');
  loadScript(context, 'account-container-security.js');
  vm.runInContext("accountExpandedAction = 'security'", context);
  await vm.runInContext('renderAccountSecurityPanel()', context);

  const content = context.accountExpandedContent;
  assert.equal(content.querySelectorAll('.account-security-session').length, 2);
  assert.equal(
    content.querySelector('.account-security-current-label').textContent,
    'This device'
  );
  assert.equal(
    content.querySelector('.account-security-session-action').textContent,
    'Sign out'
  );
  assert.equal(
    content.querySelector('.account-security-logout-others').disabled,
    false
  );
  assert.equal(requests[0].url, '/api/accounts/sessions');

  dom.window.close();
});
