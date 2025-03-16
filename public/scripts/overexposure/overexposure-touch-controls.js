let lastTap = 0;
const maxTouchRadius = 50;
let singleTouchPosition = {x: 0,y: 0};
let count = 0;
let intervalId = null;
let touchStartTime = null;
let touchDuration = 500;
let initiateHoldTimer
let touchTimer;
let creatingCard;

function handleTouchStart(event) {
    if (event.touches.length === 1) {
        initiateHoldTimer = setTimeout(() => {
            const touch = event.touches[0] || event.changedTouches[0];
            const rect = floatingContainer.getBoundingClientRect();
            const computedStyle = getComputedStyle(floatingContainer);
            const scale = parseFloat(computedStyle.transform.split(', ')[3]) || 1;

            const touchX = (touch.clientX - rect.left) / scale;
            const touchY = (touch.clientY - rect.top) / scale;

            singleTouchPosition.x = cameraPosition.x;
            singleTouchPosition.y = cameraPosition.y;
            if (!isClickInsideContainer(event, document.querySelectorAll('.floating-button'))) {
                creatingCard = document.createElement('div');
                creatingCard.classList.add('create-card');
                setTimeout(() => {
                    creatingCard.classList.add('grow');
                }, 10);

                // Convert positions to pixel values
                creatingCard.style.left = `${touchX}px`;
                creatingCard.style.top = `${touchY}px`;

                floatingContainer.appendChild(creatingCard);
            }
        }, 250);

        touchTimer = setTimeout(() => {
            if (creatingCard) {
                handleTouchHold(event);
            }
        }, 1250);
    }
    else {
        if (touchTimer) {
            clearTimeout(initiateHoldTimer);
            clearTimeout(touchTimer);
        }
    }
    wrapper.addEventListener('touchmove', monitorTouchDistance);
}

function handleTouchEnd() {
    clearTimeout(initiateHoldTimer);
    clearTimeout(touchTimer);
    if (creatingCard) {
        creatingCard.remove();
        creatingCard = null;
    }
}

function handleTouchHold(event) {
    event.preventDefault();
    const touchRadius = calculateTouchDistance(cameraPosition, singleTouchPosition);
    wrapper.removeEventListener('touchmove', monitorTouchDistance);
    // Add a safety check if the touch radius is too small
    if (touchRadius > maxTouchRadius || (safeZone && safeZone.contains(event.target)) || (isClickInsideContainer(event, document.querySelectorAll('.no-place')) || isClickInsideContainer(event, document.querySelectorAll('.floating-button')))) {
        console.log("radius exceeded");
        showFloatingText(event);
        if (creatingCard) {
            creatingCard.remove();
            creatingCard = null;
        }
        return;
    }
    //console.log("maxTouchRadius: " + maxTouchRadius)
    //console.log("touchRadius: " + touchRadius);

    const touch = event.touches[0] || event.changedTouches[0];
    const rect = floatingContainer.getBoundingClientRect();
    const computedStyle = getComputedStyle(floatingContainer);
    const scale = parseFloat(computedStyle.transform.split(', ')[3]) || 1;

    const touchX = (touch.clientX - rect.left) / scale;
    const touchY = (touch.clientY - rect.top) / scale;

    placeCard(event, touchX, touchY);
}

function detectTouchScreen() {
    const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

    const computerControls = document.getElementById("computer-controls");
    const mobileControls = document.getElementById("mobile-controls");

    if (isTouch) {
        mobileControls.classList.add("active");
        computerControls.classList.remove("active");
        isTouchActive = true;
    } else {
        computerControls.classList.add("active");
        mobileControls.classList.remove("active");
        isTouchActive = false;
    }
}

wrapper.addEventListener("touchend", function (event) {
    let currentTime = new Date().getTime();
    let tapLength = currentTime - lastTap;
    if (tapLength < 300 && tapLength > 0) { // 300ms threshold for double tap
        handleDoubleClick(event);
    }
    lastTap = currentTime;
});

function monitorTouchDistance(event) {
    const touch = event.touches[0] || event.changedTouches[0];
    const touchRadius = calculateTouchDistance(cameraPosition, singleTouchPosition);

    // If touchRadius exceeds maxTouchRadius, remove the creatingCard immediately
    if (touchRadius > maxTouchRadius) {
        if (creatingCard) {
            creatingCard.remove();
            creatingCard = null;
        }
        clearTimeout(initiateHoldTimer);
        clearTimeout(touchTimer);
        wrapper.removeEventListener('touchmove', monitorTouchDistance);
    }
}

wrapper.addEventListener("touchstart", handleTouchStart);
wrapper.addEventListener("touchend", handleTouchEnd);

// Run the function on page load
window.addEventListener("load", detectTouchScreen);
window.addEventListener("touchstart", detectTouchScreen);
window.addEventListener("click", detectTouchScreen);
window.addEventListener('mousedown', detectTouchScreen);
