const crypto = require('crypto');

const MATCH_CODE_PATTERN = /^[A-Z0-9]{3}-[A-Z0-9]{3}$/;
const MATCH_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function normalizeMatchCode(value) {
  return String(value || '')
    .trim()
    .toUpperCase();
}

function assertMatchCode(value) {
  const matchCode = normalizeMatchCode(value);
  if (!MATCH_CODE_PATTERN.test(matchCode)) {
    const error = new Error('Enter a valid Oling Clash code.');
    error.status = 400;
    error.code = 'invalid_oling_clash_code';
    throw error;
  }
  return matchCode;
}

function generateMatchCode(randomInt = crypto.randomInt) {
  const characters = Array.from(
    { length: 6 },
    () => MATCH_CODE_ALPHABET[randomInt(0, MATCH_CODE_ALPHABET.length)]
  );
  return `${characters.slice(0, 3).join('')}-${characters.slice(3).join('')}`;
}

async function generateUniqueMatchCode(model, attempts = 20) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const matchCode = generateMatchCode();
    if (!(await model.exists({ matchCode }))) return matchCode;
  }
  const error = new Error('Could not reserve an Oling Clash code.');
  error.status = 503;
  error.code = 'oling_clash_code_unavailable';
  throw error;
}

module.exports = {
  MATCH_CODE_PATTERN,
  assertMatchCode,
  generateMatchCode,
  generateUniqueMatchCode,
  normalizeMatchCode
};
