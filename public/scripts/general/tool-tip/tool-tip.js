const TOOLTIP_OFFSET_PX = 10;
const TOOLTIP_TRANSITION_MS = 140;
const TOUCH_TOOLTIP_HOLD_MS = 500;
const TOUCH_TOOLTIP_MOVE_TOLERANCE_PX = 10;
const TOUCH_PRESS_QUICK_MIN_MS = 140;
const TOUCH_PRESS_QUICK_RELEASE_MS = 120;
const TOUCH_PRESS_LINGER_MIN_MS = 280;
const TOUCH_PRESS_LINGER_RELEASE_MS = 360;
const TOUCH_FOCUS_GUARD_MS = 1000;
const tooltipNode = document.createElement('div');
tooltipNode.className = 'floating-tooltip';
tooltipNode.setAttribute('aria-hidden', 'true');
document.body.appendChild(tooltipNode);

let activeTooltipTrigger = null;
let activeTouchHold = null;
let lastTouchInteractionAt = Number.NEGATIVE_INFINITY;
let suppressedTouchClickTrigger = null;
let suppressedTouchClickResetTimeoutId = null;
let touchPressedTrigger = null;
let touchPressedStartedAt = 0;
let touchPressedResetTimeoutId = null;

function getTooltipText(trigger) {
    return trigger?.getAttribute('data-tooltip')?.trim() || '';
}

function mountTooltipForTrigger(trigger) {
    const openDialog = trigger?.closest?.('dialog[open]');
    const layer = openDialog || document.body;
    if (tooltipNode.parentElement !== layer) {
        layer.appendChild(tooltipNode);
    }
}

function positionTooltip(trigger) {
    if (!trigger || !tooltipNode.textContent) return;

    const rect = trigger.getBoundingClientRect();
    const tooltipRect = tooltipNode.getBoundingClientRect();

    let left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);
    const maxLeft = window.innerWidth - tooltipRect.width - 8;
    left = Math.min(Math.max(8, left), Math.max(8, maxLeft));

    let top = rect.top - tooltipRect.height - TOOLTIP_OFFSET_PX;
    if (top < 8) {
        top = rect.bottom + TOOLTIP_OFFSET_PX;
    }

    tooltipNode.style.left = `${left}px`;
    tooltipNode.style.top = `${top}px`;
}

function isTooltipTriggerDisabled(trigger) {
    return (
        trigger?.matches?.(':disabled') ||
        trigger?.getAttribute?.('aria-disabled') === 'true'
    );
}

function syncTooltipAppearance(trigger) {
    const isDisabled = isTooltipTriggerDisabled(trigger);

    tooltipNode.classList.toggle('visible', Boolean(trigger));
    tooltipNode.classList.toggle('warning', trigger?.classList.contains('warning') ?? false);
    tooltipNode.classList.toggle('selected', trigger?.classList.contains('selected') ?? false);
    tooltipNode.classList.toggle('disabled', Boolean(isDisabled));
}

function setTooltipSelectedState(trigger, selectedText = 'copied') {
    if (!(trigger instanceof HTMLElement)) return;

    if (!trigger.dataset.tooltipDefault) {
        trigger.dataset.tooltipDefault = trigger.getAttribute('data-tooltip') || '';
    }

    trigger.classList.add('selected');
    trigger.setAttribute('data-tooltip', selectedText);

    if (trigger === activeTooltipTrigger) {
        refreshTooltip(trigger);
    } else if (Date.now() - lastTouchInteractionAt >= TOUCH_FOCUS_GUARD_MS) {
        showTooltip(trigger);
    }
}

function resetTooltipSelectedState(trigger) {
    if (!(trigger instanceof HTMLElement) || !trigger.classList.contains('selected')) return;

    const defaultTooltip = trigger.dataset.tooltipDefault;
    trigger.classList.remove('selected');

    if (typeof defaultTooltip === 'string') {
        trigger.setAttribute('data-tooltip', defaultTooltip);
    }

    if (trigger === activeTooltipTrigger) {
        refreshTooltip(trigger);
    }
}

function scheduleTooltipReset(trigger) {
    if (!(trigger instanceof HTMLElement)) return;

    const existingTimeout = Number(trigger.dataset.tooltipResetTimeoutId);
    if (existingTimeout) {
        clearTimeout(existingTimeout);
    }

    const timeoutId = window.setTimeout(() => {
        resetTooltipSelectedState(trigger);
        delete trigger.dataset.tooltipResetTimeoutId;
    }, TOOLTIP_TRANSITION_MS);

    trigger.dataset.tooltipResetTimeoutId = String(timeoutId);
}

function showTooltip(trigger) {
    const text = getTooltipText(trigger);
    if (!text) return;

    mountTooltipForTrigger(trigger);

    const pendingReset = Number(trigger.dataset.tooltipResetTimeoutId);
    if (pendingReset) {
        clearTimeout(pendingReset);
        delete trigger.dataset.tooltipResetTimeoutId;
    }

    activeTooltipTrigger = trigger;
    tooltipNode.textContent = text;
    syncTooltipAppearance(trigger);
    positionTooltip(trigger);
}

function refreshTooltip(trigger = activeTooltipTrigger) {
    if (!trigger || trigger !== activeTooltipTrigger) return;

    const text = getTooltipText(trigger);
    if (!text) {
        hideTooltip(trigger);
        return;
    }

    tooltipNode.textContent = text;
    syncTooltipAppearance(trigger);
    positionTooltip(trigger);
}

function hideTooltip(trigger = activeTooltipTrigger) {
    if (trigger && trigger !== activeTooltipTrigger) return;

    activeTooltipTrigger = null;
    syncTooltipAppearance(null);
}

function findTooltipTrigger(target) {
    return target instanceof Element ? target.closest('.tool-tip[data-tooltip]') : null;
}

function showHoverTooltip(event) {
    if (event.pointerType === 'touch') return;

    const trigger = findTooltipTrigger(event.target);
    if (!trigger || trigger === activeTooltipTrigger) return;
    showTooltip(trigger);
}

function hideHoverTooltip(event) {
    if (event.pointerType === 'touch') return;

    const trigger = findTooltipTrigger(event.target);
    if (!trigger) return;

    const relatedTrigger = findTooltipTrigger(event.relatedTarget);
    if (trigger === relatedTrigger) return;
    hideTooltip(trigger);
    scheduleTooltipReset(trigger);
}

if ('PointerEvent' in window) {
    document.addEventListener('pointerover', showHoverTooltip);
    document.addEventListener('pointerout', hideHoverTooltip);
} else {
    document.addEventListener('mouseover', showHoverTooltip);
    document.addEventListener('mouseout', hideHoverTooltip);
}

function clearSuppressedTouchClick() {
    if (suppressedTouchClickResetTimeoutId !== null) {
        clearTimeout(suppressedTouchClickResetTimeoutId);
    }

    suppressedTouchClickTrigger = null;
    suppressedTouchClickResetTimeoutId = null;
}

function suppressNextTouchClick(trigger) {
    clearSuppressedTouchClick();
    suppressedTouchClickTrigger = trigger;
    suppressedTouchClickResetTimeoutId = window.setTimeout(() => {
        suppressedTouchClickTrigger = null;
        suppressedTouchClickResetTimeoutId = null;
    }, 0);
}

function clearTouchPressedReset() {
    if (touchPressedResetTimeoutId === null) return;
    clearTimeout(touchPressedResetTimeoutId);
    touchPressedResetTimeoutId = null;
}

function resetTouchPressedFeedback(trigger) {
    trigger?.classList.remove('touch-pressed', 'touch-feedback-releasing');
    if (touchPressedTrigger === trigger) {
        touchPressedTrigger = null;
    }
    touchPressedResetTimeoutId = null;
}

function getTouchPressFeedbackTimings(trigger) {
    if (trigger?.dataset.pressFeedback === 'linger') {
        return {
            minimumMs: TOUCH_PRESS_LINGER_MIN_MS,
            releaseMs: TOUCH_PRESS_LINGER_RELEASE_MS
        };
    }

    return {
        minimumMs: TOUCH_PRESS_QUICK_MIN_MS,
        releaseMs: TOUCH_PRESS_QUICK_RELEASE_MS
    };
}

function beginTouchPressedFeedback(trigger) {
    clearTouchPressedReset();

    if (touchPressedTrigger) {
        resetTouchPressedFeedback(touchPressedTrigger);
    }

    touchPressedTrigger = null;
    if (isTooltipTriggerDisabled(trigger)) return;

    touchPressedTrigger = trigger;
    touchPressedStartedAt = Date.now();
    trigger.classList.remove('touch-feedback-releasing');
    trigger.classList.add('touch-pressed');
}

function endTouchPressedFeedback({ animateRelease = false } = {}) {
    if (!touchPressedTrigger) return;

    clearTouchPressedReset();
    const trigger = touchPressedTrigger;
    const timings = getTouchPressFeedbackTimings(trigger);
    const elapsed = Date.now() - touchPressedStartedAt;
    const remaining = animateRelease
        ? Math.max(0, timings.minimumMs - elapsed)
        : 0;

    const startRelease = () => {
        trigger.classList.remove('touch-pressed');
        trigger.classList.add('touch-feedback-releasing');
        touchPressedResetTimeoutId = window.setTimeout(() => {
            resetTouchPressedFeedback(trigger);
        }, timings.releaseMs);
    };

    if (!animateRelease) {
        resetTouchPressedFeedback(trigger);
        return;
    }

    if (remaining > 0) {
        touchPressedResetTimeoutId = window.setTimeout(startRelease, remaining);
        return;
    }

    startRelease();
}

function cancelTouchHold({ suppressClick = false, respectPressMinimum = false } = {}) {
    const hold = activeTouchHold;
    const shouldAnimateRelease = respectPressMinimum && !hold?.shown;
    endTouchPressedFeedback({ animateRelease: shouldAnimateRelease });
    if (!activeTouchHold) return;

    activeTouchHold = null;
    clearTimeout(hold.timeoutId);

    if (!hold.shown) return;

    hideTooltip(hold.trigger);
    scheduleTooltipReset(hold.trigger);

    if (suppressClick) {
        suppressNextTouchClick(hold.trigger);
    }
}

document.addEventListener('pointerdown', (event) => {
    if (event.pointerType !== 'touch' || event.isPrimary === false) return;

    lastTouchInteractionAt = Date.now();
    cancelTouchHold();

    const trigger = findTooltipTrigger(event.target);
    if (!trigger) return;

    hideTooltip();
    beginTouchPressedFeedback(trigger);

    const hold = {
        pointerId: event.pointerId,
        trigger,
        startX: event.clientX,
        startY: event.clientY,
        shown: false,
        timeoutId: null
    };

    hold.timeoutId = window.setTimeout(() => {
        if (activeTouchHold !== hold || !trigger.isConnected) return;
        showTooltip(trigger);
        hold.shown = activeTooltipTrigger === trigger;
    }, TOUCH_TOOLTIP_HOLD_MS);

    activeTouchHold = hold;
});

document.addEventListener('pointermove', (event) => {
    if (!activeTouchHold || event.pointerId !== activeTouchHold.pointerId) return;

    const movedX = event.clientX - activeTouchHold.startX;
    const movedY = event.clientY - activeTouchHold.startY;
    if (Math.hypot(movedX, movedY) <= TOUCH_TOOLTIP_MOVE_TOLERANCE_PX) return;

    lastTouchInteractionAt = Date.now();
    cancelTouchHold();
});

document.addEventListener('pointerup', (event) => {
    if (!activeTouchHold || event.pointerId !== activeTouchHold.pointerId) return;

    lastTouchInteractionAt = Date.now();
    cancelTouchHold({ suppressClick: true, respectPressMinimum: true });
});

document.addEventListener('pointercancel', (event) => {
    if (!activeTouchHold || event.pointerId !== activeTouchHold.pointerId) return;

    lastTouchInteractionAt = Date.now();
    cancelTouchHold();
});

document.addEventListener('contextmenu', (event) => {
    if (!activeTouchHold) return;

    const trigger = findTooltipTrigger(event.target);
    if (trigger === activeTouchHold.trigger) {
        event.preventDefault();
    }
});

function preventTooltipSelectionOrDrag(event) {
    if (!findTooltipTrigger(event.target)) return;
    event.preventDefault();
}

document.addEventListener('selectstart', preventTooltipSelectionOrDrag);
document.addEventListener('dragstart', preventTooltipSelectionOrDrag);

document.addEventListener('click', (event) => {
    if (!suppressedTouchClickTrigger) return;

    const trigger = findTooltipTrigger(event.target);
    if (trigger !== suppressedTouchClickTrigger) return;

    clearSuppressedTouchClick();
    event.preventDefault();
    event.stopImmediatePropagation();
}, true);

document.addEventListener('focusin', (event) => {
    const trigger = findTooltipTrigger(event.target);
    if (!trigger) return;

    const isRecentTouchFocus =
        activeTouchHold ||
        Date.now() - lastTouchInteractionAt < TOUCH_FOCUS_GUARD_MS;
    if (isRecentTouchFocus) return;

    showTooltip(trigger);
});

document.addEventListener('focusout', (event) => {
    const trigger = findTooltipTrigger(event.target);
    if (!trigger) return;

    const relatedTrigger = findTooltipTrigger(event.relatedTarget);
    if (trigger === relatedTrigger) return;
    hideTooltip(trigger);
    scheduleTooltipReset(trigger);
});

document.addEventListener('scroll', () => {
    if (activeTouchHold) {
        cancelTouchHold();
        return;
    }

    if (!activeTooltipTrigger) return;
    positionTooltip(activeTooltipTrigger);
}, true);

window.addEventListener('resize', () => {
    if (!activeTooltipTrigger) return;
    positionTooltip(activeTooltipTrigger);
});

window.addEventListener('orientationchange', () => {
    if (!activeTooltipTrigger) return;
    positionTooltip(activeTooltipTrigger);
});

window.refreshActiveTooltip = refreshTooltip;
window.setTooltipSelectedState = setTooltipSelectedState;
