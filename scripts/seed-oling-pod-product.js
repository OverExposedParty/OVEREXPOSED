require('dotenv').config();

const mongoose = require('mongoose');

const { Product, shopConnection } = require('../server/models');
const {
  getOlingPodDefinition
} = require('../server/services/olings/pod-catalog');

const OLING_POD_KEY = 'oling_pod';
const OLING_POD_IMAGE =
  '/images/olings/lab/items/oling-pods/disposable/artwork.svg';
const OLING_POD_OPAL_PRICE = 75;

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

function createOlingPodProduct() {
  const definition = getOlingPodDefinition(OLING_POD_KEY);
  if (!definition) throw new Error('The Oling Pod definition is missing.');

  const entitlement = {
    purchaseMethods: ['opals'],
    opalPrice: { amount: OLING_POD_OPAL_PRICE, compareAtAmount: null },
    grants: [
      {
        type: 'oling_pod',
        key: definition.key,
        quantity: 1,
        metadata: {
          rarity: definition.rarity,
          podType: 'storage',
          lifecycle: 'one-use',
          definitionRevision: definition.revision,
          releaseOutcome: definition.lifecycle.onRelease
        }
      }
    ]
  };

  return {
    slug: definition.key,
    identity: {
      name: definition.name,
      description: definition.description,
      shortDescription: 'Store one Oling outside the active Lab roster.',
      type: 'digital',
      tags: ['oling', 'pod', 'storage', 'one-use', definition.rarity],
      slug: definition.key,
      searchKeywords: [
        'oling pod',
        'oling storage',
        'store oling',
        'olings lab'
      ]
    },
    variants: [
      {
        name: 'Single',
        price: { amount: 0, currency: 'GBP' },
        media: {
          mainImage: { url: OLING_POD_IMAGE, alt: definition.name },
          gallery: [
            { url: OLING_POD_IMAGE, alt: definition.name, type: 'image' }
          ]
        },
        inventory: {
          sku: 'OLING-POD-ONE-USE-1',
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
      mainImage: { url: OLING_POD_IMAGE, alt: definition.name },
      gallery: [{ url: OLING_POD_IMAGE, alt: definition.name, type: 'image' }]
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
        style: ['oling', 'storage', 'pod', definition.rarity],
        audience: 'players'
      },
      sortOrder: 15,
      defaultVariantSku: 'OLING-POD-ONE-USE-1'
    },
    digitalEntitlement: entitlement
  };
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

  const product = createOlingPodProduct();
  const updatedProduct = await Product.findOneAndUpdate(
    { 'identity.slug': product.identity.slug },
    { $set: product },
    { new: true, runValidators: true, upsert: true }
  );
  console.log(
    `Seeded ${updatedProduct.identity.name} (${updatedProduct.identity.slug}).`
  );
}

if (require.main === module) {
  main()
    .catch((error) => {
      console.error(error.message || error);
      process.exitCode = 1;
    })
    .finally(async () => {
      await shopConnection.close().catch(() => {});
      await mongoose.disconnect().catch(() => {});
    });
}

module.exports = {
  OLING_POD_IMAGE,
  OLING_POD_KEY,
  OLING_POD_OPAL_PRICE,
  createOlingPodProduct,
  getDatabaseUri,
  main
};
