(function () {
  function createOlingLabRarityTheme({ state }) {
    function getRarityTheme(rarity) {
      const key = String(rarity || '')
        .trim()
        .toLowerCase();
      return state.rarityPalette[key] || null;
    }
    function applyRarityTheme(element, rarity) {
      const theme = getRarityTheme(rarity);
      if (!element || !theme) return;
      element.dataset.rarity = String(rarity || '')
        .trim()
        .toLowerCase();
      [
        ['primaryColour', '--oling-rarity-primary-colour'],
        ['secondaryColour', '--oling-rarity-secondary-colour'],
        ['textColour', '--oling-rarity-text-colour']
      ].forEach(([key, property]) => {
        if (theme[key]) element.style.setProperty(property, theme[key]);
      });
    }
    return { getRarityTheme, applyRarityTheme };
  }
  window.createOlingLabRarityTheme = createOlingLabRarityTheme;
})();
