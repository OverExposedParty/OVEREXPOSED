const VISIBLE_CONTAINER_CLASS = 'is-visible';
const DEFAULT_CONTAINER_TRANSITION_SOUNDS = Object.freeze({
    open: 'containerOpen',
    close: 'containerClose'
});

function showContainer(element) {
    if (!element || !element.classList) return;
    element.classList.add(VISIBLE_CONTAINER_CLASS);
}

function hideContainer(element) {
    if (!element || !element.classList) return;
    element.classList.remove(VISIBLE_CONTAINER_CLASS);
}

function toggleContainerVisibility(element, force) {
    if (!element || !element.classList) return false;
    element.classList.toggle(VISIBLE_CONTAINER_CLASS, force);
    return element.classList.contains(VISIBLE_CONTAINER_CLASS);
}

function isContainerVisible(element) {
    return !!(element && element.classList && element.classList.contains(VISIBLE_CONTAINER_CLASS));
}

function isElementClosePrevented(element) {
    return element?.dataset?.preventContainerClose === 'true';
}

function getClosePreventedElement(array) {
    if (!Array.isArray(array)) return null;
    return array.find((element) => isElementClosePrevented(element)) || null;
}

function getManagedContainerArrays() {
    return [
        typeof popUpClassArray !== 'undefined' ? popUpClassArray : null,
        typeof settingsElementClassArray !== 'undefined' ? settingsElementClassArray : null,
        typeof elementClassArray !== 'undefined' ? elementClassArray : null,
        typeof permanantElementClassArray !== 'undefined' ? permanantElementClassArray : null
    ].filter((array, index, arrays) =>
        Array.isArray(array) && arrays.indexOf(array) === index
    );
}

function getActiveManagedContainer() {
    if (typeof getActiveOverlayEntry === 'function') {
        return getActiveOverlayEntry()?.element || null;
    }

    return getManagedContainerArrays()
        .flatMap((array) => array)
        .filter((element, index, elements) =>
            element?.classList &&
            element.isConnected !== false &&
            elements.indexOf(element) === index
        )
        .sort((left, right) =>
            Number(right.dataset.overlayStackOrder || 0) -
            Number(left.dataset.overlayStackOrder || 0)
        )[0] || null;
}

function isManagedContainer(element) {
    return getManagedContainerArrays().some((array) => array.includes(element));
}

function getContainerTransitionSound(element, transition, options = {}) {
    if (!element || options.sound === false) return null;

    const isOpening = transition === 'open';
    const optionKey = isOpening ? 'openSound' : 'closeSound';
    const datasetKey = isOpening ? 'containerOpenSound' : 'containerCloseSound';
    const configuredSound = options[optionKey] ?? element.dataset?.[datasetKey];

    if (
        typeof configuredSound === 'string' &&
        configuredSound.trim().toLowerCase() === 'none'
    ) {
        return null;
    }

    return configuredSound || DEFAULT_CONTAINER_TRANSITION_SOUNDS[transition];
}

function playContainerTransitionSound(element, transition, options = {}) {
    const soundKey = getContainerTransitionSound(element, transition, options);
    if (!soundKey || typeof playSoundEffect !== 'function') return false;

    playSoundEffect(soundKey);
    return true;
}

function addElementIfNotExists(array, element, options = {}) {
    if (!Array.isArray(array) || !element || !element.classList) return false;

    const activeBefore = getActiveManagedContainer();
    if (!array.includes(element)) {
        array.push(element);
    }
    window.oeOverlayStackOrder = Number(window.oeOverlayStackOrder || 0) + 1;
    element.dataset.overlayStackOrder = String(window.oeOverlayStackOrder);

    if (typeof syncOverlayStack === 'function') syncOverlayStack();
    const activeAfter = getActiveManagedContainer();
    if (activeBefore !== element && activeAfter === element) {
        playContainerTransitionSound(element, 'open', options);
    }
    return true;
}

function removeElementIfExists(array, element, options = {}) {
    if (!Array.isArray(array) || !element || !element.classList) return false;
    if (isElementClosePrevented(element)) return false;

    const index = array.indexOf(element);
    if (index === -1) return false;

    const activeBefore = getActiveManagedContainer();
    array.splice(index, 1);
    if (typeof syncOverlayStack === 'function') syncOverlayStack();
    if (activeBefore === element && !isManagedContainer(element)) {
        playContainerTransitionSound(element, 'close', options);
    }
    return true;
}

function elementExists(array, element) {
    return Array.isArray(array) && array.includes(element);
}

function closeContainerElement(element) {
    hideContainer(element);
    if (element?.dataset?.removeOnContainerClose === 'true') {
        element.remove();
    }
}

function removeTopElement(array, options = {}) {
    if (!Array.isArray(array)) return false;

    const activeBefore = getActiveManagedContainer();
    const element = array
        .filter((candidate) => !isElementClosePrevented(candidate))
        .sort((left, right) =>
            Number(right.dataset.overlayStackOrder || 0) -
            Number(left.dataset.overlayStackOrder || 0)
        )[0];
    if (!element) return false;

    closeContainerElement(element);
    array.splice(array.indexOf(element), 1);
    if (typeof syncOverlayStack === 'function') syncOverlayStack();
    if (activeBefore === element && !isManagedContainer(element)) {
        playContainerTransitionSound(element, 'close', options);
    }
    return true;
}

function anyElementExists() {
    if (Array.isArray(settingsElementClassArray) && settingsElementClassArray.length > 0) return true;
    if (Array.isArray(elementClassArray) && elementClassArray.length > 0) return true;
    if (Array.isArray(popUpClassArray) && popUpClassArray.length > 0) return true;
    if (Array.isArray(permanantElementClassArray) && permanantElementClassArray.length > 0) return true;
    return false;
}

function removeAllElements(array, options = {}) {
    if (!Array.isArray(array)) return false;

    const activeBefore = getActiveManagedContainer();
    const remainingElements = [];
    let removedAny = false;

    array.forEach((element) => {
        if (isElementClosePrevented(element)) {
            remainingElements.push(element);
            return;
        }

        closeContainerElement(element);
        removedAny = true;
    });

    array.length = 0;
    array.push(...remainingElements);
    if (typeof syncOverlayStack === 'function') syncOverlayStack();
    if (
        removedAny &&
        activeBefore &&
        !isManagedContainer(activeBefore)
    ) {
        playContainerTransitionSound(activeBefore, 'close', options);
    }
    return removedAny;
}

function findActiveElementsWithClasses(classArray) {
    const allElements = document.body.querySelectorAll('*');
    const elementsWithClasses = Array.from(allElements).filter(element =>
        classArray.some(className => element.classList.contains(className))
    );

    const activeElements = elementsWithClasses.filter(element =>
        isContainerVisible(element)
    );

    return activeElements;
}

function removeActiveClassFromParent(childElement) {
    if (!childElement || !(childElement instanceof HTMLElement)) {
        console.error('Invalid element provided.');
        return;
    }

    const parentElement = childElement.parentElement;
    if (parentElement && isContainerVisible(parentElement)) {
        hideContainer(parentElement);
    }
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function copyTextToClipboard(text) {
    if (typeof text !== 'string' || text.length === 0) {
        return false;
    }

    if (window.isSecureContext && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
    }

    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.setAttribute('readonly', '');
    textArea.style.position = 'fixed';
    textArea.style.top = '-9999px';
    textArea.style.left = '-9999px';

    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    try {
        return document.execCommand('copy');
    } finally {
        document.body.removeChild(textArea);
    }
}

function flashButtonHoverState(button, {
    duration = 0,
    fadeDuration = 500,
    className = 'touchhover',
    transitionClassName = null,
    touchOnly = true
} = {}) {
    if (!(button instanceof HTMLElement)) return;
    if (touchOnly && !window.matchMedia('(hover: none), (pointer: coarse)').matches) {
        return;
    }

    const existingTimeout = Number(button.dataset.hoverFlashTimeoutId);
    if (existingTimeout) {
        clearTimeout(existingTimeout);
    }

    button.classList.add(className);
    const timeoutId = window.setTimeout(() => {
        if (transitionClassName) {
            button.classList.add(transitionClassName);
        }
        button.classList.remove(className);
        window.setTimeout(() => {
            if (transitionClassName) {
                button.classList.remove(transitionClassName);
            }
            delete button.dataset.hoverFlashTimeoutId;
        }, fadeDuration);
    }, duration);

    button.dataset.hoverFlashTimeoutId = String(timeoutId);
}

function updateVh() {
    let vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty('--vh', `${vh}px`);
}
