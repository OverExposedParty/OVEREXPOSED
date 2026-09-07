const assert = require('node:assert/strict');
const test = require('node:test');

const {
  getOlingLabAccess,
  normalizeOlingLabVisibility
} = require('../../server/services/oling-lab-access');

function account(id, visibility, relationships = []) {
  return {
    _id: id,
    username: `user-${id}`,
    olings: { lab: { visibility } },
    gameData: { friendsAndBlockedUsers: relationships }
  };
}

test('Oling Lab visibility defaults safely to private', () => {
  assert.equal(normalizeOlingLabVisibility(), 'private');
  assert.equal(normalizeOlingLabVisibility('unknown'), 'private');
  assert.equal(normalizeOlingLabVisibility('FRIENDS-ONLY'), 'friends-only');
});

test('public Oling Labs are visible without an account', () => {
  assert.equal(getOlingLabAccess(account('owner', 'public')).allowed, true);
});

test('private Oling Labs remain visible to their owner only', () => {
  const owner = account('owner', 'private');
  assert.equal(getOlingLabAccess(owner, owner).allowed, true);
  assert.deepEqual(getOlingLabAccess(owner, account('viewer', 'public')), {
    allowed: false,
    isOwner: false,
    reason: 'oling_lab_private',
    showSignIn: false,
    targetUsername: 'user-owner',
    visibility: 'private'
  });
});

test('friends-only Oling Labs require an accepted friendship', () => {
  const viewer = account('viewer', 'private');
  const owner = account('owner', 'friends-only', [
    { accountId: viewer._id, status: 'friends' }
  ]);
  assert.equal(getOlingLabAccess(owner, viewer).allowed, true);
  assert.equal(
    getOlingLabAccess(owner, account('stranger', 'public')).reason,
    'oling_lab_friends_only'
  );
  assert.equal(getOlingLabAccess(owner).showSignIn, true);
});
