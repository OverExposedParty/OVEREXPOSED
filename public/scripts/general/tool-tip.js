const TOOLTIP_OFFSET_PX = 10;
const TOOLTIP_TRANSITION_MS = 140;
const tooltipNode = document.createElement('div');
tooltipNode.className = 'floating-tooltip';
tooltipNode.setAttribute('aria-hidden', 'true');
document.body.appendChild(tooltipNode);

let activeTooltipTrigger = null;

function getTooltipText(trigger) {
    return trigger?.getAttribute('data-tooltip')?.trim() || '';
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

function syncTooltipAppearance(trigger) {
    tooltipNode.classList.toggle('visible', Boolean(trigger));
    tooltipNode.classList.toggle('warning', trigger?.classList.contains('warning') ?? false);
    tooltipNode.classList.toggle('selected', trigger?.classList.contains('selected') ?? false);
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
    } else {
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

document.addEventListener('mouseover', (event) => {
    const trigger = findTooltipTrigger(event.target);
    if (!trigger || trigger === activeTooltipTrigger) return;
    showTooltip(trigger);
});

document.addEventListener('mouseout', (event) => {
    const trigger = findTooltipTrigger(event.target);
    if (!trigger) return;

    const relatedTrigger = findTooltipTrigger(event.relatedTarget);
    if (trigger === relatedTrigger) return;
    hideTooltip(trigger);
    scheduleTooltipReset(trigger);
});

document.addEventListener('focusin', (event) => {
    const trigger = findTooltipTrigger(event.target);
    if (!trigger) return;
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
