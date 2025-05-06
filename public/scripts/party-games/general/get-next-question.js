document.querySelector('.question-button').addEventListener('click', () => {
    playSoundEffect('buttonClicked');
    const selectedQuestionObj = getNextQuestion();
    updateTextContainer(selectedQuestionObj.question, selectedQuestionObj.cardType);

    if (!hasBeenClicked) {
        enableTTSButton();
        hasBeenClicked = true;
    }
    vibrateOnClick();
});