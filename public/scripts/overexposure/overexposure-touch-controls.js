// Use the same viewport as your camera
const wrapper = viewport;

let lastTap = 0;
let initiateHoldTimer = null;
let touchTimer = null;
let creatingCard = null;
const maxTouchRadius = 20;
const singleTouchPosition = { x: 0, y: 0 };

function handleTouchStart(event) {
    if (event.touches.length === 1) {
        // Snapshot camera position at touch start
        singleTouchPosition.x = target.x;
        singleTouchPosition.y = target.y;

        // Show growing "create card" circle after a short delay
        initiateHoldTimer = setTimeout(() => {
            const touch = event.touches[0] || event.changedTouches[0];

            // Screen → world using your camera helper
            const worldPos = screenToWorld(touch.clientX, touch.clientY);
            const touchX = worldPos.x;
            const touchY = worldPos.y;

            if (!isClickInsideContainer(event, document.querySelectorAll('.floating-button'))) {
                creatingCard = document.createElement('div');
                creatingCard.classList.add('create-card');

                requestAnimationFrame(() => {
                    creatingCard.classList.add('grow');
                });

                creatingCard.style.left = `${touchX}px`;
                creatingCard.style.top = `${touchY}px`;

                floatingContainer.appendChild(creatingCard);
            }
        }, 250);

        // If they keep holding long enough, actually place the card
        touchTimer = setTimeout(() => {
            if (creatingCard) {
                handleTouchHold(event);
            }
        }, 1250);
    } else {
        clearTimeout(initiateHoldTimer);
        clearTimeout(touchTimer);
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

    wrapper.removeEventListener('touchmove', monitorTouchDistance);
}

function handleTouchHold(event) {
    event.preventDefault();

    const touchRadius = calculateTouchDistance(target, singleTouchPosition);
    wrapper.removeEventListener('touchmove', monitorTouchDistance);

    if (
        touchRadius > maxTouchRadius ||
        (safeZone && safeZone.contains(event.target)) ||
        isClickInsideContainer(event, document.querySelectorAll('.no-place')) ||
        isClickInsideContainer(event, document.querySelectorAll('.floating-button'))
    ) {
        console.log("radius exceeded / invalid area");
        showFloatingText(event, "Card cannot be placed here");
        if (creatingCard) {
            creatingCard.remove();
            creatingCard = null;
        }
        return;
    }

    const touch = event.touches[0] || event.changedTouches[0];

    // Hit-test the element under the finger so placeCard can do its checks properly
    const hitTarget = document.elementFromPoint(touch.clientX, touch.clientY);

    const worldPos = screenToWorld(touch.clientX, touch.clientY);
    const touchX = worldPos.x;
    const touchY = worldPos.y;

    const placeEvent = {
        _hitTarget: hitTarget,
        touches: event.touches,
        changedTouches: event.changedTouches,
        clientX: touch.clientX,
        clientY: touch.clientY
    };

    placeCard(placeEvent, touchX, touchY);

    if (creatingCard) {
        creatingCard.remove();
        creatingCard = null;
    }
}

function monitorTouchDistance() {
    const touchRadius = calculateTouchDistance(target, singleTouchPosition);

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

// Double-tap + wire-up

wrapper.addEventListener("touchstart", handleTouchStart);

wrapper.addEventListener("touchend", function (event) {
    handleTouchEnd();

    const currentTime = Date.now();
    const tapLength = currentTime - lastTap;

    if (tapLength < 300 && tapLength > 0) {
        handleDoubleClick(event);
    }

    lastTap = currentTime;
});

// Touch vs mouse control UI

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

window.addEventListener("load", detectTouchScreen);
window.addEventListener("touchstart", detectTouchScreen);
window.addEventListener("click", detectTouchScreen);
window.addEventListener("mousedown", detectTouchScreen);