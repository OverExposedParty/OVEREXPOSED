function serializeProductMedia(mediaItem) {
  if (!mediaItem?.url) return null;

  return {
    url: mediaItem.url,
    alt: mediaItem.alt || '',
    type: mediaItem.type === 'video' ? 'video' : 'image'
  };
}

function getDefaultProductVariant(product) {
  const variants = Array.isArray(product.variants) ? product.variants : [];

  if (!variants.length) return null;

  return (
    variants.find(
      (variant) =>
        variant.inventory?.sku === product.merchandising?.defaultVariantSku
    ) ||
    variants.find((variant) => variant.inventory?.inStock) ||
    variants[0]
  );
}

function serializeShopVariant(variant) {
  const gallery = Array.isArray(variant.media?.gallery)
    ? variant.media.gallery
    : [];
  const entitlement = variant.digitalEntitlement || {};

  return {
    name: variant.name,
    attributes: variant.attributes || {},
    price: variant.price,
    digitalEntitlement: {
      purchaseMethods: Array.isArray(entitlement.purchaseMethods)
        ? entitlement.purchaseMethods
        : ['money'],
      opalPrice: entitlement.opalPrice || null,
      grants: Array.isArray(entitlement.grants) ? entitlement.grants : []
    },
    inventory: {
      sku: variant.inventory?.sku || null,
      inStock: Boolean(variant.inventory?.inStock),
      trackStock: variant.inventory?.trackStock !== false
    },
    media: {
      mainImage: serializeProductMedia({
        ...variant.media?.mainImage,
        type: 'image'
      }),
      gallery: gallery.map(serializeProductMedia).filter(Boolean)
    }
  };
}

function serializeShopProduct(product) {
  const identity = product.identity || {};
  const publishing = product.publishing || {};
  const merchandising = product.merchandising || {};
  const entitlement = product.digitalEntitlement || {};
  const variants = Array.isArray(product.variants) ? product.variants : [];
  const defaultVariant = getDefaultProductVariant(product);
  const gallery = Array.isArray(product.media?.gallery)
    ? product.media.gallery
    : [];
  const variantGallery = Array.isArray(defaultVariant?.media?.gallery)
    ? defaultVariant.media.gallery
    : [];
  const mainMedia =
    serializeProductMedia({
      ...product.media?.mainImage,
      type: 'image'
    }) ||
    serializeProductMedia({
      ...defaultVariant?.media?.mainImage,
      type: 'image'
    }) ||
    serializeProductMedia(gallery[0]) ||
    serializeProductMedia(variantGallery[0]);
  const hoverPreviewIndex = Number.isInteger(merchandising.hoverPreview)
    ? merchandising.hoverPreview
    : null;
  const hoverPreviewMedia =
    hoverPreviewIndex === null
      ? null
      : serializeProductMedia(
          gallery[hoverPreviewIndex] || variantGallery[hoverPreviewIndex]
        );

  return {
    identity: {
      name: identity.name,
      description: identity.description,
      shortDescription: identity.shortDescription,
      type: identity.type,
      tags: Array.isArray(identity.tags) ? identity.tags : [],
      slug: identity.slug || null,
      previousSlugs: Array.isArray(identity.previousSlugs)
        ? identity.previousSlugs
        : [],
      searchKeywords: Array.isArray(identity.searchKeywords)
        ? identity.searchKeywords
        : []
    },
    publishing,
    merchandising,
    system: {
      id: product.system?.id || product._id.toString(),
      createdAt: product.system?.createdAt || null,
      updatedAt: product.system?.updatedAt || null
    },
    name: identity.name,
    shortDescription: identity.shortDescription,
    price: defaultVariant?.price || null,
    digitalEntitlement: {
      purchaseMethods: Array.isArray(entitlement.purchaseMethods)
        ? entitlement.purchaseMethods
        : ['money'],
      opalPrice: entitlement.opalPrice || null,
      grants: Array.isArray(entitlement.grants) ? entitlement.grants : []
    },
    publishedAt: publishing.publishedAt || null,
    defaultVariantSku: merchandising.defaultVariantSku || null,
    variants: variants.map(serializeShopVariant),
    mainMedia,
    hoverPreview: hoverPreviewIndex,
    hoverPreviewMedia
  };
}

module.exports = {
  getDefaultProductVariant,
  serializeProductMedia,
  serializeShopProduct,
  serializeShopVariant
};
