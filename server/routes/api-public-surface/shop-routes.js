function registerPublicShopRoutes(context) {
  const { app } = context;

  with (context) {
    app.get('/api/shop/products', async (req, res) => {
      try {
        const account = await getCurrentAccount(req);
        if (!account) {
          return res.apiError({
            status: 401,
            code: 'account_required',
            message: 'Sign in to view the shop.'
          });
        }
        if (!requireFeatureAccess(account, res, 'shop')) return;

        const products = await Product.find({
          'publishing.status': 'active',
          'publishing.visibility': 'public',
          'publishing.isActive': true,
          'publishing.deletedAt': null
        })
          .sort({ 'merchandising.sortOrder': 1, 'system.createdAt': -1 })
          .limit(200)
          .lean();

        res.apiSuccess({ data: products.map(serializeShopProduct) });
      } catch (err) {
        console.error(`[REQ ${req.id}] Failed to fetch shop products:`, err);
        res.apiError({
          status: 500,
          code: 'shop_products_fetch_failed',
          message: 'Failed to fetch shop products'
        });
      }
    });

    app.get('/api/shop/account-container-access', async (req, res) => {
      res.set('Cache-Control', 'no-store');

      try {
        const account = await getCurrentAccount(req);
        if (!account) {
          return res.apiSuccess({ data: { enabled: false } });
        }

        const config = await ShopConfig.findOne({ key: 'account-container' })
          .select('accountCommercePublic')
          .lean();
        const enabled =
          config?.accountCommercePublic === true ||
          canAccessFeature(account, 'shop');

        return res.apiSuccess({ data: { enabled } });
      } catch (err) {
        console.error(
          `[REQ ${req.id}] Failed to fetch account shop access:`,
          err
        );
        return res.apiError({
          status: 500,
          code: 'shop_account_access_fetch_failed',
          message: 'Failed to fetch account shop access'
        });
      }
    });

    app.post('/api/shop/purchase-with-opals', async (req, res) => {
      try {
        const account = await getCurrentAccount(req);
        if (!account) {
          return res.apiError({
            status: 401,
            code: 'account_required',
            message: 'Sign in to spend Opals.'
          });
        }

        if (!requireVerifiedAccount(res, account, 'spend Opals')) return;
        if (!requireFeatureAccess(account, res, 'shop')) return;

        const productRef = String(
          req.body?.productId || req.body?.productSlug || req.body?.slug || ''
        ).trim();
        const variantSku = String(req.body?.variantSku || '').trim() || null;

        if (!productRef) {
          return res.apiError({
            status: 400,
            code: 'product_required',
            message: 'Choose an item to buy.'
          });
        }

        const productQuery = productRef.match(/^[a-f\d]{24}$/i)
          ? { _id: productRef }
          : { 'identity.slug': productRef.toLowerCase() };
        const product = await Product.findOne({
          ...productQuery,
          'publishing.status': 'active',
          'publishing.visibility': 'public',
          'publishing.isActive': true,
          'publishing.deletedAt': null
        }).lean();

        if (!product) {
          return res.apiError({
            status: 404,
            code: 'shop_product_not_found',
            message: 'That shop item could not be found.'
          });
        }

        const result = await spendOpalsForProduct({
          Account,
          Achievement,
          OlingState,
          accountId: account._id,
          product,
          variantSku
        });

        if (result.error) {
          return res.apiError(result.error);
        }

        return res.apiSuccess(
          {
            message: 'Item unlocked with Opals.',
            purchase: result.purchase,
            account: serializeAccount(result.account, {
              olingState: result.olingState
            })
          },
          201
        );
      } catch (err) {
        console.error(`[REQ ${req.id}] Failed to buy item with Opals:`, err);
        return res.apiError({
          status: 500,
          code: 'opals_purchase_failed',
          message: 'Failed to buy item with Opals.'
        });
      }
    });
  }
}

module.exports = { registerPublicShopRoutes };
