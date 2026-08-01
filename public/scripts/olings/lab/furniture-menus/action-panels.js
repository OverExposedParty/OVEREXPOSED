(function () {
  function createOlingLabFurnitureActionPanels(dependencies) {
    const {
      state,
      elements,
      getRoaming,
      getOlingViews,
      getItem,
      resolveMenuConfig,
      applyActionPanelTheme,
      getTargetKey,
      closeSelectedTarget,
      openFurnitureEditor,
      interactWithFurniture,
      getFurnitureInteractionAction,
      storeRoomItem,
      renderLab
    } = dependencies;

function getRequiredService(getService, label) {
      const service = getService();
      if (!service) throw new Error(`${label} is not ready.`);
      return service;
    }

    function requestSellFurniture(placedId) {
      const target = { type: 'furniture', id: placedId };
      state.selectedTarget = target;
      state.sellConfirmTarget =
        getTargetKey(state.sellConfirmTarget) === getTargetKey(target)
          ? null
          : target;
      renderLab();
    }

    function cancelSellFurniture() {
      closeSelectedTarget();
      renderLab();
    }

    function createActionButton(label, modifier, onClick, options = {}) {
      const button = document.createElement('button');
      button.className = `oling-lab-action-panel-button ${modifier}`;
      button.type = 'button';
      button.disabled = Boolean(options.disabled);
      button.setAttribute('aria-label', label);
      button.textContent = options.text || label;
      if (options.theme || options.themeKey) {
        const theme = resolveMenuConfig({
          theme: options.theme || options.themeKey
        });
        if (theme.primaryColour) {
          button.style.setProperty(
            '--oling-lab-action-button-hover-colour',
            theme.primaryColour
          );
        }
        if (theme.secondaryColour) {
          button.style.setProperty(
            '--oling-lab-action-button-colour',
            theme.secondaryColour
          );
        }
      }
      button.addEventListener('click', (event) => {
        event.stopPropagation();
        if (!button.disabled) onClick();
      });
      return button;
    }

    function createFurnitureActionPanel(placed, item) {
      const panel = document.createElement('div');
      panel.className = 'oling-lab-action-panel';
      panel.setAttribute('role', 'menu');
      panel.setAttribute('aria-label', `${item.name} actions`);
      panel.style.setProperty('--target-row', placed.row);
      panel.style.setProperty('--target-col', placed.col);
      panel.style.setProperty('--target-width', placed.width);
      panel.style.setProperty('--target-height', placed.height);
      applyActionPanelTheme(panel, { theme: 'olings-lab' });

      if (
        getTargetKey(state.sellConfirmTarget) ===
        getTargetKey({ type: 'furniture', id: placed.placedId })
      ) {
        panel.classList.add('is-confirming-sell');
        panel.append(
          createActionButton('Cancel sell', 'is-cancel', cancelSellFurniture, {
            text: 'Cancel'
          }),
          createActionButton(
            `Confirm sell ${item.name}`,
            'is-confirm',
            () => storeRoomItem(placed.placedId),
            { text: 'Confirm' }
          )
        );
        return panel;
      }

      const interactionAction = getFurnitureInteractionAction(placed, item);
      panel.append(
        createActionButton('Edit furniture', 'is-edit', () =>
          openFurnitureEditor(placed.placedId)
        ),
        createActionButton(
          placed.locked ? 'This furniture cannot be sold' : 'Sell furniture',
          'is-sell',
          () => requestSellFurniture(placed.placedId),
          { disabled: placed.locked }
        ),
        createActionButton(
          interactionAction.label,
          'is-interact',
          () => interactWithFurniture(placed.placedId),
          {
            disabled: interactionAction.disabled,
            theme: interactionAction.theme
          }
        )
      );

      return panel;
    }

    function createOlingActionPanel(oling) {
      const id = getRequiredService(getRoaming, 'Oling roaming').getOlingId(
        oling
      );
      const roamState = getRequiredService(
        getRoaming,
        'Oling roaming'
      ).getRoamState(id);
      if (!roamState) return null;

      const panel = document.createElement('div');
      panel.className = 'oling-lab-action-panel is-oling';
      panel.setAttribute('role', 'menu');
      panel.setAttribute('aria-label', `${oling.name || 'Oling'} actions`);
      panel.style.setProperty('--oling-panel-x', `${roamState.x}px`);
      panel.style.setProperty('--oling-panel-y', `${roamState.y}px`);
      panel.style.setProperty('--oling-panel-size', `${roamState.size}px`);
      applyActionPanelTheme(panel, { theme: 'oling-profile' });
      panel.append(
        createActionButton(
          'Inspect Oling',
          'is-interact',
          () =>
            getRequiredService(getOlingViews, 'Oling views').openOlingMenu(id),
          { text: 'Inspect' }
        ),
        createActionButton(
          'Let Oling roam',
          'is-edit',
          () => {
            closeSelectedTarget();
            renderLab();
          },
          {
            text: 'Roam'
          }
        )
      );

      return panel;
    }

    function createActionPanel() {
      if (!state.selectedTarget) {
        return null;
      }

      if (
        getTargetKey(state.selectedTarget) ===
        getTargetKey(state.menuSelectedTarget)
      ) {
        return null;
      }

      if (state.selectedTarget.type === 'oling') {
        const oling = state.olings.find(
          (item) =>
            getRequiredService(getRoaming, 'Oling roaming').getOlingId(item) ===
            state.selectedTarget.id
        );
        return oling ? createOlingActionPanel(oling) : null;
      }

      if (state.selectedTarget.type !== 'furniture') return null;

      const placed = state.lab.placedItems.find(
        (item) => item.placedId === state.selectedTarget.id
      );
      const item = getItem(placed?.itemId);
      if (!placed || !item) return null;

      return createFurnitureActionPanel(placed, item);
    }

    function updateSelectedOlingPanel() {
      const actionPanel = elements.actionPanel;
      if (state.selectedTarget?.type !== 'oling' || !actionPanel) return;

      const roamState = getRequiredService(
        getRoaming,
        'Oling roaming'
      ).getRoamState(state.selectedTarget.id);
      if (!roamState) return;

      actionPanel.style.setProperty('--oling-panel-x', `${roamState.x}px`);
      actionPanel.style.setProperty('--oling-panel-y', `${roamState.y}px`);
      actionPanel.style.setProperty(
        '--oling-panel-size',
        `${roamState.size}px`
      );
    }

    return { createActionPanel, updateSelectedOlingPanel };
  }

  window.createOlingLabFurnitureActionPanels =
    createOlingLabFurnitureActionPanels;
})();
