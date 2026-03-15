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

function updateTextContainer(text, cardType) {
  const textContainerPrivate = document.querySelector('#private-view .text-container');

  textContainerPrivate.textContent = text;
  selectOptionQuestionText.textContent = text.replace("Never have I ever ", "");

  const matchedPack = applyOnlinePackTheme(cardType);

  if (matchedPack) {
    const imageUrl = matchedPack.packCard
      ? matchedPack.packCard
      : `/images/blank-cards/${gamemode}-blank-card.svg`;
    document.querySelector('#private-view .main-image').src = imageUrl;
    textContainerPrivate.style.color = matchedPack.packColour;
    document.querySelector('#private-view .card-type-text').style.color = matchedPack.packColour;
    setNsfwCardBadge('#private-view', matchedPack.packRestriction === 'nsfw');
  } else {
    console.log("Pack not found");
    setNsfwCardBadge('#private-view', false);
  }

  document.querySelector('#private-view .card-type-text').textContent = cardType;
}
