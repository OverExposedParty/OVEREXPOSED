let qrCodeContainerPlaceholder;
let joinPartyQrCodeContainer;
let qrCodeContainer;
let partyCodeReminder;
let joinPartyCta;
let qrPlayerCount;
let qrCodeImage;
let preparedQrPartyCode = null;

function syncPartyQrCodeButtonState() {
  const qrButton = document.getElementById('qr-code-button');
  if (!qrButton) return;

  qrButton.classList.toggle('active', isContainerVisible(joinPartyQrCodeContainer));
}

fetch('/html-templates/online/party-games-settings/qr-code-container.html')
  .then(response => response.text())
  .then(data => {
    qrCodeContainerPlaceholder = document.getElementById('qr-code-container-placeholder');
    if (!qrCodeContainerPlaceholder) return;

    qrCodeContainerPlaceholder.innerHTML = data;

    joinPartyQrCodeContainer = qrCodeContainerPlaceholder.querySelector('.join-party-qr-code-container');
    qrCodeContainer = qrCodeContainerPlaceholder.querySelector('#qr-code-container');
    partyCodeReminder = qrCodeContainerPlaceholder.querySelector('#partycode-reminder');
    joinPartyCta = qrCodeContainerPlaceholder.querySelector('#join-party-cta');
    qrPlayerCount = qrCodeContainerPlaceholder.querySelector('#qr-player-count');
    hideContainer(joinPartyQrCodeContainer);
    syncPartyQrCodeButtonState();
  })
  .then(() => {
    SetScriptLoaded('/scripts/html-templates/gamemode-settings/qr-code-container-template.js');
  })
  .catch(error => console.error('Error loading QR code container template:', error));

function getPartyJoinUrl(code) {
  return `${window.location.origin}/${code}`;
}

function updatePartyQrPlayerCount(count = 0) {
  if (!qrPlayerCount) return;

  const maxPlayers =
    partyGamesInformation?.[partyGameMode]?.playerCountRestrictions?.maxPlayers ?? 'XX';
  qrPlayerCount.textContent = `(${count}/${maxPlayers})`;
}

async function renderPartyQrCode(code) {
  if (!code || !qrCodeContainer || !joinPartyQrCodeContainer) return;

  const url = getPartyJoinUrl(code);
  await preparePartyQrCode(code);

  partyCodeReminder.textContent = url;
  updatePartyQrPlayerCount(partyUserCount);
}

async function preparePartyQrCode(code) {
  if (!code || !qrCodeContainer) return;

  if (!qrCodeImage) {
    qrCodeImage = document.createElement('img');
    qrCodeImage.id = 'qr-code-image';
    qrCodeImage.alt = `Join party ${code}`;
    const qrPlaceholder = qrCodeContainer.querySelector('#qr-code-placeholder');
    if (qrPlaceholder) {
      qrPlaceholder.remove();
    }
    qrCodeContainer.prepend(qrCodeImage);
  }

  if (preparedQrPartyCode === code && qrCodeImage.src) {
    return;
  }

  const primaryColor =
    getComputedStyle(document.documentElement).getPropertyValue('--primarypagecolour').trim() || '#000000';
  const qrEndpoint = `/api/party-qr/${encodeURIComponent(code)}?color=${encodeURIComponent(primaryColor)}`;
  qrCodeImage.src = qrEndpoint;
  preparedQrPartyCode = code;
}

function togglePartyQrCode(show, code = partyCode) {
  if (!joinPartyQrCodeContainer) return;
  const qrButton = document.getElementById('qr-code-button');

  if (!show || !code) {
    hideContainer(joinPartyQrCodeContainer);
    if (typeof removeElementIfExists === 'function') {
      removeElementIfExists(elementClassArray, joinPartyQrCodeContainer);
      if (qrButton) removeElementIfExists(elementClassArray, qrButton);
    }
    syncPartyQrCodeButtonState();
    return;
  }

  showContainer(joinPartyQrCodeContainer);
  if (typeof addElementIfNotExists === 'function') {
    addElementIfNotExists(elementClassArray, joinPartyQrCodeContainer);
    if (qrButton) addElementIfNotExists(elementClassArray, qrButton);
  }
  syncPartyQrCodeButtonState();
  if (typeof toggleOverlay === 'function') {
    toggleOverlay(true);
  }
  renderPartyQrCode(code);
}

window.syncPartyQrCodeButtonState = syncPartyQrCodeButtonState;
