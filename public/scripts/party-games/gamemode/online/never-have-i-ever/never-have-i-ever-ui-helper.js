function updateTextContainer(text, cardType) {
  const textContainerPrivate = document.querySelector('#private-view .text-container');

  textContainerPrivate.textContent = text;
  selectOptionQuestionText.textContent = text.replace("Never have I ever ", "");

  const searchPackName = cardType.toLowerCase();

  // Find the matching pack based on the cardType
  const matchedPack = cardPackMap.find(pack => {
    const packNameLower = pack.packName.toLowerCase();
    return packNameLower === searchPackName;
  });

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