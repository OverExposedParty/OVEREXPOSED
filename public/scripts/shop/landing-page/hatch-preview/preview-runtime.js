(function () {
  const shop = (window.OE_SHOP_LANDING = window.OE_SHOP_LANDING || {});

  with (shop) {
    function getShopHatchViews() {
      if (shopHatchViews) return shopHatchViews;
      if (!window.OlingLabOlings?.create) return null;

      shopHatchViews = window.OlingLabOlings.create({
        state: {
          layers: ['flight', 'body', 'eyes', 'mouth'],
          consumables: new Map()
        },
        helpers: {
          closeMenu: () => closeSharedPopup(document.querySelector('.shop-hatch-preview-backdrop')),
          closeStagePanel: closeShopHatchStagePanel,
          applyRarityTheme: applyShopRarityTheme,
          createDetailRow: createShopHatchDetailRow,
          createImage: createShopHatchImage,
          createInlineAction: createShopHatchInlineAction,
          createPanelBackButton: createShopHatchPanelBackButton,
          createStatsToggleButton: createShopHatchStatsToggleButton,
          createTabMenu: createShopHatchTabMenu,
          formatTitle: formatShopHatchTitle,
          openStagePanel: openShopHatchStagePanel,
          openMenu: openShopHatchMenu
        }
      });
      return shopHatchViews;
    }

    function createPreviewHatchData(product, eggDefinition, personalities = []) {
      const eggGrant = getProductEggGrant(product);
      const eggKey = eggDefinition?.key || eggGrant?.key || 'preview-egg';
      const rollableOdds = getRollableEggOdds(product, eggDefinition);
      const allSets = Array.isArray(eggDefinition?.sets) ? eggDefinition.sets : [];
      const fallbackSet = allSets[0] || null;
      const buildRarities = {};
      const rolls = {};
      const rolledSets = {};
      const traits = Object.fromEntries(
        ['flight', 'body', 'eyes', 'mouth'].map((layer) => {
          const rarity = rollWeightedKey(rollableOdds) || fallbackSet?.rarity || 'common';
          const set = pickRandom(getSetsForRarity(eggDefinition, rarity)) || fallbackSet;
          const layers = set?.metadata?.layers || {};
          buildRarities[layer] = rarity;
          rolledSets[layer] = set;
          rolls[layer] = {
            rarityRolled: rarity,
            traitKey: set?.traits?.[layer] || `${layer}-preview`
          };
          return [
            layer,
            {
              key: rolls[layer].traitKey,
              name: formatShopHatchTitle(rolls[layer].traitKey || layer),
              rarity,
              flightType: layer === 'flight' ? 'wings' : undefined,
              assets: { image: layers[layer] || '' }
            }
          ];
        })
      );
      const matchingSet = (() => {
        const sets = Object.values(rolledSets).filter(Boolean);
        const firstSetKey = sets[0]?.key || '';
        return sets.length === 4 && sets.every((set) => set?.key === firstSetKey)
          ? sets[0]
          : null;
      })();
      const personality = pickRandom(
        personalities.filter(
          (item) => item?.enabled !== false && (item?.status || 'published') === 'published'
        )
      ) || { key: 'curious', name: 'Curious' };
      rolls.personality = { personalityKey: personality.key };
      const oling = {
        id: 'shop-preview-hatch-oling',
        name: 'Preview Hatch',
        eggKey,
        rarity: matchingSet?.rarity || 'mixed',
        collection: eggDefinition?.collection || 'base',
        personalityKey: personality.key,
        personality: {
          key: personality.key,
          name: personality.name || formatShopHatchTitle(personality.key)
        },
        matchingSet: {
          key: matchingSet?.key || 'mixed',
          name: matchingSet?.name || 'Mixed'
        },
        buildRarities,
        traits
      };
      const createdAt = new Date().toISOString();
      return {
        oling,
        receipt: {
          id: 'shop-preview-hatch-receipt',
          eggKey,
          hatchedAt: createdAt,
          createdAt,
          source: 'Shop Preview',
          matchingSet: oling.matchingSet.name,
          rarity: formatShopHatchTitle(oling.rarity),
          influences: [],
          rolls,
          eggOddsSnapshot: Object.fromEntries(getEggOdds(product, eggDefinition))
        }
      };
    }

    async function openPreviewHatch(product, statusNode) {
      const views = getShopHatchViews();
      if (!views) {
        if (statusNode) statusNode.textContent = 'Hatch preview is still loading.';
        return;
      }

      try {
        const [eggs, personalities] = await Promise.all([
          loadOlingEggs(),
          loadOlingPersonalities(),
          loadRarityPalette()
        ]);
        const eggDefinition = findOlingEggDefinition(product, eggs);
        const { oling, receipt } = createPreviewHatchData(
          product,
          eggDefinition,
          personalities
        );
        openShopHatchMenu(
          'Preview Hatch',
          [views.createRevealMenu(oling, receipt, { hideCloseAction: true })],
          { theme: 'egg-shop' }
        );
      } catch (error) {
        console.error('Failed to open hatch preview:', error);
        if (statusNode) statusNode.textContent = error.message || 'Could not preview hatch.';
      }
    }

    function getProductStyles(product) {
      return Array.isArray(product?.merchandising?.catalog?.style)
        ? product.merchandising.catalog.style
        : [];
    }

    Object.assign(shop, {
      createPreviewHatchData,
      getProductStyles,
      getShopHatchViews,
      openPreviewHatch
    });
  }
})();
