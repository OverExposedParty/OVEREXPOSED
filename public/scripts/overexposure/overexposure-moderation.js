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