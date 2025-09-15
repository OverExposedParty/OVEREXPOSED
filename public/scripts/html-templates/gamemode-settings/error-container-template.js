let errorNoPacksSelected, errorNotEnoughPlayers;
let errorUsernameTaken, errorUsernameEmpty, errorUsernameInvalid;
let errorMafiaCount, errorMafiaNone;

const errorContainertasks = [];

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
  errorContainertasks.push(
    fetch('/html-templates/error-boxes/gamemode-settings.html')
      .then(r => r.text())
      .then(data => {
        placeholderErrorContainer.insertAdjacentHTML('beforeend', data);
        errorNoPacksSelected = document.getElementById('error-no-packs-selected');
        errorNotEnoughPlayers = document.getElementById('error-not-enough-players');
      })
  );
}

if (placeholderErrorContainer.classList.contains('mafia-gamemode-settings')) {
  errorContainertasks.push(
    fetch('/html-templates/error-boxes/mafia-gamemode-settings.html')
      .then(r => r.text())
      .then(data => {
        placeholderErrorContainer.insertAdjacentHTML('beforeend', data);
        errorMafiaCount = document.getElementById('error-mafia-count');
        errorMafiaNone = document.getElementById('error-mafia-none');
      })
  );
}

if (placeholderErrorContainer.classList.contains('username')) {
  errorContainertasks.push(
    fetch('/html-templates/error-boxes/username.html')
      .then(r => r.text())
      .then(data => {
        placeholderErrorContainer.insertAdjacentHTML('beforeend', data);
        errorUsernameTaken = document.getElementById('error-username-taken');
        errorUsernameEmpty = document.getElementById('error-username-empty');
        errorUsernameInvalid = document.getElementById('error-username-invalid');
      })
  );
}

Promise.all(errorContainertasks).then(() => {
  SetScriptLoaded('/scripts/html-templates/gamemode-settings/error-container-template.js');
}).catch(err => console.error('Error loading error boxes:', err));

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