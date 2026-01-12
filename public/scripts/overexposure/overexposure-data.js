let count = 0;

const blankCard = {
    confessions: "/images/overexposure/card-templates/confessions.svg",
    stories: "/images/overexposure/card-templates/stories.svg",
    thoughts: "/images/overexposure/card-templates/thoughts.svg",
    feelings: "/images/overexposure/card-templates/feelings.svg"
};

const tagColours = {
    confessions: {
        primary: getComputedStyle(document.documentElement).getPropertyValue('--confessions-primary-colour').trim(),
        secondary: getComputedStyle(document.documentElement).getPropertyValue('--confessions-secondary-colour').trim()
    },
    stories: {
        primary: getComputedStyle(document.documentElement).getPropertyValue('--stories-primary-colour').trim(),
        secondary: getComputedStyle(document.documentElement).getPropertyValue('--stories-secondary-colour').trim()
    },
    thoughts: {
        primary: getComputedStyle(document.documentElement).getPropertyValue('--thoughts-primary-colour').trim(),
        secondary: getComputedStyle(document.documentElement).getPropertyValue('--thoughts-secondary-colour').trim()
    },
    feelings: {
        primary: getComputedStyle(document.documentElement).getPropertyValue('--feelings-primary-colour').trim(),
        secondary: getComputedStyle(document.documentElement).getPropertyValue('--feelings-secondary-colour').trim()
    }
};

let currentPageColours = {
    primary: '#FF6961',
    secondary: '#B74C57'
};

const canvasWidth = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--canvasWidth').trim(), 10);
const canvasHeight = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--canvasHeight').trim(), 10);

const cardWidth = getComputedStyle(document.documentElement).getPropertyValue('--cardWidth');
const cardWidthValue = parseFloat(cardWidth);

const safeZone = document.querySelector(".safe-zone");
const titleText = document.querySelector(".title-text");
const titleTextContainer = document.querySelector(".title-text-container");
const contentsContainerText = document.querySelector('.contents-container-text');
const titleTextEditor = document.querySelector(".title-text-editor");
const contentsTextEditor = document.getElementById("contents-text-editor");
const floatingContainer = document.getElementById("floating-container");
const overexposureContainer = document.getElementById("overexposure-container");
const uploadingText = document.getElementById("uploading-text");
const contentsTextArea = document.querySelector("#contents-text-editor textarea");
const titleTextInput = document.getElementById("title-text-editor-input");

const exitMenuYes = document.getElementById("exit-menu-button-yes");
const exitMenuNo = document.getElementById("exit-menu-button-no");
const submitPostYes = document.getElementById("submit-post-yes");
const submitPostNo = document.getElementById("submit-post-no");
const publishButton = document.querySelector(".overexposure-publish-button");

const exitMenuContainer = document.getElementById("exit-menu-container");
const uploadingPostContainer = document.getElementById("uploading-post-container");
const areYouSurePostContainer = document.getElementById("are-you-sure-container");
const postIncompleteContainer = document.getElementById("post-incomplete-container");

const enableNSFWContainer = document.getElementById("enable-nsfw-container");

const deletePostButton = document.getElementById("delete-post-button");
const flagPostButton = document.getElementById("flag-post-button");

const deletePostContainer = document.getElementById("delete-post-container");
const deleteCodeInput = deletePostContainer.querySelector('input');
const deletePostSubmit = deletePostContainer.querySelector('.warning-button-container button');

const rememberCodeContainer = document.getElementById("remember-code-container");
const rememberCodeContinue = rememberCodeContainer.querySelector('.warning-button-container button');
const rememberCodeText = rememberCodeContainer.querySelector('input');

let intervalId;

publishButton.classList.add("disabled");

const textInput = document.getElementById("text-input");
const charCounter = document.getElementById("char-counter");
const maxLength = parseInt(textInput.getAttribute("maxlength"), 10);

const storageObserver = new LocalStorageObserver();

const { protocol, hostname } = window.location;
let socket;
if (hostname === 'overexposed.app') {
    socket = io(`${protocol}//${hostname}`);
} else {
    socket = io(`${protocol}//${hostname}:3000`);
}

socket.on('connect', () => {
    console.log('Socket connected successfully');
});

socket.on('connect_error', (err) => {
    console.error('Socket connection error:', err);
});

storageObserver.addListener((key, oldValue, newValue) => {
    if (key === 'settings-nsfw') {
        //console.log(`The value of '${key}' changed from '${oldValue}' to '${newValue}'`);
        if (oldValue !== newValue) {
            eighteenPlusEnabled = newValue;
            SetNSFW();
            //console.log(`Value changed! Now NSFW is set to: ${newValue}`);
        }
    }
});

let nameList = new Set();

async function loadNames() {
    try {
        const response = await fetch("/json-files/names.json");
        const data = await response.json();
        nameList = new Set(data.map(name => name.toLowerCase()));
    } catch (error) {
        console.error("Error loading names:", error);
    }
}

function detectName(text) {
    let doc = nlp(text);
    let detectedNames = doc.people().out('array');
    detectedNames = detectedNames.filter(name => /^[A-Za-z]+$/.test(name));

    return detectedNames.length > 0 ? { hasName: true, name: detectedNames } : { hasName: false, name: null };
}
contentsTextArea.addEventListener("input", function () {
    const cursorPosition = this.selectionStart;
    this.setSelectionRange(cursorPosition, cursorPosition);
});

loadNames();

function calculateTouchDistance(cameraPosition, singleTouchPosition) {
    const dx = singleTouchPosition.x - cameraPosition.x;
    const dy = singleTouchPosition.y - cameraPosition.y;

    return Math.sqrt(dx * dx + dy * dy);
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

async function fetchConfessions() {
    try {
        const response = await fetch('/api/confessions');
        const data = await response.json();

        console.log("📥 Confessions from MongoDB:", data);

        const idFromURL = getIDFromURL();
        let idFound = false;

        data.forEach(confession => {
            if (confession.id === idFromURL) {
                idFound = true;
            }
            createFloatingButton(null, [
                confession.title,
                confession.text,
                confession.id,
                confession.date,
                confession.userIcon,
                confession.x,
                confession.y,
                confession.tag
            ], false);
        });
        CardBoundsToggle(cardBoundsCheckbox.checked);
        if (!idFound) {
            console.log(`ID ${idFromURL} not found`);
            cleanOverexposureUrl();
        }

        SetNSFW();
        SetScriptLoaded('/scripts/overexposure/overexposure-data.js');
    } catch (error) {
        console.error("❌ Error fetching confessions:", error);
    }
}

async function updateConfessions() {
    try {
        // Fetch the latest confessions from the API
        const response = await fetch('/api/confessions');
        const data = await response.json();

        console.log("📥 Confessions from MongoDB:", data);

        // Build a Set of all confession IDs currently in the database
        const confessionIds = new Set(data.map(confession => confession.id));

        // Get all existing floating buttons
        const floatingButtons = document.querySelectorAll('.floating-button');

        // 1️⃣ Remove any non-draft floating buttons that no longer exist in the DB
        floatingButtons.forEach(button => {
            const id = button.getAttribute('data-id');
            const isDraft = button.classList.contains('draft');

            // Skip drafts – they won't be in the DB yet
            if (isDraft) return;

            if (!confessionIds.has(id)) {
                console.log(`🗑 Removing floating button not in DB: ${id}`);

                // Remove paired .no-place div
                const noPlace = document.querySelector(`.no-place[data-id="${id}"]`);
                if (noPlace) noPlace.remove();

                // If this card was currently selected, close/reset the editor
                const selectedId = overexposureContainer.getAttribute('data-selected-card');
                if (selectedId === id) {
                    overexposureContainer.removeAttribute('data-selected-card');
                    ToggleOverexposureContainer({ toggle: false, force: true });
                }

                // Remove the button itself
                button.remove();
            }
        });

        // 2️⃣ Add any new confessions that *don’t* have a button yet
        data.forEach(confession => {
            const existingButton = document.querySelector(`.floating-button[data-id="${confession.id}"]`);

            if (!existingButton) {
                console.log(`➕ Creating new floating button for confession: ${confession.id}`);
                createFloatingButton(null, [
                    confession.title,
                    confession.text,
                    confession.id,
                    confession.date,
                    confession.userIcon,
                    confession.x,
                    confession.y,
                    confession.tag
                ], false);
            }
        });

    } catch (error) {
        console.error("❌ Error fetching confessions:", error);
    }
}

socket.on("confessions-updated", async (change) => {
    updateConfessions();
});

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
        singleTouchPosition.x = cameraPosition.x;
        singleTouchPosition.y = cameraPosition.y;
    });
    button.addEventListener("touchmove", () => {
        const touchRadius = calculateTouchDistance(cameraPosition, singleTouchPosition);
        if (touchRadius > maxTouchRadius) {
            button.classList.remove('touchhover');
        }
    });

    button.addEventListener("touchend", (event) => {
        const touchEndTime = Date.now();
        const touchHeldDuration = touchEndTime - touchStartTime;
        button.classList.remove('touchhover');
        const touch = event.touches[0] || event.changedTouches[0];
        const touchRadius = calculateTouchDistance(cameraPosition, singleTouchPosition);
        if (touchRadius < maxTouchRadius) {
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

    if (safeZone && safeZone.contains(event.target) || (floatingContainer && !floatingContainer.contains(event.target))) {
        showFloatingText(event, "Card cannot be placed here");
        return;
    }

    contentsTextArea.value = "";
    titleTextInput.value = "";
    createFloatingButton(event, ["New Title", "Type here...", new Date().toISOString().replace(/[-:T.]/g, '').split('Z')[0], formatDate(Date.now()), getUserIconString(), positionX.toString(), positionY.toString(), "confessions"], true);
    CardBoundsToggle(cardBoundsCheckbox.checked);
}

function setOverexposureContainerToEditor(isActive) {
    if (isActive) {
        contentsContainerText.classList.remove('active');
        titleTextContainer.classList.remove('active');
        titleTextEditor.classList.add('active');
        contentsTextEditor.classList.add('active');
    } else {
        contentsContainerText.classList.add('active');
        titleTextContainer.classList.add('active');
        titleTextEditor.classList.remove('active');
        contentsTextEditor.classList.remove('active');
    }
}

function isOverexposureEditorActive() {
    return titleTextEditor.classList.contains('active') && contentsTextEditor.classList.contains('active');
}

function isOverexposureEditorEmpty() {
    if (titleTextInput.value.trim() === "" && contentsTextArea.value.trim() === "") {
        return true;
    }
    return false;
}

function SetOverexposureClassArray() {
    if (isOverexposureEditorEmpty()) {
        addElementIfNotExists(elementClassArray, overexposureContainer);
        removeElementIfExists(permanantElementClassArray, overexposureContainer);
    }
    else {
        addElementIfNotExists(permanantElementClassArray, overexposureContainer);
        removeElementIfExists(elementClassArray, overexposureContainer);
    }
}

publishButton.addEventListener("click", async () => {
    if (detectName(contentsTextArea.value).hasName || detectName(titleTextInput.value).hasName) {
        playSoundEffect('postIncomplete');
        postIncompleteContainer.classList.add('active');
        addElementIfNotExists(popUpClassArray, postIncompleteContainer);
        playSoundEffect('containerClose');
    }
    else {
        areYouSurePostContainer.classList.add('active');
        addElementIfNotExists(popUpClassArray, areYouSurePostContainer);
    }
});
submitPostYes.addEventListener("click", async () => {
    areYouSurePostContainer.classList.remove('active');
    removeElementIfExists(popUpClassArray, areYouSurePostContainer)
    const draftButtons = document.querySelectorAll(".floating-button.draft");
    if (draftButtons.length > 0) {
        uploadingPostContainer.classList.add("active");
        addElementIfNotExists(popUpClassArray, uploadingPostContainer);
        intervalId = setInterval(updateEllipses, 400);
        const draftData = [];
        draftButtons.forEach(button => {
            const title = button.getAttribute("data-title");
            const text = button.getAttribute("data-text");
            const id = button.getAttribute("data-id");
            const date = button.getAttribute("data-date");
            const xPosition = parseInt(button.style.left, 10);
            const yPosition = parseInt(button.style.top, 10);
            const tag = button.getAttribute("data-tag");
            const userIcon = button.getAttribute("data-usericon");

            draftData.push([title, text, id, date, userIcon, xPosition, yPosition, tag]);
        });
        try {
            const response = await saveDataToMongoDB(draftData);
            removeElementIfExists(popUpClassArray, uploadingPostContainer);
            rememberCodeContainer.classList.add('active');
            overexposureContainer.removeAttribute('data-selected-card');
            addElementIfNotExists(permanantElementClassArray, rememberCodeContainer);
            ToggleOverexposureContainer({
                toggle: false,
                force: true
            });
            draftButtons.forEach(button => {
                const noPlaceDiv = document.querySelector(`.no-place[data-id="${button.getAttribute("data-id")}"]`);
                if (noPlaceDiv) noPlaceDiv.remove();
                button.remove();
            });
            console.log("Draft data saved successfully:", response);
            playSoundEffect('postUploaded');
        } catch (error) {
            console.error("Error saving draft data:", error);
            playSoundEffect('postIncomplete');
        }
        uploadingPostContainer.classList.remove("active");
        addElementIfNotExists(popUpClassArray, uploadingPostContainer);
    }
});

submitPostNo.addEventListener("click", async () => {
    areYouSurePostContainer.classList.remove('active');
    removeElementIfExists(popUpClassArray, areYouSurePostContainer)
});

async function saveDataToMongoDB(draftData) {
    try {
        const [title, text, id, date, userIcon, x, y, tag] = draftData[0];

        const confession = { title, text, id, date, userIcon, x, y, tag };

        console.log("📤 Saving confession", confession);
        const response = await fetch('/api/confessions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(confession)
        });
        const result = await response.json();
        console.log("✅ Response from MongoDB:", result);
        if (!response.ok) {
            throw new Error(result.error || 'Failed to save confession');
        }

        const { confession: savedConfession, deleteCode } = result;

        // 👉 THIS is the code you show to the user
        console.log("🧾 Delete code for this confession:", deleteCode);

        // Simple version: just alert it
        //alert(`Your delete code for this post is: ${deleteCode}\n\nSave this code if you want to delete it later.`);
        rememberCodeText.value = deleteCode;

        // Optional: store it locally so the same browser remembers it
        if (savedConfession && savedConfession._id && deleteCode) {
            localStorage.setItem(`overexposure-delete-code-${savedConfession.id}`, deleteCode);
        }
        return result;
    } catch (error) {
        playSoundEffect('postIncomplete');
        console.error("❌ Error sending confession to MongoDB:", error);
        throw error;
    }
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

exitMenuYes.addEventListener("click", ExitMenuButtonYes);
exitMenuNo.addEventListener("click", ExitMenuButtonNo);

function ExitMenuButtonYes() {
    titleTextInput.value = "";
    contentsTextArea.value = "";
    exitMenuContainer.classList.remove('active');
    removeElementIfExists(popUpClassArray, exitMenuContainer)
    removeElementIfExists(permanantElementClassArray, overexposureContainer);
    publishButton.classList.add("disabled");
    ToggleOverexposureContainer({ toggle: false });
}

function ExitMenuButtonNo() {
    exitMenuContainer.classList.remove('active');
    removeElementIfExists(popUpClassArray, exitMenuContainer)
}

overexposureContainer.addEventListener("mousedown", function () {
    if (exitMenuContainer.classList.contains("active")) {
        exitMenuContainer.classList.remove("active");
        areYouSurePostContainer.classList.remove('active');

        removeElementIfExists(popUpClassArray, exitMenuContainer)
        removeElementIfExists(popUpClassArray, areYouSurePostContainer)
    }
    if (areYouSurePostContainer.classList.contains("active")) {
        areYouSurePostContainer.classList.remove('active');
        removeElementIfExists(popUpClassArray, areYouSurePostContainer)
    }
    if (postIncompleteContainer.classList.contains("active")) {
        postIncompleteContainer.classList.remove('active');
        removeElementIfExists(popUpClassArray, postIncompleteContainer)
    }
    if (deletePostContainer.classList.contains("active")) {
        deletePostContainer.classList.remove('active');
        removeElementIfExists(popUpClassArray, deletePostContainer)
    }
});

function togglePublishButton() {
    if (titleTextInput.value.trim() !== "" && contentsTextArea.value.trim() !== "") {
        publishButton.classList.remove("disabled");
    } else {
        publishButton.classList.add("disabled");
    }
}
document.addEventListener("DOMContentLoaded", async function () {
    waitForFunction("fetchConfessions", async () => {
        await fetchConfessions();
    })

    titleTextInput.addEventListener("input", togglePublishButton);
    contentsTextArea.addEventListener("input", togglePublishButton);

    titleTextInput.addEventListener("input", SetOverexposureClassArray);
    contentsTextArea.addEventListener("input", SetOverexposureClassArray);

    if (localStorage.getItem('first-time-overexposure') === null) {
        localStorage.setItem('first-time-overexposure', 'no');
        waitForFunction("toggleUserCustomisation", () => {
            toggleUserCustomisation(true);
        })

    }
});

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

textInput.addEventListener("input", () => {
    const remaining = maxLength - textInput.value.length;
    charCounter.textContent = remaining;

    if (remaining < 100) {
        // charCounter.style.display = "block";
        charCounter.style.color = "var(--primarypagecolour)";
    } else {
        //charCounter.style.display = "none";
        charCounter.style.color = "gray";
    }
});

titleTextInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
        event.preventDefault();
        contentsTextArea.focus();
    }
});

function SetNSFW() {
    const bool = localStorage.getItem('settings-nsfw');
    const buttons = document.querySelectorAll('.floating-button');

    const sizes = ['16x16', '32x32', '96x96', '180x180'];
    const faviconLinks = document.querySelectorAll('link[rel="icon"]');

    if (bool === 'true') {
        enableNSFWContainer.classList.remove('active');
        removeElementIfExists(permanantElementClassArray, enableNSFWContainer);
        document.documentElement.style.setProperty('--primarypagecolour', currentPageColours.primary);
        document.documentElement.style.setProperty('--secondarypagecolour', currentPageColours.secondary);
        buttons.forEach(button => {
            button.querySelector('img').src = blankCard[button.getAttribute("data-tag")] || blankCard["confessions"];
            button.classList.remove("disabled")
        });

        faviconLinks.forEach((favicon, i) => {
            const size = sizes[i % sizes.length];
            favicon.href = `/images/icons/overexposure/favicons/favicon-${size}.png`;

            document.documentElement.style.setProperty('--rotatedeviceicon', `url(/images/icons/overexposure/rotate-phone-icon.svg)`);
            document.documentElement.style.setProperty('--tiktokicon', `url(/images/icons/overexposure/tik-tok-icon.svg)`);
            document.documentElement.style.setProperty('--instagramicon', `url(/images/icons/overexposure/instagram-icon.svg)`);
        });
    }
    else {
        enableNSFWContainer.classList.add('active');
        addElementIfNotExists(permanantElementClassArray, enableNSFWContainer);
        document.documentElement.style.setProperty('--primarypagecolour', '#999999');
        document.documentElement.style.setProperty('--secondarypagecolour', '#666666');
        buttons.forEach(button => {
            button.querySelector('img').src = "/images/overexposure/card-template-blank.svg";
            button.classList.add("disabled")
        });

        faviconLinks.forEach((favicon, i) => {
            const size = sizes[i % sizes.length];
            favicon.href = `/images/icons/grey/favicons/favicon-${size}.png`;

            document.documentElement.style.setProperty('--rotatedeviceicon', `url(/images/icons/grey/rotate-phone-icon.svg)`);
            document.documentElement.style.setProperty('--tiktokicon', `url(/images/icons/grey/tik-tok-icon.svg)`);
            document.documentElement.style.setProperty('--instagramicon', `url(/images/icons/grey/instagram-icon.svg)`);
        });
    }
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

waitForFunction("loadSound", () => {
    async function LoadOverexposureSounds() {
        const overexposureSounds = {
            cardCannotBePlacedHere: '/sounds/overexposure/card-cannot-be-place-here.wav',
            postIncomplete: '/sounds/overexposure/post-incomplete.wav',
            postUploaded: '/sounds/overexposure/post-uploaded.wav',
        };

        for (const [key, url] of Object.entries(overexposureSounds)) {
            await loadSound(key, url);
        }
    }

    (async () => {
        await LoadOverexposureSounds();
    })();
});

function SetOverexpossureTags() {
    document.querySelectorAll('.tag-item').forEach(tagItem => {
        const primaryColour = tagItem.getAttribute('data-primary');
        const secondaryColour = tagItem.getAttribute('data-secondary');

        if (!tagItem.classList.contains('selected')) {
            updateTagStyles({
                tagElement: tagItem,
                state: 'not-selected',
                primaryColour: primaryColour,
                secondaryColour: secondaryColour
            });
        }
        else {
            updateTagStyles({
                tagElement: tagItem,
                state: 'selected',
                primaryColour: primaryColour,
                secondaryColour: secondaryColour
            });
        }

        tagItem.addEventListener('mouseover', () => {
            updateTagStyles({
                tagElement: tagItem,
                state: 'hovered',
                primaryColour: primaryColour,
                secondaryColour: secondaryColour
            });
        });

        tagItem.addEventListener('mouseout', () => {
            if (tagItem.classList.contains('selected')) {
                updateTagStyles({
                    tagElement: tagItem,
                    state: 'selected',
                    primaryColour: primaryColour,
                    secondaryColour: secondaryColour
                });
            }
            else {
                updateTagStyles({
                    tagElement: tagItem,
                    state: 'not-selected',
                    primaryColour: primaryColour,
                    secondaryColour: secondaryColour
                });
            }
        });

        tagItem.addEventListener('click', () => {
            ToggleSelectedTag(tagItem);
        });
    });
}

contentsTextEditor.querySelector('textarea').addEventListener('blur', () => {
    const selectedCard = document.querySelector(`.floating-button[data-id="${overexposureContainer.getAttribute('data-selected-card')}"]`);
    if (!selectedCard) return;
    selectedCard.setAttribute('data-text', contentsTextEditor.querySelector('textarea').value.trim());
});

titleTextEditor.querySelector('input').addEventListener('blur', () => {
    const selectedCard = document.querySelector(`.floating-button[data-id="${overexposureContainer.getAttribute('data-selected-card')}"]`);
    if (!selectedCard) return;
    selectedCard.setAttribute('data-title', titleTextEditor.querySelector('input').value.trim());
    selectedCard.querySelector(".button-text").textContent = titleTextEditor.querySelector('input').value.trim();
});

function ToggleOverexposureContainer({ toggle = false, button = null, draft = false, force = false } = {}) {
    if (force == true) {
        titleTextInput.value = "";
        contentsTextArea.value = "";
        publishButton.classList.add("disabled");
        removeElementIfExists(permanantElementClassArray, overexposureContainer);
        ToggleOverexposureContainer({ toggle: false });
        return;
    }
    if (toggle == true && permanantElementClassArray.includes(overexposureContainer) == false) {
        overexposureContainer.classList.add('active');
    }
    else if (toggle == false && permanantElementClassArray.includes(overexposureContainer) == false) {
        overexposureContainer.classList.remove('active');
        if (permanantElementClassArray.length == 0) {
            overlay.classList.remove('active');
        }
        playSoundEffect('containerClose');
    }
    if (overexposureContainer.classList.contains('active') && toggle == true) {
        if (!button) return;
        const dataId = button.getAttribute("data-id");
        history.pushState(null, "", window.location.pathname.replace(/\/$/, '') + "/" + dataId);

        titleText.textContent = button.getAttribute("data-title");
        contentsContainerText.innerHTML = button.getAttribute("data-text");

        if (draft) {
            setOverexposureContainerToEditor(true);
        }
        else {
            setOverexposureContainerToEditor(false);
        }

        addElementIfNotExists(elementClassArray, overexposureContainer);
        toggleOverlay(true);
        playSoundEffect('containerOpen');
        overexposureContainer.setAttribute('data-selected-card', dataId);
        if (button) ToggleSelectedTag(document.querySelector(`.tag-item#${button.getAttribute("data-tag")}`));
        button.classList.add('touchhover');
    }
    else {
        if (!isOverexposureEditorEmpty() && toggle == false) {
            exitMenuContainer.classList.add('active');
            addElementIfNotExists(popUpClassArray, exitMenuContainer);
        }
        if (!permanantElementClassArray.includes(overexposureContainer)) {
            cleanOverexposureUrl();
            ToggleSelectedTag();
        }
    }
}

function ChangePageColour(primary = defaultColours.primary, secondary = defaultColours.secondary) {
    document.documentElement.style.setProperty('--primarypagecolour', primary);
    document.documentElement.style.setProperty('--secondarypagecolour', secondary);
    currentPageColours.primary = primary;
    currentPageColours.secondary = secondary;
}

SetOverexpossureTags();

function ToggleSelectedTag(tagItem = document.querySelector(`.tag-item#confessions`)) {
    if (!tagItem) return;
    const tagItemText = tagItem.querySelector('.tag-text');
    const tagItemButton = tagItem.querySelector('button');

    const primaryColour = tagItem.getAttribute('data-primary');
    const secondaryColour = tagItem.getAttribute('data-secondary');
    tagItem.classList.add('selected');
    const selectedCard = document.querySelector(`.floating-button[data-id="${overexposureContainer.getAttribute('data-selected-card')}"]`);

    if (selectedCard && selectedCard.classList.contains('draft') == true) {
        selectedCard.setAttribute('data-tag', tagItem.id);
        selectedCard.querySelector('.card-type-text').textContent = tagItemText.textContent;
        selectedCard.querySelector('.card-type-text').style.color = primaryColour;
        selectedCard.querySelector('.button-text').style.color = primaryColour;
        selectedCard.querySelector('img').src = blankCard[tagItem.id] || blankCard["confessions"];
    }

    ChangePageColour(primaryColour, secondaryColour);

    document.querySelectorAll('.tag-item.selected').forEach(otherTag => {
        if (otherTag !== tagItem) {
            otherTag.classList.remove('selected');
            const otherButton = otherTag.querySelector('button');
            const otherPrimary = otherTag.getAttribute('data-primary');

            updateTagStyles({
                tagElement: otherTag,
                state: 'not-selected',
                primaryColour: otherPrimary,
                secondaryColour: secondaryColour
            });
        }
    });

    if (tagItem.classList.contains('selected')) {
        updateTagStyles({
            tagElement: tagItem,
            state: 'selected',
            primaryColour: primaryColour,
            secondaryColour: secondaryColour
        });
    }
}
function updateTagStyles({
    tagElement = null,
    state = 'not-selected',   // 'selected', 'not-selected', 'hovered'
    primaryColour = null,
    secondaryColour = null
}) {
    if (!tagElement) return;

    const tagText = tagElement.querySelector('.tag-text');
    const tagButton = tagElement.querySelector('button');

    switch (state) {
        case 'selected':
            tagText.style.color = primaryColour;
            tagButton.style.backgroundColor = primaryColour;
            tagButton.style.border = `4px solid ${primaryColour}`;
            break;

        case 'hovered':
            tagText.style.color = secondaryColour;
            tagButton.style.backgroundColor = secondaryColour;
            tagButton.style.border = `4px solid ${secondaryColour}`;
            break;

        case 'not-selected':
        default:
            tagText.style.color = primaryColour;
            tagButton.style.backgroundColor = 'var(--backgroundcolour)';
            tagButton.style.border = `4px solid ${primaryColour}`;
            break;
    }
}

deletePostButton.addEventListener("click", () => {
    const selectedCardId = overexposureContainer.getAttribute('data-selected-card');
    if (!selectedCardId) return;
    deletePostContainer.classList.add('active');
    addElementIfNotExists(popUpClassArray, deletePostContainer);
    if (localStorage.getItem(`overexposure-delete-code-${selectedCardId}`)) {
        deleteCodeInput.value = localStorage.getItem(`overexposure-delete-code-${selectedCardId}`);
    }
    else {
        deleteCodeInput.value = "";
    }
});

async function deleteConfession(confessionId, deleteCode) {
    const res = await fetch(`/api/confessions/${confessionId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deleteCode }),
    });

    const data = await res.json();
    console.log(data);
}

deletePostSubmit.addEventListener("click", async () => {
    const confessionId = overexposureContainer.getAttribute('data-selected-card');
    if (!confessionId) return;

    const deleteCode = (deleteCodeInput.value || "").trim();

    if (!deleteCode) {
        alert("Please enter your delete code.");
        return;
    }

    try {
        const res = await fetch(`/api/confessions/${confessionId}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ deleteCode }),
        });

        const data = await res.json();
        console.log("🗑 Delete response:", data);

        if (!res.ok) {
            alert(data.error || "Failed to delete post. Check your delete code.");
            return;
        }

        // Remove card from UI
        const button = document.querySelector(`.floating-button[data-id="${confessionId}"]`);
        const noPlace = document.querySelector(`.no-place[data-id="${confessionId}"]`);
        if (button) button.remove();
        if (noPlace) noPlace.remove();

        deletePostContainer.classList.remove('active');
        removeElementIfExists(popUpClassArray, deletePostContainer);
        deleteCodeInput.value = "";
        overexposureContainer.removeAttribute('data-selected-card');
        ToggleOverexposureContainer({
            toggle: false,
            force: true
        });
    } catch (err) {
        console.error("❌ Error deleting confession:", err);
        alert("Server error deleting post.");
    }
});

deleteCodeInput.addEventListener("input", () => {
    let val = deleteCodeInput.value;

    if (val.length === 4 && val[3] !== "-") {
        val = val.substring(0, 3) + "-" + val.substring(3);
    }

    deleteCodeInput.value = val;
});


rememberCodeContinue.addEventListener("click", () => {
    rememberCodeContainer.classList.remove('active');
    removeElementIfExists(popUpClassArray, uploadingPostContainer);
    removeElementIfExists(permanantElementClassArray, rememberCodeContainer);
    toggleOverlay(false);
});

flagPostButton.addEventListener("click", () => {
    const confessionId = overexposureContainer.getAttribute('data-selected-card');
    if (!confessionId) return;

    toggleFlagPost({
        toggle: true,
        confessionId
    });
});

function toggleFlagPost({ toggle = false, confessionId = null }) {
    if (toggle) {
        flagPostButton.textContent = flagPostButton.textContent === "[FLAG]" ? "[UNFLAG]" : "[FLAG]";
    }
    console.log("Toggle flag post:", toggle, confessionId);
}