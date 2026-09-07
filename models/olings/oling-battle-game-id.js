const crypto = require('crypto');

const OLING_BATTLE_GAME_ID_PATTERN = /^OBT-[A-F0-9]{32}$/;

function createOlingBattleGameId(randomBytes = crypto.randomBytes) {
  return `OBT-${randomBytes(16).toString('hex').toUpperCase()}`;
}

module.exports = {
  OLING_BATTLE_GAME_ID_PATTERN,
  createOlingBattleGameId
};
