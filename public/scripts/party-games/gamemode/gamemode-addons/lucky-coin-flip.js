let pickedHeads = false;

const luckyCoinFlipContainer = document.querySelector('#lucky-coin-flip-container');
const coinIcon = document.querySelector('.coin');
const tossBtn = document.querySelector('#coin-button');

tossBtn.addEventListener('click', () => {
    tossCoinFunction();
});

if (placeholderGamemodeAddons?.dataset.online === "false") {
    console.log(coinFlipButton);
    coinFlipButton.addEventListener('click', toggleCoinFlip);
    function toggleCoinFlip() {
        addElementIfNotExists(elementClassArray, luckyCoinFlipContainer);
        if (!luckyCoinFlipContainer.classList.contains('active')) {
            luckyCoinFlipContainer.classList.add('active');
            coinFlipButton.classList.add('active');
            playSoundEffect('containerOpen');
            if (!overlay.classList.contains('active')) {
                toggleOverlay(true);
            }
        } else {
            luckyCoinFlipContainer.classList.remove('active');
            playSoundEffect('containerClose');
            if (findActiveElementsWithClasses(classArray).length == 0) {
                toggleOverlay(false);
            }
        }
    }
}
else {
    gameContainers.push(luckyCoinFlipContainer);
}

async function tossCoinFunction() {
    const randomVal = Math.random();
    const faceCoin = randomVal < 0.5 ? 'Heads' : 'Tails';
    const backgroundContainer = randomVal < 0.5 ? 'var(--backgroundcolour)' : 'var(--primarypagecolour)';
    const imageUrl = faceCoin === 'Heads'
        ? '/images/icons/paranoia/heads-icon.svg'
        : '/images/icons/paranoia/tails-icon.svg';

    coinIcon.classList.add('flip');
    playSoundEffect('coinFlip');

    setTimeout(() => {
        coinIcon.innerHTML = `<img src="${imageUrl}" alt="${faceCoin}">`;
    }, 500);

    setTimeout(() => {
        luckyCoinFlipContainer.style.backgroundColor = backgroundContainer;
    }, 850);

    setTimeout(() => {
        coinIcon.classList.remove('flip');
    }, 1000);

    // online vs offline behaviour
    if (placeholderGamemodeAddons?.dataset.online === "true") {
        const existingData = await getExistingPartyData(partyCode);
        if (!existingData || existingData.length === 0) {
            console.warn('No party data found.');
            return;
        }
        const currentPartyData = existingData[0];

        setTimeout(() => {
            if ((pickedHeads && faceCoin == "Heads") || (!pickedHeads && faceCoin == "Tails")) {
                SendInstruction({
                    instruction: "DISPLAY_DUAL_STACK_CARD",
                    partyData: currentPartyData,
                    updateUsersReady: false,
                    updateUsersConfirmation: false
                });

            } else {
                SendInstruction({
                    instruction: "USER_HAS_PASSED:USER_CALLED_WRONG_FACE:",
                    updateUsersReady: false,
                    updateUsersConfirmation: false
                });
            }
        }, 2500);

    } else {
        // offline mode just ends after showing the coin
        // (no multiplayer logic, no instructions)
    }
}

