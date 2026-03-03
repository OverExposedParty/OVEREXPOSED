function calculateTouchDistance(camPosition, singleTouchPosition) {
    const dx = camPosition.x - singleTouchPosition.x;
    const dy = camPosition.y - singleTouchPosition.y;
    return Math.hypot(dx, dy);
}


function formatDate(timestamp) {
    const date = new Date(timestamp);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
}

function updateEllipses() {
    count = (count + 1) % 4;
    uploadingText.textContent = "Uploading Post" + ".".repeat(count);
}

function isIntervalActive() {
    return intervalId !== null;
}

function getOverlappingDiv(currentDiv, currentDivType) {
    const rect1 = currentDiv.getBoundingClientRect();

    for (let div of currentDivType) {
        if (div !== currentDiv) {
            const rect2 = div.getBoundingClientRect();

            if (
                rect1.right > rect2.left &&
                rect1.left < rect2.right &&
                rect1.bottom > rect2.top &&
                rect1.top < rect2.bottom
            ) {
                return div;
            }
        }
    }
    return null;
}

function isClickInsideContainer(event, containerTargets) {
    if (containerTargets.length === 0) {
        return false;
    }

    return Array.from(containerTargets).some(containerTarget =>
        containerTarget.contains(event.target)
    );
}

function displayFloatingText(message, x, y) {
    console.log("x: " + x + "y " + y);
    const floatingText = document.createElement("div");
    floatingText.textContent = message;
    floatingText.style.position = "absolute";
    floatingText.style.left = `${x}px`;
    floatingText.style.top = `${y}px`;
    floatingText.style.transform = "translate(-50%, -50%)";
    floatingText.style.background = "transparent";
    floatingText.style.color = "var(--warningcolour)";
    floatingText.style.padding = "5px 10px";
    floatingText.style.borderRadius = "5px";
    floatingText.style.fontSize = "14px";
    floatingText.style.pointerEvents = "none";
    floatingText.style.transition = "opacity 1s ease-out, transform 1s ease-out";
    floatingText.style.fontFamily = "LemonMilk";
    floatingText.style.zIndex = "900";

    document.body.appendChild(floatingText);

    setTimeout(() => {
        floatingText.style.opacity = "0";
        floatingText.style.transform = "translate(-50%, -80px)";
    }, 50);

    setTimeout(() => {
        floatingText.remove();
    }, 700);
}

function showFloatingText(event, message) {
    playSoundEffect('cardCannotBePlacedHere');
    if (isTouchActive) {
        const touch = event.touches[0] || event.changedTouches[0];
        displayFloatingText(message, touch.clientX, touch.clientY);
    } else {
        displayFloatingText(message, event.clientX, event.clientY);
    }

    //if (creatingCard) {
    // creatingCard.remove();
    // creatingCard = null;
    //} // add back when touch controls implemented
}

function getIDFromURL() {
    const pathSegments = window.location.pathname.split("/");
    return pathSegments[pathSegments.length - 1];
}

function cleanOverexposureUrl() {
    const currentUrl = window.location.pathname;
    const basePath = "/overexposure";
    const overexposureIndex = currentUrl.indexOf(basePath);

    if (overexposureIndex !== -1) {
        const newUrl = currentUrl.slice(0, overexposureIndex + basePath.length) + "/";
        history.pushState(null, "", newUrl);
    }

    document.querySelectorAll(".floating-button.draft").forEach(button => button.remove());
    document.querySelectorAll(".no-place.draft").forEach(noPlaceDraft => noPlaceDraft.remove());
}

function ChangePageColour(primary = defaultColours.primary, secondary = defaultColours.secondary) {
    document.documentElement.style.setProperty('--primarypagecolour', primary);
    document.documentElement.style.setProperty('--secondarypagecolour', secondary);
    currentPageColours.primary = primary;
    currentPageColours.secondary = secondary;
}

const CARD_TEMPLATE_PATH = "/images/overexposure/card-template.svg";
let cardTemplateSvgPromise = null;

function getCardTemplateSvgText() {
    if (!cardTemplateSvgPromise) {
        cardTemplateSvgPromise = fetch(CARD_TEMPLATE_PATH)
            .then((response) => {
                if (!response.ok) {
                    throw new Error(`Failed to load ${CARD_TEMPLATE_PATH}: ${response.status}`);
                }
                return response.text();
            })
            .catch((error) => {
                cardTemplateSvgPromise = null;
                throw error;
            });
    }
    return cardTemplateSvgPromise;
}

function normalizeCardTemplateSvg(svgEl) {
    if (!svgEl) return null;

    // Remove embedded style defs and map legacy classes to semantic ones.
    svgEl.querySelectorAll("defs").forEach((defs) => defs.remove());

    svgEl.querySelectorAll(".cls-1").forEach((el) => {
        el.classList.remove("cls-1");
        el.classList.add("card-accent-fill");
        el.removeAttribute("fill");
    });

    svgEl.querySelectorAll(".cls-2").forEach((el) => {
        el.classList.remove("cls-2");
        el.classList.add("card-base-fill");
        el.removeAttribute("fill");
    });

    svgEl.querySelectorAll(".cls-3").forEach((el) => {
        el.classList.remove("cls-3");
        el.classList.add("card-accent-stroke");
        el.removeAttribute("stroke");
    });

    return svgEl;
}

async function applyFloatingCardTemplate(button, { tag = "confessions", disabled = false } = {}) {
    if (!button) return;
    button.classList.toggle("disabled", disabled);

    const tintColour = disabled ? "#666666" : (tagColours[tag]?.primary || tagColours.confessions.primary);
    try {
        const svgText = await getCardTemplateSvgText();
        const parser = new DOMParser();
        const doc = parser.parseFromString(svgText, "image/svg+xml");
        const svgEl = normalizeCardTemplateSvg(doc.querySelector("svg"));

        if (!svgEl) {
            throw new Error("Card template SVG element not found");
        }

        svgEl.classList.add("floating-image", "floating-card-template");
        svgEl.setAttribute("aria-hidden", "true");
        svgEl.style.setProperty("--card-tag-colour", tintColour);

        const existingVisual = button.querySelector(".floating-image");
        if (existingVisual) {
            existingVisual.replaceWith(svgEl);
        } else {
            button.prepend(svgEl);
        }
    } catch (error) {
        console.error("Failed to apply floating card template:", error);
    }
}
