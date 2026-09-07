(function () {
  function createOlingLabFormatters() {
    const formatTitle = (value) =>
      String(value || '')
        .replace(/[-_]+/g, ' ')
        .replace(/\b\w/g, (letter) => letter.toUpperCase());
    function formatOdds(value) {
      const number = Number(value);
      return !Number.isFinite(number) || number <= 0
        ? '0%'
        : `${Math.round(number * 100)}%`;
    }
    function formatInfluenceEffect(consumable) {
      const amount = Number(consumable?.effect?.amount || 0);
      const effectType = consumable?.effect?.type || '';
      if (!Number.isFinite(amount) || amount === 0) return '';
      if (effectType === 'hatch_speed') return `+${amount}% speed`;
      if (effectType === 'rarity_chance') return `+${amount}% rarity`;
      if (effectType === 'matching_set' || effectType === 'set_match')
        return `+${amount}% match`;
      return `+${amount}%`;
    }
    function formatDuration(milliseconds) {
      const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;
      if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
      if (minutes > 0) return `${minutes}m ${seconds}s`;
      return `${seconds}s`;
    }
    return { formatTitle, formatOdds, formatInfluenceEffect, formatDuration };
  }
  window.createOlingLabFormatters = createOlingLabFormatters;
})();
