let errorNoPacksSelected, errorNotEnoughPlayers;
let errorUsernameTaken, errorUsernameEmpty, errorUsernameInvalid;
let errorMafiaCount, errorMafiaNone;

const placeholderErrorContainer = document.getElementById('placeholder-error-container');

const cssFilesErrorContainer = [
    '/css/party-games/online-error.css'
];

cssFilesErrorContainer.forEach(href => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    document.head.appendChild(link);
});

if (placeholderErrorContainer.classList.contains('gamemode-settings')) {
    fetch('/html-templates/error-boxes/gamemode-settings.html')
        .then(response => response.text())
        .then(data => {
            placeholderErrorContainer.insertAdjacentHTML('beforeend', data);

            errorNoPacksSelected = document.getElementById('error-no-packs-selected');
            errorNotEnoughPlayers = document.getElementById('error-not-enough-players');

        })
        .catch(error => console.error('Error loading user gamemode settings error boxes:', error));
}

if (placeholderErrorContainer.classList.contains('mafia-gamemode-settings')) {
    fetch('/html-templates/error-boxes/mafia-gamemode-settings.html')
        .then(response => response.text())
        .then(data => {

            placeholderErrorContainer.insertAdjacentHTML('beforeend', data);

            errorMafiaCount = document.getElementById('error-mafia-count');
            errorMafiaNone = document.getElementById('error-mafia-none');

        })
        .catch(error => console.error('Error loading user gamemode settings error boxes:', error));
}

if (placeholderErrorContainer.classList.contains('username')) {
    fetch('/html-templates/error-boxes/username.html')
        .then(response => response.text())
        .then(data => {
            placeholderErrorContainer.insertAdjacentHTML('beforeend', data);

            errorUsernameTaken = document.getElementById('error-username-taken');
            errorUsernameEmpty = document.getElementById('error-username-empty');
            errorUsernameInvalid = document.getElementById('error-username-invalid');
        })
        .catch(error => console.error('Error loading username error boxes:', error));
}

function setError(element, isActive) {
    element.classList.toggle('active', isActive);
}

function CheckErrorNotEnoughPlayers(){
    if(errorNotEnoughPlayers.classList.contains('active')){
        return true;
    }
    else{
        return false;
    }
}