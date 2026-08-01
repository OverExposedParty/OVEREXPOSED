(function () {
  const shop = (window.OE_SHOP_LANDING = window.OE_SHOP_LANDING || {});

  with (shop) {
    function formatTitle(value) {
      return formatTagLabel(value) || '-';
    }

    function getProductDetailText(product) {
      const grants = getProductGrants(product);
      const grant = grants[0] || null;
      const quantity = Number(grant?.quantity || 1);
      const grantType = String(grant?.type || '')
        .replace(/^oling_/, 'oling ')
        .replace(/_/g, ' ');
      const pieces = [
        grantType || product?.merchandising?.catalog?.sub || 'digital item',
        quantity > 1 ? `${quantity}x` : '',
        grant?.key || product.identity?.slug
      ].filter(Boolean);

      return pieces
        .map((piece) =>
          String(piece)
            .trim()
            .replace(/\b\w/g, (letter) => letter.toUpperCase())
        )
        .join(' · ');
    }

    function getPurchaseMessage(product, canAfford, remaining) {
      if (!canAfford) {
        return `You need ${Math.abs(remaining).toLocaleString()} more Opals to buy this item.`;
      }

      if (isConsumableProduct(product)) {
        return 'This will add the consumable to your Oling inventory.';
      }

      if (isEggProduct(product)) {
        return 'This will add the egg to your Oling inventory.';
      }

      if (isFurnitureProduct(product)) {
        return 'This will add the furniture to your Olings Lab inventory.';
      }

      return 'This will unlock the digital item for your account.';
    }

    function getProductDescription(product) {
      return (
        product?.identity?.description ||
        product?.identity?.shortDescription ||
        product?.shortDescription ||
        ''
      );
    }

    function getGrantPurposeText(product, grant) {
      const metadata = grant?.metadata || {};
      const effectType = metadata.effectType || '';

      if (grant?.type === 'oling_consumable') {
        if (effectType === 'hatch_speed') {
          return 'Use it on an incubating egg to speed up hatching.';
        }

        if (effectType === 'rarity_chance') {
          return 'Use it on an egg to improve the chance of rarer hatch results.';
        }

        if (effectType === 'personality_chance') {
          const personality = metadata.personalityKey
            ? ` ${formatTitle(metadata.personalityKey)}`
            : '';
          return `Use it on an egg to nudge the hatch toward a${personality} personality.`;
        }

        if (effectType === 'energy') {
          return 'Use it on an Oling to restore its energy.';
        }

        return 'Use it from your Oling inventory when the matching Oling action is available.';
      }

      if (grant?.type === 'oling_egg') {
        return 'Place it in an incubator to hatch a new Oling.';
      }

      if (grant?.type === 'oling_furniture') {
        return 'Place it in your Olings Lab to decorate the room.';
      }

      if (grant?.type === 'oe') {
        return 'Unlocks an OE customisation layer for your account.';
      }

      if (grant?.type === 'pack') {
        return 'Unlocks a pack of OE customisation items for your account.';
      }

      return getPurchaseMessage(product, true, 0);
    }

    function getProductInfoSummary(product) {
      const grants = getProductGrants(product);
      const primaryGrant = grants[0] || null;
      const metadata = primaryGrant?.metadata || {};
      const description = getProductDescription(product);
      const detailRows = [];

      if (primaryGrant?.type) {
        detailRows.push([
          'Type',
          String(primaryGrant.type)
            .replace(/^oling_/, 'oling ')
            .replace(/_/g, ' ')
        ]);
      }

      if (metadata.consumableCategory || metadata.consumableSubcategory) {
        detailRows.push([
          'Use',
          [metadata.consumableCategory, metadata.consumableSubcategory]
            .filter(Boolean)
            .map(formatTitle)
            .join(' / ')
        ]);
      }

      if (metadata.effectType) {
        detailRows.push(['Effect', metadata.effectType]);
      }

      if (metadata.rarity) {
        detailRows.push(['Rarity', metadata.rarity]);
      }

      const quantity = Number(primaryGrant?.quantity || 1);
      if (quantity > 1) detailRows.push(['Quantity', `${quantity}x`]);

      return {
        description: description || getGrantPurposeText(product, primaryGrant),
        purpose: getGrantPurposeText(product, primaryGrant),
        detailRows
      };
    }

    Object.assign(shop, {
      formatTitle,
      getProductDetailText,
      getPurchaseMessage,
      getProductDescription,
      getGrantPurposeText,
      getProductInfoSummary
    });
  }
})();
