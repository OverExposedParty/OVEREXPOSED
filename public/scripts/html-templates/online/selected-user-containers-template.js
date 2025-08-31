const playerSelectionGamemodes = ["paranoia", "most-likely-to", "never-have-i-ever"];
const ConfirmPunishmentGamemodes = ["paranoia", "most-likely-to"];

const placeHolderSelectedUser = document.getElementById('placeholder-selected-user-container');

//Party Games General
let waitingForPlayerContainer, waitingForPlayerTitle, waitingForPlayerText;
let waitingForPlayersContainer, waitingForPlayersIconContainer;

let selectPunishmentContainer, selectPunishmentButtonContainer, selectPunishmentConfirmPunishmentButton; //rename selectPunishmentConfirmPunishmentButton
let playerHasPassedContainer, playerHasPassedTitle, playerHasPassedText;

//Party Games Player Selection
let selectUserContainer, selectUserTitle, selectUserQuestionText, selectUserButtonContainer, selectUserConfirmPlayerButton;

//TRUTH OR DARE
let selectQuestionTypeContainer, selectQuestionTypeContainerQuestionText, selectQuestionTypeButtonContainer, selectQuestionTypeButtonTruth, selectQuestionTypeButtonDare;
let answerQuestionContainer, answerQuestionContainerQuestionText, answerQuestionAnswer, answerQuestionSubmitButton;
let completPromptContainer, completePromptText, completePromptCompleted;

let completePunishmentContainer, completePunishmentText, completePunishmentButtonConfirm, completePunishmentButtonPass;

//PARANOIA
let confirmPunishmentContainer, confirmPunishmentText, selectPunishmentConfirmPunishmentButtonYes, selectPunishmentConfirmPunishmentButtonNo;
let pickHeadsOrTailsContainer;

//NEVER HAVE I EVER
let selectOptionContainer, selectOptionQuestionText, selectOptionButtonContainer, selectOptionConfirmButtonYes, selectOptionConfirmButtonNo;

//MOST LIKELY TO
let selectNumberContainer, selectNumberQuestionText, selectNumberButtonContainer, confirmNumberButton;
const cssFilesSelectUserContainers = [

];

cssFilesSelectUserContainers.forEach(href => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    document.head.appendChild(link);
});

fetch('/html-templates/online/party-games/selected-user-containers/party-games-template.html')
    .then(response => response.text())
    .then(data => {
        return new Promise(resolve => {
            placeHolderSelectedUser.insertAdjacentHTML('beforeend', data);
            requestAnimationFrame(() => {
                resolve();
            });
        });
    })
    .then(() => {
        waitingForPlayerContainer = placeHolderSelectedUser.querySelector('#waiting-for-player-container');
        waitingForPlayerTitle = waitingForPlayerContainer.querySelector('.content-container h2')
        waitingForPlayerText = waitingForPlayerContainer.querySelector('.content-container p')

        waitingForPlayersContainer = placeHolderSelectedUser.querySelector('#waiting-for-players-container');
        waitingForPlayersIconContainer = waitingForPlayersContainer.querySelector('.content-container .user-confirmed-section');

        selectPunishmentContainer = placeHolderSelectedUser.querySelector('#select-punishment-container')
        selectPunishmentButtonContainer = selectPunishmentContainer.querySelector('.selected-user-container .button-container');
        selectPunishmentConfirmPunishmentButton = selectPunishmentContainer.querySelector('.select-button-container button');

        playerHasPassedContainer = placeHolderSelectedUser.querySelector('#player-has-passed');
        playerHasPassedTitle = playerHasPassedContainer.querySelector('.content-container h2');
        playerHasPassedText = playerHasPassedContainer.querySelector('.content-container p');

        completePunishmentContainer = placeHolderSelectedUser.querySelector('#complete-punishment-container');
        completePunishmentText = completePunishmentContainer.querySelector('.content-container #punishment-text');
        completePunishmentButtonConfirm = completePunishmentContainer.querySelector('.select-button-container #confirm');

        //const enterUsernameScript = document.createElement('script');
        //enterUsernameScript.src = '/scripts/party-games/online/enter-username.js';
        //enterUsernameScript.defer = true;
        //document.body.appendChild(enterUsernameScript);
    })
    .then(() => {
        gameContainers.push(
            waitingForPlayerContainer,
            waitingForPlayersContainer,
            selectPunishmentContainer,
            playerHasPassedContainer,
            completePunishmentContainer
        );
    })
    .then(async () => {
        console.log("Loading online script for " + placeHolderSelectedUser.dataset.template);
        await loadScript(`/scripts/party-games/gamemode/online/general/party-games-online-instructions.js?30082025`);
        await loadScript(`/scripts/html-templates/online/card-container-template.js`);
    })
    .catch(error => console.error('Error loading header:', error));


if (placeHolderSelectedUser.dataset.template === 'truth-or-dare') {
    fetch('/html-templates/online/party-games/selected-user-containers/truth-or-dare-template.html')
        .then(response => response.text())
        .then(data => {
            return new Promise(resolve => {
                placeHolderSelectedUser.insertAdjacentHTML('beforeend', data);
                // Wait until next frame so elements are rendered
                requestAnimationFrame(() => {
                    resolve();
                });
            });
        })
        .then(() => {
            answerQuestionContainer = placeHolderSelectedUser.querySelector('#answer-question-container');
            answerQuestionContainerQuestionText = answerQuestionContainer.querySelector('.content-container h2');
            answerQuestionAnswer = answerQuestionContainer.querySelector('textarea');
            answerQuestionSubmitButton = answerQuestionContainer.querySelector("#submit");

            completPromptContainer = placeHolderSelectedUser.querySelector('#complete-prompt-container');
            completePromptText = completPromptContainer.querySelector('.content-container h2');
            completePromptCompleted = completPromptContainer.querySelector('.select-button-container #completed');

            selectQuestionTypeContainer = placeHolderSelectedUser.querySelector('#select-question-type-container');
            selectQuestionTypeContainerQuestionText = selectQuestionTypeContainer.querySelector('.content-container h1');
            selectQuestionTypeButtonContainer = selectQuestionTypeContainer.querySelector('.select-button-container');
            selectQuestionTypeButtonTruth = selectQuestionTypeButtonContainer.querySelector('#truth');
            selectQuestionTypeButtonDare = selectQuestionTypeButtonContainer.querySelector('#dare');
        })
        .then(() => {
            gameContainers.push(
                answerQuestionContainer,
                completPromptContainer,
                selectQuestionTypeContainer
            );
        });
}

if (placeHolderSelectedUser.dataset.template === 'paranoia') {
    fetch('/html-templates/online/party-games/selected-user-containers/paranoia-template.html')
        .then(response => response.text())
        .then(data => {
            return new Promise(resolve => {
                placeHolderSelectedUser.insertAdjacentHTML('beforeend', data);
                // Wait until next frame so elements are rendered
                requestAnimationFrame(() => {
                    resolve();
                });
            });
        })
        .then(() => {
            pickHeadsOrTailsContainer = placeHolderSelectedUser.querySelector('#heads-or-tails-pick-container');

            completePunishmentContainer = document.querySelector('#complete-punishment-container');
            const punishmentPassButton = document.createElement("button");
            punishmentPassButton.className = "select-button";
            punishmentPassButton.id = "pass";
            punishmentPassButton.textContent = "Pass";
            completePunishmentButtonPass = completePunishmentContainer.querySelector('.select-button-container').appendChild(punishmentPassButton);
        })
        .then(() => {
            gameContainers.push(
                pickHeadsOrTailsContainer,
                completePunishmentContainer
            );
        });
}

if (placeHolderSelectedUser.dataset.template === 'never-have-i-ever') {
    fetch('/html-templates/online/party-games/selected-user-containers/never-have-i-ever-template.html')
        .then(response => response.text())
        .then(data => {
            return new Promise(resolve => {
                placeHolderSelectedUser.insertAdjacentHTML('beforeend', data);
                // Wait until next frame so elements are rendered
                requestAnimationFrame(() => {
                    resolve();
                });
            });
        })
        .then(() => {
            selectOptionContainer = document.getElementById('select-option-container');
            selectOptionQuestionText = selectOptionContainer.querySelector('.content-container h2');
            selectOptionButtonContainer = selectOptionContainer.querySelector('.select-button-container');
            selectOptionConfirmButtonYes = selectOptionButtonContainer.querySelector('#yes');
            selectOptionConfirmButtonNo = selectOptionButtonContainer.querySelector('#no');


        })
        .then(() => {
            gameContainers.push(
                selectOptionContainer
            );
        });
}

if (placeHolderSelectedUser.dataset.template === 'most-likely-to') {
    fetch('/html-templates/online/party-games/selected-user-containers/most-likely-to-template.html')
        .then(response => response.text())
        .then(data => {
            return new Promise(resolve => {
                placeHolderSelectedUser.insertAdjacentHTML('beforeend', data);
                // Wait until next frame so elements are rendered
                requestAnimationFrame(() => {
                    resolve();
                });
            });
        })
        .then(() => {

            selectNumberContainer = document.querySelector('#select-number-container');
            selectNumberQuestionText = selectNumberContainer.querySelector('.content-container h2');
            selectNumberButtonContainer = selectNumberContainer.querySelector('.selected-user-container .button-container');
            confirmNumberButton = selectNumberContainer.querySelector('.select-button-container button');


        })
        .then(() => {
            gameContainers.push(
                selectNumberContainer
            );
        });
}

if (playerSelectionGamemodes.includes(placeHolderSelectedUser.dataset.template)) {
    fetch('/html-templates/online/party-games/selected-user-containers/general/player-selection-template.html')
        .then(response => response.text())
        .then(data => {
            return new Promise(resolve => {
                placeHolderSelectedUser.insertAdjacentHTML('beforeend', data);
                // Wait until next frame so elements are rendered
                requestAnimationFrame(() => {
                    resolve();
                });
            });
        })
        .then(() => {
            selectUserContainer = placeHolderSelectedUser.querySelector('#select-user-container');
            selectUserTitle = selectUserContainer.querySelector('.content-container h1');
            selectUserQuestionText = selectUserContainer.querySelector('.content-container h2');
            selectUserButtonContainer = selectUserContainer.querySelector('.button-container');
            selectUserConfirmPlayerButton = selectUserContainer.querySelector('.select-button-container button');
        })
        .then(() => {
            gameContainers.push(
                selectUserContainer
            );
        });
}

if (ConfirmPunishmentGamemodes.includes(placeHolderSelectedUser.dataset.template)) {
    fetch('/html-templates/online/party-games/selected-user-containers/general/confirm-punishment-template.html')
        .then(response => response.text())
        .then(data => {
            return new Promise(resolve => {
                placeHolderSelectedUser.insertAdjacentHTML('beforeend', data);
                // Wait until next frame so elements are rendered
                requestAnimationFrame(() => {
                    resolve();
                });
            });
        })
        .then(() => {
            confirmPunishmentContainer = placeHolderSelectedUser.querySelector('#confirm-punishment-container');
            confirmPunishmentText = confirmPunishmentContainer.querySelector('.content-container h2');
            selectPunishmentConfirmPunishmentButtonYes = confirmPunishmentContainer.querySelector('#yes');
            selectPunishmentConfirmPunishmentButtonNo = confirmPunishmentContainer.querySelector('#no');
        })
        .then(() => {
            gameContainers.push(
                confirmPunishmentContainer
            );
        });
}
