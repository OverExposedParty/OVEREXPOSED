(function () {
  function createAspectRatioControl({
    cropState,
    videoFrame,
    scheduleVideoFrameFit,
    updateVideoFrameAspectRatio
  }) {
    const control = document.createElement('label');
    control.className = 'oe-panel-video-crop-control';

    const controlText = document.createElement('span');
    controlText.textContent = 'Aspect Ratio';

    const select = document.createElement('select');
    [
      { label: '16:9', value: '16 / 9' },
      { label: '9:16', value: '9 / 16' },
      { label: '4:3', value: '4 / 3' },
      { label: '1:1', value: '1 / 1' }
    ].forEach((optionConfig) => {
      const option = document.createElement('option');
      option.value = optionConfig.value;
      option.textContent = optionConfig.label;
      select.appendChild(option);
    });

    select.value = cropState.aspectRatio;
    updateVideoFrameAspectRatio(videoFrame);
    select.addEventListener('change', () => {
      cropState.aspectRatio = select.value;
      updateVideoFrameAspectRatio(videoFrame);
      scheduleVideoFrameFit();
    });

    control.append(controlText, select);
    return control;
  }

  function createOePanelSocialVideoUploadView(dependencies) {
    const {
      getBackHeaderTitle,
      appendCenteredBackHeaderTitle,
      quickActionConfigs,
      widget,
      status,
      container,
      session,
      showActionMenu,
      clearActiveEditLeaveGuard,
      createDownloadIcon
    } = dependencies;

    const showUploadVideoView = (actionConfig) => {
      const parentAction = quickActionConfigs.find((config) =>
        Array.isArray(config.actions)
          ? config.actions.includes(actionConfig)
          : false
      );
      const cropState = {
        zoom: session.uploadedVideoState?.crop?.zoom || 1,
        x: session.uploadedVideoState?.crop?.x || 50,
        y: session.uploadedVideoState?.crop?.y || 50,
        aspectRatio: session.uploadedVideoState?.crop?.aspectRatio || '16 / 9',
        playbackControls:
          session.uploadedVideoState?.crop?.playbackControls ?? true,
        trimStart: session.uploadedVideoState?.crop?.trimStart || 0,
        trimEnd: session.uploadedVideoState?.crop?.trimEnd || null
      };
      const {
        applyVideoCrop,
        createCropControl,
        fitVideoFrameToContainer,
        updateVideoCrop,
        updateVideoFrameAspectRatio
      } = window.createOePanelSocialVideoCropHelpers(cropState);

      const detailHeader = document.createElement('div');
      detailHeader.className = 'oe-panel-social-action-header';

      const backButton = document.createElement('button');
      backButton.className = 'oe-panel-alert-detail-back';
      backButton.type = 'button';
      backButton.setAttribute('aria-label', 'Back to short-form studio');
      backButton.addEventListener('click', () => {
        showActionMenu(
          parentAction || { label: 'Short-Form Studio', actions: [] }
        );
      });

      const detailTitle = document.createElement('h3');
      detailTitle.className =
        'oe-panel-social-creation-title oe-panel-social-action-title';
      detailTitle.textContent = getBackHeaderTitle('Back to short-form studio');

      detailHeader.append(backButton, detailTitle);
      appendCenteredBackHeaderTitle(detailHeader, actionConfig.label);

      const uploadVideo = document.createElement('div');
      uploadVideo.className = 'upload-video oe-panel-upload-video';

      const fileInput = document.createElement('input');
      fileInput.className = 'oe-panel-upload-video-input';
      fileInput.type = 'file';
      fileInput.accept = 'video/*';

      const showDropPrompt = () => {
        const chooseFileButton = document.createElement('button');
        chooseFileButton.className = 'oe-panel-upload-video-button';
        chooseFileButton.type = 'button';
        chooseFileButton.textContent = 'Choose File';
        chooseFileButton.addEventListener('click', () => {
          fileInput.click();
        });

        const dropHint = document.createElement('div');
        dropHint.className = 'oe-panel-upload-video-drop-hint';
        const dropHintText = document.createElement('span');
        dropHintText.textContent = 'or drop a file here';
        dropHint.append(createDownloadIcon(), dropHintText);

        uploadVideo.replaceChildren(fileInput, chooseFileButton, dropHint);
      };

      const showVideoCropper = () => {
        if (!session.uploadedVideoState) {
          showDropPrompt();
          return;
        }

        const cropper = document.createElement('div');
        cropper.className = 'oe-panel-video-cropper';

        const videoColumn = document.createElement('div');
        videoColumn.className = 'oe-panel-video-crop-column';

        const videoFrameArea = document.createElement('div');
        videoFrameArea.className = 'oe-panel-video-frame-area';

        const videoFrame = document.createElement('div');
        videoFrame.className = 'oe-panel-video-crop-frame';

        const video = document.createElement('video');
        video.className = 'oe-panel-upload-video-preview';
        video.src = session.uploadedVideoState.url;
        video.muted = true;
        video.playsInline = true;
        updateVideoCrop(video);

        const videoControls = window.createOePanelSocialVideoControls(
          video,
          cropState
        );
        videoControls.hidden = !cropState.playbackControls;
        videoFrame.append(video, videoControls);
        videoFrameArea.appendChild(videoFrame);

        const scheduleVideoFrameFit = () => {
          requestAnimationFrame(() => {
            fitVideoFrameToContainer(videoFrame, videoColumn);
          });
        };

        const frameResizeObserver =
          typeof ResizeObserver === 'function'
            ? new ResizeObserver(scheduleVideoFrameFit)
            : null;
        frameResizeObserver?.observe(videoColumn);
        frameResizeObserver?.observe(videoFrameArea);

        const cropControls = document.createElement('div');
        cropControls.className = 'oe-panel-video-crop-controls';
        const playbackToggle = document.createElement('label');
        playbackToggle.className = 'oe-panel-video-playback-toggle';

        const playbackToggleText = document.createElement('span');
        playbackToggleText.textContent = 'Playback Controls';

        const playbackToggleInput = document.createElement('input');
        playbackToggleInput.type = 'checkbox';
        playbackToggleInput.checked = cropState.playbackControls;
        playbackToggleInput.addEventListener('change', () => {
          cropState.playbackControls = playbackToggleInput.checked;
          videoControls.hidden = !cropState.playbackControls;
        });

        const playbackToggleTrack = document.createElement('span');
        playbackToggleTrack.className = 'oe-panel-video-playback-track';

        playbackToggle.append(
          playbackToggleText,
          playbackToggleInput,
          playbackToggleTrack
        );

        cropControls.append(
          createAspectRatioControl({
            cropState,
            videoFrame,
            scheduleVideoFrameFit,
            updateVideoFrameAspectRatio
          }),
          createCropControl('Zoom', 1, 3, 0.05, cropState.zoom, (value) => {
            cropState.zoom = value;
            updateVideoCrop(video);
          }),
          createCropControl('Crop X', 0, 100, 1, cropState.x, (value) => {
            cropState.x = value;
            updateVideoCrop(video);
          }),
          createCropControl('Crop Y', 0, 100, 1, cropState.y, (value) => {
            cropState.y = value;
            updateVideoCrop(video);
          })
        );

        const saveButton = document.createElement('button');
        saveButton.className = 'oe-panel-upload-video-save';
        saveButton.type = 'button';
        saveButton.textContent = 'Save';
        saveButton.addEventListener('click', () => {
          session.uploadedVideoState.crop = { ...cropState };
          showEditView(actionConfig);
        });

        const replaceButton = document.createElement('button');
        replaceButton.className = 'oe-panel-upload-video-replace';
        replaceButton.type = 'button';
        replaceButton.textContent = 'Choose Different File';
        replaceButton.addEventListener('click', () => {
          fileInput.click();
        });

        const saveActions = document.createElement('div');
        saveActions.className = 'oe-panel-video-save-actions';
        saveActions.append(saveButton);

        cropControls.append(playbackToggle, saveActions);
        videoColumn.append(videoFrameArea, replaceButton);
        cropper.append(videoColumn, cropControls);
        uploadVideo.replaceChildren(fileInput, cropper);
        scheduleVideoFrameFit();
      };

      const handleVideoFile = (file) => {
        if (!file || !file.type.startsWith('video/')) {
          status.textContent = 'Choose a video file.';
          return;
        }

        if (session.uploadedVideoState?.url) {
          URL.revokeObjectURL(session.uploadedVideoState.url);
        }

        cropState.zoom = 1;
        cropState.x = 50;
        cropState.y = 50;
        cropState.aspectRatio = '16 / 9';
        cropState.playbackControls = true;
        cropState.trimStart = 0;
        cropState.trimEnd = null;
        session.uploadedVideoState = {
          file,
          url: URL.createObjectURL(file),
          crop: { ...cropState }
        };
        status.textContent = '';
        showVideoCropper();
      };

      fileInput.addEventListener('change', () => {
        handleVideoFile(fileInput.files?.[0]);
      });

      uploadVideo.addEventListener('dragover', (event) => {
        event.preventDefault();
        uploadVideo.classList.add('is-dragging');
      });

      uploadVideo.addEventListener('dragleave', () => {
        uploadVideo.classList.remove('is-dragging');
      });

      uploadVideo.addEventListener('drop', (event) => {
        event.preventDefault();
        uploadVideo.classList.remove('is-dragging');
        handleVideoFile(event.dataTransfer?.files?.[0]);
      });

      const showEditView = window.createOePanelSocialVideoEditor({
        session,
        clearActiveEditLeaveGuard,
        showUploadVideoView,
        actionConfig,
        getBackHeaderTitle,
        appendCenteredBackHeaderTitle,
        createVideoControls: window.createOePanelSocialVideoControls,
        widget,
        applyVideoCrop,
        container,
        status
      });

      widget.className =
        'oe-panel-widget oe-panel-widget-social-creation oe-panel-social-creation oe-panel-social-action-view oe-panel-upload-video-view';
      status.textContent = '';
      widget.replaceChildren(detailHeader, uploadVideo, status);
      if (session.uploadedVideoState) {
        showVideoCropper();
      } else {
        showDropPrompt();
      }
      container.dispatchEvent(
        new CustomEvent('oe-panel-request-expand', { bubbles: true })
      );
    };

    return showUploadVideoView;
  }

  window.createOePanelSocialVideoUploadView =
    createOePanelSocialVideoUploadView;
})();
