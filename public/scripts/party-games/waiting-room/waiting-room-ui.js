function KickUser() {
  if (window.OESessionStatusPrompts?.showKicked) {
    window.OESessionStatusPrompts.showKicked();
    return;
  }

  window.PartyChatReady?.then((partyChat) => {
    partyChat?.setAvailable?.(false);
  });
  hideContainer(gamemodeSettingsContainer);
  setActiveContainers(userKickedContainer);
}

function replaceFaviconLink(linkId, href) {
  const existingLink = document.getElementById(linkId);
  if (!existingLink) {
    return;
  }

  const nextLink = existingLink.cloneNode(true);
  nextLink.href = versionAssetUrl(href, {
    cacheBustKey: 'PARTY_GAMES_WAITING_ROOM'
  });
  existingLink.replaceWith(nextLink);
}

function changeFavicon(gamemode, variant = 'lobby') {
  const faviconBasePath = `/images/meta/favicons/party-games/${gamemode}/${variant}`;
  replaceFaviconLink('favicon-ico', `${faviconBasePath}/favicon.ico`);
  replaceFaviconLink('favicon-16', `${faviconBasePath}/favicon-16x16.png`);
  replaceFaviconLink('favicon-32', `${faviconBasePath}/favicon-32x32.png`);
  replaceFaviconLink(
    'favicon-apple',
    `${faviconBasePath}/apple-touch-icon.png`
  );
  replaceFaviconLink('favicon-manifest', `${faviconBasePath}/site.webmanifest`);
}

function setDisbandedFavicons() {
  const faviconBasePath =
    '/images/meta/favicons/party-games/party-does-not-exist';
  replaceFaviconLink('favicon-ico', `${faviconBasePath}/favicon.ico`);
  replaceFaviconLink('favicon-16', `${faviconBasePath}/favicon-16x16.png`);
  replaceFaviconLink('favicon-32', `${faviconBasePath}/favicon-32x32.png`);
  replaceFaviconLink(
    'favicon-apple',
    `${faviconBasePath}/apple-touch-icon.png`
  );
  replaceFaviconLink('favicon-manifest', `${faviconBasePath}/site.webmanifest`);
}

async function SetGamemodeContainer() {
  await UpdateGamemodeContainer();
  onlineSettingsTab.classList.remove('disabled');
  rulesContainer.querySelectorAll('button').forEach((button) => {
    if (hasRestriction(button.dataset.settingsRestriction, 'offline')) {
      button.classList.add('inactive');
    }
  });
  rulesContainer.querySelectorAll('.increment-container').forEach((button) => {
    if (hasRestriction(button.dataset.settingsRestriction, 'offline')) {
      button.classList.add('inactive');
    }
  });
  inputPartyCode = inputPartyCode || document.getElementById('party-code');
  if (inputPartyCode) {
    inputPartyCode.value = partyCode;
  }
  bindPartyCodeActionButtonsWithRetry();
}

function CreateGameSettingsButtonsScript() {
  const script = document.createElement('script');
  script.src = versionAssetUrl(
    '/scripts/party-games/gamemode-settings/game-settings-buttons.js'
  );
  script.type = 'text/javascript';
  script.onload = () => {
    if (typeof initializeGamemodeSettingsWhenReady === 'function') {
      initializeGamemodeSettingsWhenReady().catch((error) => {
        console.error('Failed to initialize waiting-room settings:', error);
      });
    }
  };
  document.body.appendChild(script);
}

async function UpdateGamemodeContainer() {
  if (!partyCode) {
    return;
  }
  currentPartyData = await getWaitingRoomPartyData();
  if (!currentPartyData) return;

  const config = currentPartyData.config;

  if (typeof UpdateUserIcons === 'function') {
    await UpdateUserIcons(currentPartyData);
  }

  const selectedPacks = Array.isArray(config.selectedPacks)
    ? config.selectedPacks
    : [];
  const roleCounts =
    config.roleCounts && typeof config.roleCounts === 'object'
      ? config.roleCounts
      : {};
  const gameRules = config.gameRules || {};

  packsContainer.querySelectorAll('button').forEach((button) => {
    const key = button.dataset.key;
    const inPacks = selectedPacks.includes(key);

    if (inPacks) {
      button.classList.add('active');
    } else {
      button.classList.remove('active');
    }
    SetButtonStyle(button, false);
  });

  packsContainer
    .querySelectorAll('.increment-container[data-content-type="role"]')
    .forEach((container) => {
      const key = container.dataset.key;
      const value = roleCounts[key];

      if (typeof value === 'number') {
        container.dataset.count = value;
        const display = container.querySelector('.count-display');
        if (display) {
          display.textContent = value;
        }
      }
    });

  rulesContainer.querySelectorAll('.increment-container').forEach((button) => {
    const key = button.dataset.key;
    const value = gameRules[key];

    if (typeof value === 'number') {
      button.dataset.count = value;
      const display = button.querySelector('.count-display');
      if (display) {
        display.textContent = value;
      }
    }
  });

  rulesContainer.querySelectorAll('button').forEach((button) => {
    const key = button.dataset.key;
    const raw = gameRules[key];
    const isActive = raw === true || raw === 'true';
    button.classList.toggle('active', isActive);
    SetButtonStyle(button, false);
  });
}

function PartyDisbanded() {
  window.PartyChatReady?.then((partyChat) => {
    partyChat?.setAvailable?.(false);
  });
  stopWaitingRoomDisbandMonitor();
  document.documentElement.style.setProperty('--primarypagecolour', '#999999');
  document.documentElement.style.setProperty(
    '--secondarypagecolour',
    '#666666'
  );
  setDisbandedFavicons();
  hideContainer(gamemodeSettingsContainer);
  hideContainer(partySessionInProgressContainer);
  hideContainer(userKickedContainer);
  hideContainer(partyFullContainer);
  hideContainer(lateJoinBriefingContainer);
  showContainer(partyDisbandedContainer);
}
