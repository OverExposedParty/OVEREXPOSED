let userCount = document.querySelector('.user-count');

let packsContainer, settingsContainer, onlineSettingsContainer;
const placeholderGamemodeSettings = document.getElementById('gamemode-settings-placeholder');
const cssFilesGamemodeSettings = [
  '/css/party-games/gamemode-settings-page-styles.css',
  '/css/party-games/online-error.css'
];

cssFilesGamemodeSettings.forEach(href => {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  document.head.appendChild(link);
});

fetch('/html-templates/gamemode-settings.html')
  .then(response => response.text())
  .then(data => {
    return new Promise(resolve => {
      placeholderGamemodeSettings.insertAdjacentHTML('beforeend', data);
      requestAnimationFrame(() => {
        resolve();
      });
    });
  })
  .then(() => {

    if (placeholderGamemodeSettings.dataset.template) {
      const gamemodeName = placeholderGamemodeSettings.dataset.template
        .replace(/-/g, ' ')
        .replace(/\b\w/g, char => char.toUpperCase());

      const packHeader = placeholderGamemodeSettings.querySelector('.packs-container .header-container h2');
      if (packHeader) {
        if (gamemodeName == "Mafia") {
          packHeader.textContent = gamemodeName + " Roles";
        }
        else {
          packHeader.textContent = gamemodeName + " Packs";
        }
      }
    }
    if (placeholderGamemodeSettings.dataset.template != "waiting-room") {
      const scriptGameSettingsButton = document.createElement('script');
      scriptGameSettingsButton.src = '/scripts/party-games/gamemode-settings/game-settings-buttons.js';
      document.body.appendChild(scriptGameSettingsButton);

      const scriptGameSettings = document.createElement('script');
      scriptGameSettings.src = '/scripts/party-games/gamemode-settings/gamemode-settings.js';
      scriptGameSettings.defer = true;
      document.body.appendChild(scriptGameSettings);
    }

    packsContainer = document.querySelector('.packs-container');
    settingsContainer = document.querySelector('.settings-container');
    onlineSettingsContainer = document.querySelector('.online-game-settings-container');

    userCount = document.querySelector('.user-count');
  }).then(() => {
    const storageObserver = new LocalStorageObserver();
    storageObserver.addListener((key, oldValue, newValue) => {
      if (key === 'settings-nsfw') {
        console.log(`The value of '${key}' changed from '${oldValue}' to '${newValue}'`);
        if (oldValue !== newValue) {
          eighteenPlusEnabled = newValue;
          SetGamemodeButtons();
          console.log(`Value changed! Now NSFW is set to: ${newValue}`);
        }
      }
    });
    const helpContainerFile = "party-games-settings/" + placeholderGamemodeSettings.dataset.template + '.json';
    waitForFunction("FetchHelpContainer", () => {
      FetchHelpContainer(helpContainerFile);
    });
  })
  .catch(error => console.error('Error loading user customization:', error));