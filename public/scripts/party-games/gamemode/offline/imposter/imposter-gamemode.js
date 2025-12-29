let selectPlayerContainer, selectPlayerButtonContainer, selectPlayerButtonConfirm;
let displayPromptContainer, displayPromptTitle, displayPromptText, displayPromptReadButton;
let displayStartTimerContainer, displayStartTimerContainerTitle, displayStartButton;
let imposterTimerWrapper

const imposterTimer = localStorage.getItem("imposter-timer") === "true";

const playerCount = localStorage.getItem("imposter-player-count");
const timeLimit = Number(localStorage.getItem("imposter-time-limit"));

let playerSelectedIndex = 0;
let alternativeQuestionIndex = 0;

const cssFilesImposterGamemode = [
    '/css/party-games/online.css',
    '/css/general/online/timer.css'
];

cssFilesImposterGamemode.forEach(href => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    document.head.appendChild(link);
});

fetch('/html-templates/party-games/offline/imposter/imposter-template.html')
    .then(response => response.text())
    .then(data => {
        const placeHolderImposterAddons = document.getElementById('placeholder-gamemode-addons-container');
        placeHolderImposterAddons.innerHTML = data;

        selectPlayerContainer = document.getElementById('select-player-container');
        selectPlayerButtonContainer = selectPlayerContainer.querySelector('.button-container');
        selectPlayerButtonConfirm = selectPlayerContainer.querySelector('.select-button-container .select-button');

        displayPromptContainer = document.getElementById('display-prompt-container');
        displayPromptTitle = displayPromptContainer.querySelector('.content-container h2');
        displayPromptText = displayPromptContainer.querySelector('.content-container p');
        displayPromptReadButton = displayPromptContainer.querySelector('#read');

        displayStartTimerContainer = document.getElementById('start-timer-container');
        displayStartTimerContainerTitle = displayStartTimerContainer.querySelector('.content-container h2');
        displayStartButton = displayStartTimerContainer.querySelector('.select-button-container .select-button');

        imposterTimerWrapper = document.getElementById('imposter-timer');

        gameContainers.push(
            selectPlayerContainer,
            displayPromptContainer,
            displayStartTimerContainer,
            imposterTimerWrapper,
            placeholderCardContainer.querySelector('.card-container#public-view')
        );

        for (let i = 1; i <= playerCount; i++) {
            const button = document.createElement('button');
            button.classList.add('player-button');
            button.textContent = `Player ${i}`;
            button.id = `Player ${i}`;
            selectPlayerButtonContainer.appendChild(button);
        }

        selectPlayerButtonContainer.querySelectorAll('button').forEach(playerButton => {
            playerButton.addEventListener('click', () => {
                selectPlayerContainer.setAttribute('selected-id', playerButton.getAttribute('id'));
                selectPlayerButtonContainer.querySelectorAll('button').forEach(button => {
                    button.classList.remove('active');
                });
                playerButton.classList.add('active');
            })
        });

        selectPlayerButtonConfirm.addEventListener('click', async () => {
            if (selectPlayerContainer.getAttribute('selected-id') != "") {
                const selectPlayerButtons = selectPlayerContainer.querySelectorAll('.selected-user-container .button-container button');
                document.getElementById(selectPlayerContainer.getAttribute('selected-id')).classList.add('disabled');
                selectPlayerButtons.forEach(button => {
                    button.classList.remove('active');
                });
                selectPlayerContainer.getAttribute('selected-id') != ""
                const playerIndex = parseInt(selectPlayerContainer.getAttribute('selected-id').replace(/\D/g, ''), 10);
                if (playerIndex === playerSelectedIndex) {
                    displayPromptText.textContent = GetAlternativeQuestion(selectedQuestionObj.questionAlternatives);
                }
                else {
                    displayPromptText.textContent = selectedQuestionObj.question;
                }
                setActiveContainers(displayPromptContainer);
            }
        });

        displayPromptReadButton.addEventListener('click', () => {
            const selectPlayerButtons = selectPlayerContainer.querySelectorAll('.selected-user-container .button-container button');
            const allPlayerButtonsDisabled = Array.from(selectPlayerButtons).every(button => button.classList.contains('disabled'));
            if (allPlayerButtonsDisabled) {
                selectPlayerButtons.forEach(button => {
                    button.classList.remove('disabled');
                })
                if (imposterTimer) {
                    setActiveContainers(displayStartTimerContainer);
                }
                else {
                    DisplayImposterInstructions();
                }
            }
            else {
                setActiveContainers(selectPlayerContainer);
            }
        });

        placeholderCardContainer.querySelector('#question-button').addEventListener('click', () => {
            if (placeholderCardContainer.querySelector('#question-button').dataset.nextContainer === selectPlayerContainer.id) {
                setActiveContainers(selectPlayerContainer);
                playerSelectedIndex = 1 + Math.floor(Math.random() * playerCount);
                alternativeQuestionIndex = Math.floor(Math.random() * 255);
                selectedQuestionObj = getNextQuestion();
            }
            else {
                ImposterNextQuestion();
            }
        })

        displayStartButton.addEventListener('click', () => {
            setActiveContainers(imposterTimerWrapper);
            startTimer({
                timeLeft: timeLimit,
                duration: timeLimit,
                selectedTimer: imposterTimerWrapper
            })
            setTimeout(() => {
                setActiveContainers(placeholderCardContainer.querySelector('.card-container#public-view'));
            }, timeLimit * 1000);
        })
    }).then(async () => {
        await loadJSONFiles();
        await LoadScript(`/scripts/party-games/gamemode/online/general/party-timer.js`);
    }).then(() => {
        ImposterNextQuestion();
    });

function GetAlternativeQuestion(input) {
    if (!Array.isArray(input) || input.length === 0) {
        return null;
    }

    const selectedAlternativeQuestion =
        input[alternativeQuestionIndex % input.length];

    return selectedAlternativeQuestion;
}


function ImposterNextQuestion() {
    placeholderCardContainer.querySelector('#question-button').dataset.nextContainer = selectPlayerContainer.id;
    placeholderCardContainer.querySelector('.card-container#public-view').querySelector('.regular-button-container #question-button').textContent = "Display Words";
    placeholderCardContainer.querySelector('.card-container#public-view').querySelector('.text-container').innerHTML = '<div class="question-text placeholder">IMPOSTER</div>'
    setActiveContainers(placeholderCardContainer.querySelector('.card-container#public-view'));
}

function DisplayImposterInstructions() {
    placeholderCardContainer.querySelector('#question-button').dataset.nextContainer = placeholderCardContainer.querySelector('.card-container#public-view').id;
    placeholderCardContainer.querySelector('.card-container#public-view').querySelector('.regular-button-container #question-button').textContent = "Next Question";
    placeholderCardContainer.querySelector('.card-container#public-view').querySelector('.text-container').textContent = "Give one small clue or answer to your prompt each turn. The real players share the same prompt; the Imposter doesn’t. Stay subtle… someone is faking it.";
    setActiveContainers(placeholderCardContainer.querySelector('.card-container#public-view'));
}