document.addEventListener('DOMContentLoaded', function () {
const overlay = document.getElementById('overlay');

const eighteenPlusEnabled = localStorage.getItem('settings-nsfw') === 'true';
const packButtons = document.querySelectorAll('.packs-container .button-container button');
const startGameButton = document.querySelector('.start-game-button');
const warningBox = document.getElementById('warning-box');
const warningStartButton = document.querySelector('.start-game-warning-button');

const nsfwButtons = document.querySelectorAll('.pack-nsfw');
const gameSettingsNsfwButtons = document.querySelectorAll('.game-settings-pack-nsfw');

const homeButton = document.querySelector('.home-button');

const packsContainer = document.querySelector('.packs-container');
const gameSettingsContainer = document.querySelector('.settings-container');

const packsSettingsContainerButton = document.getElementById('packs-settings')
const gameSettingsContainerButton = document.getElementById('game-settings')

const settingsButtons = document.querySelectorAll('.game-settings-button-container');

function updateStartGameButton() {
    const anyActive = Array.from(packButtons).some(button => button.classList.contains('active'));
    startGameButton.classList.toggle('disabled', !anyActive);
    startGameButton.style.pointerEvents = anyActive ? 'auto' : 'none';
}

if (!eighteenPlusEnabled) {
    nsfwButtons.forEach(button => {
        button.disabled = true;
        button.classList.add('disabled');

        const key = button.getAttribute('data-key');
        localStorage.setItem(key, 'false');
    });
    gameSettingsNsfwButtons.forEach(button => {
        button.disabled = true;
        button.classList.add('disabled');

        localStorage.setItem(button.getAttribute('data-key'), 'false');
    });

}

packsSettingsContainerButton.addEventListener('click', () => {
    if (!(packsSettingsContainerButton.classList.contains('active'))) {
        console.log('button pressed');
        packsSettingsContainerButton.classList.add('active');
        packsContainer.classList.add('active');
        gameSettingsContainer.classList.remove('active');
        document.getElementById('game-settings').classList.remove('active');
    }
});
gameSettingsContainerButton.addEventListener('click', () => {
    if (!(gameSettingsContainerButton.classList.contains('active'))) {
        console.log('button pressed');
        gameSettingsContainerButton.classList.add('active');
        gameSettingsContainer.classList.add('active');
        packsContainer.classList.remove('active');
        document.getElementById('packs-settings').classList.remove('active');
    }
});



document.querySelectorAll('button:not(.settings-button):not(.start-game-button)').forEach(button => {
    const key = button.getAttribute('data-key');
    const savedState = localStorage.getItem(key);

    const primaryColor = button.getAttribute('data-primary-color');
    const secondaryColor = button.getAttribute('data-secondary-color');

    if (savedState === 'true') {
        button.classList.add('active');

        if (primaryColor !== null) {
            button.style.backgroundColor = primaryColor;
            button.style.color = 'var(--backgroundcolour)';
            button.style.borderColor = primaryColor;
        }
    }
    else if (savedState === 'false') {
        button.classList.remove('active');

        if (primaryColor !== null) {
            button.style.backgroundColor = 'var(--backgroundcolour)';
            button.style.color = '#999999';
            button.style.borderColor = 'var(--backgroundcolour)';
        }
    }
    if (button.disabled) {
        button.style.backgroundColor = '#333333';
        button.style.color = '#666666';
        button.style.borderColor = '#333333';
    }

    button.addEventListener('click', () => {
        if (!button.disabled) {
            button.classList.toggle('active');
            const isActive = button.classList.contains('active');
            localStorage.setItem(key, isActive ? 'true' : 'false');
            if (button.classList.contains('active')) {
                button.style.backgroundColor = primaryColor;
                button.style.color = 'var(--backgroundcolour)';
                button.style.borderColor = primaryColor;
            } else {
                button.style.backgroundColor = 'var(--backgroundcolour)';
                button.style.color = '#999999';
                button.style.borderColor = 'var(--backgroundcolour)';
            }
            updateStartGameButton();
        }
    });

    button.addEventListener('mouseenter', () => {
        if (!button.disabled && primaryColor !== null) {
            button.style.backgroundColor = secondaryColor;
            button.style.borderColor = secondaryColor;
            updateStartGameButton();
        }
    });

    button.addEventListener('mouseleave', () => {
        if (!button.disabled && primaryColor !== null) {
            if (button.classList.contains('active')) {
                button.style.backgroundColor = primaryColor;
                button.style.color = 'var(--backgroundcolour)';
                button.style.borderColor = primaryColor;
            } else {
                button.style.backgroundColor = 'var(--backgroundcolour)';
                button.style.color = '#999999';
                button.style.borderColor = 'var(--backgroundcolour)';
            }
        }
    });
});

updateStartGameButton();

homeButton.addEventListener('click', () => {
    window.location.href = '/';
});

startGameButton.addEventListener('click', () => {
    const nsfwPacksActive = Array.from(packButtons).some(button => button.classList.contains('active') && button.classList.contains('pack-nsfw'));

    if (nsfwPacksActive) {
        addElementIfNotExists(elementClassArray, warningBox);
        warningBox.classList.add('active');
        overlay.classList.add('active');
    } else {
        window.location.href = startGameButton.id;
    }
});


});

function checkOrientationAndAddButton() {
    const gameSettingsContainer = document.querySelector('.settings-container');
    const startGameButton = document.querySelector('.start-game-button');

    if ((window.innerHeight > window.innerWidth) && (gameSettingsContainer.contains(startGameButton))) {
        gameSettingsContainer.removeChild(startGameButton);
        document.querySelector('.main-container').appendChild(startGameButton);
    }
    else if ((window.innerHeight < window.innerWidth) && (!gameSettingsContainer.contains(startGameButton))) {
        gameSettingsContainer.appendChild(startGameButton);
    }
}

window.addEventListener('resize', checkOrientationAndAddButton);