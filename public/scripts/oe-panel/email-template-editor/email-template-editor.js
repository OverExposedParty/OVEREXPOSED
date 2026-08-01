(function () {
  const EDITOR_EVENT = 'oe-panel-email-template-editor-request';
  const EXTRA_SECTION_DEFAULTS = {
    image: {
      src: '/images/emails/email-confirmation/email-confirmation.png',
      alt: 'OVEREXPOSED artwork',
      link: '/',
      width: 100,
      alignment: 'center',
      borderRadius: 0
    },
    divider: { colour: '#66ccff', thickness: 1, width: 86 },
    spacer: { height: 40 },
    socialLinks: {
      heading: 'Follow OVEREXPOSED',
      instagramUrl: 'https://instagram.com/',
      tiktokUrl: 'https://tiktok.com/',
      youtubeUrl: 'https://youtube.com/',
      colour: '#66ccff',
      alignment: 'center'
    }
  };
  let activeEditor = null;

  function createElement(tagName, className, textContent) {
    const element = document.createElement(tagName);
    if (className) element.className = className;
    if (textContent !== undefined) element.textContent = textContent;
    return element;
  }

  function cloneValue(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function setStyles(element, styles) {
    Object.entries(styles).forEach(([property, value]) => {
      element.style[property] = value;
    });
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
          return { id: type, type, settings };
        }
      )
    };
    let selectedPanel = 'sections';
    let insertionIndex = state.sections.length;
    let previewDevice = 'desktop';
    let draggedSectionId = '';
    let lastDeletedSection = null;
    let undoTimeout = null;
    let templateId = String(detail?.actionConfig?.templateId || '');
    let templateVersion = 0;
    let templateStatus = 'draft';
    let isDirty = true;
    let isSaving = false;

    const editor = createElement('div', 'oe-panel-email-template-editor');
    const toolbar = createElement(
      'header',
      'oe-panel-email-template-editor-toolbar'
    );
    const exitButton = createElement(
      'button',
      'oe-panel-email-template-editor-exit',
      'Exit Editor'
    );
    exitButton.type = 'button';

    const identity = createElement(
      'div',
      'oe-panel-email-template-editor-identity'
    );
    const templateNameLabel = createElement(
      'label',
      'oe-panel-email-template-editor-template-label',
      'Template Name'
    );
    templateNameLabel.htmlFor = 'email-template-editor-template-name';
    const templateNameInput = createElement(
      'input',
      'oe-panel-email-template-editor-template-name'
    );
    templateNameInput.id = 'email-template-editor-template-name';
    templateNameInput.type = 'text';
    templateNameInput.value = state.message.templateName;
    const draftStatus = createElement(
      'span',
      'oe-panel-email-template-editor-status',
      'Unsaved changes'
    );
    identity.append(templateNameLabel, templateNameInput, draftStatus);

    const viewportControls = createElement(
      'div',
      'oe-panel-email-template-editor-viewports'
    );
    viewportControls.setAttribute('aria-label', 'Email editor actions');
    const desktopButton = createElement(
      'button',
      'oe-panel-email-template-editor-viewport active',
      'Desktop'
    );
    const mobileButton = createElement(
      'button',
      'oe-panel-email-template-editor-viewport',
      'Mobile'
    );
    desktopButton.type = 'button';
    mobileButton.type = 'button';
    desktopButton.setAttribute('aria-pressed', 'true');
    mobileButton.setAttribute('aria-pressed', 'false');
    const saveButton = createElement(
      'button',
      'oe-panel-email-template-editor-save',
      'Save Draft'
    );
    const publishButton = createElement(
      'button',
      'oe-panel-email-template-editor-publish',
      'Publish'
    );
    const testSendButton = createElement(
      'button',
      'oe-panel-email-template-editor-test-send',
      'Send Test'
    );
    saveButton.type = 'button';
    publishButton.type = 'button';
    testSendButton.type = 'button';
    viewportControls.append(
      desktopButton,
      mobileButton,
      saveButton,
      publishButton,
      testSendButton
    );
    toolbar.append(exitButton, identity, viewportControls);

    const stage = createElement('main', 'oe-panel-email-template-editor-stage');
    stage.setAttribute('aria-label', 'Email template preview');
    const notice = createElement(
      'div',
      'oe-panel-email-template-editor-notice'
    );
    notice.hidden = true;
    notice.setAttribute('role', 'status');
    editor.append(toolbar, stage, notice);

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
      saveButton.disabled = busy;
      publishButton.disabled = busy;
      testSendButton.disabled = busy;
    }

    function markDirty() {
      isDirty = true;
      templateStatus = 'draft';
      setEditorStatus('Unsaved changes', 'warning');
    }

    function getTemplateData() {
      return {
        key: state.message.templateKey || '',
        name: state.message.templateName,
        category: state.message.category,
        subject: state.message.subject,
        preheader: state.message.preheader,
        theme: cloneValue(state.theme),
        sections: cloneValue(state.sections),
        ...(templateVersion ? { version: templateVersion } : {})
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

    function applyTemplateData(template) {
      templateId = String(template.id || template._id || templateId || '');
      templateVersion = Number(template.version || 1);
      templateStatus = template.status || 'draft';
      state.message = {
        templateName: template.name || 'Untitled Email Template',
        templateKey: template.key || '',
        subject: template.subject || '',
        preheader: template.preheader || '',
        category: template.category || 'transactional'
      };
      state.theme = cloneValue(template.theme || state.theme);
      state.sections = cloneValue(template.sections || state.sections);
      rebuildSectionCounts();
      templateNameInput.value = state.message.templateName;
      selectedPanel = 'sections';
      isDirty = false;
      setEditorStatus(
        `${templateStatus === 'published' ? 'Published' : 'Draft'} · v${templateVersion}`,
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

    async function saveDraft() {
      if (isSaving) return null;
      if (!isDirty && templateId)
        return { id: templateId, version: templateVersion };
      setPersistenceBusy(true);
      setEditorStatus('Saving…');
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
        applyTemplateData(data.template);
        setEditorStatus(`Draft saved · v${templateVersion}`, 'success');
        return data.template;
      } catch (error) {
        setEditorStatus(error.message, 'error');
        return null;
      } finally {
        setPersistenceBusy(false);
      }
    }

    async function publishTemplate() {
      const saved = await saveDraft();
      if (!saved || !templateId || isSaving) return;
      setPersistenceBusy(true);
      setEditorStatus('Publishing…');
      try {
        const data = await requestTemplateApi(
          `/api/oe-panel/emails/templates/${encodeURIComponent(templateId)}/publish`,
          {
            method: 'POST',
            body: JSON.stringify({ version: templateVersion })
          }
        );
        applyTemplateData(data.template);
        setEditorStatus(`Published · v${templateVersion}`, 'success');
      } catch (error) {
        setEditorStatus(error.message, 'error');
      } finally {
        setPersistenceBusy(false);
      }
    }

    async function sendTestEmail() {
      const saved = await saveDraft();
      if (!saved || !templateId || isSaving) return;
      setPersistenceBusy(true);
      setEditorStatus('Sending test…');
      try {
        const data = await requestTemplateApi(
          `/api/oe-panel/emails/templates/${encodeURIComponent(templateId)}/test-send`,
          { method: 'POST', body: '{}' }
        );
        setEditorStatus(
          data.skipped
            ? 'Draft saved · email provider not configured'
            : `Test sent to ${data.recipient}`,
          data.skipped ? 'warning' : 'success'
        );
      } catch (error) {
        setEditorStatus(error.message, 'error');
      } finally {
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
      return cloneValue(templateDefaults || EXTRA_SECTION_DEFAULTS[type] || {});
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
      const settings = sectionInstance.settings;
      switch (sectionInstance.type) {
        case 'logo': {
          element.style.textAlign = settings.alignment;
          const image = createElement('img', 'oe-panel-email-preview-logo');
          image.src = settings.src;
          image.alt = settings.alt;
          image.style.width = `${settings.width}px`;
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
            subheading.style.fontFamily = settings.subheadingFontFamily;
            element.appendChild(subheading);
          }
          break;
        }
        case 'hero': {
          if (settings.visible) {
            const image = createElement('img', 'oe-panel-email-preview-hero');
            image.src = settings.src;
            image.alt = settings.alt;
            image.style.borderRadius = `${settings.borderRadius}px`;
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
          image.style.borderRadius = `${settings.borderRadius}px`;
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
            borderRadius: `${settings.borderRadius}px`
          });
          element.appendChild(action);
          break;
        }
        case 'divider': {
          const divider = createElement('hr', 'oe-panel-email-preview-divider');
          divider.style.width = `${settings.width}%`;
          divider.style.borderTopColor = settings.colour;
          divider.style.borderTopWidth = `${settings.thickness}px`;
          element.appendChild(divider);
          break;
        }
        case 'spacer': {
          element.classList.add('is-spacer');
          element.style.minHeight = `${settings.height}px`;
          break;
        }
        case 'socialLinks': {
          element.style.textAlign = settings.alignment;
          element.style.color = settings.colour;
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
          [
            ['Instagram', settings.instagramUrl],
            ['TikTok', settings.tiktokUrl],
            ['YouTube', settings.youtubeUrl]
          ].forEach(([label, url]) => {
            if (!url) return;
            const link = createElement(
              'span',
              'oe-panel-email-preview-social-link',
              label
            );
            link.style.color = settings.colour;
            links.appendChild(link);
          });
          element.appendChild(links);
          break;
        }
        case 'footer': {
          setStyles(element, {
            fontSize: `${settings.fontSize}px`,
            color: settings.colour
          });
          element.append(
            createElement(
              'p',
              'oe-panel-email-preview-footer-copy',
              settings.text
            ),
            createElement(
              'span',
              'oe-panel-email-preview-privacy-link',
              settings.privacyLabel
            ),
            createElement(
              'span',
              'oe-panel-email-preview-unsubscribe-link',
              settings.unsubscribeLabel
            )
          );
          break;
        }
      }
    }

    function renderPreview() {
      const { theme } = state;
      const previewFrame = createElement(
        'div',
        `oe-panel-email-preview-frame ${previewDevice}`
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

      message.appendChild(createInsertionControl(0));
      state.sections.forEach((sectionInstance, index) => {
        const section = makePreviewSection(sectionInstance);
        populatePreviewSection(section, sectionInstance);
        message.appendChild(section);
        if (sectionInstance.type !== 'footer') {
          message.appendChild(createInsertionControl(index + 1));
        }
      });
      previewFrame.append(preheader, message);
      stage.replaceChildren(previewFrame);
    }

    function updateState(group, key, value) {
      state[group][key] = value;
      if (group === 'message' && key === 'templateName') {
        templateNameInput.value = value;
      }
      markDirty();
      renderPreview();
    }

    function createControl(control, values, namespace, onUpdate) {
      const field = createElement('div', 'oe-panel-email-editor-field');
      const inputId = `email-template-${namespace}-${control.key}`;
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

    function createInspectorHeader(title, showBackButton = true) {
      const header = createElement(
        'header',
        'oe-panel-email-template-editor-inspector-header'
      );
      if (showBackButton) {
        const backButton = createElement(
          'button',
          'oe-panel-email-template-editor-inspector-back',
          'All Sections'
        );
        backButton.type = 'button';
        backButton.addEventListener('click', () => selectPanel('sections'));
        header.appendChild(backButton);
      }
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
      form.addEventListener('submit', (event) => event.preventDefault());
      controls.forEach((control) => {
        form.appendChild(createControl(control, values, namespace, onUpdate));
      });
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

    function reorderSection(sectionId, targetId) {
      if (sectionId === targetId) return;
      const section = getSection(sectionId);
      const target = getSection(targetId);
      if (!section || !target || section.type === 'footer') return;
      const oldIndex = state.sections.indexOf(section);
      state.sections.splice(oldIndex, 1);
      const targetIndex = state.sections.indexOf(target);
      state.sections.splice(Math.max(0, targetIndex), 0, section);
      markDirty();
      renderInspector();
      renderPreview();
    }

    function moveSection(sectionId, offset) {
      const section = getSection(sectionId);
      if (!section || section.type === 'footer') return;
      const index = state.sections.indexOf(section);
      const footerIndex = state.sections.findIndex(
        (item) => item.type === 'footer'
      );
      const maximum =
        footerIndex === -1 ? state.sections.length - 1 : footerIndex - 1;
      const nextIndex = Math.min(Math.max(index + offset, 0), maximum);
      if (nextIndex === index) return;
      state.sections.splice(index, 1);
      state.sections.splice(nextIndex, 0, section);
      markDirty();
      renderInspector();
      renderPreview();
    }

    function createSectionLayer(sectionInstance, index) {
      const definition = getSectionDefinition(sectionInstance.type);
      const row = createElement(
        'div',
        'oe-panel-email-template-editor-layer-row'
      );
      row.dataset.emailTemplateLayer = sectionInstance.id;
      row.draggable = sectionInstance.type !== 'footer';
      const handle = createElement(
        'span',
        'oe-panel-email-template-editor-drag-handle',
        '⋮⋮'
      );
      handle.setAttribute('aria-hidden', 'true');
      const selectButton = createNavigationButton(
        definition.label,
        sectionInstance.id,
        sectionInstance.type === 'footer'
          ? 'Required compliance section'
          : 'Drag or use the arrows to reorder'
      );
      const movement = createElement(
        'div',
        'oe-panel-email-template-editor-layer-movement'
      );
      const upButton = createElement(
        'button',
        'oe-panel-email-template-editor-layer-move',
        '↑'
      );
      const downButton = createElement(
        'button',
        'oe-panel-email-template-editor-layer-move',
        '↓'
      );
      upButton.type = 'button';
      downButton.type = 'button';
      upButton.setAttribute('aria-label', `Move ${definition.label} up`);
      downButton.setAttribute('aria-label', `Move ${definition.label} down`);
      upButton.disabled = index === 0 || sectionInstance.type === 'footer';
      const footerIndex = state.sections.findIndex(
        (item) => item.type === 'footer'
      );
      const lastMovableIndex =
        footerIndex === -1 ? state.sections.length - 1 : footerIndex - 1;
      downButton.disabled =
        index >= lastMovableIndex || sectionInstance.type === 'footer';
      upButton.addEventListener('click', () =>
        moveSection(sectionInstance.id, -1)
      );
      downButton.addEventListener('click', () =>
        moveSection(sectionInstance.id, 1)
      );
      movement.append(upButton, downButton);
      row.append(handle, selectButton, movement);

      row.addEventListener('dragstart', (event) => {
        draggedSectionId = sectionInstance.id;
        row.classList.add('dragging');
        event.dataTransfer?.setData('text/plain', sectionInstance.id);
      });
      row.addEventListener('dragend', () => {
        draggedSectionId = '';
        row.classList.remove('dragging');
      });
      row.addEventListener('dragover', (event) => event.preventDefault());
      row.addEventListener('drop', (event) => {
        event.preventDefault();
        const sourceId =
          event.dataTransfer?.getData('text/plain') || draggedSectionId;
        reorderSection(sourceId, sectionInstance.id);
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
        const deleted = lastDeletedSection;
        state.sections.splice(
          Math.min(deleted.index, getAppendIndex()),
          0,
          deleted.sectionInstance
        );
        lastDeletedSection = null;
        notice.hidden = true;
        selectedPanel = deleted.sectionInstance.id;
        markDirty();
        renderInspector();
        renderPreview();
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
          'Name, subject, preheader and category'
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
      state.sections.forEach((section, index) => {
        layerList.appendChild(createSectionLayer(section, index));
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
      navigation.append(layerList, addButton);
      inspector.replaceChildren(
        createInspectorHeader('Email Editor', false),
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
      desktopButton.classList.toggle('active', desktopActive);
      mobileButton.classList.toggle('active', !desktopActive);
      desktopButton.setAttribute('aria-pressed', String(desktopActive));
      mobileButton.setAttribute('aria-pressed', String(!desktopActive));
      renderPreview();
    }

    function closeEditor() {
      if (activeEditor?.close !== closeEditor) return;
      if (undoTimeout) window.clearTimeout(undoTimeout);
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

    templateNameInput.addEventListener('input', () => {
      state.message.templateName = templateNameInput.value;
      markDirty();
      const inspectorInput = document.getElementById(
        'email-template-message-templateName'
      );
      if (inspectorInput && inspectorInput !== templateNameInput) {
        inspectorInput.value = templateNameInput.value;
      }
    });
    exitButton.addEventListener('click', closeEditor);
    desktopButton.addEventListener('click', () => setPreviewDevice('desktop'));
    mobileButton.addEventListener('click', () => setPreviewDevice('mobile'));
    saveButton.addEventListener('click', saveDraft);
    publishButton.addEventListener('click', publishTemplate);
    testSendButton.addEventListener('click', sendTestEmail);

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
      close: closeEditor,
      state,
      getTemplateData,
      load: loadTemplate,
      save: saveDraft
    };
    if (templateId) loadTemplate(templateId);
    return activeEditor;
  }

  window.addEventListener(EDITOR_EVENT, (event) => {
    if (activeEditor) activeEditor.close();
    createEmailTemplateEditor(event.detail);
  });

  window.addEventListener('oe-panel-table-row-action', (event) => {
    if (event.detail?.action !== 'open-email-template') return;
    const templateId = event.detail?.row?.templateId;
    const container = document.querySelector(
      '[data-oe-panel-grid="emails-grid-4"]'
    );
    const host = container?.querySelector('.oe-panel-widget');
    if (!templateId || !container || !host) return;

    const previousNodes = Array.from(host.childNodes);
    if (activeEditor) activeEditor.close();
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
