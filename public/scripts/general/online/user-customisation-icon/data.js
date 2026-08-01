function loadCustomisation() {
  const saved = localStorage.getItem('user-customisation');
  if (!saved) return {};

  try {
    return JSON.parse(saved) || {};
  } catch {
    return {};
  }
}

function saveCustomisation(customisation) {
  localStorage.setItem('user-customisation', JSON.stringify(customisation));
}

function getStoredAccountOeIcon() {
  try {
    const account = JSON.parse(localStorage.getItem('oe-account') || 'null');
    return typeof account?.oeIcon === 'string' ? account.oeIcon.trim() : '';
  } catch {
    return '';
  }
}

function isCompleteCustomisationString(customisationString) {
  const parts = String(customisationString || '').split(':');
  return (
    parts.length === 4 &&
    parts.every((part) => String(part || '').trim() !== '')
  );
}

function getCustomisationSlotArray(slot) {
  switch (slot) {
    case 'colour':
      return colourSlot;
    case 'head-slot':
    case 'headSlot':
      return headSlot;
    case 'eyes-slot':
    case 'eyesSlot':
      return eyesSlot;
    case 'mouth-slot':
    case 'mouthSlot':
      return mouthSlot;
    default:
      return null;
  }
}

function addCustomisationLookupItem(item = {}) {
  const slotArray = getCustomisationSlotArray(item.slot);
  const id = item.id ?? item.oeId;
  const filePath = item.filePath ?? item['file-path'];

  if (!slotArray || !id || !filePath) return;

  const entry = {
    id,
    name: item.name || '',
    filePath
  };
  const existingIndex = slotArray.findIndex(
    (candidate) => String(candidate.id) === String(id)
  );

  if (existingIndex === -1) {
    slotArray.push(entry);
  } else if (!slotArray[existingIndex].filePath) {
    slotArray[existingIndex] = entry;
  }
}

function getUserIconString() {
  const accountOeIcon = getStoredAccountOeIcon();
  if (
    accountOeIcon &&
    accountOeIcon !== USER_ICON_DEFAULT_STRING &&
    isCompleteCustomisationString(accountOeIcon)
  ) {
    return accountOeIcon;
  }

  const data = loadCustomisation();
  const iconParts = [
    data.colourSlotId,
    data.headSlotId,
    data.eyesSlotId,
    data.mouthSlotId
  ];

  if (
    iconParts.some(
      (part) =>
        part === undefined || part === null || String(part).trim() === ''
    )
  ) {
    return USER_ICON_DEFAULT_STRING;
  }

  return iconParts.join(':');
}

async function loadActivePacks(masterJsonPath = '/api/oe-library') {
  try {
    const response = await fetch(masterJsonPath);
    const libraryPayload = await response.json();
    const library = libraryPayload.data || libraryPayload;
    const packs = Array.isArray(library.packs) ? library.packs : [];

    for (const pack of packs) {
      for (const item of pack.items || []) {
        if (!item.access?.unlocked || item.disabled) continue;
        addCustomisationLookupItem(item);
      }
    }
  } catch (error) {
    console.error('Failed to load packs:', error);
  }
}

async function loadPublishedOeDisplayIndex(
  indexPath = '/api/oe-image-display-index'
) {
  try {
    const response = await fetch(indexPath);
    const payload = await response.json();
    const data = payload.data || payload;
    const items = Array.isArray(data.items) ? data.items : [];

    items.forEach(addCustomisationLookupItem);
  } catch (error) {
    console.error('Failed to load OE display index:', error);
  }
}
