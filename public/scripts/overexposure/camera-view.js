const container = document.getElementById("floating-container");
let isDragging = false;
let isTouchActive = false;
let startX, startY;
let offsetX = ((window.innerWidth - getComputedStyle(document.documentElement).getPropertyValue('--canvasWidth').trim().replace('px', '')) / 2);
let offsetY = ((window.innerHeight - getComputedStyle(document.documentElement).getPropertyValue('--canvasHeight').trim().replace('px', '')) / 2);
let targetX = offsetX;
let targetY = offsetY;
let baseScale = 1; // Base scale factor
let zoomSpeed = 0.05; // Speed of zooming

// Store the position of the container in an object
const cameraPosition = {
    x: targetX,
    y: targetY
};

// Get original container size
const containerRect = container.getBoundingClientRect();

// Determine minScale based on the shortest dimension
const shortestViewportDim = Math.min(window.innerWidth, window.innerHeight);
const containerShortestDim = Math.min(containerRect.width, containerRect.height);
const minScale = shortestViewportDim / containerShortestDim; // Ensure it fits within the shortest viewport dimension

// Center the container at start
gsap.set(container, { x: offsetX, y: offsetY, scale: baseScale });

// Function to enable mouse or touch controls exclusively
function enableMouseControls() {
    isTouchActive = false;
}

function enableTouchControls() {
    isTouchActive = true;
}

// Middle Mouse Button Drag Logic
document.addEventListener("mousedown", (event) => {
    if (isTouchActive) return; // Ignore if touch is active

    if (event.button === 1) { // Middle Mouse Button
        enableMouseControls();
        isDragging = true;
        startX = event.clientX - cameraPosition.x;
        startY = event.clientY - cameraPosition.y;
        event.preventDefault(); // Prevent default middle-click behavior
    }
});

document.addEventListener("mousemove", (event) => {
    if (isDragging) {
        cameraPosition.x = event.clientX - startX;
        cameraPosition.y = event.clientY - startY;
    }
});

document.addEventListener("mouseup", () => { isDragging = false; });

// Touchscreen swipe logic
let touchStartX = 0;
let touchStartY = 0;
let isTouchDragging = false;

container.addEventListener('touchstart', (event) => {
    if (event.touches.length === 1) { // One finger swipe
        enableTouchControls();
        isTouchDragging = true;
        touchStartX = event.touches[0].clientX - cameraPosition.x;
        touchStartY = event.touches[0].clientY - cameraPosition.y;
    }
});

container.addEventListener('touchmove', (event) => {
    if (isTouchDragging) {
        cameraPosition.x = event.touches[0].clientX - touchStartX;
        cameraPosition.y = event.touches[0].clientY - touchStartY;
    }
});

container.addEventListener('touchend', () => {
    isTouchDragging = false;
});

// Smooth Animation with GSAP
function smoothMove() {
    gsap.to(container, { x: cameraPosition.x, y: cameraPosition.y, duration: 1, ease: "power2.out" });
    requestAnimationFrame(smoothMove);
}
smoothMove(); // Start smooth movement loop

// Prevent Middle Click Default Scroll
document.addEventListener("contextmenu", (event) => event.preventDefault());

// Function to get the browser zoom level
function getBrowserZoom() {
    return window.devicePixelRatio;
}

// Zooming logic with mouse wheel
document.addEventListener('wheel', (event) => {
    if (isTouchActive) return; // Ignore if touch is active

    event.preventDefault(); // Prevent page scrolling while zooming

    // Get the browser zoom level
    let browserZoom = getBrowserZoom();

    // Adjust the baseScale based on user input
    if (event.deltaY < 0) {
        baseScale += zoomSpeed;
    } else {
        baseScale = Math.max(minScale, baseScale - zoomSpeed);
    }

    // Combine browser zoom and custom scale
    let finalScale = baseScale * browserZoom;

    // Apply the zoom while keeping it centered
    gsap.to(container, {
        scale: finalScale,
        x: cameraPosition.x - (window.innerWidth / 2 - cameraPosition.x) * (finalScale - baseScale),
        y: cameraPosition.y - (window.innerHeight / 2 - cameraPosition.y) * (finalScale - baseScale),
        duration: 1.5,
        ease: "power2.out"
    });
});

// Touchscreen pinch-to-zoom logic
let initialDistance = null;
let initialScale = baseScale;

container.addEventListener('touchstart', (event) => {
    if (event.touches.length === 2) { // Two fingers for pinch
        initialDistance = getDistance(event.touches[0], event.touches[1]);
        initialScale = baseScale;
    }
    event.preventDefault();
});

container.addEventListener('touchmove', (event) => {
    if (event.touches.length === 2) { // Two fingers for pinch
        const currentDistance = getDistance(event.touches[0], event.touches[1]);
        const scaleFactor = currentDistance / initialDistance; // Calculate scale change

        baseScale = Math.max(minScale, initialScale * scaleFactor); // Apply the zoom while respecting the minimum scale
        updateZoom();
    }
    event.preventDefault();
});

function getDistance(touch1, touch2) {
    const dx = touch2.clientX - touch1.clientX;
    const dy = touch2.clientY - touch1.clientY;
    return Math.sqrt(dx * dx + dy * dy);
}

function updateZoom() {
    // Combine browser zoom and custom scale
    let browserZoom = getBrowserZoom();
    let finalScale = baseScale * browserZoom;

    // Apply the zoom while keeping it centered
    gsap.to(container, {
        scale: finalScale,
        x: cameraPosition.x - (window.innerWidth / 2 - cameraPosition.x) * (finalScale - baseScale),
        y: cameraPosition.y - (window.innerHeight / 2 - cameraPosition.y) * (finalScale - baseScale),
        duration: 1.5,
        ease: "power2.out"
    });
}
