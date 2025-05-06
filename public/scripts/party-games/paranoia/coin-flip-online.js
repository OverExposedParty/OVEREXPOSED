const coinIcon = document.getElementById('coin');
const tossBtn = document.getElementById('coin-button');


tossBtn.addEventListener('click', () => {
    tossCoinFunction();
});

function tossCoinFunction() {
    const randomVal = Math.random();
    const faceCoin = randomVal < 0.5 ? 'Heads' : 'Tails';
    const backgroundContainer = randomVal < 0.5 ? 'var(--backgroundcolour)' : 'var(--primarypagecolour)';
    const imageUrl = faceCoin === 'Heads' ?
        '/images/icons/paranoia/heads-icon.svg' :
        '/images/icons/paranoia/tails-icon.svg';

    coinIcon.classList.add('flip');
    playSoundEffect('coinFlip');
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
    setTimeout(() => {
        let instruction = "";
        playerHasPassedContainer.classList.add('active');
        coinFlipContainer.classList.remove('active');
        if((isHeads && faceCoin == "Heads") || (!isHeads && faceCoin == "Tails")){
            instruction ="SHOW_PUBLIC_CARD";
            updateOnlineParty({
                partyId: partyCode,
                userInstructions: instruction,
                lastPinged: Date.now(),
              });
        }
        else{
            instruction ="NEXT_USER_TURN";
            currentPlayerTurn++;

            updateOnlineParty({
                partyId: partyCode,
                userInstructions: instruction,
                playerTurn: currentPlayerTurn,
                lastPinged: Date.now(),
              });
        }

    }, 2500);
}

