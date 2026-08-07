const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { JSDOM } = require('jsdom');

const releaseActionsScript = fs.readFileSync(
  path.join(
    __dirname,
    '../../public/scripts/oe-panel/party-games/game-mode-release-actions.js'
  ),
  'utf8'
);

test('game-mode release action submits the expected version and refreshes the panel', async () => {
  const dom = new JSDOM('<!doctype html>', { runScripts: 'dangerously' });
  const { window } = dom;
  const requests = [];
  const alerts = [];
  let refreshCount = 0;

  try {
    window.confirm = () => true;
    window.prompt = () => 'Fixes voting recovery.';
    window.alert = (message) => alerts.push(message);
    window.fetch = async (url, options) => {
      requests.push({ url, options });
      return {
        ok: true,
        async json() {
          return {
            success: true,
            data: {
              message: 'Paranoia released as v1.3.0.',
              row: {
                configuredVersion: 'v1.3.0',
                configuredVersionRaw: '1.3.0'
              }
            }
          };
        }
      };
    };
    window.addEventListener('oe-panel-party-games-data-changed', () => {
      refreshCount += 1;
    });
    window.eval(releaseActionsScript);

    const row = {
      gamemode: 'Paranoia',
      gamemodeKey: 'paranoia',
      configuredVersionRaw: '1.2.4'
    };
    window.dispatchEvent(
      new window.CustomEvent('oe-panel-table-row-action', {
        detail: {
          action: 'bump-version-minor',
          gridId: 'party-games-grid-1',
          row
        }
      })
    );
    await new Promise((resolve) => window.setTimeout(resolve, 0));
    await new Promise((resolve) => window.setTimeout(resolve, 0));

    assert.equal(requests[0].url, '/api/oe-panel/game-modes/paranoia/version');
    assert.deepEqual(JSON.parse(requests[0].options.body), {
      bump: 'minor',
      expectedVersion: '1.2.4',
      releaseNote: 'Fixes voting recovery.'
    });
    assert.equal(row.configuredVersionRaw, '1.3.0');
    assert.equal(refreshCount, 1);
    assert.match(alerts[0], /v1\.3\.0/);
  } finally {
    dom.window.close();
  }
});
