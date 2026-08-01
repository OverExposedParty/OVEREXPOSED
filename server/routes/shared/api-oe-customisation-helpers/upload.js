function createOeCustomisationUploadHelpers({
  fs,
  path,
  PUBLIC_DIRECTORY,
  OE_CUSTOMISATION_SVG_WIDTH,
  OE_CUSTOMISATION_SVG_HEIGHT
}) {
  function getOeCustomisationFileExists(filePath) {
    if (!filePath || !String(filePath).startsWith('/')) return false;

    const resolvedPath = path.resolve(
      PUBLIC_DIRECTORY,
      String(filePath).replace(/^\//, '')
    );

    if (!resolvedPath.startsWith(PUBLIC_DIRECTORY)) return false;
    return fs.existsSync(resolvedPath);
  }

  function slugifyOeCustomisationFileName(value) {
    return (
      String(value || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') || 'oe-image'
    );
  }

  function normalizeOeCustomisationImageFolder(value) {
    const folderPath = String(value || '')
      .trim()
      .replace(/\\/g, '/')
      .replace(/\/+$/g, '');

    if (!folderPath) return { error: 'OE image folder path is required.' };
    if (!folderPath.startsWith('/images/user-customisation/')) {
      return {
        error:
          'OE image folder path must be inside /images/user-customisation/.'
      };
    }
    if (folderPath.toLowerCase().endsWith('.svg')) {
      return { error: 'Use a folder path, not a file path ending in .svg.' };
    }

    const resolvedFolder = path.resolve(
      PUBLIC_DIRECTORY,
      folderPath.replace(/^\//, '')
    );

    if (!resolvedFolder.startsWith(PUBLIC_DIRECTORY)) {
      return { error: 'OE image folder path is invalid.' };
    }

    return { folderPath, resolvedFolder };
  }

  function saveOeCustomisationSvgUpload({
    file,
    folderPath,
    resolvedFolder,
    name
  }) {
    if (!file?.buffer?.length) return { error: 'An SVG upload is required.' };

    const svgText = file.buffer.toString('utf8').trimStart();
    if (
      !/^<svg[\s>]/i.test(svgText) &&
      !/^<\?xml[\s\S]*?<svg[\s>]/i.test(svgText)
    ) {
      return { error: 'Uploaded file does not look like an SVG.' };
    }

    const dimensionValidation = validateOeCustomisationSvgDimensions(svgText);
    if (dimensionValidation.error) return dimensionValidation;

    const fileName = `${slugifyOeCustomisationFileName(name)}.svg`;
    const resolvedFilePath = path.resolve(resolvedFolder, fileName);

    if (!resolvedFilePath.startsWith(resolvedFolder)) {
      return { error: 'OE image file path is invalid.' };
    }

    fs.mkdirSync(resolvedFolder, { recursive: true });
    fs.writeFileSync(resolvedFilePath, file.buffer);

    return {
      filePath: `${folderPath}/${fileName}`
    };
  }

  function validateOeCustomisationSvgDimensions(svgText) {
    const svgOpenTag =
      String(svgText || '').match(/<svg\b[^>]*>/i)?.[0] || '';
    const viewBoxMatch = svgOpenTag.match(
      /\bviewBox\s*=\s*["']\s*([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s*["']/i
    );

    if (viewBoxMatch) {
      const width = Number(viewBoxMatch[3]);
      const height = Number(viewBoxMatch[4]);
      if (
        width === OE_CUSTOMISATION_SVG_WIDTH &&
        height === OE_CUSTOMISATION_SVG_HEIGHT
      ) {
        return {};
      }

      return {
        error: `OE SVG viewBox must be ${OE_CUSTOMISATION_SVG_WIDTH} x ${OE_CUSTOMISATION_SVG_HEIGHT}.`
      };
    }

    const widthMatch = svgOpenTag.match(/\bwidth\s*=\s*["']\s*([\d.]+)/i);
    const heightMatch = svgOpenTag.match(/\bheight\s*=\s*["']\s*([\d.]+)/i);
    const width = Number(widthMatch?.[1]);
    const height = Number(heightMatch?.[1]);

    if (
      width === OE_CUSTOMISATION_SVG_WIDTH &&
      height === OE_CUSTOMISATION_SVG_HEIGHT
    ) {
      return {};
    }

    return {
      error: `OE SVG must define viewBox="${`0 0 ${OE_CUSTOMISATION_SVG_WIDTH} ${OE_CUSTOMISATION_SVG_HEIGHT}`}" or matching width/height.`
    };
  }

  return {
    getOeCustomisationFileExists,
    normalizeOeCustomisationImageFolder,
    saveOeCustomisationSvgUpload,
    slugifyOeCustomisationFileName,
    validateOeCustomisationSvgDimensions
  };
}

module.exports = {
  createOeCustomisationUploadHelpers
};
