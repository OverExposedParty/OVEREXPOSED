const container = document.getElementById("floating-container");
let isDragging = false;
let isTouchActive = false;
let startX, startY;
let offsetX = ((window.innerWidth - getComputedStyle(document.documentElement).getPropertyValue('--canvasWidth').trim().replace('px', '')) / 2);
let offsetY = ((window.innerHeight - getComputedStyle(document.documentElement).getPropertyValue('--canvasHeight').trim().replace('px', '')) / 2);
let targetX = offsetX;
let targetY = offsetY;
let baseScale = 1; // Base scale factor
let targetScale = baseScale;
let zoomSpeed = 0.05; // Speed of zooming

// Touchscreen pinch-to-zoom logic
let initialDistance = null;
let initialScale = baseScale;


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
let activeFingers = 0;
let touchStartX = 0;
let touchStartY = 0;
let isTouchDragging = false;

container.addEventListener('touchstart', (event) => {
    activeFingers = event.touches.length;
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

container.addEventListener('touchend', (event) => {
    activeFingers = event.touches.length;
    if (activeFingers === 0) {
        isTouchDragging = false;
    }
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

    // Adjust the targetScale based on scroll direction
    if (event.deltaY < 0) {
        targetScale += zoomSpeed;
    } else {
        targetScale = Math.max(minScale, targetScale - zoomSpeed);
    }

    // Smooth zoom animation
    gsap.to(container, {
        scale: targetScale,
        duration: 1.5, // Adjust for a smoother feel
        ease: "power2.out"
    });
});

container.addEventListener("touchstart", (event) => {
    enableTouchControls();
    event.preventDefault();
    if (event.touches.length === 2) {
        initialDistance = getDistance(event.touches[0], event.touches[1]);
        initialScale = targetScale;
    }

    if (event.touches.length === 1) { 
        // Single finger swipe
        isTouchDragging = true;
        touchStartX = event.touches[0].clientX - cameraPosition.x;
        touchStartY = event.touches[0].clientY - cameraPosition.y;
    } else if (event.touches.length > 1) {
        // Multiple fingers: calculate middle point
        isTouchDragging = true;
        const midPoint = getMiddlePoint(event.touches);
        touchStartX = midPoint.x - cameraPosition.x;
        touchStartY = midPoint.y - cameraPosition.y;
    }
});

container.addEventListener("touchmove", (event) => {
    event.preventDefault();
    if (event.touches.length === 2) {
        const currentDistance = getDistance(event.touches[0], event.touches[1]);
        const scaleFactor = currentDistance / initialDistance;

        targetScale = Math.max(minScale, initialScale * scaleFactor);

        // Apply smooth zoom animation
        gsap.to(container, {
            scale: targetScale,
            duration: 1.5,
            ease: "power2.out"
        });
    }


    if (isTouchDragging) {
        let midPoint;
        if (event.touches.length === 1) {
            midPoint = { x: event.touches[0].clientX, y: event.touches[0].clientY };
        } else {
            midPoint = getMiddlePoint(event.touches);
        }

        cameraPosition.x = midPoint.x - touchStartX;
        cameraPosition.y = midPoint.y - touchStartY;
    }
});

function getDistance(touch1, touch2) {
    const dx = touch2.clientX - touch1.clientX;
    const dy = touch2.clientY - touch1.clientY;
    return Math.sqrt(dx * dx + dy * dy);
}
function getMiddlePoint(touches) {
    let sumX = 0, sumY = 0;
    for (let i = 0; i < touches.length; i++) {
        sumX += touches[i].clientX;
        sumY += touches[i].clientY;
    }
    return {
        x: sumX / touches.length,
        y: sumY / touches.length
    };
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
