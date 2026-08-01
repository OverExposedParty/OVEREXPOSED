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

  const product = {
    slug: 'base-egg',
    identity: {
      name: 'Base Egg',
      description: 'A base egg that can be hatched into an Oling.',
      shortDescription: 'Hatch this egg to receive an Oling.',
      type: 'digital',
      tags: ['oling', 'egg', 'pet'],
      slug: 'base-egg',
      searchKeywords: ['base egg', 'oling egg', 'pet egg']
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
            url: '/images/shop/products/digital/eggs/base-egg.svg',
            alt: 'Base Egg'
          },
          gallery: [
            {
              url: '/images/shop/products/digital/eggs/base-egg.svg',
              alt: 'Base Egg',
              type: 'image'
            }
          ]
        },
        inventory: {
          sku: 'OLING-EGG-BASE',
          quantity: 0,
          reservedQuantity: 0,
          trackStock: false,
          inStock: true,
          syncSource: 'manual'
        },
        digitalEntitlement: {
          purchaseMethods: ['opals'],
          opalPrice: {
            amount: 250,
            compareAtAmount: null
          },
          grants: [
            {
              type: 'oling_egg',
              key: 'base-egg',
              quantity: 1,
              metadata: {
                eggType: 'base',
                hatchPool: 'base-olings'
              }
            }
          ]
        }
      }
    ],
    media: {
      mainImage: {
        url: '/images/shop/products/digital/eggs/base-egg.svg',
        alt: 'Base Egg'
      },
      gallery: [
        {
          url: '/images/shop/products/digital/eggs/base-egg.svg',
          alt: 'Base Egg',
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
        sub: 'eggs',
        style: ['oling'],
        audience: 'players'
      },
      sortOrder: 0,
      defaultVariantSku: 'OLING-EGG-BASE'
    },
    digitalEntitlement: {
      purchaseMethods: ['opals'],
      opalPrice: {
        amount: 250,
        compareAtAmount: null
      },
      grants: [
        {
          type: 'oling_egg',
          key: 'base-egg',
          quantity: 1,
          metadata: {
            eggType: 'base',
            hatchPool: 'base-olings'
          }
        }
      ]
    }
  };

  const updatedProduct = await Product.findOneAndUpdate(
    { 'identity.slug': 'base-egg' },
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
