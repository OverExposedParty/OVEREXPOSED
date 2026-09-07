(function () {
  function createOlingLabIncubatorIncubation(dependencies) {
    const {
      state,
      elements,
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
      createItemInfluenceSlotButton,
      createEmptyMessage,
      createConstrainedEmptyTab,
      createDetailRow,
      createCompactDetailPair,
      formatTitle,
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
      getStagedIncubatorEggKey,
      getSelectedItemInfluenceKey,
      getItemInfluenceSlots,
      isIncubatorActivelyHatching,
      isSelectingIncubatorEgg,
      isViewingIncubatorHatchDetails,
      openStagePanel,
      setActiveItemInfluenceSlot,
      setIncubatorEggSelection,
      setStagedIncubatorEggKey,
      setIncubatorHatchDetails,
      setPanelInteractivity,
      placeEggInIncubator,
      startHatchingStagedEgg,
      createEggInfoStage,
      openIncubatorMenu
    } = dependencies;
    let eggDrag = null;
    let activeEggDropStage = null;

    function isPointerInside(element, event) {
      if (!element?.getBoundingClientRect) return false;
      const rect = element.getBoundingClientRect();
      return (
        event.clientX >= rect.left &&
        event.clientX <= rect.right &&
        event.clientY >= rect.top &&
        event.clientY <= rect.bottom
      );
    }

    function createEggDragGhost(egg) {
      const ghost = document.createElement('div');
      ghost.className = 'oling-lab-egg-drag-ghost';
      const image = getEggImage(egg);
      ghost.appendChild(
        image
          ? createImage(image, egg.name || egg.key)
          : createSquareMarker(
              String(egg.name || egg.key).charAt(0),
              'oling-lab-incubator-egg-placeholder'
            )
      );
      document.body.appendChild(ghost);
      return ghost;
    }

    function setEggDropTarget(stage, isActive) {
      stage?.classList.toggle('is-egg-drop-target', isActive);
      eggDrag?.ghost?.classList.toggle('is-over-incubator', isActive);
      if (eggDrag) eggDrag.overStage = isActive;
    }

    function moveEggDrag(event) {
      if (!eggDrag || event.pointerId !== eggDrag.pointerId) return;
      const distance = Math.hypot(
        event.clientX - eggDrag.startX,
        event.clientY - eggDrag.startY
      );
      if (!eggDrag.active && distance < 6) return;
      if (!eggDrag.active) {
        eggDrag.active = true;
        eggDrag.source.dataset.dragged = 'true';
        eggDrag.ghost = createEggDragGhost(eggDrag.egg);
      }
      eggDrag.ghost.style.left = `${event.clientX}px`;
      eggDrag.ghost.style.top = `${event.clientY}px`;
      const canDrop = Boolean(
        activeEggDropStage &&
        !getIncubatorEggSlot(eggDrag.context)?.itemKey &&
        isPointerInside(activeEggDropStage, event)
      );
      setEggDropTarget(activeEggDropStage, canDrop);
      event.preventDefault();
    }

    function clearEggDrag() {
      if (!eggDrag) return;
      activeEggDropStage?.classList.remove('is-egg-drop-target');
      eggDrag.ghost?.remove();
      eggDrag = null;
    }

    function finishEggDrag(event, cancelled = false) {
      if (!eggDrag || event.pointerId !== eggDrag.pointerId) return;
      const completed = eggDrag;
      const shouldStage = Boolean(
        completed.active && completed.overStage && !cancelled
      );
      clearEggDrag();
      if (completed.active) {
        window.setTimeout?.(() => {
          completed.source.dataset.dragged = 'false';
        }, 0);
      }
      if (shouldStage) placeEggInIncubator(completed.context, completed.eggKey);
      if (completed.active) event.preventDefault();
    }

    function createEggInsertionSlot(
      context,
      stagedEggKey,
      isViewingHatchDetails,
      onFocusInventory,
      onToggleHatchDetails
    ) {
      const eggSlot = getIncubatorEggSlot(context);
      const insertedEgg = eggSlot?.itemKey ? getEgg(eggSlot.itemKey) : null;
      const stagedEgg =
        !insertedEgg && stagedEggKey ? getEgg(stagedEggKey) : null;
      const egg = insertedEgg || stagedEgg;
      const isStaged = Boolean(stagedEgg && !insertedEgg);
      const isStarted = Boolean(insertedEgg && eggSlot?.placedAt);
      const hatchProgress = getHatchProgress(context, eggSlot, egg);
      const slot = document.createElement(egg ? 'div' : 'button');
      slot.className = 'oling-lab-egg-insertion-slot';
      slot.classList.toggle('has-egg', Boolean(egg));
      if (!egg) {
        slot.type = 'button';
        slot.dataset.soundIntent = 'select';
      }
      slot.setAttribute(
        'aria-label',
        egg
          ? isStaged
            ? `${egg.name || egg.key} selected and ready to start hatching`
            : isStarted
              ? `${egg.name || egg.key} incubating`
              : `${egg.name || egg.key} inserted and ready to start hatching`
          : 'Choose or drop an egg to incubate'
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
      if (insertedEgg) {
        const timerBadge = Object.assign(document.createElement('span'), {
          className: 'oling-lab-hatch-timer-badge',
          textContent: !isStarted
            ? 'Ready to start'
            : hatchProgress.isReady
              ? 'Ready to hatch'
              : formatDuration(hatchProgress.remainingMs)
        });
        timerBadge.classList.toggle('is-ready-to-start', !isStarted);
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

      if (isStaged) {
        slot.appendChild(
          Object.assign(document.createElement('span'), {
            className: 'oling-lab-hatch-timer-badge is-staged',
            textContent: 'Ready to start'
          })
        );
      }

      if (!egg) slot.addEventListener('click', onFocusInventory);

      return slot;
    }

    function createEggInsertionStage(
      context,
      stagedEggKey,
      isViewingHatchDetails,
      shouldAnimatePanel,
      onFocusInventory,
      onStageEgg,
      onToggleHatchDetails
    ) {
      const stage = document.createElement('div');
      stage.className = 'oling-lab-egg-insertion-stage';
      stage.dataset.olingEggDropMessage = getIncubatorEggSlot(context)?.itemKey
        ? 'Egg inserted'
        : stagedEggKey
          ? 'Drop to replace egg'
          : 'Drop to insert egg';
      activeEggDropStage = stage;
      let details = null;
      const closeDetails = () => {
        closeStagePanel(stage, details, 'is-viewing-details', () =>
          onToggleHatchDetails(false)
        );
      };
      const slot = createEggInsertionSlot(
        context,
        stagedEggKey,
        isViewingHatchDetails,
        onFocusInventory,
        () => {
          if (isViewingHatchDetails) {
            closeDetails();
            return;
          }
          onToggleHatchDetails(true);
        }
      );
      details = createIncubateStatusPanel(
        context,
        getIncubatorEggSlot(context)?.itemKey
          ? getEgg(getIncubatorEggSlot(context).itemKey)
          : null,
        closeDetails
      );
      setPanelInteractivity(details, isViewingHatchDetails);
      stage.append(slot, details);
      stage.addEventListener('dragover', (event) => {
        if (getIncubatorEggSlot(context)?.itemKey) return;
        event.preventDefault();
        stage.classList.add('is-egg-drop-target');
        if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
      });
      stage.addEventListener('dragleave', (event) => {
        if (event.relatedTarget && stage.contains(event.relatedTarget)) return;
        stage.classList.remove('is-egg-drop-target');
      });
      stage.addEventListener('drop', (event) => {
        event.preventDefault();
        stage.classList.remove('is-egg-drop-target');
        const eggKey = event.dataTransfer?.getData('text/oling-egg-key');
        if (eggKey) onStageEgg(eggKey);
      });
      applyInitialStagePanel(
        stage,
        details,
        'is-viewing-details',
        isViewingHatchDetails,
        shouldAnimatePanel
      );
      return stage;
    }

    function createIncubateEggInventory(context, selectedEggKey, options = {}) {
      const section = document.createElement('section');
      section.className = 'oling-lab-incubator-egg-inventory';

      const header = document.createElement('div');
      header.className = 'oling-lab-menu-section-header';
      header.appendChild(
        Object.assign(document.createElement('h3'), {
          textContent: 'Egg Inventory'
        })
      );
      section.appendChild(header);

      const browser = document.createElement('div');
      browser.className = 'oling-lab-incubator-egg-inventory-browser';
      const grid = document.createElement('div');
      grid.className = 'oling-lab-egg-picker-grid';
      const ownedEggs = state.ownedEggs.filter(
        (ownedEgg) => getAvailableEggQuantity(ownedEgg.key) > 0
      );
      const pageSize = 8;
      const pageCount = Math.max(1, Math.ceil(ownedEggs.length / pageSize));
      const pageIndex = Math.min(
        Math.max(0, Number(options.pageIndex) || 0),
        pageCount - 1
      );
      const visibleEggs = ownedEggs.slice(
        pageIndex * pageSize,
        (pageIndex + 1) * pageSize
      );
      grid.classList.toggle('is-empty-inventory', !visibleEggs.length);
      visibleEggs.forEach((ownedEgg) => {
        const egg = getEgg(ownedEgg.key);
        if (!egg) return;
        const available = getAvailableEggQuantity(ownedEgg.key);
        const isSelected = selectedEggKey === ownedEgg.key;
        const button = document.createElement('button');
        button.className = 'oling-lab-menu-action oling-lab-incubator-egg-card';
        button.type = 'button';
        button.disabled = !isSelected && available < 1;
        button.dataset.soundIntent = 'select';
        button.setAttribute('aria-pressed', String(isSelected));
        button.setAttribute(
          'aria-label',
          `${egg.name || ownedEgg.key}, ${available} available`
        );
        const image = getEggImage(egg);
        button.appendChild(
          image
            ? createImage(image, egg.name || ownedEgg.key)
            : createSquareMarker(
                String(egg.name || ownedEgg.key).charAt(0),
                'oling-lab-incubator-egg-placeholder'
              )
        );
        button.append(
          Object.assign(document.createElement('span'), {
            className: 'oling-lab-incubator-egg-quantity',
            textContent: String(available)
          }),
          Object.assign(document.createElement('span'), {
            className: 'oling-lab-incubator-egg-name',
            textContent: egg.name || ownedEgg.key
          })
        );
        button.addEventListener('click', () => {
          if (button.dataset.dragged === 'true') return;
          options.onSelect?.(isSelected ? null : ownedEgg.key);
        });
        if (isSelected) {
          button.classList.add('is-selected');
        }
        button.draggable = false;
        button.dataset.olingEggKey = ownedEgg.key;
        button.addEventListener('dragstart', (event) => event.preventDefault());
        button.addEventListener('pointerdown', (event) => {
          if (
            button.disabled ||
            event.isPrimary === false ||
            (event.pointerType === 'mouse' && event.button !== 0) ||
            eggDrag
          ) {
            return;
          }
          eggDrag = {
            context,
            egg,
            eggKey: ownedEgg.key,
            pointerId: event.pointerId,
            source: button,
            startX: event.clientX,
            startY: event.clientY,
            active: false,
            overStage: false,
            ghost: null
          };
          button.setPointerCapture?.(event.pointerId);
        });
        grid.appendChild(button);
      });

      for (let index = visibleEggs.length; index < pageSize; index += 1) {
        const emptyCell = document.createElement('span');
        emptyCell.className = 'oling-lab-incubator-egg-empty-cell';
        emptyCell.setAttribute('aria-hidden', 'true');
        grid.appendChild(emptyCell);
      }
      if (!visibleEggs.length) {
        const emptyMessage = document.createElement('p');
        emptyMessage.className = 'oling-lab-incubator-egg-empty-message';
        emptyMessage.setAttribute('role', 'status');
        emptyMessage.textContent = 'No eggs available.';
        grid.appendChild(emptyMessage);
      }
      browser.appendChild(grid);

      if (pageCount > 1) {
        const pagination = document.createElement('nav');
        pagination.className = 'oling-lab-incubator-egg-pagination';
        pagination.setAttribute('aria-label', 'Egg inventory pages');
        const previous = Object.assign(document.createElement('button'), {
          type: 'button',
          textContent: '‹',
          disabled: pageIndex === 0
        });
        previous.setAttribute('aria-label', 'Previous egg page');
        previous.dataset.soundIntent = 'previous';
        previous.addEventListener('click', () =>
          options.onPageChange?.(pageIndex - 1)
        );
        const pageStatus = Object.assign(document.createElement('strong'), {
          textContent: `${pageIndex + 1} / ${pageCount}`
        });
        pageStatus.setAttribute('aria-live', 'polite');
        const next = Object.assign(document.createElement('button'), {
          type: 'button',
          textContent: '›',
          disabled: pageIndex >= pageCount - 1
        });
        next.setAttribute('aria-label', 'Next egg page');
        next.dataset.soundIntent = 'next';
        next.addEventListener('click', () =>
          options.onPageChange?.(pageIndex + 1)
        );
        pagination.append(previous, pageStatus, next);
        browser.appendChild(pagination);
      }
      section.appendChild(browser);

      const selectedEgg = selectedEggKey ? getEgg(selectedEggKey) : null;
      const description = document.createElement('div');
      description.className = 'oling-lab-incubator-egg-description';
      description.classList.toggle('is-guidance', !selectedEgg);
      description.setAttribute('aria-live', 'polite');
      if (selectedEgg) {
        const hatchDuration = getHatchProgress(
          context,
          getIncubatorEggSlot(context),
          selectedEgg
        ).durationMs;
        description.append(
          Object.assign(document.createElement('strong'), {
            textContent: selectedEgg.name || selectedEgg.key
          }),
          Object.assign(document.createElement('span'), {
            textContent: `Collection: ${formatTitle(selectedEgg.collection || 'base')} · Hatch time: ${formatDuration(hatchDuration)}`
          })
        );
      } else {
        description.append(
          Object.assign(document.createElement('strong'), {
            textContent: 'Discover Your Eggs'
          }),
          Object.assign(document.createElement('p'), {
            textContent:
              'Choose an egg above to discover what could hatch from it.'
          })
        );
      }
      section.appendChild(description);
      return section;
    }

    function openInfluenceItemSlot(context, slotKey) {
      if (isIncubatorActivelyHatching(context)) return;
      setActiveItemInfluenceSlot(context, slotKey);
      state.incubatorPanelTabLabel = 'Influences';
      openIncubatorMenu(context);
    }

    function createIncubateInfluenceSummary(context) {
      const section = document.createElement('section');
      section.className = 'oling-lab-incubator-influence-summary';

      const header = document.createElement('div');
      header.className = 'oling-lab-menu-section-header';
      header.appendChild(
        Object.assign(document.createElement('h3'), {
          textContent: 'Influence Items'
        })
      );
      section.appendChild(header);

      const slots = getItemInfluenceSlots(context);
      if (!slots.length) {
        section.appendChild(
          createEmptyMessage('This incubator has no influence slots.')
        );
        return section;
      }

      const isLocked = isIncubatorActivelyHatching(context);
      const grid = document.createElement('div');
      grid.className = 'oling-lab-incubator-influence-grid';
      grid.dataset.influenceSlotCount = String(slots.length);
      slots.forEach((slotDefinition) => {
        const itemKey = getSelectedItemInfluenceKey(
          context,
          slotDefinition.key
        );
        const item = itemKey ? getConsumable(itemKey) : null;
        const effect = item
          ? formatInfluenceEffect(item) || formatTitle(item.effect?.type || '')
          : '';
        const button = createItemInfluenceSlotButton(context, slotDefinition, {
          active: false,
          disabled: isLocked,
          onClick: isLocked
            ? null
            : () => openInfluenceItemSlot(context, slotDefinition.key)
        });
        button.classList.add('oling-lab-incubator-influence-card');
        button.classList.toggle('has-item', Boolean(item));
        button.classList.toggle('is-locked', isLocked);
        button.dataset.soundIntent = isLocked ? 'none' : 'open';
        button.setAttribute(
          'aria-label',
          item
            ? `${slotDefinition.label}: ${item.name}${isLocked ? ', locked while incubating' : ', edit influence item'}`
            : `${slotDefinition.label}: ${isLocked ? 'no influence used' : 'add an optional influence item'}`
        );

        const name = button.querySelector('strong');
        if (!item && isLocked) {
          button.querySelector('.oling-lab-item-influence-marker')?.remove();
          if (name) name.textContent = 'No Influence';
          button.appendChild(
            Object.assign(document.createElement('span'), {
              className: 'oling-lab-incubator-influence-empty-state',
              textContent: 'No influence was applied to this hatch.'
            })
          );
        }
        button.appendChild(
          Object.assign(document.createElement('span'), {
            className: 'oling-lab-incubator-influence-status',
            textContent: item
              ? effect || 'Influence active'
              : isLocked
                ? 'Not applied'
                : 'Optional'
          })
        );
        grid.appendChild(button);
      });
      section.appendChild(grid);
      return section;
    }

    function createIncubateStatusPanel(context, egg, onClose) {
      const eggSlot = getIncubatorEggSlot(context);
      const isStarted = Boolean(egg && eggSlot?.placedAt);
      const hatchProgress = getHatchProgress(context, eggSlot, egg);
      const panel = document.createElement('section');
      panel.className =
        'oling-lab-incubate-panel is-status oling-lab-side-panel oling-lab-hatch-details-panel';
      panel.classList.toggle(
        'is-ready',
        Boolean(isStarted && hatchProgress.isReady)
      );
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
          egg
            ? !isStarted
              ? 'Ready to Start'
              : hatchProgress.isReady
                ? 'Ready'
                : 'Incubating'
            : 'Waiting',
          'Time Left',
          egg
            ? isStarted
              ? formatDuration(hatchProgress.remainingMs)
              : 'Not started'
            : '-',
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
      getItemInfluenceSlots(context).forEach((slotDefinition) => {
        const consumableKey = getSelectedItemInfluenceKey(
          context,
          slotDefinition.key
        );
        const consumable = consumableKey ? getConsumable(consumableKey) : null;
        const effectLabel = consumable ? formatInfluenceEffect(consumable) : '';
        influenceList.appendChild(
          createDetailRow(
            slotDefinition.label,
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
        ? !isStarted
          ? 'Press Start Hatching when you are ready.'
          : hatchProgress.isReady
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
      if (!egg) {
        const selectedEggKey = getStagedIncubatorEggKey(liveContext);
        return [
          createInlineAction(
            'Insert Egg',
            () => {
              if (selectedEggKey)
                placeEggInIncubator(liveContext, selectedEggKey);
            },
            {
              className: 'is-egg-action',
              disabled: !selectedEggKey,
              soundIntent: 'confirm'
            }
          )
        ];
      }
      if (!eggSlot.placedAt) {
        return [
          createInlineAction(
            'Start Hatching',
            () => startHatchingStagedEgg(liveContext),
            { className: 'is-hatch-action', soundIntent: 'confirm' }
          )
        ];
      }
      return hatchProgress.isReady ? [createHatchEggAction(liveContext)] : [];
    }

    function createIncubateTab(context, options = {}) {
      const eggSlot = getIncubatorEggSlot(context);
      const egg = eggSlot?.itemKey ? getEgg(eggSlot.itemKey) : null;
      const stagedEggKey = egg ? null : getStagedIncubatorEggKey(context);
      const selectionKey = getIncubatorSelectionKey(context);
      const isViewingHatchDetails = Boolean(
        egg && isViewingIncubatorHatchDetails(context)
      );
      const shouldAnimatePanel =
        state.animatingIncubatorPanelTarget === selectionKey;
      if (shouldAnimatePanel) state.animatingIncubatorPanelTarget = null;
      const section = document.createElement('section');
      section.className = 'oling-lab-menu-section oling-lab-incubator-overview';
      section.classList.toggle('is-choosing-egg', !egg);

      const preview = document.createElement('div');
      preview.className = 'oling-lab-incubator-preview-frame';
      preview.appendChild(
        createEggInsertionStage(
          context,
          egg ? stagedEggKey : null,
          isViewingHatchDetails,
          shouldAnimatePanel,
          () => {
            section
              .querySelector('.oling-lab-egg-picker-grid button:not(:disabled)')
              ?.focus();
          },
          (eggKey) => placeEggInIncubator(context, eggKey),
          (isViewing) => {
            setIncubatorHatchDetails(context, isViewing, {
              animate: isViewing
            });
            openIncubatorMenu(context);
          }
        )
      );
      if (!egg) {
        const inventoryHost = document.createElement('div');
        inventoryHost.className = 'oling-lab-incubator-egg-inventory-host';
        let pageIndex = 0;
        const renderInventory = () => {
          const selectedEggKey = getStagedIncubatorEggKey(context);
          inventoryHost.replaceChildren(
            createIncubateEggInventory(context, selectedEggKey, {
              pageIndex,
              onPageChange(nextPageIndex) {
                pageIndex = nextPageIndex;
                renderInventory();
              },
              onSelect(eggKey) {
                setStagedIncubatorEggKey(context, eggKey);
                renderInventory();
                options.onChange?.();
              }
            })
          );
        };
        renderInventory();
        section.append(preview, inventoryHost);
        return [section];
      }
      section.append(preview, createIncubateInfluenceSummary(context));
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

    if (typeof document !== 'undefined') {
      document.addEventListener?.('pointermove', moveEggDrag);
      document.addEventListener?.('pointerup', (event) => finishEggDrag(event));
      document.addEventListener?.('pointercancel', (event) =>
        finishEggDrag(event, true)
      );
      document.addEventListener?.('keydown', (event) => {
        if (event.key === 'Escape') clearEggDrag();
      });
    }

    return {
      createEggTab,
      createIncubateTab,
      createIncubatorFooterActions
    };
  }

  window.createOlingLabIncubatorIncubation = createOlingLabIncubatorIncubation;
})();
