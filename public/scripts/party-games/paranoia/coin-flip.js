const coinIcon = document.getElementById('coin');
const tossBtn = document.getElementById('coin-button');

const coinFlipButton = document.getElementById('coin-flip-button');

coinFlipButton.addEventListener('click', toggleCoinFlip);
tossBtn.addEventListener('click', () => {
    tossCoinFunction();
});

function toggleCoinFlip() {
    addElementIfNotExists(elementClassArray, coinFlipContainer);
    if (!coinFlipContainer.classList.contains('active')) {
        coinFlipContainer.classList.add('active');
        coinFlipButton.classList.add('active');
        playSoundEffect('containerOpen');
        if (!overlay.classList.contains('active')) {
            overlay.classList.add('active');
        }
    }
    else {
        coinFlipContainer.classList.remove('active');
        playSoundEffect('containerClose');
        if (findActiveElementsWithClasses(classArray).length == 0) {
            overlay.classList.remove('active');
        }
    }
}
function tossCoinFunction() {
    const randomVal = Math.random();
    const faceCoin = randomVal < 0.5 ? 'Heads' : 'Tails';
    const backgroundContainer = randomVal < 0.5 ? 'var(--backgroundcolour)' : 'var(--primarypagecolour)';
    const imageUrl = faceCoin === 'Heads' ?
        '/images/icons/paranoia/heads-icon.svg' :
        '/images/icons/paranoia/tails-icon.svg';

    coinIcon.classList.add('flip');
    playSoundEffect(soundCoinFlip);
    setTimeout(() => {
        coinIcon.innerHTML =
            `<img src="${imageUrl}" alt="${faceCoin}">`;
    }, 500);

    setTimeout(() => {
        coinFlipContainer.style.backgroundColor = backgroundContainer;
    }, 850);
    setTimeout(() => {
        coinIcon.classList.remove('flip');
    }, 1000);
}

