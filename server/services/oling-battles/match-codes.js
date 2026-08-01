const {
  DEFAULT_MATCH_LENGTH_SECONDS,
  MATCH_CODE_ALPHABET,
  MATCH_CODE_PATTERN
} = require('./constants');

function normalizeMatchCode(value) {
  return String(value || '')
    .trim()
    .toUpperCase();
}

function assertMatchCode(matchCode) {
  if (!MATCH_CODE_PATTERN.test(normalizeMatchCode(matchCode))) {
    const error = new Error('matchCode must match XXX-XXX');
    error.status = 400;
    error.code = 'oling_battle_match_code_invalid';
    throw error;
  }
}

function normalizeMatchLengthSeconds(value) {
  const seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return DEFAULT_MATCH_LENGTH_SECONDS;
  }
  return Math.round(seconds);
}

function generateMatchCode() {
  const values = Array.from({ length: 6 }, () =>
    Math.floor(Math.random() * MATCH_CODE_ALPHABET.length)
  );
  const raw = values
    .map((value) => MATCH_CODE_ALPHABET[value % MATCH_CODE_ALPHABET.length])
    .join('');
  return `${raw.slice(0, 3)}-${raw.slice(3)}`;
}

async function generateUniqueMatchCode(OlingBattleMatch) {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const matchCode = generateMatchCode();
    const exists = await OlingBattleMatch.exists({ matchCode });
    if (!exists) return matchCode;
  }

  const error = new Error('Could not generate a unique Oling battle code.');
  error.status = 500;
  error.code = 'oling_battle_match_code_failed';
  throw error;
}

module.exports = {
  assertMatchCode,
  generateMatchCode,
  generateUniqueMatchCode,
  normalizeMatchCode,
  normalizeMatchLengthSeconds
};
