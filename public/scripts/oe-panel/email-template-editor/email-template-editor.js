(function () {
  const EDITOR_EVENT = 'oe-panel-email-template-editor-request';
  const EMAIL_IMAGE_TYPES = [
    ['all', 'All'],
    ['heroes', 'Heroes'],
    ['content', 'Content'],
    ['products', 'Products'],
    ['events', 'Events'],
    ['branding', 'Branding']
  ];
  const EMAIL_IMAGE_PAGE_SIZE = 4;
  const TEST_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const FIXED_LOGO_WIDTH = 280;
  const FIXED_BUTTON_RADIUS = 30;
  const FIXED_DIVIDER_RADIUS = 20;
  const FIXED_DIVIDER_THICKNESS = 6;
  const FIXED_DIVIDER_WIDTH = 100;
  const SECTION_SPACING_PIXELS = {
    none: 0,
    compact: 12,
    standard: 24
  };
  const RECOMMENDED_COMPACT_SECTION_TYPES = new Set([
    'logo',
    'hero',
    'image',
    'secondaryAction',
    'legalNote',
    'divider'
  ]);
  const LEGACY_COMPACT_SECTION_TYPES = new Set([
    'logo',
    'secondaryAction',
    'legalNote',
    'divider'
  ]);
  const EXTRA_SECTION_DEFAULTS = {
    image: {
      src: '/images/emails/heroes/mascot/default.png',
      alt: 'OVEREXPOSED artwork',
      link: '/',
      width: 100,
      alignment: 'center'
    },
    divider: {
      colour: '#66ccff',
      colourSource: 'theme-secondary'
    },
    spacer: { height: 40 },
    socialLinks: {
      heading: 'Follow OVEREXPOSED',
      iconColour: '#66ccff',
      iconColourSource: 'theme-primary',
      alignment: 'center'
    },
    secondaryAction: {
      label: 'Manage settings',
      href: '{{ACTION_URL}}',
      colour: '#66ccff',
      colourSource: 'theme-secondary',
      alignment: 'center'
    },
    buttonGroup: {
      primaryLabel: 'Accept invite',
      primaryHref: '{{ACTION_URL}}',
      secondaryLabel: 'Decline',
      secondaryHref: '/',
      backgroundColour: '#66ccff',
      backgroundColourSource: 'theme-primary',
      textColour: '#171717',
      textColourSource: 'custom',
      borderColour: '#66ccff',
      borderColourSource: 'theme-secondary',
      alignment: 'center'
    },
    infoBox: {
      title: 'Important',
      text: 'Keep this email somewhere safe. Some links may expire.',
      backgroundColour: '#202f38',
      backgroundColourSource: 'custom',
      borderColour: '#66ccff',
      borderColourSource: 'theme-secondary',
      textColour: '#f4f4f4',
      textColourSource: 'custom',
      borderRadius: 0
    },
    codeToken: {
      label: 'Your code',
      labelColour: '#a8a8a8',
      labelColourSource: 'custom',
      code: '{{CODE}}',
      backgroundColour: '#171717',
      backgroundColourSource: 'custom',
      textColour: '#66ccff',
      textColourSource: 'theme-primary',
      borderColour: '#66ccff',
      borderColourSource: 'theme-secondary',
      borderWidth: 1,
      fontSize: 30
    },
    keyValueList: {
      heading: 'Details',
      rows: 'Username: {{USERNAME}}\nRoom code: {{ROOM_CODE}}\nExpires: 15 minutes',
      labelColour: '#a8a8a8',
      labelColourSource: 'custom',
      valueColour: '#f4f4f4',
      valueColourSource: 'theme-primary'
    },
    featureList: {
      heading: 'What is included',
      items:
        'A new way to play\nFresh rewards to unlock\nMore chaos with friends',
      markerColour: '#66ccff',
      markerColourSource: 'theme-primary',
      textColour: '#f4f4f4',
      textColourSource: 'custom'
    },
    quote: {
      text: 'A highlighted message can sit here.',
      attribution: 'OVEREXPOSED',
      colour: '#f4f4f4',
      colourSource: 'custom',
      accentColour: '#66ccff',
      accentColourSource: 'theme-secondary',
      alignment: 'left'
    },
    productCard: {
      imageSrc: '/images/emails/heroes/mascot/default.png',
      imageAlt: 'OVEREXPOSED reward artwork',
      title: 'Featured reward',
      text: 'Showcase a shop item, cosmetic, achievement reward or seasonal drop.',
      meta: 'Limited reward',
      ctaLabel: 'View reward',
      ctaHref: '{{ACTION_URL}}',
      accentColour: '#66ccff',
      accentColourSource: 'theme-primary',
      borderColour: '#474747',
      borderColourSource: 'custom',
      titleColour: '#f4f4f4',
      titleColourSource: 'custom',
      textColour: '#d8d8d8',
      textColourSource: 'custom'
    },
    eventBlock: {
      title: 'Upcoming event',
      dateText: 'Today at 8:00 PM',
      location: 'OVEREXPOSED',
      text: 'Share a timed drop, scheduled game night or platform event.',
      ctaLabel: 'View event',
      ctaHref: '{{ACTION_URL}}',
      accentColour: '#66ccff',
      accentColourSource: 'theme-secondary',
      titleColour: '#f4f4f4',
      titleColourSource: 'custom',
      locationColour: '#a8a8a8',
      locationColourSource: 'custom',
      textColour: '#d8d8d8',
      textColourSource: 'custom'
    },
    legalNote: {
      text: 'This message contains account information intended only for the recipient.',
      fontSize: 11,
      colour: '#8a8a8a',
      colourSource: 'custom',
      alignment: 'center'
    }
  };
  const SECTION_DESCRIPTIONS = {
    logo: 'Brand logo and destination link',
    heading: 'Main title and optional subheading',
    hero: 'Featured image and destination link',
    image: 'Supporting image and destination link',
    content: 'Main email copy and text styling',
    primaryAction: 'Main call-to-action button',
    secondaryAction: 'Supporting text link action',
    buttonGroup: 'Primary and secondary action buttons',
    infoBox: 'Highlighted note or warning',
    codeToken: 'Large verification or invite code',
    keyValueList: 'Labelled details and values',
    featureList: 'Short list of benefits or updates',
    quote: 'Highlighted quote or pullout text',
    productCard: 'Featured product, reward or drop',
    eventBlock: 'Dated event or calendar-style notice',
    legalNote: 'Small compliance or disclaimer copy',
    divider: 'Visual separator between sections',
    spacer: 'Adjustable space between sections',
    socialLinks: 'Links to your social channels',
    footer: 'Required account and policy information'
  };
  let activeEditor = null;

  function createElement(tagName, className, textContent) {
    const element = document.createElement(tagName);
    if (className) element.className = className;
    if (textContent !== undefined) element.textContent = textContent;
    return element;
  }

  function createPreviewModeIcon(isPreviewMode) {
    const namespace = 'http://www.w3.org/2000/svg';
    const icon = document.createElementNS(namespace, 'svg');
    icon.classList.add('oe-panel-email-template-editor-preview-icon');
    icon.setAttribute('viewBox', '0 0 24 24');
    icon.setAttribute('aria-hidden', 'true');
    const eye = document.createElementNS(namespace, 'path');
    eye.setAttribute(
      'd',
      'M2.06 12.35a1 1 0 0 1 0-.7C4.1 7.24 7.63 5 12 5s7.9 2.24 9.94 6.65a1 1 0 0 1 0 .7C19.9 16.76 16.37 19 12 19S4.1 16.76 2.06 12.35Z'
    );
    const pupil = document.createElementNS(namespace, 'circle');
    pupil.setAttribute('cx', '12');
    pupil.setAttribute('cy', '12');
    pupil.setAttribute('r', '3');
    icon.append(eye, pupil);
    if (isPreviewMode) {
      const slash = document.createElementNS(namespace, 'path');
      slash.setAttribute('d', 'm3 3 18 18');
      icon.appendChild(slash);
    }
    return icon;
  }

  function createHistoryIcon(direction) {
    const namespace = 'http://www.w3.org/2000/svg';
    const icon = document.createElementNS(namespace, 'svg');
    icon.classList.add('oe-panel-email-template-editor-history-icon');
    icon.setAttribute('viewBox', '0 0 24 24');
    icon.setAttribute('aria-hidden', 'true');
    const arrow = document.createElementNS(namespace, 'path');
    const curve = document.createElementNS(namespace, 'path');
    if (direction === 'undo') {
      arrow.setAttribute('d', 'M9 14 4 9l5-5');
      curve.setAttribute('d', 'M4 9h10.5a5.5 5.5 0 0 1 0 11H11');
    } else {
      arrow.setAttribute('d', 'm15 14 5-5-5-5');
      curve.setAttribute('d', 'M20 9H9.5a5.5 5.5 0 0 0 0 11H13');
    }
    icon.append(arrow, curve);
    return icon;
  }

  function createUpdateTemplateIcon() {
    const namespace = 'http://www.w3.org/2000/svg';
    const icon = document.createElementNS(namespace, 'svg');
    icon.classList.add('oe-panel-email-template-editor-update-icon');
    icon.setAttribute('viewBox', '0 0 24 24');
    icon.setAttribute('aria-hidden', 'true');
    const outline = document.createElementNS(namespace, 'path');
    outline.setAttribute('d', 'M5 3h11l3 3v15H5V3Z');
    const label = document.createElementNS(namespace, 'path');
    label.setAttribute('d', 'M8 3v6h8V3M8 21v-7h8v7');
    icon.append(outline, label);
    return icon;
  }

  function cloneValue(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function getRecommendedSectionSpacing(type) {
    return RECOMMENDED_COMPACT_SECTION_TYPES.has(type)
      ? 'compact'
      : 'standard';
  }

  function getLegacySectionSpacing(type) {
    return LEGACY_COMPACT_SECTION_TYPES.has(type) ? 'compact' : 'standard';
  }

  function getSectionSpacingPixels(type, value) {
    const spacing = Object.prototype.hasOwnProperty.call(
      SECTION_SPACING_PIXELS,
      value
    )
      ? value
      : getLegacySectionSpacing(type);
    return SECTION_SPACING_PIXELS[spacing];
  }

  function removeFixedPresentationSettings(section) {
    if (
      section.type !== 'spacer' &&
      !Object.prototype.hasOwnProperty.call(
        SECTION_SPACING_PIXELS,
        section.settings.sectionSpacing
      )
    ) {
      section.settings.sectionSpacing = getLegacySectionSpacing(section.type);
    }
    if (section.type === 'logo') delete section.settings.width;
    if (['primaryAction', 'buttonGroup'].includes(section.type)) {
      delete section.settings.borderRadius;
    }
    if (['hero', 'image', 'productCard'].includes(section.type)) {
      delete section.settings.borderRadius;
    }
    if (section.type === 'divider') {
      delete section.settings.borderRadius;
      delete section.settings.thickness;
      delete section.settings.width;
    }
    if (section.type === 'footer') delete section.settings.dividerRadius;
    return section;
  }

  function setStyles(element, styles) {
    Object.entries(styles).forEach(([property, value]) => {
      element.style[property] = value;
    });
  }

  function resolveThemeColour(settings, key, theme) {
    const source = settings[`${key}Source`] || 'custom';
    if (source === 'theme-primary') return theme.accentColour;
    if (source === 'theme-secondary') return theme.secondaryColour;
    return settings[key];
  }

  function isColourSetting(key) {
    return key === 'colour' || key.endsWith('Colour');
  }

  function resolveSectionColourSettings(settings, theme) {
    const resolved = { ...settings };
    Object.keys(settings).forEach((key) => {
      if (isColourSetting(key)) {
        resolved[key] = resolveThemeColour(settings, key, theme);
      }
    });
    return resolved;
  }

  function createEmailTemplateEditor(detail) {
    const config = window.OE_PANEL_EMAIL_TEMPLATE_EDITOR_CONFIG;
    const container = detail?.container;
    const host = detail?.host;
    const sidebar = document.querySelector('.oe-panel-sidebar');
    const layout = document.querySelector('.oe-panel-layout');
    if (!config || !container || !host || !sidebar || !layout) return null;

    const initialTemplate = config.createDefaultTemplate();
    const sectionCounts = {};
    const state = {
      message: initialTemplate.message,
      theme: initialTemplate.theme,
      sections: Object.entries(initialTemplate.sections).map(
        ([type, settings]) => {
          sectionCounts[type] = 1;
          return removeFixedPresentationSettings({ id: type, type, settings });
        }
      )
    };
    let selectedPanel = 'sections';
    let insertionIndex = state.sections.length;
    let previewDevice = 'desktop';
    let isPreviewMode = false;
    let activeLayerDrag = null;
    let lastDeletedSection = null;
    let undoTimeout = null;
    const undoHistoryStack = [];
    const redoHistoryStack = [];
    let lastHistoryKey = '';
    let lastHistoryTime = 0;
    let savedStateSignature = null;
    let templateId = String(detail?.actionConfig?.templateId || '');
    let templateStatus = 'draft';
    let templateUpdatedAt = null;
    let templatePublishedAt = null;
    let isDirty = true;
    let isSaving = false;
    let emailImages = [];
    let imageLibraryStatus = 'idle';
    let imageLibraryError = '';
    let testEmailRecipient = '';
    let testEmailRecipientTouched = false;
    let testEmailRecipientLoadError = '';

    const editor = createElement('div', 'oe-panel-email-template-editor');
    const toolbar = createElement(
      'header',
      'oe-panel-email-template-editor-toolbar'
    );
    const identity = createElement(
      'div',
      'oe-panel-email-template-editor-identity'
    );
    const templateName = createElement(
      'strong',
      'oe-panel-email-template-editor-template-name',
      state.message.templateName
    );
    const draftStatus = createElement(
      'span',
      'oe-panel-email-template-editor-status',
      'Unsaved changes'
    );
    identity.append(templateName, draftStatus);

    const viewportControls = createElement(
      'div',
      'oe-panel-email-template-editor-viewports oe-panel-email-template-editor-action-rail'
    );
    viewportControls.setAttribute(
      'aria-label',
      'Email editor actions and preview controls'
    );
    const updateTemplateButton = createElement(
      'button',
      'oe-panel-email-template-editor-update-template'
    );
    updateTemplateButton.type = 'button';
    updateTemplateButton.dataset.emailTemplatePersistenceAction = '';
    updateTemplateButton.setAttribute('aria-label', 'Update template');
    updateTemplateButton.title = 'Update template';
    updateTemplateButton.appendChild(createUpdateTemplateIcon());
    const viewportToggleButton = createElement(
      'button',
      'oe-panel-email-template-editor-viewport'
    );
    const desktopShape = createElement(
      'span',
      'oe-panel-email-template-editor-device-shape desktop active'
    );
    const mobileShape = createElement(
      'span',
      'oe-panel-email-template-editor-device-shape mobile'
    );
    desktopShape.setAttribute('aria-hidden', 'true');
    mobileShape.setAttribute('aria-hidden', 'true');
    viewportToggleButton.type = 'button';
    viewportToggleButton.dataset.previewDevice = 'desktop';
    viewportToggleButton.setAttribute('aria-label', 'Switch to mobile preview');
    viewportToggleButton.title = 'Switch to mobile preview';
    viewportToggleButton.append(desktopShape);
    const previewModeButton = createElement(
      'button',
      'oe-panel-email-template-editor-viewport oe-panel-email-template-editor-preview-mode'
    );
    previewModeButton.type = 'button';
    previewModeButton.setAttribute('aria-label', 'Enter preview mode');
    previewModeButton.setAttribute('aria-pressed', 'false');
    previewModeButton.title = 'Enter preview mode';
    previewModeButton.appendChild(createPreviewModeIcon(false));
    const undoHistoryButton = createElement(
      'button',
      'oe-panel-email-template-editor-viewport oe-panel-email-template-editor-history-button undo'
    );
    undoHistoryButton.type = 'button';
    undoHistoryButton.disabled = true;
    undoHistoryButton.setAttribute('aria-label', 'Undo');
    undoHistoryButton.title = 'Undo (Ctrl+Z)';
    undoHistoryButton.appendChild(createHistoryIcon('undo'));
    const redoHistoryButton = createElement(
      'button',
      'oe-panel-email-template-editor-viewport oe-panel-email-template-editor-history-button redo'
    );
    redoHistoryButton.type = 'button';
    redoHistoryButton.disabled = true;
    redoHistoryButton.setAttribute('aria-label', 'Redo');
    redoHistoryButton.title = 'Redo (Ctrl+Y)';
    redoHistoryButton.appendChild(createHistoryIcon('redo'));
    viewportControls.append(
      updateTemplateButton,
      undoHistoryButton,
      redoHistoryButton,
      viewportToggleButton,
      previewModeButton
    );
    toolbar.append(identity);

    const stage = createElement('main', 'oe-panel-email-template-editor-stage');
    stage.setAttribute('aria-label', 'Email template preview');
    const notice = createElement(
      'div',
      'oe-panel-email-template-editor-notice'
    );
    notice.hidden = true;
    notice.setAttribute('role', 'status');
    editor.append(toolbar, stage, viewportControls, notice);

    const inspector = createElement(
      'div',
      'oe-panel-email-template-editor-inspector'
    );

    function setEditorStatus(message, tone = '') {
      draftStatus.textContent = message;
      draftStatus.dataset.statusTone = tone;
    }

    function setPersistenceBusy(busy) {
      isSaving = busy;
      [editor, inspector].forEach((root) => {
        root
          .querySelectorAll('[data-email-template-persistence-action]')
          .forEach((button) => {
            button.disabled =
              busy ||
              (button.dataset.requiresTemplate === 'true' && !templateId) ||
              (button.dataset.requiresTestRecipient === 'true' &&
                !isValidTestEmailRecipient(testEmailRecipient));
          });
      });
    }

    function normalizeTestEmailRecipient(value) {
      return String(value || '')
        .trim()
        .toLowerCase();
    }

    function isValidTestEmailRecipient(value) {
      const normalized = normalizeTestEmailRecipient(value);
      return normalized.length <= 254 && TEST_EMAIL_PATTERN.test(normalized);
    }

    function syncTestEmailRecipientControl() {
      const input = inspector.querySelector(
        '#email-template-test-email-recipient'
      );
      const message = inspector.querySelector(
        '#email-template-test-email-recipient-message'
      );
      const sendButton = inspector.querySelector(
        '[data-requires-test-recipient="true"]'
      );
      const valid = isValidTestEmailRecipient(testEmailRecipient);
      if (input && input.value !== testEmailRecipient) {
        input.value = testEmailRecipient;
      }
      if (input) {
        input.setCustomValidity(
          testEmailRecipient && !valid ? 'Enter a valid email address' : ''
        );
        input.setAttribute(
          'aria-invalid',
          String(testEmailRecipientTouched && !valid)
        );
      }
      if (message) {
        if (testEmailRecipientTouched && !valid) {
          message.textContent = testEmailRecipient
            ? 'Enter a valid email address.'
            : 'Enter an email address.';
        } else {
          message.textContent = testEmailRecipientLoadError;
        }
      }
      if (sendButton) sendButton.disabled = isSaving || !valid;
    }

    function invalidateTemplateCache() {
      window.OE_PANEL_DATA?.clear?.('emailTemplates');
    }

    function getHistoryContent() {
      return {
        message: cloneValue(state.message),
        theme: cloneValue(state.theme),
        sections: cloneValue(state.sections)
      };
    }

    function getHistorySnapshot() {
      return {
        ...getHistoryContent(),
        selectedPanel,
        insertionIndex
      };
    }

    function getHistorySignature() {
      return JSON.stringify(getHistoryContent());
    }

    function syncHistoryButtons() {
      undoHistoryButton.disabled = undoHistoryStack.length === 0;
      redoHistoryButton.disabled = redoHistoryStack.length === 0;
    }

    function clearDeleteNotice() {
      if (undoTimeout) window.clearTimeout(undoTimeout);
      undoTimeout = null;
      lastDeletedSection = null;
      notice.hidden = true;
    }

    function resetHistory() {
      undoHistoryStack.length = 0;
      redoHistoryStack.length = 0;
      lastHistoryKey = '';
      lastHistoryTime = 0;
      clearDeleteNotice();
      syncHistoryButtons();
    }

    function recordHistory(historyKey = '') {
      const now = Date.now();
      const shouldCoalesce =
        historyKey &&
        historyKey === lastHistoryKey &&
        now - lastHistoryTime <= 700;
      if (!shouldCoalesce) {
        undoHistoryStack.push(getHistorySnapshot());
        if (undoHistoryStack.length > 100) undoHistoryStack.shift();
      }
      redoHistoryStack.length = 0;
      lastHistoryKey = historyKey;
      lastHistoryTime = now;
      if (lastDeletedSection) clearDeleteNotice();
      syncHistoryButtons();
    }

    function restoreHistorySnapshot(snapshot) {
      state.message = cloneValue(snapshot.message);
      state.theme = cloneValue(snapshot.theme);
      state.sections = cloneValue(snapshot.sections).map(
        removeFixedPresentationSettings
      );
      selectedPanel = snapshot.selectedPanel;
      insertionIndex = snapshot.insertionIndex;
      if (
        ![
          'sections',
          'add-section',
          'template-settings',
          'message',
          'theme'
        ].includes(selectedPanel) &&
        !getSection(selectedPanel)
      ) {
        selectedPanel = 'sections';
      }
      rebuildSectionCounts();
      templateName.textContent =
        state.message.templateName || 'Untitled Email Template';
      markDirty();
      renderInspector();
      renderPreview();
      syncHistoryButtons();
    }

    function undoHistory() {
      if (!undoHistoryStack.length) return false;
      const snapshot = undoHistoryStack.pop();
      redoHistoryStack.push(getHistorySnapshot());
      lastHistoryKey = '';
      lastHistoryTime = 0;
      clearDeleteNotice();
      restoreHistorySnapshot(snapshot);
      return true;
    }

    function redoHistory() {
      if (!redoHistoryStack.length) return false;
      const snapshot = redoHistoryStack.pop();
      undoHistoryStack.push(getHistorySnapshot());
      lastHistoryKey = '';
      lastHistoryTime = 0;
      clearDeleteNotice();
      restoreHistorySnapshot(snapshot);
      return true;
    }

    function markDirty() {
      isDirty =
        savedStateSignature === null ||
        getHistorySignature() !== savedStateSignature;
      setEditorStatus(
        isDirty
          ? 'Unsaved changes'
          : templateStatus === 'published'
            ? 'Published'
            : 'Template updated',
        isDirty ? 'warning' : 'success'
      );
      const workflowStatus = inspector.querySelector(
        '[data-email-template-workflow-value="status"]'
      );
      if (workflowStatus) {
        workflowStatus.textContent = isDirty
          ? 'Unsaved changes'
          : templateStatus === 'published'
            ? 'Published'
            : 'Unpublished';
      }
    }

    function getTemplateData() {
      return {
        key: state.message.templateKey || '',
        name: state.message.templateName,
        category: state.message.category,
        automationTriggers: cloneValue(state.message.automationTriggers || []),
        subject: state.message.subject,
        preheader: state.message.preheader,
        theme: cloneValue(state.theme),
        sections: cloneValue(state.sections)
      };
    }

    function rebuildSectionCounts() {
      Object.keys(sectionCounts).forEach((key) => delete sectionCounts[key]);
      state.sections.forEach((section) => {
        const suffix = Number(
          String(section.id).match(/-(\d+)$/)?.[1] ||
            (section.id === section.type ? 1 : 0)
        );
        sectionCounts[section.type] = Math.max(
          sectionCounts[section.type] || 0,
          suffix
        );
      });
    }

    function applyTemplateData(
      template,
      { panel = 'sections', resetEditorHistory = true } = {}
    ) {
      templateId = String(template.id || template._id || templateId || '');
      templateStatus = template.status || 'draft';
      templateUpdatedAt = template.updatedAt || new Date().toISOString();
      templatePublishedAt = template.publishedAt || null;
      state.message = {
        templateName: template.name || 'Untitled Email Template',
        templateKey: template.key || '',
        subject: template.subject || '',
        preheader: template.preheader || '',
        category: template.category || 'transactional',
        automationTriggers: Array.isArray(template.automationTriggers)
          ? cloneValue(template.automationTriggers)
          : []
      };
      state.theme = cloneValue(template.theme || state.theme);
      state.sections = cloneValue(template.sections || state.sections).map(
        removeFixedPresentationSettings
      );
      rebuildSectionCounts();
      templateName.textContent = state.message.templateName;
      selectedPanel = panel;
      savedStateSignature = getHistorySignature();
      isDirty = false;
      if (resetEditorHistory) resetHistory();
      else syncHistoryButtons();
      setEditorStatus(
        templateStatus === 'published' ? 'Published' : 'Template updated',
        'success'
      );
      renderInspector();
      renderPreview();
    }

    async function requestTemplateApi(url, options = {}) {
      const response = await fetch(url, {
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        ...options
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload.success === false) {
        const error = new Error(
          payload?.error?.message || payload?.message || 'Request failed'
        );
        error.status = response.status;
        error.code = payload?.error?.code || '';
        throw error;
      }
      return payload.data || {};
    }

    async function loadEmailImageLibrary() {
      if (imageLibraryStatus === 'loading' || imageLibraryStatus === 'loaded') {
        return;
      }
      imageLibraryStatus = 'loading';
      imageLibraryError = '';
      try {
        const data = await requestTemplateApi('/api/oe-panel/emails/images');
        emailImages = Array.isArray(data.images) ? data.images : [];
        imageLibraryStatus = 'loaded';
      } catch (error) {
        imageLibraryStatus = 'error';
        imageLibraryError = error.message;
      }

      if (activeEditor?.state !== state) return;
      const sectionInstance = getSection(selectedPanel);
      const definition = sectionInstance
        ? getSectionDefinition(sectionInstance.type)
        : null;
      if (
        definition?.controls.some((control) => control.type === 'imagePicker')
      ) {
        renderInspector();
      }
    }

    async function loadEmailPreferences() {
      try {
        const data = await requestTemplateApi(
          '/api/oe-panel/emails/preferences'
        );
        if (!testEmailRecipientTouched) {
          testEmailRecipient = String(data.testEmailRecipient || '');
        }
        testEmailRecipientLoadError = '';
      } catch (error) {
        testEmailRecipientLoadError = 'Could not load the saved address.';
      }
      if (activeEditor?.state === state) syncTestEmailRecipientControl();
    }

    async function updateTemplate() {
      if (isSaving) return null;
      if (!isDirty && templateId) return { id: templateId };
      setPersistenceBusy(true);
      setEditorStatus('Updating…');
      try {
        const data = await requestTemplateApi(
          templateId
            ? `/api/oe-panel/emails/templates/${encodeURIComponent(templateId)}`
            : '/api/oe-panel/emails/templates',
          {
            method: templateId ? 'PATCH' : 'POST',
            body: JSON.stringify(getTemplateData())
          }
        );
        applyTemplateData(data.template, {
          panel: selectedPanel,
          resetEditorHistory: false
        });
        invalidateTemplateCache();
        setEditorStatus('Template updated', 'success');
        return data.template;
      } catch (error) {
        setEditorStatus(error.message, 'error');
        return null;
      } finally {
        setPersistenceBusy(false);
      }
    }

    async function publishTemplate() {
      const saved = await updateTemplate();
      if (!saved || !templateId || isSaving) return;
      setPersistenceBusy(true);
      setEditorStatus('Publishing…');
      try {
        const data = await requestTemplateApi(
          `/api/oe-panel/emails/templates/${encodeURIComponent(templateId)}/publish`,
          {
            method: 'POST',
            body: '{}'
          }
        );
        applyTemplateData(data.template, {
          panel: selectedPanel,
          resetEditorHistory: false
        });
        invalidateTemplateCache();
        setEditorStatus('Published', 'success');
      } catch (error) {
        setEditorStatus(error.message, 'error');
      } finally {
        setPersistenceBusy(false);
      }
    }

    async function sendTestEmail() {
      const recipient = normalizeTestEmailRecipient(testEmailRecipient);
      if (!isValidTestEmailRecipient(recipient)) {
        testEmailRecipientTouched = true;
        syncTestEmailRecipientControl();
        setEditorStatus('Enter a valid test email address', 'error');
        inspector
          .querySelector('#email-template-test-email-recipient')
          ?.focus();
        return;
      }
      const saved = await updateTemplate();
      if (!saved || !templateId || isSaving) return;
      setPersistenceBusy(true);
      setEditorStatus('Sending test…');
      try {
        const data = await requestTemplateApi(
          `/api/oe-panel/emails/templates/${encodeURIComponent(templateId)}/test-send`,
          {
            method: 'POST',
            body: JSON.stringify({ recipient })
          }
        );
        testEmailRecipient = data.recipient || recipient;
        testEmailRecipientTouched = false;
        testEmailRecipientLoadError = '';
        syncTestEmailRecipientControl();
        setEditorStatus(
          data.skipped
            ? 'Template updated · email provider not configured'
            : `Test sent to ${data.recipient}`,
          data.skipped ? 'warning' : 'success'
        );
      } catch (error) {
        setEditorStatus(error.message, 'error');
      } finally {
        setPersistenceBusy(false);
      }
    }

    async function duplicateTemplate() {
      const saved = await updateTemplate();
      if (!saved || !templateId || isSaving) return;
      setPersistenceBusy(true);
      setEditorStatus('Duplicating…');
      try {
        const data = await requestTemplateApi(
          `/api/oe-panel/emails/templates/${encodeURIComponent(templateId)}/duplicate`,
          { method: 'POST', body: '{}' }
        );
        if (data.template?.status !== 'draft') {
          throw new Error('The duplicated template was not created as a draft');
        }
        applyTemplateData(data.template, { panel: 'template-settings' });
        invalidateTemplateCache();
        setEditorStatus('Duplicate created · Unpublished', 'success');
      } catch (error) {
        setEditorStatus(error.message, 'error');
      } finally {
        setPersistenceBusy(false);
      }
    }

    async function deleteTemplate() {
      if (!templateId || isSaving) return;
      const confirmed = window.confirm(
        `Delete "${state.message.templateName}"? This removes it from the email templates list.`
      );
      if (!confirmed) return;
      setPersistenceBusy(true);
      setEditorStatus('Deleting…');
      try {
        await requestTemplateApi(
          `/api/oe-panel/emails/templates/${encodeURIComponent(templateId)}`,
          { method: 'DELETE' }
        );
        invalidateTemplateCache();
        isDirty = false;
        closeEditor();
      } catch (error) {
        setEditorStatus(error.message, 'error');
        setPersistenceBusy(false);
      }
    }

    async function loadTemplate(id) {
      if (!id || isSaving) return;
      setPersistenceBusy(true);
      setEditorStatus('Loading…');
      try {
        const data = await requestTemplateApi(
          `/api/oe-panel/emails/templates/${encodeURIComponent(id)}`
        );
        applyTemplateData(data.template);
      } catch (error) {
        setEditorStatus(error.message, 'error');
      } finally {
        setPersistenceBusy(false);
      }
    }

    function getSectionDefinition(type) {
      return config.sectionDefinitions[type];
    }

    function getSection(sectionId) {
      return state.sections.find((section) => section.id === sectionId);
    }

    function getDefaultSectionSettings(type) {
      const templateDefaults = config.createDefaultTemplate().sections[type];
      const settings = cloneValue(
        templateDefaults || EXTRA_SECTION_DEFAULTS[type] || {}
      );
      if (type !== 'spacer' && !settings.sectionSpacing) {
        settings.sectionSpacing = getRecommendedSectionSpacing(type);
      }
      return settings;
    }

    function createSectionId(type) {
      sectionCounts[type] = (sectionCounts[type] || 0) + 1;
      return `${type}-${sectionCounts[type]}`;
    }

    function getAppendIndex() {
      const footerIndex = state.sections.findIndex(
        (section) => section.type === 'footer'
      );
      return footerIndex === -1 ? state.sections.length : footerIndex;
    }

    function selectPanel(panel) {
      selectedPanel = panel;
      renderInspector();
      renderPreview();
    }

    function makePreviewSection(sectionInstance) {
      const definition = getSectionDefinition(sectionInstance.type);
      const section = createElement(
        'section',
        'oe-panel-email-preview-section'
      );
      section.dataset.emailTemplateSection = sectionInstance.id;
      section.dataset.emailTemplateType = sectionInstance.type;
      if (isPreviewMode) return section;
      section.tabIndex = 0;
      section.setAttribute('role', 'button');
      section.setAttribute('aria-label', `Edit ${definition.label}`);
      if (selectedPanel === sectionInstance.id) {
        section.classList.add('selected');
      }
      section.appendChild(
        createElement(
          'span',
          'oe-panel-email-preview-section-label',
          definition.label
        )
      );
      const select = () => selectPanel(sectionInstance.id);
      section.addEventListener('click', select);
      section.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        select();
      });
      return section;
    }

    function createInsertionControl(index) {
      const insertion = createElement(
        'div',
        'oe-panel-email-preview-insertion'
      );
      const button = createElement(
        'button',
        'oe-panel-email-preview-insertion-button',
        '+ Add Section'
      );
      button.type = 'button';
      button.setAttribute('aria-label', `Add section at position ${index + 1}`);
      button.addEventListener('click', () => {
        insertionIndex = index;
        selectPanel('add-section');
      });
      insertion.appendChild(button);
      return insertion;
    }

    function populatePreviewSection(element, sectionInstance) {
      const settings = resolveSectionColourSettings(
        sectionInstance.settings,
        state.theme
      );
      if (sectionInstance.type !== 'spacer') {
        const spacing = getSectionSpacingPixels(
          sectionInstance.type,
          settings.sectionSpacing
        );
        element.style.paddingTop = `${spacing}px`;
        element.style.paddingBottom = `${spacing}px`;
      }
      switch (sectionInstance.type) {
        case 'logo': {
          element.style.textAlign = settings.alignment;
          element.style.backgroundColor =
            settings.backgroundColour || state.theme.contentBackground;
          const image = createElement('img', 'oe-panel-email-preview-logo');
          image.src = settings.src;
          image.alt = settings.alt;
          image.style.width = `${FIXED_LOGO_WIDTH}px`;
          element.appendChild(image);
          break;
        }
        case 'heading': {
          element.style.textAlign = settings.alignment;
          const heading = createElement(
            'h1',
            'oe-panel-email-preview-heading',
            settings.text
          );
          setStyles(heading, {
            fontFamily: settings.fontFamily,
            fontSize: `${settings.fontSize}px`,
            color: settings.colour
          });
          element.appendChild(heading);
          if (settings.showSubheading) {
            const subheading = createElement(
              'p',
              'oe-panel-email-preview-subheading',
              settings.subheading
            );
            setStyles(subheading, {
              fontFamily: settings.subheadingFontFamily,
              fontSize: `${settings.subheadingFontSize}px`,
              color: settings.subheadingColour
            });
            element.appendChild(subheading);
          }
          break;
        }
        case 'hero': {
          if (settings.visible) {
            const image = createElement('img', 'oe-panel-email-preview-hero');
            image.src = settings.src;
            image.alt = settings.alt;
            image.style.borderRadius = '0px';
            element.appendChild(image);
          } else {
            element.appendChild(
              createElement(
                'p',
                'oe-panel-email-preview-hidden-message',
                'Hero image hidden'
              )
            );
          }
          break;
        }
        case 'image': {
          element.style.textAlign = settings.alignment;
          const image = createElement('img', 'oe-panel-email-preview-image');
          image.src = settings.src;
          image.alt = settings.alt;
          image.style.width = `${settings.width}%`;
          image.style.borderRadius = '0px';
          element.appendChild(image);
          break;
        }
        case 'content': {
          setStyles(element, {
            fontFamily: settings.fontFamily,
            fontSize: `${settings.fontSize}px`,
            color: settings.colour,
            textAlign: settings.alignment
          });
          settings.text.split(/\n+/).forEach((paragraphText) => {
            element.appendChild(
              createElement(
                'p',
                'oe-panel-email-preview-body-copy',
                paragraphText
              )
            );
          });
          break;
        }
        case 'primaryAction': {
          element.style.textAlign = settings.alignment;
          const action = createElement(
            'span',
            'oe-panel-email-preview-action',
            settings.label
          );
          setStyles(action, {
            backgroundColor: settings.backgroundColour,
            color: settings.textColour,
            borderRadius: `${FIXED_BUTTON_RADIUS}px`
          });
          element.appendChild(action);
          break;
        }
        case 'secondaryAction': {
          element.style.textAlign = settings.alignment;
          const action = createElement(
            'span',
            'oe-panel-email-preview-secondary-action',
            settings.label
          );
          action.style.color = settings.colour;
          element.appendChild(action);
          break;
        }
        case 'buttonGroup': {
          const group = createElement(
            'div',
            'oe-panel-email-preview-button-group'
          );
          group.style.justifyContent =
            settings.alignment === 'right'
              ? 'flex-end'
              : settings.alignment === 'center'
                ? 'center'
                : 'flex-start';
          const primary = createElement(
            'span',
            'oe-panel-email-preview-action',
            settings.primaryLabel
          );
          setStyles(primary, {
            backgroundColor: settings.backgroundColour,
            color: settings.textColour,
            borderRadius: `${FIXED_BUTTON_RADIUS}px`
          });
          const secondary = createElement(
            'span',
            'oe-panel-email-preview-action secondary',
            settings.secondaryLabel
          );
          setStyles(secondary, {
            color: settings.borderColour,
            borderColor: settings.borderColour,
            borderRadius: `${FIXED_BUTTON_RADIUS}px`
          });
          group.append(primary, secondary);
          element.appendChild(group);
          break;
        }
        case 'infoBox': {
          const box = createElement('div', 'oe-panel-email-preview-info-box');
          setStyles(box, {
            backgroundColor: settings.backgroundColour,
            borderColor: settings.borderColour,
            borderRadius: `${settings.borderRadius}px`,
            color: settings.textColour
          });
          box.append(
            createElement('strong', '', settings.title),
            createElement('p', '', settings.text)
          );
          element.appendChild(box);
          break;
        }
        case 'codeToken': {
          element.style.textAlign = 'center';
          const label = createElement(
            'p',
            'oe-panel-email-preview-code-label',
            settings.label
          );
          label.style.color = settings.labelColour;
          element.appendChild(label);
          const code = createElement(
            'div',
            'oe-panel-email-preview-code-token',
            settings.code
          );
          setStyles(code, {
            backgroundColor: settings.backgroundColour,
            borderColor: settings.borderColour,
            borderWidth: `${settings.borderWidth}px`,
            color: settings.textColour,
            fontSize: `${settings.fontSize}px`
          });
          element.appendChild(code);
          break;
        }
        case 'keyValueList': {
          if (settings.heading) {
            element.appendChild(
              createElement(
                'p',
                'oe-panel-email-preview-list-heading',
                settings.heading
              )
            );
          }
          const list = createElement('div', 'oe-panel-email-preview-kv-list');
          settings.rows.split(/\n+/).forEach((rowText) => {
            if (!rowText.trim()) return;
            const row = createElement('div', 'oe-panel-email-preview-kv-row');
            const separatorIndex = rowText.indexOf(':');
            const label =
              separatorIndex === -1
                ? rowText
                : rowText.slice(0, separatorIndex);
            const value =
              separatorIndex === -1
                ? ''
                : rowText.slice(separatorIndex + 1).trim();
            const labelElement = createElement('span', '', label.trim());
            const valueElement = createElement('strong', '', value);
            labelElement.style.color = settings.labelColour;
            valueElement.style.color = settings.valueColour;
            row.append(labelElement, valueElement);
            list.appendChild(row);
          });
          element.appendChild(list);
          break;
        }
        case 'featureList': {
          if (settings.heading) {
            element.appendChild(
              createElement(
                'p',
                'oe-panel-email-preview-list-heading',
                settings.heading
              )
            );
          }
          const list = createElement(
            'div',
            'oe-panel-email-preview-feature-list'
          );
          settings.items.split(/\n+/).forEach((itemText) => {
            if (!itemText.trim()) return;
            const item = createElement(
              'div',
              'oe-panel-email-preview-feature-item'
            );
            const marker = createElement('span', '', '*');
            marker.style.color = settings.markerColour;
            const copy = createElement('span', '', itemText.trim());
            copy.style.color = settings.textColour;
            item.append(marker, copy);
            list.appendChild(item);
          });
          element.appendChild(list);
          break;
        }
        case 'quote': {
          element.style.textAlign = settings.alignment;
          const quote = createElement(
            'blockquote',
            'oe-panel-email-preview-quote'
          );
          quote.style.borderLeftColor = settings.accentColour;
          quote.style.color = settings.colour;
          quote.appendChild(createElement('p', '', settings.text));
          if (settings.attribution) {
            const attribution = createElement('cite', '', settings.attribution);
            attribution.style.color = settings.accentColour;
            quote.appendChild(attribution);
          }
          element.appendChild(quote);
          break;
        }
        case 'productCard': {
          const card = createElement(
            'div',
            'oe-panel-email-preview-product-card'
          );
          card.style.borderRadius = '0px';
          card.style.borderColor = settings.borderColour;
          if (settings.imageSrc) {
            const image = createElement('img');
            image.src = settings.imageSrc;
            image.alt = settings.imageAlt;
            card.appendChild(image);
          }
          const body = createElement(
            'div',
            'oe-panel-email-preview-product-body'
          );
          const meta = createElement(
            'p',
            'oe-panel-email-preview-product-meta',
            settings.meta
          );
          meta.style.color = settings.accentColour;
          const title = createElement('h2', '', settings.title);
          title.style.color = settings.titleColour;
          const copy = createElement('p', '', settings.text);
          copy.style.color = settings.textColour;
          body.append(meta, title, copy);
          if (settings.ctaLabel) {
            const cta = createElement('span', '', settings.ctaLabel);
            cta.style.color = settings.accentColour;
            body.appendChild(cta);
          }
          card.appendChild(body);
          element.appendChild(card);
          break;
        }
        case 'eventBlock': {
          const block = createElement(
            'div',
            'oe-panel-email-preview-event-block'
          );
          block.style.borderLeftColor = settings.accentColour;
          const date = createElement(
            'p',
            'oe-panel-email-preview-event-date',
            settings.dateText
          );
          date.style.color = settings.accentColour;
          const title = createElement('h2', '', settings.title);
          title.style.color = settings.titleColour;
          const location = createElement(
            'p',
            'oe-panel-email-preview-event-location',
            settings.location
          );
          location.style.color = settings.locationColour;
          const copy = createElement('p', '', settings.text);
          copy.style.color = settings.textColour;
          block.append(date, title, location, copy);
          if (settings.ctaLabel) {
            const cta = createElement('span', '', settings.ctaLabel);
            cta.style.color = settings.accentColour;
            block.appendChild(cta);
          }
          element.appendChild(block);
          break;
        }
        case 'legalNote': {
          setStyles(element, {
            fontSize: `${settings.fontSize}px`,
            color: settings.colour,
            textAlign: settings.alignment
          });
          element.appendChild(createElement('p', '', settings.text));
          break;
        }
        case 'divider': {
          const divider = createElement('hr', 'oe-panel-email-preview-divider');
          divider.style.width = `${FIXED_DIVIDER_WIDTH}%`;
          divider.style.height = `${FIXED_DIVIDER_THICKNESS}px`;
          divider.style.backgroundColor = settings.colour;
          divider.style.borderRadius = `${FIXED_DIVIDER_RADIUS}px`;
          element.appendChild(divider);
          break;
        }
        case 'spacer': {
          element.classList.add('is-spacer');
          element.style.minHeight = `${settings.height}px`;
          break;
        }
        case 'socialLinks': {
          const socialLinks = window.OE_SOCIAL_MEDIA_LINKS || {};
          element.style.textAlign = settings.alignment;
          element.style.color = settings.iconColour;
          element.appendChild(
            createElement(
              'p',
              'oe-panel-email-preview-social-heading',
              settings.heading
            )
          );
          const links = createElement(
            'div',
            'oe-panel-email-preview-social-links'
          );
          links.style.justifyContent =
            settings.alignment === 'right'
              ? 'flex-end'
              : settings.alignment === 'center'
                ? 'center'
                : 'flex-start';
          ['instagram', 'tiktok'].forEach((platform) => {
            const linkConfig = socialLinks[platform];
            if (!linkConfig) return;
            const link = createElement(
              'span',
              `oe-panel-email-preview-social-link ${platform}`
            );
            link.style.backgroundColor = settings.iconColour;
            link.setAttribute('aria-label', linkConfig.label);
            links.appendChild(link);
          });
          element.appendChild(links);
          break;
        }
        case 'footer': {
          const divider = createElement(
            'div',
            'oe-panel-email-preview-footer-divider'
          );
          divider.style.borderRadius = `${FIXED_DIVIDER_RADIUS}px`;
          divider.style.backgroundColor = settings.dividerColour;
          const privacyLink = createElement(
            'span',
            'oe-panel-email-preview-privacy-link',
            settings.privacyLabel
          );
          privacyLink.style.color = settings.linkColour;
          const unsubscribeLink = createElement(
            'span',
            'oe-panel-email-preview-unsubscribe-link',
            settings.unsubscribeLabel
          );
          unsubscribeLink.style.color = settings.linkColour;
          setStyles(element, {
            fontSize: `${settings.fontSize}px`,
            color: settings.colour
          });
          element.append(
            divider,
            createElement(
              'p',
              'oe-panel-email-preview-footer-copy',
              settings.text
            ),
            privacyLink,
            unsubscribeLink
          );
          break;
        }
      }
    }

    function renderPreview() {
      const { theme } = state;
      const previewFrame = createElement(
        'div',
        `oe-panel-email-preview-frame ${previewDevice}${isPreviewMode ? ' readonly' : ''}`
      );
      previewFrame.style.backgroundColor = theme.emailBackground;
      previewFrame.style.setProperty(
        '--email-editor-accent',
        theme.accentColour
      );
      const preheader = createElement(
        'span',
        'oe-panel-email-preview-preheader',
        state.message.preheader
      );
      const message = createElement(
        'article',
        'oe-panel-email-preview-message'
      );
      message.style.maxWidth = `${theme.contentWidth}px`;
      message.style.backgroundColor = theme.contentBackground;
      message.style.borderRadius = `${theme.borderRadius}px`;

      if (!isPreviewMode) message.appendChild(createInsertionControl(0));
      state.sections.forEach((sectionInstance, index) => {
        const section = makePreviewSection(sectionInstance);
        populatePreviewSection(section, sectionInstance);
        message.appendChild(section);
        if (!isPreviewMode && sectionInstance.type !== 'footer') {
          message.appendChild(createInsertionControl(index + 1));
        }
      });
      previewFrame.append(preheader, message);
      stage.replaceChildren(previewFrame);
    }

    function updateState(group, key, value) {
      if (JSON.stringify(state[group][key]) === JSON.stringify(value)) return;
      recordHistory(`field:${group}:${key}`);
      state[group][key] = value;
      if (group === 'message' && key === 'templateName') {
        templateName.textContent = value || 'Untitled Email Template';
      }
      markDirty();
      renderPreview();
    }

    function createImagePickerControl(control, values, namespace, onUpdate) {
      const field = createElement(
        'div',
        'oe-panel-email-editor-field image-picker'
      );
      const inputId = `email-template-${namespace}-${control.key}`;
      const label = createElement(
        'label',
        'oe-panel-email-editor-label',
        control.label
      );
      label.htmlFor = inputId;

      const input = createElement('input');
      input.id = inputId;
      input.type = 'hidden';
      input.value = values[control.key] || '';

      const picker = createElement('div', 'oe-panel-email-image-picker');
      const search = createElement(
        'input',
        'oe-panel-email-editor-input oe-panel-email-image-picker-search'
      );
      search.type = 'search';
      search.placeholder = 'Search images';
      search.setAttribute('aria-label', 'Search email images');
      const tabs = createElement('div', 'oe-panel-email-image-picker-tabs');
      tabs.setAttribute('role', 'tablist');
      tabs.setAttribute('aria-label', 'Image types');
      const grid = createElement('div', 'oe-panel-email-image-picker-grid');
      const pagination = createElement(
        'nav',
        'oe-panel-email-image-picker-pagination'
      );
      pagination.setAttribute('aria-label', 'Image pages');
      const status = createElement('p', 'oe-panel-email-image-picker-status');
      status.setAttribute('role', 'status');
      let activeType = control.initialType || 'all';
      let currentPage = 1;
      const allowedTypes = Array.isArray(control.allowedTypes)
        ? new Set(control.allowedTypes)
        : null;

      function updateAlternativeText(nextImage, previousImage) {
        if (!control.altKey || !nextImage?.defaultAlt) return;
        const currentAlt = String(values[control.altKey] || '');
        if (currentAlt && currentAlt !== previousImage?.defaultAlt) return;
        onUpdate(control.altKey, nextImage.defaultAlt);
        const altInput = document.getElementById(
          `email-template-${namespace}-${control.altKey}`
        );
        if (altInput) altInput.value = nextImage.defaultAlt;
      }

      function selectImage(nextPath) {
        const previousImage = emailImages.find(
          (image) => image.path === input.value
        );
        const nextImage = emailImages.find((image) => image.path === nextPath);
        input.value = nextPath;
        onUpdate(control.key, nextPath);
        updateAlternativeText(nextImage, previousImage);
        renderAssets();
      }

      function createTypeTab(value, text) {
        const button = createElement(
          'button',
          'oe-panel-email-image-picker-tab',
          text
        );
        button.type = 'button';
        button.setAttribute('role', 'tab');
        button.dataset.imageType = value;
        button.addEventListener('click', () => {
          activeType = value;
          currentPage = 1;
          renderAssets();
        });
        return button;
      }

      function createPageButton(text, page, ariaLabel = '') {
        const button = createElement(
          'button',
          'oe-panel-email-image-picker-page',
          text
        );
        button.type = 'button';
        if (ariaLabel) button.setAttribute('aria-label', ariaLabel);
        button.addEventListener('click', () => {
          currentPage = page;
          renderAssets();
        });
        return button;
      }

      function renderAssets() {
        const query = search.value.trim().toLowerCase();
        const eligibleImages = emailImages.filter(
          (image) => !allowedTypes || allowedTypes.has(image.type)
        );
        const filteredImages = eligibleImages.filter((image) => {
          const typeMatches = activeType === 'all' || image.type === activeType;
          const searchText = [
            image.name,
            image.relativePath,
            ...(image.categories || [])
          ]
            .join(' ')
            .toLowerCase();
          return typeMatches && (!query || searchText.includes(query));
        });
        const includeNone = control.allowNone && !query;
        const pickerEntries = includeNone
          ? [null, ...filteredImages]
          : filteredImages;
        const pageCount = Math.max(
          1,
          Math.ceil(pickerEntries.length / EMAIL_IMAGE_PAGE_SIZE)
        );
        currentPage = Math.min(Math.max(currentPage, 1), pageCount);
        const pageStart = (currentPage - 1) * EMAIL_IMAGE_PAGE_SIZE;
        const pageEntries = pickerEntries.slice(
          pageStart,
          pageStart + EMAIL_IMAGE_PAGE_SIZE
        );
        const pageImages = pageEntries.filter(Boolean);

        tabs.replaceChildren();
        tabs.hidden = control.showTypeTabs === false;
        if (!tabs.hidden) {
          EMAIL_IMAGE_TYPES.forEach(([type, typeLabel]) => {
            tabs.appendChild(createTypeTab(type, typeLabel));
          });
          tabs.querySelectorAll('button').forEach((button) => {
            const selected = button.dataset.imageType === activeType;
            button.classList.toggle('active', selected);
            button.setAttribute('aria-selected', String(selected));
          });
        }

        grid.replaceChildren();
        pageEntries.forEach((image) => {
          if (!image) {
            const noneButton = createElement(
              'button',
              'oe-panel-email-image-picker-item none',
              'No image'
            );
            noneButton.type = 'button';
            noneButton.classList.toggle('selected', !input.value);
            noneButton.setAttribute('aria-pressed', String(!input.value));
            noneButton.addEventListener('click', () => selectImage(''));
            grid.appendChild(noneButton);
            return;
          }
          const button = createElement(
            'button',
            'oe-panel-email-image-picker-item'
          );
          const thumbnail = createElement(
            'img',
            'oe-panel-email-image-picker-thumbnail'
          );
          const name = createElement(
            'strong',
            'oe-panel-email-image-picker-name',
            image.name
          );
          const details = createElement(
            'span',
            'oe-panel-email-image-picker-details',
            image.format
          );
          button.type = 'button';
          button.dataset.emailImagePath = image.path;
          thumbnail.src = image.path;
          thumbnail.alt = '';
          thumbnail.loading = 'lazy';
          thumbnail.addEventListener('load', () => {
            if (!thumbnail.naturalWidth || !thumbnail.naturalHeight) return;
            details.textContent = `${thumbnail.naturalWidth} x ${thumbnail.naturalHeight} · ${image.format}`;
          });
          const selected = input.value === image.path;
          button.classList.toggle('selected', selected);
          button.setAttribute('aria-pressed', String(selected));
          button.setAttribute('aria-label', `Select ${image.name}`);
          button.addEventListener('click', () => selectImage(image.path));
          button.append(thumbnail, name, details);
          grid.appendChild(button);
        });

        for (
          let slot = pageEntries.length;
          slot < EMAIL_IMAGE_PAGE_SIZE;
          slot += 1
        ) {
          const placeholder = createElement(
            'div',
            'oe-panel-email-image-picker-item oe-panel-email-image-picker-placeholder'
          );
          placeholder.setAttribute('aria-hidden', 'true');
          placeholder.append(
            createElement('span', 'oe-panel-email-image-picker-thumbnail'),
            createElement(
              'strong',
              'oe-panel-email-image-picker-name',
              '\u00a0'
            ),
            createElement(
              'span',
              'oe-panel-email-image-picker-details',
              '\u00a0'
            )
          );
          grid.appendChild(placeholder);
        }

        pagination.replaceChildren();
        pagination.hidden = pageCount <= 1;
        if (!pagination.hidden) {
          const previousButton = createPageButton(
            '\u2039',
            currentPage - 1,
            'Previous image page'
          );
          previousButton.disabled = currentPage === 1;
          pagination.appendChild(previousButton);
          for (let page = 1; page <= pageCount; page += 1) {
            const pageButton = createPageButton(
              String(page),
              page,
              `Image page ${page}`
            );
            const selected = page === currentPage;
            pageButton.classList.toggle('active', selected);
            pageButton.setAttribute(
              'aria-current',
              selected ? 'page' : 'false'
            );
            pagination.appendChild(pageButton);
          }
          const nextButton = createPageButton(
            '\u203a',
            currentPage + 1,
            'Next image page'
          );
          nextButton.disabled = currentPage === pageCount;
          pagination.appendChild(nextButton);
        }

        if (imageLibraryStatus === 'loading') {
          status.textContent = 'Loading images...';
        } else if (imageLibraryStatus === 'error') {
          status.textContent = imageLibraryError || 'Could not load images.';
        } else if (!filteredImages.length) {
          status.textContent = query
            ? 'No images match your search.'
            : 'No images are available in this type.';
        } else if (
          input.value &&
          !eligibleImages.some((image) => image.path === input.value)
        ) {
          status.textContent =
            'The current image is not available for this section.';
        } else if (pageCount > 1) {
          const imageStart = Math.max(0, pageStart - (includeNone ? 1 : 0));
          const imageEnd = imageStart + pageImages.length;
          status.textContent = `${imageStart + 1}-${imageEnd} of ${filteredImages.length} images`;
        } else {
          status.textContent = `${filteredImages.length} image${filteredImages.length === 1 ? '' : 's'}`;
        }
      }

      search.addEventListener('input', () => {
        currentPage = 1;
        renderAssets();
      });
      picker.append(search, tabs, grid, pagination, status);
      field.append(label, input, picker);
      renderAssets();
      return field;
    }

    function createControl(control, values, namespace, onUpdate) {
      if (control.type === 'imagePicker') {
        return createImagePickerControl(control, values, namespace, onUpdate);
      }
      if (control.type === 'themeColour') {
        const field = createElement(
          'div',
          'oe-panel-email-editor-field theme-colour'
        );
        const inputId = `email-template-${namespace}-${control.key}`;
        const sourceId = `email-template-${namespace}-${control.sourceKey}`;
        const label = createElement(
          'label',
          'oe-panel-email-editor-label',
          control.label
        );
        const source = createElement('select', 'oe-panel-email-editor-input');
        const input = createElement('input', 'oe-panel-email-editor-input');
        [
          ['theme-primary', 'Theme Primary'],
          ['theme-secondary', 'Theme Secondary'],
          ['custom', 'Custom']
        ].forEach(([value, text]) => {
          const option = createElement('option', '', text);
          option.value = value;
          source.appendChild(option);
        });
        label.htmlFor = sourceId;
        source.id = sourceId;
        source.value = values[control.sourceKey] || 'custom';
        source.disabled = Boolean(control.disabled);
        input.id = inputId;
        input.type = 'color';
        input.value = values[control.key] || '#000000';
        input.disabled = Boolean(control.disabled);
        const syncCustomInput = () => {
          const showsCustomColour = source.value === 'custom';
          input.hidden = !showsCustomColour;
          field.classList.toggle('shows-custom-colour', showsCustomColour);
        };
        source.addEventListener('change', () => {
          onUpdate(control.sourceKey, source.value);
          syncCustomInput();
        });
        input.addEventListener('input', () =>
          onUpdate(control.key, input.value)
        );
        field.append(label, source, input);
        syncCustomInput();
        return field;
      }
      const field = createElement('div', 'oe-panel-email-editor-field');
      const inputId = `email-template-${namespace}-${control.key}`;
      if (control.type === 'checkboxGroup') {
        field.classList.add('checkbox-group');
        const groupLabel = createElement(
          'span',
          'oe-panel-email-editor-label',
          control.label
        );
        const group = createElement(
          'div',
          'oe-panel-email-editor-checkbox-group'
        );
        group.setAttribute('role', 'group');
        group.setAttribute('aria-labelledby', `${inputId}-label`);
        groupLabel.id = `${inputId}-label`;
        const selectedValues = new Set(
          Array.isArray(values[control.key]) ? values[control.key] : []
        );
        control.options.forEach((optionConfig, index) => {
          const optionId = `${inputId}-${index}`;
          const optionLabel = createElement(
            'label',
            'oe-panel-email-editor-checkbox-option'
          );
          const checkbox = createElement(
            'input',
            'oe-panel-email-editor-input'
          );
          checkbox.type = 'checkbox';
          checkbox.id = optionId;
          checkbox.value = optionConfig.value;
          checkbox.checked = selectedValues.has(optionConfig.value);
          checkbox.disabled = Boolean(
            control.disabled || optionConfig.disabled
          );
          checkbox.addEventListener('change', () => {
            const nextValues = Array.from(
              group.querySelectorAll('input:checked'),
              (input) => input.value
            );
            onUpdate(control.key, nextValues);
          });
          optionLabel.htmlFor = optionId;
          optionLabel.append(
            checkbox,
            createElement('span', '', optionConfig.label)
          );
          group.appendChild(optionLabel);
        });
        field.append(groupLabel, group);
        return field;
      }
      let input;
      if (control.type === 'select') {
        input = createElement('select', 'oe-panel-email-editor-input');
        control.options.forEach((optionConfig) => {
          const option = createElement('option', '', optionConfig.label);
          option.value = optionConfig.value;
          input.appendChild(option);
        });
      } else if (control.type === 'textarea') {
        input = createElement('textarea', 'oe-panel-email-editor-input');
        input.rows = 4;
      } else {
        input = createElement('input', 'oe-panel-email-editor-input');
        input.type = control.type;
      }
      input.id = inputId;
      input.disabled = Boolean(control.disabled);
      if (control.title) input.title = control.title;

      if (control.type === 'checkbox') {
        input.checked = Boolean(values[control.key]);
        const label = createElement(
          'label',
          'oe-panel-email-editor-checkbox-label',
          control.label
        );
        label.htmlFor = inputId;
        field.classList.add('checkbox');
        field.append(input, label);
      } else {
        const label = createElement(
          'label',
          'oe-panel-email-editor-label',
          control.label
        );
        label.htmlFor = inputId;
        input.value = values[control.key] ?? '';
        if (control.min !== undefined) input.min = String(control.min);
        if (control.max !== undefined) input.max = String(control.max);
        if (control.step !== undefined) input.step = String(control.step);
        field.append(label, input);
        if (control.type === 'range') {
          const output = createElement(
            'output',
            'oe-panel-email-editor-range-value',
            `${input.value}${control.suffix || ''}`
          );
          output.htmlFor = inputId;
          field.appendChild(output);
          input.addEventListener('input', () => {
            output.textContent = `${input.value}${control.suffix || ''}`;
          });
        }
      }
      const eventName =
        control.type === 'checkbox' || control.type === 'select'
          ? 'change'
          : 'input';
      input.addEventListener(eventName, () => {
        let value = control.type === 'checkbox' ? input.checked : input.value;
        if (control.type === 'range') value = Number(value);
        onUpdate(control.key, value);
      });
      return field;
    }

    function createInspectorHeader(
      title,
      {
        backAction = () => selectPanel('sections'),
        backLabel = 'Back to all sections'
      } = {}
    ) {
      const header = createElement(
        'header',
        'oe-panel-email-template-editor-inspector-header'
      );
      const backButton = createElement(
        'button',
        'oe-panel-email-template-editor-inspector-back'
      );
      backButton.type = 'button';
      backButton.setAttribute('aria-label', backLabel);
      backButton.addEventListener('click', backAction);
      header.appendChild(backButton);
      header.appendChild(
        createElement(
          'h2',
          'oe-panel-email-template-editor-inspector-title',
          title
        )
      );
      return header;
    }

    function createInspectorForm(controls, values, namespace, onUpdate) {
      const form = createElement('form', 'oe-panel-email-editor-form');
      const fields = [];
      form.addEventListener('submit', (event) => event.preventDefault());

      const syncControlVisibility = () => {
        fields.forEach(({ control, field }) => {
          const condition = control.visibleWhen;
          field.hidden = Boolean(
            condition &&
            condition.greaterThan !== undefined &&
            Number(values[condition.key]) <= Number(condition.greaterThan)
          );
        });
      };

      controls.forEach((control) => {
        const field = createControl(
          control,
          values,
          namespace,
          (key, value) => {
            onUpdate(key, value);
            syncControlVisibility();
          }
        );
        fields.push({ control, field });
        form.appendChild(field);
      });
      syncControlVisibility();
      return form;
    }

    function createNavigationButton(label, panel, description) {
      const button = createElement(
        'button',
        'oe-panel-email-template-editor-layer'
      );
      button.type = 'button';
      button.dataset.emailTemplatePanel = panel;
      button.append(
        createElement(
          'strong',
          'oe-panel-email-template-editor-layer-name',
          label
        ),
        createElement(
          'span',
          'oe-panel-email-template-editor-layer-description',
          description
        )
      );
      button.addEventListener('click', () => selectPanel(panel));
      return button;
    }

    function getLayerRows(layerList, excludedRow = null) {
      return Array.from(
        layerList.querySelectorAll('.oe-panel-email-template-editor-layer-row')
      ).filter((row) => row !== excludedRow);
    }

    function resetDraggedLayerStyles(row) {
      row.classList.remove('is-live-dragging');
      ['left', 'top', 'width', 'height'].forEach((property) => {
        row.style[property] = '';
      });
    }

    function finishSectionDrag({ cancelled = false, render = true } = {}) {
      const drag = activeLayerDrag;
      if (!drag) return;
      activeLayerDrag = null;

      window.removeEventListener('pointermove', drag.onPointerMove);
      window.removeEventListener('pointerup', drag.onPointerUp);
      window.removeEventListener('pointercancel', drag.onPointerCancel);
      if (drag.handle.hasPointerCapture?.(drag.pointerId)) {
        drag.handle.releasePointerCapture(drag.pointerId);
      }
      drag.navigation.classList.remove('is-layer-dragging');

      if (cancelled) {
        const rows = getLayerRows(drag.layerList, drag.row);
        drag.layerList.insertBefore(drag.row, rows[drag.originalIndex] || null);
        drag.placeholder.remove();
        resetDraggedLayerStyles(drag.row);
        return;
      }

      drag.placeholder.replaceWith(drag.row);
      resetDraggedLayerStyles(drag.row);
      const sectionById = new Map(
        state.sections.map((section) => [section.id, section])
      );
      const nextSections = getLayerRows(drag.layerList)
        .map((row) => sectionById.get(row.dataset.emailTemplateLayer))
        .filter(Boolean);
      const orderChanged = nextSections.some(
        (section, index) => section !== state.sections[index]
      );
      if (!orderChanged) return;

      recordHistory();
      state.sections = nextSections;
      markDirty();
      if (render) renderInspector();
      renderPreview();
    }

    function updateSectionDrag(event) {
      const drag = activeLayerDrag;
      if (!drag || event.pointerId !== drag.pointerId) return;
      event.preventDefault();

      drag.row.style.top = `${event.clientY - drag.pointerOffsetY}px`;

      const navigationRect = drag.navigation.getBoundingClientRect();
      const autoScrollZone = 56;
      if (event.clientY < navigationRect.top + autoScrollZone) {
        drag.navigation.scrollTop -= Math.max(
          4,
          (navigationRect.top + autoScrollZone - event.clientY) / 4
        );
      } else if (event.clientY > navigationRect.bottom - autoScrollZone) {
        drag.navigation.scrollTop += Math.max(
          4,
          (event.clientY - (navigationRect.bottom - autoScrollZone)) / 4
        );
      }

      const rows = getLayerRows(drag.layerList, drag.row);
      const footerRow = rows.find(
        (row) => getSection(row.dataset.emailTemplateLayer)?.type === 'footer'
      );
      const nextRow = rows.find((row) => {
        const bounds = row.getBoundingClientRect();
        return event.clientY < bounds.top + bounds.height / 2;
      });
      drag.layerList.insertBefore(
        drag.placeholder,
        nextRow || footerRow || null
      );
    }

    function startSectionDrag(event, sectionInstance, row, handle) {
      if (
        sectionInstance.type === 'footer' ||
        activeLayerDrag ||
        (event.button !== undefined && event.button !== 0)
      ) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      const layerList = row.parentElement;
      const navigation = layerList?.closest(
        '.oe-panel-email-template-editor-layers'
      );
      if (!layerList || !navigation) return;

      const bounds = row.getBoundingClientRect();
      const originalIndex = getLayerRows(layerList).indexOf(row);
      const placeholder = createElement(
        'div',
        'oe-panel-email-template-editor-layer-placeholder'
      );
      placeholder.style.height = `${bounds.height}px`;
      placeholder.setAttribute('aria-hidden', 'true');
      layerList.insertBefore(placeholder, row);
      layerList.appendChild(row);

      setStyles(row, {
        left: `${bounds.left}px`,
        top: `${bounds.top}px`,
        width: `${bounds.width}px`,
        height: `${bounds.height}px`
      });
      row.classList.add('is-live-dragging');
      navigation.classList.add('is-layer-dragging');

      const pointerId = event.pointerId ?? 1;
      const onPointerMove = (pointerEvent) => updateSectionDrag(pointerEvent);
      const onPointerUp = (pointerEvent) => {
        if (pointerEvent.pointerId !== pointerId) return;
        finishSectionDrag();
      };
      const onPointerCancel = (pointerEvent) => {
        if (pointerEvent.pointerId !== pointerId) return;
        finishSectionDrag({ cancelled: true });
      };
      activeLayerDrag = {
        row,
        handle,
        layerList,
        navigation,
        placeholder,
        originalIndex,
        pointerId,
        pointerOffsetY: event.clientY - bounds.top,
        onPointerMove,
        onPointerUp,
        onPointerCancel
      };

      handle.setPointerCapture?.(pointerId);
      window.addEventListener('pointermove', onPointerMove, {
        passive: false
      });
      window.addEventListener('pointerup', onPointerUp);
      window.addEventListener('pointercancel', onPointerCancel);
    }

    function createSectionLayer(sectionInstance) {
      const definition = getSectionDefinition(sectionInstance.type);
      const row = createElement(
        'div',
        'oe-panel-email-template-editor-layer-row'
      );
      row.dataset.emailTemplateLayer = sectionInstance.id;
      row.draggable = false;
      const selectButton = createNavigationButton(
        definition.label,
        sectionInstance.id,
        SECTION_DESCRIPTIONS[sectionInstance.type] || 'Email template section'
      );
      const handle = createElement(
        'span',
        'oe-panel-email-template-editor-drag-handle'
      );
      const canDrag = sectionInstance.type !== 'footer';
      handle.draggable = false;
      handle.setAttribute('role', 'button');
      handle.classList.toggle('disabled', !canDrag);
      handle.setAttribute('aria-disabled', String(!canDrag));
      handle.setAttribute(
        'aria-label',
        canDrag
          ? `Drag ${definition.label} to reorder`
          : `${definition.label} cannot be reordered`
      );
      handle.addEventListener('click', (event) => event.stopPropagation());
      selectButton.appendChild(handle);
      row.appendChild(selectButton);

      handle.addEventListener('pointerdown', (event) => {
        if (canDrag) startSectionDrag(event, sectionInstance, row, handle);
      });
      return row;
    }

    function addSection(type) {
      if (
        type === 'footer' &&
        state.sections.some((item) => item.type === 'footer')
      ) {
        return;
      }
      const instance = {
        id: createSectionId(type),
        type,
        settings: getDefaultSectionSettings(type)
      };
      const index = Math.min(Math.max(insertionIndex, 0), getAppendIndex());
      recordHistory();
      state.sections.splice(index, 0, instance);
      selectedPanel = instance.id;
      markDirty();
      renderInspector();
      renderPreview();
    }

    function showUndoNotice(sectionInstance, index) {
      if (undoTimeout) window.clearTimeout(undoTimeout);
      lastDeletedSection = { sectionInstance, index };
      const label = getSectionDefinition(sectionInstance.type).label;
      const message = createElement('span', '', `${label} deleted`);
      const undoButton = createElement(
        'button',
        'oe-panel-email-template-editor-undo',
        'Undo'
      );
      undoButton.type = 'button';
      undoButton.addEventListener('click', () => {
        if (!lastDeletedSection) return;
        undoHistory();
      });
      notice.replaceChildren(message, undoButton);
      notice.hidden = false;
      undoTimeout = window.setTimeout(() => {
        notice.hidden = true;
        lastDeletedSection = null;
      }, 6000);
    }

    function deleteSection(sectionInstance) {
      if (sectionInstance.type === 'footer') return;
      const index = state.sections.indexOf(sectionInstance);
      if (index === -1) return;
      recordHistory();
      state.sections.splice(index, 1);
      selectedPanel = 'sections';
      markDirty();
      renderInspector();
      renderPreview();
      showUndoNotice(sectionInstance, index);
    }

    function renderSectionLibrary() {
      const library = createElement(
        'div',
        'oe-panel-email-template-editor-section-library'
      );
      Object.entries(config.sectionDefinitions).forEach(
        ([type, definition]) => {
          const button = createElement(
            'button',
            'oe-panel-email-template-editor-section-option'
          );
          button.type = 'button';
          button.dataset.emailTemplateAddSection = type;
          button.append(
            createElement(
              'strong',
              'oe-panel-email-template-editor-section-option-name',
              definition.label
            ),
            createElement(
              'span',
              'oe-panel-email-template-editor-section-option-description',
              type === 'footer'
                ? 'Required compliance information'
                : `Insert ${definition.label.toLowerCase()} here`
            )
          );
          const footerExists = state.sections.some(
            (section) => section.type === 'footer'
          );
          button.disabled = type === 'footer' && footerExists;
          button.addEventListener('click', () => addSection(type));
          library.appendChild(button);
        }
      );
      inspector.replaceChildren(createInspectorHeader('Add Section'), library);
    }

    function formatTemplateDate(value) {
      if (!value) return 'Not saved';
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return 'Not saved';
      return date.toLocaleString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }

    function createTemplateActionButton(
      label,
      className,
      action,
      { requiresTemplate = false, requiresTestRecipient = false } = {}
    ) {
      const button = createElement(
        'button',
        `oe-panel-email-template-settings-action ${className}`,
        label
      );
      button.type = 'button';
      button.dataset.emailTemplatePersistenceAction = 'true';
      button.dataset.requiresTemplate = String(requiresTemplate);
      button.dataset.requiresTestRecipient = String(requiresTestRecipient);
      button.disabled =
        isSaving ||
        (requiresTemplate && !templateId) ||
        (requiresTestRecipient &&
          !isValidTestEmailRecipient(testEmailRecipient));
      button.addEventListener('click', action);
      return button;
    }

    function createWorkflowItem(label, value, key = '') {
      const item = createElement(
        'div',
        'oe-panel-email-template-settings-workflow-item'
      );
      const valueElement = createElement('dd', '', value);
      if (key) valueElement.dataset.emailTemplateWorkflowValue = key;
      item.append(createElement('dt', '', label), valueElement);
      return item;
    }

    function renderTemplateSettingsPanel() {
      const controls = config.templateControls.map((control) => {
        if (control.key !== 'templateKey' || !templatePublishedAt) {
          return control;
        }
        return {
          ...control,
          disabled: true,
          title: 'The template key is locked after the first publish'
        };
      });
      const form = createInspectorForm(
        controls,
        state.message,
        'template-settings',
        (key, value) => updateState('message', key, value)
      );
      form.classList.add('oe-panel-email-template-settings-form');
      form.prepend(
        createElement(
          'h3',
          'oe-panel-email-template-settings-heading',
          'Identity'
        )
      );

      const workflow = createElement(
        'section',
        'oe-panel-email-template-settings-group'
      );
      workflow.appendChild(
        createElement(
          'h3',
          'oe-panel-email-template-settings-heading',
          'Workflow'
        )
      );
      const workflowDetails = createElement(
        'dl',
        'oe-panel-email-template-settings-workflow'
      );
      workflowDetails.append(
        createWorkflowItem(
          'Status',
          isDirty
            ? 'Unsaved changes'
            : templateStatus === 'published'
              ? 'Published'
              : 'Unpublished',
          'status'
        ),
        createWorkflowItem(
          'Last updated',
          formatTemplateDate(templateUpdatedAt)
        )
      );
      if (templatePublishedAt) {
        workflowDetails.appendChild(
          createWorkflowItem(
            'Published',
            formatTemplateDate(templatePublishedAt)
          )
        );
      }
      workflow.appendChild(workflowDetails);

      const actions = createElement(
        'section',
        'oe-panel-email-template-settings-group'
      );
      actions.appendChild(
        createElement(
          'h3',
          'oe-panel-email-template-settings-heading',
          'Actions'
        )
      );
      const actionGrid = createElement(
        'div',
        'oe-panel-email-template-settings-actions'
      );
      const testRecipientField = createElement(
        'div',
        'oe-panel-email-template-test-recipient'
      );
      const testRecipientLabel = createElement(
        'label',
        'oe-panel-email-editor-label',
        'Test Email Address'
      );
      const testRecipientInput = createElement(
        'input',
        'oe-panel-email-editor-input'
      );
      const testRecipientMessage = createElement(
        'p',
        'oe-panel-email-template-test-recipient-message'
      );
      testRecipientInput.id = 'email-template-test-email-recipient';
      testRecipientInput.type = 'email';
      testRecipientInput.required = true;
      testRecipientInput.maxLength = 254;
      testRecipientInput.autocomplete = 'email';
      testRecipientInput.value = testEmailRecipient;
      testRecipientInput.setAttribute(
        'aria-describedby',
        'email-template-test-email-recipient-message'
      );
      testRecipientLabel.htmlFor = testRecipientInput.id;
      testRecipientMessage.id = 'email-template-test-email-recipient-message';
      testRecipientMessage.setAttribute('aria-live', 'polite');
      testRecipientInput.addEventListener('input', () => {
        testEmailRecipient = testRecipientInput.value;
        testEmailRecipientTouched = true;
        testEmailRecipientLoadError = '';
        syncTestEmailRecipientControl();
      });
      testRecipientField.append(
        testRecipientLabel,
        testRecipientInput,
        testRecipientMessage
      );
      const testSendAction = createTemplateActionButton(
        'SEND TEST EMAIL',
        'test-send',
        sendTestEmail,
        { requiresTestRecipient: true }
      );
      actionGrid.append(
        createTemplateActionButton(
          'UPDATE TEMPLATE',
          'primary',
          updateTemplate
        ),
        createTemplateActionButton('PUBLISH', 'publish', publishTemplate),
        createTemplateActionButton('DUPLICATE', 'duplicate', duplicateTemplate),
        testRecipientField,
        testSendAction
      );
      actions.appendChild(actionGrid);

      const danger = createElement(
        'section',
        'oe-panel-email-template-settings-group danger'
      );
      danger.append(
        createElement(
          'h3',
          'oe-panel-email-template-settings-heading',
          'Danger Zone'
        ),
        createTemplateActionButton(
          'DELETE TEMPLATE',
          'delete',
          deleteTemplate,
          { requiresTemplate: true }
        )
      );

      form.append(workflow, actions, danger);
      inspector.replaceChildren(
        createInspectorHeader('Template Settings'),
        form
      );
      syncTestEmailRecipientControl();
    }

    function renderSectionsPanel() {
      const navigation = createElement(
        'nav',
        'oe-panel-email-template-editor-layers'
      );
      navigation.setAttribute('aria-label', 'Email editor panels');
      navigation.append(
        createNavigationButton(
          'Message Settings',
          'message',
          'Subject and preheader'
        ),
        createNavigationButton(
          'Email Theme',
          'theme',
          'Backgrounds, accent and content width'
        )
      );
      const layerList = createElement(
        'div',
        'oe-panel-email-template-editor-layer-list'
      );
      state.sections.forEach((section) => {
        layerList.appendChild(createSectionLayer(section));
      });
      const addButton = createElement(
        'button',
        'oe-panel-email-template-editor-add-section',
        '+ ADD SECTION'
      );
      addButton.type = 'button';
      addButton.addEventListener('click', () => {
        insertionIndex = getAppendIndex();
        selectPanel('add-section');
      });
      const templateSettingsButton = createNavigationButton(
        'Template Settings',
        'template-settings',
        'Identity, workflow and template actions'
      );
      templateSettingsButton.classList.add(
        'oe-panel-email-template-editor-template-settings-link'
      );
      navigation.append(layerList, addButton, templateSettingsButton);
      inspector.replaceChildren(
        createInspectorHeader('Email Editor', {
          backAction: requestCloseEditor,
          backLabel: 'Back to email actions'
        }),
        navigation
      );
    }

    function renderInspector() {
      if (selectedPanel === 'sections') {
        renderSectionsPanel();
        return;
      }
      if (selectedPanel === 'add-section') {
        renderSectionLibrary();
        return;
      }
      if (selectedPanel === 'template-settings') {
        renderTemplateSettingsPanel();
        return;
      }
      if (selectedPanel === 'message' || selectedPanel === 'theme') {
        const isMessage = selectedPanel === 'message';
        const title = isMessage ? 'Message Settings' : 'Email Theme';
        const values = isMessage ? state.message : state.theme;
        const controls = isMessage
          ? config.messageControls
          : config.themeControls;
        const form = createInspectorForm(
          controls,
          values,
          selectedPanel,
          (key, value) => updateState(selectedPanel, key, value)
        );
        inspector.replaceChildren(createInspectorHeader(title), form);
        return;
      }

      const sectionInstance = getSection(selectedPanel);
      if (!sectionInstance) {
        selectedPanel = 'sections';
        renderSectionsPanel();
        return;
      }
      const definition = getSectionDefinition(sectionInstance.type);
      const form = createInspectorForm(
        definition.controls,
        sectionInstance.settings,
        sectionInstance.id,
        (key, value) => {
          if (
            JSON.stringify(sectionInstance.settings[key]) ===
            JSON.stringify(value)
          ) {
            return;
          }
          recordHistory(`field:${sectionInstance.id}:${key}`);
          sectionInstance.settings[key] = value;
          markDirty();
          renderPreview();
        }
      );
      const deleteArea = createElement(
        'div',
        'oe-panel-email-template-editor-delete-area'
      );
      const deleteButton = createElement(
        'button',
        'oe-panel-email-template-editor-delete-section',
        'DELETE SECTION'
      );
      deleteButton.type = 'button';
      deleteButton.disabled = sectionInstance.type === 'footer';
      deleteButton.addEventListener('click', () =>
        deleteSection(sectionInstance)
      );
      deleteArea.appendChild(deleteButton);
      if (sectionInstance.type === 'footer') {
        deleteArea.appendChild(
          createElement(
            'p',
            'oe-panel-email-template-editor-protected-note',
            'The compliance footer is required and cannot be deleted.'
          )
        );
      }
      form.appendChild(deleteArea);
      inspector.replaceChildren(createInspectorHeader(definition.label), form);
    }

    function setPreviewDevice(device) {
      previewDevice = device;
      const desktopActive = device === 'desktop';
      viewportToggleButton.replaceChildren(
        desktopActive ? desktopShape : mobileShape
      );
      desktopShape.classList.toggle('active', desktopActive);
      mobileShape.classList.toggle('active', !desktopActive);
      viewportToggleButton.dataset.previewDevice = device;
      const nextDevice = desktopActive ? 'mobile' : 'desktop';
      const toggleLabel = `Switch to ${nextDevice} preview`;
      viewportToggleButton.setAttribute('aria-label', toggleLabel);
      viewportToggleButton.title = toggleLabel;
      renderPreview();
    }

    function setPreviewMode(enabled) {
      isPreviewMode = Boolean(enabled);
      const label = isPreviewMode ? 'Exit preview mode' : 'Enter preview mode';
      previewModeButton.classList.toggle('active', isPreviewMode);
      previewModeButton.setAttribute('aria-label', label);
      previewModeButton.setAttribute('aria-pressed', String(isPreviewMode));
      previewModeButton.title = label;
      previewModeButton.replaceChildren(createPreviewModeIcon(isPreviewMode));
      renderPreview();
    }

    function closeEditor() {
      if (activeEditor?.state !== state) return;
      finishSectionDrag({ cancelled: true, render: false });
      if (undoTimeout) window.clearTimeout(undoTimeout);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('keydown', handleHistoryShortcut);
      layout.classList.remove('is-email-template-editor-open');
      sidebar.classList.remove('is-email-template-editor-mode');
      container.classList.remove('is-email-template-editor');
      host.classList.remove('oe-panel-widget-email-template-editor-host');
      inspector.remove();
      if (typeof detail.restore === 'function') detail.restore();
      container.dispatchEvent(
        new CustomEvent('oe-panel-request-shrink', { bubbles: true })
      );
      activeEditor = null;
    }

    function handleBeforeUnload(event) {
      if (!isDirty || activeEditor?.state !== state) return;
      event.preventDefault();
      event.returnValue = '';
    }

    async function requestCloseEditor() {
      if (activeEditor?.state !== state || isSaving) return false;
      if (isDirty) {
        const shouldSave = window.confirm(
          'You have unsaved changes. Save them before leaving the email editor?'
        );
        if (shouldSave) {
          const saved = await updateTemplate();
          if (!saved) return false;
        } else {
          const shouldDiscard = window.confirm(
            'Discard your unsaved email template changes?'
          );
          if (!shouldDiscard) return false;
        }
      }
      closeEditor();
      return true;
    }

    function handleHistoryShortcut(event) {
      if (
        activeEditor?.state !== state ||
        !(event.ctrlKey || event.metaKey) ||
        event.altKey
      ) {
        return;
      }

      const key = event.key.toLowerCase();
      if (key === 'z') {
        event.preventDefault();
        if (event.shiftKey) redoHistory();
        else undoHistory();
        return;
      }
      if (key === 'y' && !event.shiftKey) {
        event.preventDefault();
        redoHistory();
      }
    }

    updateTemplateButton.addEventListener('click', updateTemplate);
    undoHistoryButton.addEventListener('click', undoHistory);
    redoHistoryButton.addEventListener('click', redoHistory);
    viewportToggleButton.addEventListener('click', () => {
      setPreviewDevice(previewDevice === 'desktop' ? 'mobile' : 'desktop');
    });
    previewModeButton.addEventListener('click', () => {
      setPreviewMode(!isPreviewMode);
    });

    layout.classList.add('is-email-template-editor-open');
    sidebar.classList.add('is-email-template-editor-mode');
    container.classList.add('is-email-template-editor');
    host.className =
      'oe-panel-widget oe-panel-widget-actions oe-panel-widget-email-template-editor-host';
    host.replaceChildren(editor);
    sidebar.appendChild(inspector);
    renderInspector();
    renderPreview();
    container.dispatchEvent(
      new CustomEvent('oe-panel-request-expand', { bubbles: true })
    );

    activeEditor = {
      close: requestCloseEditor,
      state,
      getTemplateData,
      load: loadTemplate,
      save: updateTemplate
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('keydown', handleHistoryShortcut);
    loadEmailImageLibrary();
    loadEmailPreferences();
    if (templateId) loadTemplate(templateId);
    return activeEditor;
  }

  window.addEventListener(EDITOR_EVENT, async (event) => {
    if (activeEditor && !(await activeEditor.close())) return;
    createEmailTemplateEditor(event.detail);
  });

  window.addEventListener('oe-panel-table-row-action', async (event) => {
    if (event.detail?.action !== 'open-email-template') return;
    const templateId = event.detail?.row?.templateId;
    const container = document.querySelector(
      '[data-oe-panel-grid="emails-grid-4"]'
    );
    const host = container?.querySelector('.oe-panel-widget');
    if (!templateId || !container || !host) return;

    if (activeEditor && !(await activeEditor.close())) return;
    const previousNodes = Array.from(host.childNodes);
    createEmailTemplateEditor({
      container,
      host,
      actionConfig: { templateId },
      restore() {
        host.replaceChildren(...previousNodes);
      }
    });
  });

  window.OE_PANEL_EMAIL_TEMPLATE_EDITOR = { create: createEmailTemplateEditor };
})();
