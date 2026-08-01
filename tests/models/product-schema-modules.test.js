const assert = require('node:assert/strict');
const test = require('node:test');

const Product = require('../../models/shop/product-schema');

test('product schema facade preserves model statics and collection contract', () => {
  assert.equal(Product.modelName, 'Product');
  assert.equal(Product.collection.name, 'products');
  assert.deepEqual(Product.STATUSES, [
    'draft',
    'scheduled',
    'active',
    'archived',
    'sold-out'
  ]);
  assert.deepEqual(Product.VISIBILITIES, [
    'public',
    'hidden',
    'members_only',
    'password_only'
  ]);
  assert.deepEqual(Product.TYPES, ['physical', 'digital']);
  assert.deepEqual(Product.MEDIA_TYPES, ['image', 'video']);
  assert.deepEqual(Product.INVENTORY_SYNC_SOURCES, [
    'manual',
    'stripe',
    'warehouse'
  ]);
});

test('product schema preserves indexes used by shop queries', () => {
  const indexes = Product.schema.indexes().map(([fields, options]) => ({
    fields,
    options
  }));

  assert.ok(
    indexes.some(
      ({ fields, options }) =>
        fields['identity.slug'] === 1 && options?.unique === true
    )
  );
  assert.ok(
    indexes.some(
      ({ fields, options }) =>
        fields['variants.inventory.sku'] === 1 &&
        options?.unique === true &&
        options?.partialFilterExpression?.['variants.inventory.sku']?.$type ===
          'string'
    )
  );
  assert.ok(
    indexes.some(
      ({ fields }) =>
        fields['publishing.status'] === 1 &&
        fields['publishing.visibility'] === 1 &&
        fields['publishing.publishedAt'] === 1 &&
        fields['merchandising.sortOrder'] === 1
    )
  );
});

test('product schema validation normalizes slugs, stock, and purchase methods', async () => {
  const product = new Product({
    identity: {
      name: 'Base Egg',
      slug: 'base-egg',
      tags: [' egg ', 'egg', ' oling '],
      searchKeywords: ['base', 'base']
    },
    publishing: { status: 'active', visibility: 'public' },
    merchandising: {
      defaultVariantSku: 'OLING-EGG-BASE',
      catalog: { style: [' egg ', 'egg'] }
    },
    digitalEntitlement: { purchaseMethods: [] },
    variants: [
      {
        name: 'Base Egg',
        inventory: {
          sku: 'OLING-EGG-BASE',
          quantity: 3,
          reservedQuantity: 1,
          trackStock: true
        },
        digitalEntitlement: { purchaseMethods: ['opals', 'opals'] }
      }
    ],
    content: {
      details: {
        materials: [' pixels ', 'pixels'],
        careInstructions: [' hatch carefully ', 'hatch carefully']
      }
    }
  });

  await product.validate();

  assert.equal(product.slug, 'base-egg');
  assert.ok(product.publishing.publishedAt instanceof Date);
  assert.deepEqual(product.identity.tags, ['egg', 'oling']);
  assert.deepEqual(product.identity.searchKeywords, ['base']);
  assert.deepEqual(product.merchandising.catalog.style, ['egg']);
  assert.equal(product.variants[0].inventory.inStock, true);
  assert.deepEqual(product.digitalEntitlement.purchaseMethods, ['money']);
  assert.deepEqual(product.variants[0].digitalEntitlement.purchaseMethods, [
    'opals'
  ]);
});
