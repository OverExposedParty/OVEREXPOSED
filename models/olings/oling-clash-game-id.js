const crypto = require('crypto');

const OLING_CLASH_GAME_ID_PATTERN = /^OCL-[A-F0-9]{32}$/;

function createOlingClashGameId(randomBytes = crypto.randomBytes) {
  return `OCL-${randomBytes(16).toString('hex').toUpperCase()}`;
}

module.exports = {
  OLING_CLASH_GAME_ID_PATTERN,
  createOlingClashGameId
};
