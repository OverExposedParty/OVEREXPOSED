const coinIcon = document.getElementById('coin');
const tossBtn = document.getElementById('coin-button');


tossBtn.addEventListener('click', () => {
    tossCoinFunction();
});

async function tossCoinFunction() {
    const existingData = await getExistingPartyData(partyCode);
    if (!existingData || existingData.length === 0) {
      console.warn('No party data found.');
      return;
    }

    const currentPartyData = existingData[0];

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
        playerHasPassedContainer.classList.add('active');
        coinFlipContainer.classList.remove('active');

        let instruction = "";
        if((isHeads && faceCoin == "Heads") || (!isHeads && faceCoin == "Tails")){
            instruction ="USER_HAS_PASSED:USER_CALLED_WRONG_FACE:"; //instruction ="NEXT_USER_TURN";
        }
        else{
            instruction ="USER_HAS_PASSED:USER_CALLED_WRONG_FACE:";
        }
        SendInstruction(instruction,true);
        setTimeout(() => {
            instruction ="NEXT_USER_TURN";
            currentPlayerTurn++;
            if(currentPlayerTurn > currentPartyData.computerIds.length){
                currentPlayerTurn = 0;
            }
    
            updateOnlineParty({
                partyId: partyCode,
                userInstructions: instruction,
                playerTurn: currentPlayerTurn,
                lastPinged: Date.now(),
              });
        }, 2500);
    }, 2500);
}

