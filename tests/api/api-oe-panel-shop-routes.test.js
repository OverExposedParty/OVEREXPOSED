const assert = require('node:assert/strict');
const test = require('node:test');

const {
  registerOePanelShopRoutes
} = require('../../server/routes/api-oe-panel-shop');
const {
  createApiRouteContext
} = require('../../server/routes/api-route-context');

test('OE panel shop routes preserve their endpoint contract and order', () => {
  const registeredRoutes = [];
  const app = {};

  ['get', 'post', 'patch', 'delete'].forEach((method) => {
    app[method] = (route) => registeredRoutes.push([method, route]);
  });

  registerOePanelShopRoutes({ app });

  assert.deepEqual(registeredRoutes, [
    ['get', '/api/oe-panel/shop/products'],
    ['post', '/api/oe-panel/shop/products'],
    ['patch', '/api/oe-panel/shop/products/:productId'],
    ['delete', '/api/oe-panel/shop/products/:productId']
  ]);
});

test('GET /api/oe-panel/shop/products serializes products after route-context composition', async () => {
  const handlers = new Map();
  const app = {};

  ['get', 'post', 'patch', 'delete'].forEach((method) => {
    app[method] = (path, handler) => {
      handlers.set(`${method.toUpperCase()} ${path}`, handler);
    };
  });

  const publishedAt = new Date('2026-07-16T09:30:00.000Z');
  const updatedAt = new Date('2026-07-17T12:45:00.000Z');
  const products = [
    {
      _id: 'product-1',
      identity: {
        name: 'Starter Egg',
        slug: 'starter-egg',
        type: 'digital',
        shortDescription: 'A representative shop product.'
      },
      publishing: {
        status: 'active',
        visibility: 'public',
        isActive: true,
        publishedAt
      },
      system: { updatedAt },
      digitalEntitlement: {
        purchaseMethods: ['opals'],
        opalPrice: { amount: 250 },
        grants: [{ type: 'oling_egg', key: 'starter' }]
      },
      variants: [
        {
          name: 'Default',
          price: { amount: 4.99, currency: 'GBP' },
          inventory: {
            sku: 'STARTER-EGG-001',
            inStock: true,
            trackStock: false,
            quantity: 0,
            reservedQuantity: 0
          }
        }
      ]
    }
  ];
  const Product = {
    find() {
      return {
        sort() {
          return this;
        },
        limit() {
          return this;
        },
        async lean() {
          return products;
        }
      };
    }
  };
  const Account = {
    async aggregate() {
      return [];
    }
  };
  const context = createApiRouteContext({
    app,
    models: { Account, Product },
    runtime: {}
  });
  context.requireOePanelAccount = async () => ({ _id: 'admin-1' });

  registerOePanelShopRoutes(context);
  const productsHandler = handlers.get('GET /api/oe-panel/shop/products');
  assert.equal(typeof productsHandler, 'function');

  let result;
  let routeError;
  await productsHandler(
    { id: 'shop-product-list-test' },
    {
      apiSuccess(payload) {
        result = payload;
      },
      apiError(payload) {
        routeError = payload;
      }
    }
  );

  assert.equal(routeError, undefined);
  assert.equal(result.data.products.length, 1);
  assert.equal(result.data.products[0].productId, 'product-1');
  assert.equal(result.data.products[0].product, 'Starter Egg');
  assert.equal(
    result.data.products[0].publishedAt,
    publishedAt.toLocaleString()
  );
  assert.equal(result.data.products[0].updatedAt, updatedAt.toLocaleString());
  assert.equal(result.data.stats.opalsSpentToday, 0);
});
