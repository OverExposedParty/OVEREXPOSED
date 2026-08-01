(function () {
  function createOlingLabIncubatorIncubation(dependencies) {
    const {
      state,
      elements,
      itemInfluenceSlots,
      labEndpoint,
      setStatus,
      startIncubatorCountdown,
      parsePayload,
      getItem,
      getEgg,
      getConsumable,
      applyRarityTheme,
      getAvailableEggQuantity,
      createImage,
      getEggImage,
      createItemButton,
      createInlineAction,
      createHatchEggAction,
      syncIncubatorHatchActions,
      createStatsToggleButton,
      createPanelBackButton,
      createSquareMarker,
      createEmptyMessage,
      createConstrainedEmptyTab,
      createDetailRow,
      createCompactDetailPair,
      formatTitle,
      formatOdds,
      formatInfluenceEffect,
      formatDuration,
      getHatchProgress,
      createTabMenu,
      openMenu,
      closeMenu,
      closeSelectedTarget,
      renderLab,
      saveLab
    } = dependencies;
    const {
      applyInitialStagePanel,
      closeStagePanel,
      getIncubatorContext,
      getIncubatorEggSlot,
      getIncubatorSelectionKey,
      getSelectedItemInfluenceKey,
      isSelectingIncubatorEgg,
      isViewingIncubatorHatchDetails,
      openStagePanel,
      setIncubatorEggSelection,
      setIncubatorHatchDetails,
      setPanelInteractivity
    } = dependencies;

    function createEggInsertionSlot(
      context,
      isSelectingEgg,
      isViewingHatchDetails,
      onSelectEgg,
      onClosePicker,
      onToggleHatchDetails
    ) {
      const eggSlot = getIncubatorEggSlot(context);
      const egg = eggSlot?.itemKey ? getEgg(eggSlot.itemKey) : null;
      const hatchProgress = getHatchProgress(context, eggSlot, egg);
      const slot = document.createElement(egg ? 'div' : 'button');
      slot.className = 'oling-lab-egg-insertion-slot';
      slot.classList.toggle('has-egg', Boolean(egg));
      if (!egg) slot.type = 'button';
      slot.setAttribute(
        'aria-label',
        egg
          ? `${egg.name || egg.key} inserted`
          : isSelectingEgg
            ? 'Close egg inventory'
            : 'Choose an egg to incubate'
      );

      const eggImage = getEggImage(egg);
      if (eggImage) {
        slot.appendChild(createImage(eggImage, egg.name));
      } else {
        slot.appendChild(
          createSquareMarker(
            egg ? String(egg.name || egg.key).charAt(0) : '+',
            egg
              ? 'oling-lab-egg-insertion-placeholder'
              : 'oling-lab-egg-insertion-plus'
          )
        );
      }

      slot.appendChild(
        Object.assign(document.createElement('strong'), {
          textContent: egg?.name || 'Insert Egg'
        })
      );
      if (egg) {
        const timerBadge = Object.assign(document.createElement('span'), {
          className: 'oling-lab-hatch-timer-badge',
          textContent: hatchProgress.isReady
            ? 'Ready to hatch'
            : formatDuration(hatchProgress.remainingMs)
        });
        timerBadge.dataset.olingHatchCountdown = '';
        if (hatchProgress.readyAt) {
          timerBadge.dataset.olingHatchReadyAt = String(hatchProgress.readyAt);
        }
        slot.appendChild(timerBadge);
        slot.appendChild(
          createStatsToggleButton(
            isViewingHatchDetails
              ? 'Close hatch details'
              : 'View hatch details',
            (event) => {
              event.stopPropagation();
              onToggleHatchDetails();
            }
          )
        );
      }

      if (!egg)
        slot.addEventListener('click', () => {
          if (isSelectingEgg) {
            onClosePicker();
            return;
          }
          onSelectEgg();
        });

      return slot;
    }

    function createEggInsertionStage(
      context,
      isSelectingEgg,
      isViewingHatchDetails,
      shouldAnimatePanel,
      onSelectEgg,
      onCancel,
      onToggleHatchDetails
    ) {
      const stage = document.createElement('div');
      stage.className = 'oling-lab-egg-insertion-stage';
      let details = null;
      const closePicker = () => {
        closeStagePanel(stage, picker, 'is-selecting', onCancel);
      };
      const closeDetails = () => {
        closeStagePanel(stage, details, 'is-viewing-details', () =>
          onToggleHatchDetails(false)
        );
      };
      const slot = createEggInsertionSlot(
        context,
        isSelectingEgg,
        isViewingHatchDetails,
        onSelectEgg,
        closePicker,
        () => {
          if (isViewingHatchDetails) {
            closeDetails();
            return;
          }
          onToggleHatchDetails(true);
        }
      );
      const picker = createIncubateEggInventory(context, null);
      details = createIncubateStatusPanel(
        context,
        getIncubatorEggSlot(context)?.itemKey
          ? getEgg(getIncubatorEggSlot(context).itemKey)
          : null,
        closeDetails
      );
      setPanelInteractivity(picker, isSelectingEgg);
      setPanelInteractivity(details, isViewingHatchDetails);
      stage.append(slot, picker, details);
      if (isSelectingEgg) {
        openStagePanel(stage, picker, 'is-selecting');
      }
      applyInitialStagePanel(
        stage,
        details,
        'is-viewing-details',
        isViewingHatchDetails,
        shouldAnimatePanel
      );
      return stage;
    }

    function createIncubateEggInventory(context, selectedEggKey) {
      const section = document.createElement('section');
      section.className = 'oling-lab-side-panel oling-lab-egg-picker-panel';

      const header = document.createElement('div');
      header.className = 'oling-lab-menu-section-header';
      header.appendChild(
        Object.assign(document.createElement('h3'), {
          textContent: 'Egg Inventory'
        })
      );
      section.appendChild(header);

      const grid = document.createElement('div');
      grid.className = 'oling-lab-egg-picker-grid';
      state.ownedEggs.forEach((ownedEgg) => {
        const quantity = Number(ownedEgg.quantity || 0);
        if (quantity < 1) return;

        const egg = getEgg(ownedEgg.key);
        const available = getAvailableEggQuantity(ownedEgg.key);
        const isSelected = selectedEggKey === ownedEgg.key;
        const button = createItemButton(
          {
            name: `${egg.name || ownedEgg.key} x${quantity}`,
            image: getEggImage(egg)
          },
          {
            disabled: !isSelected && available < 1,
            badge: isSelected ? 'Inserted' : '',
            onClick: () => {
              if (isSelected) return;
              placeEggInIncubator(context, ownedEgg.key);
            }
          }
        );
        if (isSelected) {
          button.classList.add('is-selected');
          button.setAttribute('aria-pressed', 'true');
        }
        grid.appendChild(button);
      });

      section.appendChild(
        grid.children.length ? grid : createEmptyMessage('No eggs available.')
      );
      return section;
    }

    function createIncubateStatusPanel(context, egg, onClose) {
      const eggSlot = getIncubatorEggSlot(context);
      const hatchProgress = getHatchProgress(context, eggSlot, egg);
      const panel = document.createElement('section');
      panel.className =
        'oling-lab-incubate-panel is-status oling-lab-side-panel oling-lab-hatch-details-panel';
      panel.classList.toggle('is-ready', Boolean(egg && hatchProgress.isReady));
      if (typeof onClose === 'function') {
        panel.appendChild(
          createPanelBackButton('Back from hatch details', onClose)
        );
      }
      panel.appendChild(
        Object.assign(document.createElement('h3'), {
          textContent: 'Hatch Details'
        })
      );

      const details = document.createElement('div');
      details.className = 'oling-lab-detail-list';
      details.append(
        createCompactDetailPair(
          'Status',
          egg ? (hatchProgress.isReady ? 'Ready' : 'Incubating') : 'Waiting',
          'Time Left',
          egg ? formatDuration(hatchProgress.remainingMs) : '-',
          {
            Status: 'olingHatchStatus',
            'Time Left': 'olingHatchTime'
          }
        ),
        createCompactDetailPair(
          'Egg',
          egg?.name || 'None',
          'Collection',
          egg ? formatTitle(egg.collection || 'base') : '-'
        )
      );
      const timeLeftValue = details.querySelector('[data-oling-hatch-time]');
      if (timeLeftValue && hatchProgress.readyAt) {
        timeLeftValue.dataset.olingHatchReadyAt = String(hatchProgress.readyAt);
      }
      panel.appendChild(details);

      const influences = document.createElement('div');
      influences.className = 'oling-lab-active-influences';
      influences.appendChild(
        Object.assign(document.createElement('h4'), {
          textContent: 'Active Influences'
        })
      );
      const influenceList = document.createElement('div');
      influenceList.className = 'oling-lab-detail-list';
      itemInfluenceSlots.forEach((slotDefinition) => {
        const consumableKey = getSelectedItemInfluenceKey(
          context,
          slotDefinition.key
        );
        const consumable = consumableKey ? getConsumable(consumableKey) : null;
        const effectLabel = consumable ? formatInfluenceEffect(consumable) : '';
        influenceList.appendChild(
          createDetailRow(
            slotDefinition.label.replace(/\s+Influence$/i, ''),
            consumable
              ? effectLabel
                ? `${consumable.name} (${effectLabel})`
                : consumable.name
              : '-'
          )
        );
      });
      influences.appendChild(influenceList);
      panel.appendChild(influences);

      const note = document.createElement('p');
      note.className = 'oling-lab-incubator-copy';
      note.dataset.olingHatchNote = '';
      note.textContent = egg
        ? hatchProgress.isReady
          ? 'This egg is ready to hatch.'
          : 'Hatch unlocks when the timer reaches zero.'
        : 'Choose an egg from your inventory.';
      panel.appendChild(note);

      const actions = document.createElement('div');
      actions.className = 'oling-lab-menu-inline-actions';
      actions.dataset.olingHatchActions = '';
      syncIncubatorHatchActions(actions, context, egg, hatchProgress, {
        fallback: 'remove'
      });
      panel.appendChild(actions);

      return panel;
    }

    function createIncubatorFooterActions(context, tab) {
      if (tab?.label !== 'Incubate') return [];
      const liveContext =
        getIncubatorContext(context.parentPlacedId) || context;
      const eggSlot = getIncubatorEggSlot(liveContext);
      const egg = eggSlot?.itemKey ? getEgg(eggSlot.itemKey) : null;
      const hatchProgress = getHatchProgress(liveContext, eggSlot, egg);
      return egg && hatchProgress.isReady
        ? [createHatchEggAction(liveContext)]
        : [];
    }

    function createIncubateTab(context) {
      const eggSlot = getIncubatorEggSlot(context);
      const egg = eggSlot?.itemKey ? getEgg(eggSlot.itemKey) : null;
      const isSelectingEgg = !egg && isSelectingIncubatorEgg(context);
      const selectionKey = getIncubatorSelectionKey(context);
      const isViewingHatchDetails = Boolean(
        egg && isViewingIncubatorHatchDetails(context)
      );
      const shouldAnimatePanel =
        state.animatingIncubatorPanelTarget === selectionKey;
      if (shouldAnimatePanel) state.animatingIncubatorPanelTarget = null;
      const section = document.createElement('section');
      section.className = 'oling-lab-menu-section';

      const dashboard = document.createElement('div');
      dashboard.className = 'oling-lab-incubate-dashboard';

      const eggPanel = document.createElement('section');
      eggPanel.className = 'oling-lab-incubate-panel is-egg';
      eggPanel.appendChild(
        createEggInsertionStage(
          context,
          isSelectingEgg,
          isViewingHatchDetails,
          shouldAnimatePanel,
          () => {
            setIncubatorEggSelection(context, true);
            openIncubatorMenu(context);
          },
          () => {
            setIncubatorEggSelection(context, false);
            openIncubatorMenu(context);
          },
          (isViewing) => {
            setIncubatorHatchDetails(context, isViewing, {
              animate: isViewing
            });
            openIncubatorMenu(context);
          }
        )
      );

      dashboard.appendChild(eggPanel);
      section.appendChild(dashboard);
      return [section];
    }

    function createEggTab(context) {
      const eggSlot = getIncubatorEggSlot(context);
      const egg = eggSlot?.itemKey ? getEgg(eggSlot.itemKey) : null;
      if (!egg) {
        return createConstrainedEmptyTab(
          'Insert an egg to inspect its hatch details.'
        );
      }

      const section = document.createElement('section');
      section.className = 'oling-lab-menu-section';
      section.appendChild(createEggInfoStage(context, egg));
      return [section];
    }


    return {
      createEggTab,
      createIncubateTab,
      createIncubatorFooterActions
    };
  }

  window.createOlingLabIncubatorIncubation = createOlingLabIncubatorIncubation;
})();
