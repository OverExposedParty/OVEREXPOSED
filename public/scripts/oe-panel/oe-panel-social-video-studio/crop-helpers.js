(function () {
  function createOePanelSocialVideoCropHelpers(cropState) {
    const getAspectRatioParts = () => {
      const [widthRatio, heightRatio] = cropState.aspectRatio
        .split('/')
        .map((value) => Number(value.trim()));
      return {
        widthRatio: widthRatio || 16,
        heightRatio: heightRatio || 9
      };
    };

    const applyVideoCrop = (video, crop) => {
      const videoFrame = video.parentElement;
      const frameWidth = videoFrame?.clientWidth || 0;
      const frameHeight = videoFrame?.clientHeight || 0;
      const zoom = crop.zoom || 1;
      const cropX = crop.x ?? 50;
      const cropY = crop.y ?? 50;
      const zoomOverflowX = frameWidth * (zoom - 1);
      const zoomOverflowY = frameHeight * (zoom - 1);
      const panX = ((50 - cropX) / 100) * zoomOverflowX;
      const panY = ((50 - cropY) / 100) * zoomOverflowY;

      video.style.setProperty('--oe-panel-video-crop-zoom', zoom);
      video.style.setProperty('--oe-panel-video-crop-x', `${cropX}%`);
      video.style.setProperty('--oe-panel-video-crop-y', `${cropY}%`);
      video.style.setProperty('--oe-panel-video-crop-pan-x', `${panX}px`);
      video.style.setProperty('--oe-panel-video-crop-pan-y', `${panY}px`);
    };

    const updateVideoCrop = (video) => {
      applyVideoCrop(video, cropState);
    };

    const updateVideoFrameAspectRatio = (videoFrame) => {
      const { widthRatio, heightRatio } = getAspectRatioParts();

      videoFrame.style.aspectRatio = cropState.aspectRatio;
      videoFrame.style.setProperty(
        '--oe-panel-video-frame-width-ratio',
        widthRatio
      );
      videoFrame.style.setProperty(
        '--oe-panel-video-frame-height-ratio',
        heightRatio
      );
    };

    const fitVideoFrameToContainer = (videoFrame, videoColumn) => {
      const { widthRatio, heightRatio } = getAspectRatioParts();
      const ratio = widthRatio / heightRatio;
      const columnWidth = videoColumn.clientWidth;
      const frameAreaHeight =
        videoColumn.querySelector('.oe-panel-video-frame-area')
          ?.clientHeight || videoColumn.clientHeight;

      if (!columnWidth || !frameAreaHeight) return;

      const heightFromWidth = columnWidth / ratio;
      const fittedHeight = Math.min(frameAreaHeight, heightFromWidth);
      const fittedWidth = fittedHeight * ratio;
      const replaceButton = videoColumn.querySelector(
        '.oe-panel-upload-video-replace'
      );

      videoFrame.style.width = `${fittedWidth}px`;
      videoFrame.style.height = `${fittedHeight}px`;
      const video = videoFrame.querySelector('.oe-panel-upload-video-preview');
      if (video) {
        updateVideoCrop(video);
      }
      if (replaceButton) {
        replaceButton.style.width = `${fittedWidth}px`;
      }
    };

    const createCropControl = (label, min, max, step, value, onInput) => {
      const control = document.createElement('label');
      control.className = 'oe-panel-video-crop-control';

      const controlText = document.createElement('span');
      controlText.textContent = label;

      const input = document.createElement('input');
      input.type = 'range';
      input.min = String(min);
      input.max = String(max);
      input.step = String(step);
      input.value = String(value);
      input.addEventListener('input', () => {
        onInput(Number(input.value));
      });

      control.append(controlText, input);
      return control;
    };

    return {
      applyVideoCrop,
      createCropControl,
      fitVideoFrameToContainer,
      updateVideoCrop,
      updateVideoFrameAspectRatio
    };
  }

  window.createOePanelSocialVideoCropHelpers =
    createOePanelSocialVideoCropHelpers;
})();
