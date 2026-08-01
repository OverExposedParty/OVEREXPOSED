(function () {
  function parseSvg(svgText) {
    return new DOMParser().parseFromString(svgText, 'image/svg+xml')
      .documentElement;
  }

  function getSvgNumber(value, fallback = 0) {
    const number = Number.parseFloat(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function getSvgViewBox(svgText) {
    const svg = parseSvg(svgText);
    const values = String(svg.getAttribute('viewBox') || '')
      .trim()
      .split(/[\s,]+/)
      .map(Number);
    const width = Number(values[2]);
    const height = Number(values[3]);
    return width > 0 && height > 0 ? { width, height } : null;
  }

  function getSvgScale(svg, targetSize) {
    const viewBox = String(svg.getAttribute('viewBox') || '')
      .trim()
      .split(/[\s,]+/)
      .map(Number);
    const width = Number(viewBox[2]) || targetSize;
    const height = Number(viewBox[3]) || targetSize;
    return {
      x: targetSize / width,
      y: targetSize / height
    };
  }

  function parseRectPlacement(svgText, targetSize) {
    const svg = parseSvg(svgText);
    const placement = svg.querySelector('rect');
    if (!placement) return null;

    const scale = getSvgScale(svg, targetSize);
    const width = getSvgNumber(placement.getAttribute('width')) * scale.x;
    const height = getSvgNumber(placement.getAttribute('height')) * scale.y;
    if (width <= 0 || height <= 0) return null;

    return {
      x: getSvgNumber(placement.getAttribute('x')) * scale.x,
      y: getSvgNumber(placement.getAttribute('y')) * scale.y,
      width,
      height
    };
  }

  function parseRectCenterPlacements(svgText, targetSize) {
    const svg = parseSvg(svgText);
    const scale = getSvgScale(svg, targetSize);

    return [...svg.querySelectorAll('rect')]
      .map((slot) => {
        const width = getSvgNumber(slot.getAttribute('width')) * scale.x;
        const height = getSvgNumber(slot.getAttribute('height')) * scale.y;
        if (width <= 0 || height <= 0) return null;
        return {
          x: getSvgNumber(slot.getAttribute('x')) * scale.x + width / 2,
          y: getSvgNumber(slot.getAttribute('y')) * scale.y + height / 2,
          width,
          height
        };
      })
      .filter(Boolean);
  }

  async function parseMaskPlacement(svgText, targetSize) {
    const svg = parseSvg(svgText);
    if (!getSvgViewBox(svgText)) return null;

    const canvas = document.createElement('canvas');
    canvas.width = targetSize;
    canvas.height = targetSize;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return null;

    const image = new Image();
    const source = URL.createObjectURL(
      new Blob([svg.outerHTML], { type: 'image/svg+xml' })
    );
    try {
      await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = reject;
        image.src = source;
      });
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
    } finally {
      URL.revokeObjectURL(source);
    }

    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    const runs = [];
    let totalPixels = 0;
    for (let y = 0; y < canvas.height; y += 1) {
      let start = null;
      for (let x = 0; x <= canvas.width; x += 1) {
        const filled =
          x < canvas.width && pixels[(y * canvas.width + x) * 4 + 3] > 0;
        if (filled && start === null) start = x;
        if (!filled && start !== null) {
          totalPixels += x - start;
          runs.push({ y, start, end: x, totalPixels });
          start = null;
        }
      }
    }

    return totalPixels ? { runs, totalPixels } : null;
  }

  function parsePointPlacement(svgText, targetSize) {
    const svg = parseSvg(svgText);
    const point =
      svg.querySelector('[data-interaction-point]') ||
      svg.querySelector('circle') ||
      svg.querySelector('ellipse') ||
      svg.querySelector('rect');
    if (!point) return null;

    const scale = getSvgScale(svg, targetSize);
    if (point.tagName.toLowerCase() === 'rect') {
      const width = getSvgNumber(point.getAttribute('width'));
      const height = getSvgNumber(point.getAttribute('height'));
      return {
        x: (getSvgNumber(point.getAttribute('x')) + width / 2) * scale.x,
        y: (getSvgNumber(point.getAttribute('y')) + height / 2) * scale.y
      };
    }

    return {
      x:
        getSvgNumber(point.getAttribute('cx') || point.getAttribute('x')) *
        scale.x,
      y:
        getSvgNumber(point.getAttribute('cy') || point.getAttribute('y')) *
        scale.y
    };
  }

  window.OlingLabPlacementSvg = {
    getSvgNumber,
    getSvgViewBox,
    parseMaskPlacement,
    parsePointPlacement,
    parseRectCenterPlacements,
    parseRectPlacement
  };
})();
