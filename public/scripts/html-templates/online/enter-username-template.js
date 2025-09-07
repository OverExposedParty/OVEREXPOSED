let buttonSubmitUsername, usernameInput, usernameCountDisplay, enterUsernameContainer;

//waiting room
let waitingForLeaderContainer;

const usernameMaxLength = 16;

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
            if (!CheckUsernameIsValid(username)) {
                return;
            }
            const data = await getExistingPartyData(partyCode);
            const currentPartyData = data[0];
            const usernames = currentPartyData.players.map(player => player.username.toUpperCase());
            if (!usernames.includes(username)) {
                enterUsernameContainer.classList.remove('active');
                removeElementIfExists(permanantElementClassArray, enterUsernameContainer);
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
                setActiveContainers(userCustomisationContainer);
                onlineUsername = username;
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
            if (!isValidString(usernameInput.value) && remaining != usernameMaxLength) {
                setError(errorUsernameInvalid, true);
            } else {
                setError(errorUsernameInvalid, false);
            }

            if (CheckErrors()) {
                buttonSubmitUsername.classList.remove('disabled');
            }
            else {
                buttonSubmitUsername.classList.add('disabled');
            }
        });
    })
    .catch(error => console.error('Error loading header:', error));