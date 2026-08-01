function registerAccountLibraryRoutes(context) {
  const {
    app,
    getCurrentAccount,
    OeCustomisation,
    Product,
    normalizeCustomisationPreferences,
    serializeAccount,
    getOeItemAccessState,
    getCookieValue,
    Account,
    hashSessionToken,
    getRequestedOeIcon,
    validateAccountOeIconAccess,
    incrementAchievementStat,
    Achievement,
    unlockAchievementByKey,
    recordProfileCompletionAchievement
  } = context;

  app.get('/api/oe-library', async (req, res) => {
    try {
      const account = await getCurrentAccount(req);
      const packs = await OeCustomisation.find({
        recordType: 'pack',
        status: 'published'
      })
        .sort({ slug: 1 })
        .lean();
      const images = await OeCustomisation.find({
        recordType: 'image',
        status: 'published'
      })
        .sort({ packSlug: 1, oeId: 1 })
        .lean();
      const oeProducts = await Product.find({
        'publishing.status': 'active',
        'publishing.visibility': 'public',
        'publishing.isActive': true,
        'publishing.deletedAt': null,
        'digitalEntitlement.grants.type': 'oe'
      }).lean();
      const productByOeId = new Map();
      oeProducts.forEach((product) => {
        const grants = Array.isArray(product.digitalEntitlement?.grants)
          ? product.digitalEntitlement.grants
          : [];
        grants
          .filter((grant) => grant.type === 'oe' && grant.key)
          .forEach((grant) => productByOeId.set(grant.key, product));
      });
      const imagesByPack = images.reduce((map, image) => {
        if (!map.has(image.packSlug)) map.set(image.packSlug, []);
        map.get(image.packSlug).push(image);
        return map;
      }, new Map());
      const preferences = account
        ? normalizeCustomisationPreferences(
            account.customisationPreferences || {}
          )
        : normalizeCustomisationPreferences({});

      res.apiSuccess({
        account: account ? serializeAccount(account) : null,
        customisationPreferences: preferences,
        packs: packs.map((pack) => {
          const packImages = imagesByPack.get(pack.slug) || [];
          return {
            slug: pack.slug,
            name: pack.title || pack.name || pack.slug,
            description: pack.description || '',
            enabled: pack.enabled !== false,
            status: pack.status,
            prefix: pack.prefix || '',
            colour: pack.assets?.colour || '',
            secondaryColour: pack.assets?.secondaryColour || '',
            accessType: packImages[0]
              ? getOeItemAccessState({
                  account,
                  item: packImages[0],
                  packSlug: pack.slug
                }).accessType
              : 'entitlement',
            disabled: preferences.disabledPacks.includes(pack.slug),
            items: packImages.map((image) => {
              const access = getOeItemAccessState({
                account,
                item: image,
                packSlug: pack.slug
              });
              const product = productByOeId.get(image.oeId);

              return {
                id: image.oeId,
                name: image.name,
                slot: image.slot,
                filePath: image.filePath,
                packSlug: image.packSlug,
                enabled: image.enabled !== false,
                status: image.status,
                blacklist: Boolean(image.blacklist),
                findTheOe: image.findTheOe || {},
                access,
                shop: product
                  ? {
                      productId:
                        product._id?.toString?.() || product.system?.id || null,
                      productSlug:
                        product.identity?.slug || product.slug || null,
                      opalPrice:
                        Number(product.digitalEntitlement?.opalPrice?.amount) ||
                        null
                    }
                  : null,
                disabled:
                  preferences.disabledPacks.includes(pack.slug) ||
                  preferences.disabledOes.includes(image.oeId)
              };
            })
          };
        })
      });
    } catch (err) {
      console.error(`[REQ ${req.id}] Failed to fetch OE library:`, err);
      res.apiError({
        status: 500,
        code: 'oe_library_fetch_failed',
        message: 'Failed to fetch OE library'
      });
    }
  });

  app.post('/api/accounts/logout', async (req, res) => {
    const sessionToken = getCookieValue(req.headers.cookie, 'oe_session');

    try {
      if (sessionToken) {
        await Account.updateOne(
          {
            'security.sessions.tokenHash': hashSessionToken(sessionToken)
          },
          {
            $pull: {
              'security.sessions': {
                tokenHash: hashSessionToken(sessionToken)
              }
            }
          },
          { runValidators: false }
        );
      }

      res.clearCookie('oe_session', {
        httpOnly: true,
        sameSite: 'lax',
        secure: req.secure
      });

      res.apiSuccess({
        message: 'Logged out successfully'
      });
    } catch (err) {
      console.error(`[REQ ${req.id}] Failed to log out:`, err);
      res.apiError({
        status: 500,
        code: 'logout_failed',
        message: 'Failed to log out'
      });
    }
  });

  app.patch('/api/accounts/me/oe-icon', async (req, res) => {
    const account = await getCurrentAccount(req);

    if (!account) {
      return res.apiError({
        status: 401,
        code: 'account_required',
        message: 'Sign in to save your OE'
      });
    }

    const oeIcon = getRequestedOeIcon(req);
    if (!oeIcon) {
      return res.apiError({
        status: 400,
        code: 'invalid_oe_icon',
        message: 'OE customisation is invalid'
      });
    }

    try {
      const access = await validateAccountOeIconAccess(account, oeIcon);
      if (!access.valid) {
        return res.apiError({
          status: 403,
          code: access.code,
          message: access.message
        });
      }

      const previousOeIcon = account.profile?.oeIcon;
      account.profile.oeIcon = oeIcon;
      account.profile.lastProfileUpdatedAt = new Date();
      if (JSON.stringify(previousOeIcon) !== JSON.stringify(oeIcon)) {
        await incrementAchievementStat({
          Achievement,
          account,
          statKey: 'oeCustomisationChanges',
          source: 'oe-customisation',
          save: false
        });
        await unlockAchievementByKey({
          Achievement,
          account,
          key: 'fresh-and-fitted',
          source: 'oe-customisation',
          save: false
        });

        const equippedPacks = new Set(
          access.images.map((image) => image.packSlug).filter(Boolean)
        );
        if (equippedPacks.size === 1 && !equippedPacks.has('blank')) {
          await unlockAchievementByKey({
            Achievement,
            account,
            key: 'matching-set',
            source: 'oe-matching-set',
            save: false
          });
        }
      }
      await recordProfileCompletionAchievement(account, 'oe-icon');
      await account.save();

      res.apiSuccess({
        message: 'OE customisation saved',
        account: serializeAccount(account)
      });
    } catch (err) {
      console.error(`[REQ ${req.id}] Failed to save account OE:`, err);
      res.apiError({
        status: 500,
        code: 'account_oe_save_failed',
        message: 'Failed to save OE customisation'
      });
    }
  });
}

module.exports = { registerAccountLibraryRoutes };
