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

async function deleteConfession(confessionId, deleteCode) {
    const res = await fetch(`/api/confessions/${confessionId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deleteCode }),
    });

    const data = await res.json();
    console.log(data);
}