(function () {
  const legacyConsumablePresentations = Object.freeze({
    'oling-cookie': Object.freeze({
      name: 'Oling Cookie',
      assets: Object.freeze({
        icon: '/images/olings/lab/consumables/mood/happiness/oling-cookie.svg',
        image: '/images/olings/lab/consumables/mood/happiness/oling-cookie.svg'
      })
    })
  });

  function createOlingLabCatalogSelectors({ state }) {
    function getItem(itemId) {
      return state.catalog.get(itemId) || null;
    }
    function isPlaced(itemId) {
      return state.lab.placedItems.some((item) => {
        if (item.itemId === itemId) return true;
        return (item.containerSlots || []).some(
          (slot) => slot.itemId === itemId
        );
      });
    }
    function getEgg(eggKey) {
      return state.eggs.get(eggKey) || { key: eggKey, name: eggKey };
    }
    function getConsumable(consumableKey) {
      const legacyPresentation = legacyConsumablePresentations[consumableKey];
      return (
        state.consumables.get(consumableKey) ||
        (legacyPresentation
          ? {
              key: consumableKey,
              name: legacyPresentation.name,
              description: '',
              assets: legacyPresentation.assets,
              inventoryDisplayOnly: true
            }
          : {
              key: consumableKey,
              name: consumableKey,
              description: ''
            })
      );
    }
    function getEggImage(egg) {
      if (egg?.assets?.image) return egg.assets.image;
      const setName = egg?.collection || egg?.key;
      return setName ? `/images/olings/lab/eggs/${setName}/egg.svg` : '';
    }
    return { getItem, isPlaced, getEgg, getConsumable, getEggImage };
  }
  window.createOlingLabCatalogSelectors = createOlingLabCatalogSelectors;
})();
