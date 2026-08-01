function handleDoubleClick(event) {
  if (isTouchActive) return;

  const rect = container.getBoundingClientRect();
  const m = new DOMMatrixReadOnly(getComputedStyle(container).transform);
  const scale = m.a || 1;

  const clickX = (event.clientX - rect.left) / scale;
  const clickY = (event.clientY - rect.top) / scale;

  placeCard(event, clickX, clickY);
}

container.addEventListener("dblclick", handleDoubleClick);
