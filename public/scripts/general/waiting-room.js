const enterUserNameContainer = document.getElementById('enter-username');
const waitingForLeaderContainer = document.getElementById('waiting-for-leader');
const partyDoesNotExistContainer = document.getElementById('party-does-not-exist');
const partySessionInProgressContainer = document.getElementById('party-session-in-progress');

const partyUsernameInput = document.getElementById('party-username');
const partyUsernameInputSet = document.getElementById('party-username-waiting');

const buttonSubmitUsername = document.getElementById('submit-username');

const gamemodeColors = {
    "Truth Or Dare": "#66CCFF",
    "Paranoia": "#9D8AFF",
    "Never Have I Ever": "#FF9266",
    "Most Likely To": "#FFEE66",
};

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
            enterUserNameContainer.classList.add('active')
            if (data[0].computerIds.includes(deviceId)) {
                console.log("boooom: " + deviceId);
                await UpdateUserPartyData({
                    partyId: partyCode,  // make sure this variable is defined
                    computerId: deviceId,  // or just `deviceId`
                    newUsername: "NewName", // keeps usersReady unchanged
                    newUserReady: false
                });
                console.log("partyCode: " + partyCode);
            }
            else {
                addUserToParty({
                    partyId: partyCode,
                    newComputerId: deviceId,
                    newUsername: 'Player ' + data[0].usernames.length + 1,
                    newUserReady: false
                });
            }
            console.log("DEVICE_ID: " + deviceId);
        }
        else {
            partySessionInProgressContainer.classList.add('active')
        }
    } else {
        partyDoesNotExistContainer.classList.add('active')
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
        enterUserNameContainer.classList.remove('active');
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

  
