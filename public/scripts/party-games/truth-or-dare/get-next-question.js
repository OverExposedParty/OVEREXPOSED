const truthOrDareText = document.querySelector('.gamemode-text-svg');

function getNextQuestion(type) {
    // Filter questions by "question-type"
    let filteredQuestions = allQuestions.filter(q => q["question-type"] === type);

    if (filteredQuestions.length === 0) {
        console.error(`No questions available for ${type}`);
        return { question: `No ${type} questions available`, cardType: 'Unknown Pack', punishment: null };
    }

    // Shuffle only the filtered questions
    if (currentQuestionIndex >= filteredQuestions.length) {
        shuffleArray(filteredQuestions);
        currentQuestionIndex = 0;
    }

    stopSpeech();
    enableTTSButton();

    const selectedQuestion = filteredQuestions[currentQuestionIndex];
    const cardType = questionPackMap[currentQuestionIndex] || 'Unknown Pack';

    // Check if there's a punishment key in the selected question
    const punishment = selectedQuestion["punishment"] ? selectedQuestion["punishment"] : null;

    currentQuestionIndex++;

    return { question: selectedQuestion['question'], cardType: cardType, punishment: punishment };
}
function updateTruthOrDareText(type) {
    if (type == 'truth') {
        truthOrDareText.src = "/images/party-games/truth-or-dare/truth-text.svg";
    }
    else if (type == 'dare') {
        truthOrDareText.src = "/images/party-games/truth-or-dare/dare-text.svg";
    }
    truthOrDareText.setAttribute('alt', type);
}

document.getElementById('truth-button').addEventListener('click', () => {
    stopSpeech();
    if (hasBeenClicked) return;
    hasBeenClicked = true;
    const selectedQuestionObj = getNextQuestion('truth');
    if (selectedQuestionObj) {
        updateTextContainer(selectedQuestionObj.question, selectedQuestionObj.cardType, selectedQuestionObj.punishment);
        updateTruthOrDareText('truth');
        enableTTSButton();

        currentQuestion = selectedQuestionObj.question;
        currentPunishment = selectedQuestionObj.punishment;
    }
    hasBeenClicked = false;
});

document.getElementById('dare-button').addEventListener('click', () => {
    stopSpeech();
    if (hasBeenClicked) return;
    hasBeenClicked = true;
    const question = getNextQuestion('dare');
    if (question) {
        updateTextContainer(question.question, question.cardType, question.punishment);
        updateTruthOrDareText('dare');
        enableTTSButton();

        currentQuestion = question.question;
        currentPunishment = question.punishment;
    }
    hasBeenClicked = false;
});
