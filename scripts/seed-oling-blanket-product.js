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

  const entitlement = {
    purchaseMethods: ['opals'],
    opalPrice: {
      amount: 90,
      compareAtAmount: null
    },
    grants: [
      {
        type: 'oling_consumable',
        key: 'oling-blanket',
        quantity: 1,
        metadata: {
          consumableType: 'speed',
          consumableCategory: 'hatching',
          consumableSubcategory: 'speed',
          effectType: 'hatch_speed'
        }
      }
    ]
  };

  const product = {
    slug: 'oling-blanket',
    identity: {
      name: 'Oling Blanket',
      description: 'A cosy blanket that helps an Oling egg hatch faster.',
      shortDescription: 'Use on an egg for +25 hatch speed.',
      type: 'digital',
      tags: ['oling', 'consumable', 'hatching', 'speed', 'blanket'],
      slug: 'oling-blanket',
      searchKeywords: [
        'oling blanket',
        'oling hatching',
        'hatch speed',
        'oling consumable'
      ]
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
            url: '/images/olings/consumables/hatching/speed/oling-blanket.svg',
            alt: 'Oling Blanket'
          },
          gallery: [
            {
              url: '/images/olings/consumables/hatching/speed/oling-blanket.svg',
              alt: 'Oling Blanket',
              type: 'image'
            }
          ]
        },
        inventory: {
          sku: 'OLING-CONSUMABLE-BLANKET-1',
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
        url: '/images/olings/consumables/hatching/speed/oling-blanket.svg',
        alt: 'Oling Blanket'
      },
      gallery: [
        {
          url: '/images/olings/consumables/hatching/speed/oling-blanket.svg',
          alt: 'Oling Blanket',
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
        style: ['oling', 'hatching', 'speed'],
        audience: 'players'
      },
      sortOrder: 11,
      defaultVariantSku: 'OLING-CONSUMABLE-BLANKET-1'
    },
    digitalEntitlement: entitlement
  };

  const updatedProduct = await Product.findOneAndUpdate(
    { 'identity.slug': 'oling-blanket' },
    { $set: product },
    { new: true, runValidators: true, upsert: true }
  );

  console.log(
    `Seeded ${updatedProduct.identity.name} (${updatedProduct.identity.slug}).`
  );
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
