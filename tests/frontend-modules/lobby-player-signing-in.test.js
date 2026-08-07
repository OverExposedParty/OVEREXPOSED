const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { JSDOM } = require('jsdom');

test('reconnecting lobby players show the disconnect wheel as signing in', () => {
  const dom = new JSDOM('<!doctype html><body><div id="users"></div></body>', {
    runScripts: 'dangerously',
    url: 'https://overexposed.app/ABC-123'
  });
  const { window } = dom;

  try {
    window.eval(
      fs.readFileSync(
        path.join(
          __dirname,
          '../../public/scripts/general/online/lobby-player-list.js'
        ),
        'utf8'
      )
    );
    const [tile] = window.OELobbyPlayerList.render(
      window.document.getElementById('users'),
      [
        {
          identity: {
            computerId: 'guest-player',
            username: 'OE4534534',
            userIcon: '0001:0102:0203:0304'
          },
          connection: { socketId: 'guest-socket' },
          state: { participationStatus: 'reconnecting' }
        }
      ]
    );

    assert.equal(tile.dataset.disconnected, 'true');
    assert.equal(tile.dataset.signingIn, 'true');
    assert.ok(tile.querySelector('.disconnect-status-icon'));
    assert.equal(
      tile.querySelector('.checkmark').getAttribute('aria-label'),
      'Signing in'
    );
  } finally {
    dom.window.close();
  }
});
