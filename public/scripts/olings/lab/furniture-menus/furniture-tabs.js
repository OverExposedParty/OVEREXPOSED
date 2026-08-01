(function () {
  function createOlingLabFurnitureTabs(dependencies) {
    const {
      state,
      rows: ROWS,
      applyRarityTheme,
      createImage,
      createStatsToggleButton,
      createPanelBackButton,
      createDetailRow,
      createInlineAction,
      createEmptyMessage,
      formatTitle,
      openStagePanel,
      closeStagePanel,
      getOccupiedMap,
      canMoveRoomItem,
      moveRoomItem,
      storeRoomItem
    } = dependencies;

function createFurnitureInfoTab(placed, item) {
      const section = document.createElement('section');
      section.className = 'oling-lab-menu-section oling-lab-furniture-info';
      const stage = document.createElement('section');
      stage.className =
        'oling-lab-egg-insertion-stage oling-lab-furniture-info-stage';
      const hero = document.createElement('div');
      hero.className = 'oling-lab-furniture-hero';
      hero.setAttribute('aria-label', 'View furniture details');
      applyRarityTheme(hero, placed.rarity || item.rarity);
      hero.append(
        createImage(item.image, item.name),
        Object.assign(document.createElement('strong'), {
          textContent: item.name || placed.itemId
        })
      );
      const panel = document.createElement('aside');
      panel.className = 'oling-lab-side-panel oling-lab-furniture-info-panel';
      let viewingInfo = false;
      const syncInfoButton = () => {
        const label = viewingInfo
          ? 'Close furniture details'
          : 'View furniture details';
        hero.setAttribute('aria-label', label);
        hero
          .querySelector('.oling-lab-stats-toggle')
          ?.setAttribute('aria-label', label);
      };
      const closeInfo = () => {
        viewingInfo = false;
        syncInfoButton();
        closeStagePanel(stage, panel, 'is-viewing-furniture-info');
      };
      hero.appendChild(
        createStatsToggleButton('View furniture details', (event) => {
          event.stopPropagation();
          if (viewingInfo) {
            closeInfo();
            return;
          }
          viewingInfo = true;
          syncInfoButton();
          openStagePanel(stage, panel, 'is-viewing-furniture-info');
        })
      );
      panel.appendChild(
        createPanelBackButton('Back from furniture details', closeInfo)
      );
      panel.appendChild(
        Object.assign(document.createElement('h3'), {
          textContent: 'Furniture'
        })
      );
      const details = document.createElement('div');
      details.className = 'oling-lab-detail-list';
      details.append(
        createDetailRow(
          'Type',
          formatTitle(item.category || item.type || 'Furniture')
        ),
        createDetailRow(
          'Rarity',
          formatTitle(placed.rarity || item.rarity || 'common'),
          {
            rarity: placed.rarity || item.rarity || 'common'
          }
        ),
        createDetailRow(
          'Size',
          `${Number(placed.width || 1)} x ${Number(placed.height || 1)}`
        ),
        createDetailRow(
          'Position',
          `${Number(placed.col || 0) + 1}, ${Number(placed.row || 0) + 1}`
        ),
        createDetailRow('Slots', String((item.containerSlots || []).length))
      );
      panel.appendChild(details);
      const actions = document.createElement('div');
      actions.className = 'oling-lab-item-influence-inventory-actions';
      actions.appendChild(
        createInlineAction(
          placed.locked ? 'Locked' : 'Store',
          () => storeRoomItem(placed.placedId),
          {
            className: 'is-remove-action',
            disabled: placed.locked
          }
        )
      );
      panel.appendChild(actions);
      stage.append(hero, panel);
      section.appendChild(stage);
      return [section];
    }

    function createFurnitureMoveTab(placed, item) {
      const section = document.createElement('section');
      section.className = 'oling-lab-menu-section';
      const stage = document.createElement('div');
      stage.className = 'oling-lab-furniture-move-stage';
      if (placed.locked) {
        stage.appendChild(createEmptyMessage('Locked furniture cannot move.'));
        section.appendChild(stage);
        return [section];
      }

      const grid = document.createElement('div');
      grid.className = 'oling-lab-move-grid';
      grid.style.setProperty('--move-columns', state.lab.columns);
      const occupied = getOccupiedMap();
      for (let row = 0; row < ROWS; row += 1) {
        for (let col = 0; col < state.lab.columns; col += 1) {
          const isCurrent = row === placed.row && col === placed.col;
          const occupant = occupied.get(`${row}:${col}`);
          const isOccupied = Boolean(
            occupant && occupant.placedId !== placed.placedId
          );
          const canMove = canMoveRoomItem(placed, item, row, col);
          const button = document.createElement('button');
          button.className = 'oling-lab-move-cell';
          button.type = 'button';
          button.dataset.sound = 'olingLabMove';
          button.disabled = !canMove || isCurrent;
          button.classList.toggle('is-current', isCurrent);
          button.classList.toggle('is-occupied', isOccupied);
          button.classList.toggle(
            'is-unavailable',
            !canMove && !isOccupied && !isCurrent
          );
          button.style.gridColumn = String(col + 1);
          button.style.gridRow = String(row + 1);
          button.textContent = isCurrent
            ? 'Here'
            : isOccupied
              ? 'Used'
              : canMove
                ? `${col + 1},${row + 1}`
                : '-';
          button.addEventListener('click', () =>
            moveRoomItem(placed.placedId, row, col)
          );
          grid.appendChild(button);
        }
      }
      stage.appendChild(grid);
      section.appendChild(stage);
      return [section];
    }

    return { createFurnitureInfoTab, createFurnitureMoveTab };
  }

  window.createOlingLabFurnitureTabs = createOlingLabFurnitureTabs;
})();
