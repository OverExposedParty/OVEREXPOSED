function parseBooleanLabel(value) {
  const normalized = String(value || '')
    .trim()
    .toLowerCase();
  if (['yes', 'true', 'published', 'active', '1'].includes(normalized)) {
    return true;
  }
  if (['no', 'false', 'draft', 'inactive', '0'].includes(normalized)) {
    return false;
  }
  return null;
}

function parseNullableNumber(value) {
  const text = String(value || '').trim();
  if (!text || text === '-') return null;
  const number = Number(text);
  return Number.isFinite(number) ? number : NaN;
}

function parseRestrictionList(value) {
  return String(value || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function normalizePackHexColour(value, fallback, label) {
  const colour = String(value || '').trim();
  if (!colour) return { colour: fallback };
  if (/^#[0-9a-f]{6}$/i.test(colour)) return { colour };

  return { error: `${label} must be a 6-digit hex code.` };
}

module.exports = {
  normalizePackHexColour,
  parseBooleanLabel,
  parseNullableNumber,
  parseRestrictionList
};
