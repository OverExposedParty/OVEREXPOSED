

function handleDoubleClick(event) {
    if (isTouchActive) return;

    const rect = floatingContainer.getBoundingClientRect();
    const computedStyle = getComputedStyle(floatingContainer);
    const scale = parseFloat(computedStyle.transform.split(', ')[3]) || 1;

    const clickX = (event.clientX - rect.left) / scale;
    const clickY = (event.clientY - rect.top) / scale;

    placeCard(event, clickX, clickY);
}

wrapper.addEventListener("dblclick", handleDoubleClick);