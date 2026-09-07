const OLING_LAB_ACTIVE_LIMIT = 6;

const OLING_RESIDENCY_STATES = Object.freeze(['active', 'stored']);

const OLING_POD_RELEASE_OUTCOMES = Object.freeze([
  'destroy',
  'return-to-inventory'
]);

module.exports = {
  OLING_LAB_ACTIVE_LIMIT,
  OLING_RESIDENCY_STATES,
  OLING_POD_RELEASE_OUTCOMES
};
