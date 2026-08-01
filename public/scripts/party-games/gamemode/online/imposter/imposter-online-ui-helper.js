function updateTextContainer(text, cardType) {
  const textContainerPrivate = document.querySelector('#private-view .text-container');
  textContainerPrivate.textContent = text;
  selectUserQuestionText.textContent = text;

  const matchedPack = applyOnlinePackTheme(cardType);

  if (matchedPack) {
    textContainerPrivate.style.color = matchedPack.packColour;
    document.querySelector('#private-view .card-type-text').style.color = matchedPack.packColour;
  } else {
    debugLog("Pack not found");
  }

  document.querySelector('#private-view .card-type-text').textContent = cardType;
}
