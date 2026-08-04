const {
  createOePanelShopProductNormalizers
} = require('./product-normalization');
const {
  createOePanelShopProductPresentation
} = require('./product-presentation');
const { createOePanelShopProductPayloads } = require('./product-payloads');

function registerOePanelShopProductRoutes(context) {
  const { app } = context;
  const normalizers = createOePanelShopProductNormalizers(context);
  const presentation = createOePanelShopProductPresentation(context);
  const payloads = createOePanelShopProductPayloads(normalizers);
  const {
    createShopIssueAlerts,
    getShopDefaultVariant,
    serializeProductForOePanel
  } = presentation;
  const { createShopProductPayload, createShopProductUpdatePayload } = payloads;

  with (context) {
    app.get('/api/oe-panel/shop/products', async (req, res) => {
      try {
        const account = await requireOePanelAccount(req, res);
        if (!account) return;

        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);

        const [products, orderStats, opalSpendStats, opalReceivedStats] =
          await Promise.all([
            Product.find({})
              .sort({ 'system.createdAt': -1, 'identity.name': 1 })
              .limit(250)
              .lean(),
            Account.aggregate([
              { $unwind: '$shop.orderHistory' },
              {
                $match: {
                  'shop.orderHistory.placedAt': { $gte: startOfToday }
                }
              },
              {
                $group: {
                  _id: '$shop.orderHistory.status',
                  count: { $sum: 1 },
                  amount: { $sum: '$shop.orderHistory.total.amount' },
                  currency: { $first: '$shop.orderHistory.total.currency' }
                }
              }
            ]),
            Account.aggregate([
              { $unwind: '$gameData.opalTransactions' },
              {
                $match: {
                  'gameData.opalTransactions.type': 'spend',
                  'gameData.opalTransactions.sourceType': 'shop_purchase',
                  'gameData.opalTransactions.createdAt': { $gte: startOfToday }
                }
              },
              {
                $group: {
                  _id: null,
                  count: { $sum: 1 },
                  amount: { $sum: '$gameData.opalTransactions.amount' }
                }
              }
            ]),
            Account.aggregate([
              { $unwind: '$gameData.opalTransactions' },
              {
                $match: {
                  'gameData.opalTransactions.type': {
                    $in: ['earn', 'refund', 'admin_adjustment', 'purchase']
                  },
                  'gameData.opalTransactions.amount': { $gt: 0 },
                  'gameData.opalTransactions.createdAt': { $gte: startOfToday }
                }
              },
              {
                $group: {
                  _id: null,
                  amount: { $sum: '$gameData.opalTransactions.amount' }
                }
              }
            ])
          ]);

        const paidOrderStats =
          orderStats.find((row) => row._id === 'paid') || {};
        const refundedOrderStats =
          orderStats.find((row) => row._id === 'refunded') || {};
        const opalSpend = opalSpendStats[0] || {};
        const opalReceived = opalReceivedStats[0] || {};

        res.apiSuccess({
          data: {
            products: products.map(serializeProductForOePanel),
            alerts: createShopIssueAlerts(products),
            stats: {
              revenueToday: formatCurrencyValue(
                paidOrderStats.amount || 0,
                paidOrderStats.currency || 'GBP'
              ),
              ordersToday: paidOrderStats.count || 0,
              refundsToday: refundedOrderStats.count || 0,
              opalPurchasesToday: opalSpend.count || 0,
              opalsReceivedToday: Number(opalReceived.amount || 0),
              opalsSpentToday: Math.abs(Number(opalSpend.amount || 0))
            }
          }
        });
      } catch (err) {
        console.error(`[REQ ${req.id}] Failed to fetch OE Panel shop:`, err);
        res.apiError({
          status: 500,
          code: 'oe_panel_shop_fetch_failed',
          message: 'Failed to fetch shop products'
        });
      }
    });

    app.post('/api/oe-panel/shop/products', async (req, res) => {
      try {
        const account = await requireOePanelAccount(req, res);
        if (!account) return;
        if (!requireOePanelPermission(account, res, 'shop.products.manage')) {
          return;
        }

        const { product, error } = createShopProductPayload(req.body || {});
        if (error) {
          return res.apiError({
            status: 400,
            code: 'oe_panel_shop_product_invalid',
            message: error
          });
        }

        const createdProduct = await Product.create(product);
        await createAdminLog(AdminLog, account, {
          action: 'Created shop product',
          area: 'Shop',
          target: {
            type: 'product',
            id: String(createdProduct._id),
            label:
              createdProduct.identity?.name || createdProduct.identity?.slug
          },
          previousValue: '-',
          newValue: serializeProductForOePanel(createdProduct),
          severity: 'medium',
          metadata: {
            collection: 'products'
          }
        });

        res.apiSuccess(
          {
            data: {
              row: serializeProductForOePanel(createdProduct),
              message: 'Shop product created.'
            }
          },
          201
        );
      } catch (err) {
        if (err?.code === 11000) {
          return res.apiError({
            status: 409,
            code: 'oe_panel_shop_product_duplicate',
            message: 'A product with that slug or SKU already exists.'
          });
        }

        console.error(`[REQ ${req.id}] Failed to create shop product:`, err);
        res.apiError({
          status: 500,
          code: 'oe_panel_shop_product_create_failed',
          message: 'Failed to create shop product'
        });
      }
    });

    app.patch('/api/oe-panel/shop/products/:productId', async (req, res) => {
      try {
        const account = await requireOePanelAccount(req, res);
        if (!account) return;
        if (!requireOePanelPermission(account, res, 'shop.products.manage')) {
          return;
        }

        const currentProduct = await Product.findById(req.params.productId);
        if (!currentProduct) {
          return res.apiError({
            status: 404,
            code: 'oe_panel_shop_product_not_found',
            message: 'Shop product not found'
          });
        }

        const variant = getShopDefaultVariant(currentProduct);
        if (!variant) {
          return res.apiError({
            status: 400,
            code: 'oe_panel_shop_product_variant_missing',
            message: 'Shop product has no editable variant.'
          });
        }

        const { set, error } = createShopProductUpdatePayload(req.body || {});
        if (error) {
          return res.apiError({
            status: 400,
            code: 'oe_panel_shop_product_update_invalid',
            message: error
          });
        }

        if (!Object.keys(set).length) {
          return res.apiSuccess({
            data: { row: serializeProductForOePanel(currentProduct) }
          });
        }

        const updatesVariant = Object.keys(set).some((key) =>
          key.includes('$[variant]')
        );
        const updateOptions = {
          new: true,
          runValidators: true
        };
        if (updatesVariant) {
          updateOptions.arrayFilters = [{ 'variant._id': variant._id }];
        }

        const updatedProduct = await Product.findByIdAndUpdate(
          currentProduct._id,
          { $set: set },
          updateOptions
        );

        await createAdminLog(AdminLog, account, {
          action: 'Updated shop product',
          area: 'Shop',
          target: {
            type: 'product',
            id: String(updatedProduct._id),
            label:
              updatedProduct.identity?.name || updatedProduct.identity?.slug
          },
          previousValue: req.body || {},
          newValue: serializeProductForOePanel(updatedProduct),
          severity: 'medium',
          metadata: {
            collection: 'products',
            changedFields: Object.keys(set)
          }
        });

        res.apiSuccess({
          data: {
            row: serializeProductForOePanel(updatedProduct),
            message: 'Shop product updated.'
          }
        });
      } catch (err) {
        if (err?.code === 11000) {
          return res.apiError({
            status: 409,
            code: 'oe_panel_shop_product_duplicate',
            message: 'A product with that slug or SKU already exists.'
          });
        }

        console.error(`[REQ ${req.id}] Failed to update shop product:`, err);
        res.apiError({
          status: 500,
          code: 'oe_panel_shop_product_update_failed',
          message: 'Failed to update shop product'
        });
      }
    });

    app.delete('/api/oe-panel/shop/products/:productId', async (req, res) => {
      try {
        const account = await requireOePanelAccount(req, res);
        if (!account) return;
        if (!requireOePanelPermission(account, res, 'shop.products.manage')) {
          return;
        }

        const currentProduct = await Product.findById(req.params.productId);
        if (!currentProduct) {
          return res.apiError({
            status: 404,
            code: 'oe_panel_shop_product_not_found',
            message: 'Shop product not found'
          });
        }

        const updatedProduct = await Product.findByIdAndUpdate(
          currentProduct._id,
          {
            $set: {
              'publishing.status': 'archived',
              'publishing.isActive': false,
              'publishing.deletedAt': new Date()
            }
          },
          { new: true }
        );

        await createAdminLog(AdminLog, account, {
          action: 'Archived shop product',
          area: 'Shop',
          target: {
            type: 'product',
            id: String(updatedProduct._id),
            label:
              updatedProduct.identity?.name || updatedProduct.identity?.slug
          },
          previousValue: serializeProductForOePanel(currentProduct),
          newValue: 'Archived',
          severity: 'high',
          metadata: {
            collection: 'products'
          }
        });

        res.apiSuccess({
          data: {
            row: serializeProductForOePanel(updatedProduct),
            message: 'Shop product archived.'
          }
        });
      } catch (err) {
        console.error(`[REQ ${req.id}] Failed to archive shop product:`, err);
        res.apiError({
          status: 500,
          code: 'oe_panel_shop_product_archive_failed',
          message: 'Failed to archive shop product'
        });
      }
    });
  }
}

module.exports = { registerOePanelShopProductRoutes };
