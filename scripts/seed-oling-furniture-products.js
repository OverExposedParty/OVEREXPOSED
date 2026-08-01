require('dotenv').config();

const mongoose = require('mongoose');

const { Product, shopConnection } = require('../server/models');

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

function createFurnitureProduct(config) {
  const entitlement = {
    purchaseMethods: ['opals'],
    opalPrice: {
      amount: config.opalPrice,
      compareAtAmount: null
    },
    grants: [
      {
        type: 'oling_furniture',
        key: config.key,
        quantity: 1,
        metadata: {
          rarity: config.rarity,
          furnitureType: config.type,
          furnitureCategory: config.category
        }
      }
    ]
  };

  return {
    slug: config.key,
    identity: {
      name: config.name,
      description: config.description,
      shortDescription: config.shortDescription,
      type: 'digital',
      tags: ['oling', 'furniture', config.category, config.type, config.rarity],
      slug: config.key,
      searchKeywords: config.searchKeywords
    },
    variants: [
      {
        name: 'Default',
        price: {
          amount: 0,
          currency: 'GBP'
        },
        media: {
          mainImage: {
            url: config.image,
            alt: config.name
          },
          gallery: [
            {
              url: config.image,
              alt: config.name,
              type: 'image'
            }
          ]
        },
        inventory: {
          sku: config.sku,
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
        url: config.image,
        alt: config.name
      },
      gallery: [
        {
          url: config.image,
          alt: config.name,
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
        sub: 'furniture',
        style: ['oling', config.category, config.type, config.rarity],
        audience: 'players'
      },
      sortOrder: config.sortOrder,
      defaultVariantSku: config.sku
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

  const products = [
    createFurnitureProduct({
      key: 'basic_hanging_light',
      name: 'Basic Hanging Light',
      description: 'A simple ceiling light for brightening up your Olings Lab.',
      shortDescription: 'A common ceiling light for your Olings Lab.',
      category: 'ceiling-light',
      type: 'ceiling-light',
      rarity: 'common',
      opalPrice: 120,
      image:
        '/images/olings/furniture/ceiling-lights/basic-hanging-light/basic-hanging-light.svg',
      sku: 'OLING-FURNITURE-BASIC-HANGING-LIGHT',
      sortOrder: 20,
      searchKeywords: [
        'basic hanging light',
        'oling furniture',
        'ceiling light',
        'olings lab'
      ]
    }),
    createFurnitureProduct({
      key: 'explorer_gateway',
      name: 'Explorer Gateway',
      description:
        'An uncommon door module that turns the Olings Lab entrance into an explorer gateway.',
      shortDescription: 'An uncommon door module for your Olings Lab.',
      category: 'door-module',
      type: 'door-module',
      rarity: 'uncommon',
      opalPrice: 220,
      image:
        '/images/olings/furniture/door-modules/explorer-gateway/explorer-gateway.svg',
      sku: 'OLING-FURNITURE-EXPLORER-GATEWAY',
      sortOrder: 30,
      searchKeywords: [
        'explorer gateway',
        'oling furniture',
        'door module',
        'gateway',
        'olings lab'
      ]
    }),
    createFurnitureProduct({
      key: 'oling_bed',
      name: 'Oling Bed',
      description: 'A cozy bed for the bottom floor of your Olings Lab.',
      shortDescription: 'An uncommon bed for your Olings Lab.',
      category: 'bed',
      type: 'bed',
      rarity: 'uncommon',
      opalPrice: 150,
      image: '/images/olings/furniture/beds/oling-bed/oling-bed.svg',
      sku: 'OLING-FURNITURE-OLING-BED',
      sortOrder: 40,
      searchKeywords: [
        'oling bed',
        'bed',
        'oling furniture',
        'cozy',
        'olings lab'
      ]
    }),
    createFurnitureProduct({
      key: 'supply_shelf',
      name: 'Supply Shelf',
      description: 'An uncommon storage shelf for organizing your Olings Lab.',
      shortDescription: 'An uncommon storage shelf for your Olings Lab.',
      category: 'storage',
      type: 'storage',
      rarity: 'uncommon',
      opalPrice: 180,
      image: '/images/olings/furniture/storage/supply-shelf/supply-shelf.svg',
      sku: 'OLING-FURNITURE-SUPPLY-SHELF',
      sortOrder: 50,
      searchKeywords: [
        'supply shelf',
        'storage',
        'shelf',
        'oling furniture',
        'olings lab'
      ]
    })
  ];

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
