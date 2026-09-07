(function (globalScope) {
  const defaultOeIcon = '0000:0100:0200:0300';

  function createLayers(oeIcon, { className = '' } = {}) {
    if (
      typeof globalScope.parseCustomisationString !== 'function' ||
      typeof globalScope.getFilePathByCustomisationId !== 'function'
    ) {
      return [];
    }

    const icon = String(oeIcon || defaultOeIcon).trim();
    if (icon.split(':').length !== 4) return [];

    const parsed = globalScope.parseCustomisationString(icon);
    const sources = [
      globalScope.getFilePathByCustomisationId(parsed.colour, 'colour'),
      globalScope.getFilePathByCustomisationId(parsed.head, 'headSlot'),
      globalScope.getFilePathByCustomisationId(parsed.eyes, 'eyesSlot'),
      globalScope.getFilePathByCustomisationId(parsed.mouth, 'mouthSlot')
    ];

    return sources.filter(Boolean).map((src) => {
      const image = globalScope.document.createElement('img');
      image.className = className;
      image.src = src;
      image.alt = '';
      return image;
    });
  }

  globalScope.OlingClashOeLayers = Object.freeze({ createLayers });
})(typeof window !== 'undefined' ? window : globalThis);
