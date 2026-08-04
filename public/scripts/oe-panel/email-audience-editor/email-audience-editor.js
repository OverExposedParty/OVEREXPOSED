(function () {
  const EDITOR_EVENT = 'oe-panel-email-audience-editor-request';
  const FILTERS = {
    emailVerified: {
      label: 'Email Verified',
      type: 'boolean',
      operators: ['is']
    },
    accountStatus: {
      label: 'Account Status',
      type: 'select',
      operators: ['is', 'is-not'],
      options: [
        { label: 'Active', value: 'active' },
        { label: 'Pending Verification', value: 'pending_verification' }
      ]
    },
    createdAt: {
      label: 'Account Created',
      type: 'date',
      operators: ['after', 'before']
    },
    lastActiveAt: {
      label: 'Last Active',
      type: 'date',
      operators: ['after', 'before']
    },
    country: {
      label: 'Country Code',
      type: 'text',
      operators: ['is', 'is-not'],
      maxlength: 2
    },
    preferredLanguage: {
      label: 'Preferred Language',
      type: 'text',
      operators: ['is', 'is-not'],
      maxlength: 12
    },
    hasPurchased: {
      label: 'Has Purchased',
      type: 'boolean',
      operators: ['is']
    },
    hasPlayedGame: {
      label: 'Has Played a Game',
      type: 'boolean',
      operators: ['is']
    },
    adminRole: {
      label: 'Admin Role',
      type: 'text',
      operators: ['is', 'is-not'],
      maxlength: 100
    }
  };
  const OPERATOR_LABELS = {
    is: 'Is',
    'is-not': 'Is Not',
    after: 'After',
    before: 'Before'
  };

  function createElement(tagName, className = '', text = '') {
    const element = document.createElement(tagName);
    if (className) element.className = className;
    if (text) element.textContent = text;
    return element;
  }

  function createOption(value, label) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    return option;
  }

  function createField(labelText, control, className = '') {
    const field = createElement(
      'label',
      [
        'oe-panel-social-edit-meta-field',
        'oe-panel-email-audience-field',
        className
      ]
        .filter(Boolean)
        .join(' ')
    );
    field.append(createElement('span', '', labelText), control);
    return field;
  }

  function createBackHeader(title, onBack) {
    const header = createElement('div', 'oe-panel-alert-detail-header');
    const back = createElement('button', 'oe-panel-alert-detail-back');
    back.type = 'button';
    back.setAttribute('aria-label', 'Back to audience actions');
    back.addEventListener('click', onBack);
    const heading = createElement('h3', 'oe-panel-alert-detail-title', title);
    header.append(back, heading);
    return header;
  }

  async function requestJson(endpoint, options = {}) {
    const response = await fetch(endpoint, {
      credentials: 'same-origin',
      ...options,
      headers: {
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(options.headers || {})
      }
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.success === false) {
      throw new Error(payload?.error?.message || 'Audience request failed.');
    }
    return payload.data || {};
  }

  function createAudienceEditor(detail, initialAudience = null) {
    const container = detail.container;
    const isEditing = Boolean(initialAudience?.id);
    const previewOnly = detail.previewOnly === true;
    let previewTimer = null;
    let previewRequest = 0;

    const widget = createElement(
      'div',
      'oe-panel-widget oe-panel-widget-form oe-panel-social-creation oe-panel-social-action-view oe-panel-social-idea-create-view oe-panel-game-pack-create-view oe-panel-email-audience-editor'
    );
    const form = createElement(
      'form',
      'oe-panel-social-edit-panels oe-panel-social-idea-form oe-panel-game-pack-form oe-panel-email-audience-form'
    );
    const fields = createElement('div', 'oe-panel-email-audience-fields');
    const status = createElement(
      'p',
      'oe-panel-social-creation-status oe-panel-email-audience-status'
    );
    status.setAttribute('aria-live', 'polite');

    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.required = true;
    nameInput.maxLength = 160;
    nameInput.className = 'oe-panel-social-edit-meta-input';
    nameInput.value = initialAudience?.name || '';

    const descriptionInput = document.createElement('textarea');
    descriptionInput.maxLength = 500;
    descriptionInput.rows = 3;
    descriptionInput.className = 'oe-panel-social-edit-meta-input is-multiline';
    descriptionInput.value = initialAudience?.description || '';

    const typeSelect = document.createElement('select');
    typeSelect.className = 'oe-panel-social-edit-meta-input';
    typeSelect.append(
      createOption('dynamic', 'Dynamic'),
      createOption('static', 'Static'),
      createOption('manual', 'Manual')
    );
    typeSelect.value = initialAudience?.type || 'dynamic';

    const statusSelect = document.createElement('select');
    statusSelect.className = 'oe-panel-social-edit-meta-input';
    statusSelect.append(
      createOption('active', 'Active'),
      createOption('inactive', 'Inactive')
    );
    statusSelect.value = initialAudience?.status || 'active';

    const matchSelect = document.createElement('select');
    matchSelect.className = 'oe-panel-social-edit-meta-input';
    matchSelect.append(
      createOption('all', 'All Conditions'),
      createOption('any', 'Any Condition')
    );
    matchSelect.value = initialAudience?.match || 'all';

    const consentInput = document.createElement('input');
    consentInput.type = 'checkbox';
    consentInput.checked = initialAudience?.requireMarketingConsent !== false;
    const consentToggle = createElement(
      'label',
      'oe-panel-social-edit-meta-field oe-panel-email-audience-consent'
    );
    consentToggle.append(
      consentInput,
      createElement('span', '', 'Require Marketing Consent')
    );

    const identityRow = createElement(
      'div',
      'oe-panel-email-audience-field-row'
    );
    identityRow.append(
      createField('Audience Name', nameInput),
      createField('Audience Type', typeSelect),
      createField('Status', statusSelect)
    );
    fields.append(
      identityRow,
      createField('Description', descriptionInput, 'wide'),
      consentToggle
    );

    const rulesSection = createElement(
      'section',
      'oe-panel-social-edit-panel oe-panel-email-audience-section rules'
    );
    const rulesHeader = createElement(
      'div',
      'oe-panel-social-edit-panel-header oe-panel-email-audience-section-header'
    );
    const addConditionButton = createElement(
      'button',
      'oe-panel-game-pack-add-question oe-panel-email-audience-secondary-action',
      'Add Filter'
    );
    addConditionButton.type = 'button';
    rulesHeader.append(
      createElement(
        'h4',
        'oe-panel-social-edit-panel-title',
        'Audience Filters'
      ),
      matchSelect,
      addConditionButton
    );
    const conditionList = createElement(
      'div',
      'oe-panel-email-audience-condition-list'
    );
    rulesSection.append(rulesHeader, conditionList);

    const manualSection = createElement(
      'section',
      'oe-panel-social-edit-panel oe-panel-email-audience-section manual'
    );
    const manualIdentifiers = document.createElement('textarea');
    manualIdentifiers.rows = 8;
    manualIdentifiers.className =
      'oe-panel-social-edit-meta-input is-multiline';
    manualIdentifiers.placeholder = 'username or email address';
    manualIdentifiers.value = Array.from(
      initialAudience?.manualIdentifiers || []
    ).join('\n');
    manualSection.append(
      createElement(
        'h4',
        'oe-panel-social-edit-panel-title',
        'Manual Recipients'
      ),
      createField('Usernames or Email Addresses', manualIdentifiers, 'wide')
    );

    const previewSection = createElement(
      'section',
      'oe-panel-social-edit-panel oe-panel-email-audience-section preview'
    );
    const previewHeader = createElement(
      'div',
      'oe-panel-social-edit-panel-header oe-panel-email-audience-section-header'
    );
    const previewButton = createElement(
      'button',
      'oe-panel-game-pack-add-question oe-panel-email-audience-secondary-action',
      'Refresh Preview'
    );
    previewButton.type = 'button';
    previewHeader.append(
      createElement(
        'h4',
        'oe-panel-social-edit-panel-title',
        'Recipient Preview'
      ),
      previewButton
    );
    const counts = createElement('dl', 'oe-panel-email-audience-counts');
    const countValues = {};
    [
      ['matched', 'Matched'],
      ['suppressed', 'Suppressed'],
      ['eligible', 'Eligible']
    ].forEach(([key, label]) => {
      const group = createElement('div');
      const value = createElement('dd', '', '-');
      countValues[key] = value;
      group.append(createElement('dt', '', label), value);
      counts.appendChild(group);
    });
    const previewTable = createElement(
      'div',
      'oe-panel-email-audience-preview-list'
    );
    previewSection.append(previewHeader, counts, previewTable);

    const actions = createElement('div', 'oe-panel-email-audience-actions');
    const saveButton = createElement(
      'button',
      'oe-panel-social-edit-save oe-panel-email-audience-primary-action',
      isEditing ? 'Save Audience' : 'Create Audience'
    );
    saveButton.type = 'submit';
    actions.appendChild(saveButton);

    function getConditionRows() {
      return Array.from(
        conditionList.querySelectorAll('.oe-panel-email-audience-condition-row')
      );
    }

    function updateConditionValue(row, savedValue = '') {
      const fieldSelect = row.querySelector('[data-audience-condition-field]');
      const definition = FILTERS[fieldSelect.value];
      const valueSlot = row.querySelector('[data-audience-condition-value]');
      let input;
      if (definition.type === 'boolean') {
        input = document.createElement('select');
        input.append(createOption('true', 'Yes'), createOption('false', 'No'));
      } else if (definition.type === 'select') {
        input = document.createElement('select');
        definition.options.forEach((option) =>
          input.appendChild(createOption(option.value, option.label))
        );
      } else {
        input = document.createElement('input');
        input.type = definition.type;
        input.maxLength = definition.maxlength || 100;
      }
      input.required = true;
      input.className = 'oe-panel-social-edit-meta-input';
      input.dataset.audienceConditionInput = '';
      if (savedValue !== undefined && savedValue !== null) {
        input.value =
          definition.type === 'date'
            ? String(savedValue).slice(0, 10)
            : String(savedValue);
      }
      valueSlot.replaceChildren(input);
    }

    function updateConditionOperators(row, savedOperator = '') {
      const fieldSelect = row.querySelector('[data-audience-condition-field]');
      const operatorSelect = row.querySelector(
        '[data-audience-condition-operator]'
      );
      const operators = FILTERS[fieldSelect.value].operators;
      operatorSelect.replaceChildren(
        ...operators.map((operator) =>
          createOption(operator, OPERATOR_LABELS[operator])
        )
      );
      if (operators.includes(savedOperator))
        operatorSelect.value = savedOperator;
    }

    function addCondition(condition = {}) {
      const row = createElement('div', 'oe-panel-email-audience-condition-row');
      const fieldSelect = document.createElement('select');
      fieldSelect.className = 'oe-panel-social-edit-meta-input';
      fieldSelect.dataset.audienceConditionField = '';
      Object.entries(FILTERS).forEach(([value, definition]) =>
        fieldSelect.appendChild(createOption(value, definition.label))
      );
      if (FILTERS[condition.field]) fieldSelect.value = condition.field;

      const operatorSelect = document.createElement('select');
      operatorSelect.className = 'oe-panel-social-edit-meta-input';
      operatorSelect.dataset.audienceConditionOperator = '';
      const valueSlot = createElement('div');
      valueSlot.dataset.audienceConditionValue = '';
      const removeButton = createElement(
        'button',
        'oe-panel-game-pack-question-clear oe-panel-email-audience-remove-condition',
        'X'
      );
      removeButton.type = 'button';
      removeButton.title = 'Remove filter';
      removeButton.setAttribute('aria-label', 'Remove filter');
      removeButton.addEventListener('click', () => {
        row.remove();
        schedulePreview();
      });
      row.append(fieldSelect, operatorSelect, valueSlot, removeButton);
      updateConditionOperators(row, condition.operator);
      updateConditionValue(row, condition.value);
      fieldSelect.addEventListener('change', () => {
        updateConditionOperators(row);
        updateConditionValue(row);
        schedulePreview();
      });
      conditionList.appendChild(row);
    }

    function buildPayload() {
      return {
        name: nameInput.value.trim(),
        description: descriptionInput.value.trim(),
        type: typeSelect.value,
        status: statusSelect.value,
        match: matchSelect.value,
        requireMarketingConsent: consentInput.checked,
        conditions: getConditionRows().map((row) => ({
          field: row.querySelector('[data-audience-condition-field]').value,
          operator: row.querySelector('[data-audience-condition-operator]')
            .value,
          value: row.querySelector('[data-audience-condition-input]').value
        })),
        manualIdentifiers: manualIdentifiers.value
      };
    }

    function renderPreview(resolution) {
      countValues.matched.textContent = Number(
        resolution.matchedCount || 0
      ).toLocaleString();
      countValues.suppressed.textContent = Number(
        resolution.suppressedCount || 0
      ).toLocaleString();
      countValues.eligible.textContent = Number(
        resolution.eligibleCount || 0
      ).toLocaleString();
      const recipients = Array.isArray(resolution.preview)
        ? resolution.preview
        : [];
      previewTable.replaceChildren(
        ...recipients.map((recipient) => {
          const row = createElement('div');
          row.append(
            createElement(
              'strong',
              '',
              recipient.displayName || recipient.username || '-'
            ),
            createElement('span', '', recipient.email || '-')
          );
          return row;
        })
      );
      previewTable.hidden = recipients.length === 0;
    }

    async function previewAudience({ quiet = false } = {}) {
      if (!form.checkValidity()) return false;
      if (typeSelect.value === 'manual' && !manualIdentifiers.value.trim()) {
        return false;
      }
      const requestId = ++previewRequest;
      if (!quiet) status.textContent = 'Refreshing recipient preview...';
      try {
        const data = await requestJson(
          '/api/oe-panel/emails/audiences/preview',
          { method: 'POST', body: JSON.stringify(buildPayload()) }
        );
        if (requestId !== previewRequest) return false;
        renderPreview(data);
        if (!quiet) status.textContent = '';
        return true;
      } catch (error) {
        if (requestId !== previewRequest) return false;
        status.textContent = error.message;
        return false;
      }
    }

    function schedulePreview() {
      window.clearTimeout(previewTimer);
      previewTimer = window.setTimeout(
        () => previewAudience({ quiet: true }),
        450
      );
    }

    function updateAudienceType() {
      const isManual = typeSelect.value === 'manual';
      rulesSection.hidden = isManual;
      manualSection.hidden = !isManual;
      schedulePreview();
    }

    (initialAudience?.conditions || []).forEach(addCondition);
    if (!initialAudience?.conditions?.length) {
      addCondition({
        field: 'emailVerified',
        operator: 'is',
        value: true
      });
    }
    updateAudienceType();

    if (previewOnly) {
      form
        .querySelectorAll('input, textarea, select')
        .forEach((control) => (control.disabled = true));
      addConditionButton.hidden = true;
      conditionList
        .querySelectorAll('.oe-panel-email-audience-remove-condition')
        .forEach((button) => (button.hidden = true));
      actions.hidden = true;
    }

    addConditionButton.addEventListener('click', () => {
      if (getConditionRows().length >= 20) return;
      addCondition({ field: 'emailVerified', operator: 'is', value: true });
      schedulePreview();
    });
    typeSelect.addEventListener('change', updateAudienceType);
    previewButton.addEventListener('click', () => previewAudience());
    form.addEventListener('input', schedulePreview);
    form.addEventListener('change', schedulePreview);
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!form.reportValidity()) return;
      const originalLabel = saveButton.textContent;
      saveButton.disabled = true;
      saveButton.textContent = isEditing ? 'Saving...' : 'Creating...';
      status.textContent = '';
      try {
        await requestJson(
          isEditing
            ? `/api/oe-panel/emails/audiences/${encodeURIComponent(initialAudience.id)}`
            : '/api/oe-panel/emails/audiences',
          {
            method: isEditing ? 'PATCH' : 'POST',
            body: JSON.stringify(buildPayload())
          }
        );
        window.OE_PANEL_DATA?.clear?.('emailAudiences');
        window.dispatchEvent(
          new CustomEvent('oe-panel-email-audiences-changed')
        );
        detail.restore?.();
      } catch (error) {
        status.textContent = error.message;
        saveButton.disabled = false;
        saveButton.textContent = originalLabel;
      }
    });

    form.append(fields, rulesSection, manualSection, previewSection, actions);
    widget.append(
      createBackHeader(
        previewOnly
          ? 'Audience Preview'
          : isEditing
            ? 'Edit Audience'
            : 'Create Audience',
        () => detail.restore?.()
      ),
      form,
      status
    );
    if (detail.host) {
      detail.host.className = widget.className;
      detail.host.replaceChildren(...Array.from(widget.childNodes));
    } else {
      container.replaceChildren(widget);
    }
    container.dispatchEvent(
      new CustomEvent('oe-panel-request-expand', { bubbles: true })
    );
    previewAudience({ quiet: true });
  }

  window.addEventListener(EDITOR_EVENT, async (event) => {
    const detail = event.detail || {};
    if (!detail.container) return;
    if (!detail.audienceId) {
      createAudienceEditor(detail);
      return;
    }
    detail.container.textContent = 'Loading audience...';
    try {
      const data = await requestJson(
        `/api/oe-panel/emails/audiences/${encodeURIComponent(detail.audienceId)}`
      );
      createAudienceEditor(detail, data.audience);
    } catch (error) {
      window.alert(error.message);
      detail.restore?.();
    }
  });

  window.OE_PANEL_EMAIL_AUDIENCE_EDITOR = {
    open: createAudienceEditor
  };
})();
