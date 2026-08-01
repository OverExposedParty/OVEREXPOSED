(function () {
  function createHelpHubContent(data) {
    const { HELP_HUB_CONFIGS, HELP_HUB_MODE_CONFIGS, HELP_HUB_TOPIC_COPY } = data;

function getHelpHubTopicCopy(pageTitle, topicTitle) {
  const title = topicTitle || 'This Section';
  const pageSpecificKey = `${pageTitle}:${title}`;
  return HELP_HUB_TOPIC_COPY[pageSpecificKey] || HELP_HUB_TOPIC_COPY[title] || {
    body: `${title} explains the controls, state, and decisions connected to this part of ${pageTitle}.`,
    points: [
      `Use ${title.toLowerCase()} when this part of the page is what you need to understand or change.`,
      `Check the visible state before taking action so you know what the page is currently doing.`,
      `If the page offers controls for ${title.toLowerCase()}, use them in order rather than skipping ahead.`
    ]
  };
}

function createHelpHubGeneratedDetail(pageTitle, topicTitle, guideLabel, point, index) {
  const title = guideLabel || topicTitle;
  return {
    title,
    body: point,
    points: [
      index === 0
        ? `${topicTitle} is the first thing to understand before using this part of ${pageTitle}.`
        : `${topicTitle} builds on the other controls and information in ${pageTitle}.`,
      `This matters because ${pageTitle} uses this section to keep the experience clear and predictable.`,
      `Return to the ${topicTitle} overview if you want to compare this with the other points.`
    ]
  };
}

function createHelpHubGeneratedSection(pageTitle, topic) {
  const topicTitle = topic.label || 'This Section';
  const copy = getHelpHubTopicCopy(pageTitle, topicTitle);

  return {
    title: topicTitle,
    body: copy.body,
    guides: copy.points.map((point, index) => ({
      label: point,
      detail: createHelpHubGeneratedDetail(pageTitle, topicTitle, point, point, index)
    }))
  };
}

function hydrateHelpHubSection(pageTitle, topic) {
  if (!topic || topic.placeholder) return;

  if (!topic.section) {
    topic.section = createHelpHubGeneratedSection(pageTitle, topic);
    return;
  }

  const topicTitle = topic.section.title || topic.label || 'This Section';
  topic.section.guides = normaliseHelpHubGuides(topic.section).map((guide) => ({
    ...guide,
    detail: guide.detail || createHelpHubGeneratedDetail(pageTitle, topicTitle, guide.label || 'More Detail', guide.label || 'More detail about this section.', 0)
  }));
}

function hydrateHelpHubConfigSections(configs) {
  Object.values(configs).forEach((config) => {
    if (!Array.isArray(config?.topics)) return;

    config.topics.forEach((topic) => hydrateHelpHubSection(config.title || 'Page', topic));
  });
}

hydrateHelpHubConfigSections(HELP_HUB_CONFIGS);
hydrateHelpHubConfigSections(HELP_HUB_MODE_CONFIGS);

    function normaliseHelpHubGuides(section) {
      if (Array.isArray(section?.guides)) return section.guides;

      return (Array.isArray(section?.bullets) ? section.bullets : []).map((bullet) => ({
        label: bullet
      }));
    }

    return { normaliseHelpHubSectionGuides: normaliseHelpHubGuides };
  }

  window.createHelpHubContent = createHelpHubContent;
})();
