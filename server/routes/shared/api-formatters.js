function formatOePanelDateTime(value) {
  if (!value) return '-';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';

  return date.toLocaleString();
}

function formatReportLabel(value) {
  return String(value || '-')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatPartyGameLabel(value) {
  return String(value || '-')
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatDurationSeconds(value) {
  const totalMinutes = Math.max(0, Math.round(Number(value || 0) / 60) || 0);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours && minutes) return `${hours}h ${minutes}m`;
  if (hours) return `${hours}h`;
  return `${minutes}m`;
}

function formatCurrencyValue(amount, currency = 'GBP') {
  const numericAmount = Number(amount || 0);

  if (currency === 'GBP') {
    return `£${numericAmount.toLocaleString(undefined, {
      maximumFractionDigits: 2
    })}`;
  }

  return `${numericAmount.toLocaleString(undefined, {
    maximumFractionDigits: 2
  })} ${currency}`;
}

module.exports = {
  formatCurrencyValue,
  formatDurationSeconds,
  formatOePanelDateTime,
  formatPartyGameLabel,
  formatReportLabel
};
