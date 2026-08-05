const assert = require('node:assert/strict');
const test = require('node:test');

const {
  createPartyGameId,
  getPartyGameIdPrefix
} = require('../../server/game-engine/party-runtime/game-session');

test('party game IDs use stable gamemode prefixes and server randomness', () => {
  const randomBytes = () => Buffer.from('0123456789abcdef', 'hex');

  assert.equal(getPartyGameIdPrefix('truth-or-dare'), 'TOD');
  assert.equal(getPartyGameIdPrefix('custom-mode'), 'CM');
  assert.equal(
    createPartyGameId('truth-or-dare', randomBytes),
    'TOD-0123456789ABCDEF'
  );
});
