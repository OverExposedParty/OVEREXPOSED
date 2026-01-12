function CreateTempNoPlaceDiv(xPosition, yPosition) {
    const noPlaceDiv = document.createElement("div");
    noPlaceDiv.classList.add("no-place");
    floatingContainer.appendChild(noPlaceDiv);

    noPlaceDiv.style.left = `${parseFloat(xPosition) - cardWidthValue / 4}px`;
    noPlaceDiv.style.top = `${parseFloat(yPosition) - cardWidthValue / 4}px`;
    noPlaceDiv.classList.add('visible');

    setTimeout(() => {
        noPlaceDiv.classList.add('fade-out');
        setTimeout(() => {
            if (noPlaceDiv.parentNode) noPlaceDiv.remove();
        }, 300);
    }, 300);

}

function createFloatingButton(event = null, row, draft = false) {
    const idFromURL = getIDFromURL();
    const [title = "New Title", text = "Type here...", id = new Date().toISOString(), date = Date.now(), userIcon = "0000:0100:0200:0300", xPosition = "0", yPosition = "0", tag = "confessions"] = row;

    const button = document.createElement("button");
    button.classList.add("floating-button");

    const img = document.createElement("img");
    img.src = blankCard[tag]
    img.classList.add("floating-image");

    createUserIconPartyGames({
        container: button,
        userCustomisationString: userIcon,
        size: "dual-stack"
    });

    const span = document.createElement("span");
    span.classList.add("button-text");
    span.textContent = title;
    span.style.color = tagColours[tag].primary;

    button.setAttribute("data-id", id);
    button.setAttribute("data-date", date);
    button.setAttribute("data-title", title);
    button.setAttribute("data-text", text);
    button.setAttribute("data-tag", tag);
    button.setAttribute("data-usericon", userIcon);

    const noPlaceDiv = document.createElement("div");
    noPlaceDiv.classList.add("no-place");
    noPlaceDiv.appendChild(button);
    noPlaceDiv.setAttribute("data-id", id);
    floatingContainer.appendChild(noPlaceDiv);

    button.appendChild(img);
    button.appendChild(span);
    floatingContainer.appendChild(button);

    button.style.left = `${parseFloat(xPosition)}px`;
    button.style.top = `${parseFloat(yPosition)}px`;

    noPlaceDiv.style.left = `${parseFloat(xPosition) - cardWidthValue / 4}px`;
    noPlaceDiv.style.top = `${parseFloat(yPosition) - cardWidthValue / 4}px`;

    const cardTypeText = document.createElement("p");
    cardTypeText.classList.add("card-type-text");
    cardTypeText.textContent = tag.charAt(0).toUpperCase() + tag.slice(1);
    cardTypeText.style.color = tagColours[tag].primary;
    button.appendChild(cardTypeText);

    const speed = Math.random() * 5 + 2;
    button.animate(
        [
            { transform: `translate(0, 0) rotate(0deg)` },
            { transform: `translate(${Math.random() * 100 - 50}px, ${Math.random() * 100 - 50}px) rotate(${Math.random() * 5}deg)` },
        ],
        {
            duration: speed * 1000,
            iterations: Infinity,
            direction: "alternate",
            easing: "ease-in-out"
        }
    );
    if (getOverlappingDiv(noPlaceDiv, document.querySelectorAll(".no-place")) !== null) {
        CreateTempNoPlaceDiv(xPosition, yPosition);
        showFloatingText(event, "Card cannot be placed here");
        button.remove();
        noPlaceDiv.remove();
        return;
    }

    button.addEventListener("click", () => {
        if (isTouchActive) { return; }
        selectCard(button, false)
    });

    button.addEventListener("touchstart", () => {
        touchStartTime = Date.now();
        // Snapshot the camera at touch start
        singleTouchPosition.x = target.x;
        singleTouchPosition.y = target.y;
    });

    button.addEventListener("touchmove", () => {
        const touchRadius = calculateTouchDistance(target, singleTouchPosition);
        if (touchRadius > maxTouchRadius) {
            button.classList.remove('touchhover');
        }
    });

    button.addEventListener("touchend", (event) => {
        const touchEndTime = Date.now();
        const touchHeldDuration = touchEndTime - touchStartTime;
        button.classList.remove('touchhover');

        const touchRadius = calculateTouchDistance(target, singleTouchPosition);
        if (touchRadius < maxTouchRadius) {
            // Treat as a tap, not a camera pan
            selectCard(button, false);
        }
    });

    if (draft) {
        button.classList.add("draft");
        noPlaceDiv.classList.add("draft");
        selectCard(button, true)
    }
    if (id === idFromURL) {
        cleanOverexposureUrl();
        selectCard(button, false)
    }
}

function placeCard(event, positionX, positionY) {
    const floatingContainer = document.querySelector(".floating-container");
    const bool = localStorage.getItem('settings-nsfw');

    if (bool === 'false') {
        showFloatingText(event, "Enable NSFW in settings");
        return;
    }

    // Prefer a hit-test target passed in by touch code, otherwise fall back
    const targetElement = event && event._hitTarget ? event._hitTarget : event.target;

    if (
        (safeZone && safeZone.contains(targetElement)) ||
        (floatingContainer && !floatingContainer.contains(targetElement))
    ) {
        showFloatingText(event, "Card cannot be placed here");
        return;
    }

    contentsTextArea.value = "";
    titleTextInput.value = "";

    createFloatingButton(
        event,
        [
            "New Title",
            "Type here...",
            new Date().toISOString().replace(/[-:T.]/g, '').split('Z')[0],
            formatDate(Date.now()),
            getUserIconString(),
            positionX.toString(),
            positionY.toString(),
            "confessions"
        ],
        true
    );

    CardBoundsToggle(cardBoundsCheckbox.checked);
}

function selectCard(button, draft) {
    const rect = button.getBoundingClientRect();
    const centerX = rect.left + window.scrollX + rect.width / 2;
    const centerY = rect.top + window.scrollY + rect.height / 2;

    const bool = localStorage.getItem('settings-nsfw');

    if (button.querySelector('img').classList.contains("disabled")) {
        displayFloatingText("Enable NSFW in settings", centerX, centerY);
        return;
    }

    if (bool === 'false') {
        displayFloatingText("Enable NSFW in settings", centerX, centerY);
        return;
    }
    ToggleOverexposureContainer({
        toggle: true,
        button,
        draft
    });
}

function CardBoundsToggle(bool) {
    if (bool == true) {
        safeZone.classList.add('visible');
        document.querySelectorAll('.floating-button').forEach(button => {
            const buttonId = button.getAttribute("data-id");
            const noPlace = document.querySelector(`.no-place[data-id="${buttonId}"]`);
            noPlace.classList.add('visible');
        });
    }
    else {
        safeZone.classList.remove('visible');
        document.querySelectorAll('.floating-button').forEach(button => {
            const buttonId = button.getAttribute("data-id");
            const noPlace = document.querySelector(`.no-place[data-id="${buttonId}"]`);
            noPlace.classList.remove('visible');
        });
    }
}

cardBoundsCheckbox.addEventListener('change', function () {
    if (cardBoundsCheckbox.checked) {
        CardBoundsToggle(true);
    }
    else {
        CardBoundsToggle(false);
    }
});