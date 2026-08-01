function createOeCustomisationIssueHelpers({
  fs,
  path,
  PUBLIC_DIRECTORY,
  getOeCustomisationFileExists,
  validateOeCustomisationSvgDimensions
}) {
  function getOeCustomisationIssues({ packs, images }) {
    const issues = [];
    const packSlugs = new Set(packs.map((pack) => pack.slug).filter(Boolean));
    const prefixes = new Map();
    const ids = new Map();
    const validSlots = new Set([
      'colour',
      'head-slot',
      'eyes-slot',
      'mouth-slot'
    ]);

    packs.forEach((pack) => {
      if (!pack.slug) {
        issues.push({
          severity: 'error',
          issue: 'Pack is missing a slug',
          item: pack.title || '-',
          pack: '-',
          series: 'packs',
          query: `[pack:${pack.title || '-'}]`
        });
      }

      if (pack.prefix) {
        const existing = prefixes.get(pack.prefix) || [];
        existing.push(pack.slug);
        prefixes.set(pack.prefix, existing);
      }
    });

    prefixes.forEach((packList, prefix) => {
      if (packList.length <= 1) return;
      issues.push({
        severity: 'warning',
        issue: `Duplicate pack prefix ${prefix}`,
        item: prefix,
        pack: packList.join(', '),
        series: 'packs',
        query: `[prefix:${prefix}]`
      });
    });

    images.forEach((image) => {
      if (image.oeId) {
        const existing = ids.get(image.oeId) || [];
        existing.push(image.packSlug);
        ids.set(image.oeId, existing);
      }

      if (!image.packSlug || !packSlugs.has(image.packSlug)) {
        issues.push({
          severity: 'error',
          issue: 'Image references a missing pack',
          item: image.oeId || image.name || '-',
          pack: image.packSlug || '-',
          series: 'images',
          query: `[OE-ID:${image.oeId || ''}]`
        });
      }

      if (!validSlots.has(image.slot)) {
        issues.push({
          severity: 'error',
          issue: 'Image has an invalid slot',
          item: image.oeId || image.name || '-',
          pack: image.packSlug || '-',
          series: 'images',
          query: `[OE-ID:${image.oeId || ''}]`
        });
      }

      if (!getOeCustomisationFileExists(image.filePath)) {
        issues.push({
          severity: 'error',
          issue: 'Image file is missing',
          item: image.oeId || image.name || '-',
          pack: image.packSlug || '-',
          series: 'images',
          query: `[OE-ID:${image.oeId || ''}]`
        });
      } else {
        const resolvedPath = path.resolve(
          PUBLIC_DIRECTORY,
          String(image.filePath || '').replace(/^\//, '')
        );
        let svgValidation;
        try {
          svgValidation = validateOeCustomisationSvgDimensions(
            fs.readFileSync(resolvedPath, 'utf8')
          );
        } catch {
          svgValidation = {
            error: 'Image file could not be read'
          };
        }

        if (svgValidation.error) {
          issues.push({
            severity: 'error',
            issue: svgValidation.error,
            item: image.oeId || image.name || '-',
            pack: image.packSlug || '-',
            series: 'images',
            query: `[OE-ID:${image.oeId || ''}]`
          });
        }
      }

      if (
        !Array.isArray(image.findTheOe?.rgb) ||
        image.findTheOe.rgb.length !== 3 ||
        !image.findTheOe?.category ||
        !image.findTheOe?.tone
      ) {
        issues.push({
          severity: 'warning',
          issue: 'Find The OE metadata is incomplete',
          item: image.oeId || image.name || '-',
          pack: image.packSlug || '-',
          series: 'images',
          query: `[OE-ID:${image.oeId || ''}]`
        });
      }
    });

    ids.forEach((packList, oeId) => {
      if (packList.length <= 1) return;
      issues.push({
        severity: 'error',
        issue: `Duplicate OE ID ${oeId}`,
        item: oeId,
        pack: packList.join(', '),
        series: 'images',
        query: `[OE-ID:${oeId}]`
      });
    });

    return issues;
  }

  return {
    getOeCustomisationIssues
  };
}

module.exports = {
  createOeCustomisationIssueHelpers
};
