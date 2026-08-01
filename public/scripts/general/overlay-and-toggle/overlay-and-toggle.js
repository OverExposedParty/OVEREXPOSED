// This script is shared by most pages. Reuse the backdrop if the loader asks
// for the script more than once instead of leaving duplicate #overlay nodes.
var overlay = document.getElementById('overlay');
if (!overlay) {
    overlay = document.createElement('div');
    overlay.classList.add('overlay');
    overlay.id = 'overlay';
    document.body.appendChild(overlay);
}

document.querySelectorAll('#overlay').forEach((element) => {
    if (element !== overlay) element.remove();
});

var overlayText = overlay.querySelector('.overlay-text');
if (!overlayText) {
    overlayText = document.createElement('p');
    overlayText.className = 'overlay-text';
    overlayText.textContent = 'Tap empty area to close';
    overlay.appendChild(overlayText);
}

function getOverlayStackGroups() {
    return [
        { elements: popUpClassArray, dismissible: true },
        { elements: settingsElementClassArray, dismissible: true },
        { elements: elementClassArray, dismissible: true },
        { elements: permanantElementClassArray, dismissible: false }
    ];
}

function getActiveOverlayEntry() {
    return getOverlayStackGroups()
        .flatMap((group) =>
            group.elements
                .filter((element) => element?.isConnected !== false && element?.classList)
                .map((element, index) => ({
                    element,
                    dismissible: group.dismissible && !isElementClosePrevented(element),
                    order: Number(element.dataset.overlayStackOrder || 0),
                    index
                }))
        )
        .sort((a, b) => b.order - a.order || b.index - a.index)[0] || null;
}

function syncOverlayStack() {
    const activeEntry = getActiveOverlayEntry();
    const managedElements = new Set(
        getOverlayStackGroups().flatMap((group) => group.elements)
    );

    managedElements.forEach((element) => {
        toggleContainerVisibility(element, element === activeEntry?.element);
    });

    overlayText.hidden = !activeEntry?.dismissible;
    overlay.dataset.dismissible = activeEntry?.dismissible ? 'true' : 'false';

    if (activeEntry) {
        showContainer(overlay);
        if (backButton) backButton.classList.add('inactive');
    } else {
        hideContainer(overlay);
        if (backButton) backButton.classList.remove('inactive');
    }

    syncHeaderIconActiveStates();
    syncTransientContainerToggleStates();
    return activeEntry;
}

function syncHeaderIconActiveStates() {
    if (headerExtraMenuButton && extraMenuContainer) {
        headerExtraMenuButton.classList.toggle('active', isContainerVisible(extraMenuContainer));
    }
    if (headerSettingsButton) {
        headerSettingsButton.classList.toggle(
            'active',
            (settingsBox && isContainerVisible(settingsBox)) ||
            (
                typeof accountExpandedAction !== 'undefined' &&
                accountContainer &&
                isContainerVisible(accountContainer) &&
                accountExpandedAction === 'settings'
            )
        );
    }
    if (headerHelpButton && helpHub) {
        headerHelpButton.classList.toggle('active', isContainerVisible(helpHub));
    }
    if (typeof accountIconButton !== 'undefined' && accountIconButton && accountContainer) {
        accountIconButton.classList.toggle('active', isContainerVisible(accountContainer));
    }
}

function syncTransientContainerToggleStates() {
    if (typeof window.syncPartyQrCodeButtonState === 'function') {
        window.syncPartyQrCodeButtonState();
    }
}

function toggleClass(selectedClass, classArray) {
    const closePreventedElement = getClosePreventedElement(classArray);
    if (
        closePreventedElement &&
        closePreventedElement !== selectedClass &&
        isContainerVisible(closePreventedElement)
    ) {
        toggleOverlay(true);
        syncHeaderIconActiveStates();
        return;
    }

    if (closePreventedElement === selectedClass && isContainerVisible(selectedClass)) {
        toggleOverlay(true);
        syncHeaderIconActiveStates();
        return;
    }

    const isVisible = toggleContainerVisibility(selectedClass, !isContainerVisible(selectedClass));
    if (isVisible) {
        if (classArray == settingsElementClassArray) {
            removeAllElements(classArray, { sound: false });
        }
        addElementIfNotExists(classArray, selectedClass);
    }
    else {
        removeElementIfExists(classArray, selectedClass);
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
    if (typeof window.openAccountSettingsPanel === 'function') {
        const accountSettingsIsOpen =
            accountContainer &&
            isContainerVisible(accountContainer) &&
            typeof accountExpandedAction !== 'undefined' &&
            accountExpandedAction === 'settings';

        if (accountSettingsIsOpen) {
            closeAccountContainer();
        }
        else {
            window.openAccountSettingsPanel();
        }

        return;
    }

    if (!settingsBox && typeof toggleAccount === 'function') {
        toggleAccount();
        return;
    }

    if (!settingsBox) return;

    toggleClass(settingsBox, settingsElementClassArray);
}
function toggleHelpHub() {
    if (typeof renderHelpHub === 'function') {
        renderHelpHub();
    }
    toggleClass(helpHub, settingsElementClassArray);
}
function toggleAccount() {
    toggleClass(accountContainer, settingsElementClassArray);
    if (
        isContainerVisible(accountContainer) &&
        typeof window.refreshAccountPreview === 'function'
    ) {
        window.refreshAccountPreview();
    }
}

function toggleOverlay(bool) {
    if (bool === true) {
        syncOverlayStack();
        return;
    }

    const activeEntry = getActiveOverlayEntry();
    if (!activeEntry?.dismissible) {
        syncOverlayStack();
        return;
    }

    if (popUpClassArray.includes(activeEntry.element)) {
        removeTopElement(popUpClassArray);
    } else if (settingsElementClassArray.includes(activeEntry.element)) {
        removeTopElement(settingsElementClassArray);
    } else if (
        typeof ToggleOverexposureContainer === 'function' &&
        typeof overexposureContainer !== 'undefined' &&
        activeEntry.element === overexposureContainer
    ) {
        ToggleOverexposureContainer({ toggle: false });
    } else {
        removeTopElement(elementClassArray);
    }

    document.querySelectorAll('.floating-button').forEach(el => {
        el.classList.remove('touchhover');
    });
    document.querySelectorAll('.side-buttons .side-button').forEach(sideButton => {
        sideButton.classList.remove('active');
    });

    syncOverlayStack();
}

function setActiveClass(selectedElements, keepActive) {
    selectedElements.forEach(element => {
        if (element !== keepActive) {
            element.classList.remove('active');
        }
    });
}
