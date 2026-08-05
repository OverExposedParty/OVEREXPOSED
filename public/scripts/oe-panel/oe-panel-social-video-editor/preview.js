(function () {
  function createOePanelSocialVideoEditorPreview({
    session,
    editState,
    fixedWatermarkX,
    createVideoControls,
    markEditDirty,
    ensureOverExposedFontLoaded
  }) {
      const editPreviewColumn = document.createElement('div');
      editPreviewColumn.className = 'oe-panel-social-edit-preview-column';

      const editPreview = document.createElement('div');
      editPreview.className = 'oe-panel-social-edit-preview';
      editPreview.style.aspectRatio = '9 / 16';

      const editVideoFrame = document.createElement('div');
      editVideoFrame.className = 'oe-panel-social-edit-video-frame';
      editVideoFrame.style.aspectRatio =
        session.uploadedVideoState.crop.aspectRatio || '16 / 9';

      const editVideo = document.createElement('video');
      editVideo.className = 'oe-panel-upload-video-preview';
      editVideo.src = session.uploadedVideoState.url;
      editVideo.playsInline = true;
      const editVideoControls = createVideoControls(editVideo);
      editVideoControls.hidden = !editState.playbackControls;

      const editText = document.createElement('div');
      editText.className = 'oe-panel-social-edit-text';
      editText.setAttribute('aria-label', 'Draggable video caption text');
      const leftResizeHandle = document.createElement('span');
      leftResizeHandle.className =
        'oe-panel-social-edit-text-resize-handle is-left';
      leftResizeHandle.setAttribute('aria-hidden', 'true');
      const editTextLabel = document.createElement('span');
      editTextLabel.className = 'oe-panel-social-edit-text-label';
      const dragHandle = document.createElement('span');
      dragHandle.className = 'oe-panel-social-edit-text-drag-handle';
      dragHandle.setAttribute('aria-hidden', 'true');
      const rightResizeHandle = document.createElement('span');
      rightResizeHandle.className =
        'oe-panel-social-edit-text-resize-handle is-right';
      rightResizeHandle.setAttribute('aria-hidden', 'true');
      editText.append(
        leftResizeHandle,
        editTextLabel,
        dragHandle,
        rightResizeHandle
      );

      const watermark = document.createElement('img');
      watermark.className = 'oe-panel-social-edit-watermark';
      watermark.alt = '';
      watermark.setAttribute('aria-hidden', 'true');

      const gamemodeLabels = {
        'truth-or-dare': 'Truth or Dare',
        paranoia: 'Paranoia',
        'never-have-i-ever': 'Never Have I Ever',
        'most-likely-to': 'Most Likely To',
        'would-you-rather': 'Would You Rather',
        imposter: 'Imposter',
        mafia: 'Mafia',
        overexposure: 'Overexposure'
      };
      const getWatermarkPath = (gamemode) =>
        `/images/content/watermarks/${gamemode}.png`;
      const sanitizeExportFileName = (fileName) =>
        fileName
          .trim()
          .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-')
          .replace(/\s+/g, '-')
          .replace(/-+/g, '-')
          .replace(/^-|-$/g, '') || 'overexposed-export';

      const applyEditState = () => {
        editTextLabel.textContent = editState.text;
        editText.style.fontFamily =
          '"OverExposed", "OverExposed-Regular", sans-serif';
        editTextLabel.style.fontFamily =
          '"OverExposed", "OverExposed-Regular", sans-serif';
        editText.style.fontSize = `${editState.fontSize}px`;
        const gamemodePalette = window.OE_PANEL_PALETTES?.get(
          'gamemode',
          editState.gamemode
        );
        editText.style.color =
          gamemodePalette?.primary ||
          'var(--oe-panel-widget-primary-colour)';
        editText.style.left = `${editState.textX}%`;
        editText.style.top = `${editState.textY}%`;
        editText.style.width = `${editState.textWidth}%`;
        editText.dataset.horizontalAlign = editState.horizontalAlign;
        editText.dataset.verticalAlign = editState.verticalAlign;
        watermark.src = getWatermarkPath(editState.gamemode);
        editState.watermarkX = fixedWatermarkX;
        watermark.style.left = `${editState.watermarkX}%`;
        watermark.style.top = `${editState.watermarkY}%`;
      };
      ensureOverExposedFontLoaded()?.then(() => {
        applyEditState();
      });

      const getTextBoxHorizontalEdges = (centerX, widthPercent) => {
        if (editState.horizontalAlign === 'left') {
          return { left: centerX, right: centerX + widthPercent };
        }

        if (editState.horizontalAlign === 'right') {
          return { left: centerX - widthPercent, right: centerX };
        }

        return {
          left: centerX - widthPercent / 2,
          right: centerX + widthPercent / 2
        };
      };

      const getTextXFromLeftEdge = (leftEdge, widthPercent) => {
        if (editState.horizontalAlign === 'left') return leftEdge;
        if (editState.horizontalAlign === 'right')
          return leftEdge + widthPercent;
        return leftEdge + widthPercent / 2;
      };

      const snapTextBoxHorizontalPosition = (centerX, widthPercent) => {
        const edges = getTextBoxHorizontalEdges(centerX, widthPercent);
        const snapPoints = [0, 50, 100];
        const snapDistance = 5;
        const centerSnap = snapPoints.find(
          (point) => Math.abs(point - centerX) <= snapDistance
        );

        if (centerSnap === 50) return 50;
        if (Math.abs(edges.left) <= snapDistance) {
          return getTextXFromLeftEdge(0, widthPercent);
        }
        if (Math.abs(100 - edges.right) <= snapDistance) {
          return getTextXFromLeftEdge(100 - widthPercent, widthPercent);
        }

        return centerX;
      };

      dragHandle.addEventListener('pointerdown', (event) => {
        event.preventDefault();
        editText.setPointerCapture(event.pointerId);

        const updateTextPosition = (pointerEvent) => {
          const previewRect = editPreview.getBoundingClientRect();
          if (!previewRect.width || !previewRect.height) return;

          const nextX =
            ((pointerEvent.clientX - previewRect.left) / previewRect.width) *
            100;
          const nextY =
            ((pointerEvent.clientY - previewRect.top) / previewRect.height) *
            100;

          editState.textX = Math.min(
            100,
            Math.max(
              0,
              snapTextBoxHorizontalPosition(nextX, editState.textWidth)
            )
          );
          editState.textY = Math.min(100, Math.max(0, nextY));
          markEditDirty();
          applyEditState();
        };

        const stopDragging = () => {
          editText.removeEventListener('pointermove', updateTextPosition);
          editText.removeEventListener('pointerup', stopDragging);
          editText.removeEventListener('pointercancel', stopDragging);
        };

        editText.addEventListener('pointermove', updateTextPosition);
        editText.addEventListener('pointerup', stopDragging);
        editText.addEventListener('pointercancel', stopDragging);
        updateTextPosition(event);
      });

      const startTextResize = (event, side) => {
        event.preventDefault();
        event.stopPropagation();
        editText.setPointerCapture(event.pointerId);

        const startX = event.clientX;
        const startWidth = editState.textWidth;
        const startEdges = getTextBoxHorizontalEdges(
          editState.textX,
          editState.textWidth
        );

        const updateTextSize = (pointerEvent) => {
          const previewRect = editPreview.getBoundingClientRect();
          if (!previewRect.width) return;

          const deltaPercent =
            ((pointerEvent.clientX - startX) / previewRect.width) * 100;
          let nextWidth = startWidth;
          let nextLeft = startEdges.left;

          if (side === 'right') {
            nextWidth = startWidth + deltaPercent;
          } else {
            nextWidth = startWidth - deltaPercent;
            nextLeft = startEdges.left + deltaPercent;
          }

          nextWidth = Math.min(90, Math.max(8, nextWidth));

          if (side === 'left') {
            editState.textX = getTextXFromLeftEdge(nextLeft, nextWidth);
          }

          editState.textWidth = nextWidth;
          editState.textX = Math.min(
            100,
            Math.max(
              0,
              snapTextBoxHorizontalPosition(editState.textX, nextWidth)
            )
          );
          markEditDirty();
          applyEditState();
        };

        const stopResizing = () => {
          editText.removeEventListener('pointermove', updateTextSize);
          editText.removeEventListener('pointerup', stopResizing);
          editText.removeEventListener('pointercancel', stopResizing);
        };

        editText.addEventListener('pointermove', updateTextSize);
        editText.addEventListener('pointerup', stopResizing);
        editText.addEventListener('pointercancel', stopResizing);
      };

      leftResizeHandle.addEventListener('pointerdown', (event) => {
        startTextResize(event, 'left');
      });
      rightResizeHandle.addEventListener('pointerdown', (event) => {
        startTextResize(event, 'right');
      });

    return {
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
    };
  }

  window.createOePanelSocialVideoEditorPreview =
    createOePanelSocialVideoEditorPreview;
})();
