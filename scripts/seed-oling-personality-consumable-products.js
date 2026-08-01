require('dotenv').config();

const fs = require('fs/promises');
const path = require('path');

const mongoose = require('mongoose');

const { Product, shopConnection } = require('../server/models');

const CONSUMABLES_PATH = path.join(
  process.cwd(),
  'public',
  'json-files',
  'olings',
  'consumables.json'
);

function getDatabaseUri(baseUri, dbName) {
  try {
    const parsedUri = new URL(baseUri);
    parsedUri.pathname = `/${dbName}`;
    return parsedUri.toString();
  } catch (error) {
    console.warn(
      `Could not derive "${dbName}" MongoDB URI from base URI:`,
      error.message || error
    );
    return baseUri;
  }
}

function titleToKeywords(value) {
  return String(value || '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

function getPersonalityKey(consumable) {
  return (
    consumable?.effect?.personalityKey ||
    consumable?.metadata?.personalityKey ||
    ''
  );
}

function createPersonalityConsumableProduct(consumable, index) {
  const personalityKey = getPersonalityKey(consumable);
  const rarity = consumable?.metadata?.rarity || 'rare';
  const effectType = consumable?.effect?.type || 'personality_chance';
  const amount = Number(consumable?.effect?.amount || 0);
  const opalPrice = 100;
  const skuKey = consumable.key.replace(/[^a-z0-9]+/gi, '-').toUpperCase();
  const entitlement = {
    purchaseMethods: ['opals'],
    opalPrice: {
      amount: opalPrice,
      compareAtAmount: null
    },
    grants: [
      {
        type: 'oling_consumable',
        key: consumable.key,
        quantity: 1,
        metadata: {
          rarity,
          consumableType: consumable.subcategory,
          consumableCategory: consumable.category,
          consumableSubcategory: consumable.subcategory,
          effectType,
          personalityKey
        }
      }
    ]
  };

  return {
    slug: consumable.key,
    identity: {
      name: consumable.name,
      description: consumable.description,
      shortDescription: `Use on an egg for +${amount} ${personalityKey} personality influence.`,
      type: 'digital',
      tags: [
        'oling',
        'consumable',
        'hatching',
        'personality',
        personalityKey,
        rarity,
        ...titleToKeywords(consumable.name)
      ].filter(Boolean),
      slug: consumable.key,
      searchKeywords: [
        consumable.name.toLowerCase(),
        `${personalityKey} personality`,
        'oling personality',
        'hatching personality',
        'oling consumable'
      ].filter(Boolean)
    },
    variants: [
      {
        name: 'Single',
        price: {
          amount: 0,
          currency: 'GBP'
        },
        media: {
          mainImage: {
            url: consumable.assets?.icon,
            alt: consumable.name
          },
          gallery: [
            {
              url: consumable.assets?.icon,
              alt: consumable.name,
              type: 'image'
            }
          ]
        },
        inventory: {
          sku: `OLING-CONSUMABLE-${skuKey}-1`,
          quantity: 0,
          reservedQuantity: 0,
          trackStock: false,
          inStock: true,
          syncSource: 'manual'
        },
        digitalEntitlement: entitlement
      }
    ],
    media: {
      mainImage: {
        url: consumable.assets?.icon,
        alt: consumable.name
      },
      gallery: [
        {
          url: consumable.assets?.icon,
          alt: consumable.name,
          type: 'image'
        }
      ]
    },
    publishing: {
      status: 'active',
      visibility: 'public',
      isActive: true,
      publishedAt: null,
      deletedAt: null
    },
    merchandising: {
      catalog: {
        main: 'digital',
        sub: 'consumables',
        style: ['oling', 'hatching', 'personality', personalityKey].filter(
          Boolean
        ),
        audience: 'players'
      },
      sortOrder: 20 + index,
      defaultVariantSku: `OLING-CONSUMABLE-${skuKey}-1`
    },
    digitalEntitlement: entitlement
  };
}

async function readPersonalityConsumables() {
  const data = JSON.parse(await fs.readFile(CONSUMABLES_PATH, 'utf8'));
  return (Array.isArray(data.consumables) ? data.consumables : []).filter(
    (consumable) =>
      consumable?.category === 'hatching' &&
      consumable?.subcategory === 'personality' &&
      consumable?.target === 'egg' &&
      consumable?.key &&
      consumable?.assets?.icon
  );
}

async function main() {
  const baseUri = process.env.MONGO_URI_OVEREXPOSURE;

  if (!process.env.MONGO_URI_SHOP && !baseUri) {
    throw new Error(
      'Missing MONGO_URI_SHOP or MONGO_URI_OVEREXPOSURE in environment.'
    );
  }

  const shopUri =
    process.env.MONGO_URI_SHOP ||
    getDatabaseUri(baseUri, process.env.MONGO_DB_SHOP || 'shop');

  await shopConnection.openUri(shopUri);

  const consumables = await readPersonalityConsumables();
  const products = consumables.map(createPersonalityConsumableProduct);

  for (const product of products) {
    const updatedProduct = await Product.findOneAndUpdate(
      { 'identity.slug': product.identity.slug },
      { $set: product },
      { new: true, runValidators: true, upsert: true }
    );

    console.log(
      `Seeded ${updatedProduct.identity.name} (${updatedProduct.identity.slug}).`
    );
  }
}

main()
  .catch((error) => {
    console.error(error.message || error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await shopConnection.close();
    await mongoose.disconnect();
  });
