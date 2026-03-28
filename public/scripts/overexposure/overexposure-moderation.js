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
        enableNSFWContainer.classList.remove('active');
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
        enableNSFWContainer.classList.add('active');
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
        popup.classList.remove('active');
        removeElementIfExists(popUpClassArray, popup);
    });
}

sharePostButton.addEventListener("click", () => {
    const selectedCardId = overexposureContainer.getAttribute('data-selected-card');
    if (!selectedCardId) return;

    if (sharePostContainer.classList.contains('active')) {
        sharePostContainer.classList.remove('active');
        removeElementIfExists(popUpClassArray, sharePostContainer);
        return;
    }

    closeModerationPopups({ except: sharePostContainer });
    sharePostContainer.classList.add('active');
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
    } catch (err) {
        console.error('Failed to copy share URL:', err);
    }
});

deletePostButton.addEventListener("click", () => {
    const selectedCardId = overexposureContainer.getAttribute('data-selected-card');
    if (!selectedCardId) return;

    if (deletePostContainer.classList.contains('active')) {
        deletePostContainer.classList.remove('active');
        removeElementIfExists(popUpClassArray, deletePostContainer);
        return;
    }

    closeModerationPopups({ except: deletePostContainer });
    deletePostContainer.classList.add('active');
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
        const isToggled = flagPostButton.classList.toggle('toggled');
        flagPostButton.setAttribute('aria-pressed', isToggled ? 'true' : 'false');
    }
    console.log("Toggle flag post:", toggle, confessionId);
}
