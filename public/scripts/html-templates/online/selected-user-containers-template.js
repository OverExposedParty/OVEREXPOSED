const playerSelectionGamemodes = ["paranoia", "most-likely-to", "never-have-i-ever"];
const ConfirmPunishmentGamemodes = ["paranoia", "most-likely-to"];

const placeHolderSelectedUser = document.getElementById('placeholder-selected-user-container');

let waitingForPlayerContainer, waitingForPlayerTitle, waitingForPlayerText;
let waitingForPlayersContainer, waitingForPlayersIconContainer;

let selectPunishmentContainer, selectPunishmentButtonContainer, selectPunishmentConfirmPunishmentButton;
let playerHasPassedContainer, playerHasPassedTitle, playerHasPassedText;

let selectUserContainer, selectUserTitle, selectUserQuestionText, selectUserButtonContainer, selectUserConfirmPlayerButton;

let selectQuestionTypeContainer, selectQuestionTypeContainerQuestionText, selectQuestionTypeButtonContainer, selectQuestionTypeButtonTruth, selectQuestionTypeButtonDare;
let answerQuestionContainer, answerQuestionContainerQuestionText, answerQuestionAnswer, answerQuestionSubmitButton;
let completPromptContainer, completePromptText, completePromptCompleted;

let completePunishmentContainer, completePunishmentText, completePunishmentButtonConfirm, completePunishmentButtonPass;

let confirmPunishmentContainer, confirmPunishmentText, ConfirmPunishmentButtonYes, confirmPunishmentButtonNo;
let pickHeadsOrTailsContainer;

let selectOptionContainer, selectOptionQuestionText, selectOptionButtonContainer;
let selectOptionQuestionTextA, selectOptionQuestionTextB;

let selectOptionConfirmButtonYes, selectOptionConfirmButtonNo;
let selectOptionConfirmButtonA, selectOptionConfirmButtonB;

let selectNumberContainer, selectNumberQuestionText, selectNumberButtonContainer, confirmNumberButton;

let partyDisbandedContainer;

const cssFilesSelectUserContainers = [];
cssFilesSelectUserContainers.forEach(href => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    document.head.appendChild(link);
});

async function loadTemplatesAndScripts() {
    try {
        // Load base template
        const baseResponse = await fetch('/html-templates/online/party-games/selected-user-containers/party-games-template.html');
        const baseData = await baseResponse.text();
        placeHolderSelectedUser.insertAdjacentHTML('beforeend', baseData);
        await new Promise(requestAnimationFrame);

        // Initialize base containers
        waitingForPlayerContainer = placeHolderSelectedUser.querySelector('#waiting-for-player-container');
        waitingForPlayerTitle = waitingForPlayerContainer.querySelector('.content-container h2');
        waitingForPlayerText = waitingForPlayerContainer.querySelector('.content-container p');

        waitingForPlayersContainer = placeHolderSelectedUser.querySelector('#waiting-for-players-container');
        waitingForPlayersIconContainer = waitingForPlayersContainer.querySelector('.content-container .user-confirmed-section');

        selectPunishmentContainer = placeHolderSelectedUser.querySelector('#select-punishment-container');
        selectPunishmentButtonContainer = selectPunishmentContainer.querySelector('.selected-user-container .button-container');
        selectPunishmentConfirmPunishmentButton = selectPunishmentContainer.querySelector('.select-button-container button');

        playerHasPassedContainer = placeHolderSelectedUser.querySelector('#player-has-passed');
        playerHasPassedTitle = playerHasPassedContainer.querySelector('.content-container h2');
        playerHasPassedText = playerHasPassedContainer.querySelector('.content-container p');

        completePunishmentContainer = placeHolderSelectedUser.querySelector('#complete-punishment-container');
        completePunishmentText = completePunishmentContainer.querySelector('.content-container #punishment-text');
        completePunishmentButtonConfirm = completePunishmentContainer.querySelector('.select-button-container #confirm');
        partyDisbandedContainer = document.getElementById('party-disbanded-container');

        // Push base containers
        gameContainers.push(
            waitingForPlayerContainer,
            waitingForPlayersContainer,
            selectPunishmentContainer,
            playerHasPassedContainer,
            completePunishmentContainer,
            partyDisbandedContainer
        );

        const template = placeHolderSelectedUser.dataset.template;

        // Load template-specific HTML
        if (template === 'truth-or-dare') {
            const response = await fetch('/html-templates/online/party-games/selected-user-containers/truth-or-dare-template.html');
            const data = await response.text();
            placeHolderSelectedUser.insertAdjacentHTML('beforeend', data);
            await new Promise(requestAnimationFrame);

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

            gameContainers.push(answerQuestionContainer, completPromptContainer, selectQuestionTypeContainer);
        }

        if (template === 'paranoia') {
            const response = await fetch('/html-templates/online/party-games/selected-user-containers/paranoia-template.html');
            const data = await response.text();
            placeHolderSelectedUser.insertAdjacentHTML('beforeend', data);
            await new Promise(requestAnimationFrame);

            pickHeadsOrTailsContainer = placeHolderSelectedUser.querySelector('#heads-or-tails-pick-container');

            const punishmentPassButton = document.createElement("button");
            punishmentPassButton.className = "select-button";
            punishmentPassButton.id = "pass";
            punishmentPassButton.textContent = "Pass";
            completePunishmentButtonPass = completePunishmentContainer.querySelector('.select-button-container').appendChild(punishmentPassButton);

            gameContainers.push(pickHeadsOrTailsContainer, completePunishmentContainer);
        }

        if (template === 'never-have-i-ever') {
            const response = await fetch('/html-templates/online/party-games/selected-user-containers/never-have-i-ever-template.html');
            const data = await response.text();
            placeHolderSelectedUser.insertAdjacentHTML('beforeend', data);
            await new Promise(requestAnimationFrame);

            selectOptionContainer = document.getElementById('select-option-container');
            selectOptionQuestionText = selectOptionContainer.querySelector('.content-container h2');
            selectOptionButtonContainer = selectOptionContainer.querySelector('.select-button-container');
            selectOptionConfirmButtonYes = selectOptionButtonContainer.querySelector('#yes');
            selectOptionConfirmButtonNo = selectOptionButtonContainer.querySelector('#no');

            gameContainers.push(selectOptionContainer);
        }

        if (template === 'most-likely-to') {
            const response = await fetch('/html-templates/online/party-games/selected-user-containers/most-likely-to-template.html');
            const data = await response.text();
            placeHolderSelectedUser.insertAdjacentHTML('beforeend', data);
            await new Promise(requestAnimationFrame);

            selectNumberContainer = document.querySelector('#select-number-container');
            selectNumberQuestionText = selectNumberContainer.querySelector('.content-container h2');
            selectNumberButtonContainer = selectNumberContainer.querySelector('.selected-user-container .button-container');
            confirmNumberButton = selectNumberContainer.querySelector('.select-button-container button');

            gameContainers.push(selectNumberContainer);
        }

        if (template === 'would-you-rather') {
            const response = await fetch('/html-templates/online/party-games/selected-user-containers/would-you-rather-template.html');
            const data = await response.text();
            placeHolderSelectedUser.insertAdjacentHTML('beforeend', data);
            await new Promise(requestAnimationFrame);

            selectOptionContainer = document.getElementById('select-option-container');
            selectOptionQuestionTextA = selectOptionContainer.querySelector('.content-container h2#a');
            selectOptionQuestionTextB = selectOptionContainer.querySelector('.content-container h2#b');
            selectOptionButtonContainer = selectOptionContainer.querySelector('.select-button-container');
            selectOptionConfirmButtonA = selectOptionButtonContainer.querySelector('#a');
            selectOptionConfirmButtonB = selectOptionButtonContainer.querySelector('#b');

            gameContainers.push(selectOptionContainer);
        }

        // Player selection template
        if (playerSelectionGamemodes.includes(template)) {
            const response = await fetch('/html-templates/online/party-games/selected-user-containers/general/player-selection-template.html');
            const data = await response.text();
            placeHolderSelectedUser.insertAdjacentHTML('beforeend', data);
            await new Promise(requestAnimationFrame);

            selectUserContainer = placeHolderSelectedUser.querySelector('#select-user-container');
            selectUserTitle = selectUserContainer.querySelector('.content-container h1');
            selectUserQuestionText = selectUserContainer.querySelector('.content-container h2');
            selectUserButtonContainer = selectUserContainer.querySelector('.button-container');
            selectUserConfirmPlayerButton = selectUserContainer.querySelector('.select-button-container button');

            selectUserTitle.textContent = template.replace('-', ' ');

            gameContainers.push(selectUserContainer);
        }

        // Confirm punishment template
        if (ConfirmPunishmentGamemodes.includes(template)) {
            const response = await fetch('/html-templates/online/party-games/selected-user-containers/general/confirm-punishment-template.html');
            const data = await response.text();
            placeHolderSelectedUser.insertAdjacentHTML('beforeend', data);
            await new Promise(requestAnimationFrame);

            confirmPunishmentContainer = placeHolderSelectedUser.querySelector('#confirm-punishment-container');
            confirmPunishmentText = confirmPunishmentContainer.querySelector('.content-container h2');
            ConfirmPunishmentButtonYes = confirmPunishmentContainer.querySelector('#yes');
            confirmPunishmentButtonNo = confirmPunishmentContainer.querySelector('#no');

            gameContainers.push(confirmPunishmentContainer);
        }

        // Finally, load scripts last
        console.log("Loading online script for " + template);
        await LoadScript(`/scripts/party-games/gamemode/online/general/party-games-online-instructions.js?30082025`);
        await LoadScript(`/scripts/html-templates/online/card-container-template.js`);

    } catch (error) {
        console.error('Error loading templates or scripts:', error);
    }
}

// Start loading
loadTemplatesAndScripts();
