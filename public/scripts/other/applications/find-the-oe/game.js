(() => {
  const modules = window.Error404FindTheOeModules = window.Error404FindTheOeModules || {};

  function createFindTheOeGame({ mount } = {}) {
    if (!mount) return null;

    return modules.loadCustomisationSlots()
      .then((slots) => {
        let target = null;
        let preparedRoundLayout = null;
        let score = 0;
        let roundTimer = null;
        let introTimer = null;
        let inputMode = window.matchMedia?.('(pointer: coarse)')?.matches
          ? 'tap'
          : 'click';

        mount.dataset.applicationReady = 'true';
        mount.classList.add('find-the-oe');
        modules.preloadSlotImages(slots);
        mount.addEventListener('pointerdown', (event) => {
          inputMode = event.pointerType === 'touch' ? 'tap' : 'click';
          mount.dataset.inputMode = inputMode;
        });
        mount.dataset.inputMode = inputMode;

        function clearTimers() {
          clearTimeout(introTimer);
          clearInterval(introTimer);
          clearInterval(roundTimer);
          introTimer = null;
          roundTimer = null;
        }

        function isGameWindowVisible() {
          const windowElement = mount.closest('.monitor-os-window');
          if (!windowElement) return true;

          return !windowElement.hidden && !windowElement.classList.contains('is-closed');
        }

        function startWhenVisible() {
          if (isGameWindowVisible()) {
            showStartScreen();
            return;
          }

          const windowElement = mount.closest('.monitor-os-window');
          if (!windowElement) return;

          const observer = new MutationObserver(() => {
            if (!isGameWindowVisible()) return;

            observer.disconnect();
            showStartScreen();
          });

          observer.observe(windowElement, {
            attributes: true,
            attributeFilter: ['class', 'hidden']
          });
        }

        function createTimerBar(className = '') {
          const timer = modules.createElement(
            'div',
            `find-the-oe-timer ${className}`.trim()
          );
          const fill = modules.createElement('div', 'find-the-oe-timer-fill');

          timer.appendChild(fill);
          return timer;
        }

        function updateTimerBar(timerBar, progress) {
          const fill = timerBar.querySelector('.find-the-oe-timer-fill');
          if (fill) fill.style.transform = `scaleX(${Math.max(0, Math.min(progress, 1))})`;
        }

        function showStartScreen() {
          clearTimers();
          score = 0;
          target = null;
          preparedRoundLayout = null;
          mount.replaceChildren();

          const screen = modules.createElement(
            'section',
            'find-the-oe-screen find-the-oe-start'
          );
          const startButton = modules.createButton(
            'find-the-oe-start-button',
            inputMode === 'tap' ? 'Tap to start' : 'Click to start'
          );
          const instructions = modules.createElement(
            'span',
            'find-the-oe-start-instructions',
            `AN OE WILL BE DISPLAYED. YOUR JOB IS TO MEMORISE IT. AFTER ${modules.TARGET_PREVIEW_DURATION_SECONDS} SECONDS, A GROUP OF OES WILL BE DISPLAYED. SELECT THE MATCHING OE TO ADVANCE.`
          );
          const startText = modules.createElement(
            'span',
            'find-the-oe-start-text',
            inputMode === 'tap' ? 'TAP TO START' : 'CLICK TO START'
          );

          function startFromKeyboard(event) {
            if (event.key !== 'Enter' && event.key !== ' ') return;

            event.preventDefault();
            showIntro();
          }

          startButton.append(instructions, startText);
          screen.addEventListener('click', showIntro, { once: true });
          screen.addEventListener('keydown', startFromKeyboard);
          screen.appendChild(startButton);
          mount.appendChild(screen);
        }

        function showIntro() {
          clearTimers();
          target = modules.createRandomCustomisation(slots);
          preparedRoundLayout = modules.createPositionedPieces({
            count: modules.getRoundRowSize(score),
            target,
            slots,
            score
          });
          modules.preloadCustomisation(target);
          modules.preloadRoundLayout(preparedRoundLayout);
          mount.replaceChildren();

          const screen = modules.createElement(
            'section',
            'find-the-oe-screen find-the-oe-intro'
          );
          const timerBar = createTimerBar('intro');
          const introContent = modules.createElement(
            'div',
            'find-the-oe-intro-content'
          );
          const targetStack = modules.createImageStack(target, 'target');
          const callout = modules.createFindTheOeCallout();
          const targetPreviewDurationMs = modules.TARGET_PREVIEW_DURATION_SECONDS * 1000;
          const endAt = performance.now() + targetPreviewDurationMs;

          function skipIntro() {
            startRound();
          }

          introContent.appendChild(targetStack);
          screen.append(timerBar, introContent, callout);
          screen.addEventListener('click', skipIntro, { once: true });
          mount.appendChild(screen);
          introTimer = setInterval(() => {
            const msLeft = Math.max(0, endAt - performance.now());
            const secondsLeft = Math.ceil(msLeft / 1000);
            updateTimerBar(timerBar, msLeft / targetPreviewDurationMs);

            if (secondsLeft <= 0) startRound();
          }, modules.TIMER_TICK_MS);
        }

        function startRound() {
          clearTimers();
          mount.replaceChildren();

          const screen = modules.createElement(
            'section',
            'find-the-oe-screen find-the-oe-round'
          );
          const timerBar = createTimerBar();
          const arena = modules.createElement('div', 'find-the-oe-arena');
          const roundLayout = preparedRoundLayout || modules.createPositionedPieces({
            count: modules.getRoundRowSize(score),
            target,
            slots,
            score
          });
          const endAt = performance.now() + modules.ROUND_DURATION_SECONDS * 1000;

          preparedRoundLayout = null;
          arena.style.setProperty('--find-the-oe-row-size', String(roundLayout.rowSize));
          roundLayout.pieces.forEach((piece) => {
            const button = modules.createButton(
              'find-the-oe-piece',
              piece.isTarget ? 'Target OE' : 'Incorrect OE'
            );
            button.style.setProperty('--oe-size', `${piece.size}px`);
            button.appendChild(modules.createImageStack(piece.customisation));
            button.addEventListener('click', () => {
              if (piece.isTarget) {
                score += 1;
                showIntro();
                return;
              }

              showGameOver();
            });
            arena.appendChild(button);
          });

          screen.append(timerBar, arena);
          mount.appendChild(screen);
          roundTimer = setInterval(() => {
            const msLeft = Math.max(0, endAt - performance.now());
            const secondsLeft = Math.ceil(msLeft / 1000);
            updateTimerBar(timerBar, msLeft / (modules.ROUND_DURATION_SECONDS * 1000));

            if (secondsLeft <= 0) showGameOver();
          }, modules.TIMER_TICK_MS);
        }

        function showGameOver() {
          clearTimers();
          mount.replaceChildren();

          const screen = modules.createElement(
            'section',
            'find-the-oe-screen find-the-oe-game-over'
          );
          const scoreText = modules.createElement('p', 'find-the-oe-score', String(score));
          const replayText = modules.createElement(
            'p',
            'find-the-oe-replay',
            inputMode === 'tap' ? 'TAP TO PLAY AGAIN' : 'CLICK TO PLAY AGAIN'
          );

          screen.append(scoreText, replayText);
          screen.addEventListener('click', () => {
            score = 0;
            showIntro();
          }, { once: true });
          mount.appendChild(screen);
        }

        startWhenVisible();

        return {
          id: modules.APPLICATION_ID,
          mount,
          destroy: clearTimers
        };
      })
      .catch((error) => {
        mount.dataset.applicationReady = 'error';
        mount.classList.add('find-the-oe');
        mount.replaceChildren(
          modules.createElement('p', 'find-the-oe-error', 'Unable to load Find The OE.')
        );
        console.error('Find The OE failed to initialise:', error);
        return { id: modules.APPLICATION_ID, mount };
      });
  }

  modules.createFindTheOeGame = createFindTheOeGame;
})();
