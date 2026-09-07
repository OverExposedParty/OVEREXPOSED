const {
  OLING_POD_RELEASE_OUTCOMES
} = require('../../../models/olings/oling-storage-contract');
const podCatalog = require('../../../public/json-files/olings/lab/pods.json');
const { normalizeKey } = require('./shared');

function createOlingPodDefinition(definition) {
  const key = normalizeKey(definition?.key);
  const revision = Number(definition?.revision);
  const onRelease = normalizeKey(definition?.lifecycle?.onRelease);
  const configuredUses = Number(definition?.lifecycle?.uses);
  const layers = definition?.assets?.layers || {};

  if (!key) throw new TypeError('Oling Pod definitions require a key.');
  if (!Number.isInteger(revision) || revision < 1) {
    throw new TypeError(`Oling Pod "${key}" requires a positive revision.`);
  }
  if (!OLING_POD_RELEASE_OUTCOMES.includes(onRelease)) {
    throw new TypeError(
      `Oling Pod "${key}" has an unsupported release outcome.`
    );
  }

  return Object.freeze({
    key,
    revision,
    name: String(definition.name || key).trim(),
    description: String(definition.description || '').trim(),
    rarity: normalizeKey(definition.rarity) || 'common',
    lifecycle: Object.freeze({
      onRelease,
      uses:
        Number.isInteger(configuredUses) && configuredUses > 0
          ? configuredUses
          : null
    }),
    assets: Object.freeze({
      empty: String(definition.assets?.empty || '').trim() || null,
      occupied: String(definition.assets?.occupied || '').trim() || null,
      layers: Object.freeze({
        back: String(layers.back || '').trim() || null,
        front: String(layers.front || '').trim() || null,
        base: String(layers.base || '').trim() || null
      })
    })
  });
}

function createOlingPodCatalog(definitions) {
  if (!Array.isArray(definitions)) {
    throw new TypeError('Oling Pod catalogue must be an array.');
  }

  const entries = definitions.map((definition) => {
    const normalized = createOlingPodDefinition(definition);
    return [normalized.key, normalized];
  });
  const keys = entries.map(([key]) => key);
  if (new Set(keys).size !== keys.length) {
    throw new TypeError('Oling Pod catalogue contains duplicate keys.');
  }

  return Object.freeze(Object.fromEntries(entries));
}

const OlingPodDefinitions = createOlingPodCatalog(podCatalog.pods);

function getOlingPodDefinition(key) {
  const normalizedKey = normalizeKey(key);
  return Object.hasOwn(OlingPodDefinitions, normalizedKey)
    ? OlingPodDefinitions[normalizedKey]
    : null;
}

function listOlingPodDefinitions() {
  return Object.values(OlingPodDefinitions);
}

function serializeOlingPodDefinition(definition) {
  if (!definition) return null;
  return {
    key: definition.key,
    revision: definition.revision,
    name: definition.name,
    description: definition.description,
    rarity: definition.rarity,
    lifecycle: {
      onRelease: definition.lifecycle.onRelease,
      uses: definition.lifecycle.uses
    },
    assets: {
      ...definition.assets,
      layers: { ...definition.assets.layers }
    }
  };
}

module.exports = {
  OlingPodDefinitions,
  createOlingPodDefinition,
  getOlingPodDefinition,
  listOlingPodDefinitions,
  serializeOlingPodDefinition
};
