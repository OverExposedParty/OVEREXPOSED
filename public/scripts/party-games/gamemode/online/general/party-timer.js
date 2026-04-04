let timeout;

function createRoundedRectPath({ x, y, width, height, rx, ry }) {
  const right = x + width;
  const bottom = y + height;
  const centerX = x + width / 2;

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
}

function setBorderPathProgress(selectedTimer, progress) {
  if (!selectedTimer) return;

  selectedTimer._latestProgress = progress;
  const borderProgress = selectedTimer._borderProgressEl;
  const borderLength = selectedTimer._borderLength;
  const startOffset = selectedTimer._borderStartOffset || 0;

  if (!borderProgress || !Number.isFinite(borderLength)) return;

  const clampedProgress = Math.min(Math.max(progress, 0), 1);
  const visibleLength = borderLength * clampedProgress;
  const nonWrappingGap = borderLength + 1;

  if (clampedProgress <= 0) {
    borderProgress.style.opacity = '0';
    borderProgress.style.strokeDasharray = `0 ${nonWrappingGap}`;
    borderProgress.style.strokeDashoffset = `${-startOffset}`;
    return;
  }

  borderProgress.style.opacity = '1';

  // Keep the gap longer than the entire path so the dash pattern cannot
  // wrap and create a second visible segment elsewhere on the border.
  borderProgress.style.strokeDasharray = `${visibleLength} ${nonWrappingGap}`;
  borderProgress.style.strokeDashoffset = `${-startOffset}`;
}

function updateBorderTimerFromContainer(timerWrapper) {
  const host = timerWrapper.parentElement;
  const svg = timerWrapper._borderSvg;
  const borderTrack = timerWrapper._borderTrackEl;
  const borderProgress = timerWrapper._borderProgressEl;
  if (!host || !svg || !borderTrack || !borderProgress) return;

  const rect = host.getBoundingClientRect();
  if (!rect.width || !rect.height) return;

  const styles = getComputedStyle(host);
  const borderWidth =
    parseFloat(styles.borderTopWidth) ||
    parseFloat(styles.getPropertyValue('--bordersize')) ||
    4;
  const radius = parseFloat(styles.borderTopLeftRadius) || 25;
  const inset = borderWidth / 2;
  const width = Math.max(rect.width - borderWidth, 0);
  const height = Math.max(rect.height - borderWidth, 0);
  const rx = Math.max(radius - inset, 0);
  const ry = Math.max(radius - inset, 0);
  const pathData = createRoundedRectPath({
    x: inset,
    y: inset,
    width,
    height,
    rx,
    ry
  });

  svg.setAttribute('viewBox', `0 0 ${rect.width} ${rect.height}`);
  [borderTrack, borderProgress].forEach((el) => {
    el.setAttribute('d', pathData);
  });

  const borderLength = borderProgress.getTotalLength();
  timerWrapper._borderLength = borderLength;
  setBorderPathProgress(timerWrapper, timerWrapper._latestProgress ?? 0);
}

function updateBorderTimerGeometry(timerWrapper) {
  if (!timerWrapper) return;

  if (timerWrapper.dataset.timerHost === 'svg-card') {
    const borderProgress = timerWrapper._borderProgressEl;
    if (!borderProgress) return;

    timerWrapper._borderLength = borderProgress.getTotalLength();
    setBorderPathProgress(timerWrapper, timerWrapper._latestProgress ?? 0);
    return;
  }

  updateBorderTimerFromContainer(timerWrapper);
}

function buildContainerBorderTimer(timerWrapper) {
  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('aria-hidden', 'true');
  svg.classList.add('border-timer-svg');
  const trackPath = document.createElementNS(svgNS, 'path');
  trackPath.classList.add('timer-border-track');

  const progressPath = document.createElementNS(svgNS, 'path');
  progressPath.classList.add('timer-border-progress');

  svg.appendChild(trackPath);
  svg.appendChild(progressPath);

  timerWrapper._borderTrackEl = trackPath;
  timerWrapper._borderProgressEl = progressPath;
  timerWrapper.appendChild(svg);
  timerWrapper._borderSvg = svg;
  timerWrapper._resizeObserver = new ResizeObserver(() => {
    updateBorderTimerGeometry(timerWrapper);
  });
  if (timerWrapper.parentElement) {
    timerWrapper._resizeObserver.observe(timerWrapper.parentElement);
  }

  updateBorderTimerGeometry(timerWrapper);
}

function buildSvgCardBorderTimer(timerWrapper, host) {
  const svg = host?.querySelector('svg.main-image');
  const trackPath = svg?.querySelector('.timer-border-track-svg');
  const progressPath = svg?.querySelector('.timer-border-progress-svg');
  if (!svg || !trackPath || !progressPath) return;

  timerWrapper._borderSvg = svg;
  timerWrapper._borderTrackEl = trackPath;
  timerWrapper._borderProgressEl = progressPath;
  timerWrapper.dataset.timerHost = 'svg-card';
  timerWrapper._resizeObserver = new ResizeObserver(() => {
    updateBorderTimerGeometry(timerWrapper);
  });
  timerWrapper._resizeObserver.observe(svg);

  updateBorderTimerGeometry(timerWrapper);
}

function ensureBorderTimerGeometry(selectedTimer) {
  if (!selectedTimer || selectedTimer.dataset.timerVariant !== 'border') return;

  if (!selectedTimer._borderProgressEl) {
    if (selectedTimer.dataset.timerHost === 'svg-card') {
      buildSvgCardBorderTimer(selectedTimer, selectedTimer.parentElement);
    } else {
      buildContainerBorderTimer(selectedTimer);
    }
  } else {
    updateBorderTimerGeometry(selectedTimer);
  }
}

function startTimer({ timeLeft = 0, duration = 0, selectedTimer = null }) {
  if (!selectedTimer) return;

  const isBorderTimer = selectedTimer.dataset.timerVariant === 'border';
  const timer = selectedTimer.querySelector('.timer');
  const mask = selectedTimer.querySelector('.mask');
  const timerWrapper = selectedTimer;
  const small = selectedTimer.classList.contains('small');
  let timerNumber;

  if (!small) {
    timerNumber = selectedTimer.querySelector('.timer-number');
    if (timerNumber) {
      timerNumber.textContent = timeLeft;
    }
  }

  if (timeLeft > duration) timeLeft = duration;
  if (timeLeft < 0) timeLeft = 0;

  if (isBorderTimer) {
    ensureBorderTimerGeometry(selectedTimer);
    selectedTimer.classList.add('is-active');
    setBorderPathProgress(selectedTimer, 0);
  } else {
    showContainer(timerWrapper);
  }

  let startTime = null;
  let remaining = timeLeft;

  // attach metadata so stopTimer can clean up
  selectedTimer._cancel = false;
  selectedTimer._requestId = null;
  selectedTimer._duration = duration; // store for reset
  selectedTimer._small = small;
  selectedTimer._timer = timer;
  selectedTimer._mask = mask;
  selectedTimer._timerNumber = timerNumber;

  function animate(timestamp) {
    if (selectedTimer._cancel) return;
    if (!startTime) startTime = timestamp;

    const elapsed = (timestamp - startTime) / 1000;
    const timePassed = duration - timeLeft + elapsed;
    const progress = duration > 0 ? Math.min(timePassed / duration, 1) : 1;
    const rotateDeg = 360 * progress;

    if (isBorderTimer) {
      ensureBorderTimerGeometry(selectedTimer);
      setBorderPathProgress(selectedTimer, progress);
    } else if (timer) {
      timer.style.transform = `rotate(${rotateDeg}deg)`;
    }

    if (!isBorderTimer && mask) {
      if (progress < 0.5) {
        const localProgress = progress / 0.5;
        const rotation = 0 + localProgress * (-179.8);
        mask.style.transform = `rotate(${rotation}deg)`;
        mask.style.background = getComputedStyle(document.documentElement)
          .getPropertyValue('--primarypagecolour').trim();
      } else {
        const localProgress = (progress - 0.5) / 0.5;
        const rotation = 0 + localProgress * (-180);
        mask.style.transform = `rotate(${rotation}deg)`;
        mask.style.background = getComputedStyle(document.documentElement)
          .getPropertyValue('--backgroundcolour').trim();
      }
    }

    const newRemaining = Math.ceil(duration - timePassed);
    if (!small && timerNumber && newRemaining !== remaining && newRemaining >= 0) {
      remaining = newRemaining;
      timerNumber.textContent = remaining;
    }

    if (progress < 1 && !selectedTimer._cancel) {
      selectedTimer._requestId = requestAnimationFrame(animate);
    }
  }

  selectedTimer._requestId = requestAnimationFrame(animate);
}

function stopTimer(selectedTimer) {
  if (!selectedTimer) return;

  // cancel ongoing animation
  selectedTimer._cancel = true;
  if (selectedTimer._requestId) {
    cancelAnimationFrame(selectedTimer._requestId);
    selectedTimer._requestId = null;
  }

  const timer = selectedTimer._timer || selectedTimer.querySelector('.timer');
  const mask = selectedTimer._mask || selectedTimer.querySelector('.mask');
  const timerNumber = selectedTimer._timerNumber || selectedTimer.querySelector('.timer-number');
  const small = selectedTimer._small ?? selectedTimer.classList.contains('small');
  const duration = selectedTimer._duration || 0;
  const isBorderTimer = selectedTimer.dataset.timerVariant === 'border';

  // visually reset to full
  if (isBorderTimer) {
    ensureBorderTimerGeometry(selectedTimer);
    selectedTimer.classList.add('is-active');
    setBorderPathProgress(selectedTimer, 1);
  } else if (timer) {
    timer.style.transform = 'rotate(360deg)';
  }
  if (!isBorderTimer && mask) {
    mask.style.transform = 'rotate(-180deg)';
    mask.style.background = getComputedStyle(document.documentElement)
      .getPropertyValue('--backgroundcolour').trim();
  }

  // reset number text
  if (!small && timerNumber) {
    timerNumber.textContent = duration;
  }

  // keep active state
  if (isBorderTimer) {
    selectedTimer.classList.add('is-active');
  } else {
    showContainer(selectedTimer);
  }
}

function getTimerHostContainer(container) {
  if (!container) return null;
  return container.querySelector?.('.main-image-container') || container;
}

function ensureTimerElementForContainer(container, { variant = 'border' } = {}) {
  const hostContainer = getTimerHostContainer(container);
  if (!hostContainer) return null;

  let timerElement = hostContainer.querySelector(':scope > .timer-wrapper');
  if (!timerElement) {
    AddTimerToContainer(hostContainer, { variant });
    timerElement = hostContainer.querySelector(':scope > .timer-wrapper');
  }

  return timerElement;
}

function startTimerFromContainer({
  container = null,
  timeLeft = 0,
  duration = 0,
  variant = 'border',
  maxAttempts = 20
}) {
  if (!container) return;

  let attempts = 0;

  function tryStart() {
    const selectedTimer = ensureTimerElementForContainer(container, { variant });
    if (selectedTimer) {
      startTimer({ timeLeft, duration, selectedTimer });
      return;
    }

    attempts += 1;
    if (attempts < maxAttempts) {
      requestAnimationFrame(tryStart);
    }
  }

  tryStart();
}

function createCancelableTimeout(ms) {
  let timeoutId;
  let isFinished = false;

  const promise = new Promise((resolve) => {
    timeoutId = setTimeout(() => {
      isFinished = true;
      resolve();
    }, ms);
  });

  return {
    promise,
    cancel: () => {
      if (!isFinished && timeoutId != null) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    }
  };
}

async function SetTimeOut({
  delay = 0,
  instruction = null,
  nextDelay = null,
  clearIcons = false,
  newUserConfirmed = null,
  newUserReady = null,
  newUserVotes = null
}) {
  // only host schedules timeouts
  if (deviceId != hostDeviceId || delay == null) return;

  if (timeout?.cancel) {
    timeout.cancel();
  }
  timeout = createCancelableTimeout(delay);

  try {
    await timeout.promise;

    if (clearIcons) {
      ClearIcons();
    }

    const timerValue =
      nextDelay != null
        ? Date.now() + nextDelay
        : null;

    await SendInstruction({
      instruction: instruction,
      partyData: currentPartyData,
      timer: timerValue,
      updateUsersConfirmation: newUserConfirmed,
      updateUsersReady: newUserReady,
      updateUsersVote: newUserVotes
    });
  } catch (err) {
    // we no longer reject on cancel, so this is just a safety guard
    console.error('SetTimeOut error:', err);
  }
}

function cancelPlayerTimeout() {
  if (playerTimeOut?.cancel) playerTimeOut.cancel();
}

function AddTimerToContainer(selectContainer, { variant = 'border' } = {}) {
  if (!selectContainer) return;
  const hasDirectTimer = Array.from(selectContainer.children).some(
    child => child.classList?.contains('timer-wrapper')
  );
  if (hasDirectTimer) return;

  const timerWrapper = document.createElement('div');
  timerWrapper.dataset.timerVariant = variant;

  if (variant === 'legacy') {
    timerWrapper.className = 'timer-wrapper small';

    const timer = document.createElement('div');
    timer.className = 'timer';

    const mask = document.createElement('div');
    mask.className = 'mask';

    timer.appendChild(mask);
    timerWrapper.appendChild(timer);
    selectContainer.appendChild(timerWrapper);
    return;
  }

  timerWrapper.className = 'timer-wrapper border-timer';

  if (selectContainer.classList?.contains('main-image-container')) {
    timerWrapper.dataset.timerHost = 'svg-card';
    selectContainer.appendChild(timerWrapper);
    return;
  }

  timerWrapper.classList.add('container-shape');
  selectContainer.classList.add('has-border-timer');

  const firstChild = selectContainer.firstElementChild;
  if (firstChild) {
    selectContainer.insertBefore(timerWrapper, firstChild);
  } else {
    selectContainer.appendChild(timerWrapper);
  }
}
