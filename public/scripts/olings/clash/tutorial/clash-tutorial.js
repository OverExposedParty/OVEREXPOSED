(function () {
  const tutorialPath = /^\/olings\/clash\/tutorial\/?$/i;
  if (!tutorialPath.test(window.location.pathname)) return;

  const STORAGE_KEY = 'oe-oling-clash-tutorial-version';
  const TUTORIAL_VERSION = '1';
  const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';
  const DEFAULT_GAMEPLAY = Object.freeze({
    abilityEffects: false,
    abilityInformation: false
  });
  const FIRST_DAMAGE_COUNTER_HOLD_DELAY_MS = 250;
  const FIRST_DAMAGE_AUDIO_WINDOW_MS = 600;
  let tutorial = null;
  let removeActionDiagram = null;
  let removeActionTypeAnnotations = null;
  let removeAbilityInformationLesson = null;
  let removeAbilityRevealLesson = null;
  let removeDrawAbilityEffectsLesson = null;
  let removeDrawResultLesson = null;
  let removeGuidedRoundStep = null;
  let removeGuidedTagStep = null;
  let removeOpponentTagLesson = null;
  let removeScriptedResultLesson = null;
  let removeResultLesson = null;
  let removeRoundLayoutLesson = null;
  let guidedAbilitySelected = false;
  let guidedActionConfirmed = false;
  let guidedDrawAbilitySelected = false;
  let guidedDrawActionConfirmed = false;
  let guidedTagSelected = false;
  let guidedAbilityDrawConfirmed = false;
  let guidedOvergrowthHitConfirmed = false;
  let guidedPebbleRoundConfirmed = false;
  let guidedPebbleTagSelected = false;
  let guidedShieldHitConfirmed = false;
  let guidedWildGrowthConfirmed = false;
  let guidedWildGrowthSelected = false;
  const { getAnchor, getArrowHeadPath, getCurveGeometry } =
    window.OlingClashTutorialDiagram;

  function showDrawResultLesson(currentTutorial) {
    removeDrawResultLesson?.();
    const root = currentTutorial?.root;
    const gameRoot = document.querySelector('[data-clash-game]');
    const backdrop = document.querySelector('[data-oe-tutorial-backdrop]');
    const targetLayer = root?.querySelector('[data-oe-tutorial-target]');
    const dialogue = root?.querySelector('[data-oe-tutorial-dialogue]');
    const title = root?.querySelector('[data-oe-tutorial-title]');
    const copy = root?.querySelector('[data-oe-tutorial-copy]');
    const next = root?.querySelector('[data-oe-tutorial-next]');
    if (!root || !gameRoot) return;

    let drawTimer = null;
    let drawShown = false;
    let heldLastStand = null;
    let heldOpponentDamage = null;

    if (backdrop) backdrop.hidden = true;
    if (targetLayer) targetLayer.style.visibility = 'hidden';
    if (dialogue) dialogue.style.visibility = 'hidden';

    function explainDraw(event) {
      if (drawShown || event.detail?.result?.winner !== 'draw') return;
      drawShown = true;
      window.OlingClashGame?.pauseTutorial?.();
      drawTimer = window.setTimeout(() => {
        heldLastStand =
          window.OlingClashGame?.damageFeedback?.holdLatest?.(gameRoot, {
            lastStand: true,
            side: 'local'
          }) || null;
        heldOpponentDamage =
          window.OlingClashGame?.damageFeedback?.holdLatest?.(gameRoot, {
            layer: 'hearts',
            side: 'opponent'
          }) || null;
        window.OlingClashGame?.combatMotion?.hold?.(gameRoot);
        gameRoot.classList.add('is-tutorial-draw-result-lesson');
        if (backdrop) backdrop.hidden = false;
        if (targetLayer) targetLayer.style.removeProperty('visibility');
        dialogue?.style.removeProperty('visibility');
        if (title) title.textContent = 'A Draw damages both Olings';
        if (copy) {
          copy.textContent =
            'Matching types cause a Draw, so both Olings take half a Heart of damage. The enemy lost half a Heart. Pebble was already on half a Heart, so Last Stand prevented Draw damage from defeating it. Last Stand does not protect against a decisive loss.';
        }
        if (next) {
          next.textContent = 'Got it';
          next.hidden = false;
        }
        currentTutorial.refreshTarget?.();
      }, 250);
    }

    gameRoot.addEventListener(
      'olings-clash:tutorial-round-result',
      explainDraw
    );

    removeDrawResultLesson = () => {
      if (drawTimer !== null) window.clearTimeout(drawTimer);
      gameRoot.removeEventListener(
        'olings-clash:tutorial-round-result',
        explainDraw
      );
      gameRoot.classList.remove('is-tutorial-draw-result-lesson');
      targetLayer?.style.removeProperty('visibility');
      dialogue?.style.removeProperty('visibility');
      window.OlingClashGame?.damageFeedback?.releaseHeld?.(heldLastStand);
      window.OlingClashGame?.damageFeedback?.releaseHeld?.(heldOpponentDamage);
      window.OlingClashGame?.combatMotion?.release?.(gameRoot);
      removeDrawResultLesson = null;
    };
  }

  function restrictTutorialTagTo(name, restricted) {
    document
      .querySelectorAll('[data-clash-game] [data-clash-tag-button]')
      .forEach((button) => {
        const olingName = String(
          button
            .closest('[data-clash-roster-slot]')
            ?.querySelector('.olings-clash-roster-slot__status > strong')
            ?.textContent || ''
        ).trim();
        if (
          olingName.toLowerCase() === String(name).toLowerCase() ||
          (!olingName && button.dataset.teamSlot === '1')
        ) {
          return;
        }
        button.disabled = Boolean(restricted);
      });
  }

  function showFirstResultLesson(currentTutorial) {
    removeResultLesson?.();
    const root = currentTutorial?.root;
    const gameRoot = document.querySelector('[data-clash-game]');
    const backdrop = document.querySelector('[data-oe-tutorial-backdrop]');
    const targetLayer = root?.querySelector('[data-oe-tutorial-target]');
    const title = root?.querySelector('[data-oe-tutorial-title]');
    const copy = root?.querySelector('[data-oe-tutorial-copy]');
    const next = root?.querySelector('[data-oe-tutorial-next]');
    if (!root || !gameRoot) return;

    let counterHoldTimer = null;
    let resultTimer = null;
    let heldDamageBurst = null;
    let resultShown = false;

    if (backdrop) backdrop.hidden = true;
    if (targetLayer) targetLayer.style.visibility = 'hidden';

    function revealExplanation() {
      if (resultShown) return;
      resultShown = true;

      counterHoldTimer = window.setTimeout(() => {
        heldDamageBurst =
          window.OlingClashGame?.damageFeedback?.holdLatest?.(gameRoot, {
            layer: 'hearts',
            side: 'opponent'
          }) || null;
      }, FIRST_DAMAGE_COUNTER_HOLD_DELAY_MS);

      resultTimer = window.setTimeout(() => {
        window.OlingClashGame?.pauseTutorial?.();
        window.OlingClashGame?.combatMotion?.hold?.(gameRoot);
        if (backdrop) backdrop.hidden = false;
        if (targetLayer) targetLayer.style.removeProperty('visibility');
        gameRoot.classList.add('is-tutorial-result-lesson');
        if (title) title.textContent = 'Damage removes hearts';
        if (copy) {
          copy.textContent =
            'The red -1 shows that your winning ability removed one full normal heart from the enemy Oling.';
        }
        if (next) {
          next.textContent = 'Got it';
          next.hidden = false;
        }
        currentTutorial.refreshTarget?.();
      }, FIRST_DAMAGE_AUDIO_WINDOW_MS);
    }

    gameRoot.addEventListener(
      'olings-clash:tutorial-round-result',
      revealExplanation,
      { once: true }
    );

    removeResultLesson = () => {
      if (counterHoldTimer !== null) window.clearTimeout(counterHoldTimer);
      if (resultTimer !== null) window.clearTimeout(resultTimer);
      gameRoot.removeEventListener(
        'olings-clash:tutorial-round-result',
        revealExplanation
      );
      gameRoot.classList.remove('is-tutorial-result-lesson');
      targetLayer?.style.removeProperty('visibility');
      window.OlingClashGame?.damageFeedback?.releaseHeld?.(heldDamageBurst);
      window.OlingClashGame?.combatMotion?.release?.(gameRoot);
      removeResultLesson = null;
    };
  }

  function showAbilityRevealLesson(currentTutorial) {
    removeAbilityRevealLesson?.();
    const root = currentTutorial?.root;
    const gameRoot = document.querySelector('[data-clash-game]');
    const backdrop = document.querySelector('[data-oe-tutorial-backdrop]');
    const targetLayer = root?.querySelector('[data-oe-tutorial-target]');
    const dialogue = root?.querySelector('[data-oe-tutorial-dialogue]');
    const title = root?.querySelector('[data-oe-tutorial-title]');
    const copy = root?.querySelector('[data-oe-tutorial-copy]');
    const next = root?.querySelector('[data-oe-tutorial-next]');
    if (!root || !gameRoot) return;

    let revealReady = false;
    let explanationShown = false;
    let revealAnimationTimer = null;
    let revealContainer = null;
    let revealCards = [];
    const completedRevealCards = new Set();
    let revealDetail = {};
    let resumeRevealPlayback = null;
    if (backdrop) backdrop.hidden = true;
    if (targetLayer) targetLayer.style.visibility = 'hidden';
    if (dialogue) dialogue.style.visibility = 'hidden';

    function showRevealExplanation() {
      if (explanationShown) return;
      explanationShown = true;
      if (revealAnimationTimer !== null) {
        window.clearTimeout(revealAnimationTimer);
        revealAnimationTimer = null;
      }
      revealContainer?.removeEventListener(
        'animationend',
        handleRevealAnimationEnd
      );
      window.OlingClashGame?.pauseTutorial?.();
      window.OlingClashGame?.combatMotion?.hold?.(gameRoot);
      gameRoot.classList.add('is-tutorial-ability-reveal-lesson');
      const localCard = gameRoot.querySelector(
        '[data-clash-revealed-ability="local"]'
      );
      const opponentCard = gameRoot.querySelector(
        '[data-clash-revealed-ability="opponent"]'
      );
      const localAbility = String(
        localCard?.querySelector('[data-clash-revealed-ability-name]')
          ?.textContent || 'Your ability'
      ).trim();
      const opponentAbility = String(
        opponentCard?.querySelector('[data-clash-revealed-ability-name]')
          ?.textContent || 'the enemy ability'
      ).trim();
      const localAction = String(
        revealDetail.localAction ||
          localCard?.querySelector('[data-clash-revealed-action]')
            ?.textContent ||
          'your type'
      ).toUpperCase();
      const opponentAction = String(
        revealDetail.opponentAction ||
          opponentCard?.querySelector('[data-clash-revealed-action]')
            ?.textContent ||
          'the enemy type'
      ).toUpperCase();

      if (backdrop) backdrop.hidden = false;
      if (targetLayer) targetLayer.style.removeProperty('visibility');
      dialogue?.style.removeProperty('visibility');
      if (title) title.textContent = 'Read the round result';
      if (copy) {
        copy.textContent = `The left card is your ${localAbility} ability, and the right card is the enemy’s ${opponentAbility} ability. The labels underneath show their types. ${localAction} beats ${opponentAction}, so your ability wins this round.`;
      }
      if (next) {
        next.textContent = 'Got it';
        next.hidden = false;
      }
      currentTutorial.refreshTarget?.();
    }

    function handleRevealAnimationEnd(event) {
      if (!revealCards.includes(event.target)) return;
      completedRevealCards.add(event.target);
      if (completedRevealCards.size === revealCards.length) {
        showRevealExplanation();
      }
    }

    function explainReveal(event = {}) {
      if (revealReady) return;
      revealReady = true;
      event.preventDefault?.();
      revealDetail = event.detail || {};
      resumeRevealPlayback = revealDetail.resumeRevealPlayback || null;
      revealContainer = gameRoot.querySelector('[data-clash-ability-reveal]');
      revealCards = revealContainer
        ? [...revealContainer.querySelectorAll('[data-clash-revealed-ability]')]
        : [];

      if (!revealContainer || revealCards.length === 0) {
        showRevealExplanation();
        return;
      }

      revealContainer.addEventListener(
        'animationend',
        handleRevealAnimationEnd
      );
      revealAnimationTimer = window.setTimeout(showRevealExplanation, 450);
    }

    gameRoot.addEventListener(
      'olings-clash:tutorial-abilities-revealed',
      explainReveal
    );
    if (window.OlingClashGame?.state?.phase === 'reveal') explainReveal();

    removeAbilityRevealLesson = () => {
      if (revealAnimationTimer !== null) {
        window.clearTimeout(revealAnimationTimer);
      }
      revealContainer?.removeEventListener(
        'animationend',
        handleRevealAnimationEnd
      );
      gameRoot.removeEventListener(
        'olings-clash:tutorial-abilities-revealed',
        explainReveal
      );
      targetLayer?.style.removeProperty('visibility');
      dialogue?.style.removeProperty('visibility');
      gameRoot.classList.remove('is-tutorial-ability-reveal-lesson');
      if (explanationShown) {
        window.OlingClashGame?.combatMotion?.release?.(gameRoot);
      }
      resumeRevealPlayback?.();
      resumeRevealPlayback = null;
      removeAbilityRevealLesson = null;
    };
  }

  function showRoundLayoutLesson(currentTutorial) {
    removeRoundLayoutLesson?.();
    const root = currentTutorial?.root;
    const gameRoot = document.querySelector('[data-clash-game]');
    const backdrop = document.querySelector('[data-oe-tutorial-backdrop]');
    const targetLayer = root?.querySelector('[data-oe-tutorial-target]');
    const dialogue = root?.querySelector('[data-oe-tutorial-dialogue]');
    const next = root?.querySelector('[data-oe-tutorial-next]');
    if (!root || !gameRoot) return;

    let layoutReady = false;
    if (backdrop) backdrop.hidden = true;
    if (targetLayer) targetLayer.style.visibility = 'hidden';
    if (dialogue) dialogue.style.visibility = 'hidden';

    function showLayout() {
      if (layoutReady) return;
      layoutReady = true;
      window.OlingClashGame?.pauseTutorial?.();
      if (backdrop) backdrop.hidden = false;
      if (targetLayer) targetLayer.style.removeProperty('visibility');
      dialogue?.style.removeProperty('visibility');
      if (next) {
        next.textContent = 'Got it';
        next.hidden = false;
      }
      currentTutorial.refreshTarget?.();
    }

    function handlePhase(event) {
      if (event.detail?.phase === 'choose-action') showLayout();
    }

    gameRoot.addEventListener('olings-clash:tutorial-phase', handlePhase);
    if (window.OlingClashGame?.state?.phase === 'choose-action') showLayout();

    removeRoundLayoutLesson = () => {
      gameRoot.removeEventListener('olings-clash:tutorial-phase', handlePhase);
      targetLayer?.style.removeProperty('visibility');
      dialogue?.style.removeProperty('visibility');
      removeRoundLayoutLesson = null;
    };
  }

  function waitForActionPanelSlide(gameRoot, onFinish) {
    const actionPanel = gameRoot?.querySelector('[data-clash-actions]');
    if (!actionPanel) {
      onFinish();
      return null;
    }

    let finished = false;
    let fallbackTimer = null;
    const transitionStyle = window.getComputedStyle(actionPanel);
    const durations = transitionStyle.transitionDuration
      .split(',')
      .map((value) => value.trim())
      .map((value) =>
        value.endsWith('ms')
          ? Number.parseFloat(value)
          : Number.parseFloat(value) * 1000
      );
    const delays = transitionStyle.transitionDelay
      .split(',')
      .map((value) => value.trim())
      .map((value) =>
        value.endsWith('ms')
          ? Number.parseFloat(value)
          : Number.parseFloat(value) * 1000
      );
    const transitionTime = Math.max(
      0,
      ...durations.map(
        (duration, index) =>
          (Number.isFinite(duration) ? duration : 0) +
          (Number.isFinite(delays[index % Math.max(delays.length, 1)])
            ? delays[index % Math.max(delays.length, 1)]
            : 0)
      )
    );

    function finish() {
      if (finished) return;
      finished = true;
      actionPanel.removeEventListener('transitionend', handleTransitionEnd);
      if (fallbackTimer !== null) window.clearTimeout(fallbackTimer);
      onFinish();
    }

    function handleTransitionEnd(event) {
      if (event.target === actionPanel && event.propertyName === 'transform') {
        finish();
      }
    }

    if (transitionTime <= 0) {
      finish();
      return null;
    }

    actionPanel.addEventListener('transitionend', handleTransitionEnd);
    fallbackTimer = window.setTimeout(finish, transitionTime + 80);
    return () => {
      finished = true;
      actionPanel.removeEventListener('transitionend', handleTransitionEnd);
      if (fallbackTimer !== null) window.clearTimeout(fallbackTimer);
    };
  }

  function releaseActionStackingWhenChoosing() {
    return window.OlingClashGame?.state?.phase === 'choose-action'
      ? document.querySelector('[data-clash-actions]')
      : null;
  }

  function showAbilityInformationLesson(currentTutorial) {
    removeAbilityInformationLesson?.();
    const root = currentTutorial?.root;
    const gameRoot = document.querySelector('[data-clash-game]');
    const backdrop = document.querySelector('[data-oe-tutorial-backdrop]');
    const targetLayer = root?.querySelector('[data-oe-tutorial-target]');
    const dialogue = root?.querySelector('[data-oe-tutorial-dialogue]');
    const title = root?.querySelector('[data-oe-tutorial-title]');
    const copy = root?.querySelector('[data-oe-tutorial-copy]');
    if (!root || !gameRoot) return;

    let inspectionStarting = false;
    let inspectionReady = false;
    let inspectionAdvanceTimer = null;
    let cancelActionPanelWait = null;
    const inspectedActions = new Set();
    if (backdrop) backdrop.hidden = true;
    if (targetLayer) targetLayer.style.visibility = 'hidden';
    if (dialogue) dialogue.style.visibility = 'hidden';

    function finishInspectionStart() {
      if (inspectionReady) return;
      inspectionReady = true;
      currentTutorial.refreshPresentation?.();
      window.OlingClashGame?.setTutorialActionInput?.(true);
      if (backdrop) backdrop.hidden = false;
      if (targetLayer) targetLayer.style.removeProperty('visibility');
      dialogue?.style.removeProperty('visibility');
      if (title) title.textContent = 'Inspect every ability (0/3)';
      if (copy) {
        copy.textContent =
          'Attack, Guard, and Skill determine what an ability beats. Select any ability to inspect its unique effect.';
      }
      currentTutorial.refreshTarget?.();
    }

    function beginInspection() {
      if (inspectionStarting || inspectionReady) return;
      inspectionStarting = true;
      window.OlingClashGame?.pauseTutorial?.();
      cancelActionPanelWait = waitForActionPanelSlide(
        gameRoot,
        finishInspectionStart
      );
    }

    function handlePhase(event) {
      if (event.detail?.phase === 'choose-action') beginInspection();
    }

    function handleAbilityClick(event) {
      if (!inspectionReady) return;
      const button = event.target.closest?.(
        '[data-clash-action="attack"], [data-clash-action="guard"], [data-clash-action="skill"]'
      );
      if (!button || button.disabled) return;
      const action = String(button.dataset.clashAction || '').toUpperCase();
      inspectedActions.add(action.toLowerCase());
      const ability = String(
        button.querySelector('[data-clash-move-name]')?.textContent || 'ABILITY'
      ).trim();
      if (title) {
        title.textContent = `${ability} has a unique effect (${inspectedActions.size}/3)`;
      }
      if (copy) {
        copy.textContent =
          inspectedActions.size === 3
            ? `${action} determines what this ability beats. You have now inspected the additional effects of all three abilities.`
            : `${action} determines what this ability beats. The information panel explains ${ability}'s additional effect and when it activates. Select each remaining ability to compare them.`;
      }
      currentTutorial.refreshTarget?.();
      if (inspectedActions.size === 3 && inspectionAdvanceTimer === null) {
        inspectionAdvanceTimer = window.setTimeout(
          () => currentTutorial.advance?.(),
          300
        );
      }
    }

    gameRoot.addEventListener('olings-clash:tutorial-phase', handlePhase);
    gameRoot.addEventListener('click', handleAbilityClick);
    if (window.OlingClashGame?.state?.phase === 'choose-action') {
      beginInspection();
    }

    removeAbilityInformationLesson = () => {
      cancelActionPanelWait?.();
      if (inspectionAdvanceTimer !== null) {
        window.clearTimeout(inspectionAdvanceTimer);
      }
      gameRoot.removeEventListener('olings-clash:tutorial-phase', handlePhase);
      gameRoot.removeEventListener('click', handleAbilityClick);
      targetLayer?.style.removeProperty('visibility');
      dialogue?.style.removeProperty('visibility');
      window.OlingClashGame?.setTutorialActionInput?.(false);
      removeAbilityInformationLesson = null;
    };
  }

  function showDrawAbilityEffectsLesson(currentTutorial) {
    removeDrawAbilityEffectsLesson?.();
    const root = currentTutorial?.root;
    const gameRoot = document.querySelector('[data-clash-game]');
    const backdrop = document.querySelector('[data-oe-tutorial-backdrop]');
    const targetLayer = root?.querySelector('[data-oe-tutorial-target]');
    const dialogue = root?.querySelector('[data-oe-tutorial-dialogue]');
    const title = root?.querySelector('[data-oe-tutorial-title]');
    const copy = root?.querySelector('[data-oe-tutorial-copy]');
    const next = root?.querySelector('[data-oe-tutorial-next]');
    if (!root || !gameRoot) return;

    let explanationShown = false;
    let explanationTimer = null;
    if (backdrop) backdrop.hidden = true;
    if (targetLayer) targetLayer.style.visibility = 'hidden';
    if (dialogue) dialogue.style.visibility = 'hidden';

    function showExplanation(event) {
      if (explanationShown || event.detail?.result?.winner !== 'draw') return;
      explanationShown = true;
      explanationTimer = window.setTimeout(() => {
        window.OlingClashGame?.pauseTutorial?.();
        window.OlingClashGame?.combatMotion?.hold?.(gameRoot);
        gameRoot.classList.add('is-tutorial-ability-reveal-lesson');

        const localAbility = String(
          gameRoot.querySelector(
            '[data-clash-revealed-ability="local"] [data-clash-revealed-ability-name]'
          )?.textContent || 'your Draw ability'
        ).trim();
        const opponentAbility = String(
          gameRoot.querySelector(
            '[data-clash-revealed-ability="opponent"] [data-clash-revealed-ability-name]'
          )?.textContent || 'the enemy Draw ability'
        ).trim();

        if (backdrop) backdrop.hidden = false;
        if (targetLayer) targetLayer.style.removeProperty('visibility');
        dialogue?.style.removeProperty('visibility');
        if (title) {
          title.textContent = `Draw activates ${localAbility} and ${opponentAbility}`;
        }
        if (copy) {
          copy.textContent = `When both Olings choose the same type, the round is a Draw. Your ${localAbility} and the enemy\u2019s ${opponentAbility} activate together, so both effects resolve.`;
        }
        if (next) {
          next.textContent = 'Got it';
          next.hidden = false;
        }
        currentTutorial.refreshTarget?.();
      }, 250);
    }

    gameRoot.addEventListener(
      'olings-clash:tutorial-round-result',
      showExplanation
    );

    removeDrawAbilityEffectsLesson = () => {
      if (explanationTimer !== null) window.clearTimeout(explanationTimer);
      gameRoot.removeEventListener(
        'olings-clash:tutorial-round-result',
        showExplanation
      );
      gameRoot.classList.remove('is-tutorial-ability-reveal-lesson');
      targetLayer?.style.removeProperty('visibility');
      dialogue?.style.removeProperty('visibility');
      if (explanationShown) {
        window.OlingClashGame?.combatMotion?.release?.(gameRoot);
      }
      removeDrawAbilityEffectsLesson = null;
    };
  }

  function restrictTutorialActionsTo(allowedAction, restricted) {
    const gameRoot = document.querySelector('[data-clash-game]');
    if (!gameRoot) return;
    gameRoot.querySelectorAll('[data-clash-action]').forEach((button) => {
      const action = String(button.dataset.clashAction || '').toLowerCase();
      if (action === allowedAction) return;
      button.disabled = Boolean(restricted);
    });
  }

  function prepareGuidedRoundStep(currentTutorial, options = {}) {
    removeGuidedRoundStep?.();
    const root = currentTutorial?.root;
    const gameRoot = document.querySelector('[data-clash-game]');
    const backdrop = document.querySelector('[data-oe-tutorial-backdrop]');
    const targetLayer = root?.querySelector('[data-oe-tutorial-target]');
    const dialogue = root?.querySelector('[data-oe-tutorial-dialogue]');
    if (!root || !gameRoot) return;

    let starting = false;
    let ready = false;
    let cancelActionPanelWait = null;
    if (backdrop) backdrop.hidden = true;
    if (targetLayer) targetLayer.style.visibility = 'hidden';
    if (dialogue) dialogue.style.visibility = 'hidden';

    function finishChoiceStart() {
      if (ready) return;
      ready = true;
      currentTutorial.refreshPresentation?.();
      window.OlingClashGame?.setTutorialActionInput?.(true);
      if (options.allowedAction) {
        restrictTutorialActionsTo(options.allowedAction, true);
      }
      if (backdrop) backdrop.hidden = false;
      if (targetLayer) targetLayer.style.removeProperty('visibility');
      dialogue?.style.removeProperty('visibility');
      currentTutorial.refreshTarget?.();
    }

    function beginChoice() {
      if (starting || ready) return;
      starting = true;
      window.OlingClashGame?.pauseTutorial?.();
      cancelActionPanelWait = waitForActionPanelSlide(
        gameRoot,
        finishChoiceStart
      );
    }

    function handlePhase(event) {
      if (event.detail?.phase === 'choose-action') beginChoice();
    }

    gameRoot.addEventListener('olings-clash:tutorial-phase', handlePhase);
    if (window.OlingClashGame?.state?.phase === 'choose-action') beginChoice();

    removeGuidedRoundStep = () => {
      cancelActionPanelWait?.();
      gameRoot.removeEventListener('olings-clash:tutorial-phase', handlePhase);
      if (options.allowedAction) {
        restrictTutorialActionsTo(options.allowedAction, false);
      }
      targetLayer?.style.removeProperty('visibility');
      dialogue?.style.removeProperty('visibility');
      window.OlingClashGame?.setTutorialActionInput?.(false);
      removeGuidedRoundStep = null;
    };
  }

  function prepareGuidedTagStep(currentTutorial, options = {}) {
    removeGuidedTagStep?.();
    const root = currentTutorial?.root;
    const gameRoot = document.querySelector('[data-clash-game]');
    const backdrop = document.querySelector('[data-oe-tutorial-backdrop]');
    const targetLayer = root?.querySelector('[data-oe-tutorial-target]');
    const dialogue = root?.querySelector('[data-oe-tutorial-dialogue]');
    if (!root || !gameRoot) return;

    let ready = false;
    if (backdrop) backdrop.hidden = true;
    if (targetLayer) targetLayer.style.visibility = 'hidden';
    if (dialogue) dialogue.style.visibility = 'hidden';

    function beginChoice() {
      if (ready) return;
      ready = true;
      window.OlingClashGame?.pauseTutorial?.();
      window.OlingClashGame?.setTutorialTagInput?.(true);
      if (options.olingName) {
        restrictTutorialTagTo(options.olingName, true);
      }
      if (backdrop) backdrop.hidden = false;
      if (targetLayer) targetLayer.style.removeProperty('visibility');
      dialogue?.style.removeProperty('visibility');
      currentTutorial.refreshTarget?.();
    }

    function handlePhase(event) {
      if (event.detail?.phase === 'choose-action') beginChoice();
    }

    gameRoot.addEventListener('olings-clash:tutorial-phase', handlePhase);
    if (window.OlingClashGame?.state?.phase === 'choose-action') beginChoice();

    removeGuidedTagStep = () => {
      gameRoot.removeEventListener('olings-clash:tutorial-phase', handlePhase);
      if (options.olingName) {
        restrictTutorialTagTo(options.olingName, false);
      }
      targetLayer?.style.removeProperty('visibility');
      dialogue?.style.removeProperty('visibility');
      window.OlingClashGame?.setTutorialTagInput?.(false);
      removeGuidedTagStep = null;
    };
  }

  function showScriptedResultLesson(currentTutorial, options = {}) {
    removeScriptedResultLesson?.();
    const root = currentTutorial?.root;
    const gameRoot = document.querySelector('[data-clash-game]');
    const backdrop = document.querySelector('[data-oe-tutorial-backdrop]');
    const targetLayer = root?.querySelector('[data-oe-tutorial-target]');
    const dialogue = root?.querySelector('[data-oe-tutorial-dialogue]');
    const title = root?.querySelector('[data-oe-tutorial-title]');
    const copy = root?.querySelector('[data-oe-tutorial-copy]');
    const next = root?.querySelector('[data-oe-tutorial-next]');
    if (!root || !gameRoot) return;

    let heldDamage = null;
    let lessonTimer = null;
    let shown = false;
    if (backdrop) backdrop.hidden = true;
    if (targetLayer) targetLayer.style.visibility = 'hidden';
    if (dialogue) dialogue.style.visibility = 'hidden';

    function handleResult(event) {
      const result = event.detail?.result;
      if (shown || options.matches?.(result) === false) return;
      shown = true;
      lessonTimer = window.setTimeout(
        () => {
          window.OlingClashGame?.pauseTutorial?.();
          window.OlingClashGame?.combatMotion?.hold?.(gameRoot);
          if (options.damageLayer) {
            heldDamage =
              window.OlingClashGame?.damageFeedback?.holdLatest?.(gameRoot, {
                layer: options.damageLayer,
                side: options.damageSide || 'opponent'
              }) || null;
          }
          if (backdrop) backdrop.hidden = false;
          if (targetLayer) targetLayer.style.removeProperty('visibility');
          dialogue?.style.removeProperty('visibility');
          if (title) title.textContent = options.title || title.textContent;
          if (copy) copy.textContent = options.copy || copy.textContent;
          if (next) {
            next.textContent = 'Got it';
            next.hidden = false;
          }
          currentTutorial.refreshTarget?.();
        },
        Math.max(0, Number(options.delayMs) || 250)
      );
    }

    gameRoot.addEventListener(
      'olings-clash:tutorial-round-result',
      handleResult
    );

    removeScriptedResultLesson = () => {
      if (lessonTimer !== null) window.clearTimeout(lessonTimer);
      gameRoot.removeEventListener(
        'olings-clash:tutorial-round-result',
        handleResult
      );
      targetLayer?.style.removeProperty('visibility');
      dialogue?.style.removeProperty('visibility');
      window.OlingClashGame?.damageFeedback?.releaseHeld?.(heldDamage);
      if (shown) window.OlingClashGame?.combatMotion?.release?.(gameRoot);
      removeScriptedResultLesson = null;
    };
  }

  function showOpponentTagLesson(currentTutorial, options = {}) {
    removeOpponentTagLesson?.();
    const root = currentTutorial?.root;
    const gameRoot = document.querySelector('[data-clash-game]');
    const backdrop = document.querySelector('[data-oe-tutorial-backdrop]');
    const targetLayer = root?.querySelector('[data-oe-tutorial-target]');
    const dialogue = root?.querySelector('[data-oe-tutorial-dialogue]');
    const title = root?.querySelector('[data-oe-tutorial-title]');
    const copy = root?.querySelector('[data-oe-tutorial-copy]');
    const next = root?.querySelector('[data-oe-tutorial-next]');
    if (!root || !gameRoot) return;

    let shown = false;
    let tagTimer = null;
    if (backdrop) backdrop.hidden = true;
    if (targetLayer) targetLayer.style.visibility = 'hidden';
    if (dialogue) dialogue.style.visibility = 'hidden';

    function handlePhase(event) {
      if (shown || event.detail?.phase !== 'tagged') return;
      shown = true;
      tagTimer = window.setTimeout(
        () => {
          window.OlingClashGame?.pauseTutorial?.();
          if (backdrop) backdrop.hidden = false;
          if (targetLayer) targetLayer.style.removeProperty('visibility');
          dialogue?.style.removeProperty('visibility');
          if (title) title.textContent = options.title || title.textContent;
          if (copy) copy.textContent = options.copy || copy.textContent;
          if (next) {
            next.textContent = 'Got it';
            next.hidden = false;
          }
          currentTutorial.refreshTarget?.();
        },
        Math.max(0, Number(options.delayMs) || 1100)
      );
    }

    gameRoot.addEventListener('olings-clash:tutorial-phase', handlePhase);

    removeOpponentTagLesson = () => {
      if (tagTimer !== null) window.clearTimeout(tagTimer);
      gameRoot.removeEventListener('olings-clash:tutorial-phase', handlePhase);
      targetLayer?.style.removeProperty('visibility');
      dialogue?.style.removeProperty('visibility');
      removeOpponentTagLesson = null;
    };
  }

  function showActionDiagram(currentTutorial) {
    removeActionDiagram?.();
    const root = currentTutorial?.root;
    const attack = document.querySelector('[data-clash-action="attack"]');
    const guard = document.querySelector('[data-clash-action="guard"]');
    const skill = document.querySelector('[data-clash-action="skill"]');
    if (!root || !attack || !guard || !skill) return;

    const diagram = document.createElement('div');
    diagram.className = 'olings-clash-tutorial-action-diagram';
    diagram.setAttribute('aria-hidden', 'true');
    diagram.innerHTML = `
      <svg class="olings-clash-tutorial-action-canvas" aria-hidden="true">
        <g class="olings-clash-tutorial-action-arrow is-outer">
          <path class="olings-clash-tutorial-action-curve" pathLength="1"></path>
          <path class="olings-clash-tutorial-action-head" pathLength="1"></path>
          <circle class="olings-clash-tutorial-action-anchor is-from" r="4"></circle>
          <circle class="olings-clash-tutorial-action-anchor is-to" r="4"></circle>
        </g>
        <g class="olings-clash-tutorial-action-arrow is-guard">
          <path class="olings-clash-tutorial-action-curve" pathLength="1"></path>
          <path class="olings-clash-tutorial-action-head" pathLength="1"></path>
          <circle class="olings-clash-tutorial-action-anchor is-from" r="4"></circle>
          <circle class="olings-clash-tutorial-action-anchor is-to" r="4"></circle>
        </g>
        <g class="olings-clash-tutorial-action-arrow is-skill">
          <path class="olings-clash-tutorial-action-curve" pathLength="1"></path>
          <path class="olings-clash-tutorial-action-head" pathLength="1"></path>
          <circle class="olings-clash-tutorial-action-anchor is-from" r="4"></circle>
          <circle class="olings-clash-tutorial-action-anchor is-to" r="4"></circle>
        </g>
      </svg>
      <span class="olings-clash-tutorial-action-beats is-outer">BEATS</span>
      <span class="olings-clash-tutorial-action-beats is-guard">BEATS</span>
      <span class="olings-clash-tutorial-action-beats is-skill">BEATS</span>
      <span class="olings-clash-tutorial-action-type is-attack">ATTACK</span>
      <span class="olings-clash-tutorial-action-type is-guard">GUARD</span>
      <span class="olings-clash-tutorial-action-type is-skill">SKILL</span>
    `;
    root.appendChild(diagram);

    const canvas = diagram.querySelector(
      '.olings-clash-tutorial-action-canvas'
    );
    const arrowSpecs = [
      {
        className: 'is-outer',
        from: { element: attack, x: 0.22 },
        to: { element: skill, x: 0.78 },
        liftRatio: 1.4,
        minimumLift: 140,
        labelGap: 20
      },
      {
        className: 'is-guard',
        from: { element: guard, x: 0.5 },
        to: { element: attack, x: 0.5 },
        liftRatio: 0.58,
        minimumLift: 62,
        labelGap: 17
      },
      {
        className: 'is-skill',
        from: { element: skill, x: 0.5 },
        to: { element: guard, x: 0.5 },
        liftRatio: 0.58,
        minimumLift: 62,
        labelGap: 17
      }
    ].map((spec) => {
      const group = diagram.querySelector(
        `.olings-clash-tutorial-action-arrow.${spec.className}`
      );
      return {
        ...spec,
        curve: group?.querySelector('.olings-clash-tutorial-action-curve'),
        fromAnchor: group?.querySelector(
          '.olings-clash-tutorial-action-anchor.is-from'
        ),
        head: group?.querySelector('.olings-clash-tutorial-action-head'),
        label: diagram.querySelector(
          `.olings-clash-tutorial-action-beats.${spec.className}`
        ),
        toAnchor: group?.querySelector(
          '.olings-clash-tutorial-action-anchor.is-to'
        )
      };
    });
    const actionTypes = [
      { className: 'is-attack', element: attack },
      { className: 'is-guard', element: guard },
      { className: 'is-skill', element: skill }
    ].map((actionType) => ({
      ...actionType,
      label: diagram.querySelector(
        `.olings-clash-tutorial-action-type.${actionType.className}`
      )
    }));

    function placeLabel(element, left, top) {
      if (!element) return;
      element.style.left = `${left}px`;
      element.style.top = `${top}px`;
    }

    function refresh() {
      const attackRect = attack.getBoundingClientRect();
      const guardRect = guard.getBoundingClientRect();
      const skillRect = skill.getBoundingClientRect();
      const buttonSize = Math.max(
        attackRect.width,
        guardRect.width,
        skillRect.width
      );
      const typeLabelGap = Math.max(13, buttonSize * 0.11);
      const arrowClearance = Math.max(22, buttonSize * 0.18);
      const anchorOffset = -(typeLabelGap + arrowClearance);
      const headLength = Math.max(18, buttonSize * 0.16);
      const headWidth = Math.max(15, buttonSize * 0.13);

      canvas?.setAttribute(
        'viewBox',
        `0 0 ${window.innerWidth} ${window.innerHeight}`
      );

      arrowSpecs.forEach((spec) => {
        const from = getAnchor(spec.from.element, {
          offsetY: anchorOffset,
          x: spec.from.x
        });
        const to = getAnchor(spec.to.element, {
          offsetY: anchorOffset,
          x: spec.to.x
        });
        const lift = Math.max(spec.minimumLift, buttonSize * spec.liftRatio);
        const geometry = getCurveGeometry(from, to, lift);

        spec.curve?.setAttribute('d', geometry.d);
        spec.head?.setAttribute(
          'd',
          getArrowHeadPath(to, geometry.endControl, headLength, headWidth)
        );
        spec.fromAnchor?.setAttribute('cx', from.x);
        spec.fromAnchor?.setAttribute('cy', from.y);
        spec.toAnchor?.setAttribute('cx', to.x);
        spec.toAnchor?.setAttribute('cy', to.y);
        placeLabel(
          spec.label,
          geometry.midpoint.x,
          geometry.midpoint.y - spec.labelGap
        );
      });

      actionTypes.forEach(({ element, label }) => {
        const rect = element.getBoundingClientRect();
        placeLabel(label, rect.left + rect.width / 2, rect.top - typeLabelGap);
      });
    }

    const resizeObserver =
      typeof window.ResizeObserver === 'function'
        ? new window.ResizeObserver(refresh)
        : null;
    [attack, guard, skill].forEach((element) =>
      resizeObserver?.observe(element)
    );
    window.addEventListener('resize', refresh);
    refresh();
    const refreshFrame = window.requestAnimationFrame?.(refresh);
    removeActionDiagram = () => {
      if (refreshFrame !== undefined) {
        window.cancelAnimationFrame?.(refreshFrame);
      }
      resizeObserver?.disconnect();
      window.removeEventListener('resize', refresh);
      diagram.remove();
      removeActionDiagram = null;
    };
  }

  function showActionTypeAnnotations(currentTutorial) {
    removeActionTypeAnnotations?.();
    const root = currentTutorial?.root;
    const actionTypes = [
      { action: 'attack', label: 'ATTACK' },
      { action: 'guard', label: 'GUARD' },
      { action: 'skill', label: 'SKILL' }
    ].map((entry) => ({
      ...entry,
      element: document.querySelector(`[data-clash-action="${entry.action}"]`)
    }));
    if (!root || actionTypes.some(({ element }) => !element)) return;

    const annotations = document.createElement('div');
    annotations.className =
      'olings-clash-tutorial-action-diagram is-types-only';
    annotations.setAttribute('aria-hidden', 'true');
    annotations.innerHTML = actionTypes
      .map(
        ({ action, label }) =>
          `<span class="olings-clash-tutorial-action-type is-${action}">${label}</span>`
      )
      .join('');
    root.appendChild(annotations);

    actionTypes.forEach((entry) => {
      entry.annotation = annotations.querySelector(
        `.olings-clash-tutorial-action-type.is-${entry.action}`
      );
    });

    function refresh() {
      const buttonSize = Math.max(
        ...actionTypes.map(
          ({ element }) => element.getBoundingClientRect().width
        )
      );
      const labelGap = Math.max(13, buttonSize * 0.11);
      actionTypes.forEach(({ annotation, element }) => {
        const rect = element.getBoundingClientRect();
        annotation.style.left = `${rect.left + rect.width / 2}px`;
        annotation.style.top = `${rect.top - labelGap}px`;
      });
    }

    const resizeObserver =
      typeof window.ResizeObserver === 'function'
        ? new window.ResizeObserver(refresh)
        : null;
    actionTypes.forEach(({ element }) => resizeObserver?.observe(element));
    window.addEventListener('resize', refresh);
    refresh();
    const refreshFrame = window.requestAnimationFrame?.(refresh);
    removeActionTypeAnnotations = () => {
      if (refreshFrame !== undefined) {
        window.cancelAnimationFrame?.(refreshFrame);
      }
      resizeObserver?.disconnect();
      window.removeEventListener('resize', refresh);
      annotations.remove();
      removeActionTypeAnnotations = null;
    };
  }

  function getLocalTeamBounds() {
    const roster = document.querySelector('[data-clash-roster="local"]');
    if (!roster) return null;
    const elements = [
      roster,
      ...roster.querySelectorAll('[data-clash-roster-slot]')
    ];
    const rects = elements.map((element) => element.getBoundingClientRect());
    const left = Math.min(...rects.map((rect) => rect.left));
    const top = Math.min(...rects.map((rect) => rect.top));
    const right = Math.max(...rects.map((rect) => rect.right));
    const bottom = Math.max(...rects.map((rect) => rect.bottom));

    return {
      getBoundingClientRect: () => ({
        bottom,
        height: bottom - top,
        left,
        right,
        top,
        width: right - left
      })
    };
  }

  const steps = [
    {
      id: 'meet-your-team',
      eyebrow: 'YOUR CLASH TEAM',
      title: 'Meet your team',
      copy: 'You bring three Olings into every Clash. The larger Oling is currently active, while the other two wait on the bench ready to tag in.',
      action: 'Got it',
      backdrop: {
        container: '.olings-clash-game__surface'
      },
      elevate: '[data-clash-roster="local"]',
      target: getLocalTeamBounds,
      targetAnnotation: {
        gap: 16,
        placement: 'after',
        src: '/images/tutorial/brace-right/1.svg',
        visibleBounds: { left: 0.72 }
      },
      targetPadding: 12,
      onEnter: () => {
        window.OlingClashGame?.pauseTutorial?.();
      }
    },
    {
      id: 'available-actions',
      eyebrow: 'YOUR ABILITIES',
      title: 'Choose your action',
      copy: 'Each round, choose Attack, Guard, or Skill. Attack beats Skill, Skill beats Guard, and Guard beats Attack.',
      action: 'Got it',
      backdrop: {
        container: '.olings-clash-game__surface'
      },
      dialoguePlacement: 'top',
      elevate: [
        '[data-clash-action="attack"]',
        '[data-clash-action="guard"]',
        '[data-clash-action="skill"]'
      ],
      releaseStacking: '[data-clash-actions]',
      onEnter: ({ tutorial: currentTutorial }) => {
        window.OlingClashGame?.pauseTutorial?.();
        showActionDiagram(currentTutorial);
      },
      onExit: () => {
        removeActionDiagram?.();
        window.OlingClashGame?.resumeTutorial?.();
      }
    },
    {
      id: 'choose-an-ability',
      eyebrow: 'YOUR TURN',
      title: 'Choose an ability',
      copy: 'Choose Attack, Guard, or Skill for this round.',
      actionRequired: true,
      backdrop: {
        container: '.olings-clash-game__surface'
      },
      dialoguePlacement: 'top',
      elevate: [
        '[data-clash-action="attack"]',
        '[data-clash-action="guard"]',
        '[data-clash-action="skill"]',
        '[data-clash-phase]'
      ],
      releaseStacking: '[data-clash-actions]',
      advanceOn: {
        event: 'click',
        target: '[data-clash-game]',
        predicate: (event) => {
          const trigger = event.target.closest?.(
            '[data-clash-action="attack"], [data-clash-action="guard"], [data-clash-action="skill"]'
          );
          if (!trigger || trigger.disabled) return false;
          guidedAbilitySelected = true;
          return true;
        }
      },
      onEnter: ({ tutorial: currentTutorial }) => {
        guidedAbilitySelected = false;
        window.OlingClashGame?.pauseTutorial?.();
        window.OlingClashGame?.setTutorialActionInput?.(true);
        showActionTypeAnnotations(currentTutorial);
      },
      onExit: () => {
        removeActionTypeAnnotations?.();
        window.OlingClashGame?.setTutorialActionInput?.(false);
        if (!guidedAbilitySelected) {
          window.OlingClashGame?.resumeTutorial?.();
        }
      }
    },
    {
      id: 'lock-in-action',
      eyebrow: 'YOUR TURN',
      title: 'Lock in your action',
      copy: 'Press Confirm or press the enemy Oling to lock in your selected ability.',
      actionRequired: true,
      backdrop: {
        container: '.olings-clash-game__surface'
      },
      dialoguePlacement: 'top',
      elevate: [
        '[data-clash-actions]',
        '[data-clash-phase]',
        '.olings-clash-arena'
      ],
      advanceOn: {
        event: 'click',
        target: '[data-clash-game]',
        predicate: (event) => {
          const trigger = event.target.closest?.(
            '[data-clash-action-confirm], [data-clash-action-confirm-target]'
          );
          if (!trigger) return false;
          if (
            trigger.disabled ||
            trigger.getAttribute('aria-disabled') === 'true'
          ) {
            return false;
          }
          guidedActionConfirmed = true;
          return true;
        }
      },
      onEnter: () => {
        guidedActionConfirmed = false;
        window.OlingClashGame?.pauseTutorial?.();
        window.OlingClashGame?.setTutorialActionInput?.(true);
      },
      onExit: () => {
        window.OlingClashGame?.setTutorialActionInput?.(false);
        if (guidedActionConfirmed) {
          window.OlingClashGame?.setTutorialOpponentToLose?.();
        }
        window.OlingClashGame?.resumeTutorial?.();
        if (guidedActionConfirmed) {
          window.OlingClashGame?.confirmAction?.();
        }
        guidedActionConfirmed = false;
      }
    },
    {
      id: 'understand-ability-reveal',
      eyebrow: 'ROUND RESULT',
      title: 'Waiting for the reveal',
      copy: 'The abilities will be compared when both Olings have locked in.',
      actionRequired: true,
      backdrop: {
        container: '.olings-clash-game__surface'
      },
      dialoguePlacement: 'top',
      elevate: '[data-clash-phase]',
      onEnter: ({ tutorial: currentTutorial }) => {
        showAbilityRevealLesson(currentTutorial);
      },
      onExit: () => {
        removeAbilityRevealLesson?.();
        window.OlingClashGame?.resumeTutorial?.();
      }
    },
    {
      id: 'understand-heart-damage',
      eyebrow: 'ROUND RESULT',
      title: 'Watch the clash',
      copy: 'Your chosen ability will beat the enemy. Watch what happens to one of its normal hearts.',
      actionRequired: true,
      backdrop: {
        container: '.olings-clash-game__surface'
      },
      dialoguePlacement: 'top',
      elevate: [
        '.olings-clash-arena',
        '[data-clash-roster="opponent"] [data-clash-roster-slot="active"]'
      ],
      target:
        '[data-clash-roster="opponent"] [data-clash-roster-slot="active"] [data-clash-health]',
      targetPadding: 10,
      onEnter: ({ tutorial: currentTutorial }) => {
        showFirstResultLesson(currentTutorial);
      },
      onExit: () => {
        removeResultLesson?.();
        window.OlingClashGame?.resumeTutorial?.();
      }
    },
    {
      id: 'understand-round-results',
      eyebrow: 'CLASH DISPLAY',
      title: 'Follow each round',
      copy: 'Last Round shows the previous matchup result, Round shows which round you are playing, and the panel beneath shows what the Clash is currently waiting for or resolving.',
      actionRequired: true,
      backdrop: {
        container: '.olings-clash-game__surface'
      },
      dialoguePlacement: 'bottom',
      elevate: ['[data-clash-round-display]', '[data-clash-phase]'],
      onEnter: ({ tutorial: currentTutorial }) => {
        showRoundLayoutLesson(currentTutorial);
      },
      onExit: () => {
        removeRoundLayoutLesson?.();
        window.OlingClashGame?.resumeTutorial?.();
      }
    },
    {
      id: 'queue-a-tag',
      eyebrow: 'MAKING TAGS',
      title: 'Tag in Mossy',
      copy: 'Pebble only has half a Heart. Select Mossy\u2019s Tag button. Pebble will finish this round, then Mossy will swap in afterward.',
      actionRequired: true,
      backdrop: {
        container: '.olings-clash-game__surface'
      },
      dialoguePlacement: 'bottom',
      elevate: [
        '[data-clash-roster="local"] [data-clash-roster-slot="active"]',
        '[data-clash-roster="local"] [data-clash-roster-slot="bench-1"]'
      ],
      releaseStacking: '[data-clash-roster="local"]',
      advanceOn: {
        event: 'click',
        target: '[data-clash-game]',
        predicate: (event) => {
          const trigger = event.target.closest?.('[data-clash-tag-button]');
          if (
            !trigger ||
            trigger.dataset.teamSlot !== '1' ||
            trigger.disabled ||
            trigger.getAttribute('aria-pressed') !== 'true'
          ) {
            return false;
          }
          guidedTagSelected = true;
          return true;
        }
      },
      onEnter: () => {
        guidedTagSelected = false;
        window.OlingClashGame?.pauseTutorial?.();
        window.OlingClashGame?.setTutorialTagInput?.(true);
        restrictTutorialTagTo('Mossy', true);
      },
      onExit: () => {
        restrictTutorialTagTo('Mossy', false);
        window.OlingClashGame?.setTutorialTagInput?.(false);
        if (!guidedTagSelected) window.OlingClashGame?.resumeTutorial?.();
      }
    },
    {
      id: 'choose-draw-ability',
      eyebrow: 'DRAW ROUND',
      title: 'Choose another ability',
      copy: 'Choose Attack, Guard, or Skill. This time, watch what happens when the enemy chooses the same type.',
      actionRequired: true,
      backdrop: {
        container: '.olings-clash-game__surface'
      },
      dialoguePlacement: 'top',
      elevate: [
        '[data-clash-action="attack"]',
        '[data-clash-action="guard"]',
        '[data-clash-action="skill"]',
        '[data-clash-phase]'
      ],
      releaseStacking: '[data-clash-actions]',
      advanceOn: {
        event: 'click',
        target: '[data-clash-game]',
        predicate: (event) => {
          const trigger = event.target.closest?.(
            '[data-clash-action="attack"], [data-clash-action="guard"], [data-clash-action="skill"]'
          );
          if (!trigger || trigger.disabled) return false;
          guidedDrawAbilitySelected = true;
          return true;
        }
      },
      onEnter: ({ tutorial: currentTutorial }) => {
        guidedDrawAbilitySelected = false;
        window.OlingClashGame?.pauseTutorial?.();
        window.OlingClashGame?.setTutorialActionInput?.(true);
        showActionTypeAnnotations(currentTutorial);
      },
      onExit: () => {
        removeActionTypeAnnotations?.();
        window.OlingClashGame?.setTutorialActionInput?.(false);
        if (!guidedDrawAbilitySelected) {
          window.OlingClashGame?.resumeTutorial?.();
        }
      }
    },
    {
      id: 'lock-in-draw',
      eyebrow: 'DRAW ROUND',
      title: 'Lock in your action',
      copy: 'Press Confirm or press the enemy Oling. The enemy will match your ability type for this round.',
      actionRequired: true,
      backdrop: {
        container: '.olings-clash-game__surface'
      },
      dialoguePlacement: 'top',
      elevate: [
        '[data-clash-actions]',
        '[data-clash-phase]',
        '.olings-clash-arena'
      ],
      advanceOn: {
        event: 'click',
        target: '[data-clash-game]',
        predicate: (event) => {
          const trigger = event.target.closest?.(
            '[data-clash-action-confirm], [data-clash-action-confirm-target]'
          );
          if (
            !trigger ||
            trigger.disabled ||
            trigger.getAttribute('aria-disabled') === 'true'
          ) {
            return false;
          }
          guidedDrawActionConfirmed = true;
          return true;
        }
      },
      onEnter: () => {
        guidedDrawActionConfirmed = false;
        window.OlingClashGame?.pauseTutorial?.();
        window.OlingClashGame?.setTutorialActionInput?.(true);
      },
      onExit: () => {
        window.OlingClashGame?.setTutorialActionInput?.(false);
        if (guidedDrawActionConfirmed) {
          window.OlingClashGame?.setTutorialOpponentToDraw?.();
        }
        window.OlingClashGame?.resumeTutorial?.();
        if (guidedDrawActionConfirmed) {
          window.OlingClashGame?.confirmAction?.();
        }
        guidedDrawActionConfirmed = false;
      }
    },
    {
      id: 'understand-draw-and-last-stand',
      eyebrow: 'DRAW RESULT',
      title: 'Watch the Draw',
      copy: 'Matching ability types create a Draw. Watch both Olings when the round resolves.',
      actionRequired: true,
      backdrop: {
        container: '.olings-clash-game__surface'
      },
      dialoguePlacement: 'top',
      elevate: [
        '.olings-clash-arena',
        '[data-clash-roster="local"] [data-clash-roster-slot="active"]',
        '[data-clash-roster="opponent"] [data-clash-roster-slot="active"]'
      ],
      onEnter: ({ tutorial: currentTutorial }) => {
        showDrawResultLesson(currentTutorial);
      },
      onExit: () => {
        removeDrawResultLesson?.();
        window.OlingClashGame?.resumeTutorial?.();
      }
    },
    {
      id: 'inspect-ability-effects',
      eyebrow: 'ABILITY EFFECTS',
      title: 'Preparing the next round',
      copy: 'The next round will show you what makes each ability unique.',
      actionRequired: true,
      gameplay: {
        abilityEffects: false,
        abilityInformation: true
      },
      backdrop: {
        container: '.olings-clash-game__surface'
      },
      dialoguePlacement: 'top',
      elevate: [
        '[data-clash-action="attack"]',
        '[data-clash-action="guard"]',
        '[data-clash-action="skill"]',
        '[data-clash-action-summary]',
        '[data-clash-phase]'
      ],
      releaseStacking: releaseActionStackingWhenChoosing,
      onEnter: ({ tutorial: currentTutorial }) => {
        window.OlingClashGame?.setTutorialConfirmSuppressed?.(true);
        showAbilityInformationLesson(currentTutorial);
      },
      onExit: () => {
        removeAbilityInformationLesson?.();
        window.OlingClashGame?.resumeTutorial?.();
      }
    },
    {
      id: 'confirm-ability-draw',
      eyebrow: 'YOUR TURN',
      title: 'Choose any ability',
      copy: 'Choose Attack, Guard, or Skill, then press Confirm or press the enemy Oling to lock it in.',
      actionRequired: true,
      gameplay: {
        abilityEffects: true,
        abilityInformation: true
      },
      backdrop: {
        container: '.olings-clash-game__surface'
      },
      dialoguePlacement: 'top',
      elevate: [
        '[data-clash-actions]',
        '[data-clash-phase]',
        '.olings-clash-arena'
      ],
      advanceOn: {
        event: 'click',
        target: '[data-clash-game]',
        predicate: (event) => {
          const trigger = event.target.closest?.(
            '[data-clash-action-confirm], [data-clash-action-confirm-target]'
          );
          if (
            !trigger ||
            trigger.disabled ||
            trigger.getAttribute('aria-disabled') === 'true'
          ) {
            return false;
          }
          guidedAbilityDrawConfirmed = true;
          return true;
        }
      },
      onEnter: () => {
        guidedAbilityDrawConfirmed = false;
        window.OlingClashGame?.pauseTutorial?.();
        window.OlingClashGame?.setTutorialActionInput?.(true);
        window.OlingClashGame?.setTutorialConfirmSuppressed?.(false);
      },
      onExit: () => {
        window.OlingClashGame?.setTutorialActionInput?.(false);
        if (guidedAbilityDrawConfirmed) {
          window.OlingClashGame?.setTutorialOpponentToDraw?.();
        }
        window.OlingClashGame?.resumeTutorial?.();
        if (guidedAbilityDrawConfirmed) {
          window.OlingClashGame?.confirmAction?.();
        }
        guidedAbilityDrawConfirmed = false;
      }
    },
    {
      id: 'understand-draw-abilities',
      eyebrow: 'DRAW ABILITIES',
      title: 'Waiting for the Draw',
      copy: 'Watch what happens after both Olings reveal the same ability type.',
      actionRequired: true,
      gameplay: {
        abilityEffects: true,
        abilityInformation: true
      },
      backdrop: {
        container: '.olings-clash-game__surface'
      },
      dialoguePlacement: 'top',
      elevate: [
        '[data-clash-ability-reveal]',
        '[data-clash-action="draw"]',
        '[data-clash-action-summary]'
      ],
      releaseStacking: '[data-clash-actions]',
      onEnter: ({ tutorial: currentTutorial }) => {
        showDrawAbilityEffectsLesson(currentTutorial);
      },
      onExit: () => {
        removeDrawAbilityEffectsLesson?.();
        window.OlingClashGame?.resumeTutorial?.();
      }
    },
    {
      id: 'understand-canopy-shield',
      eyebrow: 'CANOPY',
      title: 'Canopy protects Pebble',
      copy: 'Canopy gave the most damaged ally, Pebble, a Shield even while Pebble was on the bench. A Shield absorbs one full Heart of normal damage before it breaks.',
      backdrop: {
        container: '.olings-clash-game__surface'
      },
      dialoguePlacement: 'bottom',
      elevate:
        '[data-clash-roster="local"] [data-clash-roster-slot="bench-1"] [data-clash-health] .olings-clash-health-unit.is-shields',
      releaseStacking: '[data-clash-roster="local"]',
      onEnter: () => {
        const gameRoot = document.querySelector('[data-clash-game]');
        window.OlingClashGame?.pauseTutorial?.();
        window.OlingClashGame?.combatMotion?.hold?.(gameRoot);
      },
      onExit: () => {
        const gameRoot = document.querySelector('[data-clash-game]');
        window.OlingClashGame?.combatMotion?.release?.(gameRoot);
        window.OlingClashGame?.resumeTutorial?.();
      }
    },
    {
      id: 'understand-bloodbound-effect',
      eyebrow: 'BLOODBOUND',
      title: 'Fang stores the lost Heart',
      copy: 'Reclaim stored the half Heart Fang lost in the Draw as Bloodbound. This Positive effect shows that the Blood is waiting: Fang recovers it after its next decisive win and loses it after its next decisive loss.',
      backdrop: {
        container: '.olings-clash-game__surface'
      },
      dialoguePlacement: 'bottom',
      elevate:
        '[data-clash-roster="opponent"] [data-clash-roster-slot="active"] [data-effect-key="bloodbound"]',
      releaseStacking: '[data-clash-roster="opponent"]',
      onEnter: () => {
        const gameRoot = document.querySelector('[data-clash-game]');
        window.OlingClashGame?.pauseTutorial?.();
        window.OlingClashGame?.combatMotion?.hold?.(gameRoot);
      },
      onExit: () => {
        const gameRoot = document.querySelector('[data-clash-game]');
        window.OlingClashGame?.combatMotion?.release?.(gameRoot);
        window.OlingClashGame?.resumeTutorial?.();
      }
    },
    {
      id: 'choose-wild-growth',
      eyebrow: 'TRY AN EFFECT',
      title: 'Choose Wild Growth',
      copy: 'Select Wild Growth. Its Skill type will decide the Clash, and winning will activate its additional effect.',
      actionRequired: true,
      gameplay: {
        abilityEffects: true,
        abilityInformation: true
      },
      backdrop: {
        container: '.olings-clash-game__surface'
      },
      dialoguePlacement: 'top',
      elevate: [
        '[data-clash-action="skill"]',
        '[data-clash-action-summary]',
        '[data-clash-phase]'
      ],
      releaseStacking: releaseActionStackingWhenChoosing,
      advanceOn: {
        event: 'click',
        target: '[data-clash-game]',
        predicate: (event) => {
          const trigger = event.target.closest?.('[data-clash-action="skill"]');
          if (!trigger || trigger.disabled) return false;
          guidedWildGrowthSelected = true;
          return true;
        }
      },
      onEnter: ({ tutorial: currentTutorial }) => {
        guidedWildGrowthSelected = false;
        window.OlingClashGame?.setTutorialConfirmSuppressed?.(true);
        prepareGuidedRoundStep(currentTutorial, { allowedAction: 'skill' });
      },
      onExit: () => {
        removeGuidedRoundStep?.();
        if (!guidedWildGrowthSelected) {
          window.OlingClashGame?.resumeTutorial?.();
        }
      }
    },
    {
      id: 'confirm-wild-growth',
      eyebrow: 'YOUR TURN',
      title: 'Lock in Wild Growth',
      copy: 'Press Confirm or press the enemy Oling to lock in Wild Growth.',
      actionRequired: true,
      gameplay: {
        abilityEffects: true,
        abilityInformation: true
      },
      backdrop: {
        container: '.olings-clash-game__surface'
      },
      dialoguePlacement: 'top',
      elevate: [
        '[data-clash-actions]',
        '[data-clash-phase]',
        '.olings-clash-arena'
      ],
      advanceOn: {
        event: 'click',
        target: '[data-clash-game]',
        predicate: (event) => {
          const trigger = event.target.closest?.(
            '[data-clash-action-confirm], [data-clash-action-confirm-target]'
          );
          if (
            !trigger ||
            trigger.disabled ||
            trigger.getAttribute('aria-disabled') === 'true'
          ) {
            return false;
          }
          guidedWildGrowthConfirmed = true;
          return true;
        }
      },
      onEnter: () => {
        guidedWildGrowthConfirmed = false;
        window.OlingClashGame?.pauseTutorial?.();
        window.OlingClashGame?.setTutorialActionInput?.(true);
        window.OlingClashGame?.setTutorialConfirmSuppressed?.(false);
      },
      onExit: () => {
        window.OlingClashGame?.setTutorialActionInput?.(false);
        if (guidedWildGrowthConfirmed) {
          window.OlingClashGame?.setTutorialOpponentToLose?.();
          window.OlingClashGame?.setTutorialOpponentTagSlot?.(1);
        }
        window.OlingClashGame?.resumeTutorial?.();
        if (guidedWildGrowthConfirmed) {
          window.OlingClashGame?.confirmAction?.();
        }
        guidedWildGrowthConfirmed = false;
      }
    },
    {
      id: 'understand-wild-growth',
      eyebrow: 'WILD GROWTH',
      title: 'Waiting for Wild Growth',
      copy: 'Watch Mossy and the enemy Oling as the winning Skill resolves.',
      actionRequired: true,
      gameplay: {
        abilityEffects: true,
        abilityInformation: false
      },
      backdrop: {
        container: '.olings-clash-game__surface'
      },
      dialoguePlacement: 'bottom',
      elevate:
        '[data-clash-roster="local"] [data-clash-roster-slot="active"] [data-clash-health]',
      releaseStacking: '[data-clash-roster="local"]',
      onEnter: ({ tutorial: currentTutorial }) => {
        showScriptedResultLesson(currentTutorial, {
          copy: 'Wild Growth activated because Mossy won the Clash. It gave Mossy half an Overgrowth Heart, which protects its normal Hearts from future damage.',
          delayMs: 1000,
          matches: (result) =>
            result?.winner === 'local' && result?.localAction === 'skill',
          title: 'Mossy gained Overgrowth'
        });
      },
      onExit: () => {
        removeScriptedResultLesson?.();
        window.OlingClashGame?.resumeTutorial?.();
      }
    },
    {
      id: 'understand-forced-opponent-tag',
      eyebrow: 'KNOCKOUTS',
      title: 'Waiting for a replacement',
      copy: 'Fang has no normal Hearts remaining, so the opponent must replace it.',
      actionRequired: true,
      backdrop: {
        container: '.olings-clash-game__surface'
      },
      dialoguePlacement: 'top',
      elevate: [
        '[data-clash-roster="opponent"] [data-clash-roster-slot="active"]',
        '.olings-clash-arena'
      ],
      releaseStacking: '[data-clash-roster="opponent"]',
      onEnter: ({ tutorial: currentTutorial }) => {
        showOpponentTagLesson(currentTutorial, {
          copy: 'Fang reached zero normal Hearts and was knocked out. Because an active Oling cannot continue at zero, Scrap was automatically tagged in.',
          title: 'A knockout forces a Tag'
        });
      },
      onExit: () => {
        removeOpponentTagLesson?.();
        window.OlingClashGame?.resumeTutorial?.();
      }
    },
    {
      id: 'queue-pebble-tag',
      eyebrow: 'PLAN AHEAD',
      title: 'Queue Pebble to Tag in',
      copy: 'Select Pebble’s Tag button. Mossy will finish the next round, then Pebble will swap in carrying the Shield that Canopy gave it on the bench.',
      actionRequired: true,
      backdrop: {
        container: '.olings-clash-game__surface'
      },
      dialoguePlacement: 'bottom',
      elevate: [
        '[data-clash-roster="local"] [data-clash-roster-slot="active"]',
        '[data-clash-roster="local"] [data-clash-roster-slot="bench-1"]'
      ],
      releaseStacking: '[data-clash-roster="local"]',
      advanceOn: {
        event: 'click',
        target: '[data-clash-game]',
        predicate: (event) => {
          const trigger = event.target.closest?.('[data-clash-tag-button]');
          const olingName = String(
            trigger
              ?.closest('[data-clash-roster-slot]')
              ?.querySelector('.olings-clash-roster-slot__status > strong')
              ?.textContent || ''
          ).trim();
          if (
            !trigger ||
            olingName.toLowerCase() !== 'pebble' ||
            trigger.disabled ||
            trigger.getAttribute('aria-pressed') !== 'true'
          ) {
            return false;
          }
          guidedPebbleTagSelected = true;
          return true;
        }
      },
      onEnter: ({ tutorial: currentTutorial }) => {
        guidedPebbleTagSelected = false;
        prepareGuidedTagStep(currentTutorial, { olingName: 'Pebble' });
      },
      onExit: () => {
        removeGuidedTagStep?.();
        if (!guidedPebbleTagSelected) {
          window.OlingClashGame?.resumeTutorial?.();
        }
      }
    },
    {
      id: 'win-and-tag-pebble',
      eyebrow: 'QUEUED TAG',
      title: 'Win and bring Pebble in',
      copy: 'Choose any ability, then press Confirm or press Scrap. Mossy will take this action before your queued Tag brings Pebble in.',
      actionRequired: true,
      backdrop: {
        container: '.olings-clash-game__surface'
      },
      dialoguePlacement: 'top',
      elevate: [
        '[data-clash-actions]',
        '[data-clash-phase]',
        '.olings-clash-arena'
      ],
      advanceOn: {
        event: 'click',
        target: '[data-clash-game]',
        predicate: (event) => {
          const trigger = event.target.closest?.(
            '[data-clash-action-confirm], [data-clash-action-confirm-target]'
          );
          if (
            !trigger ||
            trigger.disabled ||
            trigger.getAttribute('aria-disabled') === 'true'
          ) {
            return false;
          }
          guidedPebbleRoundConfirmed = true;
          return true;
        }
      },
      onEnter: ({ tutorial: currentTutorial }) => {
        guidedPebbleRoundConfirmed = false;
        prepareGuidedRoundStep(currentTutorial);
      },
      onExit: () => {
        removeGuidedRoundStep?.();
        if (guidedPebbleRoundConfirmed) {
          window.OlingClashGame?.setTutorialOpponentToLose?.();
        }
        window.OlingClashGame?.resumeTutorial?.();
        if (guidedPebbleRoundConfirmed) {
          window.OlingClashGame?.confirmAction?.();
        }
        guidedPebbleRoundConfirmed = false;
      }
    },
    {
      id: 'understand-pebble-shield',
      eyebrow: 'QUEUED TAG',
      title: 'Waiting for Pebble',
      copy: 'Mossy finishes the round before the queued Tag happens.',
      actionRequired: true,
      backdrop: {
        container: '.olings-clash-game__surface'
      },
      dialoguePlacement: 'bottom',
      elevate: '[data-clash-roster="local"] [data-clash-roster-slot="active"]',
      releaseStacking: '[data-clash-roster="local"]',
      onEnter: ({ tutorial: currentTutorial }) => {
        showOpponentTagLesson(currentTutorial, {
          copy: 'Pebble tagged in with the Shield that Canopy gave it while it was on the bench. Effects stay with an Oling when it moves between the bench and battle.',
          title: 'Pebble brings its Shield'
        });
      },
      onExit: () => {
        removeOpponentTagLesson?.();
        window.OlingClashGame?.resumeTutorial?.();
      }
    },
    {
      id: 'test-pebble-shield',
      eyebrow: 'SHIELDS',
      title: 'See Pebble\u2019s Shield work',
      copy: 'Choose any ability and confirm it. The opponent will win this Clash so you can see Pebble\u2019s Shield absorb the hit.',
      actionRequired: true,
      backdrop: {
        container: '.olings-clash-game__surface'
      },
      dialoguePlacement: 'top',
      elevate: [
        '[data-clash-actions]',
        '[data-clash-phase]',
        '.olings-clash-arena'
      ],
      advanceOn: {
        event: 'click',
        target: '[data-clash-game]',
        predicate: (event) => {
          const trigger = event.target.closest?.(
            '[data-clash-action-confirm], [data-clash-action-confirm-target]'
          );
          if (
            !trigger ||
            trigger.disabled ||
            trigger.getAttribute('aria-disabled') === 'true'
          ) {
            return false;
          }
          guidedShieldHitConfirmed = true;
          return true;
        }
      },
      onEnter: ({ tutorial: currentTutorial }) => {
        guidedShieldHitConfirmed = false;
        prepareGuidedRoundStep(currentTutorial);
      },
      onExit: () => {
        removeGuidedRoundStep?.();
        if (guidedShieldHitConfirmed) {
          window.OlingClashGame?.setTutorialOpponentToWin?.();
          window.OlingClashGame?.setTutorialOpponentQueuedTagSlot?.(2);
        }
        window.OlingClashGame?.resumeTutorial?.();
        if (guidedShieldHitConfirmed) {
          window.OlingClashGame?.confirmAction?.();
        }
        guidedShieldHitConfirmed = false;
      }
    },
    {
      id: 'understand-shield-damage',
      eyebrow: 'SHIELD DAMAGE',
      title: 'Waiting for the hit',
      copy: 'Watch where the opponent’s winning hit is applied.',
      actionRequired: true,
      backdrop: {
        container: '.olings-clash-game__surface'
      },
      dialoguePlacement: 'top',
      elevate: [
        '.olings-clash-arena',
        '[data-clash-roster="local"] [data-clash-roster-slot="active"]'
      ],
      releaseStacking: '[data-clash-roster="local"]',
      onEnter: ({ tutorial: currentTutorial }) => {
        showScriptedResultLesson(currentTutorial, {
          copy: 'Pebble’s Shield absorbed the entire one-Heart hit and then broke. Pebble kept all of its normal Hearts because Shields are damaged first.',
          damageLayer: 'shields',
          damageSide: 'local',
          matches: (result) =>
            result?.winner === 'opponent' &&
            Number(result?.localDamage?.destroyedShields || 0) > 0,
          title: 'The Shield took the damage'
        });
      },
      onExit: () => {
        removeScriptedResultLesson?.();
        window.OlingClashGame?.resumeTutorial?.();
      }
    },
    {
      id: 'understand-moss-overgrowth',
      eyebrow: 'TACTICAL TAGS',
      title: 'Waiting for Moss',
      copy: 'The opponent queued a Tag during that round, so Scrap will now make way for Moss.',
      actionRequired: true,
      backdrop: {
        container: '.olings-clash-game__surface'
      },
      dialoguePlacement: 'bottom',
      elevate:
        '[data-clash-roster="opponent"] [data-clash-roster-slot="active"]',
      releaseStacking: '[data-clash-roster="opponent"]',
      onEnter: ({ tutorial: currentTutorial }) => {
        showOpponentTagLesson(currentTutorial, {
          copy: 'Moss tagged in with one full Overgrowth Heart. Overgrowth is extra health placed in front of normal Hearts, but unlike a Shield it can be gained and lost in half-Heart amounts.',
          title: 'Moss brings Overgrowth'
        });
      },
      onExit: () => {
        removeOpponentTagLesson?.();
        window.OlingClashGame?.resumeTutorial?.();
      }
    },
    {
      id: 'damage-moss-overgrowth',
      eyebrow: 'DAMAGE ORDER',
      title: 'Win one more Clash',
      copy: 'Choose any ability and confirm it. This hit will show where Overgrowth sits in the damage order.',
      actionRequired: true,
      backdrop: {
        container: '.olings-clash-game__surface'
      },
      dialoguePlacement: 'top',
      elevate: [
        '[data-clash-actions]',
        '[data-clash-phase]',
        '.olings-clash-arena'
      ],
      advanceOn: {
        event: 'click',
        target: '[data-clash-game]',
        predicate: (event) => {
          const trigger = event.target.closest?.(
            '[data-clash-action-confirm], [data-clash-action-confirm-target]'
          );
          if (
            !trigger ||
            trigger.disabled ||
            trigger.getAttribute('aria-disabled') === 'true'
          ) {
            return false;
          }
          guidedOvergrowthHitConfirmed = true;
          return true;
        }
      },
      onEnter: ({ tutorial: currentTutorial }) => {
        guidedOvergrowthHitConfirmed = false;
        prepareGuidedRoundStep(currentTutorial);
      },
      onExit: () => {
        removeGuidedRoundStep?.();
        if (guidedOvergrowthHitConfirmed) {
          window.OlingClashGame?.setTutorialOpponentToLose?.();
        }
        window.OlingClashGame?.resumeTutorial?.();
        if (guidedOvergrowthHitConfirmed) {
          window.OlingClashGame?.confirmAction?.();
        }
        guidedOvergrowthHitConfirmed = false;
      }
    },
    {
      id: 'understand-overgrowth-damage',
      eyebrow: 'DAMAGE ORDER',
      title: 'Waiting for the hit',
      copy: 'Watch which health layer is removed from Moss.',
      actionRequired: true,
      backdrop: {
        container: '.olings-clash-game__surface'
      },
      dialoguePlacement: 'top',
      elevate: [
        '.olings-clash-arena',
        '[data-clash-roster="opponent"] [data-clash-roster-slot="active"]'
      ],
      releaseStacking: '[data-clash-roster="opponent"]',
      onEnter: ({ tutorial: currentTutorial }) => {
        showScriptedResultLesson(currentTutorial, {
          copy: 'The hit removed Moss\u2019s Overgrowth before touching its normal Hearts. Normal damage is applied to Shields first, then Overgrowth, and finally normal Hearts.',
          damageLayer: 'overgrowth',
          matches: (result) =>
            result?.winner === 'local' &&
            Number(result?.opponentDamage?.overgrowthDamageUnits || 0) > 0,
          title: 'Overgrowth protects normal Hearts'
        });
      },
      onExit: () => {
        removeScriptedResultLesson?.();
        window.OlingClashGame?.resumeTutorial?.();
      }
    },
    {
      id: 'complete-clash-basics',
      eyebrow: 'TUTORIAL COMPLETE',
      title: 'You know the Clash basics',
      copy: 'Choose abilities by type, use Tags to protect your team, and watch Shields, Overgrowth, normal Hearts, and ability effects when planning each round.',
      backdrop: {
        container: '.olings-clash-game__surface'
      },
      dialoguePlacement: 'bottom',
      modal: true,
      onEnter: () => {
        window.OlingClashGame?.pauseTutorial?.();
      },
      onExit: () => {
        window.OlingClashGame?.configureTutorialGameplay?.({
          abilityEffects: true,
          abilityInformation: true
        });
        window.OlingClashGame?.resumeTutorial?.();
      }
    }
  ];

  steps.forEach((step) => {
    const onEnter = step.onEnter;
    step.onEnter = (context) => {
      window.OlingClashGame?.configureTutorialGameplay?.({
        ...DEFAULT_GAMEPLAY,
        ...(step.gameplay || {})
      });
      onEnter?.(context);
    };
  });

  function startTutorial() {
    if (tutorial || !window.OETutorial || !window.OlingClashGame) {
      return tutorial;
    }

    tutorial = window.OETutorial.create({
      id: 'olings-clash',
      version: TUTORIAL_VERSION,
      storageKey: STORAGE_KEY,
      rememberCompletion: false,
      onFinish: () => {
        window.OlingClashGame?.setTutorialConfirmSuppressed?.(false);
      },
      steps
    });
    window.OlingClashTutorial = tutorial;
    tutorial.start();
    return tutorial;
  }

  window.addEventListener('olings-clash:tutorial-ready', startTutorial, {
    once: true
  });
  startTutorial();
})();
