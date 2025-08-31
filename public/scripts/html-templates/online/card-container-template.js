const placeholderCardContainer = document.getElementById('placeholder-card-container');

const cardContainerGamemode = placeholderCardContainer.dataset.gamemode;

const cardContainerPublic = placeholderCardContainer?.querySelector('.card-container#public-view .content') ?? null;
const cardContainerDualStack = placeholderCardContainer?.querySelector('.card-container#dual-stack-view .content') ?? null;
const cardContainerPrivate = placeholderCardContainer?.querySelector('.card-container#private-view .content') ?? null;
const cardContainerAnswer = placeholderCardContainer?.querySelector('.card-container#answer-view .content') ?? null;

let gameContainerPublicTitle, gameContainerPublicText, gameContainerPublicCardType;
let gameContainerDualStackTitle, gameContainerDualStackText, gameContainerDualStackCardType;
let gameContainerPrivateTitle, gameContainerPrivateText, gameContainerPrivateCardType;
let gameContainerAnswerTitle, gameContainerAnswerText, gameContainerAnswerCardType;

let selectedQuestionObj;

//waiting room
let waitingForLeaderContainer;

const usernameMaxLength = 16;

const cssFilesCardContainer = [
    '/css/party-games/gamemode/card-container.css'
];

cssFilesCardContainer.forEach(href => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    document.head.appendChild(link);
});

// First: fetch main image container
fetch('/html-templates/party-games/card-container/main-image-container.html')
    .then(res => res.text())
    .then(async (mainHTML) => {
        const parser = new DOMParser();
        const mainDoc = parser.parseFromString(mainHTML, 'text/html');

        const mainImage = mainDoc.querySelector('.main-image');
        mainImage.src = `/images/blank-cards/${cardContainerGamemode}-blank-card.svg`;

        // Clone base for private
        const privateDoc = parser.parseFromString(mainHTML, 'text/html');
        privateDoc.querySelector('.main-image').src = mainImage.src;
        const baseHTML = privateDoc.body.innerHTML;

        // For public/answer, append single stack if online
        if (placeholderCardContainer?.dataset.online === "true") {
            const stackHTML = await fetch('/html-templates/online/image-stack.html')
                .then(res => res.text());
            const stackDoc = parser.parseFromString(stackHTML, 'text/html');
            const stackEl = stackDoc.body.firstElementChild;
            const container = mainDoc.querySelector('.main-image-container');
            container.appendChild(stackEl);
        }
        const withStackHTML = mainDoc.body.innerHTML;

        // For dual stack container
        const dualStackHTML = await fetch('/html-templates/online/dual-image-stack.html')
            .then(res => res.text());
        const dualStackDoc = parser.parseFromString(dualStackHTML, 'text/html');
        const dualStackEl = dualStackDoc.body.firstElementChild;
        const dualDoc = parser.parseFromString(mainHTML, 'text/html');
        dualDoc.querySelector('.main-image').src = mainImage.src;
        dualDoc.querySelector('.main-image-container').appendChild(dualStackEl);
        const withDualStackHTML = dualDoc.body.innerHTML;

        // Insert HTML into each container
        if (cardContainerPrivate) {
            cardContainerPrivate.insertAdjacentHTML('afterbegin', baseHTML);
        }
        if (cardContainerPublic) {
            cardContainerPublic.insertAdjacentHTML('afterbegin', withStackHTML);
        }
        if (cardContainerAnswer) {
            cardContainerAnswer.insertAdjacentHTML('afterbegin', withStackHTML);
        }
        if (cardContainerDualStack) {
            cardContainerDualStack.insertAdjacentHTML('afterbegin', withDualStackHTML);
        }

        document.addEventListener('DOMContentLoaded', () => {
            if (cardContainerPublic != null) {
                gameContainerPublicTitle = cardContainerPublic.querySelector('.content .gamemode-text-svg');
            }
            if (cardContainerAnswer != null) {
                gameContainerAnswerTitle = cardContainerAnswer.querySelector('.content .gamemode-text-svg');
            }
        });

        return fetch('/html-templates/party-games/card-container/gamemode-text-container.html');
    })

    .then(response => response.text())
    .then(html => {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        const gamemodeTextContainer = doc.querySelector('.gamemode-text-svg');

        if (gamemodeTextContainer) {
            if (cardContainerGamemode === 'truth-or-dare') {
                gamemodeTextContainer.src = `/images/party-games/${cardContainerGamemode}/truth-text.svg`;
            } else {
                gamemodeTextContainer.src = `/images/party-games/${cardContainerGamemode}/${cardContainerGamemode}-text.svg`;
            }
        }

        const updatedHTML = doc.body.innerHTML;

        cardContainerPublic?.insertAdjacentHTML('afterbegin', updatedHTML);
        cardContainerDualStack?.insertAdjacentHTML('afterbegin', updatedHTML);
        cardContainerPrivate?.insertAdjacentHTML('afterbegin', updatedHTML);
        cardContainerAnswer?.insertAdjacentHTML('afterbegin', updatedHTML);

        if (placeholderCardContainer?.dataset.online === "false") {
            if (cardContainerGamemode === 'truth-or-dare') {
                const scriptGetNextQuestion = document.createElement('script');
                scriptGetNextQuestion.src = `/scripts/party-games/gamemode/online/truth-or-dare/get-next-question.js`;
                document.body.appendChild(scriptGetNextQuestion);
            }
            else {
                const scriptGetNextQuestion = document.createElement('script');
                scriptGetNextQuestion.src = `/scripts/party-games/general/get-next-question.js`;
                document.body.appendChild(scriptGetNextQuestion);
            }
        }

        document.addEventListener('DOMContentLoaded', async () => {
            if (cardContainerPublic != null) {
                gameContainerPublicText = cardContainerPublic.querySelector('.content .main-image-container .text-container');
                gameContainerPublicCardType = cardContainerPublic.querySelector('.content .main-image-container .card-type-text');
            }
            if (cardContainerAnswer != null) {
                gameContainerAnswerText = cardContainerAnswer.querySelector('.content .main-image-container .text-container');
                gameContainerAnswerCardType = cardContainerAnswer.querySelector('.content .main-image-container .card-type-text');
            }
        });

        (async () => {
            if (placeholderCardContainer?.dataset.online === "true") {
                await loadScript(`scripts/party-games/gamemode/online/${cardContainerGamemode}/${cardContainerGamemode}-online.js?30082025`);
                await SetPageSettings();
            }
        })();
    })
    .then(() => {
        // load game scripts here
        // const scriptGamemodeOnline = document.createElement('script');
        // scriptGamemodeOnline.src = `/scripts/party-games/${cardContainerGamemode}/${cardContainerGamemode}-online.js`;
        // document.body.appendChild(scriptGamemodeOnline);
    })
    .catch(error => console.error('Error loading templates:', error));