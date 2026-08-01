(function () {
  function createOlingLabMenuShell(dependencies) {
    const {
      state,
      elements,
      containerThemes: OLING_CONTAINER_THEMES,
      clearHatchTimer,
      clearRestTimer,
      clearAdventureTimer,
      closeSelectedTarget,
      getTargetKey,
      renderLab
    } = dependencies;

    function resolveMenuConfig(config = {}) {
      const themeKey = config.theme || config.themeKey || config.type || '';
      const theme = OLING_CONTAINER_THEMES[themeKey] || {};
      return {
        ...theme,
        ...config,
        themeKey: OLING_CONTAINER_THEMES[themeKey] ? themeKey : ''
      };
    }

    function applyMenuConfig(config = {}) {
      if (!elements.menu) return;
      const resolvedConfig = resolveMenuConfig(config);
      const colourEntries = [
        ['--oling-lab-menu-primary-colour', resolvedConfig.primaryColour],
        ['--oling-lab-menu-secondary-colour', resolvedConfig.secondaryColour]
      ];
      colourEntries.forEach(([property, value]) => {
        if (value) {
          elements.menu.style.setProperty(property, value);
        } else {
          elements.menu.style.removeProperty(property);
        }
      });
      if (resolvedConfig.themeKey) {
        elements.menu.dataset.theme = resolvedConfig.themeKey;
      } else {
        delete elements.menu.dataset.theme;
      }
    }

    function applyActionPanelTheme(panel, config = {}) {
      if (!panel) return;
      const resolvedConfig = resolveMenuConfig(config);
      [
        ['--oling-lab-action-primary-colour', resolvedConfig.primaryColour],
        ['--oling-lab-action-secondary-colour', resolvedConfig.secondaryColour]
      ].forEach(([property, value]) => {
        if (value) {
          panel.style.setProperty(property, value);
        } else {
          panel.style.removeProperty(property);
        }
      });
    }

    function canUseSharedOverlay() {
      return (
        typeof popUpClassArray !== 'undefined' &&
        Array.isArray(popUpClassArray) &&
        typeof showContainer === 'function' &&
        typeof hideContainer === 'function' &&
        typeof addElementIfNotExists === 'function' &&
        typeof removeElementIfExists === 'function' &&
        typeof toggleOverlay === 'function'
      );
    }

    function openSharedLabOverlay() {
      if (!elements.backdrop) return;
      elements.backdrop.hidden = false;
      openSharedPopup(elements.backdrop);
    }

    function closeSharedLabOverlay() {
      if (!elements.backdrop) return;
      closeSharedPopup(elements.backdrop, { remove: false });
      elements.backdrop.hidden = true;
    }

    function openSharedPopup(element) {
      if (!element) return;
      if (canUseSharedOverlay()) {
        showContainer(element);
        addElementIfNotExists(popUpClassArray, element);
        toggleOverlay(true);
        return;
      }
      if (element.getAttribute('role') === 'dialog' && window.OeDialog) {
        if (typeof showContainer === 'function') {
          showContainer(element);
        } else {
          element.classList.add('is-visible');
        }
        window.OeDialog.openContent(element, {
          initialFocus: 'button:not(:disabled)'
        });
        return;
      }
      element.classList.add('is-visible');
    }

    function closeSharedPopup(element, options = {}) {
      if (!element) return;
      if (canUseSharedOverlay()) {
        hideContainer(element);
        removeElementIfExists(popUpClassArray, element);
      } else if (element.closest?.('dialog.oe-dialog') && window.OeDialog) {
        if (typeof hideContainer === 'function') {
          hideContainer(element);
        } else {
          element.classList.remove('is-visible');
        }
        window.OeDialog.closeContent(element);
        return;
      } else {
        element.classList.remove('is-visible');
      }
      if (options.remove !== false) element.remove();
    }

    function openMenu(title, children, config = {}) {
      clearHatchTimer();
      clearRestTimer();
      clearAdventureTimer();
      closeSelectedTarget();
      state.menuSelectedTarget = null;
      state.pinnedMenu = Boolean(config.pinned);
      if (config.selectedTarget?.type && config.selectedTarget?.id) {
        state.selectedTarget = {
          type: config.selectedTarget.type,
          id: config.selectedTarget.id
        };
        state.menuSelectedTarget = { ...state.selectedTarget };
        renderLab();
      }
      applyMenuConfig(config);
      elements.menuTitle.textContent = title;
      elements.menuContent.replaceChildren(...children);
      const tabMenu = elements.menuContent.querySelector('.oling-lab-tab-menu');
      const tabList = tabMenu?.querySelector(':scope > .oling-lab-tab-list');
      const tabActions = tabMenu?.querySelector(
        ':scope > .oling-lab-container-action-area'
      );
      if (tabList && elements.menuTabs) {
        tabMenu.classList.add('has-external-tabs');
        elements.menuTabs.replaceChildren(tabList);
        elements.menuTabs.hidden = false;
      } else if (elements.menuTabs) {
        elements.menuTabs.hidden = true;
        elements.menuTabs.replaceChildren();
      }
      if (elements.menuFooter) {
        const footerChildren = tabActions
          ? [tabActions]
          : Array.isArray(config.footer)
            ? config.footer
            : config.footer
              ? [config.footer]
              : [];
        elements.menuFooter.replaceChildren(...footerChildren);
        elements.menuFooter.hidden = false;
      }
      openSharedLabOverlay();
    }

    function closeMenu(options = {}) {
      if (state.pinnedMenu && !options.force) return;
      clearHatchTimer();
      clearRestTimer();
      clearAdventureTimer();
      state.incubatorPanelTargets = {};
      state.animatingIncubatorPanelTarget = null;
      if (
        state.menuSelectedTarget &&
        getTargetKey(state.selectedTarget) ===
          getTargetKey(state.menuSelectedTarget)
      ) {
        closeSelectedTarget();
        renderLab();
      }
      state.menuSelectedTarget = null;
      state.pinnedMenu = false;
      closeSharedLabOverlay();
      if (elements.menuTabs) {
        elements.menuTabs.hidden = true;
        elements.menuTabs.replaceChildren();
      }
      if (elements.menuFooter) {
        elements.menuFooter.replaceChildren();
      }
      elements.menuContent.replaceChildren();
      applyMenuConfig();
    }

    return {
      resolveMenuConfig,
      applyMenuConfig,
      applyActionPanelTheme,
      openSharedPopup,
      closeSharedPopup,
      openMenu,
      closeMenu
    };
  }

  window.createOlingLabMenuShell = createOlingLabMenuShell;
})();
