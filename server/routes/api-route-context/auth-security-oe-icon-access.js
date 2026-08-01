function createOeIconAccessTools({
  canUseOeItem,
  OeCustomisation,
  defaultOeIcon,
  oeIconPattern
}) {
  function normalizeOeIcon(oeIcon) {
    if (typeof oeIcon !== 'string') return null;

    const normalised = oeIcon.trim();
    return oeIconPattern.test(normalised) ? normalised : null;
  }

  function isDefaultOeIcon(oeIcon) {
    return !oeIcon || oeIcon === defaultOeIcon;
  }

  function getRequestedOeIcon(req) {
    return normalizeOeIcon(req.body?.oeIcon || req.body?.userIcon);
  }

  function parseOeIconParts(oeIcon) {
    const normalized = normalizeOeIcon(oeIcon);
    return normalized ? normalized.split(':') : [];
  }

  function normalizeCustomisationPreferences(input = {}) {
    const normalizeList = (value) => [
      ...new Set(
        (Array.isArray(value) ? value : [])
          .map((item) => String(item || '').trim())
          .filter(Boolean)
      )
    ];

    return {
      showLockedOes: input.showLockedOes !== false,
      disabledOes: normalizeList(input.disabledOes),
      disabledPacks: normalizeList(input.disabledPacks)
    };
  }

  async function validateAccountOeIconAccess(account, oeIcon) {
    const oeIds = parseOeIconParts(oeIcon);
    if (oeIds.length !== 4) {
      return {
        valid: false,
        code: 'invalid_oe_icon',
        message: 'OE customisation is invalid'
      };
    }

    const images = await OeCustomisation.find({
      recordType: 'image',
      oeId: { $in: oeIds },
      enabled: true,
      status: 'published'
    }).lean();
    const imagesById = new Map(images.map((image) => [image.oeId, image]));

    for (const oeId of oeIds) {
      const item = imagesById.get(oeId);
      if (!item) {
        return {
          valid: false,
          code: 'oe_icon_item_not_found',
          message: 'One of those OE items is not available.'
        };
      }

      if (!canUseOeItem({ account, item, packSlug: item.packSlug })) {
        return {
          valid: false,
          code: 'oe_icon_item_locked',
          message: 'That OE customisation includes a locked item.'
        };
      }
    }

    return { valid: true, images };
  }

  return {
    normalizeOeIcon,
    isDefaultOeIcon,
    getRequestedOeIcon,
    parseOeIconParts,
    normalizeCustomisationPreferences,
    validateAccountOeIconAccess
  };
}

module.exports = { createOeIconAccessTools };
