const overlay = document.createElement('div');
overlay.classList.add('overlay');
overlay.id = 'overlay';
const overlayText = document.createElement('p');
overlayText.className = 'overlay-text';
overlayText.textContent = 'Tap empty area to close';
overlay.appendChild(overlayText);
document.body.appendChild(overlay);

function syncHeaderIconActiveStates() {
    if (headerExtraMenuButton && extraMenuContainer) {
        headerExtraMenuButton.classList.toggle('active', isContainerVisible(extraMenuContainer));
    }
    if (headerSettingsButton && settingsBox) {
        headerSettingsButton.classList.toggle('active', isContainerVisible(settingsBox));
    }
    if (headerHelpButton && typeof helpContainer !== 'undefined' && helpContainer) {
        headerHelpButton.classList.toggle('active', isContainerVisible(helpContainer));
    }
    if (
        typeof userCustomisationIconButton !== 'undefined' && userCustomisationIconButton &&
        typeof userCustomisationContainer !== 'undefined' && userCustomisationContainer
    ) {
        userCustomisationIconButton.classList.toggle('active', isContainerVisible(userCustomisationContainer));
    }
}

function syncTransientContainerToggleStates() {
    if (typeof window.syncPartyQrCodeButtonState === 'function') {
        window.syncPartyQrCodeButtonState();
    }
}

function toggleClass(selectedClass, classArray) {
    const isVisible = toggleContainerVisibility(selectedClass, !isContainerVisible(selectedClass));
    if (isVisible) {
        if (classArray == settingsElementClassArray) {
            removeAllElements(classArray);
        }
        addElementIfNotExists(classArray, selectedClass);
        playSoundEffect('containerOpen');
    }
    else {
        removeElementIfExists(classArray, selectedClass);
        playSoundEffect('containerClose');
    }

    if (elementClassArray.length == 0 && settingsElementClassArray.length == 0 && permanantElementClassArray.length == 0 && popUpClassArray.length == 0) {
        toggleOverlay(false);
    }
    else {
        if (!isContainerVisible(overlay)) {
            toggleOverlay(true);
        }
    }

    syncHeaderIconActiveStates();
    syncTransientContainerToggleStates();
}

function toggleExtraMenu() {
    toggleClass(extraMenuContainer, settingsElementClassArray);
}
function toggleSettings() {
    toggleClass(settingsBox, settingsElementClassArray);
}
function toggleHelp() {
    toggleClass(helpContainer, settingsElementClassArray);
}

function toggleOverlay(bool) {
    if (bool === true) {
        showContainer(overlay);
        if (backButton) {
            backButton.classList.add('inactive');
        }
        syncHeaderIconActiveStates();
    }
    else {
        if (popUpClassArray.length > 0) {
            removeAllElements(popUpClassArray);
            if (settingsElementClassArray.length === 0 && elementClassArray.length === 0 && popUpClassArray.length === 0 && permanantElementClassArray.length === 0) {
                toggleOverlay(false);
            }
            syncHeaderIconActiveStates();
        }
        else if (settingsElementClassArray.length > 0) {
            removeAllElements(settingsElementClassArray)
            if (settingsElementClassArray.length === 0 && elementClassArray.length === 0 && popUpClassArray.length === 0 && permanantElementClassArray.length === 0) {
                toggleOverlay(false);
            }
            syncHeaderIconActiveStates();
        }
        else {
            if (typeof ToggleOverexposureContainer === "function") {
                if (isContainerVisible(overexposureContainer)) {
                    ToggleOverexposureContainer({ toggle: false });
                    playSoundEffect('containerClose');
                }
                else {
                    if (permanantElementClassArray.length === 0) {
                        hideContainer(overlay);
                        playSoundEffect('containerClose');
                    }
                }
            }
            else {
                if (permanantElementClassArray.length === 0) {
                    hideContainer(overlay);
                    playSoundEffect('containerClose');
                }
            }

            removeAllElements(settingsElementClassArray);
            removeAllElements(elementClassArray);

            document.querySelectorAll('.floating-button').forEach(el => {
                el.classList.remove('touchhover');
            });

            if (backButton) {
                backButton.classList.remove('inactive');
            }
            document.querySelectorAll('.side-buttons .side-button').forEach(sideButton => {
                sideButton.classList.remove('active');
            });

            syncHeaderIconActiveStates();
            syncTransientContainerToggleStates();
        }
    }
}

function setActiveClass(selectedElements, keepActive) {
    selectedElements.forEach(element => {
        if (element !== keepActive) {
            element.classList.remove('active');
        }
    });
}
