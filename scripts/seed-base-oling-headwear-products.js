require('dotenv').config();

const mongoose = require('mongoose');

const { Product, shopConnection } = require('../server/models');

const HEADWEAR_PRODUCTS = [
  {
    key: 'base-soft-ears',
    name: 'Soft Ears',
    slug: 'oling-headwear-soft-ears',
    sku: 'OLING-HEADWEAR-SOFT-EARS',
    opalPrice: 180,
    description: 'A gentle Oling headwear cosmetic with a small XP bonus.'
  },
  {
    key: 'base-tiny-horns',
    name: 'Tiny Horns',
    slug: 'oling-headwear-tiny-horns',
    sku: 'OLING-HEADWEAR-TINY-HORNS',
    opalPrice: 180,
    description: 'A tiny Oling headwear cosmetic with a small shield chance.'
  }
];

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

function createHeadwearProduct(definition) {
  const grant = {
    type: 'oling_headwear',
    key: definition.key,
    quantity: 1,
    metadata: {
      slot: 'headwear',
      cosmeticType: 'oling_headwear'
    }
  };

  const entitlement = {
    purchaseMethods: ['opals'],
    opalPrice: {
      amount: definition.opalPrice,
      compareAtAmount: null
    },
    grants: [grant]
  };

  return {
    slug: definition.slug,
    identity: {
      name: definition.name,
      description: definition.description,
      shortDescription: 'Equip this headwear on one of your Olings.',
      type: 'digital',
      tags: ['oling', 'headwear', 'cosmetic'],
      slug: definition.slug,
      searchKeywords: [
        definition.name.toLowerCase(),
        'oling headwear',
        'oling cosmetic'
      ]
    },
    variants: [
      {
        name: 'Default',
        price: {
          amount: 0,
          currency: 'GBP'
        },
        inventory: {
          sku: definition.sku,
          quantity: 0,
          reservedQuantity: 0,
          trackStock: false,
          inStock: true,
          syncSource: 'manual'
        },
        digitalEntitlement: entitlement
      }
    ],
    publishing: {
      status: 'draft',
      visibility: 'hidden',
      isActive: false,
      publishedAt: null,
      deletedAt: null
    },
    merchandising: {
      catalog: {
        main: 'digital',
        sub: 'oling-headwear',
        style: ['oling', 'headwear'],
        audience: 'players'
      },
      sortOrder: 20,
      defaultVariantSku: definition.sku
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

  for (const definition of HEADWEAR_PRODUCTS) {
    const product = createHeadwearProduct(definition);
    const updatedProduct = await Product.findOneAndUpdate(
      { 'identity.slug': definition.slug },
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
