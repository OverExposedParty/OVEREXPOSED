(function () {
  function createOePanelSocialVideoControls(video, trimState = null) {
    const controls = document.createElement('div');
    controls.className = 'oe-panel-video-controls';

    const playButton = document.createElement('button');
    playButton.className = 'oe-panel-video-control-button';
    playButton.type = 'button';
    playButton.setAttribute('aria-label', 'Play video');

    const playButtonIcon = document.createElement('span');
    playButtonIcon.className = 'oe-panel-video-control-icon';
    playButtonIcon.setAttribute('aria-hidden', 'true');

    const seekInput = document.createElement('input');
    seekInput.className = 'oe-panel-video-control-seek';
    seekInput.type = 'range';
    seekInput.min = '0';
    seekInput.max = '100';
    seekInput.step = '0.1';
    seekInput.value = '0';

    const trimTrack = document.createElement('span');
    trimTrack.className = 'oe-panel-video-trim-track';

    const trimFill = document.createElement('span');
    trimFill.className = 'oe-panel-video-trim-fill';

    const trimStartHandle = document.createElement('button');
    trimStartHandle.className = 'oe-panel-video-trim-handle is-start';
    trimStartHandle.type = 'button';
    trimStartHandle.setAttribute('aria-label', 'Trim start');

    const trimEndHandle = document.createElement('button');
    trimEndHandle.className = 'oe-panel-video-trim-handle is-end';
    trimEndHandle.type = 'button';
    trimEndHandle.setAttribute('aria-label', 'Trim end');

    const seekWrap = document.createElement('span');
    seekWrap.className = 'oe-panel-video-seek-wrap';
    seekWrap.append(seekInput, trimTrack, trimFill);
    if (trimState) {
      seekWrap.append(trimStartHandle, trimEndHandle);
    }

    const getTrimStart = () => trimState?.trimStart || 0;
    const getTrimEnd = () =>
      trimState?.trimEnd && video.duration
        ? Math.min(trimState.trimEnd, video.duration)
        : video.duration || 0;

    const updateTrimUi = () => {
      if (!video.duration) return;
      const trimStartPercent = (getTrimStart() / video.duration) * 100;
      const trimEndPercent = (getTrimEnd() / video.duration) * 100;

      seekWrap.style.setProperty(
        '--oe-panel-trim-start',
        `${trimStartPercent}%`
      );
      seekWrap.style.setProperty(
        '--oe-panel-trim-end',
        `${100 - trimEndPercent}%`
      );
    };

    const getPointerTrimTime = (event) => {
      const rect = seekWrap.getBoundingClientRect();
      if (!rect.width || !video.duration) return 0;
      const percent = Math.min(
        1,
        Math.max(0, (event.clientX - rect.left) / rect.width)
      );
      return percent * video.duration;
    };

    const startTrimDrag = (event, side) => {
      if (!trimState || !video.duration) return;
      event.preventDefault();
      const handle = side === 'start' ? trimStartHandle : trimEndHandle;
      handle.setPointerCapture(event.pointerId);

      const updateTrim = (pointerEvent) => {
        const trimStart = getTrimStart();
        const trimEnd = getTrimEnd();
        const nextTime = getPointerTrimTime(pointerEvent);

        if (side === 'start') {
          trimState.trimStart = Math.min(nextTime, trimEnd - 0.1);
          video.currentTime = trimState.trimStart;
        } else {
          trimState.trimEnd = Math.max(nextTime, trimStart + 0.1);
          video.currentTime = Math.min(video.currentTime, trimState.trimEnd);
        }
        updateTrimUi();
      };

      const stopTrimDrag = () => {
        handle.removeEventListener('pointermove', updateTrim);
        handle.removeEventListener('pointerup', stopTrimDrag);
        handle.removeEventListener('pointercancel', stopTrimDrag);
      };

      handle.addEventListener('pointermove', updateTrim);
      handle.addEventListener('pointerup', stopTrimDrag);
      handle.addEventListener('pointercancel', stopTrimDrag);
      updateTrim(event);
    };

    const clampVideoToTrim = () => {
      if (!video.duration || !trimState) return;
      const trimStart = getTrimStart();
      const trimEnd = getTrimEnd();

      if (video.currentTime < trimStart) {
        video.currentTime = trimStart;
      }
      if (video.currentTime >= trimEnd) {
        video.pause();
        video.currentTime = trimStart;
      }
    };

    playButton.addEventListener('click', () => {
      clampVideoToTrim();
      if (video.paused) {
        video.play();
      } else {
        video.pause();
      }
    });

    video.addEventListener('play', () => {
      playButton.classList.add('is-playing');
      playButton.setAttribute('aria-label', 'Pause video');
    });

    video.addEventListener('pause', () => {
      playButton.classList.remove('is-playing');
      playButton.setAttribute('aria-label', 'Play video');
    });

    video.addEventListener('timeupdate', () => {
      if (!video.duration) return;
      clampVideoToTrim();
      seekInput.value = String((video.currentTime / video.duration) * 100);
    });

    video.addEventListener('loadedmetadata', () => {
      if (!video.duration) return;
      if (trimState && !trimState.trimEnd) {
        trimState.trimEnd = video.duration;
      }
      if (trimState) {
        video.currentTime = getTrimStart();
      }
      updateTrimUi();
    });

    seekInput.addEventListener('input', () => {
      if (!video.duration) return;
      const nextTime = (Number(seekInput.value) / 100) * video.duration;
      video.currentTime = trimState
        ? Math.min(Math.max(nextTime, getTrimStart()), getTrimEnd())
        : nextTime;
    });

    trimStartHandle.addEventListener('pointerdown', (event) => {
      startTrimDrag(event, 'start');
    });

    trimEndHandle.addEventListener('pointerdown', (event) => {
      startTrimDrag(event, 'end');
    });

    playButton.appendChild(playButtonIcon);
    controls.append(playButton, seekWrap);
    return controls;
  }

  window.createOePanelSocialVideoControls = createOePanelSocialVideoControls;
})();
