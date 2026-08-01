(() => {
  function createOeLibraryData({ state, defaultOeIcon, slotStorageKeys }) {
    function normalizePreferences(preferences = {}) {
      const normalizeList = (value) => [
        ...new Set(
          (Array.isArray(value) ? value : [])
            .map((item) => String(item || '').trim())
            .filter(Boolean)
        )
      ];

      return {
        showLockedOes: preferences.showLockedOes !== false,
        disabledOes: normalizeList(preferences.disabledOes),
        disabledPacks: normalizeList(preferences.disabledPacks)
      };
    }

    function getStoredPreferences() {
      try {
        return JSON.parse(localStorage.getItem('oe-customisation-preferences')) || {};
      } catch {
        return {};
      }
    }

    function formatTitle(value) {
      return String(value || '')
        .replace(/-/g, ' ')
        .toLowerCase()
        .replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
    }

    function getAllItems() {
      return state.packs
        .filter((pack) => pack.slug !== 'blank')
        .flatMap((pack) =>
          (Array.isArray(pack.items) ? pack.items : []).map((item) => ({
            ...item,
            pack
          }))
        );
    }

    function isPackDisabled(packSlug) {
      return state.preferences.disabledPacks.includes(packSlug);
    }

    function isItemDisabled(item) {
      return (
        isPackDisabled(item.packSlug) ||
        state.preferences.disabledOes.includes(item.id)
      );
    }

    function getVisibleItems() {
      const query = state.search.trim().toLowerCase();

      return getAllItems().filter((item) => {
        const disabled = isItemDisabled(item);
        const searchable = [
          item.name,
          item.id,
          item.slot,
          item.packSlug,
          item.pack?.name
        ]
          .join(' ')
          .toLowerCase();

        if (!state.preferences.showLockedOes && !item.access?.unlocked) return false;
        if (!state.selectedPacks.has('all') && !state.selectedPacks.has(item.packSlug)) return false;
        if (state.activeSlot !== 'all' && item.slot !== state.activeSlot) return false;
        if (state.activeOwnership === 'unlocked' && !item.access?.unlocked) return false;
        if (state.activeOwnership === 'locked' && item.access?.unlocked) return false;
        if (state.activeOwnership === 'disabled' && !disabled) return false;
        return !query || searchable.includes(query);
      });
    }

    function getAccessLabel(item) {
      if (item.access?.unlocked) {
        if (item.access.ownedByPack) return 'Pack owned';
        if (item.access.ownedByItem) return 'Owned';
        return 'Unlocked';
      }
      if (item.access?.accessType === 'account_free') return 'Sign in';
      return 'Locked';
    }

    function parseCustomisationString(value) {
      const [colourSlotId, headSlotId, eyesSlotId, mouthSlotId] = String(
        value || defaultOeIcon
      ).split(':');
      return { colourSlotId, headSlotId, eyesSlotId, mouthSlotId };
    }

    function loadLocalCustomisation() {
      try {
        return JSON.parse(localStorage.getItem('user-customisation')) || {};
      } catch {
        return {};
      }
    }

    function createCustomisationString(customisation) {
      return [
        customisation.colourSlotId,
        customisation.headSlotId,
        customisation.eyesSlotId,
        customisation.mouthSlotId
      ].join(':');
    }

    function getCurrentCustomisation() {
      return {
        ...parseCustomisationString(state.account?.oeIcon || defaultOeIcon),
        ...loadLocalCustomisation()
      };
    }

    function storeAccount(account) {
      if (!account) return;
      state.account = account;
      localStorage.setItem('oe-account', JSON.stringify(account));
      window.setAccountPreview?.(account);
      window.dispatchEvent(
        new CustomEvent('oe-account-state-changed', { detail: { account } })
      );
    }

    async function savePreferences() {
      const preferences = normalizePreferences(state.preferences);
      state.preferences = preferences;
      localStorage.setItem('oe-customisation-preferences', JSON.stringify(preferences));
      if (!state.account) return;

      try {
        const response = await fetch('/api/accounts/me/customisation-preferences', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(preferences)
        });
        const payload = await response.json();
        const data = payload?.data || payload;
        if (payload?.success === false) {
          throw new Error(payload.message || 'Failed to save preferences');
        }
        state.preferences = normalizePreferences(
          data.customisationPreferences ||
            data.account?.customisationPreferences ||
            preferences
        );
        if (data.account) storeAccount(data.account);
      } catch (error) {
        console.error('Failed to save OE customisation preferences:', error);
      }
    }

    async function reloadLibrary() {
      const response = await fetch('/api/oe-library');
      const payload = await response.json();
      const data = payload?.data || payload;
      if (data.account) storeAccount(data.account);
      state.packs = Array.isArray(data.packs) ? data.packs : [];
      state.preferences = normalizePreferences({
        ...state.preferences,
        ...(data.customisationPreferences ||
          data.account?.customisationPreferences ||
          {})
      });
    }

    async function equipItem(item, renderGrid) {
      const storageKey = slotStorageKeys[item.slot];
      if (!storageKey) return;

      const customisation = {
        ...getCurrentCustomisation(),
        [storageKey]: item.id
      };
      localStorage.setItem('user-customisation', JSON.stringify(customisation));
      if (!state.account) {
        await window.renderAccountPreviewIcon?.();
        return;
      }

      try {
        const response = await fetch('/api/accounts/me/oe-icon', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ oeIcon: createCustomisationString(customisation) })
        });
        const payload = await response.json();
        const data = payload?.data || payload;
        if (payload?.success === false) {
          throw new Error(payload.message || 'Failed to equip OE');
        }
        if (data.account) storeAccount(data.account);
        await window.renderAccountPreviewIcon?.();
        renderGrid();
      } catch (error) {
        console.error('Failed to equip OE:', error);
      }
    }

    function createShopSlug(item) {
      const itemSlug = String(item.name || '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
      return `oe-${item.packSlug}-${itemSlug}`;
    }

    return {
      createShopSlug,
      equipItem,
      formatTitle,
      getAccessLabel,
      getAllItems,
      getStoredPreferences,
      getVisibleItems,
      isItemDisabled,
      normalizePreferences,
      reloadLibrary,
      savePreferences,
      storeAccount
    };
  }

  window.createOeLibraryData = createOeLibraryData;
})();
