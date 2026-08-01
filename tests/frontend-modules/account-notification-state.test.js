const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const { JSDOM } = require('jsdom');

const stateSource = fs.readFileSync(
  path.join(
    __dirname,
    '../../public/scripts/general/notifications/account-notification-state.js'
  ),
  'utf8'
);

test('account notification state aggregates account and future friend-chat unread counts', () => {
  const dom = new JSDOM('<!doctype html><body></body>', {
    runScripts: 'outside-only',
    url: 'https://overexposed.app/'
  });
  const context = dom.getInternalVMContext();
  const snapshots = [];

  dom.window.addEventListener('oe-notification-count-changed', (event) => {
    snapshots.push(event.detail);
  });
  new vm.Script(stateSource).runInContext(context);

  dom.window.OEAccountNotificationState.setAccountNotifications({
    notifications: [{ id: 'notification-one' }],
    unreadCount: 3
  });
  dom.window.OEAccountNotificationState.setFriendChatUnreadCount(2);

  const snapshot = dom.window.OEAccountNotificationState.getSnapshot();
  assert.equal(snapshot.totalUnread, 5);
  assert.equal(snapshot.counts.accountNotifications, 3);
  assert.equal(snapshot.counts.friendChatUnread, 2);
  assert.equal(snapshot.inboxNotifications.length, 1);
  assert.equal(snapshots.at(-1).totalUnread, 5);

  dom.window.dispatchEvent(
    new dom.window.CustomEvent('oe-account-state-changed', {
      detail: { account: null }
    })
  );
  assert.equal(
    dom.window.OEAccountNotificationState.getSnapshot().totalUnread,
    0
  );
  dom.window.close();
});
