(function () {
  function createOePanelSocialDownloadIcon() {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.classList.add('oe-panel-upload-video-icon');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');

    const path = document.createElementNS(
      'http://www.w3.org/2000/svg',
      'path'
    );
    path.setAttribute('d', 'M12 3v11m0 0 4-4m-4 4-4-4M5 17v2h14v-2');
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', 'currentColor');
    path.setAttribute('stroke-width', '2');
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('stroke-linejoin', 'round');

    svg.appendChild(path);
    return svg;
  }

  window.createOePanelSocialDownloadIcon = createOePanelSocialDownloadIcon;
})();
