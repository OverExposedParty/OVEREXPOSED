(function () {
  function createOePanelActionPackForms(options) {
    const {
      container,
      widget,
      getBackHeaderTitle,
      appendCenteredBackHeaderTitle,
      showActionList,
      showActionSubmenu,
      fetchGamemodeSettingsAlerts,
      createPackFormField,
      slugifyPackTitle,
      packDifficultyOptions
    } = options;

    function showCreatePackForm(parentAction) {
      const detailHeader = document.createElement('div');
      detailHeader.className = 'oe-panel-social-action-header';

      const backButton = document.createElement('button');
      backButton.className = 'oe-panel-alert-detail-back';
      backButton.type = 'button';
      backButton.setAttribute('aria-label', 'Back to manage packs');
      backButton.addEventListener('click', () =>
        showActionSubmenu(parentAction)
      );

      const detailTitle = document.createElement('h3');
      detailTitle.className =
        'oe-panel-social-creation-title oe-panel-social-action-title';
      detailTitle.textContent = getBackHeaderTitle('Back to manage packs');

      detailHeader.append(backButton, detailTitle);
      appendCenteredBackHeaderTitle(detailHeader, 'Create New Pack');

      const form = document.createElement('form');
      form.className =
        'oe-panel-social-edit-panels oe-panel-social-idea-form oe-panel-game-pack-form';

      const gamemodeField = createPackFormField('Gamemode', 'gameType', {
        required: true,
        options: [
          { label: 'Truth Or Dare', value: 'truth-or-dare' },
          { label: 'Paranoia', value: 'paranoia' },
          { label: 'Never Have I Ever', value: 'never-have-i-ever' },
          { label: 'Most Likely To', value: 'most-likely-to' },
          { label: 'Imposter', value: 'imposter' },
          { label: 'Would You Rather', value: 'would-you-rather' },
          { label: 'Mafia', value: 'mafia' }
        ]
      });
      const titleField = createPackFormField('Title', 'title', {
        required: true
      });
      const slugField = createPackFormField('Slug', 'slug', {
        required: true
      });
      const statusField = createPackFormField('Status', 'status', {
        options: [
          { label: 'Published', value: 'published' },
          { label: 'Draft', value: 'draft' },
          { label: 'Archived', value: 'archived' }
        ]
      });
      const activeField = createPackFormField('Active', 'active', {
        value: 'no',
        options: [
          { label: 'No', value: 'no' },
          { label: 'Yes', value: 'yes' }
        ]
      });
      const availabilityModeField = createPackFormField(
        'Availability Mode',
        'availabilityMode',
        {
          options: [
            { label: 'Always', value: 'always' },
            { label: 'Fixed Dates', value: 'fixed' },
            { label: 'Every Year', value: 'annual' }
          ]
        }
      );
      const availabilityTimeZoneField = createPackFormField(
        'Timezone',
        'availabilityTimeZone',
        {
          value: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
        }
      );
      const availableFromField = createPackFormField(
        'Available From',
        'availableFrom'
      );
      const availableUntilField = createPackFormField(
        'Available Until',
        'availableUntil'
      );
      const difficultyField = createPackFormField('Difficulty', 'difficulty', {
        options: packDifficultyOptions
      });
      const restrictionField = createPackFormField(
        'Restriction',
        'restriction',
        {
          options: [
            { label: 'SFW', value: 'sfw' },
            { label: 'NSFW', value: 'nsfw' },
            { label: 'None', value: '' }
          ]
        }
      );
      const hexColourFieldOptions = {
        pattern: '^#[0-9A-Fa-f]{6}$',
        placeholder: '#E685AD',
        inputMode: 'text',
        title: 'Enter a 6-digit hex code, for example #E685AD.'
      };
      const colourField = createPackFormField(
        'Colour',
        'colour',
        hexColourFieldOptions
      );
      const secondaryColourField = createPackFormField(
        'Secondary Colour',
        'secondaryColour',
        hexColourFieldOptions
      );

      const questionField = document.createElement('div');
      questionField.className = 'oe-panel-game-pack-questions-field';

      const questionLabel = document.createElement('span');
      questionLabel.className = 'oe-panel-game-pack-questions-label';
      questionLabel.textContent = 'Questions';

      const questionList = document.createElement('div');
      questionList.className = 'oe-panel-game-pack-question-list';

      const addQuestionButton = document.createElement('button');
      addQuestionButton.className = 'oe-panel-game-pack-add-question';
      addQuestionButton.type = 'button';
      addQuestionButton.textContent = 'Add Question';

      const refreshQuestionNumbers = () => {
        questionList
          .querySelectorAll('.oe-panel-game-pack-question-number')
          .forEach((numberElement, index) => {
            numberElement.textContent = String(index + 1);
          });
      };

      const addQuestionInput = () => {
        const questionRow = document.createElement('div');
        questionRow.className = 'oe-panel-game-pack-question-row';

        const questionNumber = document.createElement('span');
        questionNumber.className = 'oe-panel-game-pack-question-number';
        questionNumber.textContent = String(questionList.children.length + 1);

        const questionInput = document.createElement('input');
        questionInput.className = 'oe-panel-social-edit-meta-input';
        questionInput.name = 'questions';
        questionInput.type = 'text';
        questionInput.required = true;
        questionInput.setAttribute('aria-label', 'Pack question');

        const clearQuestionButton = document.createElement('button');
        clearQuestionButton.className = 'oe-panel-game-pack-question-clear';
        clearQuestionButton.type = 'button';
        clearQuestionButton.setAttribute('aria-label', 'Clear question');
        clearQuestionButton.textContent = 'X';
        clearQuestionButton.addEventListener('click', () => {
          if (questionInput.value.trim()) {
            questionInput.value = '';
            questionInput.focus();
            return;
          }

          questionRow.remove();
          refreshQuestionNumbers();
        });

        questionRow.append(questionNumber, questionInput, clearQuestionButton);
        questionList.appendChild(questionRow);
        questionInput.focus();
      };

      addQuestionButton.addEventListener('click', addQuestionInput);
      questionField.append(questionLabel, questionList, addQuestionButton);
      addQuestionInput();

      const firstRow = document.createElement('div');
      firstRow.className = 'oe-panel-game-pack-form-row is-three-column';
      firstRow.append(
        gamemodeField.field,
        statusField.field,
        activeField.field
      );

      const assetRow = document.createElement('div');
      assetRow.className = 'oe-panel-game-pack-form-row is-two-column';
      assetRow.append(colourField.field, secondaryColourField.field);

      const availabilityRow = document.createElement('div');
      availabilityRow.className = 'oe-panel-game-pack-form-row is-three-column';
      availabilityRow.append(
        availabilityTimeZoneField.field,
        availableFromField.field,
        availableUntilField.field
      );

      const configureAvailabilityFields = ({ reset = false } = {}) => {
        const mode = availabilityModeField.input.value;
        availabilityTimeZoneField.input.disabled = mode !== 'annual';
        [availableFromField.input, availableUntilField.input].forEach(
          (input) => {
            const previousMode = input.dataset.availabilityMode;
            if (reset && previousMode && previousMode !== mode)
              input.value = '';
            input.disabled = mode === 'always';
            input.type = mode === 'fixed' ? 'datetime-local' : 'text';
            input.step = mode === 'fixed' ? '1' : '';
            input.placeholder = mode === 'annual' ? 'XXXX-MM-DDTHH:mm:ss' : '';
            input.dataset.availabilityMode = mode;
          }
        );
      };
      availabilityModeField.input.addEventListener('change', () => {
        configureAvailabilityFields({ reset: true });
      });
      configureAvailabilityFields();

      const saveButton = document.createElement('button');
      saveButton.className = 'oe-panel-social-edit-save';
      saveButton.type = 'submit';
      saveButton.textContent = 'Save Pack';
      saveButton.disabled = true;

      form.append(
        firstRow,
        titleField.field,
        slugField.field,
        difficultyField.field,
        restrictionField.field,
        availabilityModeField.field,
        availabilityRow,
        assetRow,
        questionField,
        saveButton
      );

      let slugTouched = false;
      slugField.input.addEventListener('input', () => {
        slugTouched = true;
      });
      titleField.input.addEventListener('input', () => {
        if (slugTouched) return;
        slugField.input.value = slugifyPackTitle(titleField.input.value);
      });

      const updateSaveButtonState = () => {
        const questionInputs = Array.from(
          form.querySelectorAll('input[name="questions"]')
        );
        const hasEmptyVisibleQuestion = questionInputs.some(
          (input) => !input.value.trim()
        );
        const isHexOrBlank = (value) =>
          !value.trim() || /^#[0-9a-f]{6}$/i.test(value.trim());
        const availabilityMode = availabilityModeField.input.value;
        const hasValidAvailability =
          availabilityMode === 'always' ||
          (availabilityMode === 'fixed' &&
            Boolean(
              availableFromField.input.value || availableUntilField.input.value
            )) ||
          (availabilityMode === 'annual' &&
            /^XXXX-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(
              availableFromField.input.value
            ) &&
            /^XXXX-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(
              availableUntilField.input.value
            ) &&
            Boolean(availabilityTimeZoneField.input.value.trim()));

        saveButton.disabled =
          !titleField.input.value.trim() ||
          !slugField.input.value.trim() ||
          !gamemodeField.input.value ||
          hasEmptyVisibleQuestion ||
          !hasValidAvailability ||
          !isHexOrBlank(colourField.input.value) ||
          !isHexOrBlank(secondaryColourField.input.value);
      };
      form.addEventListener('input', updateSaveButtonState);
      form.addEventListener('change', updateSaveButtonState);
      updateSaveButtonState();

      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        updateSaveButtonState();
        if (saveButton.disabled) return;

        const formData = new FormData(form);
        const originalText = saveButton.textContent;
        saveButton.disabled = true;
        saveButton.textContent = 'Saving...';

        try {
          const questions = Array.from(
            form.querySelectorAll('input[name="questions"]')
          )
            .map((input) => input.value.trim())
            .filter(Boolean);
          const availabilityMode = formData.get('availabilityMode');
          const serializeBoundary = (value) => {
            if (!value) return null;
            return availabilityMode === 'fixed'
              ? new Date(value).toISOString()
              : value;
          };

          const response = await fetch('/api/oe-panel/game-packs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              gameType: formData.get('gameType'),
              title: formData.get('title'),
              slug: formData.get('slug'),
              status: formData.get('status'),
              active: formData.get('active'),
              difficulty: formData.get('difficulty'),
              restriction: formData.get('restriction'),
              colour: formData.get('colour'),
              secondaryColour: formData.get('secondaryColour'),
              availabilityMode,
              availabilityTimeZone:
                availabilityMode === 'annual'
                  ? formData.get('availabilityTimeZone')
                  : undefined,
              availableFrom: serializeBoundary(formData.get('availableFrom')),
              availableUntil: serializeBoundary(formData.get('availableUntil')),
              questions
            })
          });
          const payload = await response.json().catch(() => ({}));

          if (!response.ok || payload.success === false) {
            throw new Error(
              payload?.error?.message || 'Pack could not be created.'
            );
          }

          await fetchGamemodeSettingsAlerts();
          await fetchGamemodeSettingsAlerts('export-needed');
          window.dispatchEvent(
            new CustomEvent('oe-panel-party-games-data-changed')
          );
          showActionList();
        } catch (error) {
          window.alert(error.message || 'Pack could not be created.');
          saveButton.textContent = originalText;
          updateSaveButtonState();
        }
      });

      widget.className =
        'oe-panel-widget oe-panel-widget-actions oe-panel-social-creation oe-panel-social-action-view oe-panel-social-idea-create-view oe-panel-game-pack-create-view';
      widget.replaceChildren(detailHeader, form);
      container.dispatchEvent(
        new CustomEvent('oe-panel-request-expand', { bubbles: true })
      );
    }

    function createOeFormField(labelText, name, options = {}) {
      return createPackFormField(labelText, name, options);
    }

    function createOeFormHeader(titleText, backLabel, parentAction) {
      const detailHeader = document.createElement('div');
      detailHeader.className = 'oe-panel-social-action-header';

      const backButton = document.createElement('button');
      backButton.className = 'oe-panel-alert-detail-back';
      backButton.type = 'button';
      backButton.setAttribute('aria-label', backLabel);
      backButton.addEventListener('click', () =>
        showActionSubmenu(parentAction)
      );

      const detailTitle = document.createElement('h3');
      detailTitle.className =
        'oe-panel-social-creation-title oe-panel-social-action-title';
      detailTitle.textContent = getBackHeaderTitle(backLabel);

      detailHeader.append(backButton, detailTitle);
      appendCenteredBackHeaderTitle(detailHeader, titleText);
      return detailHeader;
    }

    function showCreateOePackForm(parentAction) {
      const detailHeader = createOeFormHeader(
        'Create New OE Pack',
        'Back to manage OE packs',
        parentAction
      );
      const form = document.createElement('form');
      form.className =
        'oe-panel-social-edit-panels oe-panel-social-idea-form oe-panel-game-pack-form';
      const slugField = createOeFormField('Slug', 'slug', { required: true });
      const titleField = createOeFormField('Title', 'title', {
        required: true
      });
      const prefixField = createOeFormField('Prefix', 'prefix', {
        required: true,
        placeholder: 'A'
      });
      const descriptionField = createOeFormField('Description', 'description');
      const statusField = createOeFormField('Status', 'status', {
        options: [
          { label: 'Published', value: 'published' },
          { label: 'Draft', value: 'draft' },
          { label: 'Archived', value: 'archived' }
        ]
      });
      const activeField = createOeFormField('Active', 'active', {
        value: 'no',
        options: [
          { label: 'No', value: 'no' },
          { label: 'Yes', value: 'yes' }
        ]
      });
      const colourField = createOeFormField('Colour', 'colour', {
        placeholder: '#66CCFF'
      });
      const secondaryColourField = createOeFormField(
        'Secondary Colour',
        'secondaryColour',
        { placeholder: '#427BB9' }
      );
      const saveButton = document.createElement('button');
      saveButton.className = 'oe-panel-social-edit-save';
      saveButton.type = 'submit';
      saveButton.textContent = 'Save OE Pack';
      saveButton.disabled = true;

      const topRow = document.createElement('div');
      topRow.className = 'oe-panel-game-pack-form-row is-three-column';
      topRow.append(prefixField.field, statusField.field, activeField.field);

      const assetRow = document.createElement('div');
      assetRow.className = 'oe-panel-game-pack-form-row is-two-column';
      assetRow.append(colourField.field, secondaryColourField.field);

      form.append(
        topRow,
        titleField.field,
        slugField.field,
        descriptionField.field,
        assetRow,
        saveButton
      );

      let slugTouched = false;
      slugField.input.addEventListener('input', () => {
        slugTouched = true;
      });
      titleField.input.addEventListener('input', () => {
        if (slugTouched) return;
        slugField.input.value = slugifyPackTitle(titleField.input.value);
      });

      const updateSaveButtonState = () => {
        saveButton.disabled =
          !slugField.input.value.trim() ||
          !titleField.input.value.trim() ||
          !prefixField.input.value.trim();
      };
      form.addEventListener('input', updateSaveButtonState);
      form.addEventListener('change', updateSaveButtonState);
      updateSaveButtonState();

      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        updateSaveButtonState();
        if (saveButton.disabled) return;

        const formData = new FormData(form);
        const originalText = saveButton.textContent;
        saveButton.disabled = true;
        saveButton.textContent = 'Saving...';

        try {
          const response = await fetch('/api/oe-panel/oe-customisation/packs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(Object.fromEntries(formData.entries()))
          });
          const payload = await response.json().catch(() => ({}));

          if (!response.ok || payload.success === false) {
            throw new Error(
              payload?.error?.message || 'OE pack could not be created.'
            );
          }

          window.dispatchEvent(
            new CustomEvent('oe-panel-oe-customisation-data-changed')
          );
          showActionList();
        } catch (error) {
          window.alert(error.message || 'OE pack could not be created.');
          saveButton.textContent = originalText;
          updateSaveButtonState();
        }
      });

      widget.className =
        'oe-panel-widget oe-panel-widget-actions oe-panel-social-creation oe-panel-social-action-view oe-panel-social-idea-create-view oe-panel-game-pack-create-view';
      widget.replaceChildren(detailHeader, form);
      container.dispatchEvent(
        new CustomEvent('oe-panel-request-expand', { bubbles: true })
      );
    }

    return { showCreatePackForm, showCreateOePackForm };
  }

  window.createOePanelActionPackForms = createOePanelActionPackForms;
})();
