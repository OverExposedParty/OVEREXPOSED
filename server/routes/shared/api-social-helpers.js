const SOCIAL_PANEL_PLATFORMS = ['tiktok', 'instagram', 'youtube-shorts', 'x'];

function formatSocialPanelDate(value) {
  if (!value) return '-';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';

  return date.toISOString().slice(0, 10);
}

function normalizeSocialPlatforms(value) {
  const rawValues = Array.isArray(value) ? value : [value];

  return [
    ...new Set(
      rawValues
        .flatMap((item) => String(item || '').split(','))
        .map((item) => item.trim().toLowerCase())
        .filter((item) => SOCIAL_PANEL_PLATFORMS.includes(item))
    )
  ];
}

function serializeSocialContentItem(document) {
  const item = document.toObject ? document.toObject() : document;
  const plannedFor = item.schedule?.plannedFor || null;
  const platforms = normalizeSocialPlatforms(item.platforms);

  return {
    id: String(item._id),
    platforms,
    type: item.type || '',
    postDate: formatSocialPanelDate(plannedFor),
    postTime: item.schedule?.postTime || '-',
    status: item.status || '-',
    title: item.idea?.title || '-',
    hook: item.idea?.hook || '',
    angle: item.idea?.angle || '',
    prompt: item.idea?.prompt || '',
    notes: item.idea?.notes || '',
    caption: item.content?.caption || '',
    script: item.content?.script || '',
    hashtags: Array.isArray(item.content?.hashtags)
      ? item.content.hashtags.join(', ')
      : '',
    callToAction: item.content?.callToAction || '',
    generatedText: item.content?.generatedText || '',
    scheduledFor: plannedFor,
    plannedFor,
    updatedAt: item.system?.updatedAt || null
  };
}

module.exports = {
  normalizeSocialPlatforms,
  serializeSocialContentItem
};
