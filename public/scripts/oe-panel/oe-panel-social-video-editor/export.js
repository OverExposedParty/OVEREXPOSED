(function () {
  function createOePanelSocialVideoEditorExport({
    editContainer,
    fixedWatermarkX,
    editState,
    session,
    ensureOverExposedFontLoaded,
    clearActiveEditLeaveGuard,
    markEditSaved,
    status
  }) {
    let editPreview = null;
    let editText = null;
    let editTextLabel = null;
      const exportProgress = document.createElement('div');
      exportProgress.className = 'oe-panel-social-edit-export-progress';
      exportProgress.setAttribute('aria-hidden', 'true');
      const exportProgressSvg = document.createElementNS(
        'http://www.w3.org/2000/svg',
        'svg'
      );
      const exportProgressPath = document.createElementNS(
        'http://www.w3.org/2000/svg',
        'path'
      );
      exportProgressPath.classList.add('oe-panel-social-edit-export-path');
      exportProgressSvg.appendChild(exportProgressPath);
      exportProgress.appendChild(exportProgressSvg);
      let exportProgressLength = 0;

      const getRoundedRectPath = ({ width, height, borderWidth, radius }) => {
        const inset = borderWidth / 2;
        const x = inset;
        const y = inset;
        const right = Math.max(width - inset, inset);
        const bottom = Math.max(height - inset, inset);
        const rx = Math.max(radius - inset, 0);
        const ry = rx;
        const centerX = width / 2;

        return [
          `M ${centerX},${y}`,
          `H ${right - rx}`,
          `A ${rx},${ry} 0 0 1 ${right},${y + ry}`,
          `V ${bottom - ry}`,
          `A ${rx},${ry} 0 0 1 ${right - rx},${bottom}`,
          `H ${x + rx}`,
          `A ${rx},${ry} 0 0 1 ${x},${bottom - ry}`,
          `V ${y + ry}`,
          `A ${rx},${ry} 0 0 1 ${x + rx},${y}`,
          `H ${centerX}`
        ].join(' ');
      };

      const refreshExportProgressGeometry = () => {
        const rect = editContainer.getBoundingClientRect();
        if (!rect.width || !rect.height) return;

        const styles = getComputedStyle(editContainer);
        const borderWidth =
          parseFloat(styles.borderTopWidth) ||
          parseFloat(styles.getPropertyValue('--bordersize')) ||
          4;
        const radius = parseFloat(styles.borderTopLeftRadius) || 0;
        const pathData = getRoundedRectPath({
          width: rect.width,
          height: rect.height,
          borderWidth,
          radius
        });

        exportProgressSvg.setAttribute(
          'viewBox',
          `0 0 ${rect.width} ${rect.height}`
        );
        exportProgressPath.setAttribute('d', pathData);
        exportProgressLength = exportProgressPath.getTotalLength();
      };

      const setExportProgress = (progress) => {
        if (!exportProgressLength) refreshExportProgressGeometry();
        const clampedProgress = Math.min(Math.max(progress, 0), 1);
        const visibleLength = exportProgressLength * clampedProgress;
        const gapLength = exportProgressLength + 1;

        exportProgressPath.style.opacity = clampedProgress > 0 ? '1' : '0';
        exportProgressPath.style.strokeDasharray = `${visibleLength} ${gapLength}`;
        exportProgressPath.style.strokeDashoffset = '0';
      };


    const exportProgressResizeObserver =
      typeof ResizeObserver === 'function'
        ? new ResizeObserver(refreshExportProgressGeometry)
        : null;
    exportProgressResizeObserver?.observe(editContainer);

    const sanitizeExportFileName = (fileName) =>
      fileName
        .trim()
        .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '') || 'overexposed-export';

    let editSaveButton = null;
    let updateExportButtonState = () => {};

      const exportEditedVideo = async () => {
        if (!editState.meta.fileName.trim()) return;
        if (!session.uploadedVideoState?.file) {
          status.textContent = 'Choose a video file first.';
          return;
        }

        const exportButtonText = editSaveButton.textContent;
        editSaveButton.disabled = true;
        editSaveButton.textContent = 'Exporting...';
        status.textContent = 'Rendering video...';
        editContainer.classList.add('is-exporting');
        refreshExportProgressGeometry();
        setExportProgress(0);
        let exportProgressTimer = null;

        try {
          await ensureOverExposedFontLoaded();
          if (document.fonts?.ready) await document.fonts.ready;

          const previewBox = editPreview.getBoundingClientRect();
          const textBox = editTextLabel.getBoundingClientRect();
          const textStyle = getComputedStyle(editTextLabel);
          const renderScale = 1080 / previewBox.width;
          const lineHeight =
            parseFloat(textStyle.lineHeight) ||
            parseFloat(textStyle.fontSize) * 1.16;
          const normalizeColor = (value) => {
            const match = String(value).match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
            if (!match) return '#66CCFF';
            return `#${match
              .slice(1, 4)
              .map((part) => Number(part).toString(16).padStart(2, '0'))
              .join('')}`;
          };
          const settings = {
            fileName: editState.meta.fileName,
            crop: session.uploadedVideoState.crop,
            edit: {
              ...editState,
              watermarkX: fixedWatermarkX
            },
            metrics: {
              textX: (textBox.left - previewBox.left) * renderScale,
              textY: (textBox.top - previewBox.top) * renderScale,
              textWidth: textBox.width * renderScale,
              textHeight: textBox.height * renderScale,
              fontSize: parseFloat(textStyle.fontSize) * renderScale,
              lineSpacing:
                (lineHeight - parseFloat(textStyle.fontSize)) * renderScale,
              textColor: normalizeColor(getComputedStyle(editText).color)
            }
          };
          let exportProgressValue = 0;
          exportProgressTimer = window.setInterval(() => {
            exportProgressValue = Math.min(0.9, exportProgressValue + 0.015);
            setExportProgress(exportProgressValue);
          }, 500);
          const formData = new FormData();
          formData.append('video', session.uploadedVideoState.file);
          formData.append('settings', JSON.stringify(settings));
          const response = await fetch(
            '/api/oe-panel/social-media/export-video',
            {
              method: 'POST',
              body: formData
            }
          );
          window.clearInterval(exportProgressTimer);
          exportProgressTimer = null;

          if (!response.ok) {
            const errorData = await response.json().catch(() => null);
            throw new Error(
              errorData?.error?.message || 'Video export failed.'
            );
          }

          setExportProgress(1);
          const blob = await response.blob();
          const downloadUrl = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = downloadUrl;
          link.download = `${sanitizeExportFileName(
            editState.meta.fileName
          )}.mp4`;
          link.click();
          URL.revokeObjectURL(downloadUrl);
          markEditSaved();
          clearActiveEditLeaveGuard();
          status.textContent = 'Video downloaded.';
        } catch (error) {
          console.error('Video export failed', error);
          status.textContent = 'Video export failed.';
        } finally {
          if (exportProgressTimer) {
            window.clearInterval(exportProgressTimer);
          }
          editSaveButton.textContent = exportButtonText;
          editContainer.classList.remove('is-exporting');
          setExportProgress(0);
          updateExportButtonState();
        }
      };

    return {
      exportProgress,
      refreshExportProgressGeometry,
      setExportProgress,
      exportEditedVideo,
      setExportActions({ saveButton, updateButtonState }) {
        editSaveButton = saveButton;
        updateExportButtonState = updateButtonState;
      },
      setPreviewElements({ preview, text, textLabel }) {
        editPreview = preview;
        editText = text;
        editTextLabel = textLabel;
      },
      cleanup() {
        exportProgressResizeObserver?.disconnect();
      }
    };
  }

  window.createOePanelSocialVideoEditorExport =
    createOePanelSocialVideoEditorExport;
})();
