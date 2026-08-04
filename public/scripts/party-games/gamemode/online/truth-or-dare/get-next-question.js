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

    const selectedQuestion = filteredQuestions[currentQuestionIndex];
    const cardType = selectedQuestion?.__packName || 'Unknown Pack';

    // Check if there's a punishment key in the selected question
    const punishment = selectedQuestion["punishment"] ? selectedQuestion["punishment"] : null;
    const questionAlternatives = selectedQuestion["question-alternatives"] ? selectedQuestion["question-alternatives"] : null;

    currentQuestionIndex++;

    const result = {
        question: selectedQuestion['question'],
        cardType: cardType,
        packKey: selectedQuestion.__packKey || 'unknown-pack',
        questionId: selectedQuestion.__questionId || null,
        questionType: selectedQuestion['question-type'] || type,
        punishment: punishment,
        questionAlternatives: questionAlternatives || []
    };
    window.OEOfflineQuestionAnalytics?.beginQuestion(result);
    return result;
}
function updateTruthOrDareText(type) {
    const svgPath = `/images/party-games/truth-or-dare/${type}-text.svg`;
    updateGamemodeTextSvgSource(truthOrDareText, svgPath, type);
}

document.getElementById('truth-button').addEventListener('click', () => {
    if (hasBeenClicked) return;
    hasBeenClicked = true;
    const selectedQuestionObj = getNextQuestion('truth');
    if (selectedQuestionObj) {
        updateTextContainer(selectedQuestionObj.question, selectedQuestionObj.cardType, selectedQuestionObj.punishment);
        updateTruthOrDareText('truth');

        currentQuestion = selectedQuestionObj.question;
        currentPunishment = selectedQuestionObj.punishment;
    }
    hasBeenClicked = false;
});

document.getElementById('dare-button').addEventListener('click', () => {
    if (hasBeenClicked) return;
    hasBeenClicked = true;
    const question = getNextQuestion('dare');
    if (question) {
        updateTextContainer(question.question, question.cardType, question.punishment);
        updateTruthOrDareText('dare');

        currentQuestion = question.question;
        currentPunishment = question.punishment;
    }
    hasBeenClicked = false;
});
