(function (globalScope) {
  function getAnchor(element, config = {}) {
    const rect = element.getBoundingClientRect();
    const x = config.x ?? 0.5;
    const y = config.y ?? 0;
    return {
      x: rect.left + rect.width * x + (config.offsetX ?? 0),
      y: rect.top + rect.height * y + (config.offsetY ?? 0)
    };
  }

  function getCurveGeometry(from, to, lift) {
    const controlLeft = {
      x: from.x + (to.x - from.x) * 0.32,
      y: Math.min(from.y, to.y) - lift
    };
    const controlRight = {
      x: from.x + (to.x - from.x) * 0.68,
      y: Math.min(from.y, to.y) - lift
    };
    const midpoint = {
      x:
        from.x * 0.125 +
        controlLeft.x * 0.375 +
        controlRight.x * 0.375 +
        to.x * 0.125,
      y:
        from.y * 0.125 +
        controlLeft.y * 0.375 +
        controlRight.y * 0.375 +
        to.y * 0.125
    };
    return {
      d: `M ${from.x} ${from.y} C ${controlLeft.x} ${controlLeft.y}, ${controlRight.x} ${controlRight.y}, ${to.x} ${to.y}`,
      endControl: controlRight,
      midpoint
    };
  }

  function getArrowHeadPath(tip, endControl, length, width) {
    const deltaX = tip.x - endControl.x;
    const deltaY = tip.y - endControl.y;
    const magnitude = Math.hypot(deltaX, deltaY) || 1;
    const tangent = { x: deltaX / magnitude, y: deltaY / magnitude };
    const normal = { x: -tangent.y, y: tangent.x };
    const base = {
      x: tip.x - tangent.x * length,
      y: tip.y - tangent.y * length
    };
    const halfWidth = width / 2;
    const left = {
      x: base.x + normal.x * halfWidth,
      y: base.y + normal.y * halfWidth
    };
    const right = {
      x: base.x - normal.x * halfWidth,
      y: base.y - normal.y * halfWidth
    };
    return `M ${left.x} ${left.y} L ${tip.x} ${tip.y} L ${right.x} ${right.y}`;
  }

  globalScope.OlingClashTutorialDiagram = Object.freeze({
    getAnchor,
    getArrowHeadPath,
    getCurveGeometry
  });
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = globalScope.OlingClashTutorialDiagram;
  }
})(typeof window !== 'undefined' ? window : globalThis);
