document.addEventListener('DOMContentLoaded', function () {
    const overlay = document.getElementById('overlay');

    let eighteenPlusEnabled = localStorage.getItem('settings-nsfw') === 'true';
    const packButtons = document.querySelectorAll('.packs-container .button-container button');
    const startGameButton = document.querySelector('.start-game-button');
    const warningBox = document.getElementById('warning-box');
    const warningStartButton = document.querySelector('.start-game-warning-button');

    const nsfwButtons = document.querySelectorAll('.pack-nsfw');
    const gameSettingsNsfwButtons = document.querySelectorAll('.game-settings-pack-nsfw');

    const backButton = document.querySelector('.back-button');

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

    const storageObserver = new LocalStorageObserver();

    // Add a listener to observe changes to 'settings-nsfw'
    storageObserver.addListener((key, oldValue, newValue) => {
        if (key === 'settings-nsfw') {
            console.log(`The value of '${key}' changed from '${oldValue}' to '${newValue}'`);
            if (oldValue !== newValue) {
                eighteenPlusEnabled = newValue;
                setNSFWMode();
                console.log(`Value changed! Now NSFW is set to: ${newValue}`);
            }
        }
    });
    
    function setNSFWMode(){
        if (eighteenPlusEnabled) {
            nsfwButtons.forEach(button => {
                button.disabled = false;
                button.classList.remove('disabled');
    
                const key = button.getAttribute('data-key');
                if (!localStorage.getItem(key)) {
                    localStorage.setItem(key, 'false');
                }
                
            });
            gameSettingsNsfwButtons.forEach(button => {
                button.disabled = false;
                button.classList.remove('disabled');
                
                const key = button.getAttribute('data-key');
                if (!localStorage.getItem(key)) {
                    localStorage.setItem(key, 'false');
                }
            });
        }
        else {
            nsfwButtons.forEach(button => {
                button.disabled = true;
                button.classList.add('disabled');
                button.classList.remove('active');
    
                const key = button.getAttribute('data-key');
                localStorage.setItem(key, 'false');
            });
            gameSettingsNsfwButtons.forEach(button => {
                button.disabled = true;
                button.classList.add('disabled');
                button.classList.remove('active');
    
                localStorage.setItem(button.getAttribute('data-key'), 'false');
            });
        }
    }

    setNSFWMode();
    
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

        if (savedState === 'true') {
            button.classList.add('active');
        }
        else if (savedState === 'false') {
            button.classList.remove('active');
        }
        button.addEventListener('click', () => {
            if (!button.disabled) {
                button.classList.toggle('active');
                const isActive = button.classList.contains('active');
                localStorage.setItem(key, isActive ? 'true' : 'false');
                updateStartGameButton();
                if(isActive){
                    playSoundEffect(soundButtonDeselect);
                }
                else{
                    playSoundEffect(soundButtonClicked);
                }
            }
        });
    });

    updateStartGameButton();

    backButton.addEventListener('click', () => {
        transitionSplashScreen('/party-games', "/images/splash-screens/party-games.png")
    });

    startGameButton.addEventListener('click', () => {
        const nsfwPacksActive = Array.from(packButtons).some(button => button.classList.contains('active') && button.classList.contains('pack-nsfw'));

        if (nsfwPacksActive) {
            addElementIfNotExists(elementClassArray, warningBox);
            warningBox.classList.add('active');
            overlay.classList.add('active');
            playSoundEffect(soundContainerOpen);
        } else {
            transitionSplashScreen(startGameButton.id, `/images/splash-screens/${startGameButton.id}.png`);
        }
    });
    warningStartButton.addEventListener('click', () => {
        transitionSplashScreen(startGameButton.id, `/images/splash-screens/${startGameButton.id}.png`);
    });

});

function checkOrientationAndAddButton() {
    const gameSettingsContainer = document.querySelector('.settings-container');
    const startGameButton = document.querySelector('.start-game-button');
    const mainContainer = document.querySelector('.main-container');

    if ((window.innerHeight > window.innerWidth) && document.querySelector('.settings-container .start-game-button')) {
        gameSettingsContainer.querySelector('.button-container').removeChild(startGameButton);
        mainContainer.appendChild(startGameButton);
    }
    else if ((window.innerHeight < window.innerWidth) && !document.querySelector('.settings-container .start-game-button')) {
        gameSettingsContainer.querySelector('.button-container').appendChild(startGameButton);
    }
}

// Call the function when the page loads and when the window resizes
window.addEventListener('load', checkOrientationAndAddButton);
window.addEventListener('resize', checkOrientationAndAddButton);
