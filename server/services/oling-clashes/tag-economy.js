const DEFAULT_MAXIMUM_TAG_CHARGES = 2;
const DEFAULT_DECISIVE_CLASHES_PER_TAG_CHARGE = 3;

function toInteger(value, fallback, minimum = 0) {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? Math.max(minimum, parsed) : fallback;
}

function getTagRules(source = {}) {
  const tagging =
    source?.ruleset?.snapshot?.tagging ||
    source?.snapshot?.tagging ||
    source?.tagging ||
    {};
  return {
    maximumCharges: toInteger(
      tagging.maximumCharges,
      DEFAULT_MAXIMUM_TAG_CHARGES
    ),
    decisiveClashesPerCharge: toInteger(
      tagging.decisiveClashesPerCharge,
      DEFAULT_DECISIVE_CLASHES_PER_TAG_CHARGE,
      1
    )
  };
}

function createInitialTagState(source = {}) {
  const rules = getTagRules(source);
  return {
    tagCharges: rules.maximumCharges,
    tagRechargeProgress: 0
  };
}

function normalizeTagState(player, source = {}) {
  const rules = getTagRules(source);
  const rawCharges = Number(player?.tagCharges);
  const rawProgress = Number(player?.tagRechargeProgress);
  const charges = Number.isInteger(rawCharges)
    ? Math.min(rules.maximumCharges, Math.max(0, rawCharges))
    : rules.maximumCharges;
  const rechargeProgress =
    charges >= rules.maximumCharges
      ? 0
      : Number.isInteger(rawProgress)
        ? Math.min(rules.decisiveClashesPerCharge - 1, Math.max(0, rawProgress))
        : 0;

  if (player) {
    player.tagCharges = charges;
    player.tagRechargeProgress = rechargeProgress;
  }
  return { charges, rechargeProgress, ...rules };
}

function resetTagState(player, source = {}) {
  const initial = createInitialTagState(source);
  if (player) Object.assign(player, initial);
  return normalizeTagState(player, source);
}

function hasTagCharge(player, source = {}) {
  return normalizeTagState(player, source).charges > 0;
}

function consumeTagCharge(player, source = {}) {
  const state = normalizeTagState(player, source);
  if (!player || state.charges <= 0) return false;
  player.tagCharges = state.charges - 1;
  return true;
}

function advanceTagRecharge(player, source = {}, { eligible = true } = {}) {
  const before = normalizeTagState(player, source);
  if (!player || !eligible || before.charges >= before.maximumCharges) {
    return null;
  }

  let charges = before.charges;
  let rechargeProgress = before.rechargeProgress + 1;
  let restoredCharges = 0;
  if (rechargeProgress >= before.decisiveClashesPerCharge) {
    charges = Math.min(before.maximumCharges, charges + 1);
    rechargeProgress = 0;
    restoredCharges = charges - before.charges;
  }
  player.tagCharges = charges;
  player.tagRechargeProgress = rechargeProgress;
  return {
    playerSlot: player.slot,
    charges,
    rechargeProgress,
    maximumCharges: before.maximumCharges,
    decisiveClashesPerCharge: before.decisiveClashesPerCharge,
    restoredCharges
  };
}

module.exports = {
  DEFAULT_DECISIVE_CLASHES_PER_TAG_CHARGE,
  DEFAULT_MAXIMUM_TAG_CHARGES,
  advanceTagRecharge,
  consumeTagCharge,
  createInitialTagState,
  getTagRules,
  hasTagCharge,
  normalizeTagState,
  resetTagState
};
