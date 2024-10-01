document.addEventListener('DOMContentLoaded', function () {
    const settingsIcon = document.querySelector('.settings-icon');
    const settingsBox = document.querySelector('#settings-box');
    const overlay = document.querySelector('#overlay');
    const header = document.querySelector('#header');

    const rotateMessage = document.querySelector('#landscape-message');
    const rotateIcon = document.querySelector('#rotate-icon');
    const extraMenuContainer = document.querySelector('.extra-menu-container');
    const extraMenuIcon = document.querySelector('.extra-menu-icon');

    settingsIcon.addEventListener('click', toggleSettings);
    overlay.addEventListener('click', toggleOverlay);
    document.addEventListener('click', clickOutsideHandler);

    function toggleSettings() {
        if (!settingsBox.classList.contains('active')) {
            settingsBox.classList.add('active');
            overlay.classList.add('active');
            if (!extraMenuContainer.classList.contains('active')) {
                extraMenuContainer.classList.remove('active');
            }
        } else {

            settingsBox.classList.remove('active');
            if (!extraMenuContainer.classList.contains('active')) {
                overlay.classList.remove('active');
            }

        }
    }
    function togglExtraMenu() {
        if (extraMenuContainer.classList.contains('active')) {
            extraMenuContainer.classList.remove('active');

            if(!settingsBox.classList.contains('active')){
                overlay.classList.remove('active');
            }
        }
        else
        {
            extraMenuContainer.classList.add('active');
            overlay.classList.add('active');
        }
    }

    function toggleOverlay() {
        overlay.classList.toggle('active');
        if (extraMenuContainer.classList.contains('active')) {
            extraMenuContainer.classList.remove('active');
        }
        if (settingsBox.classList.contains('active')) {
            settingsBox.classList.remove('active');
        }
    }

    function clickOutsideHandler(event) {
        if (settingsBox.style.display === 'block' &&
            !settingsBox.contains(event.target) &&
            !settingsIcon.contains(event.target) &&
            !overlay.contains(event.target)) {
            settingsBox.style.display = 'none';
            overlay.classList.remove('active');
        }
    }
});
