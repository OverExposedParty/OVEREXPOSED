const csvUrl = "https://docs.google.com/spreadsheets/d/e/2PACX-1vR0xDhIbJUMjnu2ZpxIVJwN9tgNjK_Sm9TJfNzH6wBfDKJXPZtV5B0D0GStZZdIUQhYyEdbet94Xbdm/pub?output=csv";
const googleScriptSaveCardURL = "https://script.google.com/macros/s/AKfycbzdAGne-Sv4rhWuShx7HJ4ImHVRZ74ftMMGTwXJuq6C8PXR5qaNfuRu9y-LnnnYYeixlQ/exec";

const canvasWidth = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--canvasWidth').trim(), 10);
const canvasHeight = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--canvasHeight').trim(), 10);

const cardWidth = getComputedStyle(document.documentElement).getPropertyValue('--cardWidth');
const cardWidthValue = parseFloat(cardWidth);

const safeZone = document.querySelector(".safe-zone");
const titleText = document.querySelector(".title-text");
const contentsContainerText = document.querySelector('.contents-container p');
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

let currentWarningContainer;

publishButton.disabled = true;

let closeOverexposureContainer = false;

let nameList = new Set();

async function loadNames() {
    try {
        const response = await fetch("/json-files/names.json"); // Ensure this file is in the same directory
        const data = await response.json();
        nameList = new Set(data.map(name => name.toLowerCase())); // Convert to lowercase for case-insensitive matching
    } catch (error) {
        console.error("Error loading names:", error);
    }
}

function detectName(text) {
    let doc = nlp(text);
    let detectedNames = doc.people().out('array');
    detectedNames = detectedNames.filter(name => /^[A-Za-z]+$/.test(name)); // Only letters allowed

    return detectedNames.length > 0 ? { hasName: true, name: detectedNames } : { hasName: false, name: null };
}
contentsTextArea.addEventListener("input", function () {
    console.log("typing");
    const cursorPosition = this.selectionStart; // Save cursor position
    console.log(detectName(this.value));
    this.setSelectionRange(cursorPosition, cursorPosition); // Restore cursor position
});

loadNames();

function calculateTouchDistance(cameraPosition, singleTouchPosition) {
    // Calculate the distance between camera and touch in 2D space
    const dx = singleTouchPosition.x - cameraPosition.x;
    const dy = singleTouchPosition.y - cameraPosition.y;

    return Math.sqrt(dx * dx + dy * dy); // Return Euclidean distance in 2D
}



function formatDate(timestamp) {
    const date = new Date(timestamp);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
}

function updateEllipses() {
    count = (count + 1) % 4; // Cycles between 0, 1, 2, 3
    uploadingText.textContent = "Uploading Post" + ".".repeat(count);
}

function isIntervalActive() {
    return intervalId !== null;
}

function getOverlappingDiv(currentDiv, currentDivType) {
    const rect1 = currentDiv.getBoundingClientRect();

    for (let div of currentDivType) {
        if (div !== currentDiv) { // Ensure it's not checking itself
            const rect2 = div.getBoundingClientRect();

            if (
                rect1.right > rect2.left &&
                rect1.left < rect2.right &&
                rect1.bottom > rect2.top &&
                rect1.top < rect2.bottom
            ) {
                return div; // Return the first overlapping div found
            }
        }
    }
    return null; // No overlapping div found
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

    document.body.appendChild(floatingText);

    setTimeout(() => {
        floatingText.style.opacity = "0";
        floatingText.style.transform = "translate(-50%, -80px)";
    }, 50);

    setTimeout(() => {
        floatingText.remove();
    }, 700);
}

function showFloatingText(event) {
    if (isTouchActive) {
        const touch = event.touches[0] || event.changedTouches[0];
        displayFloatingText("Card cannot be placed here", touch.clientX, touch.clientY);
    } else {
        displayFloatingText("Card cannot be placed here", event.clientX, event.clientY);
    }

    if (creatingCard) {
        creatingCard.remove();
        creatingCard = null;
    }
}

function getIDFromURL() {
    const pathSegments = window.location.pathname.split("/");
    return pathSegments[pathSegments.length - 1]; // Assuming ID is the last segment
}

async function fetchCSV() {
    const response = await fetch(csvUrl);
    const data = await response.text();

    // Use PapaParse to parse the CSV data
    Papa.parse(data, {
        complete: function (results) {
            console.log("Parsed CSV Data:", results.data);

            // Get the ID from the URL
            const idFromURL = getIDFromURL();
            let idFound = false;

            // Check if any row contains the ID
            results.data.slice(1).forEach(row => {
                if (row.includes(idFromURL)) {
                    idFound = true; // Set flag if ID is found
                }
                createFloatingButton(null, row, false);
            });

            // If the ID was not found, run the function again
            if (!idFound) {
                console.log(`ID ${idFromURL} not found`);
                cleanOverexposureUrl()
            }
        },
        header: false, // Adjust this if you want to include headers
        skipEmptyLines: true // Skip empty lines
    });
}

function createFloatingButton(event = null,row, draft = false) {
    const idFromURL = getIDFromURL();
    const [title = "New Title", text = "Type here...", id  = new Date().toISOString(), date = Date.now(),  xPosition = "0", yPosition = "0"] = row;

    // Create button element
    const button = document.createElement("button");
    button.classList.add("floating-button");

    // Create the image element
    const img = document.createElement("img");
    img.src = "/images/overexposure/card-template.svg";
    img.classList.add("floating-image");

    // Create the span for button text
    const span = document.createElement("span");
    span.classList.add("button-text");
    span.textContent = title;

    // Add attributes to the button
    button.setAttribute("data-id", id);
    button.setAttribute("data-date", date);
    button.setAttribute("data-title", title);
    button.setAttribute("data-text", text);

    const noPlaceDiv = document.createElement("div");
    noPlaceDiv.classList.add("no-place");
    noPlaceDiv.appendChild(button);
    floatingContainer.appendChild(noPlaceDiv);

    // Append elements
    button.appendChild(img);
    button.appendChild(span);
    floatingContainer.appendChild(button);

    // Directly use the raw xPosition and yPosition without normalization
    button.style.left = `${parseFloat(xPosition)}px`;
    button.style.top = `${parseFloat(yPosition)}px`;

    noPlaceDiv.style.left = `${parseFloat(xPosition) - cardWidthValue / 4}px`;
    noPlaceDiv.style.top = `${parseFloat(yPosition) - cardWidthValue / 4}px`;

    // Apply animation
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
        showFloatingText(event);
        button.remove();
        noPlaceDiv.remove();
        return;
    }

    // Handle button click
    button.addEventListener("click", () => {
        selectCard(button, false)
    });

    button.addEventListener("touchstart", () => {
        touchStartTime = Date.now(); // Record the time when the touch starts
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
        const touchEndTime = Date.now(); // Record the time when the touch ends
        const touchHeldDuration = touchEndTime - touchStartTime; // Calculate the duration of the touch
        button.classList.remove('touchhover');
        // If the button was held down long enough, trigger the action
        const touch = event.touches[0] || event.changedTouches[0];
        const touchRadius = calculateTouchDistance(cameraPosition, singleTouchPosition);
        console.log(touchRadius)


        // If touchRadius exceeds maxTouchRadius, remove the creatingCard immediately
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
    if (safeZone && safeZone.contains(event.target) || (floatingContainer && !floatingContainer.contains(event.target))) {
        showFloatingText(event);
        return;
    }

    contentsTextArea.value = "";
    titleTextInput.value = "";

    createFloatingButton(event,["New Title", "Type here...", new Date().toISOString(), formatDate(Date.now()), positionX.toString(), positionY.toString()], true);
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
    if(detectName(contentsTextArea.value).hasName || detectName(titleTextInput.value).hasName){
        console.log(detectName(contentsTextArea.value));
        postIncompleteContainer.classList.add('active');
        currentWarningContainer = postIncompleteContainer;
    }
    else{
        areYouSurePostContainer.classList.add('active');
        console.log("Posting");
        currentWarningContainer = areYouSurePostContainer;
    }
});
submitPostYes.addEventListener("click", async () => {
    // Get the draft button data
    areYouSurePostContainer.classList.remove('active');
    currentWarningContainer = null;
    const draftButtons = document.querySelectorAll(".floating-button.draft");
    if (draftButtons.length > 0) {
        uploadingPostContainer.classList.add("active");
        currentWarningContainer = uploadingPostContainer;
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

        // Save the draft data to the CSV/Google Sheets (using a backend server or Google Sheets API)
        try {
            const response = await saveDataToGoogleSheets(draftData);
            overlay.classList.remove('active');
            overexposureContainer.classList.remove('active');
            console.log("Draft data saved successfully:", response);
            draftButtons.forEach(button => {
                button.classList.remove("draft");
            });
            cleanOverexposureUrl();
            // You can add logic to reset the draft or show a confirmation message
        } catch (error) {
            console.error("Error saving draft data:", error);
        }
        uploadingPostContainer.classList.remove("active");
        currentWarningContainer = uploadingPostContainer;
    }
});
submitPostNo.addEventListener("click", async () => {
    areYouSurePostContainer.classList.remove('active');
    currentWarningContainer = null;
});

// Function to save draft data to Google Sheets (via backend or API)
async function saveDataToGoogleSheets(draftData) {
    try {
        console.log("Sending data to Google Sheets:", draftData);
        // Convert draftData array to URLSearchParams format
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
            body: formData, // Sending as URL encoded form data
        });

        const responseText = await response.text(); // Read response as text
        console.log("Response from Google Sheets:", responseText);
    } catch (error) {
        console.error("Error sending draft data:", error);
    }
}


const observer = new MutationObserver((mutationsList) => {
    for (const mutation of mutationsList) {
        if (mutation.type === "attributes" && mutation.attributeName === "class") {
            if(!overlay.classList.contains("active")){
                cleanOverexposureUrl();
            }
            if (!overexposureContainer.classList.contains("active")) {
                const draftButtons = document.querySelectorAll(".floating-button.draft");
                if (contentsTextArea.value.trim() !== "" || titleTextInput.value.trim() !== "") {
                    if (draftButtons.length > 0) {
                        overlay.classList.add('active');
                        overexposureContainer.classList.add('active');
                        if(currentWarningContainer === postIncompleteContainer){
                            currentWarningContainer = null;
                            postIncompleteContainer.classList.remove('active');
                        }
                        else if (!(areYouSurePostContainer.classList.contains('active'))) {
                            exitMenuContainer.classList.add('active');
                            currentWarningContainer = exitMenuContainer;
                        }
                        else {
                            areYouSurePostContainer.classList.remove('active');
                            currentWarningContainer = null;
                        }

                    }
                }
                else {
                    document.querySelectorAll(".floating-button.draft").forEach(button => button.remove());
                    document.querySelectorAll(".no-place.draft").forEach(noPlaceDraft => noPlaceDraft.remove());
                    history.pushState(null, "", window.location.pathname);
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
}

exitMenuYes.addEventListener("click", ExitMenuButtonYes);
exitMenuNo.addEventListener("click", ExitMenuButtonNo);

function ExitMenuButtonYes() {
    titleTextInput.value = "";
    contentsTextArea.value = "";
    exitMenuContainer.classList.remove('active');
    publishButton.disabled = true;
    toggleOverlay();
}

function ExitMenuButtonNo() {
    exitMenuContainer.classList.remove('active');
    currentWarningContainer = null;
}

overexposureContainer.addEventListener("mousedown", function () {
    if (exitMenuContainer.classList.contains("active")) {
        exitMenuContainer.classList.remove("active");
        areYouSurePostContainer.classList.remove('active');
        currentWarningContainer = null;
    }
    if (areYouSurePostContainer.classList.contains("active")) {
        areYouSurePostContainer.classList.remove('active');
        currentWarningContainer = null;
    }
    if (postIncompleteContainer.classList.contains("active")) {
        postIncompleteContainer.classList.remove('active');
        currentWarningContainer = null;
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
    
    // Find the position of "/overexposure/"
    const overexposureIndex = currentUrl.indexOf(basePath);

    // Check if "/overexposure/" exists in the URL
    if (overexposureIndex !== -1) {
        // Keep the part before the additional segment and append a "/"
        const newUrl = currentUrl.slice(0, overexposureIndex + basePath.length) + "/";

        // Update the URL without reloading the page
        history.pushState(null, "", newUrl);
    }
}

function cleanOverexposureUrl() {
    const currentUrl = window.location.pathname;
    const basePath = "/overexposure";
    
    // Find the position of "/overexposure/"
    const overexposureIndex = currentUrl.indexOf(basePath);

    // Check if "/overexposure/" exists in the URL
    if (overexposureIndex !== -1) {
        // Keep the part before the additional segment and append a "/"
        const newUrl = currentUrl.slice(0, overexposureIndex + basePath.length) + "/";

        // Update the URL without reloading the page
        history.pushState(null, "", newUrl);
    }
}

const textInput = document.getElementById("text-input");
const charCounter = document.getElementById("char-counter");
const maxLength = textInput.getAttribute("maxlength");

textInput.addEventListener("input", () => {
    charCounter.textContent =  maxLength - textInput.value.length;
});
