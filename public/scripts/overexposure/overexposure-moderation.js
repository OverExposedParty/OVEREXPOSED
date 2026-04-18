function getActiveOverexposureTag() {
    const selectedTag = document.querySelector('.tag-item.selected');
    return selectedTag?.id || 'confessions';
}

function updateOverexposureFavicons(tag = getActiveOverexposureTag()) {
    const safeTag = tag || 'confessions';
    const faviconBasePath = `/images/meta/favicons/overexposure/${safeTag}`;

    const faviconIco = document.querySelector('link[rel="icon"][type="image/x-icon"]');
    const favicon16 = document.querySelector('link[rel="icon"][sizes="16x16"]');
    const favicon32 = document.querySelector('link[rel="icon"][sizes="32x32"]');
    const faviconApple = document.querySelector('link[rel="apple-touch-icon"]');
    const faviconManifest = document.querySelector('link[rel="manifest"]');

    if (faviconIco) faviconIco.href = `${faviconBasePath}/favicon.ico`;
    if (favicon16) favicon16.href = `${faviconBasePath}/favicon-16x16.png`;
    if (favicon32) favicon32.href = `${faviconBasePath}/favicon-32x32.png`;
    if (faviconApple) faviconApple.href = `${faviconBasePath}/apple-touch-icon.png`;
    if (faviconManifest) faviconManifest.href = `${faviconBasePath}/site.webmanifest`;
}

window.updateOverexposureFavicons = updateOverexposureFavicons;

function SetNSFW() {
    const bool = localStorage.getItem('settings-nsfw');
    const buttons = document.querySelectorAll('.floating-button');

    if (bool === 'true') {
        hideContainer(enableNSFWContainer);
        removeElementIfExists(permanantElementClassArray, enableNSFWContainer);
        document.documentElement.style.setProperty('--primarypagecolour', currentPageColours.primary);
        document.documentElement.style.setProperty('--secondarypagecolour', currentPageColours.secondary);
        buttons.forEach(button => {
            applyFloatingCardTemplate(button, {
                tag: button.getAttribute("data-tag") || "confessions",
                disabled: false
            });
        });

        updateOverexposureFavicons();
        document.documentElement.style.setProperty('--rotatedeviceicon', `url(/images/icons/overexposure/rotate-phone-icon.svg)`);
        document.documentElement.style.setProperty('--tiktokicon', `url(/images/icons/overexposure/tik-tok-icon.svg)`);
        document.documentElement.style.setProperty('--instagramicon', `url(/images/icons/overexposure/instagram-icon.svg)`);
    }
    else {
        showContainer(enableNSFWContainer);
        addElementIfNotExists(permanantElementClassArray, enableNSFWContainer);
        document.documentElement.style.setProperty('--primarypagecolour', '#999999');
        document.documentElement.style.setProperty('--secondarypagecolour', '#666666');
        buttons.forEach(button => {
            applyFloatingCardTemplate(button, {
                tag: button.getAttribute("data-tag") || "confessions",
                disabled: true
            });
        });

        updateOverexposureFavicons();
        document.documentElement.style.setProperty('--rotatedeviceicon', `url(/images/icons/grey/rotate-phone-icon.svg)`);
        document.documentElement.style.setProperty('--tiktokicon', `url(/images/icons/grey/tik-tok-icon.svg)`);
        document.documentElement.style.setProperty('--instagramicon', `url(/images/icons/grey/instagram-icon.svg)`);
    }
}

function trapModerationButtonPointer(button) {
    if (!button) return;
    button.addEventListener("mousedown", (event) => {
        event.stopPropagation();
    });
    button.addEventListener("click", (event) => {
        event.stopPropagation();
    });
}

trapModerationButtonPointer(sharePostButton);
trapModerationButtonPointer(deletePostButton);
trapModerationButtonPointer(flagPostButton);
trapModerationButtonPointer(sharePostCopyButton);

function closeModerationPopups({ except = null } = {}) {
    const moderationPopups = [sharePostContainer, deletePostContainer];

    moderationPopups.forEach((popup) => {
        if (!popup || popup === except) return;
        hideContainer(popup);
        removeElementIfExists(popUpClassArray, popup);
    });
}

sharePostButton.addEventListener("click", () => {
    const selectedCardId = overexposureContainer.getAttribute('data-selected-card');
    if (!selectedCardId) return;

    if (isContainerVisible(sharePostContainer)) {
        hideContainer(sharePostContainer);
        removeElementIfExists(popUpClassArray, sharePostContainer);
        return;
    }

    closeModerationPopups({ except: sharePostContainer });
    showContainer(sharePostContainer);
    addElementIfNotExists(popUpClassArray, sharePostContainer);
});

sharePostCopyButton.addEventListener("click", async () => {
    flashButtonHoverState(sharePostCopyButton, {
        duration: 250,
        className: 'copy-feedback-active',
        transitionClassName: 'copy-feedback-fade',
        touchOnly: false
    });

    try {
        const shareUrl = sharePostUrlInput.dataset.fullUrl || `${window.location.origin}${window.location.pathname}`;
        const copied = await copyTextToClipboard(shareUrl);

        if (!copied) {
            throw new Error('Clipboard copy command was not successful.');
        }

        if (typeof window.setTooltipSelectedState === 'function') {
            window.setTooltipSelectedState(sharePostCopyButton);
        }
    } catch (err) {
        console.error('Failed to copy share URL:', err);
    }
});

let snapKitReadyPromise = null;
let snapchatShareProxyButton = null;

function getCurrentShareDetails() {
    const selectedCardId = overexposureContainer.getAttribute('data-selected-card');
    const selectedCard = selectedCardId
        ? document.querySelector(`.floating-button[data-id="${selectedCardId}"]`)
        : null;
    const shareUrl = sharePostUrlInput.dataset.fullUrl || `${window.location.origin}${window.location.pathname}`;
    const shareTitle = (
        selectedCard?.getAttribute("data-title") ||
        sharePostBodyTitle.textContent ||
        ""
    ).trim();
    const titleAndLinkMessage = [shareTitle, shareUrl].filter(Boolean).join("\n\n").trim();

    return {
        shareUrl,
        shareTitle,
        titleAndLinkMessage
    };
}

function openShareWindow(url) {
    if (!url) return;
    window.open(url, "_blank", "noopener,noreferrer");
}

function showShareActionFeedback(button, message) {
    if (!button || !message) return;

    const rect = button.getBoundingClientRect();
    displayFloatingText(
        message,
        rect.left + window.scrollX + (rect.width / 2),
        rect.top + window.scrollY
    );
}

async function ensureSnapKitLoaded() {
    if (window.snap?.creativekit) {
        return window.snap;
    }

    if (snapKitReadyPromise) {
        return snapKitReadyPromise;
    }

    snapKitReadyPromise = new Promise((resolve, reject) => {
        const existingScript = document.getElementById("snapkit-creative-kit-sdk");

        if (existingScript) {
            existingScript.addEventListener("load", () => resolve(window.snap), { once: true });
            existingScript.addEventListener("error", () => reject(new Error("Failed to load Snap Kit SDK.")), { once: true });
            return;
        }

        const script = document.createElement("script");
        script.id = "snapkit-creative-kit-sdk";
        script.async = true;
        script.src = "https://sdk.snapkit.com/js/v1/create.js";
        script.addEventListener("load", () => resolve(window.snap), { once: true });
        script.addEventListener("error", () => reject(new Error("Failed to load Snap Kit SDK.")), { once: true });
        document.head.appendChild(script);
    }).catch((error) => {
        snapKitReadyPromise = null;
        throw error;
    });

    return snapKitReadyPromise;
}

function getSnapchatProxyButton() {
    if (snapchatShareProxyButton) {
        return snapchatShareProxyButton;
    }

    snapchatShareProxyButton = document.createElement("button");
    snapchatShareProxyButton.type = "button";
    snapchatShareProxyButton.className = "snapchat-share-button";
    snapchatShareProxyButton.tabIndex = -1;
    snapchatShareProxyButton.setAttribute("aria-hidden", "true");
    snapchatShareProxyButton.style.position = "fixed";
    snapchatShareProxyButton.style.left = "-9999px";
    snapchatShareProxyButton.style.width = "1px";
    snapchatShareProxyButton.style.height = "1px";
    snapchatShareProxyButton.style.opacity = "0";
    snapchatShareProxyButton.style.pointerEvents = "none";
    document.body.appendChild(snapchatShareProxyButton);

    return snapchatShareProxyButton;
}

async function shareToSnapchat() {
    const { shareUrl } = getCurrentShareDetails();
    const proxyButton = getSnapchatProxyButton();
    proxyButton.setAttribute("data-share-url", shareUrl);

    await ensureSnapKitLoaded();

    const initializeShareButtons =
        window.snap?.creativekit?.initializeShareButtons ||
        window.snap?.creativekit?.initalizeShareButtons;

    if (typeof initializeShareButtons !== "function") {
        throw new Error("Snap Kit share button initializer is unavailable.");
    }

    initializeShareButtons(document.getElementsByClassName("snapchat-share-button"));
    proxyButton.click();
}

async function shareViaNativeOrClipboard(button, platformName, platformUrl) {
    const { shareUrl, shareTitle, titleAndLinkMessage } = getCurrentShareDetails();

    if (navigator.share) {
        try {
            await navigator.share({
                title: shareTitle || document.title,
                text: titleAndLinkMessage || shareTitle || document.title,
                url: shareUrl
            });
            return;
        } catch (error) {
            if (error?.name === "AbortError") {
                return;
            }
        }
    }

    try {
        const copied = await copyTextToClipboard(shareUrl);
        if (copied) {
            showShareActionFeedback(button, `Link copied for ${platformName}`);
        }
    } catch (error) {
        console.error(`Failed to copy ${platformName} share URL:`, error);
    }

    openShareWindow(platformUrl);
}

shareWhatsAppButton?.addEventListener("click", () => {
    const { titleAndLinkMessage } = getCurrentShareDetails();
    openShareWindow(`https://wa.me/?text=${encodeURIComponent(titleAndLinkMessage)}`);
});

shareXButton?.addEventListener("click", () => {
    const { shareUrl, shareTitle } = getCurrentShareDetails();
    const tweetText = shareTitle || document.title;
    openShareWindow(`https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}&url=${encodeURIComponent(shareUrl)}`);
});

shareSnapchatButton?.addEventListener("click", async () => {
    try {
        await shareToSnapchat();
    } catch (error) {
        console.error("Failed to share via Snapchat:", error);
        await shareViaNativeOrClipboard(
            shareSnapchatButton,
            "Snapchat",
            "https://www.snapchat.com/"
        );
    }
});

shareInstagramButton?.addEventListener("click", async () => {
    await shareViaNativeOrClipboard(
        shareInstagramButton,
        "Instagram",
        "https://www.instagram.com/"
    );
});

shareDiscordButton?.addEventListener("click", async () => {
    await shareViaNativeOrClipboard(
        shareDiscordButton,
        "Discord",
        "https://discord.com/channels/@me"
    );
});

deletePostButton.addEventListener("click", () => {
    const selectedCardId = overexposureContainer.getAttribute('data-selected-card');
    if (!selectedCardId) return;

    if (isContainerVisible(deletePostContainer)) {
        hideContainer(deletePostContainer);
        removeElementIfExists(popUpClassArray, deletePostContainer);
        return;
    }

    closeModerationPopups({ except: deletePostContainer });
    showContainer(deletePostContainer);
    addElementIfNotExists(popUpClassArray, deletePostContainer);
    if (localStorage.getItem(`overexposure-delete-code-${selectedCardId}`)) {
        deleteCodeInput.value = localStorage.getItem(`overexposure-delete-code-${selectedCardId}`);
    }
    else {
        deleteCodeInput.value = "";
    }
});

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
        debugLog("🗑 Delete response:", data);

        if (!res.ok) {
            alert(data.error || "Failed to delete post. Check your delete code.");
            return;
        }

        // Remove card from UI
        const button = document.querySelector(`.floating-button[data-id="${confessionId}"]`);
        const noPlace = document.querySelector(`.no-place[data-id="${confessionId}"]`);
        if (button) button.remove();
        if (noPlace) noPlace.remove();

        hideContainer(deletePostContainer);
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
    hideContainer(rememberCodeContainer);
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
        const isToggled = flagPostButton.classList.toggle('toggled');
        const label = isToggled ? 'Unflag post' : 'Flag post';

        flagPostButton.setAttribute('aria-pressed', isToggled ? 'true' : 'false');
        flagPostButton.setAttribute('data-tooltip', label);
        flagPostButton.classList.toggle('warning', isToggled);

        const flagPostButtonLabel = document.getElementById('flag-post-button-label');
        if (flagPostButtonLabel) {
            flagPostButtonLabel.textContent = label;
        }

        if (typeof window.refreshActiveTooltip === 'function') {
            window.refreshActiveTooltip(flagPostButton);
        }
    }
    debugLog("Toggle flag post:", toggle, confessionId);
}
