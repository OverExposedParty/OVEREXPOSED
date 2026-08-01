require('dotenv').config();

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const { Product, shopConnection } = require('../server/models');

const PACK_SLUG = 'base-too';
const PACK_FILE = path.join(
  __dirname,
  '..',
  'public',
  'json-files',
  'customisation',
  'packs',
  `${PACK_SLUG}.json`
);
const OPAL_PRICES_BY_ITEM_ID = {
  B000: 75,
  B001: 75,
  B002: 75,
  B003: 75,
  B004: 75,
  B005: 75,
  B006: 75,
  B100: 125,
  B101: 125,
  B102: 125,
  B103: 150,
  B104: 150,
  B105: 150,
  B106: 125,
  B200: 100,
  B201: 125,
  B202: 100,
  B203: 125,
  B204: 125,
  B205: 125,
  B206: 100,
  B300: 100,
  B301: 100,
  B302: 100,
  B303: 100,
  B304: 100,
  B305: 100,
  B306: 125
};

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

function slugify(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function titleCase(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}

function getSlotLabel(slot) {
  return titleCase(String(slot || '').replace(/-/g, ' '));
}

function loadBaseTooItems() {
  const payload = JSON.parse(fs.readFileSync(PACK_FILE, 'utf8'));
  const items = payload[`customisation-${PACK_SLUG}`];

  if (!Array.isArray(items)) {
    throw new Error(
      `Missing customisation-${PACK_SLUG} items in ${PACK_FILE}.`
    );
  }

  return items.filter((item) => item?.id && item?.name && item?.['file-path']);
}

function createProduct(item, sortOrder) {
  const itemName = titleCase(item.name);
  const slotLabel = getSlotLabel(item.slot);
  const slug = `oe-${PACK_SLUG}-${slugify(item.name)}`;
  const sku = `OE-${PACK_SLUG}-${item.id}`.toUpperCase();
  const opalPrice = OPAL_PRICES_BY_ITEM_ID[item.id] || 100;
  const media = {
    mainImage: {
      url: item['file-path'],
      alt: itemName
    },
    gallery: [
      {
        url: item['file-path'],
        alt: itemName,
        type: 'image'
      }
    ]
  };
  const grant = {
    type: 'oe',
    key: item.id,
    quantity: 1,
    metadata: {
      packSlug: PACK_SLUG,
      slot: item.slot,
      assetPath: item['file-path']
    }
  };
  const digitalEntitlement = {
    purchaseMethods: ['opals'],
    opalPrice: {
      amount: opalPrice,
      compareAtAmount: null
    },
    grants: [grant]
  };

  return {
    slug,
    identity: {
      name: `${itemName} OE`,
      description: `Unlock the ${itemName} ${slotLabel} OE customisation item.`,
      shortDescription: `${slotLabel} OE customisation item.`,
      type: 'digital',
      tags: ['oe', 'customisation', PACK_SLUG, item.slot],
      slug,
      searchKeywords: [
        itemName.toLowerCase(),
        item.id.toLowerCase(),
        'oe',
        'customisation',
        PACK_SLUG,
        item.slot
      ]
    },
    variants: [
      {
        name: 'Default',
        price: {
          amount: 0,
          currency: 'GBP'
        },
        media,
        inventory: {
          sku,
          quantity: 0,
          reservedQuantity: 0,
          trackStock: false,
          inStock: true,
          syncSource: 'manual'
        },
        digitalEntitlement
      }
    ],
    media,
    publishing: {
      status: 'active',
      visibility: 'public',
      isActive: true,
      publishedAt: new Date(),
      deletedAt: null
    },
    merchandising: {
      catalog: {
        main: 'digital',
        sub: 'oe-customisation',
        style: [PACK_SLUG, item.slot],
        audience: 'players'
      },
      sortOrder,
      defaultVariantSku: sku
    },
    digitalEntitlement
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

  const items = loadBaseTooItems();
  const products = items.map((item, index) => createProduct(item, index + 100));

  for (const product of products) {
    await Product.findOneAndUpdate(
      { 'identity.slug': product.identity.slug },
      { $set: product },
      { new: true, runValidators: true, upsert: true }
    );
  }

  console.log(
    `Seeded ${products.length} ${PACK_SLUG} OE products with item-specific Opal prices.`
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
