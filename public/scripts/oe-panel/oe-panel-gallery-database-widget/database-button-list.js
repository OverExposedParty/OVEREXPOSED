(function () {
  function createOePanelDatabaseButtonListWidgetRenderer() {
    function getElementText(elementConfig) {
      if (elementConfig == null) {
        return '';
      }

      if (typeof elementConfig !== 'object') {
        return elementConfig;
      }

      return (
        elementConfig.text ?? elementConfig.value ?? elementConfig.label ?? ''
      );
    }

    function createSvgPath(className, pathData) {
      const path = document.createElementNS(
        'http://www.w3.org/2000/svg',
        'path'
      );
      path.classList.add(className);
      path.setAttribute('d', pathData);
      return path;
    }

    function createSvgRect(className, attributes) {
      const rect = document.createElementNS(
        'http://www.w3.org/2000/svg',
        'rect'
      );
      rect.classList.add(className);

      Object.entries(attributes).forEach(([key, value]) => {
        rect.setAttribute(key, value);
      });

      return rect;
    }

    function createAvatarSvg() {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.classList.add('oe-panel-database-button-svg');
      svg.setAttribute('viewBox', '0 0 320.2 316.54');
      svg.setAttribute('aria-hidden', 'true');

      svg.append(
        createSvgPath(
          'oe-panel-database-button-svg-secondary',
          'M153.03,316.42c-36.58,1.44-66.17-11.27-92.27-33.6-29.77-25.46-52.07-55.88-58.2-95.25-8.54-54.84,3.76-104.18,45-143.48C73.15,19.72,104.26,4.76,139.33,1.02c55.71-5.94,101.92,14.28,138.77,55.93,23.56,26.64,36.8,58.23,40.99,93.4,5.35,44.96-8.64,83.22-41.86,114.06-24.18,22.45-51.44,39.69-83.97,47.55-13.79,3.33-27.74,5.08-40.22,4.46Z'
        ),
        createSvgPath(
          'oe-panel-database-button-svg-primary',
          'M145.46,297.39c-11.96.92-27.52-.76-42.47-6.3-24.67-9.14-44.13-25.16-59.37-46.39-12.29-17.1-21.03-35.79-25.44-56.55-5.83-27.48-5.22-54.75,3.92-81.19,11.7-33.85,33.62-59.21,66.67-74.33,21.01-9.61,42.94-14.47,66.06-15.32,22.53-.83,44.15,2.5,64.6,11.76,24.72,11.2,44.31,28.62,59.11,51.41,15.66,24.12,23.9,50.83,26.47,79.18,1.6,17.66-1.86,35.06-8.53,51.43-13.45,33-36.76,57-68.88,72.32-16.56,7.89-33.89,12.66-52.46,13.15-8.59.23-17.18.57-29.69.82Z'
        ),
        createSvgPath(
          'oe-panel-database-button-svg-dark',
          'M94.71,223.97c8.62-2.56,9.44,4.7,14.22,8.95,20.91,18.61,70.09,16.02,94.07,4.45,7.62-3.68,21.88-18.63,28.45-10.99s-3.98,13.97-9.66,17.92c-30.6,21.24-88.55,25.53-119.22,2.9-5.55-4.1-20.84-19.37-7.85-23.23Z'
        ),
        createSvgPath(
          'oe-panel-database-button-svg-light',
          'M106.21,135.64c20.81-1.36,38.61,12.75,34.05,34.77s-30.1,32.77-49.29,22.08c-26.72-14.89-12.88-55.02,15.23-56.85Z'
        ),
        createSvgPath(
          'oe-panel-database-button-svg-light',
          'M210.13,136.12c13.52-1.01,22.91,3.39,30.34,14.63,16.85,25.49-6.23,52.45-34.43,44.75-32.89-8.98-33.26-56.59,4.08-59.38Z'
        ),
        createSvgPath(
          'oe-panel-database-button-svg-dark',
          'M107.17,154.35c13.52-.39,15.95,17.46,4.45,21.74-14.79,5.51-19.99-21.29-4.45-21.74Z'
        ),
        createSvgPath(
          'oe-panel-database-button-svg-dark',
          'M212.76,154.84c1.16-.14,2.82-.16,3.98-.04,13.4,1.41,9.23,25.93-4.89,21.93-11.39-3.22-10.45-20.53.91-21.89Z'
        )
      );

      return svg;
    }

    function createHourglassSvg() {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.classList.add('oe-panel-database-button-svg');
      svg.setAttribute('viewBox', '0 0 500 500');
      svg.setAttribute('aria-hidden', 'true');

      svg.append(
        createSvgPath(
          'oe-panel-database-button-svg-fill',
          'M250,54.52c46.46,0,85.03,26.3,85.03,81.96,0,45.58-38.57,71.88-60.48,95.55q-16.66,17.97,0,35.94c21.91,23.67,60.48,49.97,60.48,95.55,0,55.66-38.57,81.96-85.03,81.96s-85.03-26.3-85.03-81.96c0-45.58,38.57-71.88,60.48-95.55q16.66-17.97,0-35.94c-21.91-23.67-60.48-49.97-60.48-95.55,0-55.66,38.57-81.96,85.03-81.96Z'
        ),
        createSvgPath(
          'oe-panel-database-button-svg-fill',
          'M205 128h90c-4 35-31 57-45 72-14-15-41-37-45-72Z'
        ),
        createSvgPath(
          'oe-panel-database-button-svg-fill',
          'M250 300c16 18 42 38 45 72h-90c3-34 29-54 45-72Z'
        ),
        createSvgRect('oe-panel-database-button-svg-fill', {
          x: '144.05',
          y: '50',
          width: '211.91',
          height: '29.95',
          rx: '10.51',
          ry: '10.51'
        }),
        createSvgRect('oe-panel-database-button-svg-fill', {
          x: '144.05',
          y: '420.05',
          width: '211.91',
          height: '29.95',
          rx: '10.51',
          ry: '10.51'
        })
      );

      return svg;
    }

    function createGlobeSvg() {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.classList.add('oe-panel-database-button-svg');
      svg.setAttribute('viewBox', '0 0 500 500');
      svg.setAttribute('aria-hidden', 'true');
      svg.append(
        createSvgPath(
          'oe-panel-database-button-svg-fill',
          'M226.54,27.47c111.29-6.36,205.5,49.7,238.17,157.93,54.14,179.37-114.43,336.64-290.65,273.35C33.66,408.32-20.95,238.29,68.79,116.88,104.8,68.16,165.2,30.97,226.54,27.47ZM241.19,43.74c-19.33-.97-35.14,17.32-45.08,31.95-12.56,18.5-22.1,40.97-29.25,62.11l75.43,1.12-1.11-95.18ZM258.94,138.91h72.66c1.19,0,1.63-2.25,1.48-3.59-.45-3.97-5.53-14.87-7.38-19.29-9.23-22.08-25.79-54.88-47.15-66.94-7.34-4.14-12.07-5.06-20.72-4.24l1.12,94.07ZM194.6,49.29c-41.8,11.58-80.68,37.51-107.57,71.4-1.34,1.68-10.09,12.73-8.9,13.8l70.84,3.17c10.58-31.52,24.54-62.44,45.63-88.36ZM419.78,132.27c.87-.96-2.18-4.32-2.91-5.39-24.28-35.69-65.92-64.41-108.02-74.27,19.49,25.17,32.82,54.78,42.26,85.09l68.66-5.43ZM430.72,147.93l-74.16,6.48c7.46,31.09,11.71,63.11,11.08,95.17l89.86-6.64c-.25-33.44-11.69-65.64-26.79-95.01ZM143.57,154.41l-76.53-2.76c-16.35,28.2-25.4,60.79-25.53,93.51l90.97,5.53c0-32.49,4.21-64.65,11.09-96.28ZM242.3,156.62l-80.88-2.11c-8.4,31.76-11.68,64.45-12.31,97.28l93.19,2.21v-97.38ZM351.01,250.69c-.1-31.81-2.84-64.19-12.16-94.66l-79.92.59,1.11,97.39,90.97-3.32ZM458.61,259.54l-90.52,7.64c-2.85,2.24-1.18,11.13-1.57,15.04-2.76,27.75-7.49,55.5-14.41,82.45,20.82-.44,42.96-.11,63.46-3.64,3.38-.58,10.77-1.55,13.17-3.46,2.44-1.94,9.46-16.09,11.19-19.82,11.48-24.61,17.27-51.1,18.66-78.21ZM146.9,361.34l-14.35-93.58-89.93-6.02c1.55,31.36,12.12,62.97,28.2,89.73,25.05,5.05,50.54,8.38,76.08,9.87ZM242.3,270.6c-30.7.2-61.45-.52-92.07-2.22,1.55,32.13,7.24,64.06,15.68,95.03l76.39,2.36v-95.17ZM260.05,270.6v95.17l74.18-1.25c9.46-31.09,14.48-63.65,15.68-96.14l-89.86,2.22ZM193.49,446.54c-14.59-21.48-29.46-43.07-39.92-66.96l-69.9-8.28c-.88.76,3.21,5.48,3.99,6.52,25.74,34.5,64.07,58.34,105.82,68.71ZM414.24,377.95c-22.71,3.28-45.65,3.28-68.62,3.46-9.75,24.59-25.68,46.65-41.17,67.92,43.24-9.84,83.17-36.11,109.8-71.38ZM242.3,382.37l-69.9-1.65c6.26,13.12,14.13,25.55,22.17,37.64,6.5,9.77,16.69,26.05,24.93,33.79,5.36,5.04,16.03,3.29,22.8,5.48v-75.25ZM258.94,382.37v75.25c12.12-1.74,16.26.53,24.98-8.84,17.23-18.51,31.08-45.74,43.8-67.51l-68.78,1.1Z'
        )
      );
      return svg;
    }

    function createConfiguredSvg(svgConfig) {
      const svgName =
        typeof svgConfig === 'string'
          ? svgConfig
          : svgConfig?.name || svgConfig?.type;

      if (svgName === 'avatar') {
        return createAvatarSvg();
      }

      if (svgName === 'hourglass') {
        return createHourglassSvg();
      }

      if (svgName === 'globe') {
        return createGlobeSvg();
      }

      return null;
    }

    function getConfiguredElements(gridConfig) {
      if (Array.isArray(gridConfig.elements)) {
        return gridConfig.elements.map((elementConfig, index) =>
          typeof elementConfig === 'string'
            ? { id: elementConfig }
            : {
                id: elementConfig?.id || `element-${index + 1}`,
                ...elementConfig
              }
        );
      }

      if (Array.isArray(gridConfig.elementIds)) {
        return gridConfig.elementIds.map((id) => ({ id }));
      }

      const elementCount = Number(gridConfig.elementCount);
      if (Number.isInteger(elementCount) && elementCount > 0) {
        return Array.from({ length: elementCount }, (_, index) => ({
          id: `element-${index + 1}`
        }));
      }

      return [];
    }

    function getButtonElements(buttonConfig, gridConfig) {
      const configuredElements = getConfiguredElements(gridConfig);
      const buttonElements = buttonConfig.elements;

      if (configuredElements.length) {
        return configuredElements.map((elementConfig) => {
          const matchingElement = Array.isArray(buttonElements)
            ? buttonElements.find((element) => element?.id === elementConfig.id)
            : buttonElements?.[elementConfig.id];
          const matchingConfig =
            matchingElement && typeof matchingElement === 'object'
              ? matchingElement
              : {};

          return {
            ...elementConfig,
            ...matchingConfig,
            text: getElementText(matchingElement ?? elementConfig)
          };
        });
      }

      if (Array.isArray(buttonElements)) {
        return buttonElements.map((elementConfig, index) =>
          typeof elementConfig === 'string'
            ? { id: `element-${index + 1}`, text: elementConfig }
            : {
                id: elementConfig?.id || `element-${index + 1}`,
                ...elementConfig,
                text: getElementText(elementConfig)
              }
        );
      }

      if (buttonElements && typeof buttonElements === 'object') {
        return Object.entries(buttonElements).map(([id, value]) => ({
          id,
          text: getElementText(value)
        }));
      }

      return [];
    }

    function createDatabaseButton(buttonConfig, gridConfig) {
      const button = document.createElement('button');
      button.className = 'oe-panel-database-button';
      button.type = 'button';
      button.dataset.oePanelDatabase =
        buttonConfig.id || buttonConfig.value || buttonConfig.leftText || '';

      const leftText = document.createElement('span');
      leftText.className = 'oe-panel-database-button-left';
      leftText.textContent =
        buttonConfig.leftText ||
        buttonConfig.label ||
        buttonConfig.value ||
        gridConfig.title;

      const elements = getButtonElements(buttonConfig, gridConfig);
      const elementsContainer = document.createElement('span');
      elementsContainer.className = 'oe-panel-database-button-elements';
      elementsContainer.style.gridTemplateColumns = elements.length
        ? elements
            .map((elementConfig) => elementConfig.width || 'minmax(0, 1fr)')
            .join(' ')
        : 'none';

      elements.forEach((elementConfig) => {
        const element = document.createElement('span');
        element.className = 'oe-panel-database-button-element';
        element.dataset.oePanelElementId = elementConfig.id;

        const svg = createConfiguredSvg(elementConfig.svg);
        if (svg) {
          const icon = document.createElement('span');
          icon.className = 'oe-panel-database-button-element-icon';
          icon.appendChild(svg);
          element.appendChild(icon);
        }

        const elementText = getElementText(elementConfig);
        if (elementText) {
          const text = document.createElement('span');
          text.className = 'oe-panel-database-button-element-text';
          text.textContent = elementText;
          element.appendChild(text);
        }

        elementsContainer.appendChild(element);
      });

      const status = buttonConfig.status || 'unknown';
      const statusIndicator = document.createElement('span');
      statusIndicator.className = 'oe-panel-database-button-status';
      statusIndicator.setAttribute('aria-label', `${status} status`);
      statusIndicator.style.setProperty(
        '--oe-panel-database-button-status-colour',
        buttonConfig.statusColour || '#8f9398'
      );

      button.append(leftText, elementsContainer, statusIndicator);

      return button;
    }

    function renderDatabaseButtonListWidget(container, gridConfig) {
      const widget = document.createElement('div');
      widget.className =
        'oe-panel-widget oe-panel-widget-database-button-list';
      const buttonList = document.createElement('div');
      buttonList.className = 'oe-panel-database-button-list';
      const buttonListRows = document.createElement('div');
      buttonListRows.className = 'oe-panel-database-button-list-rows';

      if (gridConfig.title) {
        const buttonListTitle = document.createElement('h3');
        buttonListTitle.className = 'oe-panel-database-button-list-title';
        buttonListTitle.textContent = gridConfig.title;
        buttonList.appendChild(buttonListTitle);
      }

      const buttons = Array.isArray(gridConfig.buttons)
        ? gridConfig.buttons
        : [];
      const buttonConfigs = buttons.length
        ? buttons
        : [{ label: gridConfig.title, value: gridConfig.id }];

      buttonConfigs.forEach((buttonConfig) => {
        const button = createDatabaseButton(buttonConfig, gridConfig);
        buttonListRows.appendChild(button);
      });

      buttonList.appendChild(buttonListRows);
      widget.appendChild(buttonList);

      if (gridConfig.bottomButtonText) {
        const bottomButton = document.createElement('button');
        bottomButton.className = 'oe-panel-database-action-button';
        bottomButton.type = 'button';
        bottomButton.textContent = gridConfig.bottomButtonText;

        if (gridConfig.bottomButtonValue) {
          bottomButton.dataset.oePanelDatabaseAction =
            gridConfig.bottomButtonValue;
        }

        buttonList.appendChild(bottomButton);
      }

      container.appendChild(widget);
    }

    return renderDatabaseButtonListWidget;
  }

  window.createOePanelDatabaseButtonListWidgetRenderer =
    createOePanelDatabaseButtonListWidgetRenderer;
})();
