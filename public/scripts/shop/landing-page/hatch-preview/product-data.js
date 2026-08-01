(function () {
  const shop = (window.OE_SHOP_LANDING = window.OE_SHOP_LANDING || {});

  with (shop) {
    function formatProductPrice(product) {
      const opalAmount = getProductOpalAmount(product);
      if (opalAmount > 0) return `${opalAmount.toLocaleString()} Opals`;

      const price = product?.price;
      const amount = Number(price?.amount || 0);
      const currency = price?.currency || 'GBP';
      try {
        return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(amount);
      } catch {
        return `${currency} ${amount.toFixed(2)}`;
      }
    }

    function getProductOpalAmount(product) {
      const entitlement = product?.digitalEntitlement || {};
      const methods = Array.isArray(entitlement.purchaseMethods)
        ? entitlement.purchaseMethods
        : [];
      const opalAmount = Number(entitlement.opalPrice?.amount || 0);

      return methods.includes('opals') && opalAmount > 0 ? opalAmount : 0;
    }

    function isOpalDigitalProduct(product) {
      return product?.identity?.type === 'digital' && getProductOpalAmount(product) > 0;
    }

    function getProductGrants(product) {
      const productGrants = Array.isArray(product?.digitalEntitlement?.grants)
        ? product.digitalEntitlement.grants
        : [];
      const variantGrants = Array.isArray(product?.variants)
        ? product.variants.flatMap((variant) =>
          Array.isArray(variant?.digitalEntitlement?.grants)
            ? variant.digitalEntitlement.grants
            : []
        )
        : [];

      return [...productGrants, ...variantGrants];
    }

    function getProductEggGrant(product) {
      return getProductGrants(product).find((grant) => grant.type === 'oling_egg');
    }

    function loadOlingEggs() {
      if (!olingEggsPromise) {
        olingEggsPromise = fetch(OLING_EGGS_ENDPOINT, {
          headers: { Accept: 'application/json' }
        })
          .then((response) => {
            if (!response.ok) throw new Error('Could not load egg odds.');
            return response.json();
          })
          .then((payload) => Array.isArray(payload?.eggs) ? payload.eggs : []);
      }

      return olingEggsPromise;
    }

    function loadOlingPersonalities() {
      if (!olingPersonalitiesPromise) {
        olingPersonalitiesPromise = fetch(OLING_PERSONALITIES_ENDPOINT, {
          headers: { Accept: 'application/json' }
        })
          .then((response) => {
            if (!response.ok) throw new Error('Could not load personalities.');
            return response.json();
          })
          .then((payload) =>
            Array.isArray(payload?.personalities) ? payload.personalities : []
          );
      }

      return olingPersonalitiesPromise;
    }

    function loadRarityPalette() {
      if (!rarityPalettePromise) {
        rarityPalettePromise = fetch(RARITY_PALETTE_ENDPOINT, {
          headers: { Accept: 'application/json' }
        })
          .then((response) => {
            if (!response.ok) throw new Error('Could not load rarity colours.');
            return response.json();
          })
          .then((payload) => {
            rarityPalette = payload && typeof payload === 'object' ? payload : {};
            return rarityPalette;
          })
          .catch((error) => {
            console.error('Failed to load rarity colours:', error);
            rarityPalette = {};
            return rarityPalette;
          });
      }

      return rarityPalettePromise;
    }

    function getEggLookupKeys(product) {
      const grant = getProductEggGrant(product);
      const key = String(grant?.key || '').trim();
      const eggType = String(grant?.metadata?.eggType || '').trim();
      return [key, eggType, eggType ? `${eggType}-egg` : '']
        .filter(Boolean)
        .map((value) => value.toLowerCase());
    }

    function findOlingEggDefinition(product, eggs) {
      const lookupKeys = getEggLookupKeys(product);
      return eggs.find((egg) =>
        lookupKeys.includes(String(egg?.key || '').toLowerCase())
      );
    }

    function getProductTags(product) {
      return Array.isArray(product?.identity?.tags) ? product.identity.tags : [];
    }

    function getEggOdds(product, eggDefinition) {
      const grant = getProductEggGrant(product);
      const odds = grant?.metadata?.rarityOdds
        || grant?.rarityOdds
        || product?.merchandising?.rarityOdds
        || eggDefinition?.rarityOdds
        || {};

      return Object.entries(odds)
        .map(([rarity, chance]) => [rarity, Number(chance)])
        .filter(([rarity, chance]) => rarity && Number.isFinite(chance));
    }

    function formatEggChance(value) {
      const chance = Number(value);
      if (!Number.isFinite(chance)) return '0%';
      return chance <= 1 ? `${Math.round(chance * 100)}%` : `${Math.round(chance)}%`;
    }

    function rollWeightedKey(weights) {
      const entries = Object.entries(weights || {})
        .map(([key, weight]) => [key, Number(weight) || 0])
        .filter(([, weight]) => weight > 0);
      const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
      if (total <= 0) return null;

      let roll = Math.random() * total;
      for (const [key, weight] of entries) {
        roll -= weight;
        if (roll <= 0) return key;
      }

      return entries[entries.length - 1]?.[0] || null;
    }

    function pickRandom(values) {
      if (!Array.isArray(values) || !values.length) return null;
      return values[Math.floor(Math.random() * values.length)] || null;
    }

    function getRollableEggOdds(product, eggDefinition) {
      const availableRarities = new Set(
        (Array.isArray(eggDefinition?.sets) ? eggDefinition.sets : [])
          .map((set) => String(set?.rarity || '').toLowerCase())
          .filter(Boolean)
      );
      return Object.fromEntries(
        getEggOdds(product, eggDefinition).filter(
          ([rarity, chance]) => chance > 0 && availableRarities.has(String(rarity).toLowerCase())
        )
      );
    }

    function getSetsForRarity(eggDefinition, rarity) {
      const normalizedRarity = String(rarity || '').toLowerCase();
      return (Array.isArray(eggDefinition?.sets) ? eggDefinition.sets : [])
        .filter((set) => String(set?.rarity || '').toLowerCase() === normalizedRarity);
    }

    Object.assign(shop, {
      findOlingEggDefinition,
      formatEggChance,
      formatProductPrice,
      getEggLookupKeys,
      getEggOdds,
      getProductEggGrant,
      getProductGrants,
      getProductOpalAmount,
      getProductTags,
      getRollableEggOdds,
      getSetsForRarity,
      isOpalDigitalProduct,
      loadOlingEggs,
      loadOlingPersonalities,
      loadRarityPalette,
      pickRandom,
      rollWeightedKey
    });
  }
})();
