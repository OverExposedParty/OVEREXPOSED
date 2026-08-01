const sideButtonsContainer = document.querySelector('.side-buttons');

let hasBeenClicked = false;

const vibrationEnabled = localStorage.getItem('settings-vibration') === 'true';

function setNsfwCardBadge(isNsfw) {
  const mainImageContainer = document.querySelector('.main-image-container');
  if (!mainImageContainer) return;

  let nsfwBadge = mainImageContainer.querySelector('.nsfw-card-icon');
  if (!nsfwBadge) {
    nsfwBadge = document.createElement('img');
    nsfwBadge.className = 'nsfw-card-icon';
    nsfwBadge.src = '/images/icons/difficulty/nsfw.svg';
    nsfwBadge.alt = 'NSFW Difficulty';
    nsfwBadge.loading = 'lazy';
    mainImageContainer.appendChild(nsfwBadge);
  }

  nsfwBadge.classList.toggle('active', Boolean(isNsfw));
}

function updateTextContainer(text, cardType, punishment) {
  const textContainer = document.querySelector('.text-container');

  const punishmentEnabled =
    localStorage.getItem(`${gamemode}-drink-punishment`) === 'true';

  const questionText = document.createElement('span');
  questionText.className = 'question-text';
  questionText.textContent = text;

  const nextChildren = [questionText];

  if (punishmentEnabled && punishment) {
    const punishmentText = document.createElement('span');
    punishmentText.className = 'punishment-text';
    punishmentText.textContent = `Punishment: ${punishment}`;
    nextChildren.push(punishmentText);
  }

  textContainer.replaceChildren(...nextChildren);

  if (!textContainer.classList.contains('text-container')) {
    textContainer.classList.add('text-container-small');
  }

  const searchPackName = cardType.toLowerCase();

  // Find the matching pack based on the cardType
  const matchedPack = cardPackMap.find((pack) => {
    const packNameLower = pack.packName.toLowerCase();
    return packNameLower === searchPackName;
  });

  if (matchedPack) {
    document.documentElement.style.setProperty(
      '--primarypagecolour',
      matchedPack.packColour
    );
    document.documentElement.style.setProperty(
      '--secondarypagecolour',
      matchedPack.packSecondaryColour
    );
    document.dispatchEvent(
      new CustomEvent('page-colours-updated', {
        detail: {
          primary: matchedPack.packColour,
          secondary: matchedPack.packSecondaryColour
        }
      })
    );
    textContainer.style.color = matchedPack.packColour;
    document.querySelector('.card-type-text').style.color =
      matchedPack.packColour;
    setNsfwCardBadge(matchedPack.packRestriction === 'nsfw');
  } else {
    debugLog('Pack not found');
    setNsfwCardBadge(false);
  }

  document.querySelector('.card-type-text').textContent = cardType;
}

//Press Main Image Container
const mainImageContainer = document.querySelector('.main-image-container');
const mainImageContainerText = document.querySelector('.text-container');

function addSettingsExtensionToCurrentURL() {
  const currentURL = window.location.href;
  if (!currentURL.endsWith('/settings')) {
    const newURL = currentURL.endsWith('/')
      ? currentURL + 'settings'
      : currentURL + '/settings';
    return newURL;
  }
  return currentURL;
}

(async () => {
  await loadJSONFiles();

  previousPage = {
    link: addSettingsExtensionToCurrentURL(),
    splashScreen: `/images/splash-screens/${gamemode}-settings.png`
  };
})();
