const ITEM_REWARD_TYPES = new Set([
  'badge',
  'cosmetic',
  'pack',
  'oe',
  'oling_egg',
  'oling_consumable',
  'oling_headwear',
  'oling_furniture'
]);

function normalizeCatalogValue(value) {
  return String(value || '').trim();
}

function getCatalogIdentity(type, key) {
  return `${normalizeCatalogValue(type).toLowerCase()}:${normalizeCatalogValue(
    key
  ).toLowerCase()}`;
}

function firstString(...values) {
  return values.map(normalizeCatalogValue).find(Boolean) || '';
}

function getMediaUrl(media) {
  return firstString(
    media?.mainImage?.url,
    media?.image,
    media?.icon,
    media?.thumbnail,
    media?.url
  );
}

function addCatalogEntry(catalog, entry) {
  const type = normalizeCatalogValue(entry?.type).toLowerCase();
  const key = normalizeCatalogValue(entry?.key);
  if (!ITEM_REWARD_TYPES.has(type) || !key) return;

  const identity = getCatalogIdentity(type, key);
  const existing = catalog.get(identity);
  const next = {
    type,
    key,
    name: firstString(entry.name),
    image: firstString(entry.image)
  };

  if (!existing) {
    catalog.set(identity, next);
    return;
  }

  catalog.set(identity, {
    ...existing,
    name: existing.name || next.name,
    image: existing.image || next.image
  });
}

function addProductEntries(catalog, products) {
  products.forEach((product) => {
    const productName = firstString(product?.identity?.name, product?.name);
    const productImage = getMediaUrl(product?.media) || product?.mainMedia?.url;
    const sources = [
      {
        grants: product?.digitalEntitlement?.grants,
        image: productImage
      },
      ...(Array.isArray(product?.variants)
        ? product.variants.map((variant) => ({
            grants: variant?.digitalEntitlement?.grants,
            image: getMediaUrl(variant?.media) || productImage
          }))
        : [])
    ];

    sources.forEach((source) => {
      (Array.isArray(source.grants) ? source.grants : []).forEach((grant) => {
        addCatalogEntry(catalog, {
          type: grant?.type,
          key: grant?.key,
          name: firstString(
            grant?.metadata?.displayName,
            grant?.metadata?.name,
            grant?.metadata?.label,
            productName
          ),
          image: firstString(
            grant?.metadata?.image,
            grant?.metadata?.icon,
            source.image
          )
        });
      });
    });
  });
}

function addOlingEggEntries(catalog, eggs) {
  eggs.forEach((egg) => {
    addCatalogEntry(catalog, {
      type: 'oling_egg',
      key: egg?.key,
      name: egg?.name,
      image: firstString(
        egg?.assets?.image,
        egg?.assets?.icon,
        egg?.metadata?.image,
        egg?.collection ? `/images/olings/eggs/${egg.collection}/egg.svg` : ''
      )
    });
  });
}

function addOlingConsumableEntries(catalog, consumables) {
  consumables.forEach((consumable) => {
    addCatalogEntry(catalog, {
      type: 'oling_consumable',
      key: consumable?.key,
      name: consumable?.name,
      image: firstString(
        consumable?.assets?.image,
        consumable?.assets?.icon,
        consumable?.metadata?.image,
        consumable?.metadata?.icon
      )
    });
  });
}

function addOeCustomisationEntries(catalog, records) {
  records.forEach((record) => {
    if (record?.recordType === 'image') {
      addCatalogEntry(catalog, {
        type: 'oe',
        key: record.oeId,
        name: record.name,
        image: record.filePath
      });
      return;
    }

    if (record?.recordType === 'pack') {
      addCatalogEntry(catalog, {
        type: 'pack',
        key: record.slug,
        name: record.title
      });
    }
  });
}

function createAchievementRewardCatalog({
  products = [],
  eggs = [],
  consumables = [],
  oeCustomisation = []
} = {}) {
  const catalog = new Map();
  addProductEntries(catalog, products);
  addOlingEggEntries(catalog, eggs);
  addOlingConsumableEntries(catalog, consumables);
  addOeCustomisationEntries(catalog, oeCustomisation);
  return [...catalog.values()].sort((left, right) =>
    getCatalogIdentity(left.type, left.key).localeCompare(
      getCatalogIdentity(right.type, right.key)
    )
  );
}

async function findLean(Model, query) {
  if (typeof Model?.find !== 'function') return [];
  const result = Model.find(query);
  return typeof result?.lean === 'function' ? result.lean() : result;
}

async function getAchievementRewardCatalog({
  Product,
  OlingEgg,
  OlingConsumable,
  OeCustomisation
} = {}) {
  const results = await Promise.allSettled([
    findLean(Product, {
      'publishing.status': 'active',
      'publishing.visibility': 'public',
      'publishing.isActive': true,
      'publishing.deletedAt': null
    }),
    findLean(OlingEgg, { enabled: true, status: 'published' }),
    findLean(OlingConsumable, { enabled: true, status: 'published' }),
    findLean(OeCustomisation, {
      recordType: { $in: ['image', 'pack'] },
      enabled: true,
      status: 'published'
    })
  ]);
  const valueAt = (index) =>
    results[index]?.status === 'fulfilled' &&
    Array.isArray(results[index].value)
      ? results[index].value
      : [];

  return createAchievementRewardCatalog({
    products: valueAt(0),
    eggs: valueAt(1),
    consumables: valueAt(2),
    oeCustomisation: valueAt(3)
  });
}

module.exports = {
  createAchievementRewardCatalog,
  getAchievementRewardCatalog
};
