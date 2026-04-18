document.addEventListener('click', (event) => {
    const drawerButton = event.target.closest('.error-box .drawer-button');
    if (!drawerButton) return;

    const errorBox = drawerButton.closest('.error-box');
    if (!errorBox) return;

    errorBox.classList.toggle('hidden');
    drawerButton.textContent = "<";
});

document.addEventListener('mouseover', (event) => {
    const drawerButton = event.target.closest('.error-box .drawer-button');
    if (!drawerButton) return;

    const errorBox = drawerButton.closest('.error-box');
    if (!errorBox || errorBox.classList.contains('hidden')) return;

    drawerButton.textContent = ">";
});

document.addEventListener('mouseout', (event) => {
    const drawerButton = event.target.closest('.error-box .drawer-button');
    if (!drawerButton) return;

    const errorBox = drawerButton.closest('.error-box');
    if (!errorBox || errorBox.classList.contains('hidden')) return;

    drawerButton.textContent = "<";
});

function CheckErrors() {
    const errorBoxes = document.querySelectorAll('.error-container .error-box');
    return !Array.from(errorBoxes).some(box => isContainerVisible(box));
}
