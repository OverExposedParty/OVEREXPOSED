const overlay = document.createElement('div');
overlay.classList.add('overlay');
overlay.id = 'overlay';
overlay.innerHTML = '<p class="overlay-text">Tap empty area to close</p>';
document.body.appendChild(overlay);

function syncHeaderIconActiveStates() {
    if (headerExtraMenuButton && extraMenuContainer) {
        headerExtraMenuButton.classList.toggle('active', extraMenuContainer.classList.contains('active'));
    }
    if (headerSettingsButton && settingsBox) {
        headerSettingsButton.classList.toggle('active', settingsBox.classList.contains('active'));
    }
    if (headerHelpButton && typeof helpContainer !== 'undefined' && helpContainer) {
        headerHelpButton.classList.toggle('active', helpContainer.classList.contains('active'));
    }
    if (
        typeof userCustomisationIconButton !== 'undefined' && userCustomisationIconButton &&
        typeof userCustomisationContainer !== 'undefined' && userCustomisationContainer
    ) {
        userCustomisationIconButton.classList.toggle('active', userCustomisationContainer.classList.contains('active'));
    }
}

function toggleClass(selectedClass, classArray) {
    selectedClass.classList.toggle('active');
    if (selectedClass.classList.contains('active')) {
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
        if (!(overlay.classList.contains('active'))) {
            toggleOverlay(true);
        }
    }

    syncHeaderIconActiveStates();
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
        overlay.classList.add('active');
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
                if (overexposureContainer.classList.contains('active')) {
                    ToggleOverexposureContainer({ toggle: false });
                    playSoundEffect('containerClose');
                }
                else {
                    if (permanantElementClassArray.length === 0) {
                        overlay.classList.remove('active');
                        playSoundEffect('containerClose');
                    }
                }
            }
            else {
                if (permanantElementClassArray.length === 0) {
                    overlay.classList.remove('active');
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
