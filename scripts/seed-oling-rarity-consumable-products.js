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

function createConsumableProduct(config) {
  const entitlement = {
    purchaseMethods: ['opals'],
    opalPrice: {
      amount: config.opalPrice,
      compareAtAmount: null
    },
    grants: [
      {
        type: 'oling_consumable',
        key: config.key,
        quantity: config.quantity,
        metadata: {
          rarity: config.rarity,
          consumableType: config.subcategory,
          consumableCategory: config.category,
          consumableSubcategory: config.subcategory,
          effectType: config.effectType
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
      tags: [
        'oling',
        'consumable',
        config.category,
        config.subcategory,
        config.rarity,
        ...config.tags
      ],
      slug: config.key,
      searchKeywords: config.searchKeywords
    },
    variants: [
      {
        name: config.quantity > 1 ? `${config.quantity} Pack` : 'Single',
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
        sub: 'consumables',
        style: ['oling', config.category, config.subcategory],
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
    createConsumableProduct({
      key: 'opal-dust',
      name: 'Opal Dust',
      description: "A shimmering dust that improves an egg's rarity chance.",
      shortDescription: 'Use on an egg for +10 rarity chance.',
      category: 'hatching',
      subcategory: 'rarity',
      effectType: 'rarity_chance',
      rarity: 'rare',
      quantity: 1,
      opalPrice: 120,
      image: '/images/olings/consumables/hatching/rarity/opal-dust.svg',
      sku: 'OLING-CONSUMABLE-OPAL-DUST-1',
      sortOrder: 12,
      tags: ['opal', 'dust'],
      searchKeywords: [
        'opal dust',
        'oling rarity',
        'hatching rarity',
        'oling consumable'
      ]
    }),
    createConsumableProduct({
      key: 'lucky-clover',
      name: 'Lucky Clover',
      description: 'A lucky charm that gives an egg a stronger rarity boost.',
      shortDescription: 'Use on an egg for +20 rarity chance.',
      category: 'hatching',
      subcategory: 'rarity',
      effectType: 'rarity_chance',
      rarity: 'epic',
      quantity: 1,
      opalPrice: 200,
      image: '/images/olings/consumables/hatching/rarity/lucky-clover.svg',
      sku: 'OLING-CONSUMABLE-LUCKY-CLOVER-1',
      sortOrder: 13,
      tags: ['lucky', 'clover'],
      searchKeywords: [
        'lucky clover',
        'oling rarity',
        'hatching rarity',
        'oling consumable'
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
