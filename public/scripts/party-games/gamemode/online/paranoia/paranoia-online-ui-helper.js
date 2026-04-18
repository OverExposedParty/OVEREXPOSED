function setNsfwCardBadge(containerSelector, isNsfw) {
  const cardContainer = document.querySelector(containerSelector);
  if (!cardContainer) return;

  const mainImageContainer = cardContainer.querySelector('.main-image-container');
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
  const textContainerPrivate = document.querySelector('#private-view .text-container');
  const textContainerDualStack = document.querySelector('#dual-stack-view .text-container');

  textContainerPrivate.textContent = text;
  textContainerDualStack.textContent = text;
  selectUserQuestionText.textContent = text;

  const matchedPack = applyOnlinePackTheme(cardType);

  if (matchedPack) {
    const imageUrl = matchedPack.packCard
      ? matchedPack.packCard
      : `/images/blank-cards/${gamemode}-blank-card.svg`;

    document.querySelector('#dual-stack-view .main-image').src = imageUrl;
    document.querySelector('#private-view .main-image').src = imageUrl;
    textContainerPrivate.style.color = matchedPack.packColour;
    document.querySelector('#dual-stack-view .card-type-text').style.color = matchedPack.packColour;
    document.querySelector('#private-view .card-type-text').style.color = matchedPack.packColour;
    setNsfwCardBadge('#dual-stack-view', matchedPack.packRestriction === 'nsfw');
    setNsfwCardBadge('#private-view', matchedPack.packRestriction === 'nsfw');
  } else {
    debugLog("Pack not found");
    setNsfwCardBadge('#dual-stack-view', false);
    setNsfwCardBadge('#private-view', false);
  }

  document.querySelector('#dual-stack-view .card-type-text').textContent = cardType;
  document.querySelector('#private-view .card-type-text').textContent = cardType;
}
