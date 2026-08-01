(function () {
  function createOePanelSocialVideoEditor(dependencies) {
    const {
      session,
      clearActiveEditLeaveGuard,
      showUploadVideoView,
      actionConfig,
      getBackHeaderTitle,
      appendCenteredBackHeaderTitle,
      createVideoControls,
      widget,
      applyVideoCrop,
      container,
      status
    } = dependencies;

    const showEditView = () => {
      const fixedWatermarkX = 34;
      let overExposedFontLoad = null;
      const ensureOverExposedFontLoaded = () => {
        if (
          overExposedFontLoad ||
          typeof FontFace !== 'function' ||
          !document.fonts
        ) {
          return overExposedFontLoad;
        }

        const overExposedFont = new FontFace(
          'OverExposed',
          'url("/fonts/overexposed/OverExposed-Regular.otf") format("opentype")'
        );
        overExposedFontLoad = overExposedFont
          .load()
          .then((loadedFont) => {
            document.fonts.add(loadedFont);
            return loadedFont;
          })
          .catch(() => null);
        return overExposedFontLoad;
      };

      const editState = session.uploadedVideoState.edit || {
        gamemode: 'truth-or-dare',
        text: 'Type your caption',
        fontSize: 14,
        horizontalAlign: 'center',
        verticalAlign: 'middle',
        textX: 50,
        textY: 50,
        textWidth: 42,
        playbackControls:
          session.uploadedVideoState.crop?.playbackControls ?? true,
        watermarkX: fixedWatermarkX,
        watermarkY: 92,
        meta: {
          fileName: ''
        }
      };
      editState.text ??= 'Type your caption';
      editState.playbackControls ??= true;
      editState.meta ??= {};
      editState.meta.fileName ??= '';
      editState.fontSize = Math.min(24, Math.max(4, editState.fontSize || 14));
      editState.textWidth = Math.min(
        90,
        Math.max(8, editState.textWidth || 42)
      );
      editState.watermarkX = fixedWatermarkX;
      session.uploadedVideoState.edit = editState;
      let hasUnsavedEditChanges = true;
      const markEditDirty = () => {
        hasUnsavedEditChanges = true;
      };
      const markEditSaved = () => {
        hasUnsavedEditChanges = false;
      };
      const confirmLeaveEdit = () =>
        !hasUnsavedEditChanges ||
        window.confirm('Leave without saving your edit changes?');
      const beforeUnloadEditHandler = (event) => {
        if (!hasUnsavedEditChanges) return;
        event.preventDefault();
        event.returnValue = '';
      };
      window.addEventListener('beforeunload', beforeUnloadEditHandler);

      const editHeader = document.createElement('div');
      editHeader.className = 'oe-panel-social-action-header';

      const editBackButton = document.createElement('button');
      editBackButton.className = 'oe-panel-alert-detail-back';
      editBackButton.type = 'button';
      editBackButton.setAttribute('aria-label', 'Back to crop video');
      editBackButton.addEventListener('click', () => {
        hasUnsavedEditChanges = false;
        clearActiveEditLeaveGuard();
        showUploadVideoView(actionConfig);
      });

      const editTitle = document.createElement('h3');
      editTitle.className =
        'oe-panel-social-creation-title oe-panel-social-action-title';
      editTitle.textContent = getBackHeaderTitle('Back to crop video');

      editHeader.append(editBackButton, editTitle);
      appendCenteredBackHeaderTitle(editHeader, 'Edit');

      const editContainer = document.createElement('div');
      editContainer.className = 'edit oe-panel-social-edit';


      const exportTools = window.createOePanelSocialVideoEditorExport({
        editContainer,
        fixedWatermarkX,
        editState,
        session,
        ensureOverExposedFontLoaded,
        clearActiveEditLeaveGuard,
        markEditSaved,
        status
      });
      const { exportProgress } = exportTools;
      const preview = window.createOePanelSocialVideoEditorPreview({
        session,
        editState,
        fixedWatermarkX,
        createVideoControls,
        markEditDirty,
        ensureOverExposedFontLoaded
      });
      const {
        editPreviewColumn,
        editPreview,
        editVideoFrame,
        editVideo,
        editVideoControls,
        editText,
        editTextLabel,
        watermark,
        gamemodeLabels,
        applyEditState
      } = preview;
      exportTools.setPreviewElements({
        preview: editPreview,
        text: editText,
        textLabel: editTextLabel
      });
      ensureOverExposedFontLoaded()?.then(applyEditState);
      session.activeEditLeaveGuard = {
        confirm: confirmLeaveEdit,
        cleanup: () => {
          window.removeEventListener('beforeunload', beforeUnloadEditHandler);
          exportTools.cleanup();
        }
      };

      const exportEditedVideo = exportTools.exportEditedVideo;
      const editPanelEntries = [];
      const setExpandedEditPanel = (activeEntry) => {
        editPanelEntries.forEach((entry) => {
          const isExpanded = entry === activeEntry;
          entry.panel.classList.toggle('is-expanded', isExpanded);
          entry.toggle.setAttribute('aria-expanded', String(isExpanded));
          entry.body.hidden = !isExpanded;
        });
      };

      const createEditPanel = (titleText, expanded = false) => {
        const panel = document.createElement('section');
        panel.className = 'oe-panel-social-edit-panel';

        const panelHeader = document.createElement('div');
        panelHeader.className = 'oe-panel-social-edit-panel-header';

        const panelTitle = document.createElement('h4');
        panelTitle.className = 'oe-panel-social-edit-panel-title';
        panelTitle.textContent = titleText;

        const toggle = document.createElement('button');
        toggle.className = 'oe-panel-social-edit-panel-toggle';
        toggle.type = 'button';
        toggle.setAttribute('aria-label', `${titleText} panel`);
        toggle.setAttribute('aria-expanded', 'false');

        const body = document.createElement('div');
        body.className = 'oe-panel-social-edit-panel-body';
        body.hidden = true;

        const entry = { panel, toggle, body };
        toggle.addEventListener('click', () => {
          const isExpanded = toggle.getAttribute('aria-expanded') === 'true';
          setExpandedEditPanel(isExpanded ? null : entry);
        });

        panelHeader.append(panelTitle, toggle);
        panel.append(panelHeader, body);
        editPanelEntries.push(entry);

        if (expanded) {
          requestAnimationFrame(() => {
            setExpandedEditPanel(entry);
          });
        }

        return entry;
      };

      const createEditSlider = (
        label,
        min,
        max,
        value,
        defaultValue,
        onInput
      ) => {
        const control = document.createElement('label');
        control.className = 'oe-panel-social-edit-control';

        const controlText = document.createElement('span');
        controlText.textContent = label;

        const inputRow = document.createElement('span');
        inputRow.className = 'oe-panel-social-edit-slider-row';

        const input = document.createElement('input');
        input.type = 'range';
        input.min = String(min);
        input.max = String(max);
        input.value = String(value);
        input.addEventListener('input', () => {
          onInput(Number(input.value));
          markEditDirty();
          applyEditState();
        });

        const resetButton = document.createElement('button');
        resetButton.className = 'oe-panel-social-edit-slider-reset';
        resetButton.type = 'button';
        resetButton.textContent = 'Reset';
        resetButton.addEventListener('click', () => {
          input.value = String(defaultValue);
          onInput(defaultValue);
          markEditDirty();
          applyEditState();
        });

        inputRow.append(input, resetButton);
        control.append(controlText, inputRow);
        return control;
      };

      const createAlignmentRow = (label, options, stateKey) => {
        const group = document.createElement('div');
        group.className = 'oe-panel-social-edit-align-group';

        const groupLabel = document.createElement('span');
        groupLabel.textContent = label;

        const row = document.createElement('div');
        row.className = 'oe-panel-social-edit-align-row';

        options.forEach((optionConfig) => {
          const button = document.createElement('button');
          button.className = 'oe-panel-social-edit-align-button';
          button.type = 'button';
          button.textContent = optionConfig.label;
          button.setAttribute(
            'aria-pressed',
            String(editState[stateKey] === optionConfig.value)
          );
          button.addEventListener('click', () => {
            editState[stateKey] = optionConfig.value;
            markEditDirty();
            row
              .querySelectorAll('.oe-panel-social-edit-align-button')
              .forEach((alignButton) => {
                alignButton.setAttribute('aria-pressed', 'false');
              });
            button.setAttribute('aria-pressed', 'true');
            applyEditState();
          });
          row.appendChild(button);
        });

        group.append(groupLabel, row);
        return group;
      };

      const createMetaField = (label, key, multiline = false) => {
        const field = document.createElement('label');
        field.className = 'oe-panel-social-edit-meta-field';

        const fieldLabel = document.createElement('span');
        fieldLabel.textContent = label;

        const input = document.createElement(multiline ? 'textarea' : 'input');
        input.className = multiline
          ? 'oe-panel-social-edit-meta-input is-multiline'
          : 'oe-panel-social-edit-meta-input';
        if (!multiline) input.type = 'text';
        input.value = editState.meta[key] || '';
        input.addEventListener('input', () => {
          editState.meta[key] = input.value;
          markEditDirty();
          updateExportButtonState();
        });

        field.append(fieldLabel, input);
        return field;
      };


      const editPanels = document.createElement('div');
      editPanels.className = 'oe-panel-social-edit-panels';
      let editSaveButton = null;
      const updateExportButtonState = () => {
        if (!editSaveButton) return;
        const hasFileName = Boolean(editState.meta.fileName.trim());
        editSaveButton.disabled = !hasFileName;
        editSaveButton.textContent = hasFileName
          ? 'Download Video'
          : 'Add File Name';
      };
      const generalPanel = createEditPanel('General', true);
      const gamemodeSelect = document.createElement('select');
      gamemodeSelect.className = 'oe-panel-social-edit-select';
      Object.entries(gamemodeLabels).forEach(([value, label]) => {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = label;
        gamemodeSelect.appendChild(option);
      });
      gamemodeSelect.value = editState.gamemode;
      gamemodeSelect.addEventListener('change', () => {
        editState.gamemode = gamemodeSelect.value;
        markEditDirty();
        applyEditState();
      });

      const playbackToggle = document.createElement('label');
      playbackToggle.className = 'oe-panel-video-playback-toggle';

      const playbackToggleText = document.createElement('span');
      playbackToggleText.textContent = 'Playback Controls';

      const playbackToggleInput = document.createElement('input');
      playbackToggleInput.type = 'checkbox';
      playbackToggleInput.checked = editState.playbackControls;
      playbackToggleInput.addEventListener('change', () => {
        editState.playbackControls = playbackToggleInput.checked;
        editVideoControls.hidden = !editState.playbackControls;
        markEditDirty();
      });

      const playbackToggleTrack = document.createElement('span');
      playbackToggleTrack.className = 'oe-panel-video-playback-track';

      playbackToggle.append(
        playbackToggleText,
        playbackToggleInput,
        playbackToggleTrack
      );
      generalPanel.body.append(gamemodeSelect, playbackToggle);

      const textPanel = createEditPanel('Text');
      const textInput = document.createElement('textarea');
      textInput.className = 'oe-panel-social-edit-text-input';
      textInput.value = editState.text;
      textInput.setAttribute('aria-label', 'Caption text');
      textInput.addEventListener('input', () => {
        editState.text = textInput.value;
        markEditDirty();
        applyEditState();
      });
      textPanel.body.append(
        createEditSlider(
          'Font Size',
          4,
          24,
          editState.fontSize,
          14,
          (value) => {
            editState.fontSize = value;
          }
        ),
        createAlignmentRow(
          'Horizontal',
          [
            { label: 'Left', value: 'left' },
            { label: 'Center', value: 'center' },
            { label: 'Right', value: 'right' }
          ],
          'horizontalAlign'
        ),
        createAlignmentRow(
          'Vertical',
          [
            { label: 'Top', value: 'top' },
            { label: 'Middle', value: 'middle' },
            { label: 'Bottom', value: 'bottom' }
          ],
          'verticalAlign'
        ),
        textInput
      );

      const watermarkPanel = createEditPanel('Watermark');
      watermarkPanel.body.append(
        createEditSlider(
          'Y Position',
          0,
          100,
          editState.watermarkY,
          92,
          (value) => {
            editState.watermarkX = fixedWatermarkX;
            editState.watermarkY = value;
          }
        )
      );

      const exportPanel = createEditPanel('Export');
      exportPanel.body.append(createMetaField('File Name', 'fileName'));

      editPanels.append(
        generalPanel.panel,
        textPanel.panel,
        watermarkPanel.panel,
        exportPanel.panel
      );
      editSaveButton = document.createElement('button');
      editSaveButton.className = 'oe-panel-social-edit-save';
      editSaveButton.type = 'button';
      updateExportButtonState();
      exportTools.setExportActions({
        saveButton: editSaveButton,
        updateButtonState: updateExportButtonState
      });
      editSaveButton.addEventListener('click', exportEditedVideo);
      editVideoFrame.appendChild(editVideo);
      editPreview.append(
        editVideoFrame,
        editText,
        watermark,
        editVideoControls
      );
      editPreviewColumn.appendChild(editPreview);
      const editSide = document.createElement('div');
      editSide.className = 'oe-panel-social-edit-side';
      editSide.append(editPanels, editSaveButton);
      editContainer.append(editPreviewColumn, editSide, exportProgress);
      applyEditState();

      widget.className =
        'oe-panel-widget oe-panel-widget-social-creation oe-panel-social-creation oe-panel-social-action-view oe-panel-social-edit-view';
      status.textContent = '';
      widget.replaceChildren(editHeader, editContainer, status);
      requestAnimationFrame(() => {
        applyEditState();
        applyVideoCrop(editVideo, session.uploadedVideoState.crop);
      });
      container.dispatchEvent(
        new CustomEvent('oe-panel-request-expand', { bubbles: true })
      );
    };

    return showEditView;
  }

  window.createOePanelSocialVideoEditor = createOePanelSocialVideoEditor;
})();
