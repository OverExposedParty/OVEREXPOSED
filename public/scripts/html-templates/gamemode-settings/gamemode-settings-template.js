const partyGamesInformation = {
  "truth-or-dare": {
    partyType: "party-game-truth-or-dare",
    playerCountRestrictions: {
      minPlayers: 2,
      maxPlayers: 20
    },
    gamemodeColours: {
      primary: "#66CCFF",
      secondary: "#427BB9"
    },
    forceOnline: false
  },
  "paranoia": {
    partyType: "party-game-paranoia",
    playerCountRestrictions: {
      minPlayers: 3,
      maxPlayers: 15
    },
    gamemodeColours: {
      primary: "#9D8AFF",
      secondary: "#7F71B2"
    },
    forceOnline: false
  },
  "never-have-i-ever": {
    partyType: "party-game-never-have-i-ever",
    playerCountRestrictions: {
      minPlayers: 2,
      maxPlayers: 20
    },
    gamemodeColours: {
      primary: "#FF9266",
      secondary: "#B96542"
    },
    forceOnline: false
  },
  "most-likely-to": {
    partyType: "party-game-most-likely-to",
    playerCountRestrictions: {
      minPlayers: 3,
      maxPlayers: 20
    },
    gamemodeColours: {
      primary: "#FFEE66",
      secondary: "#B9AA42"
    },
    forceOnline: false
  },
  "imposter": {
    partyType: "party-game-imposter",
    playerCountRestrictions: {
      minPlayers: 3,
      maxPlayers: 16
    },
    gamemodeColours: {
      primary: "#3DA7A1",
      secondary: "#2A6E6A"
    },
    forceOnline: false
  },
  "would-you-rather": {
    partyType: "party-game-would-you-rather",
    playerCountRestrictions: {
      minPlayers: 2,
      maxPlayers: 20
    },
    gamemodeColours: {
      primary: "#7CFFB2",
      secondary: "#55B97F"
    },
    forceOnline: false
  },
  "mafia": {
    partyType: "party-game-mafia",
    playerCountRestrictions: {
      minPlayers: 5,
      maxPlayers: 20
    },
    gamemodeColours: {
      primary: "#9B56D3",
      secondary: "#6D3C95"
    },
    forceOnline: true
  }
};

let userCount = document.querySelector('.user-count');

let packsContainer, rulesContainer, onlineSettingsContainer;
const placeholderGamemodeSettings = document.getElementById('gamemode-settings-placeholder');
const cssFilesGamemodeSettings = [
  '/css/general/online/party-code-controls.css',
  '/css/party-games/gamemode-settings-page-styles.css',
  '/css/party-games/mode-selection.css',
  '/css/other/settings-shell.css'
];

cssFilesGamemodeSettings.forEach(href => {
  LoadStylesheet(href);
});

let gamemodeSettingsTemplateLoadedReported = false;

function reportGamemodeSettingsTemplateLoaded() {
  if (gamemodeSettingsTemplateLoadedReported) return;
  gamemodeSettingsTemplateLoadedReported = true;
  if (window.OEUsesPhasedLoader) return;
  SetScriptLoaded('/scripts/html-templates/gamemode-settings/gamemode-settings-template.js');
}

const gamemodeSettingsTemplateReady = fetch('/html-templates/gamemode-settings.html')
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
    packsContainer = document.querySelector('.packs-container');
    rulesContainer = document.querySelector('.rules-settings-container');
    onlineSettingsContainer = document.querySelector('.online-game-settings-container');

    userCount = document.querySelector('.user-count');

    window.gamemodeSettings = {};
    window.gamemodeSelectedPacks = [];
    window.gamemodeRoleCounts = {};
    window.allUsersReady = undefined;
    window.onlinePlayerCountRestrictionsMet = true;

    window.startGameButton = document.querySelector('.start-game-button');
    window.warningBox = document.getElementById('warning-box');
    window.warningStartButton = document.querySelector('.start-game-warning-button');
    window.inputPartyCode = document.getElementById('party-code');
    window.copyPartyCodeButton = document.getElementById('party-code-copy-button');
    window.qrCodeButton = document.getElementById('qr-code-button');

  }).then(() => {
    if (placeholderGamemodeSettings.dataset.template === 'waiting-room') return;

    return LoadScript(
      '/scripts/html-templates/gamemode-settings/mode-selection-template.js',
      { cacheBustKey: 'PARTY_GAMES_SETTINGS' }
    )
      .then(() =>
        LoadScript(
          '/scripts/party-games/gamemode-settings/play-mode-selection.js',
          { cacheBustKey: 'PARTY_GAMES_SETTINGS' }
        )
      )
      .then(() => window.initializeModeSelection());
  }).then(() => {
    reportGamemodeSettingsTemplateLoaded();
  }).catch(error => {
    console.error('Error loading gamemode settings template:', error);
    reportGamemodeSettingsTemplateLoaded();
    throw error;
  });

if (window.OEReady) {
  window.OEReady.register('gamemode-settings-template', gamemodeSettingsTemplateReady);
}
