function getNextQuestion() {
    if (currentQuestionIndex >= allQuestions.length) {
        shuffleQuestions();
        currentQuestionIndex = 0;
    }

    stopSpeech();
    enableTTSButton();

    const selectedQuestion = allQuestions[currentQuestionIndex];
    const cardType = questionPackMap[currentQuestionIndex] || 'Unknown Pack';

    currentQuestionIndex++;

    return { question: selectedQuestion['question'], cardType: cardType };
}

document.querySelector('.question-button').addEventListener('click', () => {
    playSoundEffect(soundButtonClicked);
    const selectedQuestionObj = getNextQuestion();
    updateTextContainer(selectedQuestionObj.question, selectedQuestionObj.cardType);

    if (!hasBeenClicked) {
        enableTTSButton();
        hasBeenClicked = true;
    }
    vibrateOnClick();
});