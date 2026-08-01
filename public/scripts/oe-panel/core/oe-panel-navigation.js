(function () {
  function updateActiveButton(buttons, sectionName) {
    buttons.forEach((button) => {
      const isActive = button.dataset.oePanelSection === sectionName;
      button.classList.toggle('active', isActive);
      button.setAttribute('aria-pressed', String(isActive));
    });
  }

  function bindSidebarNavigation(buttons, onSelectSection) {
    buttons.forEach((button) => {
      button.addEventListener('click', () => {
        onSelectSection(button.dataset.oePanelSection);
      });
    });
  }

  function bindSectionLinkRequests(onRequest) {
    window.addEventListener('oe-panel-section-link-request', (event) => {
      const { section, gridId, query, series, expandFirstMatch } =
        event.detail || {};
      if (!section || !gridId) return;

      onRequest({ section, gridId, query, series, expandFirstMatch });
    });
  }

  window.OE_PANEL_NAVIGATION = {
    bindSectionLinkRequests,
    bindSidebarNavigation,
    updateActiveButton
  };
})();
