const container = document.getElementById("floating-container");
const viewport = document.getElementById("viewport");

viewport.style.touchAction = "none";
container.style.transformOrigin = "0 0";
container.style.willChange = "transform";

const canvasW = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--canvasWidth")) || container.offsetWidth;
const canvasH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--canvasHeight")) || container.offsetHeight;

let offsetX = (window.innerWidth - canvasW) / 2;
let offsetY = (window.innerHeight - canvasH) / 2;

const rect0 = container.getBoundingClientRect();
const shortestViewportDim = Math.min(window.innerWidth, window.innerHeight);
const containerShortestDim = Math.min(rect0.width || canvasW, rect0.height || canvasH);
const minScale = shortestViewportDim / containerShortestDim;
const maxScale = 6;

const cam = { x: offsetX, y: offsetY, scale: 1 };
const target = { x: offsetX, y: offsetY, scale: 1 };

let panSmooth = 0.18;
let zoomSmooth = 0.18;

function clampScale(s) {
  return Math.max(minScale, Math.min(maxScale, s));
}

function applyMatrix() {
  container.style.transform = `matrix(${cam.scale},0,0,${cam.scale},${cam.x},${cam.y})`;
}

function tick() {
  cam.x += (target.x - cam.x) * panSmooth;
  cam.y += (target.y - cam.y) * panSmooth;
  cam.scale += (target.scale - cam.scale) * zoomSmooth;
  applyMatrix();
  requestAnimationFrame(tick);
}
tick();

function screenToWorld(px, py, useTarget = false) {
  const s = useTarget ? target.scale : cam.scale;
  const x = useTarget ? target.x : cam.x;
  const y = useTarget ? target.y : cam.y;
  return { x: (px - x) / s, y: (py - y) / s };
}

function zoomAt(px, py, newScale) {
  newScale = clampScale(newScale);

  const before = screenToWorld(px, py, true);

  target.scale = newScale;

  const after = screenToWorld(px, py, true);

  target.x += (after.x - before.x) * target.scale;
  target.y += (after.y - before.y) * target.scale;
}

function panBy(dx, dy) {
  target.x += dx;
  target.y += dy;
}

let isDragging = false;
let isTouchActive = false;
let lastX = 0, lastY = 0;

document.addEventListener("mousedown", (e) => {
  if (isTouchActive) return;
  if (e.button !== 1) return;
  isDragging = true;
  lastX = e.clientX;
  lastY = e.clientY;
  e.preventDefault();
});

document.addEventListener("mousemove", (e) => {
  if (!isDragging) return;
  panBy(e.clientX - lastX, e.clientY - lastY);
  lastX = e.clientX;
  lastY = e.clientY;
});

document.addEventListener("mouseup", () => { isDragging = false; });
document.addEventListener("contextmenu", (e) => e.preventDefault());

document.addEventListener("wheel", (e) => {
  if (isTouchActive) return;
  e.preventDefault();
  const zoomIntensity = 0.0015;
  const factor = Math.exp(-e.deltaY * zoomIntensity);
  zoomAt(e.clientX, e.clientY, target.scale * factor);
}, { passive: false });

let lastTouch = null;
let pinchStartDist = null;
let pinchStartScale = null;

function dist(t1, t2) {
  return Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
}
function mid(t1, t2) {
  return { x: (t1.clientX + t2.clientX) / 2, y: (t1.clientY + t2.clientY) / 2 };
}

viewport.addEventListener("touchstart", (e) => {
  isTouchActive = true;
  e.preventDefault();

  if (e.touches.length === 1) {
    lastTouch = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  } else if (e.touches.length === 2) {
    pinchStartDist = dist(e.touches[0], e.touches[1]);
    pinchStartScale = target.scale;
    lastTouch = null;
  }
}, { passive: false });

viewport.addEventListener("touchmove", (e) => {
  e.preventDefault();

  if (e.touches.length === 1 && lastTouch) {
    const x = e.touches[0].clientX;
    const y = e.touches[0].clientY;
    panBy(x - lastTouch.x, y - lastTouch.y);
    lastTouch = { x, y };
  } else if (e.touches.length === 2 && pinchStartDist && pinchStartScale) {
    const d = dist(e.touches[0], e.touches[1]);
    const m = mid(e.touches[0], e.touches[1]);
    const newScale = pinchStartScale * (d / pinchStartDist);
    zoomAt(m.x, m.y, newScale);
  }
}, { passive: false });

viewport.addEventListener("touchend", (e) => {
  if (e.touches.length === 0) {
    lastTouch = null;
    pinchStartDist = null;
    pinchStartScale = null;
    isTouchActive = false;
  } else if (e.touches.length === 1) {
    lastTouch = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    pinchStartDist = null;
    pinchStartScale = null;
  }
}, { passive: false });
