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
    let questionCardIndex = currentPartyData.currentCardIndex;

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
            instruction ="DISPLAY_PUBLIC_CARD";
            questionCardIndex++;
            currentPartyData.currentCardIndex = questionCardIndex;
            currentPartyData.playerTurn++;
            if (currentPartyData.playerTurn >= currentPartyData.computerIds.length) {
              currentPartyData.playerTurn = 0;
            }
            SendInstruction(instruction, true, currentPartyData.playerTurn, questionCardIndex);
            
        }
        else{
            instruction ="USER_HAS_PASSED:USER_CALLED_WRONG_FACE:"; //instruction ="NEXT_USER_TURN";
            SendInstruction(instruction,true);
            setTimeout(() => {
                instruction ="NEXT_USER_TURN";
                currentPartyData.currentCardIndex++;
                currentPartyData.playerTurn++;
                if(currentPartyData.playerTurn > currentPartyData.computerIds.length){
                    currentPartyData.playerTurn = 0;
                }
                SendInstruction(instruction,false,currentPartyData.playerTurn,currentPartyData.currentCardIndex);
            }, 2500);
            
        }
    }, 2500);
}

