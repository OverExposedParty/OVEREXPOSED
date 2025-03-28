const csvUrl = "https://docs.google.com/spreadsheets/d/e/2PACX-1vR0xDhIbJUMjnu2ZpxIVJwN9tgNjK_Sm9TJfNzH6wBfDKJXPZtV5B0D0GStZZdIUQhYyEdbet94Xbdm/pub?output=csv";
const googleScriptSaveCardURL = "https://script.google.com/macros/s/AKfycbzdAGne-Sv4rhWuShx7HJ4ImHVRZ74ftMMGTwXJuq6C8PXR5qaNfuRu9y-LnnnYYeixlQ/exec";

const canvasWidth = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--canvasWidth').trim(), 10);
const canvasHeight = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--canvasHeight').trim(), 10);

const cardWidth = getComputedStyle(document.documentElement).getPropertyValue('--cardWidth');
const cardWidthValue = parseFloat(cardWidth);

const safeZone = document.querySelector(".safe-zone");
const titleText = document.querySelector(".title-text");
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

publishButton.disabled = true;

const textInput = document.getElementById("text-input");
const charCounter = document.getElementById("char-counter");
const maxLength = parseInt(textInput.getAttribute("maxlength"), 10);

const soundCardCannotBePlacedHere = new Audio('/sounds/overexposure/card-cannot-be-place-here.wav');
soundCardCannotBePlacedHere.preload = 'auto';

const soundPostIncomplete = new Audio('/sounds/overexposure/post-incomplete.wav');
soundPostIncomplete.preload = 'auto';

const soundPostUploaded = new Audio('/sounds/overexposure/post-uploaded.wav');
soundPostUploaded.preload = 'auto';

const storageObserver = new LocalStorageObserver();

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

function showFloatingText(event,message) {
    playSoundEffect(soundCardCannotBePlacedHere);
    if (isTouchActive) {
        const touch = event.touches[0] || event.changedTouches[0];
        displayFloatingText(message, touch.clientX, touch.clientY);
    } else {
        displayFloatingText(message, event.clientX, event.clientY);
    }

    if (creatingCard) {
        creatingCard.remove();
        creatingCard = null;
    }
}

function getIDFromURL() {
    const pathSegments = window.location.pathname.split("/");
    return pathSegments[pathSegments.length - 1];
}

async function fetchCSV() {
    const response = await fetch(csvUrl);
    const data = await response.text();

    Papa.parse(data, {
        complete: function (results) {
            console.log("Parsed CSV Data:", results.data);
            const idFromURL = getIDFromURL();
            let idFound = false;
            results.data.slice(1).forEach(row => {
                if (row.includes(idFromURL)) {
                    idFound = true;
                }
                createFloatingButton(null, row, false);
            });

            if (!idFound) {
                console.log(`ID ${idFromURL} not found`);
                cleanOverexposureUrl()
            }
        },
        header: false,
        skipEmptyLines: true
    });
    SetNSFW();
}

function createFloatingButton(event = null, row, draft = false) {
    const idFromURL = getIDFromURL();
    const [title = "New Title", text = "Type here...", id = new Date().toISOString(), date = Date.now(), xPosition = "0", yPosition = "0"] = row;

    const button = document.createElement("button");
    button.classList.add("floating-button");

    const img = document.createElement("img");
    img.src = "/images/overexposure/card-template.svg";
    img.classList.add("floating-image");

    const span = document.createElement("span");
    span.classList.add("button-text");
    span.textContent = title;

    button.setAttribute("data-id", id);
    button.setAttribute("data-date", date);
    button.setAttribute("data-title", title);
    button.setAttribute("data-text", text);

    const noPlaceDiv = document.createElement("div");
    noPlaceDiv.classList.add("no-place");
    noPlaceDiv.appendChild(button);
    floatingContainer.appendChild(noPlaceDiv);

    button.appendChild(img);
    button.appendChild(span);
    floatingContainer.appendChild(button);

    button.style.left = `${parseFloat(xPosition)}px`;
    button.style.top = `${parseFloat(yPosition)}px`;

    noPlaceDiv.style.left = `${parseFloat(xPosition) - cardWidthValue / 4}px`;
    noPlaceDiv.style.top = `${parseFloat(yPosition) - cardWidthValue / 4}px`;

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
        showFloatingText(event,"Card cannot be placed here");
        button.remove();
        noPlaceDiv.remove();
        return;
    }

    button.addEventListener("click", () => {
        if(isTouchActive) {return;}
        selectCard(button, false)
    });

    button.addEventListener("touchstart", () => {
        touchStartTime = Date.now();
        singleTouchPosition.x = cameraPosition.x;
        singleTouchPosition.y = cameraPosition.y;
        setTimeout(() => {
            button.classList.add('touchhover');
        }, touchDuration);
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
        if (touchRadius < maxTouchRadius && touchHeldDuration >= touchDuration) {
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
        showFloatingText(event,"Enable NSFW in settings");
        return;
    }

    if (safeZone && safeZone.contains(event.target) || (floatingContainer && !floatingContainer.contains(event.target))) {
        showFloatingText(event,"Card cannot be placed here");
        return;
    }

    contentsTextArea.value = "";
    titleTextInput.value = "";

    createFloatingButton(event, ["New Title", "Type here...", new Date().toISOString().replace(/[-:T.]/g, '').split('Z')[0], formatDate(Date.now()), positionX.toString(), positionY.toString()], true);
}

function setOverexposureContainerToEditor(isActive) {
    if (isActive) {
        contentsContainerText.classList.remove('active');
        titleText.classList.remove('active');
        titleTextEditor.classList.add('active');
        contentsTextEditor.classList.add('active');
    } else {
        contentsContainerText.classList.add('active');
        titleText.classList.add('active');
        titleTextEditor.classList.remove('active');
        contentsTextEditor.classList.remove('active');
    }
}

fetchCSV();
publishButton.addEventListener("click", async () => {
    if (detectName(contentsTextArea.value).hasName || detectName(titleTextInput.value).hasName) {
        playSoundEffect(soundPostIncomplete);
        postIncompleteContainer.classList.add('active');
        addElementIfNotExists(popUpClassArray, postIncompleteContainer); 
        playSoundEffect(soundContainerClose);
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
            button.setAttribute("data-title", titleTextInput.value.trim());
            button.setAttribute("data-text", contentsTextArea.value.trim());

            const title = button.getAttribute("data-title");
            const text = button.getAttribute("data-text");
            const id = button.getAttribute("data-id");
            const date = button.getAttribute("data-date");
            const xPosition = parseInt(button.style.left, 10);
            const yPosition = parseInt(button.style.top, 10);

            button.querySelector(".button-text").textContent = title;

            draftData.push([title, text, id, date, xPosition, yPosition]);
        });

        try {
            const response = await saveDataToGoogleSheets(draftData);
            overlay.classList.remove('active');
            overexposureContainer.classList.remove('active');
            console.log("Draft data saved successfully:", response);
            playSoundEffect(soundPostUploaded);
            draftButtons.forEach(button => {
                button.classList.remove("draft");
            });
            cleanOverexposureUrl();
        } catch (error) {
            console.error("Error saving draft data:", error);
            playSoundEffect(soundPostIncomplete);
        }
        uploadingPostContainer.classList.remove("active");
        addElementIfNotExists(popUpClassArray, uploadingPostContainer); 
    }
});
submitPostNo.addEventListener("click", async () => {
    areYouSurePostContainer.classList.remove('active');
    removeElementIfExists(popUpClassArray, areYouSurePostContainer)
});

async function saveDataToGoogleSheets(draftData) {
    try {
        console.log("Sending data to Google Sheets:", draftData);
        const formData = new URLSearchParams();
        draftData.forEach((item, index) => {
            formData.append(`title_${index}`, item[0]);
            formData.append(`text_${index}`, item[1]);
            formData.append(`id_${index}`, item[2]);
            formData.append(`date_${index}`, item[3]);
            formData.append(`x_${index}`, item[4]);
            formData.append(`y_${index}`, item[5]);
        });

        const response = await fetch(googleScriptSaveCardURL, {
            method: 'POST',
            body: formData,
        });

        const responseText = await response.text();
        console.log("Response from Google Sheets:", responseText);
    } catch (error) {
        playSoundEffect(soundPostIncomplete);
        console.error("Error sending draft data:", error);
    }
}


const observer = new MutationObserver((mutationsList) => {
    for (const mutation of mutationsList) {
        if (mutation.type === "attributes" && mutation.attributeName === "class") {
            if (!overlay.classList.contains("active")) {
                cleanOverexposureUrl();
            }
            if (!overexposureContainer.classList.contains("active")) {
                const draftButtons = document.querySelectorAll(".floating-button.draft");
                if (contentsTextArea.value.trim() !== "" || titleTextInput.value.trim() !== "") {
                    if (draftButtons.length > 0) {
                        overlay.classList.add('active');
                        overexposureContainer.classList.add('active');
                        addElementIfNotExists(elementClassArray, overexposureContainer);
                        if (elementExists(popUpClassArray,postIncompleteContainer)) {
                            postIncompleteContainer.classList.remove('active');
                        }
                        else if (!(areYouSurePostContainer.classList.contains('active'))) {
                            exitMenuContainer.classList.add('active');
                            addElementIfNotExists(popUpClassArray, exitMenuContainer); 
                        }
                        else {
                            areYouSurePostContainer.classList.remove('active');
                            removeElementIfExists(popUpClassArray, areYouSurePostContainer)
                        }

                    }
                }
                else {
                    document.querySelectorAll(".floating-button.draft").forEach(button => button.remove());
                    document.querySelectorAll(".no-place.draft").forEach(noPlaceDraft => noPlaceDraft.remove());
                    history.pushState(null, "", window.location.pathname);
                    charCounter.textContent = maxLength;
                }
            }
            if (!uploadingPostContainer.classList.contains("active") && isIntervalActive()) {
                clearInterval(intervalId);
                intervalId = null;
                uploadingText.textContent = "Uploading Post"
            }
        }
    }
});

observer.observe(overexposureContainer, { attributes: true, attributeFilter: ["class"] });
observer.observe(exitMenuContainer, { attributes: true, attributeFilter: ["class"] });
observer.observe(uploadingPostContainer, { attributes: true, attributeFilter: ["class"] });
observer.observe(postIncompleteContainer, { attributes: true, attributeFilter: ["class"] });

function selectCard(button, draft) {
    const rect = button.getBoundingClientRect();
    const centerX = rect.left + window.scrollX + rect.width / 2;
    const centerY = rect.top + window.scrollY + rect.height / 2;

    const bool = localStorage.getItem('settings-nsfw');

    if(button.querySelector('img').classList.contains("disabled")){
        displayFloatingText("Enable NSFW in settings", centerX, centerY);
        return;
    }

    if (bool === 'false') {
        displayFloatingText("Enable NSFW in settings", centerX, centerY);
        return;
    }
    overexposureContainer.classList.add("active");
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

    overlay.classList.add("active");
    addElementIfNotExists(elementClassArray, overexposureContainer);
    playSoundEffect(soundContainerOpen);
}

exitMenuYes.addEventListener("click", ExitMenuButtonYes);
exitMenuNo.addEventListener("click", ExitMenuButtonNo);

function ExitMenuButtonYes() {
    titleTextInput.value = "";
    contentsTextArea.value = "";
    exitMenuContainer.classList.remove('active');
    removeElementIfExists(popUpClassArray, exitMenuContainer)
    publishButton.disabled = true;
    toggleOverlay(false);
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
});


function togglePublishButton() {
    if (titleTextInput.value.trim() !== "" && contentsTextArea.value.trim() !== "") {
        publishButton.disabled = false;
    } else {
        publishButton.disabled = true;
    }
}
document.addEventListener("DOMContentLoaded", function () {
    titleTextInput.addEventListener("input", togglePublishButton);
    contentsTextArea.addEventListener("input", togglePublishButton);
});

function cleanOverexposureUrl() {
    const currentUrl = window.location.pathname;
    const basePath = "/overexposure";
    const overexposureIndex = currentUrl.indexOf(basePath);

    if (overexposureIndex !== -1) {
        const newUrl = currentUrl.slice(0, overexposureIndex + basePath.length) + "/";
        history.pushState(null, "", newUrl);
    }
}

function cleanOverexposureUrl() {
    const currentUrl = window.location.pathname;
    const basePath = "/overexposure";

    const overexposureIndex = currentUrl.indexOf(basePath);

    if (overexposureIndex !== -1) {
        const newUrl = currentUrl.slice(0, overexposureIndex + basePath.length) + "/";
        history.pushState(null, "", newUrl);
    }
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
    const buttons = document.querySelectorAll('.floating-button img');

    const sizes = ['16x16', '32x32', '96x96', '180x180'];
    const faviconLinks = document.querySelectorAll('link[rel="icon"]');

    if (bool === 'true') {
        enableNSFWContainer.classList.remove('active');
        removeElementIfExists(permanantElementClassArray, enableNSFWContainer);
        document.documentElement.style.setProperty('--primarypagecolour', '#FF6961');
        buttons.forEach(button => {
            button.src = "/images/overexposure/card-template.svg";
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
    else{
        enableNSFWContainer.classList.add('active');
        addElementIfNotExists(permanantElementClassArray, enableNSFWContainer);
        document.documentElement.style.setProperty('--primarypagecolour', '#999999');
        buttons.forEach(button => {
            button.src = "/images/overexposure/card-template-blank.svg";
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