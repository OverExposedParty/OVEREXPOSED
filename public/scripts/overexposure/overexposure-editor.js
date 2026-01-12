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

function togglePublishButton() {
    if (titleTextInput.value.trim() !== "" && contentsTextArea.value.trim() !== "") {
        publishButton.classList.remove("disabled");
    } else {
        publishButton.classList.add("disabled");
    }
}

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

exitMenuYes.addEventListener("click", ExitMenuButtonYes);
exitMenuNo.addEventListener("click", ExitMenuButtonNo);