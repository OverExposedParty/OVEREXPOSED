function createOeCustomisationSerializers({
  formatOePanelDateTime,
  formatPartyGameLabel,
  getOeCustomisationFileExists
}) {
  function serializeOeCustomisationPackForPanel(pack, imageCount = 0) {
    const active = pack.enabled && pack.status === 'published';

    return {
      key: pack.slug || '-',
      pack: pack.title || formatPartyGameLabel(pack.slug),
      slug: pack.slug || '-',
      prefix: pack.prefix || '-',
      status: formatPartyGameLabel(pack.status),
      active: active ? 'Yes' : 'No',
      images: String(imageCount),
      colours:
        [pack.assets?.colour, pack.assets?.secondaryColour]
          .filter(Boolean)
          .join(' / ') || '-',
      updated: formatOePanelDateTime(pack.updatedAt),
      details: {
        pack: pack.title || formatPartyGameLabel(pack.slug),
        slug: pack.slug || '-',
        prefix: pack.prefix || '-',
        description: pack.description || '-',
        status: formatPartyGameLabel(pack.status),
        active: active ? 'Yes' : 'No',
        images: String(imageCount),
        colour: pack.assets?.colour || '-',
        secondaryColour: pack.assets?.secondaryColour || '-',
        updated: formatOePanelDateTime(pack.updatedAt)
      }
    };
  }

  function serializeOeCustomisationImageForPanel(image) {
    const fileExists = getOeCustomisationFileExists(image.filePath);

    return {
      key: image.oeId || '-',
      preview: image.filePath || '',
      oeId: image.oeId || '-',
      name: image.name || '-',
      pack: image.packSlug || '-',
      slot: image.slot || '-',
      status: formatPartyGameLabel(image.status),
      active: image.enabled ? 'Yes' : 'No',
      blacklisted: image.blacklist ? 'Yes' : 'No',
      filePath: image.filePath || '-',
      fileExists: fileExists ? 'Yes' : 'No',
      findTheOe:
        [image.findTheOe?.category, image.findTheOe?.tone]
          .filter(Boolean)
          .join(' / ') || '-',
      updated: formatOePanelDateTime(image.updatedAt),
      details: {
        oeId: image.oeId || '-',
        name: image.name || '-',
        pack: image.packSlug || '-',
        slot: image.slot || '-',
        status: formatPartyGameLabel(image.status),
        active: image.enabled ? 'Yes' : 'No',
        blacklisted: image.blacklist ? 'Yes' : 'No',
        filePath: image.filePath || '-',
        fileExists: fileExists ? 'Yes' : 'No',
        findTheOeCategory: image.findTheOe?.category || '-',
        findTheOeTone: image.findTheOe?.tone || '-',
        findTheOeRgb: Array.isArray(image.findTheOe?.rgb)
          ? image.findTheOe.rgb.join(', ')
          : '-',
        updated: formatOePanelDateTime(image.updatedAt)
      }
    };
  }

  return {
    serializeOeCustomisationImageForPanel,
    serializeOeCustomisationPackForPanel
  };
}

module.exports = {
  createOeCustomisationSerializers
};
