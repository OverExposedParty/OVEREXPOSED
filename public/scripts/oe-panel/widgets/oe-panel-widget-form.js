(function () {
  function createOePanelFormWidget({ createPanelBackHeader }) {
    function createFormInput(fieldConfig) {
      const input = document.createElement(
        fieldConfig.options
          ? 'select'
          : fieldConfig.multiline
            ? 'textarea'
            : 'input'
      );
      input.className = fieldConfig.multiline
        ? 'oe-panel-social-edit-meta-input is-multiline'
        : 'oe-panel-social-edit-meta-input';
      input.name = fieldConfig.name;

      if (!fieldConfig.options && !fieldConfig.multiline) {
        input.type = fieldConfig.inputType || 'text';
      }
      if (fieldConfig.required) input.required = true;
      if (fieldConfig.placeholder) input.placeholder = fieldConfig.placeholder;
      if (fieldConfig.pattern) input.pattern = fieldConfig.pattern;
      if (fieldConfig.maxlength)
        input.maxLength = Number(fieldConfig.maxlength);
      if (fieldConfig.inputMode) input.inputMode = fieldConfig.inputMode;
      if (fieldConfig.title) input.title = fieldConfig.title;
      if (fieldConfig.accept) input.accept = fieldConfig.accept;

      if (Array.isArray(fieldConfig.options)) {
        fieldConfig.options.forEach((optionConfig) => {
          const option = document.createElement('option');
          option.value = optionConfig.value;
          option.textContent = optionConfig.label;
          option.disabled = Boolean(optionConfig.disabled);
          input.appendChild(option);
        });
      }

      if (fieldConfig.value !== undefined && fieldConfig.value !== null) {
        input.value = fieldConfig.value;
      }

      return input;
    }

    function createPlayerLookupAvatar(player) {
      const avatar = document.createElement('span');
      avatar.className = 'oe-panel-player-lookup-avatar';
      avatar.setAttribute('aria-hidden', 'true');

      if (
        typeof createUserIconPartyGames === 'function' &&
        player?.oeIcon &&
        player.oeIcon !== '-'
      ) {
        createUserIconPartyGames({
          container: avatar,
          userId: player.accountId || player.id || player.user || 'player',
          userCustomisationString: player.oeIcon,
          size: 'small'
        });
        return avatar;
      }

      const fallback = document.createElement('span');
      fallback.className = 'oe-panel-player-lookup-avatar-fallback';
      fallback.textContent =
        String(player?.user || player?.username || '?')
          .trim()
          .charAt(0)
          .toUpperCase() || '?';
      avatar.appendChild(fallback);
      return avatar;
    }

    function createPlayerLookupField(fieldConfig, onChange) {
      const field = document.createElement('label');
      field.className =
        'oe-panel-social-edit-meta-field oe-panel-player-lookup-field';

      const label = document.createElement('span');
      label.textContent = fieldConfig.required
        ? `${fieldConfig.label} *`
        : fieldConfig.label;

      const wrapper = document.createElement('span');
      wrapper.className = 'oe-panel-player-lookup';

      const input = createFormInput({
        ...fieldConfig,
        inputType: fieldConfig.inputType || 'text'
      });
      input.autocomplete = 'off';
      input.setAttribute('aria-autocomplete', 'list');
      input.setAttribute('aria-expanded', 'false');
      input.setAttribute('role', 'combobox');

      const menu = document.createElement('span');
      const menuId = `oe-panel-player-lookup-${Math.random().toString(36).slice(2)}`;
      menu.id = menuId;
      menu.className = 'oe-panel-player-lookup-menu';
      menu.setAttribute('role', 'listbox');
      menu.hidden = true;
      input.setAttribute('aria-controls', menuId);

      const status = document.createElement('span');
      status.className = 'oe-panel-player-lookup-status';
      status.setAttribute('aria-live', 'polite');

      let searchTimer = null;
      let requestId = 0;

      function isExactAccountId(value) {
        return /^[a-f\d]{24}$/i.test(String(value || '').trim());
      }

      function setMenuOpen(isOpen) {
        menu.hidden = !isOpen;
        input.setAttribute('aria-expanded', String(isOpen));
      }

      function clearResults(message = '') {
        menu.replaceChildren();
        setMenuOpen(false);
        status.textContent = message;
      }

      function selectPlayer(player) {
        input.value = player.accountId || '';
        input.dataset.oePanelSelectedPlayer = player.accountId || '';
        clearResults('');
        input.dispatchEvent(new Event('input', { bubbles: true }));
        onChange();
      }

      function renderPlayers(players) {
        menu.replaceChildren();

        if (!players.length) {
          clearResults('No matching players.');
          return;
        }

        players.forEach((player) => {
          const option = document.createElement('button');
          option.className = 'oe-panel-player-lookup-option';
          option.type = 'button';
          option.setAttribute('role', 'option');

          const identity = document.createElement('span');
          identity.className = 'oe-panel-player-lookup-identity';

          const name = document.createElement('span');
          name.className = 'oe-panel-player-lookup-name';
          name.textContent = player.user || player.username || 'Account user';

          const accountId = document.createElement('span');
          accountId.className = 'oe-panel-player-lookup-account-id';
          accountId.textContent = player.accountId || '-';

          identity.append(name, accountId);
          option.append(createPlayerLookupAvatar(player), identity);
          option.addEventListener('click', () => selectPlayer(player));
          menu.appendChild(option);
        });

        status.textContent = '';
        setMenuOpen(true);
      }

      async function searchPlayers() {
        const query = input.value.trim();
        const selectedPlayer = input.dataset.oePanelSelectedPlayer || '';

        if (isExactAccountId(query) || query === selectedPlayer) {
          clearResults('');
          onChange();
          return;
        }

        input.dataset.oePanelSelectedPlayer = '';

        if (query.length < (fieldConfig.minSearchLength || 2)) {
          clearResults('');
          onChange();
          return;
        }

        const currentRequestId = ++requestId;
        status.textContent = 'Searching players...';

        try {
          const endpoint =
            fieldConfig.searchEndpoint || '/api/oe-panel/users/search';
          const response = await fetch(
            `${endpoint}?q=${encodeURIComponent(query)}&limit=${encodeURIComponent(
              fieldConfig.limit || 8
            )}`
          );
          const payload = await response.json().catch(() => ({}));
          if (currentRequestId !== requestId) return;

          if (!response.ok || payload.success === false) {
            throw new Error(payload?.error?.message || 'Player search failed.');
          }

          renderPlayers(payload.data?.users || payload.users || []);
        } catch (error) {
          if (currentRequestId !== requestId) return;
          clearResults(error.message || 'Player search failed.');
        } finally {
          onChange();
        }
      }

      input.addEventListener('input', () => {
        window.clearTimeout(searchTimer);
        if (isExactAccountId(input.value)) {
          clearResults('');
          onChange();
          return;
        }
        searchTimer = window.setTimeout(
          searchPlayers,
          fieldConfig.debounceMs || 180
        );
      });
      input.addEventListener('focus', () => {
        if (isExactAccountId(input.value)) return;
        if (menu.children.length) setMenuOpen(true);
      });
      input.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
          clearResults('');
        }
      });
      document.addEventListener('click', (event) => {
        if (field.contains(event.target)) return;
        setMenuOpen(false);
      });

      wrapper.append(input, menu, status);
      field.append(label, wrapper);
      return { field, input };
    }

    function validateSvgDimensions(svgText, dimensions) {
      const svgOpenTag =
        String(svgText || '').match(/<svg\b[^>]*>/i)?.[0] || '';
      const viewBoxMatch = svgOpenTag.match(
        /\bviewBox\s*=\s*["']\s*([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s*["']/i
      );

      if (viewBoxMatch) {
        return (
          Number(viewBoxMatch[3]) === Number(dimensions.width) &&
          Number(viewBoxMatch[4]) === Number(dimensions.height)
        );
      }

      const width = Number(
        svgOpenTag.match(/\bwidth\s*=\s*["']\s*([\d.]+)/i)?.[1]
      );
      const height = Number(
        svgOpenTag.match(/\bheight\s*=\s*["']\s*([\d.]+)/i)?.[1]
      );

      return (
        width === Number(dimensions.width) &&
        height === Number(dimensions.height)
      );
    }

    function createFormField(fieldConfig, onChange) {
      if (fieldConfig.type === 'player-lookup') {
        return createPlayerLookupField(fieldConfig, onChange);
      }

      if (fieldConfig.type === 'file' && fieldConfig.preview === 'svg') {
        const field = document.createElement('label');
        field.className = 'oe-panel-oe-svg-upload-field';

        const label = document.createElement('span');
        label.textContent = fieldConfig.required
          ? `${fieldConfig.label} *`
          : fieldConfig.label;

        const preview = document.createElement('span');
        preview.className = 'oe-panel-oe-svg-upload-preview';

        const previewText = document.createElement('span');
        previewText.className = 'oe-panel-oe-svg-upload-preview-text';
        previewText.textContent = fieldConfig.previewText || 'Choose SVG';
        preview.appendChild(previewText);

        const input = createFormInput({
          ...fieldConfig,
          inputType: 'file',
          accept: fieldConfig.accept || '.svg,image/svg+xml'
        });
        input.className = 'oe-panel-oe-svg-upload-input';
        input.dataset.oePanelFileValid = fieldConfig.required
          ? 'false'
          : 'true';

        let previewUrl = '';
        input.addEventListener('change', async () => {
          if (previewUrl) {
            URL.revokeObjectURL(previewUrl);
            previewUrl = '';
          }

          const file = input.files?.[0];
          preview.replaceChildren();
          input.dataset.oePanelFileValid = fieldConfig.required
            ? 'false'
            : 'true';

          if (!file) {
            preview.appendChild(previewText);
            onChange();
            return;
          }

          const svgText = await file.text().catch(() => '');
          const dimensions = fieldConfig.svgDimensions;
          if (dimensions && !validateSvgDimensions(svgText, dimensions)) {
            input.value = '';
            previewText.textContent = `${dimensions.width} x ${dimensions.height} SVG required`;
            preview.appendChild(previewText);
            onChange();
            return;
          }

          previewUrl = URL.createObjectURL(file);
          const image = document.createElement('img');
          image.src = previewUrl;
          image.alt = file.name;
          preview.appendChild(image);
          input.dataset.oePanelFileValid = 'true';
          onChange();
        });

        field.append(label, preview, input);
        return { field, input };
      }

      const field = document.createElement('label');
      field.className = 'oe-panel-social-edit-meta-field';

      const label = document.createElement('span');
      label.textContent = fieldConfig.required
        ? `${fieldConfig.label} *`
        : fieldConfig.label;

      const input = createFormInput(fieldConfig);
      field.append(label, input);
      return { field, input };
    }

    function renderFormWidget(container, gridConfig) {
      const fields = Array.isArray(gridConfig.fields) ? gridConfig.fields : [];
      const fieldRefs = [];

      const widget = document.createElement('div');
      widget.className =
        gridConfig.className ||
        'oe-panel-widget oe-panel-widget-form oe-panel-social-creation oe-panel-social-action-view oe-panel-social-idea-create-view oe-panel-game-pack-create-view';

      const form = document.createElement('form');
      form.className =
        gridConfig.formClassName ||
        'oe-panel-social-edit-panels oe-panel-social-idea-form oe-panel-game-pack-form';

      const status = document.createElement('p');
      status.className = 'oe-panel-social-creation-status';
      status.setAttribute('aria-live', 'polite');

      const submitButton = document.createElement('button');
      submitButton.className = 'oe-panel-social-edit-save';
      submitButton.type = 'submit';
      submitButton.textContent = gridConfig.submitLabel || 'Save';
      submitButton.disabled = true;

      const updateSubmitState = () => {
        const requiredInvalid = fieldRefs.some(({ input, config }) => {
          if (!config.required) return false;
          if (input.type === 'file') {
            return (
              !input.files?.length || input.dataset.oePanelFileValid === 'false'
            );
          }
          return !String(input.value || '').trim();
        });

        submitButton.disabled = requiredInvalid;
      };

      function appendField(parent, fieldConfig) {
        const fieldRef = createFormField(fieldConfig, updateSubmitState);
        fieldRefs.push({ ...fieldRef, config: fieldConfig });
        parent.appendChild(fieldRef.field);
      }

      function replaceSelectOptions(input, options, placeholder) {
        const optionElements = [];
        if (placeholder) {
          const placeholderOption = document.createElement('option');
          placeholderOption.value = '';
          placeholderOption.textContent = placeholder;
          optionElements.push(placeholderOption);
        }
        options.forEach((optionConfig) => {
          const option = document.createElement('option');
          option.value = optionConfig.value;
          option.textContent = optionConfig.label;
          optionElements.push(option);
        });
        input.replaceChildren(...optionElements);
        input.value = '';
      }

      function connectRemoteSelectOptions(fieldRef) {
        const { config, input } = fieldRef;
        if (!config.optionsEndpoint || !config.dependsOn) return;
        const dependencyRef = fieldRefs.find(
          ({ config: candidate }) => candidate.name === config.dependsOn
        );
        if (!dependencyRef) return;
        let requestVersion = 0;
        let preferredValue = String(config.value || '');

        input.addEventListener('change', () => {
          preferredValue = input.value;
        });

        const loadOptions = async () => {
          const dependencyValue = String(
            dependencyRef.input.value || ''
          ).trim();
          const currentRequest = ++requestVersion;
          input.disabled = true;
          replaceSelectOptions(
            input,
            [],
            dependencyValue
              ? config.loadingLabel || 'Loading options...'
              : config.dependencyPlaceholder || 'Choose an option first'
          );
          updateSubmitState();
          if (!dependencyValue) return;

          try {
            const separator = config.optionsEndpoint.includes('?') ? '&' : '?';
            const queryName = config.dependencyQueryParam || config.dependsOn;
            const response = await fetch(
              `${config.optionsEndpoint}${separator}${encodeURIComponent(queryName)}=${encodeURIComponent(dependencyValue)}`,
              { credentials: 'same-origin' }
            );
            const payload = await response.json().catch(() => ({}));
            if (currentRequest !== requestVersion) return;
            if (!response.ok || payload.success === false) {
              throw new Error(
                payload?.error?.message || 'Options could not be loaded.'
              );
            }
            const options = Array.isArray(payload.data?.options)
              ? payload.data.options
              : [];
            replaceSelectOptions(
              input,
              options,
              options.length
                ? config.placeholder || 'Choose an option'
                : config.emptyLabel || 'No options available'
            );
            input.disabled = options.length === 0;
            if (
              preferredValue &&
              options.some(
                (optionConfig) => optionConfig.value === preferredValue
              )
            ) {
              input.value = preferredValue;
            } else if (options.length === 1) {
              input.value = options[0].value;
            }
          } catch {
            if (currentRequest !== requestVersion) return;
            replaceSelectOptions(
              input,
              [],
              config.errorLabel || 'Options unavailable'
            );
            input.disabled = true;
          } finally {
            if (currentRequest === requestVersion) updateSubmitState();
          }
        };

        dependencyRef.input.addEventListener('change', loadOptions);
        loadOptions();
      }

      fields.forEach((fieldConfig) => {
        if (fieldConfig.type === 'row') {
          const row = document.createElement('div');
          row.className = ['oe-panel-game-pack-form-row', fieldConfig.columns]
            .filter(Boolean)
            .join(' ');
          (fieldConfig.fields || []).forEach((childFieldConfig) => {
            appendField(row, childFieldConfig);
          });
          form.appendChild(row);
          return;
        }

        appendField(form, fieldConfig);
      });

      fieldRefs.forEach(connectRemoteSelectOptions);

      form.appendChild(submitButton);
      form.addEventListener('input', updateSubmitState);
      form.addEventListener('change', updateSubmitState);
      updateSubmitState();

      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        updateSubmitState();
        if (submitButton.disabled) return;

        const originalText = submitButton.textContent;
        submitButton.disabled = true;
        submitButton.textContent = gridConfig.submittingLabel || 'Saving...';
        status.textContent = '';

        try {
          const formData = new FormData(form);
          const isMultipart = gridConfig.encoding === 'multipart';
          const response = await fetch(gridConfig.submitEndpoint, {
            method: gridConfig.method || 'POST',
            headers: isMultipart
              ? undefined
              : { 'Content-Type': 'application/json' },
            body: isMultipart
              ? formData
              : JSON.stringify(Object.fromEntries(formData.entries()))
          });
          const payload = await response.json().catch(() => ({}));

          if (!response.ok || payload.success === false) {
            throw new Error(payload?.error?.message || gridConfig.errorMessage);
          }

          if (gridConfig.successEvent) {
            window.dispatchEvent(new CustomEvent(gridConfig.successEvent));
          }

          status.textContent = gridConfig.successMessage || 'Saved.';
          submitButton.textContent = gridConfig.successButtonLabel || 'Saved';
          if (typeof gridConfig.onSuccess === 'function') {
            gridConfig.onSuccess(payload);
          } else {
            updateSubmitState();
          }
        } catch (error) {
          status.textContent =
            error.message || gridConfig.errorMessage || 'Save failed.';
          submitButton.textContent = originalText;
          updateSubmitState();
        }
      });

      if (typeof gridConfig.onBack === 'function') {
        widget.appendChild(
          createPanelBackHeader(
            gridConfig.title || 'Form',
            gridConfig.backLabel || 'Back',
            gridConfig.onBack
          )
        );
      } else if (gridConfig.title) {
        const title = document.createElement('h3');
        title.className = 'oe-panel-action-list-title';
        title.textContent = gridConfig.title;
        widget.appendChild(title);
      }

      widget.append(form, status);
      container.replaceChildren(widget);
      container.dispatchEvent(
        new CustomEvent('oe-panel-request-expand', { bubbles: true })
      );
    }

    return { renderFormWidget };
  }

  window.createOePanelFormWidget = createOePanelFormWidget;
})();
