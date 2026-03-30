const VISIBLE_CONTAINER_CLASS = 'is-visible';

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

function addElementIfNotExists(array, element) {
    if (!element || !element.classList) return;
    if (!array.includes(element)) {
        array.push(element);
    }
}

function removeElementIfExists(array, element) {
    if (!element || !element.classList) return;
    const index = array.indexOf(element);
    if (index !== -1) {
        array.splice(index, 1);
        if (!anyElementExists()) {
            toggleOverlay(false);
        }
    }
}

function elementExists(array, element) {
    return Array.isArray(array) && array.includes(element);
}

function anyElementExists() {
    if (Array.isArray(settingsElementClassArray) && settingsElementClassArray.length > 0) return true;
    if (Array.isArray(elementClassArray) && elementClassArray.length > 0) return true;
    if (Array.isArray(popUpClassArray) && popUpClassArray.length > 0) return true;
    if (Array.isArray(permanantElementClassArray) && permanantElementClassArray.length > 0) return true;
    return false;
}

function removeAllElements(array) {
    array.forEach(element => hideContainer(element));
    array.length = 0;
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
