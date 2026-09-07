require('dotenv').config();

const mongoose = require('mongoose');

const { Product, shopConnection } = require('../server/models');

const O_JUICE_KEY = 'o-juice';
const O_JUICE_IMAGE = '/images/olings/lab/consumables/energy/o-juice.svg';

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

function createOJuiceProduct() {
  const entitlement = {
    purchaseMethods: ['opals'],
    opalPrice: { amount: 100, compareAtAmount: null },
    grants: [
      {
        type: 'oling_consumable',
        key: O_JUICE_KEY,
        quantity: 1,
        metadata: {
          rarity: 'rare',
          consumableType: 'energy',
          consumableCategory: 'care',
          consumableSubcategory: 'energy',
          effectType: 'energy'
        }
      }
    ]
  };

  return {
    slug: O_JUICE_KEY,
    identity: {
      name: 'O-Juice',
      description:
        'A fizzy energy drink that restores an Oling up to 75 Energy.',
      shortDescription: 'Restore an Oling up to 75 Energy.',
      type: 'digital',
      tags: ['oling', 'consumable', 'care', 'energy', 'juice'],
      slug: O_JUICE_KEY,
      searchKeywords: [
        'o-juice',
        'oling energy',
        'oling snack',
        'oling consumable'
      ]
    },
    variants: [
      {
        name: 'Single',
        price: { amount: 0, currency: 'GBP' },
        media: {
          mainImage: { url: O_JUICE_IMAGE, alt: 'O-Juice' },
          gallery: [{ url: O_JUICE_IMAGE, alt: 'O-Juice', type: 'image' }]
        },
        inventory: {
          sku: 'OLING-CONSUMABLE-O-JUICE-1',
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
      mainImage: { url: O_JUICE_IMAGE, alt: 'O-Juice' },
      gallery: [{ url: O_JUICE_IMAGE, alt: 'O-Juice', type: 'image' }]
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
        style: ['oling', 'care', 'energy'],
        audience: 'players'
      },
      sortOrder: 20,
      defaultVariantSku: 'OLING-CONSUMABLE-O-JUICE-1'
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

  const product = createOJuiceProduct();
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
      await shopConnection.close();
      await mongoose.disconnect();
    });
}

module.exports = {
  O_JUICE_IMAGE,
  O_JUICE_KEY,
  createOJuiceProduct,
  getDatabaseUri,
  main
};
