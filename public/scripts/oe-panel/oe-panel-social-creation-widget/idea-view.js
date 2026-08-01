(function () {
  function createOePanelSocialIdeaView({
    clearActiveEditLeaveGuard,
    confirmActiveEditLeave,
    createDetailHeader,
    quickActionConfigs,
    showActionMenu,
    showMainActions,
    status,
    updateActionViewContainerSize,
    widget
  }) {
    return function showSocialIdeaView(actionConfig = {}) {
      if (!confirmActiveEditLeave()) return;
      clearActiveEditLeaveGuard();

      const parentAction = quickActionConfigs.find((config) =>
        Array.isArray(config.actions)
          ? config.actions.includes(actionConfig)
          : false
      );
      const detailHeader = createDetailHeader({
        ariaLabel: 'Back to ideas',
        backTitle: 'Back to ideas',
        centeredTitle: 'Create Idea',
        onBack: () => {
          if (parentAction) {
            showActionMenu(parentAction);
            return;
          }

          showMainActions();
        }
      });

      const form = document.createElement('form');
      form.className = 'oe-panel-social-edit-panels oe-panel-social-idea-form';
      const platformStorageKey = 'oe-panel-social-idea-platforms';

      const createTextField = (
        labelText,
        name,
        { multiline = false, value = '', required = false } = {}
      ) => {
        const field = document.createElement('label');
        field.className = 'oe-panel-social-edit-meta-field';

        const label = document.createElement('span');
        label.textContent = required ? `${labelText} *` : labelText;

        const input = document.createElement(multiline ? 'textarea' : 'input');
        input.className = multiline
          ? 'oe-panel-social-edit-meta-input is-multiline'
          : 'oe-panel-social-edit-meta-input';
        input.name = name;
        input.value = value;
        if (!multiline) input.type = 'text';
        if (required) input.required = true;

        field.append(label, input);
        return field;
      };

      const createSelectField = (
        labelText,
        name,
        options,
        required = false
      ) => {
        const field = document.createElement('label');
        field.className = 'oe-panel-social-edit-meta-field';

        const label = document.createElement('span');
        label.textContent = required ? `${labelText} *` : labelText;

        const select = document.createElement('select');
        select.className = 'oe-panel-social-edit-meta-input';
        select.name = name;
        if (required) select.required = true;

        options.forEach((optionConfig) => {
          const option = document.createElement('option');
          option.value = optionConfig.value;
          option.textContent = optionConfig.label;
          select.appendChild(option);
        });

        field.append(label, select);
        return { field, select };
      };

      const platformField = document.createElement('fieldset');
      platformField.className =
        'oe-panel-social-edit-meta-field oe-panel-social-platform-field';

      const platformLegend = document.createElement('legend');
      platformLegend.textContent = 'Platforms';

      const platformOptions = [
        { label: 'TikTok', value: 'tiktok' },
        { label: 'Instagram', value: 'instagram' },
        { label: 'YouTube Shorts', value: 'youtube-shorts' },
        { label: 'X', value: 'x' }
      ];
      const storedPlatforms = (() => {
        try {
          return JSON.parse(
            window.localStorage?.getItem(platformStorageKey) || '[]'
          );
        } catch (error) {
          return [];
        }
      })();
      const defaultPlatforms = new Set(
        Array.isArray(storedPlatforms) && storedPlatforms.length
          ? storedPlatforms
          : ['tiktok', 'instagram']
      );

      const platformList = document.createElement('div');
      platformList.className = 'oe-panel-social-platform-row';

      platformOptions.forEach((optionConfig) => {
        const option = document.createElement('label');
        option.className = 'oe-panel-social-edit-meta-field';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.name = 'platforms';
        checkbox.value = optionConfig.value;
        checkbox.checked = defaultPlatforms.has(optionConfig.value);

        const label = document.createElement('span');
        label.textContent = optionConfig.label;

        const updatePlatformToggleState = () => {
          option.classList.toggle('is-selected', checkbox.checked);
        };
        checkbox.addEventListener('change', () => {
          const selectedPlatformCount = form.querySelectorAll(
            'input[name="platforms"]:checked'
          ).length;

          if (!checkbox.checked && selectedPlatformCount === 0) {
            checkbox.checked = true;
          }

          updatePlatformToggleState();
        });
        updatePlatformToggleState();

        option.append(checkbox, label);
        platformList.appendChild(option);
      });

      platformField.append(platformLegend, platformList);

      const typeField = createSelectField(
        'Type',
        'type',
        [
          { label: 'gamemode-meme', value: 'gamemode-meme' },
          { label: 'overexposure-irl', value: 'overexposure-irl' }
        ],
        true
      );
      const gamemodeField = createSelectField(
        'Gamemode',
        'gamemode',
        [
          { label: 'Truth Or Dare', value: 'truth-or-dare' },
          { label: 'Paranoia', value: 'paranoia' },
          { label: 'Never Have I Ever', value: 'never-have-i-ever' },
          { label: 'Most Likely To', value: 'most-likely-to' },
          { label: 'Imposter', value: 'imposter' },
          { label: 'Would You Rather', value: 'would-you-rather' },
          { label: 'Mafia', value: 'mafia' }
        ],
        true
      );

      const updateGamemodeField = () => {
        const isGamemodeMeme = typeField.select.value === 'gamemode-meme';
        gamemodeField.field.classList.toggle('is-hidden', !isGamemodeMeme);
        gamemodeField.select.disabled = !isGamemodeMeme;
        gamemodeField.select.required = isGamemodeMeme;
        if (typeof updateSaveButtonState === 'function') {
          updateSaveButtonState();
        }
      };
      typeField.select.addEventListener('change', updateGamemodeField);

      const typeRow = document.createElement('div');
      typeRow.className = 'oe-panel-social-type-row';
      typeRow.append(typeField.field, gamemodeField.field);

      const saveButton = document.createElement('button');
      saveButton.className = 'oe-panel-social-edit-save';
      saveButton.type = 'submit';
      saveButton.textContent = 'Save Idea';
      saveButton.disabled = true;

      form.append(
        createTextField('Title', 'title', { required: true }),
        typeRow,
        platformField,
        createTextField('Hook', 'hook'),
        createTextField('Angle', 'angle'),
        createTextField('Prompt', 'prompt', { multiline: true }),
        createTextField('Notes', 'notes', { multiline: true }),
        saveButton
      );

      const updateSaveButtonState = () => {
        const formData = new FormData(form);
        const titleValue = String(formData.get('title') || '').trim();
        const typeValue = typeField.select.value;
        const selectedPlatforms = form.querySelectorAll(
          'input[name="platforms"]:checked'
        );
        const hasGamemode =
          typeValue !== 'gamemode-meme' || Boolean(gamemodeField.select.value);

        saveButton.disabled =
          !titleValue ||
          !typeValue ||
          !hasGamemode ||
          selectedPlatforms.length === 0;
      };

      form.addEventListener('input', updateSaveButtonState);
      form.addEventListener('change', updateSaveButtonState);
      updateGamemodeField();
      updateSaveButtonState();

      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        updateSaveButtonState();
        if (saveButton.disabled) return;

        const selectedPlatforms = Array.from(
          form.querySelectorAll('input[name="platforms"]:checked')
        ).map((input) => input.value);
        const selectedType =
          typeField.select.value === 'gamemode-meme'
            ? `gamemode-meme:${gamemodeField.select.value}`
            : typeField.select.value;

        if (!selectedPlatforms.length) {
          status.textContent = 'Choose at least one platform.';
          return;
        }

        const formData = new FormData(form);
        const originalSaveText = saveButton.textContent;
        saveButton.disabled = true;
        saveButton.textContent = 'Saving...';
        status.textContent = '';

        try {
          window.localStorage?.setItem(
            platformStorageKey,
            JSON.stringify(selectedPlatforms)
          );

          const response = await fetch('/api/oe-panel/social-media', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              platforms: selectedPlatforms,
              type: selectedType,
              status: 'idea',
              title: String(formData.get('title') || '').trim(),
              hook: String(formData.get('hook') || '').trim(),
              angle: String(formData.get('angle') || '').trim(),
              prompt: String(formData.get('prompt') || '').trim(),
              notes: String(formData.get('notes') || '').trim()
            })
          });
          const data = await response.json().catch(() => ({}));

          if (!response.ok || data.success === false) {
            throw new Error(data?.error?.message || 'Could not save idea.');
          }

          window.dispatchEvent(
            new CustomEvent('oe-panel-social-content-created')
          );
          showMainActions();
        } catch (error) {
          status.textContent = error.message || 'Could not save idea.';
        } finally {
          saveButton.disabled = false;
          saveButton.textContent = originalSaveText;
        }
      });

      widget.className =
        'oe-panel-widget oe-panel-widget-social-creation oe-panel-social-creation oe-panel-social-action-view oe-panel-social-idea-create-view';
      status.textContent = '';
      widget.replaceChildren(detailHeader, form, status);
      updateActionViewContainerSize(actionConfig, true);
    };
  }

  window.createOePanelSocialIdeaView = createOePanelSocialIdeaView;
})();
