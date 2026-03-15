function updateTextContainer(text, cardType) {
  const textContainerPrivate = document.querySelector('#private-view .text-container');
  textContainerPrivate.textContent = text;
  selectUserQuestionText.textContent = text;

  const matchedPack = applyOnlinePackTheme(cardType);

  if (matchedPack) {
    const imageUrl = matchedPack.packCard
      ? matchedPack.packCard
      : `/images/blank-cards/${gamemode}-blank-card.svg`;

    document.querySelector('#private-view .main-image').src = imageUrl;
    textContainerPrivate.style.color = matchedPack.packColour;
    document.querySelector('#private-view .card-type-text').style.color = matchedPack.packColour;
  } else {
    console.log("Pack not found");
  }

  document.querySelector('#private-view .card-type-text').textContent = cardType;
}
