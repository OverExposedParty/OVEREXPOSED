// ---------- Utility helpers ----------

function generatePartyCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';

  for (let i = 0; i < 3; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  code += '-';

  for (let i = 0; i < 3; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function formatPackName(name) {
  return name.toLowerCase().replace(/\s+/g, '-');
}

function PartyDisbanded() {
  try {
    if (window.OESessionStatusPrompts?.showDisbanded) {
      window.OESessionStatusPrompts.showDisbanded({
        useActiveContainers: Boolean(gameContainers)
      });
      return;
    }

    window.PartyChatReady?.then((partyChat) => {
      partyChat?.setAvailable?.(false);
    });

    const waitingRoomContainer = document.querySelector(
      '.waiting-room-container'
    );
    const waitingRoomDisbandedContainer = document.getElementById(
      'party-disbanded-container'
    );

    if (waitingRoomContainer && waitingRoomDisbandedContainer) {
      document.documentElement.style.setProperty(
        '--primarypagecolour',
        '#999999'
      );
      document.documentElement.style.setProperty(
        '--secondarypagecolour',
        '#666666'
      );
      setPartyDoesNotExistFavicons();
      hideContainer(waitingRoomContainer);
      hideContainer(document.getElementById('party-session-in-progress'));
      hideContainer(document.getElementById('user-kicked'));
      hideContainer(document.getElementById('party-full'));
      showContainer(waitingRoomDisbandedContainer);
    }

    if (gameContainers) {
      if (!isContainerVisible(partyGameStatisticsContainer)) {
        setActiveContainers(partyDisbandedContainer);
      }
    }

  } catch (e) {}
}

function ensureOnlineStatusContainer({ id, title, description = '' }) {
  let container = document.getElementById(id);

  if (!container) {
    container = document.createElement('div');
    container.id = id;
    const mainContainer = document.querySelector('.main-container');
    (mainContainer || document.body).appendChild(container);
  }

  container.className = 'online-status-container';
  const contentContainer = document.createElement('div');
  contentContainer.className = 'content-container';

  const heading = document.createElement('h1');
  heading.textContent = title;
  contentContainer.appendChild(heading);

  if (description) {
    const descriptionElement = document.createElement('p');
    descriptionElement.textContent = description;
    contentContainer.appendChild(descriptionElement);
  }

  container.replaceChildren(contentContainer);

  return container;
}

function replaceHeadLink(selector, href, cacheBustKey = null) {
  const existingLink = document.querySelector(selector);
  if (!existingLink) return;

  const nextLink = existingLink.cloneNode(true);
  nextLink.href =
    typeof versionAssetUrl === 'function'
      ? versionAssetUrl(href, { cacheBustKey })
      : href;
  existingLink.replaceWith(nextLink);
}

function setPartyDoesNotExistFavicons() {
  const faviconBasePath =
    '/images/meta/favicons/party-games/party-does-not-exist';

  replaceHeadLink(
    'link[rel="icon"][type="image/x-icon"]',
    `${faviconBasePath}/favicon.ico`
  );
  replaceHeadLink(
    'link[rel="icon"][sizes="16x16"]',
    `${faviconBasePath}/favicon-16x16.png`
  );
  replaceHeadLink(
    'link[rel="icon"][sizes="32x32"]',
    `${faviconBasePath}/favicon-32x32.png`
  );
  replaceHeadLink(
    'link[rel="apple-touch-icon"]',
    `${faviconBasePath}/apple-touch-icon.png`
  );
  replaceHeadLink(
    'link[rel="manifest"]',
    `${faviconBasePath}/site.webmanifest`
  );
}

function getCurrentGamemodeSlug() {
  if (typeof window.location?.pathname === 'string') {
    const segments = window.location.pathname.split('/').filter(Boolean);
    if (segments.length > 0) {
      return segments[0].trim().toLowerCase();
    }
  }

  if (typeof formattedGamemode === 'string' && formattedGamemode.trim()) {
    return formattedGamemode.trim().toLowerCase().replace(/\s+/g, '-');
  }

  return '';
}

function setGameAlreadyStartedFavicons() {
  const gamemode = getCurrentGamemodeSlug();

  if (!gamemode) return;

  const faviconBasePath = `/images/meta/favicons/party-games/${gamemode}/in-game-locked`;

  replaceHeadLink(
    'link[rel="icon"][type="image/x-icon"]',
    `${faviconBasePath}/favicon.ico`
  );
  replaceHeadLink(
    'link[rel="icon"][sizes="16x16"]',
    `${faviconBasePath}/favicon-16x16.png`
  );
  replaceHeadLink(
    'link[rel="icon"][sizes="32x32"]',
    `${faviconBasePath}/favicon-32x32.png`
  );
  replaceHeadLink(
    'link[rel="apple-touch-icon"]',
    `${faviconBasePath}/apple-touch-icon.png`
  );
  replaceHeadLink(
    'link[rel="manifest"]',
    `${faviconBasePath}/site.webmanifest`
  );
}

function ShowPartyDoesNotExistState() {
  window.PartyChatReady?.then((partyChat) => {
    partyChat?.setAvailable?.(false);
  });
  document.body.classList.add('party-missing-state');
  document.documentElement.style.setProperty('--primarypagecolour', '#999999');
  document.documentElement.style.setProperty(
    '--secondarypagecolour',
    '#666666'
  );
  setPartyDoesNotExistFavicons();

  const statusContainer = ensureOnlineStatusContainer({
    id: 'party-does-not-exist',
    title: 'Party does not exist',
    description: 'Check the code and try joining again.'
  });

  setActiveContainers();
  showContainer(statusContainer);
  const titlePrefix =
    typeof formattedGamemode === 'string' && formattedGamemode.trim()
      ? formattedGamemode.toUpperCase()
      : 'WAITING ROOM';
  document.title = `${titlePrefix} | PARTY DOES NOT EXIST`;
}

function ShowGameAlreadyStartedState() {
  window.PartyChatReady?.then((partyChat) => {
    partyChat?.setAvailable?.(false);
  });
  document.body.classList.add('party-missing-state');
  setGameAlreadyStartedFavicons();

  const statusContainer = ensureOnlineStatusContainer({
    id: 'game-already-started',
    title: 'Game Already Started',
    description: 'You can’t join mid-game. create a new game.'
  });

  setActiveContainers();
  showContainer(statusContainer);
  const titlePrefix =
    typeof formattedGamemode === 'string' && formattedGamemode.trim()
      ? formattedGamemode.toUpperCase()
      : 'WAITING ROOM';
  document.title = `${titlePrefix} | GAME ALREADY STARTED`;
}

function ShowGameConfigurationErrorState() {
  window.PartyChatReady?.then((partyChat) => {
    partyChat?.setAvailable?.(false);
  });
  document.body.classList.add('party-missing-state');

  const statusContainer = ensureOnlineStatusContainer({
    id: 'game-configuration-error',
    title: 'Game setup incomplete',
    description:
      'No question packs were available. The host needs to return to settings and start the game again.'
  });

  setActiveContainers();
  showContainer(statusContainer);
  const titlePrefix =
    typeof formattedGamemode === 'string' && formattedGamemode.trim()
      ? formattedGamemode.toUpperCase()
      : 'PARTY GAME';
  document.title = `${titlePrefix} | SETUP INCOMPLETE`;
}

function dispatchOnlinePageColours(primary, secondary) {
  if (!primary || !secondary) return;

  document.documentElement.style.setProperty('--primarypagecolour', primary);
  document.documentElement.style.setProperty(
    '--secondarypagecolour',
    secondary
  );
  document.dispatchEvent(
    new CustomEvent('page-colours-updated', {
      detail: { primary, secondary }
    })
  );
}

function getOnlinePackByCardType(cardType) {
  if (!cardType || !Array.isArray(cardPackMap)) return null;

  const searchPackName = String(cardType).trim().toLowerCase();
  if (!searchPackName) return null;

  return (
    cardPackMap.find((pack) => {
      const packNameLower = pack.packName?.toLowerCase?.();
      return packNameLower === searchPackName;
    }) || null
  );
}

function applyOnlinePackTheme(cardType) {
  const matchedPack = getOnlinePackByCardType(cardType);
  if (!matchedPack) return null;

  dispatchOnlinePageColours(
    matchedPack.packColour,
    matchedPack.packSecondaryColour
  );
  return matchedPack;
}
