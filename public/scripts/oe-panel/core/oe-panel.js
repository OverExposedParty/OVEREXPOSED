(function () {
  const buttons = [...document.querySelectorAll('[data-oe-panel-section]')];
  const contentTitle = document.getElementById('oe-panel-content-title');
  const contentGrid = document.getElementById('oe-panel-content-grid');
  const sections = window.OE_PANEL_SECTIONS || {};
  const widgets = window.OE_PANEL_WIDGETS;
  const panelData = window.OE_PANEL_DATA;
  const panelNavigation = window.OE_PANEL_NAVIGATION;
  const panelGrid = window.OE_PANEL_GRID.createPanelGrid({
    contentGrid,
    widgets
  });
  let activeRenderToken = 0;
  let activeSectionName = 'Dashboard';
  let pendingGridRequest = null;

  const { hydrateSectionConfig } = window.createOePanelSectionHydrator({
    panelData
  });

  async function setActiveSection(sectionName) {
    const renderToken = ++activeRenderToken;
    activeSectionName = sectionName;
    const sectionGridConfig =
      sections[sectionName] ||
      window.OE_PANEL_GRID.getFallbackGridConfig(sectionName);

    contentTitle.textContent = sectionName;
    contentGrid.setAttribute('aria-label', `${sectionName} panel containers`);
    contentGrid.replaceChildren();

    await (window.OE_PANEL_PALETTES?.ready || Promise.resolve());
    if (renderToken !== activeRenderToken) return;

    const hydratedGridConfig = await hydrateSectionConfig(
      sectionName,
      sectionGridConfig
    );
    if (renderToken !== activeRenderToken) return;

    contentGrid.replaceChildren(
      ...hydratedGridConfig.map((gridConfig, index) =>
        panelGrid.createPanelContainer(sectionName, gridConfig, index)
      )
    );

    panelNavigation.updateActiveButton(buttons, sectionName);

    if (pendingGridRequest?.section === sectionName) {
      const request = pendingGridRequest;
      pendingGridRequest = null;
      const targetContainer = contentGrid.querySelector(
        `[data-oe-panel-grid="${request.gridId}"]`
      );

      if (targetContainer && !request.query) {
        panelGrid.setExpandedContainer(targetContainer, true);
      }

      if (request.query || request.series) {
        window.dispatchEvent(
          new CustomEvent('oe-panel-table-search-request', {
            detail: {
              gridId: request.gridId,
              series: request.series,
              query: request.query,
              expandFirstMatch: request.expandFirstMatch
            }
          })
        );
      }
    }
  }

  panelNavigation.bindSidebarNavigation(buttons, setActiveSection);
  panelNavigation.bindSectionLinkRequests(
    ({ section, gridId, query, series, expandFirstMatch }) => {
      pendingGridRequest = {
        section,
        gridId,
        query,
        series,
        expandFirstMatch
      };
      setActiveSection(section);
    }
  );

  function refreshAdminLogsOnNextView() {
    panelData.clear('adminLogs');
    if (activeSectionName === 'Admin Logs') {
      setActiveSection('Admin Logs');
    } else if (activeSectionName === 'Dashboard') {
      setActiveSection('Dashboard');
    }
  }

  window.addEventListener('oe-panel-social-content-created', () => {
    refreshAdminLogsOnNextView();
    panelData.fetchSocialMediaData({ force: true }).then(() => {
      if (activeSectionName === 'Social Media') {
        setActiveSection('Social Media');
      }
    });
  });

  window.addEventListener('oe-panel-party-games-data-changed', () => {
    refreshAdminLogsOnNextView();
    panelData.clear('partyRooms');
    if (activeSectionName === 'Party Games') {
      setActiveSection('Party Games');
    }
  });

  window.addEventListener('oe-panel-oe-customisation-data-changed', () => {
    refreshAdminLogsOnNextView();
    panelData.clear('oeCustomisation');
    if (activeSectionName === 'OE Customisation') {
      setActiveSection('OE Customisation');
    }
  });

  window.addEventListener('oe-panel-achievements-data-changed', () => {
    refreshAdminLogsOnNextView();
    panelData.clear('achievements');
    if (activeSectionName === 'Achievements') {
      setActiveSection('Achievements');
    }
  });

  window.addEventListener('oe-panel-olings-data-changed', () => {
    refreshAdminLogsOnNextView();
    panelData.clear('olings');
    if (activeSectionName === 'oLings') {
      setActiveSection('oLings');
    }
  });

  window.addEventListener('oe-panel-shop-products-changed', () => {
    refreshAdminLogsOnNextView();
    panelData.clear('shopProducts');
    if (activeSectionName === 'Shop') {
      setActiveSection('Shop');
    }
  });

  window.addEventListener('oe-panel-users-data-changed', () => {
    refreshAdminLogsOnNextView();
    panelData.clear('users');
    if (activeSectionName === 'Users') {
      setActiveSection('Users');
    }
  });

  window.addEventListener(
    'oe-panel-admin-logs-data-changed',
    refreshAdminLogsOnNextView
  );

  setActiveSection(
    sections.Dashboard ? 'Dashboard' : buttons[0]?.dataset.oePanelSection
  );
})();
