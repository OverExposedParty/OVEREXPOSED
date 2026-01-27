document.querySelector('.question-button').addEventListener('click', () => {
    const selectedQuestionObj = getNextQuestion();
    updateTextContainer(selectedQuestionObj.question, selectedQuestionObj.cardType);

    if (!hasBeenClicked) {
        hasBeenClicked = true;
    }
});