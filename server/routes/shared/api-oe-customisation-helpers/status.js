function normalizeOeCustomisationStatus(value) {
  const status = String(value || 'published')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-');

  return ['draft', 'published', 'archived'].includes(status) ? status : null;
}

module.exports = {
  normalizeOeCustomisationStatus
};
