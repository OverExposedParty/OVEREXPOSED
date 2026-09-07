(function () {
  function createOlingLabIncubator(dependencies) {
    let openIncubatorMenu = () => {};
    let closeIncubatorPanel = () => {};
    const reopenIncubatorMenu = (...args) => openIncubatorMenu(...args);
    const closeActiveIncubatorPanel = (...args) => closeIncubatorPanel(...args);
    const core = window.createOlingLabIncubatorCore({
      ...dependencies,
      openIncubatorMenu: reopenIncubatorMenu,
      closeIncubatorPanel: closeActiveIncubatorPanel
    });
    const info = window.createOlingLabIncubatorInfo({
      ...dependencies,
      ...core,
      openIncubatorMenu: reopenIncubatorMenu
    });
    const influences = window.createOlingLabIncubatorInfluences({
      ...dependencies,
      ...core,
      ...info,
      openIncubatorMenu: reopenIncubatorMenu
    });
    const incubation = window.createOlingLabIncubatorIncubation({
      ...dependencies,
      ...core,
      ...info,
      ...influences,
      openIncubatorMenu: reopenIncubatorMenu
    });
    const {
      state = {},
      elements = {},
      startIncubatorCountdown = () => {},
      createTabMenu,
      createInlineAction,
      getEgg,
      getHatchProgress,
      resolveMenuConfig,
      closeMenu,
      closeSelectedTarget,
      renderLab,
      openMenu
    } = dependencies;
    const panelTransitions = window.OlingLabPanelTransitions;
    const { createIncubatorInfoStage } = info;
    const { createEggTab, createIncubateTab, createIncubatorFooterActions } =
      incubation;
    const { createInfluenceFooterActions = () => [], createItemsTab } =
      influences;

    const playSound = (key) => {
      if (typeof window.playSoundEffect !== 'function') return;
      Promise.resolve(window.playSoundEffect(key)).catch(() => {});
    };

    function getLiveContext(context) {
      return (
        core.getIncubatorContext(context?.parentPlacedId) || context || null
      );
    }

    function createIncubatorTabs(context, options = {}) {
      return createTabMenu(
        [
          {
            label: 'Incubate',
            content: () =>
              createIncubateTab(context, {
                onChange: () => refreshIncubatorFooter(context)
              })
          },
          { label: 'Egg', content: () => createEggTab(context) },
          {
            label: 'Influences',
            content: () =>
              createItemsTab(context, {
                onChange: () => refreshIncubatorFooter(context)
              })
          },
          {
            label: 'Info',
            content: () => createIncubatorInfoStage(context)
          }
        ],
        options
      );
    }

    function setPanelCollapsed(collapsed) {
      if (!state.incubatorPanelOpen || !elements.incubatorPanel) return;
      const changed = state.incubatorPanelCollapsed !== collapsed;
      state.incubatorPanelCollapsed = collapsed;
      elements.incubatorPanel.classList.toggle('is-collapsed', collapsed);
      elements.incubatorPanelToggle.textContent = collapsed ? 'Show' : 'Hide';
      elements.incubatorPanelToggle.setAttribute(
        'aria-expanded',
        String(!collapsed)
      );
      if (changed) playSound(collapsed ? 'sidePanelClose' : 'sidePanelOpen');
    }

    function clearPanelDrilldown(context) {
      if (!context) return false;
      if (core.isSelectingIncubatorEgg(context)) {
        core.setIncubatorEggSelection(context, false);
        return true;
      }
      if (core.isViewingIncubatorHatchDetails(context)) {
        core.setIncubatorHatchDetails(context, false);
        return true;
      }
      if (core.getActiveItemInfluenceSlot(context)) {
        core.setActiveItemInfluenceSlot(context, null);
        return true;
      }
      if (core.isViewingIncubatorEggInfo(context)) {
        core.setIncubatorEggInfo(context, false);
        return true;
      }
      if (core.isViewingIncubatorInfo(context)) {
        core.setIncubatorInfo(context, false);
        return true;
      }
      return false;
    }

    function hasPanelDrilldown(context) {
      return Boolean(
        context &&
        (core.isSelectingIncubatorEgg(context) ||
          core.isViewingIncubatorHatchDetails(context) ||
          core.getActiveItemInfluenceSlot(context) ||
          core.isViewingIncubatorEggInfo(context) ||
          core.isViewingIncubatorInfo(context))
      );
    }

    function updateBackButton(context) {
      if (!elements.incubatorPanelBack) return;
      const isDrilldown = hasPanelDrilldown(context);
      elements.incubatorPanelBack.setAttribute(
        'aria-label',
        isDrilldown ? 'Back to incubator overview' : 'Close incubator menu'
      );
      elements.incubatorPanelBack.classList.toggle('is-close', !isDrilldown);
      elements.incubatorPanelBack.textContent = isDrilldown ? 'Back' : 'Close';
      elements.incubatorPanelBack.dataset.soundIntent = isDrilldown
        ? 'previous'
        : 'close';
    }

    function createInfluencesFooter(context) {
      const liveContext = getLiveContext(context);
      const closeAction = createInlineAction(
        'Close Menu',
        () => {
          if (elements.incubatorPanel && state.incubatorPanelOpen) {
            closeIncubatorPanel();
            return;
          }
          closeMenu();
        },
        {
          className: 'oling-lab-incubator-panel-close',
          sound: false
        }
      );
      return [
        closeAction,
        ...createInfluenceFooterActions(liveContext, () =>
          refreshInfluenceView(liveContext)
        )
      ];
    }

    function createPanelFooter(context) {
      const liveContext = getLiveContext(context);
      if (state.incubatorPanelTabLabel === 'Influences') {
        return createInfluenceFooterActions(liveContext, () =>
          refreshInfluenceView(liveContext)
        );
      }
      const eggSlot = core.getIncubatorEggSlot(liveContext);
      const egg = eggSlot?.itemKey ? getEgg(eggSlot.itemKey) : null;
      const selectedEggKey = egg
        ? null
        : core.getStagedIncubatorEggKey(liveContext);
      const hatchProgress = getHatchProgress(liveContext, eggSlot, egg);
      const removeAction = egg
        ? createInlineAction(
            'Remove Egg',
            () => core.removeEggFromIncubator(liveContext),
            {
              className: 'is-remove-action',
              soundIntent: 'deselect'
            }
          )
        : null;
      const action = document.createElement('div');
      action.className = 'oling-lab-incubator-panel-action';

      if (egg && !eggSlot.placedAt) {
        action.appendChild(
          createInlineAction(
            'Start Hatching',
            () => core.startHatchingStagedEgg(liveContext),
            { className: 'is-hatch-action', soundIntent: 'confirm' }
          )
        );
      } else if (!egg) {
        action.appendChild(
          createInlineAction(
            'Insert Egg',
            () => {
              if (selectedEggKey)
                core.placeEggInIncubator(liveContext, selectedEggKey);
            },
            {
              className: 'is-egg-action',
              disabled: !selectedEggKey,
              soundIntent: 'confirm'
            }
          )
        );
      } else if (hatchProgress.isReady) {
        action.appendChild(
          createInlineAction(
            'Hatch Oling',
            () => core.hatchEggFromIncubator(liveContext),
            {
              className: 'is-hatch-action',
              disabled: Boolean(state.hatching),
              soundIntent: 'confirm'
            }
          )
        );
      } else {
        action.dataset.olingHatchActions = '';
        action.appendChild(
          createInlineAction('Incubating…', () => {}, {
            disabled: true,
            sound: false
          })
        );
      }
      return [...(removeAction ? [removeAction] : []), action];
    }

    function createTabFooterActions(context, tab) {
      if (tab?.label === 'Influences') {
        return createInfluencesFooter(context);
      }
      return createIncubatorFooterActions(context, tab);
    }

    function refreshIncubatorFooter(context) {
      const liveContext = getLiveContext(context);
      if (elements.incubatorPanelFooter && state.incubatorPanelOpen) {
        elements.incubatorPanelFooter.replaceChildren(
          ...createPanelFooter(liveContext)
        );
        return;
      }
      const actionArea = elements.menuContent?.querySelector(
        '.oling-lab-container-action-area'
      );
      if (!actionArea) return;
      actionArea.replaceChildren(
        ...createTabFooterActions(liveContext, {
          label: actionArea.dataset.olingActiveTab
        })
      );
    }

    function refreshInfluenceView(context) {
      const liveContext = getLiveContext(context);
      if (elements.incubatorPanel && state.incubatorPanelOpen) {
        renderIncubatorPanel(liveContext);
        return;
      }
      const influenceTab =
        elements.menuTabs?.querySelector('[data-oling-lab-tab="Influences"]') ||
        elements.menuContent?.querySelector(
          '[data-oling-lab-tab="Influences"]'
        );
      if (influenceTab) {
        influenceTab.click();
        return;
      }
      openIncubatorMenu(liveContext);
    }

    function renderIncubatorPanel(context) {
      if (!elements.incubatorPanel || !context) return;
      const liveContext = getLiveContext(context);
      const tabMenu = createIncubatorTabs(liveContext, {
        initialLabel: state.incubatorPanelTabLabel || 'Incubate',
        onActivate(tab) {
          state.incubatorPanelTabLabel = tab.label;
          elements.incubatorPanelFooter?.replaceChildren(
            ...createPanelFooter(liveContext)
          );
          updateBackButton(liveContext);
          startIncubatorCountdown(liveContext);
        }
      });
      const tabList = tabMenu.querySelector?.(':scope > .oling-lab-tab-list');
      if (tabList && elements.incubatorPanelTabs) {
        tabMenu.classList.add('has-external-tabs');
        elements.incubatorPanelTabs.replaceChildren(tabList);
        elements.incubatorPanelTabs.hidden = false;
      }
      elements.incubatorPanelContent.replaceChildren(tabMenu);
      elements.incubatorPanelFooter?.replaceChildren(
        ...createPanelFooter(liveContext)
      );
      updateBackButton(liveContext);
      startIncubatorCountdown(liveContext);
    }

    closeIncubatorPanel = ({ sound = true, release = true } = {}) => {
      if (!elements.incubatorPanel) return;
      const pendingClose = panelTransitions?.getPendingClose?.(
        elements.incubatorPanel
      );
      if (!state.incubatorPanelOpen) {
        return pendingClose || Promise.resolve(false);
      }
      const wasExpanded = !state.incubatorPanelCollapsed;
      const placedId = state.activeIncubatorPlacedId;
      const context = getLiveContext({ parentPlacedId: placedId });
      if (context) {
        clearPanelDrilldown(context);
        core.setStagedIncubatorEggKey(context, null);
      }
      state.incubatorPanelOpen = false;
      state.incubatorPanelCollapsed = false;
      state.activeIncubatorPlacedId = null;
      elements.incubatorPanelToggle?.setAttribute('aria-expanded', 'false');
      if (
        release &&
        state.selectedTarget?.type === 'furniture' &&
        state.selectedTarget.id === placedId
      ) {
        closeSelectedTarget?.();
        renderLab?.();
      }
      const playCloseSound = () => {
        if (sound && wasExpanded) playSound('sidePanelClose');
      };
      const cleanup = () => {
        elements.incubatorPanel.classList.remove('is-open', 'is-collapsed');
        elements.incubatorPanelContent?.replaceChildren();
        elements.incubatorPanelFooter?.replaceChildren();
        if (elements.incubatorPanelTabs) {
          elements.incubatorPanelTabs.hidden = true;
          elements.incubatorPanelTabs.replaceChildren();
        }
      };
      if (panelTransitions) {
        return panelTransitions.close(elements.incubatorPanel, {
          beforeExit: playCloseSound,
          afterClose: cleanup
        });
      }
      playCloseSound();
      elements.incubatorPanel.hidden = true;
      cleanup();
      return Promise.resolve(true);
    };

    elements.incubatorPanelToggle?.addEventListener('click', () =>
      setPanelCollapsed(!state.incubatorPanelCollapsed)
    );
    elements.incubatorPanelBack?.addEventListener('click', () => {
      const placedId = state.activeIncubatorPlacedId;
      const context = getLiveContext({
        parentPlacedId: placedId
      });
      if (clearPanelDrilldown(context)) {
        renderIncubatorPanel(context);
        return;
      }
      closeIncubatorPanel();
      elements.room
        ?.querySelector(`[data-oling-lab-placed-id="${placedId}"]`)
        ?.focus();
    });

    openIncubatorMenu = (context) => {
      if (elements.incubatorPanel) {
        const liveContext = getLiveContext(context);
        if (!liveContext) return;
        if (
          state.incubatorPanelOpen &&
          state.activeIncubatorPlacedId === liveContext.parentPlacedId &&
          state.incubatorPanelCollapsed
        ) {
          setPanelCollapsed(false);
          return;
        }
        const wasExpanded =
          state.incubatorPanelOpen && !state.incubatorPanelCollapsed;
        if (elements.backdrop && !elements.backdrop.hidden) closeMenu?.();
        dependencies.getOlingViews?.()?.closeOlingPanel?.({ sound: false });
        dependencies.closeGatewayPanel?.({ sound: false });
        state.incubatorPanelOpen = true;
        state.incubatorPanelCollapsed = false;
        state.activeIncubatorPlacedId = liveContext.parentPlacedId;
        state.incubatorPanelTabLabel ||= 'Incubate';
        const theme = resolveMenuConfig?.({ theme: 'incubation' }) || {};
        for (const [property, value] of [
          ['--wall-decoration-panel-primary', theme.primaryColour],
          ['--wall-decoration-panel-secondary', theme.secondaryColour]
        ]) {
          if (value) elements.incubatorPanel.style.setProperty(property, value);
        }
        elements.incubatorPanelTitle.textContent =
          liveContext.incubator.name || 'Incubator';
        renderIncubatorPanel(liveContext);
        elements.incubatorPanelToggle.textContent = 'Hide';
        elements.incubatorPanelToggle.setAttribute('aria-expanded', 'true');
        renderLab?.();
        const afterOpen = () => {
          if (!wasExpanded) playSound('sidePanelOpen');
        };
        if (panelTransitions) {
          void panelTransitions.open(elements.incubatorPanel, { afterOpen });
        } else {
          elements.incubatorPanel.hidden = false;
          elements.incubatorPanel.classList.remove('is-collapsed');
          elements.incubatorPanel.classList.add('is-open');
          afterOpen();
        }
        window.dispatchEvent(
          new CustomEvent('oling-lab:tutorial-incubator-opened')
        );
        return;
      }
      openMenu(
        `${context.incubator.name || 'Incubator'} Check-In`,
        [
          createIncubatorTabs(context, {
            actionContent: (tab) => createTabFooterActions(context, tab)
          })
        ],
        { theme: 'incubation' }
      );
      startIncubatorCountdown(context);
      window.dispatchEvent(
        new CustomEvent('oling-lab:tutorial-incubator-opened')
      );
    };

    return {
      getIncubatorContext: core.getIncubatorContext,
      getIncubatorEggSlot: core.getIncubatorEggSlot,
      setPanelInteractivity: core.setPanelInteractivity,
      openStagePanel: core.openStagePanel,
      closeStagePanel: core.closeStagePanel,
      removeEggFromIncubator: core.removeEggFromIncubator,
      hatchEggFromIncubator: core.hatchEggFromIncubator,
      getStagedIncubatorEggKey: core.getStagedIncubatorEggKey,
      setStagedIncubatorEggKey: core.setStagedIncubatorEggKey,
      startHatchingStagedEgg: core.startHatchingStagedEgg,
      openIncubatorMenu,
      closeIncubatorPanel
    };
  }

  window.createOlingLabIncubator = createOlingLabIncubator;
})();
