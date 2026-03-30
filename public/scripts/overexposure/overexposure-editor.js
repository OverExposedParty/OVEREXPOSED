function setOverexposureContainerToEditor(isActive) {
    if (isActive) {
        hideContainer(contentsContainerText);
        hideContainer(titleTextContainer);
        showContainer(titleTextEditor);
        showContainer(contentsTextEditor);
    } else {
        showContainer(contentsContainerText);
        showContainer(titleTextContainer);
        hideContainer(titleTextEditor);
        hideContainer(contentsTextEditor);
    }
}

function isOverexposureEditorActive() {
    return isContainerVisible(titleTextEditor) && isContainerVisible(contentsTextEditor);
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
        showContainer(overexposureContainer);
    }
    else if (toggle == false && permanantElementClassArray.includes(overexposureContainer) == false) {
        hideContainer(overexposureContainer);
        if (permanantElementClassArray.length == 0) {
            hideContainer(overlay);
        }
        playSoundEffect('containerClose');
    }
    if (isContainerVisible(overexposureContainer) && toggle == true) {
        if (!button) return;
        const dataId = button.getAttribute("data-id");
        const cardSlug = buildOverexposureCardSlug(
            button.getAttribute("data-x") ?? button.style.left,
            button.getAttribute("data-y") ?? button.style.top
        );
        const nextPathSegment = cardSlug || dataId;
        const nextPath = `/overexposure/${nextPathSegment}`;
        const postTitle = button.getAttribute("data-title");
        const postText = button.getAttribute("data-text");

        history.pushState(null, "", nextPath);

        titleText.textContent = postTitle;
        contentsContainerText.innerHTML = postText;
        populateSharePostDetails({
            title: postTitle,
            text: postText,
            path: nextPath
        });

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
            showContainer(exitMenuContainer);
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
    hideContainer(exitMenuContainer);
    removeElementIfExists(popUpClassArray, exitMenuContainer)
    removeElementIfExists(permanantElementClassArray, overexposureContainer);
    publishButton.classList.add("disabled");
    ToggleOverexposureContainer({ toggle: false });
}

function ExitMenuButtonNo() {
    hideContainer(exitMenuContainer);
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
    const contentNameCheck = detectName(contentsTextArea.value);
    const titleNameCheck = detectName(titleTextInput.value);

    if (contentNameCheck.hasName || titleNameCheck.hasName) {
        console.warn("[Overexposure] Post blocked by name filter", {
            title: {
                text: titleTextInput.value,
                matches: titleNameCheck.name || []
            },
            content: {
                text: contentsTextArea.value,
                matches: contentNameCheck.name || []
            }
        });
        playSoundEffect('postIncomplete');
        showContainer(postIncompleteContainer);
        addElementIfNotExists(popUpClassArray, postIncompleteContainer);
        playSoundEffect('containerClose');
    }
    else {
        showContainer(areYouSurePostContainer);
        addElementIfNotExists(popUpClassArray, areYouSurePostContainer);
    }
});
submitPostYes.addEventListener("click", async () => {
    hideContainer(areYouSurePostContainer);
    removeElementIfExists(popUpClassArray, areYouSurePostContainer)
    const draftButtons = document.querySelectorAll(".floating-button.draft");
    if (draftButtons.length > 0) {
        showContainer(uploadingPostContainer);
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
            showContainer(rememberCodeContainer);
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
        hideContainer(uploadingPostContainer);
        addElementIfNotExists(popUpClassArray, uploadingPostContainer);
    }
});

submitPostNo.addEventListener("click", async () => {
    hideContainer(areYouSurePostContainer);
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
