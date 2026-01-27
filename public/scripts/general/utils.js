function addElementIfNotExists(array, element) {
    if (!array.includes(element)) {
        array.push(element);
    }
}

function removeElementIfExists(array, element) {
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
    array.forEach(element => element.classList.remove("active"));
    array.length = 0;
}

function findActiveElementsWithClasses(classArray) {
    const allElements = document.body.querySelectorAll('*');
    const elementsWithClasses = Array.from(allElements).filter(element =>
        classArray.some(className => element.classList.contains(className))
    );

    const activeElements = elementsWithClasses.filter(element =>
        element.classList.contains('active')
    );

    return activeElements;
}

function removeActiveClassFromParent(childElement) {
    if (!childElement || !(childElement instanceof HTMLElement)) {
        console.error('Invalid element provided.');
        return;
    }

    const parentElement = childElement.parentElement;
    if (parentElement && parentElement.classList.contains('active')) {
        parentElement.classList.remove('active');
    }
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function updateVh() {
    let vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty('--vh', `${vh}px`);
}