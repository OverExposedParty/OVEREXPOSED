function playAccountCustomisationSound(soundKey) {
  if (!soundKey || typeof window.playSoundEffect !== 'function') return;
  Promise.resolve(window.playSoundEffect(soundKey)).catch(() => {});
}

function getInactiveCustomisationIds() {
  const inactiveIds = new Set(
    getStoredAccount()?.customisationPreferences?.disabledOes || []
  );

  Object.keys(localStorage).forEach((key) => {
    if (!key.startsWith('customisation-')) return;

    try {
      const savedState = JSON.parse(localStorage.getItem(key)) || {};
      Object.keys(savedState).forEach((id) => {
        if (!savedState[id]) inactiveIds.add(id);
      });
    } catch {
      // Pack-level flags are stored as plain strings; those are not slot maps.
    }
  });

  return [...inactiveIds];
}

function createAccountPreviewImageStack(customisation) {
  const imageStack = document.createElement('div');
  imageStack.className = 'image-stack';

  Object.entries(customisation).forEach(([key, src], index) => {
    const img = document.createElement('img');
    img.src = src;
    img.alt = `OE ${index + 1}`;
    img.id = key.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
    imageStack.appendChild(img);
  });

  return imageStack;
}

async function loadAccountCustomisationData() {
  if (accountPreviewCustomisationLookup && accountCustomisationSlots) {
    return {
      lookup: accountPreviewCustomisationLookup,
      slots: accountCustomisationSlots
    };
  }

  const lookup = new Map();
  const slots = {
    colour: [],
    headSlot: [],
    eyesSlot: [],
    mouthSlot: []
  };
  const response = await fetch('/api/oe-library');
  const libraryPayload = await response.json();
  const library = libraryPayload.data || libraryPayload;
  const packs = Array.isArray(library.packs) ? library.packs : [];
  const preferences =
    library.customisationPreferences ||
    getStoredAccount()?.customisationPreferences ||
    {};
  const disabledPacks = Array.isArray(preferences.disabledPacks)
    ? preferences.disabledPacks
    : [];

  packs.forEach((pack) => {
    (pack.items || []).forEach((item) => {
      const entry = {
        id: String(item.id),
        name: item.name,
        filePath: item.filePath
      };
      const slotConfig = accountCustomisationSlotConfig.find(
        (config) => config.packSlot === item.slot
      );
      const isDisabled =
        disabledPacks.includes(item.packSlug) ||
        Boolean(item.disabled) ||
        !item.access?.unlocked;

      lookup.set(entry.id, entry.filePath);
      if (slotConfig && !isDisabled) {
        slots[slotConfig.key].push(entry);
      }
    });
  });

  accountPreviewCustomisationLookup = lookup;
  accountCustomisationSlots = slots;

  return { lookup, slots };
}

function loadSavedAccountCustomisation() {
  const saved = localStorage.getItem('user-customisation');
  if (!saved) return {};

  try {
    return JSON.parse(saved) || {};
  } catch {
    return {};
  }
}

function findActiveSlotIndex(slotItems, savedId) {
  const inactiveIds = getInactiveCustomisationIds();
  const matchingIndex = slotItems.findIndex(
    (item) => item.id === String(savedId)
  );

  if (
    matchingIndex !== -1 &&
    !inactiveIds.includes(slotItems[matchingIndex].id)
  ) {
    return matchingIndex;
  }

  return slotItems.findIndex((item) => !inactiveIds.includes(item.id)) || 0;
}

function getNextActiveSlotIndex(slotItems, currentIndex, direction) {
  const inactiveIds = getInactiveCustomisationIds();
  if (!slotItems.length) return 0;

  let nextIndex = currentIndex;
  for (let index = 0; index < slotItems.length; index += 1) {
    nextIndex = (nextIndex + direction + slotItems.length) % slotItems.length;
    if (!inactiveIds.includes(slotItems[nextIndex].id)) break;
  }

  return nextIndex;
}

async function initialiseAccountCustomisationDraft() {
  const { slots } = await loadAccountCustomisationData();
  const savedCustomisation = loadSavedAccountCustomisation();

  accountCustomisationDraft = {};

  accountCustomisationSlotConfig.forEach((slotConfig) => {
    const slotItems = slots[slotConfig.key] || [];
    accountCustomisationDraft[slotConfig.key] = findActiveSlotIndex(
      slotItems,
      savedCustomisation[slotConfig.storageKey]
    );
  });
}

function getDraftCustomisationIds() {
  const customisation = {};

  accountCustomisationSlotConfig.forEach((slotConfig) => {
    const slotItems = accountCustomisationSlots?.[slotConfig.key] || [];
    const slotItem =
      slotItems[accountCustomisationDraft?.[slotConfig.key] || 0];
    customisation[slotConfig.storageKey] = slotItem?.id || null;
  });

  return customisation;
}

function getCustomisationFileStackFromIds(customisationIds, lookup) {
  return {
    colour:
      lookup.get(String(customisationIds.colourSlotId)) ??
      accountPreviewBlankCustomisation.colour,
    headSlot:
      lookup.get(String(customisationIds.headSlotId)) ??
      accountPreviewBlankCustomisation.headSlot,
    eyesSlot:
      lookup.get(String(customisationIds.eyesSlotId)) ??
      accountPreviewBlankCustomisation.eyesSlot,
    mouthSlot:
      lookup.get(String(customisationIds.mouthSlotId)) ??
      accountPreviewBlankCustomisation.mouthSlot
  };
}

async function getCurrentAccountPreviewCustomisation() {
  if (accountCustomisationEditMode && accountCustomisationDraft) {
    const { lookup } = await loadAccountCustomisationData();
    return getCustomisationFileStackFromIds(getDraftCustomisationIds(), lookup);
  }

  const accountCustomisation = parseAccountCustomisationString(
    getStoredAccount()?.oeIcon
  );
  const accountOeIcon = getStoredAccount()?.oeIcon;
  const savedCustomisation =
    accountIsLoggedIn &&
    !isAccountDefaultOeIcon(accountOeIcon) &&
    accountCustomisation
      ? accountCustomisation
      : loadSavedAccountCustomisation();
  const { lookup } = await loadAccountCustomisationData();
  return getCustomisationFileStackFromIds(savedCustomisation, lookup);
}

async function renderAccountPreviewIcon() {
  if (!accountPreviewIcon) return;

  const customisation = await getCurrentAccountPreviewCustomisation();
  accountPreviewIcon.replaceChildren(
    createAccountPreviewImageStack(customisation)
  );
}

window.renderAccountPreviewIcon = renderAccountPreviewIcon;

function createAccountCustomisationRow(slotConfig) {
  const slotItems = accountCustomisationSlots?.[slotConfig.key] || [];
  const currentIndex = accountCustomisationDraft?.[slotConfig.key] || 0;
  const currentItem = slotItems[currentIndex];
  const row = document.createElement('div');
  row.className = 'account-customisation-row';
  row.dataset.slotKey = slotConfig.key;

  const previous = document.createElement('div');
  previous.className = 'account-customisation-arrow';
  previous.dataset.direction = '-1';
  previous.setAttribute('role', 'button');
  previous.setAttribute('tabindex', '0');
  previous.textContent = '<';

  const label = document.createElement('h2');
  label.className = 'account-customisation-row-title';
  label.textContent = currentItem?.name || 'NO OPTION';

  const next = document.createElement('div');
  next.className = 'account-customisation-arrow';
  next.dataset.direction = '1';
  next.setAttribute('role', 'button');
  next.setAttribute('tabindex', '0');
  next.textContent = '>';

  row.append(previous, label, next);
  return row;
}

function renderAccountCustomisationRows() {
  if (!accountButtonContainer) return;

  accountButtonContainer.replaceChildren(
    ...accountCustomisationSlotConfig.map(createAccountCustomisationRow)
  );
}

function setAccountPreviewEditIcon(isEditing) {
  if (!accountPreviewEditButton) return;

  if (isEditing) {
    accountPreviewEditButton.setAttribute('aria-label', 'Close OE editor');
    accountPreviewEditButton.dataset.accountHint = 'Close OE editor';
    accountPreviewEditButton.replaceChildren(
      createTrustedHtmlFragment(
        '<svg class="account-preview-edit-icon account-preview-close-icon" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"><path d="M19.7 6.4 50 36.7 80.3 6.4 93.6 19.7 63.3 50 93.6 80.3 80.3 93.6 50 63.3 19.7 93.6 6.4 80.3 36.7 50 6.4 19.7 19.7 6.4Z" /></svg>'
      )
    );
    return;
  }

  accountPreviewEditButton.setAttribute('aria-label', 'Edit OE');
  accountPreviewEditButton.dataset.accountHint = 'Edit OE';
  accountPreviewEditButton.replaceChildren(
    createTrustedHtmlFragment(
      '<svg class="account-preview-edit-icon" viewBox="0 0 1441 1441" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"><path d="M0 191h730v105H105v1040h1041V712h105v729H0V191Z" /><path fill-rule="evenodd" clip-rule="evenodd" d="M633 588 1220 1l221 221-587 587-302 81 81-302Zm119 28 75 75 467-469-74-74-468 468Zm-54 100-10 28 29-8-19-20Z" /></svg>'
    )
  );

  if (accountOeEditingDisabled) {
    setAccountOeEditingDisabled(true);
  }
}

function setAccountFooterSaveState(isEditing) {
  if (!accountFooterSaveGrid) return;

  accountFooterSaveGrid.classList.toggle('has-account-save', isEditing);
  accountFooterSaveGrid.setAttribute(
    'aria-label',
    isEditing ? 'Save OE customisation' : 'Footer grid 2'
  );

  if (isEditing) {
    accountFooterSaveGrid.classList.remove('has-account-hint');
    accountFooterSaveGrid.replaceChildren(
      createTrustedHtmlFragment(
        '<span class="account-footer-save-label">SAVE</span>'
      )
    );
    return;
  }

  accountFooterSaveGrid.classList.remove('has-account-hint');
  accountFooterSaveGrid.replaceChildren();
}

async function setAccountCustomisationEditMode(isEditing) {
  if (isEditing && accountOeEditingDisabled) return;

  const wasEditing = accountCustomisationEditMode;
  accountCustomisationEditMode = isEditing;
  if (isEditing) {
    setAccountExpandedPanel('');
  }
  accountContainer?.classList.toggle('is-editing', isEditing);
  setAccountPreviewEditIcon(isEditing);
  setAccountFooterSaveState(isEditing);

  if (isEditing) {
    await initialiseAccountCustomisationDraft();
    renderAccountCustomisationRows();
    await renderAccountPreviewIcon();
    return;
  }

  renderAccountActionMenu();
  await renderAccountPreviewIcon();

  if (
    wasEditing &&
    !accountOeSaveInProgress &&
    pendingAccountOeCustomisationRequest
  ) {
    finishAccountOeCustomisationRequest({
      saved: false,
      icon: getCurrentAccountOeIconString(),
      skipped: false
    });
  }
}

async function changeAccountCustomisationSlot(slotKey, direction) {
  if (!accountCustomisationEditMode) return;

  const slotItems = accountCustomisationSlots?.[slotKey] || [];
  const currentIndex = accountCustomisationDraft?.[slotKey] || 0;
  accountCustomisationDraft[slotKey] = getNextActiveSlotIndex(
    slotItems,
    currentIndex,
    direction
  );

  renderAccountCustomisationRows();
  await renderAccountPreviewIcon();
}

async function randomiseAccountCustomisationDraft() {
  if (!accountCustomisationEditMode) return;

  const inactiveIds = getInactiveCustomisationIds();
  const blankFiles = new Set(Object.values(accountPreviewBlankCustomisation));

  accountCustomisationSlotConfig.forEach((slotConfig) => {
    const slotItems = accountCustomisationSlots?.[slotConfig.key] || [];
    const activeItems = slotItems.filter(
      (item) => !inactiveIds.includes(item.id) && !blankFiles.has(item.filePath)
    );
    const sourceItems = activeItems.length ? activeItems : slotItems;
    if (!sourceItems.length) return;

    const randomItem =
      sourceItems[Math.floor(Math.random() * sourceItems.length)];
    accountCustomisationDraft[slotConfig.key] = slotItems.findIndex(
      (item) => item.id === randomItem.id
    );
  });

  renderAccountCustomisationRows();
  await renderAccountPreviewIcon();
}

function createAccountCustomisationString(customisation) {
  const customisationIds = [
    customisation.colourSlotId,
    customisation.headSlotId,
    customisation.eyesSlotId,
    customisation.mouthSlotId
  ];

  if (
    customisationIds.some((id) => id === undefined || id === null || id === '')
  ) {
    return accountDefaultOeIcon;
  }

  return customisationIds.join(':');
}

async function saveAccountOeIcon(customisation) {
  if (!accountIsLoggedIn) return;

  const response = await fetch('/api/accounts/me/oe-icon', {
    method: 'PATCH',
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      oeIcon: createAccountCustomisationString(customisation)
    })
  });
  const payload = await response.json().catch(() => ({}));

  if (response.status === 401) {
    setAccountPreview(null);
    return;
  }

  if (!response.ok || payload.success === false) {
    throw new Error(payload?.error?.message || 'Failed to save OE');
  }

  saveAccountToLocalStorage(payload.account);
}

window.saveAccountOeCustomisation = saveAccountOeIcon;

async function saveAccountCustomisation() {
  if (!accountCustomisationEditMode) return;

  const customisation = getDraftCustomisationIds();
  const customisationString = createAccountCustomisationString(customisation);
  let accountSaveFailed = false;
  localStorage.setItem('user-customisation', JSON.stringify(customisation));
  try {
    await saveAccountOeIcon(customisation);
  } catch (error) {
    accountSaveFailed = true;
    playAccountCustomisationSound('notificationFailure');
    console.warn(error);
  }

  if (
    typeof partyCode !== 'undefined' &&
    partyCode &&
    window.partyJoinPreviewActive !== true
  ) {
    await UpdateUserPartyData({
      partyId: partyCode,
      computerId: deviceId,
      newUserIcon: customisationString
    });
    if (currentPartyData && typeof UpdateUserIcons === 'function') {
      await UpdateUserIcons(currentPartyData);
    }
  } else if (typeof rerenderSelectedButtons === 'function') {
    rerenderSelectedButtons();
  }

  if (typeof renderUserCustomisationHeaderIcon === 'function') {
    renderUserCustomisationHeaderIcon();
  }

  accountOeSaveInProgress = true;
  await setAccountCustomisationEditMode(false);
  accountOeSaveInProgress = false;

  finishAccountOeCustomisationRequest({
    saved: true,
    icon: customisationString,
    skipped: false
  });
  if (!accountSaveFailed) playAccountCustomisationSound('uiSuccess');
}
