(function () {
  function createOlingLabInspectTools({
    state,
    elements = {},
    helpers,
    previewTools = {},
    buildTools = {}
  }) {
    const {
      closeMenu,
      applyRarityTheme,
      createImage,
      createInlineAction,
      createTabMenu,
      formatTitle,
      openMenu
    } = helpers;

    const { getOlingId, getDisplayedEnergy, createPreview, createEnergyMeter } =
      previewTools;
    const { createBuildPresentation } = buildTools;
    const panelTransitions = window.OlingLabPanelTransitions;
    const playSound = (key) => {
      if (typeof window.playSoundEffect === 'function') {
        Promise.resolve(window.playSoundEffect(key)).catch(() => {});
      }
    };

    function setPanelCollapsed(collapsed) {
      if (!state.olingPanelOpen) return;
      const changed = state.olingPanelCollapsed !== collapsed;
      state.olingPanelCollapsed = collapsed;
      elements.olingPanel.classList.toggle('is-collapsed', collapsed);
      elements.olingPanelToggle.textContent = collapsed ? 'Show' : 'Hide';
      elements.olingPanelToggle.setAttribute(
        'aria-expanded',
        String(!collapsed)
      );
      if (changed) playSound(collapsed ? 'sidePanelClose' : 'sidePanelOpen');
    }

    function closeOlingPanel({ sound = true, release = true } = {}) {
      const pendingClose = panelTransitions?.getPendingClose?.(
        elements.olingPanel
      );
      if (!state.olingPanelOpen) {
        return pendingClose || Promise.resolve(false);
      }
      const wasExpanded = !state.olingPanelCollapsed;
      const id = state.inspectedOlingId;
      state.olingPanelOpen = false;
      state.olingPanelCollapsed = false;
      state.inspectedOlingId = null;
      elements.olingPanelToggle.setAttribute('aria-expanded', 'false');
      if (
        release &&
        state.selectedTarget?.type === 'oling' &&
        state.selectedTarget.id === id
      ) {
        helpers.closeSelectedTarget?.();
        helpers.renderLab?.();
      }
      const playCloseSound = () => {
        if (sound && wasExpanded) playSound('sidePanelClose');
      };
      const cleanup = () => {
        elements.olingPanel.classList.remove('is-open', 'is-collapsed');
        elements.olingPanelContent.replaceChildren();
        if (elements.olingPanelTabs) {
          elements.olingPanelTabs.hidden = true;
          elements.olingPanelTabs.replaceChildren();
        }
      };
      if (panelTransitions) {
        return panelTransitions.close(elements.olingPanel, {
          beforeExit: playCloseSound,
          afterClose: cleanup
        });
      }
      playCloseSound();
      elements.olingPanel.hidden = true;
      cleanup();
      return Promise.resolve(true);
    }

    elements.olingPanelToggle?.addEventListener('click', () =>
      setPanelCollapsed(!state.olingPanelCollapsed)
    );
    const closePanelAndRestoreFocus = () => {
      const id = state.inspectedOlingId;
      closeOlingPanel();
      [...(elements.room?.querySelectorAll('.oling-lab-roamer') || [])]
        .find((roamer) => roamer.dataset.olingId === id)
        ?.focus();
    };
    elements.olingPanelBack?.addEventListener(
      'click',
      closePanelAndRestoreFocus
    );

    function getOverviewState(oling) {
      const energy = getDisplayedEnergy(oling?.care?.energy);
      return formatTitle(
        oling?.care?.status ||
          (oling?.care?.isSleeping
            ? 'sleeping'
            : energy === 0
              ? 'exhausted'
              : 'ready')
      );
    }

    function getOverviewRarityMakeup(oling) {
      const layers = state.layers?.length
        ? state.layers
        : ['flight', 'body', 'eyes', 'mouth'];
      let parts = layers
        .map((layer) => ({
          layer,
          rarity:
            oling?.buildRarities?.[layer] || oling?.traits?.[layer]?.rarity
        }))
        .filter(({ rarity }) => Boolean(rarity));
      if (!parts.length && oling?.matchingSet?.rarity) {
        parts = layers.map((layer) => ({
          layer,
          rarity: oling.matchingSet.rarity
        }));
      }
      return parts;
    }

    function getOverviewEggName(oling) {
      const egg = state.eggs?.get?.(oling?.eggKey);
      return egg?.name || formatTitle(oling?.eggKey || 'unknown');
    }

    function formatHatchedOn(value) {
      const date = value ? new Date(value) : null;
      if (!date || Number.isNaN(date.getTime())) return 'Unknown';
      return date.toLocaleDateString([], { dateStyle: 'medium' });
    }

    function createOverviewMetric(label, value, className = '') {
      const metric = document.createElement('article');
      metric.className = `oling-lab-oling-overview-metric ${className}`.trim();
      metric.append(
        Object.assign(document.createElement('h3'), {
          textContent: label
        }),
        Object.assign(document.createElement('strong'), {
          textContent: value
        })
      );
      return metric;
    }

    function createRarityMakeupMetric(oling, onSelectBuildPart) {
      const metric = document.createElement('article');
      metric.className = 'oling-lab-oling-overview-metric is-rarity-makeup';
      const makeup = getOverviewRarityMakeup(oling);
      const segments = document.createElement('div');
      segments.className = 'oling-lab-oling-rarity-segments';
      makeup.forEach(({ layer, rarity }) => {
        const segment = document.createElement('button');
        segment.className = 'oling-lab-oling-rarity-segment';
        const label = `${formatTitle(layer)}: ${formatTitle(rarity)}`;
        segment.type = 'button';
        segment.title = label;
        segment.setAttribute('aria-label', label);
        segment.dataset.olingBuildLayer = layer;
        segment.dataset.soundIntent = 'select';
        applyRarityTheme(segment, rarity);
        segment.addEventListener('click', () => onSelectBuildPart?.(layer));
        segments.appendChild(segment);
      });
      metric.append(
        Object.assign(document.createElement('h3'), {
          textContent: 'Rarity Makeup'
        }),
        segments
      );
      return metric;
    }

    function createOverviewTab(oling, onSelectBuildPart) {
      const section = document.createElement('section');
      section.className = 'oling-lab-menu-section oling-lab-oling-info';
      const stage = document.createElement('section');
      stage.className =
        'oling-lab-egg-insertion-stage oling-lab-oling-info-stage';
      const hero = document.createElement('div');
      hero.className = 'oling-lab-oling-hero';
      const nameEditor = document.createElement('div');
      nameEditor.className = 'oling-lab-oling-name-editor';
      const nameText = Object.assign(document.createElement('strong'), {
        textContent: oling?.name || 'Oling'
      });
      const positionNameControls = (target) => {
        requestAnimationFrame(() => {
          nameEditor.style.setProperty(
            '--oling-name-control-offset',
            `${target.offsetWidth / 2 + 6}px`
          );
        });
      };
      const editButton = document.createElement('button');
      editButton.type = 'button';
      editButton.className = 'oling-lab-oling-name-edit';
      editButton.setAttribute('aria-label', 'Edit Oling name');
      editButton.textContent = '✎';
      const startEditing = () => {
        const input = Object.assign(document.createElement('input'), {
          value: oling?.name || 'Oling',
          maxLength: 40,
          placeholder: 'Name your Oling'
        });
        const cancel = document.createElement('button');
        cancel.type = 'button';
        cancel.className = 'is-cancel';
        cancel.textContent = '×';
        const save = document.createElement('button');
        save.type = 'button';
        save.className = 'is-save';
        save.textContent = '✓';
        cancel.addEventListener('click', () => {
          nameEditor.replaceChildren(nameText, editButton);
          positionNameControls(nameText);
        });
        save.addEventListener('click', async () => {
          const response = await fetch(
            `/api/olings/${encodeURIComponent(getOlingId(oling))}`,
            {
              method: 'PATCH',
              headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json'
              },
              body: JSON.stringify({ name: input.value })
            }
          );
          const payload = await response.json().catch(() => ({}));
          if (!response.ok || payload.success === false)
            return helpers.setStatus?.(
              payload.error?.message || 'Could not update the Oling name.'
            );
          replaceOling(payload.oling);
          oling.name = payload.oling.name;
          nameText.textContent = oling.name || 'Oling';
          const title =
            elements.olingPanelTitle ||
            document.getElementById('oling-lab-menu-title');
          if (
            title &&
            (!elements.olingPanel ||
              state.inspectedOlingId === getOlingId(oling))
          ) {
            title.textContent = oling.name || 'Oling';
          }
          nameEditor.replaceChildren(nameText, editButton);
          positionNameControls(nameText);
        });
        input.addEventListener('keydown', (event) => {
          if (event.key !== 'Enter') return;
          event.preventDefault();
          save.click();
        });
        nameEditor.replaceChildren(input, cancel, save);
        input.focus();
        positionNameControls(input);
      };
      editButton.addEventListener('click', startEditing);
      nameEditor.append(nameText, editButton);
      positionNameControls(nameText);
      hero.append(nameEditor, createPreview(oling));
      stage.appendChild(hero);
      const summary = document.createElement('section');
      summary.className = 'oling-lab-oling-overview-summary';
      const energyRow = document.createElement('article');
      energyRow.className =
        'oling-lab-oling-overview-metric is-energy oling-lab-oling-overview-energy';
      const energyMeter = createEnergyMeter(oling);
      energyMeter.classList.add('is-overview-energy');
      energyRow.appendChild(energyMeter);
      const conditionRow = document.createElement('div');
      conditionRow.className = 'oling-lab-oling-overview-row';
      conditionRow.append(
        createOverviewMetric('State', getOverviewState(oling), 'is-state'),
        createRarityMakeupMetric(oling, onSelectBuildPart)
      );
      const historyRow = document.createElement('div');
      historyRow.className = 'oling-lab-oling-overview-row';
      historyRow.append(
        createOverviewMetric(
          'Egg Origin',
          getOverviewEggName(oling),
          'is-egg-origin'
        ),
        createOverviewMetric(
          'Hatched On',
          formatHatchedOn(oling?.hatchedAt || oling?.createdAt),
          'is-hatched-on'
        )
      );
      summary.append(energyRow, conditionRow, historyRow);
      section.append(stage, summary);
      return [section];
    }

    function createOlingTabMenu(oling) {
      let selectedBuildLayer = state.layers?.[0] || 'flight';
      let tabMenu;
      const selectBuildPart = (layer) => {
        selectedBuildLayer = layer;
        const buildTab =
          tabMenu?.querySelector('[data-oling-lab-tab="Build"]') ||
          elements.olingPanelTabs?.querySelector(
            '[data-oling-lab-tab="Build"]'
          );
        buildTab?.click();
      };
      tabMenu = createTabMenu([
        {
          label: 'Overview',
          content: () => createOverviewTab(oling, selectBuildPart)
        },
        {
          label: 'Build',
          content: () =>
            createBuildPresentation(oling, {
              selectedLayer: selectedBuildLayer,
              onSelectPart: (layer) => {
                selectedBuildLayer = layer;
              }
            })
        }
      ]);
      return tabMenu;
    }

    function createOlingActionButton(label, onClick, options = {}) {
      const button = document.createElement('button');
      button.className = 'oling-lab-oling-action-button';
      if (options.className) button.classList.add(options.className);
      button.type = 'button';
      button.disabled = Boolean(options.disabled);
      if (options.title) button.title = options.title;
      button.textContent = label;
      button.addEventListener('click', onClick);
      return button;
    }

    function replaceOling(updatedOling) {
      const olingId = getOlingId(updatedOling);
      const index = state.olings.findIndex(
        (item) => getOlingId(item) === olingId
      );
      if (index !== -1) state.olings[index] = updatedOling;
    }

    async function requestOlingActivity(oling, activityType) {
      const olingId = getOlingId(oling);
      const response = await fetch(
        `/api/olings/${encodeURIComponent(olingId)}/activities/${encodeURIComponent(activityType)}/start`,
        { method: 'POST', headers: { Accept: 'application/json' } }
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload.success === false) {
        throw new Error(
          payload.error?.message || 'That activity could not start.'
        );
      }
      replaceOling(payload.oling);
      helpers.setStatus?.(
        payload.oling?.care?.status === 'exhausted'
          ? `${oling.name || 'Your Oling'} is Exhausted and needs a snack.`
          : `${oling.name || 'Your Oling'} used ${payload.energyCost} Energy.`
      );
      return payload.oling;
    }

    async function requestOlingBattle(oling) {
      try {
        const updatedOling = await requestOlingActivity(oling, 'battle');
        const olingId = getOlingId(oling);
        window.dispatchEvent(
          new CustomEvent('oling-battle-requested', {
            detail: {
              oling: updatedOling,
              olingId
            }
          })
        );
        closeMenu();
      } catch (error) {
        helpers.setStatus?.(error.message);
      }
    }

    function getAvailableEnergySnack() {
      return state.ownedConsumables
        .filter((owned) => Number(owned.quantity || 0) > 0)
        .map((owned) => ({
          owned,
          consumable: state.consumables.get(owned.key)
        }))
        .filter(({ consumable }) => consumable?.effect?.type === 'energy')
        .sort(
          (left, right) =>
            Number(left.consumable.energyRestoreThreshold || 100) -
            Number(right.consumable.energyRestoreThreshold || 100)
        )[0];
    }

    async function feedOling(oling) {
      const snack = getAvailableEnergySnack();
      if (!snack) {
        helpers.setStatus?.('No Energy snacks available.');
        return;
      }
      try {
        const response = await fetch(
          `/api/olings/${encodeURIComponent(getOlingId(oling))}/consume`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Accept: 'application/json'
            },
            body: JSON.stringify({ consumableKey: snack.consumable.key })
          }
        );
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || payload.success === false) {
          throw new Error(
            payload.error?.message || 'That snack could not be used.'
          );
        }
        replaceOling(payload.oling);
        snack.owned.quantity = Number(
          payload.inventoryChange?.quantityAfter || 0
        );
        state.ownedConsumables = state.ownedConsumables.filter(
          (owned) => Number(owned.quantity || 0) > 0
        );
        helpers.setStatus?.(
          `${oling.name || 'Your Oling'} enjoyed a snack and feels more energetic.`
        );
        closeMenu();
      } catch (error) {
        helpers.setStatus?.(error.message);
      }
    }

    function createActionsSection(oling) {
      const section = document.createElement('section');
      section.className = 'oling-lab-menu-section oling-lab-oling-actions';
      const actions = document.createElement('div');
      actions.className = 'oling-lab-oling-action-grid';
      const exhausted = Number(oling?.care?.energy ?? 100) === 0;
      const tiredTitle = exhausted
        ? 'This Oling is Exhausted and needs a snack.'
        : '';
      actions.append(
        createOlingActionButton('Battle', () => requestOlingBattle(oling), {
          className: 'is-battle-action',
          disabled: exhausted,
          title: tiredTitle
        }),
        createOlingActionButton('Feed', () => feedOling(oling)),
        createOlingActionButton(
          'Play',
          () =>
            requestOlingActivity(oling, 'play').catch((error) =>
              helpers.setStatus?.(error.message)
            ),
          { disabled: exhausted, title: tiredTitle }
        ),
        createOlingActionButton(
          'Train',
          () =>
            requestOlingActivity(oling, 'train').catch((error) =>
              helpers.setStatus?.(error.message)
            ),
          { disabled: exhausted, title: tiredTitle }
        ),
        createOlingActionButton('Rest', closeMenu),
        createOlingActionButton(
          'Roam',
          () =>
            requestOlingActivity(oling, 'roam').catch((error) =>
              helpers.setStatus?.(error.message)
            ),
          { disabled: exhausted, title: tiredTitle }
        )
      );
      section.appendChild(actions);
      return section;
    }

    function openOlingMenu(olingId) {
      const oling = state.olings.find((item) => getOlingId(item) === olingId);
      if (!oling) return;
      if (elements.olingPanel) {
        if (state.olingPanelOpen && state.inspectedOlingId === olingId) {
          setPanelCollapsed(false);
          return;
        }
        const wasExpanded = state.olingPanelOpen && !state.olingPanelCollapsed;
        if (elements.backdrop && !elements.backdrop.hidden) closeMenu();
        helpers.closeIncubatorPanel?.({ sound: false });
        helpers.closeStoragePanel?.({ sound: false });
        helpers.closeRestPanel?.({ sound: false });
        helpers.closeGatewayPanel?.({ sound: false });
        state.selectedTarget = { type: 'oling', id: olingId };
        state.sellConfirmTarget = null;
        state.inspectedOlingId = olingId;
        state.olingPanelOpen = true;
        state.olingPanelCollapsed = false;
        const theme =
          helpers.resolveMenuConfig?.({ theme: 'oling-profile' }) || {};
        for (const [property, value] of [
          ['--wall-decoration-panel-primary', theme.primaryColour],
          ['--wall-decoration-panel-secondary', theme.secondaryColour]
        ]) {
          if (value) elements.olingPanel.style.setProperty(property, value);
        }
        elements.olingPanelTitle.textContent = oling.name || 'Oling';
        const tabMenu = createOlingTabMenu(oling);
        const tabList = tabMenu.querySelector?.(':scope > .oling-lab-tab-list');
        if (tabList && elements.olingPanelTabs) {
          tabMenu.classList.add('has-external-tabs');
          elements.olingPanelTabs.replaceChildren(tabList);
          elements.olingPanelTabs.hidden = false;
        }
        elements.olingPanelContent.replaceChildren(tabMenu);
        elements.olingPanelToggle.textContent = 'Hide';
        elements.olingPanelToggle.setAttribute('aria-expanded', 'true');
        helpers.renderLab?.();
        const afterOpen = () => {
          if (!wasExpanded) playSound('sidePanelOpen');
        };
        if (panelTransitions) {
          void panelTransitions.open(elements.olingPanel, { afterOpen });
        } else {
          elements.olingPanel.hidden = false;
          elements.olingPanel.classList.remove('is-collapsed');
          elements.olingPanel.classList.add('is-open');
          afterOpen();
        }
        return;
      }
      openMenu(oling.name || 'Oling', [createOlingTabMenu(oling)], {
        theme: 'oling-profile',
        selectedTarget: {
          type: 'oling',
          id: olingId
        }
      });
    }

    return { openOlingMenu, closeOlingPanel };
  }

  window.createOlingLabInspectTools = createOlingLabInspectTools;
})();
