function parseCustomisationString(customisationString) {
  const [colour, head, eyes, mouth] = customisationString.split(':');

  return {
    colour,
    head,
    eyes,
    mouth
  };
}

function getFilePathByCustomisationId(customisationId, fallbackSlot = null) {
  const fallbackPath = fallbackSlot
    ? blankUserCustomisation[fallbackSlot]
    : null;
  if (customisationId == null) return fallbackPath;

  const normalisedId = String(customisationId);

  const allItems = [...colourSlot, ...headSlot, ...eyesSlot, ...mouthSlot];
  const match = allItems.find((item) => String(item.id) === normalisedId);

  return match ? match.filePath : fallbackPath;
}

function toKebabCase(input) {
  return input.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
}

function createCustomisationString(userCustomisation) {
  return `${userCustomisation.colourSlotId}:${userCustomisation.headSlotId}:${userCustomisation.eyesSlotId}:${userCustomisation.mouthSlotId}`;
}

