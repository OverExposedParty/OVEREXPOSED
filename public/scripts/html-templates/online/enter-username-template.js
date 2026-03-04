let buttonSubmitUsername, usernameInput, usernameCountDisplay, enterUsernameContainer;

//waiting room
let waitingForLeaderContainer;

const usernameMaxLength = 16;
const ONLINE_USERNAME_STORAGE_KEY = 'online-username';
const USERNAME_ALLOWED_PATTERN = /^[A-Za-z0-9_]+$/;

function isValidUsernameInput(value) {
    return USERNAME_ALLOWED_PATTERN.test(value);
}

function isValidUsernameSubmit(username) {
    if (username === '') return false;
    if (username.length > usernameMaxLength) return false;
    return USERNAME_ALLOWED_PATTERN.test(username);
}

function hasNoActiveErrors() {
    if (typeof CheckErrors === 'function') {
        return CheckErrors();
    }
    const activeError = document.querySelector('.error-container .error-box.active');
    return !activeError;
}

function waitForUserCustomisationContainer({ timeout = 3000 } = {}) {
    return new Promise((resolve) => {
        const start = performance.now();

        function tick() {
            const container = (typeof userCustomisationContainer !== 'undefined' && userCustomisationContainer)
                ? userCustomisationContainer
                : document.querySelector('.user-customisation-container');

            if (container && container.classList) {
                return resolve(container);
            }

            if (performance.now() - start > timeout) {
                return resolve(null);
            }
            requestAnimationFrame(tick);
        }

        tick();
    });
}

const cssFilesEnterUsername = [
    '/css/general/online/enter-username.css'
];

cssFilesEnterUsername.forEach(href => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    document.head.appendChild(link);
});

fetch('/html-templates/online/enter-username.html')
    .then(response => response.text())
    .then(data => {
        const placeholderEnterUsername = document.getElementById('enter-username-placeholder');
        placeholderEnterUsername.innerHTML = data;

        buttonSubmitUsername = document.getElementById('submit-username');
        usernameInput = document.getElementById('party-username');
        usernameCountDisplay = document.querySelector('.enter-username-container .input-container .input-count');
        enterUsernameContainer = document.querySelector('.enter-username-container');

        const savedUsername = localStorage.getItem(ONLINE_USERNAME_STORAGE_KEY);
        if (savedUsername && USERNAME_ALLOWED_PATTERN.test(savedUsername) && savedUsername.length <= usernameMaxLength) {
            usernameInput.value = savedUsername.toUpperCase();
        }

        if (placeholderEnterUsername.dataset.template === 'waiting-room') {
            gameContainers.push(
                enterUsernameContainer,
            );
        }


        const enterUsernameScript = document.createElement('script');
        enterUsernameScript.src = '/scripts/party-games/online/enter-username.js';
        enterUsernameScript.defer = true;
        document.body.appendChild(enterUsernameScript);
    }).then(() => {
        buttonSubmitUsername.addEventListener('click', async function () {
            const username = usernameInput.value.trim().toUpperCase();
            const isValid = (typeof CheckUsernameIsValid === 'function')
                ? CheckUsernameIsValid(username)
                : isValidUsernameSubmit(username);
            if (!isValid) {
                return;
            }
            const data = await getExistingPartyData(partyCode);
            const currentPartyData = data[0];
            const usernames = currentPartyData.players.map(player => player.identity.username.toUpperCase());
            if (!usernames.includes(username)) {
                enterUsernameContainer.classList.remove('active');

                await UpdateUserPartyData({
                    partyId: partyCode,
                    computerId: deviceId,
                    newUserIcon: "0000:0100:0200:0300",
                    newUsername: username
                });
                if (!hostedParty) {
                    await sendPartyChat({
                        username: "[CONSOLE]",
                        message: `${username} has joined the party.`,
                        eventType: "connect"
                    });
                }
                const customisationContainer = await waitForUserCustomisationContainer();
                if (!customisationContainer) {
                    console.error('User customisation container was not ready after username submit.');
                    return;
                }

                addElementIfNotExists(gameContainers, customisationContainer);
                setActiveContainers(customisationContainer);
                addElementIfNotExists(permanantElementClassArray, customisationContainer);
                removeElementIfExists(permanantElementClassArray, enterUsernameContainer);
                onlineUsername = username;
                localStorage.setItem(ONLINE_USERNAME_STORAGE_KEY, username);
            }
            else {
                setError(errorUsernameTaken, true)
                buttonSubmitUsername.classList.add('disabled');
            }
        });

        usernameInput.setAttribute('maxlength', usernameMaxLength);
        usernameInput.addEventListener('input', () => {
            const remaining = usernameMaxLength - usernameInput.value.length;
            usernameCountDisplay.textContent = remaining >= 0 ? remaining : 0;
            setError(errorUsernameTaken, false);
            if (remaining == usernameMaxLength) {
                setError(errorUsernameEmpty, true)
            }
            else {
                setError(errorUsernameEmpty, false)
            }
            if (!isValidUsernameInput(usernameInput.value) && remaining != usernameMaxLength) {
                setError(errorUsernameInvalid, true);
            } else {
                setError(errorUsernameInvalid, false);
            }

            if (hasNoActiveErrors()) {
                buttonSubmitUsername.classList.remove('disabled');
            }
            else {
                buttonSubmitUsername.classList.add('disabled');
            }
        });
        usernameInput.dispatchEvent(new Event('input'));
    }).then(() => {
        SetScriptLoaded('/scripts/html-templates/online/enter-username-template.js');
    })
    .catch(error => console.error('Error loading header:', error));
