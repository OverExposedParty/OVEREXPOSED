const csvUrl = "https://docs.google.com/spreadsheets/d/e/2PACX-1vR0xDhIbJUMjnu2ZpxIVJwN9tgNjK_Sm9TJfNzH6wBfDKJXPZtV5B0D0GStZZdIUQhYyEdbet94Xbdm/pub?output=csv";
const googleScriptSaveCardURL = "https://script.google.com/macros/s/AKfycbzdAGne-Sv4rhWuShx7HJ4ImHVRZ74ftMMGTwXJuq6C8PXR5qaNfuRu9y-LnnnYYeixlQ/exec";

const wrapper = document.getElementById("wrapper");
const canvasWidth = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--canvasWidth').trim(), 10);
const canvasHeight = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--canvasHeight').trim(), 10);

const titleText = document.querySelector(".title-text");
const contentsContainerText = document.querySelector('.contents-container p');

const titleTextEditor = document.querySelector(".title-text-editor");
const contentsTextEditor = document.getElementById("contents-text-editor");
const floatingContainer = document.getElementById("floating-container");

const overexposureContainer = document.getElementById("overexposure-container");
const exitMenuContainer = document.getElementById("exit-menu-container");
const incompletePostContainer = document.getElementById("publish-error-container");
const uploadingPostContainer = document.getElementById("uploading-post-container");

const uploadingText = document.getElementById("uploading-text");

const contentsTextArea = document.querySelector("#contents-text-editor textarea");
const titleTextInput = document.getElementById("title-text-editor-input");

const exitMenuYes = document.getElementById("exit-menu-button-yes");
const exitMenuNo = document.getElementById("exit-menu-button-no");

const publishButton = document.querySelector(".overexposure-publish-button");

const maxTouchRadius = 50;

let singleTouchPosition = {
    x: 0,
    y: 0
};

function calculateTouchDistance(cameraPosition, singleTouchPosition) {
    // Calculate the distance between camera and touch in 2D space
    const dx = singleTouchPosition.x - cameraPosition.x;
    const dy = singleTouchPosition.y - cameraPosition.y;

    return Math.sqrt(dx * dx + dy * dy); // Return Euclidean distance in 2D
}




let count = 0;
let intervalId = null;
let touchTimer;

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

function showFloatingText(message, x, y) {
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


async function fetchCSV() {
    const response = await fetch(csvUrl);
    const data = await response.text();

    // Use PapaParse to parse the CSV data
    Papa.parse(data, {
        complete: function (results) {
            console.log("Parsed CSV Data:", results.data);

            // Assuming the first row is the header, start from the second row
            results.data.slice(1).forEach(row => {
                createFloatingButton(row, false);
            });
        },
        header: false, // Adjust this if you want to include headers
        skipEmptyLines: true // Skip empty lines
    });
}

function createFloatingButton(row, draft = false) {
    const [title = "New Title", text = "Type here...", date = new Date().toISOString(), id = Date.now(), xPosition = "0", yPosition = "0"] = row;

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

    // Append elements
    button.appendChild(img);
    button.appendChild(span);
    floatingContainer.appendChild(button);

    // Normalize positions and set styles
    const normalizedX = (parseFloat(xPosition) + 1) / 2;
    const normalizedY = (parseFloat(yPosition) + 1) / 2;

    button.style.left = `${normalizedX * canvasWidth}px`;
    button.style.top = `${normalizedY * canvasHeight}px`;

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

    // Handle button click
    button.addEventListener("click", () => {
        selectCard(button, false)
    });

    if (draft) {
        button.classList.add("draft");
        selectCard(button, true)
    }
}
function handleDoubleClick(event) {
    if (isTouchActive) return;

    const rect = floatingContainer.getBoundingClientRect();
    const computedStyle = getComputedStyle(floatingContainer);
    const scale = parseFloat(computedStyle.transform.split(', ')[3]) || 1;

    const clickX = (event.clientX - rect.left) / scale;
    const clickY = (event.clientY - rect.top) / scale;

    const normalizedX = (clickX / canvasWidth) * 2 - 1;
    const normalizedY = (clickY / canvasHeight) * 2 - 1;

    placeCard(event, normalizedX, normalizedY);
}

function handleTouchStart(event) {
    if (event.touches.length === 1) {
        console.log("touch started");
        singleTouchPosition.x = cameraPosition.x;
        singleTouchPosition.y = cameraPosition.y;
        touchTimer = setTimeout(() => {
            handleToucHold(event); // Trigger on long press
        }, 1000); // Adjust duration for long press detection (e.g., 500ms)
    }
    else {
        if (touchTimer) {
            clearTimeout(touchTimer); // Cancel long press if the user lifts finger early
        }
    }
}


function handleTouchEnd() {
    clearTimeout(touchTimer); // Cancel long press if the user lifts finger early
}

function handleToucHold(event) {
    event.preventDefault();
    const touchRadius = calculateTouchDistance(cameraPosition, singleTouchPosition);

    // Add a safety check if the touch radius is too small
    if (touchRadius > maxTouchRadius) {
        console.log("touchRadius is too small");

        console.log("maxTouchRadius: " + maxTouchRadius)
        console.log("touchRadius: " + touchRadius);
        
        return;
    }
    console.log("maxTouchRadius: " + maxTouchRadius)
    console.log("touchRadius: " + touchRadius);

    const touch = event.touches[0] || event.changedTouches[0];
    console.log(touch);
    const rect = floatingContainer.getBoundingClientRect();
    const computedStyle = getComputedStyle(floatingContainer);
    const scale = parseFloat(computedStyle.transform.split(', ')[3]) || 1;

    const touchX = (touch.clientX - rect.left) / scale;
    const touchY = (touch.clientY - rect.top) / scale;

    const normalizedX = (touchX / canvasWidth) * 2 - 1;
    const normalizedY = (touchY / canvasHeight) * 2 - 1;

    placeCard(event, normalizedX, normalizedY);
}
function placeCard(event, normalizedX, normalizedY) {
    const safeZone = document.querySelector(".safe-zone");
    const floatingContainer = document.querySelector(".floating-container");
    const touch = event.touches[0] || event.changedTouches[0];
    if (safeZone && safeZone.contains(event.target) || (floatingContainer && !floatingContainer.contains(event.target))) {
        if (isTouchActive) {
            showFloatingText("Card cannot be placed here", touch.clientX, touch.clientY);
        }
        else {
            showFloatingText("Card cannot be placed here", event.clientX, event.clientY);
        }
        return;
    }

    contentsTextArea.value = "";
    titleTextInput.value = "";

    createFloatingButton(["New Title", "Type here...", formatDate(Date.now()), new Date().toISOString(), normalizedX.toString(), normalizedY.toString()], true);
}

// Attach touch event listener
wrapper.addEventListener("touchstart", handleTouchStart);
wrapper.addEventListener("touchend", handleTouchEnd);
wrapper.addEventListener("dblclick", handleDoubleClick);

let lastTap = 0;
wrapper.addEventListener("touchend", function (event) {
    let currentTime = new Date().getTime();
    let tapLength = currentTime - lastTap;
    if (tapLength < 300 && tapLength > 0) { // 300ms threshold for double tap
        handleDoubleClick(event);
    }
    lastTap = currentTime;
});




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
    // Get the draft button data
    const draftButtons = document.querySelectorAll(".floating-button.draft");
    if (titleTextInput.value.trim() === "" || contentsTextArea.value.trim() === "") {
        incompletePostContainer.classList.toggle('active');
    }
    else {
        if (draftButtons.length > 0) {
            uploadingPostContainer.classList.add("active");
            intervalId = setInterval(updateEllipses, 400);
            const draftData = [];
            draftButtons.forEach(button => {
                button.setAttribute("data-title", titleTextInput.value.trim());
                button.setAttribute("data-text", contentsTextArea.value.trim());

                const title = button.getAttribute("data-title");
                const text = button.getAttribute("data-text");
                const id = button.getAttribute("data-id");
                const date = button.getAttribute("data-date");
                const xPosition = ((parseFloat(button.style.left) / canvasWidth) * 2) - 1;
                const yPosition = ((parseFloat(button.style.top) / canvasHeight) * 2) - 1;

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
                // You can add logic to reset the draft or show a confirmation message
            } catch (error) {
                console.error("Error saving draft data:", error);
            }
            uploadingPostContainer.classList.remove("active");
        }
    }
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
            if (!overexposureContainer.classList.contains("active")) {
                const draftButtons = document.querySelectorAll(".floating-button.draft");
                if (contentsTextArea.value.trim() !== "" || titleTextInput.value.trim() !== "") {
                    if (incompletePostContainer.classList.contains('active')) {
                        incompletePostContainer.classList.remove('active');
                        overexposureContainer.classList.add('active');
                        overlay.classList.add('active');
                    }
                    else if (draftButtons.length > 0) {
                        overlay.classList.add('active');
                        overexposureContainer.classList.add('active');
                        exitMenuContainer.classList.add('active');
                    }
                }
                else {
                    document.querySelectorAll(".floating-button.draft").forEach(button => button.remove());
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

function selectCard(button, draft) {
    overexposureContainer.classList.add("active");

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
    let contentsTextArea = document.querySelector("#contents-text-editor textarea");
    contentsTextArea.value = "";
    exitMenuContainer.classList.remove('active');

    toggleOverlay();
}

function ExitMenuButtonNo() {
    exitMenuContainer.classList.remove('active');
}

overexposureContainer.addEventListener("mousedown", function () {
    if (incompletePostContainer.classList.contains("active")) {
        incompletePostContainer.classList.remove("active");
    }
    if (exitMenuContainer.classList.contains("active")) {
        exitMenuContainer.classList.remove("active");
    }
});

function detectTouchScreen() {
    const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

    const computerControls = document.getElementById("computer-controls");
    const mobileControls = document.getElementById("mobile-controls");

    if (isTouch) {
        mobileControls.classList.add("active");
        computerControls.classList.remove("active");
    } else {
        computerControls.classList.add("active");
        mobileControls.classList.remove("active");
    }
}

// Run the function on page load
window.addEventListener("load", detectTouchScreen);

