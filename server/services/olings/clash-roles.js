const {
  CLASH_LAYERS,
  CLASH_ROLE_TAGS
} = require('../../../models/olings/oling-clash-constants');
const { normalizeKey } = require('./shared');

const roleOrder = new Map(
  CLASH_ROLE_TAGS.map((roleKey, index) => [roleKey, index])
);

function getAbilityForTrait(abilitiesByTraitKey, traitKey) {
  if (!traitKey || !abilitiesByTraitKey) return null;
  if (abilitiesByTraitKey instanceof Map) {
    return abilitiesByTraitKey.get(traitKey) || null;
  }
  return abilitiesByTraitKey[traitKey] || null;
}

function scoreClashRoles(build = {}, abilitiesByTraitKey = new Map()) {
  const scores = new Map();

  for (const layer of CLASH_LAYERS) {
    const traitKey = normalizeKey(build[layer]);
    const ability = getAbilityForTrait(abilitiesByTraitKey, traitKey);
    const roleTags = [
      ...new Set(
        (Array.isArray(ability?.roleTags) ? ability.roleTags : [])
          .map(normalizeKey)
          .filter((roleKey) => roleOrder.has(roleKey))
      )
    ];

    roleTags.forEach((roleKey, index) => {
      // Ability tags are ordered: the first is its primary role identity.
      const weight = index === 0 ? 2 : 1;
      scores.set(roleKey, (scores.get(roleKey) || 0) + weight);
    });
  }

  return [...scores.entries()]
    .map(([key, score]) => ({ key, score }))
    .sort(
      (left, right) =>
        right.score - left.score ||
        roleOrder.get(left.key) - roleOrder.get(right.key)
    );
}

function getProminentClashRoles(build, abilitiesByTraitKey, limit = 2) {
  const normalizedLimit = Math.max(0, Math.floor(Number(limit) || 0));
  return scoreClashRoles(build, abilitiesByTraitKey)
    .slice(0, normalizedLimit)
    .map(({ key }) => key);
}

module.exports = {
  getProminentClashRoles,
  scoreClashRoles
};
