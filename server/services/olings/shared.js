const path = require('path');
const {
  OLING_LAB_ACTIVE_LIMIT,
  OLING_POD_RELEASE_OUTCOMES,
  OLING_RESIDENCY_STATES
} = require('../../../models/olings/oling-storage-contract');

const OLING_LAYERS = ['flight', 'body', 'eyes', 'mouth'];
const OLING_RARITIES = [
  'common',
  'uncommon',
  'rare',
  'epic',
  'legendary',
  'mythic'
];
const OLING_MAX_ENERGY = 100;
const OLING_REST_DURATION_MS = Object.freeze({
  common: 10 * 60 * 60 * 1000,
  uncommon: 8 * 60 * 60 * 1000,
  rare: 6 * 60 * 60 * 1000,
  epic: 4.5 * 60 * 60 * 1000,
  legendary: 3 * 60 * 60 * 1000,
  mythic: 2 * 60 * 60 * 1000
});
const ENERGY_RESTORE_THRESHOLDS = Object.freeze({
  common: 25,
  uncommon: 50,
  rare: 75,
  epic: 90,
  legendary: 100,
  mythic: 100
});
const OLING_DEFINITIONS_ROOT = path.join(
  process.cwd(),
  'public',
  'json-files',
  'olings'
);
const OLING_CONSUMABLES_FILE = path.join(
  OLING_DEFINITIONS_ROOT,
  'consumables.json'
);
const OLING_CLASH_ABILITIES_FILE = path.join(
  OLING_DEFINITIONS_ROOT,
  'clash-abilities.json'
);
const OLING_CLASH_RULESETS_FILE = path.join(
  OLING_DEFINITIONS_ROOT,
  'clash-rulesets.json'
);
const OLING_CLASH_STATUSES_FILE = path.join(
  OLING_DEFINITIONS_ROOT,
  'clash-statuses.json'
);
const STARTER_OLING_EGG_KEY = 'base-egg';

function normalizeKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase();
}

function toPlainObject(document) {
  if (!document) return null;
  return document.toObject ? document.toObject() : document;
}

module.exports = {
  OLING_LAB_ACTIVE_LIMIT,
  OLING_LAYERS,
  OLING_POD_RELEASE_OUTCOMES,
  OLING_RARITIES,
  OLING_RESIDENCY_STATES,
  OLING_MAX_ENERGY,
  OLING_REST_DURATION_MS,
  ENERGY_RESTORE_THRESHOLDS,
  OLING_DEFINITIONS_ROOT,
  OLING_CONSUMABLES_FILE,
  OLING_CLASH_ABILITIES_FILE,
  OLING_CLASH_RULESETS_FILE,
  OLING_CLASH_STATUSES_FILE,
  STARTER_OLING_EGG_KEY,
  normalizeKey,
  toPlainObject
};
