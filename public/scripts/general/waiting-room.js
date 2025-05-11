const enterUsernameContainer = document.getElementById('enter-username');
const waitingForLeaderContainer = document.getElementById('waiting-for-leader');
const partyDoesNotExistContainer = document.getElementById('party-does-not-exist');
const partySessionInProgressContainer = document.getElementById('party-session-in-progress');
const userKickedContainer = document.getElementById('user-kicked');
const partyFullContainer = document.getElementById('party-full');

const partyUsernameInput = document.getElementById('party-username');
const partyUsernameInputSet = document.getElementById('party-username-waiting');

const buttonSubmitUsername = document.getElementById('submit-username');


const gamemodeColors = {
    "Truth Or Dare": "#66CCFF",
    "Paranoia": "#9D8AFF",
    "Never Have I Ever": "#FF9266",
    "Most Likely To": "#FFEE66",
};

const gameContainers = [
    enterUsernameContainer,
    waitingForLeaderContainer,
    partyDoesNotExistContainer,
    partySessionInProgressContainer,
    userKickedContainer
];


const url = window.location.href;
const segments = url.split('/');
partyCode = segments.pop() || segments.pop(); // handle trailing slash

waitingForHost = true;

async function checkPartyExists() {
    overlay.classList.add('active');
    const response = await fetch(`/api/party-games?partyCode=${partyCode}`);
    const data = await response.json();
    console.log(data);
    if (data.length > 0) {
        const color = gamemodeColors[data[0].gamemode];
        if (color) {
            document.documentElement.style.setProperty('--primarypagecolour', color);
        }
        if (data[0].isPlaying === false) {
            if (data[0].computerIds.length >= 8) {
                if (data[0].computerIds.includes(deviceId)) {
                    enterUsernameContainer.classList.add('active')
                    await UpdateUserPartyData({
                        partyId: partyCode,
                        computerId: deviceId,
                        newUsername: "Player" + data[0].computerIds.indexOf(deviceId),
                        newUserReady: false
                    });
                    console.log("partyCode: " + partyCode);
                }
                else{
                    partyFullContainer.classList.add('active');
                }
            }
            else {
                enterUsernameContainer.classList.add('active')
                addElementIfNotExists(permanantElementClassArray, enterUsernameContainer);
                if (data[0].computerIds.includes(deviceId)) {
                    await UpdateUserPartyData({
                        partyId: partyCode,
                        computerId: deviceId,
                        newUsername: "NewName",
                        newUserReady: false
                    });
                    console.log("partyCode: " + partyCode);
                }
                else {
                    addUserToParty({
                        partyId: partyCode,
                        newComputerId: deviceId,
                        newUsername: 'Player ' + (data[0].usernames.length + 1),
                        newUserReady: false
                    });
                }
            }
        }
        else {
            partySessionInProgressContainer.classList.add('active')
            addElementIfNotExists(permanantElementClassArray, partySessionInProgressContainer);
        }
    } else {
        partyDoesNotExistContainer.classList.add('active')
        addElementIfNotExists(permanantElementClassArray, partyDoesNotExistContainer);
    }
}
async function getPartyData() {
    const response = await fetch(`/api/party-games?partyCode=${partyCode}`);
    const data = await response.json();

    return data[0];
}

checkPartyExists(partyCode);

buttonSubmitUsername.addEventListener('click', async function () {
    const username = partyUsernameInput.value.trim();

    if (username === '') {
        console.log('Username is empty');
        return;
    }

    const partyData = await getPartyData();
    const usernames = partyData.usernames || [];

    // Check if the username is already taken
    if (!usernames.includes(username)) {
        enterUsernameContainer.classList.remove('active');
        partyUsernameInputSet.value = username;
        waitingForLeaderContainer.classList.add('active');

        // Update user party data here
        await UpdateUserPartyData({
            partyId: partyCode,
            computerId: deviceId,
            newUsername: username,
            newUserReady: true
        });

        console.log('Username submitted and UpdateUserPartyData called');
    } else {
        console.log('Username already taken');
    }
});

if (partyCode) {
    socket.emit("join-party", partyCode);
}

function KickUser() {
    enterUsernameContainer.classList.remove('active')
    userKickedContainer.classList.add('active')
}
