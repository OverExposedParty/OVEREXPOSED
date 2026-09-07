(function () {
  function createOlingLabShelfInventory(dependencies) {
    const {
      state,
      getEgg,
      getConsumable,
      getAvailableEggQuantity,
      getAvailableConsumableQuantity = (consumableKey) =>
        Number(
          state.ownedConsumables.find((item) => item.key === consumableKey)
            ?.quantity || 0
        ),
      getEggImage
    } = dependencies;

    function getShelfInventoryItems() {
      const eggs = state.ownedEggs.map((owned) => {
        const egg = getEgg(owned.key);
        return {
          key: owned.key,
          type: 'egg',
          name: egg.name,
          image: getEggImage(egg),
          description:
            egg.description ||
            egg.metadata?.description ||
            `Hatches an Oling from the ${String(
              egg.collection || 'mystery'
            ).replace(/[-_]+/g, ' ')} collection.`,
          quantity: getAvailableEggQuantity(owned.key)
        };
      });
      const consumables = state.ownedConsumables.map((owned) => {
        const consumable = getConsumable(owned.key);
        return {
          key: owned.key,
          type: 'consumable',
          name: consumable.name,
          image: consumable.assets?.icon || consumable.assets?.image || '',
          description:
            consumable.description ||
            consumable.metadata?.description ||
            'A consumable item for your Olings.',
          quantity: getAvailableConsumableQuantity(owned.key)
        };
      });
      return [...eggs, ...consumables].filter((item) => item.quantity > 0);
    }

    return { getShelfInventoryItems };
  }

  window.createOlingLabShelfInventory = createOlingLabShelfInventory;
})();
