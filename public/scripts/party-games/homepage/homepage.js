let helpContainerFile = "homepage.json";

const rightArrow = document.querySelector('.arrow-right');
const leftArrow = document.querySelector('.arrow-left');
const cardContainer = document.querySelector('.selected-card-container');
const gamemodeUpdateContainer = document.querySelector('.gamemode-info-container');

let historyStack = [];

let cards;
let currentIndex = 0;
let totalCards;
let cardsUpdateText = {};

const offscreenX = 1000;
const rotateAngle = 20;
const transitionDuration = 1000;


document.addEventListener('DOMContentLoaded', async function () {
    await loadGamemodes();
    initializeCards();
});

async function loadGamemodes() {
    try {
        const response = await fetch('/json-files/other/homepage.json');
        const gamemodes = await response.json();

        const cardsContainer = document.getElementById('cards-container');
        const carouselContainer = document.getElementById('carousel-container');

        const root = document.documentElement;

        gamemodes.forEach(mode => {
            root.style.setProperty(`--${mode.gamemodeID}PrimaryColour`, mode.gamemodePrimaryColour);
            root.style.setProperty(`--${mode.gamemodeID}SecondaryColour`, mode.gamemodeSecondaryColour);

            const card = document.createElement('div');
            card.classList.add('card-flip');
            card.dataset.gamemodeId = mode.gamemodeID;

            card.addEventListener('click', () => {
                if (!card.classList.contains('flipped')) {
                    card.classList.add('flipped');
                    playSoundEffect('cardFlip');
                }
                else {
                    transitionSplashScreen(mode.gamemodeLink, `/images/splash-screens/${mode.gamemodeID}-settings.png`);;
                }
            });

            const cardFront = document.createElement('div');
            cardFront.classList.add('card-front');
            cardFront.alt = `${mode.gamemodeName} Card Front`;

            const cardBack = document.createElement('div');
            cardBack.classList.add('card-back');
            cardBack.alt = `${mode.gamemodeName} Card Back`;

            const frontImg = document.createElement('img');
            frontImg.src = mode.gamemodeCardImageFront;
            frontImg.alt = `${mode.gamemodeName} Card`;
            frontImg.loading = 'eager';

            const backImg = document.createElement('img');
            backImg.src = mode.gamemodeCardImageBack;
            backImg.alt = 'Card Back';
            backImg.loading = 'eager';

            cardFront.appendChild(frontImg);
            cardBack.appendChild(backImg);

            card.appendChild(cardFront);
            card.appendChild(cardBack);

            cardsContainer.appendChild(card);

            const carouselItem = document.createElement('div');
            carouselItem.classList.add('carousel-item');
            carouselItem.id = mode.gamemodeID;

            carouselItem.style.borderColor = `var(--${mode.gamemodeID}PrimaryColour)`;

            carouselItem.addEventListener('click', () => {
                const targetIndex = gamemodes.findIndex(m => m.gamemodeID === mode.gamemodeID);
                goToCard(targetIndex);
            });

            carouselContainer.appendChild(carouselItem);
            cardsUpdateText[mode.gamemodeID] = mode.gamemodeTextUpdates;
        });

    } catch (error) {
        console.error("Error loading gamemodes:", error);
    }
}

function initializeCards() {
    cards = Array.from(cardContainer.querySelectorAll('.card-flip'));
    totalCards = cards.length;
    cards.forEach((card, i) => {
        const z = totalCards - i;
        card.style.zIndex = z;
        card.dataset.originalZ = z;
    });
    SetCarouselActive(cards[0].dataset.gamemodeId);
    gamemodeUpdateContainer.textContent = cardsUpdateText[cards[0].dataset.gamemodeId];
}


function updateCardIndexes() {
    const cardPositions = cards.map((card, i) => {
        const rect = card.getBoundingClientRect();
        return { card, index: i, x: rect.left };
    });

    cardPositions.sort((a, b) => a.x - b.x);

    cardPositions.forEach((item, i) => {
        item.card.style.zIndex = i + 1;
    });
}


async function nextCard() {
    if (currentIndex === cards.length - 1) {
        shakeCard(cards[currentIndex]);
        return;
    }
    goToCard(currentIndex + 1);
}

async function prevCard() {
    if (historyStack.length === 0) {
        shakeCard(cards[currentIndex]);
        return;
    }
    goToCard(currentIndex - 1);
}


function shakeCard(card) {
    card.classList.remove('shake');
    void card.offsetWidth;
    card.classList.add('shake');
    setTimeout(() => {
        card.classList.remove('shake');
        ResetCard(card);
    }, 300);
}

function SetCarouselActive(gamemodeID) {
    const carouselItems = document.querySelectorAll('.carousel-item');
    carouselItems.forEach(item => {
        if (item.id === gamemodeID) {
            item.classList.add('selected');
            item.style.backgroundColor = `var(--${gamemodeID}PrimaryColour)`;
        } else {
            item.classList.remove('selected');
            item.style.backgroundColor = 'var(--backgroundcolour)';
        }
    });
}


async function goToCard(targetIndex) {
    const steps = Math.abs(targetIndex - currentIndex);
    const stepDuration = Math.max(200, transitionDuration / steps);
    if (targetIndex === currentIndex) return;
    if (cards[currentIndex].classList.contains('flipped')) {
        cards[currentIndex].classList.remove('flipped');
        playSoundEffect('cardFlip');
        await delay(800);
    }
    rightArrow.classList.add('disabled');
    leftArrow.classList.add('disabled');
    setTimeout(() => {
        rightArrow.classList.remove('disabled');
        leftArrow.classList.remove('disabled');
        if (targetIndex == currentIndex) {
            document.documentElement.style.setProperty('--primarypagecolour', document.documentElement.style.getPropertyValue('--' + cards[currentIndex].dataset.gamemodeId + 'PrimaryColour'));
            document.documentElement.style.setProperty('--secondarypagecolour', document.documentElement.style.getPropertyValue('--' + cards[currentIndex].dataset.gamemodeId + 'SecondaryColour'));
        }
    }, stepDuration);
    if (targetIndex > currentIndex) {
        for (let i = currentIndex; i < targetIndex; i++) {
            playSoundEffect('splashScreenUp');
            await new Promise(resolve => {
                const currentCard = cards[i];
                const nextCard = cards[i + 1];

                currentCard.style.transition = `transform ${stepDuration / 1000}s ease`;
                currentCard.style.transform = `translateX(-${offscreenX}px) rotateZ(-${rotateAngle}deg)`;

                nextCard.style.transition = `transform ${stepDuration / 1000}s ease`;
                nextCard.style.transform = `translateX(0) rotateZ(0)`;

                historyStack.push(i);

                setTimeout(() => {
                    currentCard.style.zIndex = 0;
                    resolve();
                }, stepDuration / 4);
            });
        }
    }

    else {
        for (let i = currentIndex; i > targetIndex; i--) {
            await new Promise(resolve => {
                const prevCard = cards[i - 1];

                prevCard.style.transition = 'none';
                prevCard.style.transform = `translateX(-${offscreenX}px) rotateZ(-${rotateAngle}deg)`;

                requestAnimationFrame(() => {
                    prevCard.style.transition = `transform ${stepDuration / 1000}s ease`;
                    prevCard.style.transform = `translateX(0) rotateZ(0)`;
                });

                setTimeout(() => {
                    prevCard.style.zIndex = prevCard.dataset.originalZ;
                    resolve();
                }, stepDuration / 4);

                setTimeout(() => {
                    playSoundEffect('splashScreenDown');
                }, stepDuration / 2);
            });
            historyStack.pop();
        }
    }
    if (targetIndex > currentIndex) {
        document.documentElement.style.setProperty('--primarypagecolour', document.documentElement.style.getPropertyValue('--' + cards[targetIndex].dataset.gamemodeId + 'PrimaryColour'));
        document.documentElement.style.setProperty('--secondarypagecolour', document.documentElement.style.getPropertyValue('--' + cards[targetIndex].dataset.gamemodeId + 'SecondaryColour'));
    }
    currentIndex = targetIndex;
    ResetCard(cards[currentIndex]);
    SetCarouselActive(cards[currentIndex].dataset.gamemodeId);
    changeFavicon(cards[currentIndex].dataset.gamemodeId);
    gamemodeUpdateContainer.textContent = cardsUpdateText[cards[currentIndex].dataset.gamemodeId];
}

function ResetCard(card) {
    card.removeAttribute('style');
    card.style.zIndex = card.dataset.originalZ;
}
rightArrow.addEventListener('click', () => {
    if (!rightArrow.classList.contains('disabled')) {
        nextCard();
    }
});

leftArrow.addEventListener('click', () => {
    if (!leftArrow.classList.contains('disabled')) {
        prevCard();
    }
});

function changeFavicon(colour) {
    if (colour === 'truth-or-dare') {
        colour = 'overexposed';
    }
    const sizes = ['16x16', '32x32', '96x96', '180x180'];

    const faviconLinks = document.querySelectorAll('link[rel="icon"]');

    faviconLinks.forEach((favicon, i) => {
        const size = sizes[i % sizes.length];
        favicon.href = `/images/icons/${colour}/favicons/favicon-${size}.png`;

        document.documentElement.style.setProperty('--rotatedeviceicon', `url(/images/icons/${colour}/rotate-phone-icon.svg)`);
        document.documentElement.style.setProperty('--tiktokicon', `url(/images/icons/${colour}/tik-tok-icon.svg)`);
        document.documentElement.style.setProperty('--instagramicon', `url(/images/icons/${colour}/instagram-icon.svg)`);
    });
}

waitForFunction("FetchHelpContainer", () => {
    FetchHelpContainer(helpContainerFile);
});
waitForFunction("loadSound", () => {
    async function LoadHomepageSoundEffects() {
        const soundEffects = {
            cardFlip: '/sounds/homepage/card-flip.wav',
        };

        for (const [key, url] of Object.entries(soundEffects)) {
            await loadSound(key, url);
        }
    }

    (async () => {
        await LoadHomepageSoundEffects();
    })();
});