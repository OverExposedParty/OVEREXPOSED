const assert = require('node:assert/strict');
const test = require('node:test');

const Product = require('../../models/shop/product-schema');
const {
  OLING_POD_IMAGE,
  OLING_POD_KEY,
  OLING_POD_OPAL_PRICE,
  createOlingPodProduct
} = require('../../scripts/seed-oling-pod-product');

test('Oling Pod seed creates a valid repeatable Opal product', async () => {
  const product = createOlingPodProduct();
  const document = new Product(product);

  await document.validate();

  assert.equal(product.identity.slug, OLING_POD_KEY);
  assert.equal(product.identity.name, 'Disposable Oling Pod');
  assert.equal(product.media.mainImage.url, OLING_POD_IMAGE);
  assert.equal(
    OLING_POD_IMAGE,
    '/images/olings/lab/items/oling-pods/disposable/artwork.svg'
  );
  assert.equal(
    product.digitalEntitlement.opalPrice.amount,
    OLING_POD_OPAL_PRICE
  );
  assert.deepEqual(product.digitalEntitlement.grants, [
    {
      type: 'oling_pod',
      key: 'oling_pod',
      quantity: 1,
      metadata: {
        rarity: 'common',
        podType: 'storage',
        lifecycle: 'one-use',
        definitionRevision: 1,
        releaseOutcome: 'destroy'
      }
    }
  ]);
  assert.equal(product.variants[0].inventory.trackStock, false);
  assert.equal(product.publishing.visibility, 'public');
});
