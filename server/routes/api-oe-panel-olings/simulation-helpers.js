function createOePanelOlingSimulationHelpers() {
  function pickOePanelWeightedRarity(rarityOdds = {}) {
    const entries = Object.entries(rarityOdds)
      .map(([rarity, weight]) => [rarity, Number(weight) || 0])
      .filter(([, weight]) => weight > 0);
    const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
    if (total <= 0) return null;

    let roll = Math.random() * total;
    for (const [rarity, weight] of entries) {
      roll -= weight;
      if (roll <= 0) return rarity;
    }
    return entries[entries.length - 1]?.[0] || null;
  }

  function pickOePanelRandom(values = []) {
    return values[Math.floor(Math.random() * values.length)] || null;
  }

  return {
    pickOePanelRandom,
    pickOePanelWeightedRarity
  };
}

module.exports = {
  createOePanelOlingSimulationHelpers
};
