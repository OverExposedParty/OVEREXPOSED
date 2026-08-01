const placeholderCardContainer = document.getElementById('placeholder-card-container');

const cardContainerGamemode = placeholderCardContainer.dataset.gamemode;

const cardContainerPublic = placeholderCardContainer?.querySelector('.card-container#public-view .content') ?? null;
const cardContainerDualStack = placeholderCardContainer?.querySelector('.card-container#dual-stack-view .content') ?? null;
const cardContainerPrivate = placeholderCardContainer?.querySelector('.card-container#private-view .content') ?? null;

let gameContainerPublicTitle, gameContainerPublicText, gameContainerPublicCardType;
let gameContainerDualStackTitle, gameContainerDualStackText, gameContainerDualStackCardType;
let gameContainerPrivateTitle, gameContainerPrivateText, gameContainerPrivateCardType;

let selectedQuestionObj;

//waiting room
let waitingForLeaderContainer;

const usernameMaxLength = 16;

const cssFilesCardContainer = [
    '/css/party-games/gamemode/card-container.css'
];

cssFilesCardContainer.forEach(href => {
    LoadStylesheet(href);
});

function getGamemodeTextSvgPath(gamemode) {
    if (gamemode === 'truth-or-dare') {
        return `/images/party-games/${gamemode}/truth-text.svg`;
    }
    return `/images/party-games/${gamemode}/${gamemode}-text.svg`;
}

function tintSvgToPrimaryColour(svgElement) {
    const textShapeSelector = 'path, polygon, polyline, circle, ellipse, line, text, tspan';

    svgElement.querySelectorAll(textShapeSelector).forEach(el => {
        if (el.classList.contains('cls-2')) {
            el.classList.remove('cls-2');
            el.classList.add('cls-1');
        }

        const fill = (el.getAttribute('fill') || '').trim().toLowerCase();
        if (fill !== 'none') {
            el.style.fill = 'var(--primarypagecolour)';
        }

        const stroke = (el.getAttribute('stroke') || '').trim().toLowerCase();
        if (stroke && stroke !== 'none') {
            el.style.stroke = 'var(--primarypagecolour)';
        }
    });
}

const gamemodeTextSvgCache = new Map();

function prepareGamemodeTextSvg(svgElement) {
    // Prevent class-based rules inside title SVG (e.g. .cls-2 { opacity: 0; })
    // from leaking and affecting other inline SVGs like the main card.
    svgElement.querySelectorAll('style').forEach(styleEl => styleEl.remove());
    svgElement.querySelectorAll('rect').forEach(rect => rect.remove());

    svgElement.classList.add('gamemode-text-svg');
    tintSvgToPrimaryColour(svgElement);
    return svgElement;
}

function loadGamemodeTextSvg(svgPath) {
    if (!gamemodeTextSvgCache.has(svgPath)) {
        const svgPromise = fetch(svgPath)
            .then(res => res.text())
            .then(svgText => {
                const parser = new DOMParser();
                const svgDoc = parser.parseFromString(svgText, 'image/svg+xml');
                const svgElement = svgDoc.querySelector('svg');

                if (!svgElement) {
                    throw new Error(`No SVG element found in ${svgPath}`);
                }

                return prepareGamemodeTextSvg(svgElement);
            });
        gamemodeTextSvgCache.set(svgPath, svgPromise);
    }

    return gamemodeTextSvgCache.get(svgPath);
}

async function updateGamemodeTextSvgSource(svgElement, svgPath, label = '') {
    if (!svgElement || svgElement.tagName?.toLowerCase() !== 'svg') {
        return false;
    }

    svgElement.dataset.requestedSourcePath = svgPath;
    if (svgElement.dataset.sourcePath === svgPath) {
        svgElement.setAttribute('aria-label', label);
        return true;
    }

    try {
        const sourceSvg = await loadGamemodeTextSvg(svgPath);

        // A newer selection won while this asset was loading.
        if (svgElement.dataset.requestedSourcePath !== svgPath) {
            return false;
        }

        [...svgElement.attributes].forEach(attribute => {
            svgElement.removeAttribute(attribute.name);
        });
        [...sourceSvg.attributes].forEach(attribute => {
            svgElement.setAttribute(attribute.name, attribute.value);
        });
        svgElement.replaceChildren(
            ...[...sourceSvg.childNodes].map(node => node.cloneNode(true))
        );
        svgElement.classList.add('gamemode-text-svg');
        svgElement.dataset.sourcePath = svgPath;
        svgElement.dataset.requestedSourcePath = svgPath;
        svgElement.setAttribute('role', 'img');
        svgElement.setAttribute('aria-label', label);
        return true;
    } catch (error) {
        console.error(`Failed to update game title SVG from ${svgPath}:`, error);
        return false;
    }
}

async function buildGamemodeTextMarkup(gamemode, templateHtml) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(templateHtml, 'text/html');
    const container = doc.querySelector('.gamemode-text-container');

    if (!container) {
        return doc.body.innerHTML;
    }

    const svgPath = getGamemodeTextSvgPath(gamemode);
    const svgElement = (await loadGamemodeTextSvg(svgPath)).cloneNode(true);
    svgElement.dataset.sourcePath = svgPath;
    svgElement.dataset.requestedSourcePath = svgPath;
    svgElement.setAttribute('role', 'img');
    svgElement.setAttribute('aria-label', gamemode.replaceAll('-', ' '));
    container.appendChild(svgElement);

    return doc.body.innerHTML;
}

function appendCardMarkup(target, html) {
    if (!target) return;
    appendTrustedHtml(target, html);
}

function setCardPlaceholderText(target, gamemode) {
    if (!target) return;

    const questionText = document.createElement('div');
    questionText.className = 'question-text placeholder';
    questionText.textContent = gamemode.replaceAll('-', ' ').toUpperCase();
    target.replaceChildren(questionText);
}

// First: fetch main image container
fetch('/html-templates/party-games/card-container/main-image-container.html')
    .then(res => res.text())
    .then(async (mainHTML) => {
        const parser = new DOMParser();
        const mainDoc = parser.parseFromString(mainHTML, 'text/html');

        // Clone base for private
        const privateDoc = parser.parseFromString(mainHTML, 'text/html');
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
        dualDoc.querySelector('.main-image-container').appendChild(dualStackEl);
        const withDualStackHTML = dualDoc.body.innerHTML;

        // Insert HTML into each container
        appendCardMarkup(cardContainerPrivate, baseHTML);
        appendCardMarkup(cardContainerPublic, withStackHTML);
        appendCardMarkup(cardContainerDualStack, withDualStackHTML);

        if (placeholderCardContainer?.dataset.online === "false") {
            placeholderCardContainer
                .querySelectorAll('.main-image-container')
                .forEach((container) => container.classList.add('offline-card-face'));
        }

        if (placeholderCardContainer?.dataset.online === "true" && typeof AddTimerToContainer === 'function') {
            [cardContainerPrivate, cardContainerPublic, cardContainerDualStack]
                .filter(Boolean)
                .forEach((container) => {
                    AddTimerToContainer(container.querySelector('.main-image-container'));
                });
        }

        return fetch('/html-templates/party-games/card-container/gamemode-text-container.html');
    })
    .then(response => response.text())
    .then(async html => {
        const updatedHTML = await buildGamemodeTextMarkup(cardContainerGamemode, html);

        appendCardMarkup(cardContainerPublic, updatedHTML);
        appendCardMarkup(cardContainerDualStack, updatedHTML);
        appendCardMarkup(cardContainerPrivate, updatedHTML);

        if (placeholderCardContainer?.dataset.online === "false") {

            if (cardContainerGamemode === 'truth-or-dare') {
                const scriptGetNextQuestion = document.createElement('script');
                scriptGetNextQuestion.src = versionAssetUrl(`/scripts/party-games/gamemode/online/truth-or-dare/get-next-question.js`);
                document.body.appendChild(scriptGetNextQuestion);
            }
            else if (cardContainerGamemode != 'imposter') {
                const scriptGetNextQuestion = document.createElement('script');
                scriptGetNextQuestion.src = versionAssetUrl(`/scripts/party-games/general/get-next-question.js`);
                document.body.appendChild(scriptGetNextQuestion);
            }
        }

        if (cardContainerPublic != null) {
            gameContainerPublicTitle = cardContainerPublic.querySelector('.content .gamemode-text-svg');
            gameContainerPublicText = cardContainerPublic.querySelector('.content .main-image-container .text-container');
            gameContainerPublicCardType = cardContainerPublic.querySelector('.content .main-image-container .card-type-text');

            setCardPlaceholderText(gameContainerPublicText, placeholderCardContainer.dataset.gamemode);
            if (cardContainerPublic.getAttribute('data-text-size') === 'large') {
                gameContainerPublicText.classList.add('large');
            }

            gameContainerPublicCardType.textContent = '';
        }
        if (cardContainerPrivate != null) {
            gameContainerPrivateTitle = cardContainerPrivate.querySelector('.content .gamemode-text-svg');
            gameContainerPrivateText = cardContainerPrivate.querySelector('.content .main-image-container .text-container');
            gameContainerPrivateCardType = cardContainerPrivate.querySelector('.content .main-image-container .card-type-text');

            setCardPlaceholderText(gameContainerPrivateText, placeholderCardContainer.dataset.gamemode);
            if (cardContainerPrivate.getAttribute('data-text-size') === 'large') {
                gameContainerPrivateText.classList.add('large');
            }

            gameContainerPrivateCardType.textContent = '';
        }
        if (cardContainerDualStack != null) {
            gameContainerDualStackTitle = cardContainerDualStack.querySelector('.content .gamemode-text-svg');
            gameContainerDualStackText = cardContainerDualStack.querySelector('.content .main-image-container .text-container');
            gameContainerDualStackCardType = cardContainerDualStack.querySelector('.content .main-image-container .card-type-text');

            setCardPlaceholderText(gameContainerDualStackText, placeholderCardContainer.dataset.gamemode);
            if (cardContainerDualStack.getAttribute('data-text-size') === 'large') {
                gameContainerDualStackText.classList.add('large');
            }


            gameContainerDualStackCardType.textContent = '';
        }
    })
    .then(() => {
        // load game scripts here
        // const scriptGamemodeOnline = document.createElement('script');
        // scriptGamemodeOnline.src = `/scripts/party-games/${cardContainerGamemode}/${cardContainerGamemode}-online.js`;
        // document.body.appendChild(scriptGamemodeOnline);
        (async () => {
            //await LoadScript(`/scripts/party-games/gamemode/online/${placeHolderSelectedUser.dataset.template}/${placeHolderSelectedUser.dataset.template}-online.js?30082025`);
        })();
    }).then(() => {
        SetScriptLoaded('/scripts/html-templates/online/card-container-template.js');

    })
    .catch(error => console.error('Error loading templates:', error));
