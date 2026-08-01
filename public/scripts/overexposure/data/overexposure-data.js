const { protocol, hostname } = window.location;
let socket;
if (hostname === 'overexposed.app') {
    socket = io(`${protocol}//${hostname}`);
} else {
    socket = io(`${protocol}//${hostname}:3000`);
}

socket.on('connect', () => {
    debugLog('Socket connected successfully');
});

socket.on('connect_error', (err) => {
    console.error('Socket connection error:', err);
});

async function fetchOverexposurePostList() {
    const response = await fetch('/api/overexposure-posts');
    const payload = await response.json();

    if (!response.ok || payload.success === false) {
        throw new Error(payload.error?.message || 'Failed to fetch Overexposure posts');
    }

    const overexposurePosts = Array.isArray(payload) ? payload : payload.data;

    if (!Array.isArray(overexposurePosts)) {
        throw new Error('Overexposure posts API returned an unexpected response shape');
    }

    return overexposurePosts;
}

function normaliseOverexposurePost(post = {}) {
    return {
        title: post.content?.title ?? post.title ?? "New Title",
        text: post.content?.text ?? post.text ?? "Type here...",
        id: post.public?.id ?? post.id ?? new Date().toISOString(),
        date: post.lifecycle?.postedAt ?? post.date ?? post.system?.createdAt ?? post.createdAt ?? Date.now(),
        userIcon: post.author?.icon ?? post.userIcon ?? "0000:0100:0200:0300",
        x: post.placement?.x ?? post.x ?? "0",
        y: post.placement?.y ?? post.y ?? "0",
        tag: post.public?.tag ?? post.tag ?? "confessions"
    };
}

function postToFloatingButtonRow(post) {
    const normalisedPost = normaliseOverexposurePost(post);
    return [
        normalisedPost.title,
        normalisedPost.text,
        normalisedPost.id,
        normalisedPost.date,
        normalisedPost.userIcon,
        normalisedPost.x,
        normalisedPost.y,
        normalisedPost.tag
    ];
}

window.addEventListener('oe-nsfw-setting-changed', (event) => {
    if (event.detail?.changed === false) return;
    SetNSFW();
});

async function fetchOverexposurePosts() {
    try {
        const data = await fetchOverexposurePostList();

        debugLog("📥 Overexposure posts from MongoDB:", data);

        const idFromURL = getIDFromURL();
        let idFound = false;

        data.forEach(overexposurePost => {
            const post = normaliseOverexposurePost(overexposurePost);

            if (post.id === idFromURL || buildOverexposureCardSlug(post.x, post.y) === idFromURL) {
                idFound = true;
            }
            createFloatingButton(null, postToFloatingButtonRow(post), false);
        });
        CardBoundsToggle(cardBoundsCheckbox.checked);
        if (!idFound) {
            debugLog(`ID ${idFromURL} not found`);
            cleanOverexposureUrl();
        }

        SetNSFW({ sound: false });
    } catch (error) {
        console.error("❌ Error fetching Overexposure posts:", error);
    }
}

async function updateOverexposurePosts() {
    try {
        const data = await fetchOverexposurePostList();

        debugLog("📥 Overexposure posts from MongoDB:", data);

        const normalisedPosts = data.map(normaliseOverexposurePost);

        const overexposurePostIds = new Set(normalisedPosts.map(overexposurePost => overexposurePost.id));

        // Get all existing floating buttons
        const floatingButtons = document.querySelectorAll('.floating-button');

        // 1️⃣ Remove any non-draft floating buttons that no longer exist in the DB
        floatingButtons.forEach(button => {
            const id = button.getAttribute('data-id');
            const isDraft = button.classList.contains('draft');

            // Skip drafts – they won't be in the DB yet
            if (isDraft) return;

            if (!overexposurePostIds.has(id)) {
                debugLog(`🗑 Removing floating button not in DB: ${id}`);

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

        normalisedPosts.forEach(overexposurePost => {
            const existingButton = document.querySelector(`.floating-button[data-id="${overexposurePost.id}"]`);

            if (!existingButton) {
                debugLog(`➕ Creating new floating button for Overexposure post: ${overexposurePost.id}`);
                createFloatingButton(null, postToFloatingButtonRow(overexposurePost), false);
            }
        });

    } catch (error) {
        console.error("❌ Error fetching Overexposure posts:", error);
    }
}

socket.on("overexposure-posts-updated", async (change) => {
    updateOverexposurePosts();
});

async function saveDataToMongoDB(draftData) {
    try {
        const [title, text, id, date, userIcon, x, y, tag] = draftData[0];

        const overexposurePost = {
            public: {
                id,
                tag,
                visibility: "public"
            },
            content: {
                title,
                text
            },
            author: {
                icon: userIcon
            },
            placement: {
                x,
                y
            },
            lifecycle: {
                postedAt: date
            }
        };

        debugLog("📤 Saving Overexposure post", overexposurePost);
        const response = await fetch('/api/overexposure-posts', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(overexposurePost)
        });
        const result = await response.json();
        debugLog("✅ Response from MongoDB:", result);
        if (!response.ok) {
            throw new Error(result.error || 'Failed to save Overexposure post');
        }

        const { overexposurePost: savedOverexposurePost, deleteCode } = result;

        debugLog("🧾 Delete code for this Overexposure post:", deleteCode);

        // Simple version: just alert it
        //alert(`Your delete code for this post is: ${deleteCode}\n\nSave this code if you want to delete it later.`);
        rememberCodeText.value = deleteCode;

        // Optional: store it locally so the same browser remembers it
        const savedOverexposurePostId = savedOverexposurePost?.public?.id ?? savedOverexposurePost?.id;
        if (savedOverexposurePost && savedOverexposurePost._id && deleteCode && savedOverexposurePostId) {
            localStorage.setItem(`overexposure-delete-code-${savedOverexposurePostId}`, deleteCode);
        }
        return result;
    } catch (error) {
        playSoundEffect('postIncomplete');
        console.error("❌ Error sending Overexposure post to MongoDB:", error);
        throw error;
    }
}

overexposureContainer.addEventListener("mousedown", function (event) {
    if (event.target.closest('.moderation-controls-container')) {
        return;
    }

    if (isContainerVisible(exitMenuContainer)) {
        hideContainer(exitMenuContainer);
        hideContainer(areYouSurePostContainer);

        removeElementIfExists(popUpClassArray, exitMenuContainer)
        removeElementIfExists(popUpClassArray, areYouSurePostContainer)
    }
    if (isContainerVisible(areYouSurePostContainer)) {
        hideContainer(areYouSurePostContainer);
        removeElementIfExists(popUpClassArray, areYouSurePostContainer)
    }
    if (isContainerVisible(postIncompleteContainer)) {
        hideContainer(postIncompleteContainer);
        removeElementIfExists(popUpClassArray, postIncompleteContainer)
    }
    if (isContainerVisible(deletePostContainer)) {
        hideContainer(deletePostContainer);
        removeElementIfExists(popUpClassArray, deletePostContainer)
    }
    if (isContainerVisible(sharePostContainer)) {
        hideContainer(sharePostContainer);
        removeElementIfExists(popUpClassArray, sharePostContainer)
    }
});

async function deleteOverexposurePost(overexposurePostId, deleteCode) {
    const res = await fetch(`/api/overexposure-posts/${overexposurePostId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deleteCode }),
    });

    const data = await res.json();
    debugLog(data);
}
