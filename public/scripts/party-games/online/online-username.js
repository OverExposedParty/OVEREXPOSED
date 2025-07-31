const buttonSubmitUsername = document.getElementById('submit-username');
const usernameInput = document.getElementById('party-username');
const usernameCountDisplay = document.querySelector('.waiting-container .input-container .input-count');
const usernameMaxLength = 16;

const errorUsernameEmpty = document.getElementById('error-username-empty');
const errorUsernameInvalid = document.getElementById('error-username-invalid');
const errorUsernameTaken = document.getElementById('error-username-taken');

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
        toggleOverlay(false);
        if (waitingForHost) {
            partyUsernameInputSet.value = username;
            setActiveContainers(waitingForLeaderContainer);
        }
        await UpdateUserPartyData({
            partyId: partyCode,
            computerId: deviceId,
            newUsername: username,
            newUserReady: true
        });
    }
    else{
        errorUsernameTaken.classList.add('active');
        buttonSubmitUsername.classList.add('disabled');
    }
});

function CheckUsernameIsValid(username) {
    const isValidCharacters = /^[A-Z0-9_]+$/.test(username);

    if (username === '') {
        console.log('Username is empty');
        return false;
    }
    if (username.length > usernameMaxLength) {
        console.log('Username is too long');
        return false;
    }
    if (!isValidCharacters) {
        console.log('Username must not contain spaces or special characters');
        return false;
    }
    return true;
}

usernameInput.setAttribute('maxlength', usernameMaxLength);
usernameInput.addEventListener('input', () => {
    const remaining = usernameMaxLength - usernameInput.value.length;
    usernameCountDisplay.textContent = remaining >= 0 ? remaining : 0;
    errorUsernameTaken.classList.remove('active');
    if (remaining == usernameMaxLength) {
        errorUsernameEmpty.classList.add('active');
    }
    else {
        errorUsernameEmpty.classList.remove('active');
    }
    if (!isValidString(usernameInput.value) && remaining != usernameMaxLength) {
        errorUsernameInvalid.classList.add('active');
    } else {
        errorUsernameInvalid.classList.remove('active');
    }

    if (CheckErrors()) {
        buttonSubmitUsername.classList.remove('disabled');
    }
    else {
        buttonSubmitUsername.classList.add('disabled');
    }
});

function isValidString(str) {
    return /^[A-Za-z0-9_]+$/.test(str);
}

