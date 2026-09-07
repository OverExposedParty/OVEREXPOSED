const MAX_INCUBATOR_INFLUENCE_SLOTS = 8;
const INFLUENCE_SLOT_KEY_PREFIX = 'influence-';

function getIncubatorInfluenceSlotCount(incubator) {
  const requested = Number(incubator?.influenceSlotCount || 0);
  if (!Number.isFinite(requested)) return 0;
  return Math.max(
    0,
    Math.min(MAX_INCUBATOR_INFLUENCE_SLOTS, Math.floor(requested))
  );
}

function getIncubatorInfluenceSlotDefinitions(incubator) {
  const count = getIncubatorInfluenceSlotCount(incubator);
  return Array.from({ length: count }, (_, index) => ({
    key: `${INFLUENCE_SLOT_KEY_PREFIX}${index + 1}`,
    label: count === 1 ? 'Influence Slot' : `Influence Slot ${index + 1}`
  }));
}

const DEFAULT_HATCH_DURATION_MS = 2 * 60 * 60 * 1000;

module.exports = {
  INFLUENCE_SLOT_KEY_PREFIX,
  MAX_INCUBATOR_INFLUENCE_SLOTS,
  getIncubatorInfluenceSlotCount,
  getIncubatorInfluenceSlotDefinitions,
  DEFAULT_HATCH_DURATION_MS
};
