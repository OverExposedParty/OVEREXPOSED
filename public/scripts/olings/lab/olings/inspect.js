(function () {
  function createOlingLabInspectTools({ state, helpers, previewTools = {}, buildTools = {} }) {
    const {
      closeMenu,
      closeStagePanel,
      applyRarityTheme,
      createDetailRow,
      createImage,
      createInlineAction,
      createPanelBackButton,
      createStatsToggleButton,
      createTabMenu,
      formatTitle,
      openStagePanel,
      openMenu
    } = helpers;

    const {
      getOlingId,
      getDisplayedEnergy,
      createPreview,
      createEnergyMeter
    } = previewTools;
    const { createBuildPresentation } = buildTools;

    function createOverviewTab(oling) {
      const section = document.createElement('section');
      section.className = 'oling-lab-menu-section oling-lab-oling-info';
      const stage = document.createElement('section');
      stage.className = 'oling-lab-egg-insertion-stage oling-lab-oling-info-stage';
      const hero = document.createElement('div');
      hero.className = 'oling-lab-oling-hero';
      const nameEditor = document.createElement('div');
      nameEditor.className = 'oling-lab-oling-name-editor';
      const nameText = Object.assign(document.createElement('strong'), {
        textContent: oling?.name || 'Oling'
      });
      const positionNameControls = (target) => {
        requestAnimationFrame(() => {
          nameEditor.style.setProperty('--oling-name-control-offset', `${target.offsetWidth / 2 + 6}px`);
        });
      };
      const editButton = document.createElement('button');
      editButton.type = 'button'; editButton.className = 'oling-lab-oling-name-edit'; editButton.setAttribute('aria-label', 'Edit Oling name'); editButton.textContent = '✎';
      const startEditing = () => {
        const input = Object.assign(document.createElement('input'), { value: oling?.name || 'Oling', maxLength: 40, placeholder: 'Name your Oling' });
        const cancel = document.createElement('button'); cancel.type = 'button'; cancel.className = 'is-cancel'; cancel.textContent = '×';
        const save = document.createElement('button'); save.type = 'button'; save.className = 'is-save'; save.textContent = '✓';
        cancel.addEventListener('click', () => { nameEditor.replaceChildren(nameText, editButton); positionNameControls(nameText); });
        save.addEventListener('click', async () => {
          const response = await fetch(`/api/olings/${encodeURIComponent(getOlingId(oling))}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ name: input.value }) });
          const payload = await response.json().catch(() => ({}));
          if (!response.ok || payload.success === false) return helpers.setStatus?.(payload.error?.message || 'Could not update the Oling name.');
          replaceOling(payload.oling); oling.name = payload.oling.name; nameText.textContent = oling.name || 'Oling'; document.getElementById('oling-lab-menu-title').textContent = oling.name || 'Oling'; nameEditor.replaceChildren(nameText, editButton); positionNameControls(nameText);
        });
        input.addEventListener('keydown', (event) => {
          if (event.key !== 'Enter') return;
          event.preventDefault();
          save.click();
        });
        nameEditor.replaceChildren(input, cancel, save); input.focus();
        positionNameControls(input);
      };
      editButton.addEventListener('click', startEditing);
      nameEditor.append(nameText, editButton);
      positionNameControls(nameText);
      hero.append(
        createEnergyMeter(oling),
        nameEditor,
        createPreview(oling)
      );
      const panel = document.createElement('aside');
      panel.className = 'oling-lab-side-panel oling-lab-oling-info-panel';
      let viewingInfo = false;
      const syncInfoButton = () => {
        const label = viewingInfo ? 'Close Oling details' : 'View Oling details';
        hero.setAttribute('aria-label', label);
        hero.querySelector('.oling-lab-stats-toggle')?.setAttribute('aria-label', label);
      };
      const closeInfo = () => {
        viewingInfo = false;
        syncInfoButton();
        closeStagePanel(stage, panel, 'is-viewing-oling-info');
      };
      hero.appendChild(
        createStatsToggleButton('View Oling details', (event) => {
          event.stopPropagation();
          if (viewingInfo) {
            closeInfo();
            return;
          }
          viewingInfo = true;
          syncInfoButton();
          openStagePanel(stage, panel, 'is-viewing-oling-info');
        })
      );
      panel.appendChild(createPanelBackButton('Back from Oling details', closeInfo));
      panel.appendChild(
        Object.assign(document.createElement('h3'), {
          textContent: 'Oling'
        })
      );
      const details = document.createElement('div');
      details.className = 'oling-lab-detail-list';
      details.append(
        createDetailRow('Name', oling?.name || 'Oling'),
        createDetailRow(
          'Personality',
          oling?.personality?.name ||
            formatTitle(oling?.personalityKey || 'Unknown')
        ),
        createDetailRow('Set', oling?.matchingSet?.name || 'Mixed'),
        createDetailRow('Egg', formatTitle(oling?.eggKey || 'Unknown'))
      );
      panel.appendChild(details);
      stage.append(hero, panel);
      section.appendChild(stage);
      return [section];
    }

    function createStatsTab(oling) {
      const section = document.createElement('section');
      section.className = 'oling-lab-menu-section';
      const energy = getDisplayedEnergy(oling?.care?.energy);
      const maxEnergy = getDisplayedEnergy(oling?.care?.maxEnergy);
      const exhausted = energy === 0;
      const details = document.createElement('div');
      details.className = 'oling-lab-detail-list';
      details.append(
        createDetailRow('Energy', `${energy}/${maxEnergy}`),
        createDetailRow('Care status', exhausted ? 'Exhausted — Needs a Snack' : 'Ready'),
        createDetailRow('Level', String(oling?.level || 1)),
        createDetailRow('XP', String(oling?.xp || 0)),
        createDetailRow('Rarity', formatTitle(oling?.rarity || 'Mixed')),
        createDetailRow('Collection', formatTitle(oling?.collection || 'Base'))
      );
      section.appendChild(details);
      return [section];
    }

    function createBuildTab(oling) {
      return createBuildPresentation(oling);
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
      const index = state.olings.findIndex((item) => getOlingId(item) === olingId);
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
        throw new Error(payload.error?.message || 'That activity could not start.');
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
        .map((owned) => ({ owned, consumable: state.consumables.get(owned.key) }))
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
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({ consumableKey: snack.consumable.key })
          }
        );
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || payload.success === false) {
          throw new Error(payload.error?.message || 'That snack could not be used.');
        }
        replaceOling(payload.oling);
        snack.owned.quantity = Number(payload.inventoryChange?.quantityAfter || 0);
        state.ownedConsumables = state.ownedConsumables.filter(
          (owned) => Number(owned.quantity || 0) > 0
        );
        helpers.setStatus?.(`${oling.name || 'Your Oling'} enjoyed a snack and feels more energetic.`);
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
      const tiredTitle = exhausted ? 'This Oling is Exhausted and needs a snack.' : '';
      actions.append(
        createOlingActionButton('Battle', () => requestOlingBattle(oling), {
          className: 'is-battle-action',
          disabled: exhausted,
          title: tiredTitle
        }),
        createOlingActionButton('Feed', () => feedOling(oling)),
        createOlingActionButton('Play', () => requestOlingActivity(oling, 'play').catch((error) => helpers.setStatus?.(error.message)), { disabled: exhausted, title: tiredTitle }),
        createOlingActionButton('Train', () => requestOlingActivity(oling, 'train').catch((error) => helpers.setStatus?.(error.message)), { disabled: exhausted, title: tiredTitle }),
        createOlingActionButton('Rest', closeMenu),
        createOlingActionButton('Roam', () => requestOlingActivity(oling, 'roam').catch((error) => helpers.setStatus?.(error.message)), { disabled: exhausted, title: tiredTitle })
      );
      section.appendChild(actions);
      return section;
    }

    function openOlingMenu(olingId) {
      const oling = state.olings.find((item) => getOlingId(item) === olingId);
      if (!oling) return;
      openMenu(
        oling.name || 'Oling',
        [
          createTabMenu([
            { label: 'Overview', content: () => createOverviewTab(oling) },
            { label: 'Stats', content: () => createStatsTab(oling) },
            { label: 'Build', content: () => createBuildTab(oling) }
          ])
        ],
        {
          theme: 'oling-profile',
          selectedTarget: {
            type: 'oling',
            id: olingId
          }
        }
      );
    }

    return { openOlingMenu };
  }

  window.createOlingLabInspectTools = createOlingLabInspectTools;
})();
