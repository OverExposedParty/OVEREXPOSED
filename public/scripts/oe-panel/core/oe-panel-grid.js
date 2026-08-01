(function () {
  function getFallbackGridConfig(sectionName) {
    return Array.from({ length: 4 }, (_, index) => ({
      id: `${sectionName.toLowerCase()}-grid-${index + 1}`,
      type: 'empty',
      title: `${sectionName} Grid ${index + 1}`
    }));
  }

  function getGridSpan(value) {
    const parsedValue = Number(value);
    return Number.isInteger(parsedValue)
      ? Math.min(Math.max(parsedValue, 1), 2)
      : 1;
  }

  function createPanelGrid({ contentGrid, widgets }) {
    function setExpandedContainer(container, shouldExpand) {
      const siblingContainers = [
        ...contentGrid.querySelectorAll('.oe-panel-content-container')
      ];

      siblingContainers.forEach((siblingContainer) => {
        const wasExpanded = siblingContainer.classList.contains('expanded');
        const isExpandedContainer =
          siblingContainer === container && shouldExpand;
        const expandButton = siblingContainer.querySelector(
          '.oe-panel-grid-expand-button'
        );

        siblingContainer.classList.toggle('expanded', isExpandedContainer);
        siblingContainer.classList.toggle(
          'compressed',
          shouldExpand && siblingContainer !== container
        );

        if (expandButton) {
          expandButton.setAttribute(
            'aria-expanded',
            String(isExpandedContainer)
          );
          expandButton.setAttribute(
            'aria-label',
            isExpandedContainer ? 'Shrink widget' : 'Expand widget'
          );
        }

        if (wasExpanded && !isExpandedContainer) {
          siblingContainer.dispatchEvent(
            new CustomEvent('oe-panel-container-shrunk', { bubbles: true })
          );
        }

        if (!wasExpanded && isExpandedContainer) {
          siblingContainer.dispatchEvent(
            new CustomEvent('oe-panel-container-expanded', { bubbles: true })
          );
        }
      });

      contentGrid.classList.toggle('has-expanded-container', shouldExpand);
    }

    function createGridExpandButton(container) {
      const button = document.createElement('button');
      button.className = 'oe-panel-grid-expand-button';
      button.type = 'button';
      button.setAttribute('aria-label', 'Expand widget');
      button.setAttribute('aria-expanded', 'false');

      button.addEventListener('click', (event) => {
        event.stopPropagation();
        setExpandedContainer(
          container,
          !container.classList.contains('expanded')
        );
      });

      return button;
    }

    function createPanelContainer(sectionName, gridConfig, index) {
      const gridId =
        gridConfig?.id || `${sectionName.toLowerCase()}-grid-${index + 1}`;
      const resolvedGridConfig = {
        ...gridConfig,
        id: gridId,
        type: gridConfig?.type || 'empty',
        title: gridConfig?.title || gridId,
        columnSpan: getGridSpan(gridConfig?.columnSpan),
        rowSpan: getGridSpan(gridConfig?.rowSpan)
      };
      const container = document.createElement('section');
      container.className = 'oe-panel-content-container';
      container.dataset.oePanelSection = sectionName;
      container.dataset.oePanelContainer = String(index + 1);
      container.dataset.oePanelGrid = resolvedGridConfig.id;
      container.dataset.oePanelWidgetType = resolvedGridConfig.type;
      container.setAttribute('aria-label', resolvedGridConfig.title);
      container.style.setProperty(
        '--oe-panel-column-span',
        resolvedGridConfig.columnSpan
      );
      container.style.setProperty(
        '--oe-panel-row-span',
        resolvedGridConfig.rowSpan
      );

      if (resolvedGridConfig.backgroundColour) {
        container.style.setProperty(
          '--oe-panel-widget-background-colour',
          resolvedGridConfig.backgroundColour
        );
      }

      if (resolvedGridConfig.primaryColour) {
        container.style.setProperty(
          '--oe-panel-widget-primary-colour',
          resolvedGridConfig.primaryColour
        );
      }

      if (resolvedGridConfig.secondaryColour) {
        container.style.setProperty(
          '--oe-panel-widget-secondary-colour',
          resolvedGridConfig.secondaryColour
        );
      }

      widgets.render(container, resolvedGridConfig);
      container.appendChild(createGridExpandButton(container));
      container.addEventListener('oe-panel-request-expand', () => {
        setExpandedContainer(container, true);
      });
      container.addEventListener('oe-panel-request-shrink', () => {
        setExpandedContainer(container, false);
      });

      return container;
    }

    return {
      createPanelContainer,
      setExpandedContainer
    };
  }

  window.OE_PANEL_GRID = {
    createPanelGrid,
    getFallbackGridConfig
  };
})();
