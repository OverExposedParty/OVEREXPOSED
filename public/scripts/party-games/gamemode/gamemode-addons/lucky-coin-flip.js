let pickedHeads = false;
let coinFlipInProgress = false;

const headsCoinSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 485 485" role="img" aria-label="Heads">
  <circle cx="242.5" cy="242.5" r="225" fill="var(--backgroundcolour)" stroke="var(--primarypagecolour)" stroke-miterlimit="10" stroke-width="35"/>
  <g fill="var(--primarypagecolour)">
    <path d="M150.62,211.05v62.97h-16.68v-23.71h-18.71v23.71h-16.72v-62.97h16.72v23.63h18.71v-23.63h16.68Z"/>
    <path d="M178.09,226.6v8.79h20v13.95h-20v9.02h24.3v15.66h-40.82v-62.97h40.82v15.55h-24.3Z"/>
    <path d="M252.03,266.68h-23.52l-3.2,7.34h-18.28l29.26-63.75h7.93l29.3,63.75h-18.32l-3.16-7.34ZM246.72,254.45l-6.45-14.92-6.48,14.92h12.93Z"/>
    <path d="M334.84,242.62c0,19.53-13.09,31.41-34.49,31.41h-20.55v-62.93l20.55-.04c21.41-.08,34.49,11.88,34.49,31.56ZM318.09,242.58c0-9.88-6.88-15.9-18.16-15.9h-3.83v31.6h3.98c11.17,0,18.01-5.94,18.01-15.7Z"/>
    <path d="M339.77,263.36l10.12-9.92c2.62,3.87,7.5,6.21,12.77,6.21,3.55,0,7.03-1.29,7.03-3.87,0-3.24-6.45-6.09-12.62-8.83-7.97-3.44-14.8-8.67-14.8-18.16,0-10.9,10.35-18.67,22.3-18.67,9.61,0,17.11,4.53,19.57,10.74l-9.65,9.3c-1.88-3.32-6.72-4.77-9.73-4.77-3.44,0-5.9,1.76-5.9,3.91,0,2.89,4.45,3.83,11.25,6.68,9.84,4.14,16.37,10.16,16.37,19.45,0,11.99-11.17,19.45-23.79,19.45-10.35,0-19.77-4.57-22.93-11.52Z"/>
  </g>
</svg>`;

const tailsCoinSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 485 485" role="img" aria-label="Tails">
  <circle cx="242.5" cy="242.5" r="225" fill="var(--primarypagecolour)" stroke="var(--backgroundcolour)" stroke-miterlimit="10" stroke-width="35"/>
  <g fill="#010101">
    <path d="M172.75,226.68h-15.08v47.34h-16.76v-47.34h-15.12v-15.62h46.95v15.62Z"/>
    <path d="M212.4,266.68h-23.52l-3.2,7.34h-18.28l29.26-63.75h7.93l29.3,63.75h-18.32l-3.16-7.34ZM207.09,254.45l-6.45-14.92-6.48,14.92h12.93Z"/>
    <path d="M240.18,211.05h16.72v62.97h-16.72v-62.97Z"/>
    <path d="M308.65,258.32v15.7h-40.82v-62.97h16.72v47.27h24.1Z"/>
    <path d="M312.48,263.36l10.12-9.92c2.62,3.87,7.5,6.21,12.77,6.21,3.55,0,7.03-1.29,7.03-3.87,0-3.24-6.45-6.09-12.62-8.83-7.97-3.44-14.8-8.67-14.8-18.16,0-10.9,10.35-18.67,22.3-18.67,9.61,0,17.11,4.53,19.57,10.74l-9.65,9.3c-1.88-3.32-6.72-4.77-9.73-4.77-3.44,0-5.9,1.76-5.9,3.91,0,2.89,4.45,3.83,11.25,6.68,9.84,4.14,16.37,10.16,16.37,19.45,0,11.99-11.17,19.45-23.79,19.45-10.35,0-19.77-4.57-22.93-11.52Z"/>
  </g>
</svg>`;

const luckyCoinFlipContainer = document.querySelector('#lucky-coin-flip-container');
const coinIcon = document.querySelector('.coin');
const tossBtn = document.querySelector('#coin-button');

function closeCoinFlipView() {
    hideContainer(luckyCoinFlipContainer);
}

tossBtn.addEventListener('click', () => {
    tossCoinFunction();
});

if (placeholderGamemodeAddons?.dataset.online === "false") {
    coinFlipButton?.addEventListener('click', toggleCoinFlip);
    function toggleCoinFlip() {
        addElementIfNotExists(elementClassArray, luckyCoinFlipContainer);
        if (!isContainerVisible(luckyCoinFlipContainer)) {
            showContainer(luckyCoinFlipContainer);
            coinFlipButton.classList.add('active');
            playSoundEffect('containerOpen');
            if (!isContainerVisible(overlay)) {
                toggleOverlay(true);
            }
        } else {
            hideContainer(luckyCoinFlipContainer);
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
    if (coinFlipInProgress) {
        return;
    }

    coinFlipInProgress = true;
    if (tossBtn) {
        tossBtn.disabled = true;
    }

    const randomVal = Math.random();
    const faceCoin = randomVal < 0.5 ? 'Heads' : 'Tails';
    const backgroundContainer = randomVal < 0.5 ? 'var(--backgroundcolour)' : 'var(--primarypagecolour)';
    const coinSvg = faceCoin === 'Heads' ? headsCoinSvg : tailsCoinSvg;

    coinIcon.classList.add('flip');
    playSoundEffect('coinFlip');

    setTimeout(() => {
        coinIcon.innerHTML = coinSvg;
    }, 500);

    setTimeout(() => {
        luckyCoinFlipContainer.style.backgroundColor = backgroundContainer;
    }, 850);

    setTimeout(() => {
        coinIcon.classList.remove('flip');
    }, 1000);

    try {
        // online vs offline behaviour
        if (placeholderGamemodeAddons?.dataset.online === "true") {
            await new Promise(resolve => setTimeout(resolve, 2500));

            const matchedFace =
                (pickedHeads && faceCoin === "Heads") ||
                (!pickedHeads && faceCoin === "Tails");

            if (
                placeholderGamemodeAddons?.dataset.gamemode === "paranoia" &&
                typeof performOnlinePartyAction === "function"
            ) {
                const updatedParty = await performOnlinePartyAction({
                    action: 'paranoia-resolve-coin-flip',
                    payload: {
                        matchedFace
                    },
                    syncInstructions: false
                });

                if (updatedParty) {
                    currentPartyData = updatedParty;
                }

                closeCoinFlipView();

                if (matchedFace === true && typeof DisplayDualStackCard === 'function') {
                    await DisplayDualStackCard();
                } else if (matchedFace !== true && typeof UserHasPassed === 'function') {
                    await UserHasPassed("USER_HAS_PASSED:USER_CALLED_WRONG_FACE:");
                } else if (typeof FetchInstructions === 'function') {
                    await FetchInstructions();
                }
            } else {
                const latestPartyData =
                    (typeof GetCurrentPartyData === 'function'
                        ? await GetCurrentPartyData()
                        : null) ??
                    currentPartyData ??
                    null;

                closeCoinFlipView();

                await SendInstruction({
                    instruction: matchedFace
                        ? "DISPLAY_DUAL_STACK_CARD"
                        : "USER_HAS_PASSED:USER_CALLED_WRONG_FACE:",
                    partyData: latestPartyData,
                    updateUsersReady: false,
                    updateUsersConfirmation: false,
                    byPassHost: true
                });
            }
        }
        // offline mode just ends after showing the coin
        // (no multiplayer logic, no instructions)
    } catch (error) {
        console.error('Failed to complete coin flip flow:', error);
    } finally {
        coinFlipInProgress = false;
        if (tossBtn) {
            tossBtn.disabled = false;
        }
    }
}

waitForFunction("loadSound", () => {
    async function LoadDrinkWheelSoundEffects() {
        const soundEffects = {
            coinFlip: '/sounds/party-games/coin-flip.wav'
        };

        for (const [key, url] of Object.entries(soundEffects)) {
            await loadSound(key, url);
        }
    }

    (async () => {
        await LoadDrinkWheelSoundEffects();
    })();
});
