const crypto = require('crypto');

const GAME_ID_PREFIXES = Object.freeze({
  imposter: 'IMP',
  mafia: 'MAF',
  'most-likely-to': 'MLT',
  'never-have-i-ever': 'NHIE',
  paranoia: 'PAR',
  'truth-or-dare': 'TOD',
  'would-you-rather': 'WYR'
});

function getPartyGameIdPrefix(gamemode) {
  if (GAME_ID_PREFIXES[gamemode]) return GAME_ID_PREFIXES[gamemode];

  return (
    String(gamemode || 'GAME')
      .split(/[^a-zA-Z0-9]+/)
      .filter(Boolean)
      .map((part) => part[0])
      .join('')
      .slice(0, 6)
      .toUpperCase() || 'GAME'
  );
}

function createPartyGameId(gamemode, randomBytes = crypto.randomBytes) {
  const suffix = randomBytes(8).toString('hex').toUpperCase();
  return `${getPartyGameIdPrefix(gamemode)}-${suffix}`;
}

module.exports = {
  createPartyGameId,
  getPartyGameIdPrefix
};
