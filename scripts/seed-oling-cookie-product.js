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
      amount: 50,
      compareAtAmount: null
    },
    grants: [
      {
        type: 'oling_consumable',
        key: 'oling-cookie',
        quantity: 3,
        metadata: {
          consumableType: 'energy',
          consumableCategory: 'care',
          consumableSubcategory: 'energy',
          effectType: 'energy'
        }
      }
    ]
  };

  const product = {
    slug: 'oling-cookie',
    identity: {
      name: 'Oling Cookie',
      description:
        'A pack of cookies that helps a tired Oling recover up to 25 Energy.',
      shortDescription:
        'Feed to an Oling that needs a snack (up to 25 Energy).',
      type: 'digital',
      tags: ['oling', 'consumable', 'care', 'energy', 'cookie'],
      slug: 'oling-cookie',
      searchKeywords: ['oling cookie', 'oling mood', 'oling consumable']
    },
    variants: [
      {
        name: '3 Pack',
        price: {
          amount: 0,
          currency: 'GBP'
        },
        media: {
          mainImage: {
            url: '/images/olings/consumables/mood/happiness/oling-cookie.svg',
            alt: 'Oling Cookie'
          },
          gallery: [
            {
              url: '/images/olings/consumables/mood/happiness/oling-cookie.svg',
              alt: 'Oling Cookie',
              type: 'image'
            }
          ]
        },
        inventory: {
          sku: 'OLING-CONSUMABLE-COOKIE-3',
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
        url: '/images/olings/consumables/mood/happiness/oling-cookie.svg',
        alt: 'Oling Cookie'
      },
      gallery: [
        {
          url: '/images/olings/consumables/mood/happiness/oling-cookie.svg',
          alt: 'Oling Cookie',
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
        style: ['oling', 'care', 'energy'],
        audience: 'players'
      },
      sortOrder: 10,
      defaultVariantSku: 'OLING-CONSUMABLE-COOKIE-3'
    },
    digitalEntitlement: entitlement
  };

  const updatedProduct = await Product.findOneAndUpdate(
    { 'identity.slug': 'oling-cookie' },
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
