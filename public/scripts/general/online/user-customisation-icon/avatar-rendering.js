function EditUserIconPartyGames({
  container,
  userId,
  userCustomisationString
}) {
  if (container.querySelector('.icon')) {
    container.querySelector('.icon').setAttribute('data-user-id', userId);
  }
  const parsed = parseCustomisationString(userCustomisationString);
  const userCustomisation = {
    colour: getFilePathByCustomisationId(parsed.colour, 'colour'),
    headSlot: getFilePathByCustomisationId(parsed.head, 'headSlot'),
    eyesSlot: getFilePathByCustomisationId(parsed.eyes, 'eyesSlot'),
    mouthSlot: getFilePathByCustomisationId(parsed.mouth, 'mouthSlot')
  };
  EditImageStack(userCustomisation, userId, container);
}

async function waitForUserCustomisationLookup() {
  if (window.Ready?.isReady?.('user-customisation-icon')) return;
  await window.Ready?.when?.('user-customisation-icon', { timeout: 10000 });
}

async function createUserIconPartyGames({
  container,
  userId,
  userCustomisationString,
  size = null
}) {
  const userIcon = document.createElement('div');
  userIcon.className = 'icon';
  userIcon.setAttribute('data-user-id', userId);

  if (size !== null) {
    userIcon.classList.add(size);
  }

  container.appendChild(userIcon);
  await waitForUserCustomisationLookup();

  const parsed = parseCustomisationString(userCustomisationString);
  const userCustomisation = {
    colour: getFilePathByCustomisationId(parsed.colour, 'colour'),
    headSlot: getFilePathByCustomisationId(parsed.head, 'headSlot'),
    eyesSlot: getFilePathByCustomisationId(parsed.eyes, 'eyesSlot'),
    mouthSlot: getFilePathByCustomisationId(parsed.mouth, 'mouthSlot')
  };
  userIcon.appendChild(CreateImageStack(userCustomisation));
}

function getPartyHostComputerId(partyData = currentPartyData) {
  return partyData?.state?.hostComputerId || hostDeviceId || null;
}

function canCurrentUserKickPlayers(partyData = currentPartyData) {
  const partyHostId = getPartyHostComputerId(partyData);
  return Boolean(
    hostedParty || (partyHostId && String(partyHostId) === String(deviceId))
  );
}

function setUserIconKickButton(userIcon, { canKick = false } = {}) {
  if (!userIcon) return;

  const existingCloseBtn = userIcon.querySelector('.close-btn');
  existingCloseBtn?.remove();
}

function createDisconnectedStatusIcon() {
  const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  icon.classList.add('disconnect-status-icon');
  icon.setAttribute('viewBox', '0 0 16 16');
  icon.setAttribute('aria-hidden', 'true');
  icon.setAttribute('focusable', 'false');

  const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  circle.setAttribute('cx', '8');
  circle.setAttribute('cy', '8');
  circle.setAttribute('r', '5.5');
  icon.appendChild(circle);

  return icon;
}

function setCheckmarkStatus(
  checkmark,
  { checked = false, disconnected = false, signingIn = false }
) {
  if (!checkmark) return;

  checkmark.replaceChildren();
  if (disconnected) checkmark.appendChild(createDisconnectedStatusIcon());
  checkmark.classList.toggle('checked', Boolean(checked) && !disconnected);
  checkmark.classList.toggle('disconnected', Boolean(disconnected));
  checkmark.setAttribute(
    'aria-label',
    signingIn
      ? 'Signing in'
      : disconnected
        ? 'Disconnected'
        : checked
          ? 'Ready'
          : 'Not ready'
  );
}
