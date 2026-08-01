(function () {
  const shop = (window.OE_SHOP_LANDING = window.OE_SHOP_LANDING || {});

  with (shop) {
    function createShopHatchImage(src, alt) {
      const image = document.createElement('img');
      image.src = src;
      image.alt = alt || '';
      image.loading = 'lazy';
      image.decoding = 'async';
      return image;
    }

    function formatShopHatchTitle(value) {
      return String(value || '')
        .replace(/[-_]+/g, ' ')
        .replace(/\b\w/g, (letter) => letter.toUpperCase());
    }

    function applyShopRarityTheme(element, rarity) {
      if (!element) return;
      const key = String(rarity || '').trim().toLowerCase();
      const theme = rarityPalette[key];
      element.dataset.rarity = key;
      if (!theme) return;
      if (theme.primaryColour) {
        element.style.setProperty('--oling-rarity-primary-colour', theme.primaryColour);
      }
      if (theme.secondaryColour) {
        element.style.setProperty('--oling-rarity-secondary-colour', theme.secondaryColour);
      }
      if (theme.textColour) {
        element.style.setProperty('--oling-rarity-text-colour', theme.textColour);
      }
    }

    function createShopHatchDetailRow(label, value, options = {}) {
      const row = document.createElement('div');
      row.className = 'oling-lab-detail-row';
      if (options.rarity) {
        row.classList.add('is-rarity-detail');
        applyShopRarityTheme(row, options.rarity);
      }
      row.append(
        Object.assign(document.createElement('span'), { textContent: label }),
        Object.assign(document.createElement('strong'), { textContent: value })
      );
      return row;
    }

    function createShopHatchInlineAction(label, onClick, options = {}) {
      const button = document.createElement('button');
      button.className = 'oling-lab-menu-action';
      if (options.className) button.classList.add(options.className);
      button.type = 'button';
      button.disabled = Boolean(options.disabled);
      button.appendChild(
        Object.assign(document.createElement('span'), { textContent: label })
      );
      button.addEventListener('click', onClick);
      return button;
    }

    function createShopHatchStatsToggleButton(label, onClick) {
      const button = document.createElement('button');
      button.className = 'oling-lab-stats-toggle';
      button.type = 'button';
      button.setAttribute('aria-label', label);
      const icon = Object.assign(document.createElement('span'), {
        className: 'oling-lab-stats-toggle-icon',
        textContent: 'i'
      });
      icon.setAttribute('aria-hidden', 'true');
      button.appendChild(icon);
      button.addEventListener('click', onClick);
      return button;
    }

    function createShopHatchPanelBackButton(label, onClick) {
      const button = document.createElement('button');
      button.className = 'oling-lab-panel-back';
      button.type = 'button';
      button.setAttribute('aria-label', label);
      button.addEventListener('click', onClick);
      return button;
    }

    function setShopHatchPanelInteractivity(panel, isVisible) {
      if (!panel) return;
      panel.inert = !isVisible;
      panel.setAttribute('aria-hidden', String(!isVisible));
    }

    function openShopHatchStagePanel(stage, panel, openClassName) {
      setShopHatchPanelInteractivity(panel, true);
      window.requestAnimationFrame(() => {
        stage.classList.add(openClassName);
        panel.classList.add('is-open');
      });
    }

    function closeShopHatchStagePanel(stage, panel, openClassName) {
      stage.classList.remove(openClassName);
      if (panel) panel.classList.remove('is-open');
      setShopHatchPanelInteractivity(panel, false);
    }

    function createShopHatchTabMenu(tabs, options = {}) {
      const shell = document.createElement('div');
      shell.className = 'oling-lab-tab-menu';
      const tabList = document.createElement('div');
      tabList.className = 'oling-lab-tab-list';
      tabList.setAttribute('role', 'tablist');
      const panel = document.createElement('div');
      panel.className = 'oling-lab-tab-panel';
      const actionArea = document.createElement('div');
      actionArea.className = 'oling-lab-container-action-area';

      function activateTab(index) {
        [...tabList.children].forEach((button, buttonIndex) => {
          button.setAttribute('aria-selected', String(buttonIndex === index));
        });
        panel.replaceChildren(...tabs[index].content());
        actionArea.replaceChildren(...(options.actionContent?.(tabs[index], index) || []));
        options.onActivate?.(tabs[index], index);
      }

      tabs.forEach((tab, index) => {
        const button = document.createElement('button');
        button.className = 'oling-lab-tab';
        button.type = 'button';
        button.setAttribute('role', 'tab');
        button.setAttribute('aria-selected', String(index === 0));
        button.textContent = tab.label;
        button.addEventListener('click', () => activateTab(index));
        tabList.appendChild(button);
      });

      shell.append(tabList, panel, actionArea);
      activateTab(Math.max(0, tabs.findIndex((tab) => tab.label === options.initialLabel)));
      return shell;
    }

    function canUseSharedOverlay() {
      return typeof popUpClassArray !== 'undefined'
        && Array.isArray(popUpClassArray)
        && typeof showContainer === 'function'
        && typeof hideContainer === 'function'
        && typeof addElementIfNotExists === 'function'
        && typeof removeElementIfExists === 'function'
        && typeof toggleOverlay === 'function';
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
        window.OeDialog.openContent(element, { initialFocus: 'button:not(:disabled)' });
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

    function createShopHatchMenuShell() {
      const backdrop = document.createElement('div');
      backdrop.className = 'oling-lab-menu-backdrop shop-hatch-preview-backdrop';
      backdrop.setAttribute('role', 'presentation');
      backdrop.dataset.removeOnContainerClose = 'true';

      const menu = document.createElement('section');
      menu.className = 'oling-lab-menu shop-hatch-preview-menu';
      menu.setAttribute('role', 'dialog');
      menu.setAttribute('aria-modal', 'true');
      menu.setAttribute('aria-labelledby', 'shop-hatch-preview-title');
      menu.addEventListener('click', (event) => event.stopPropagation());

      const tabs = document.createElement('nav');
      tabs.className = 'oling-lab-menu-tabs';
      tabs.setAttribute('aria-label', 'Menu sections');
      tabs.hidden = true;
      const header = document.createElement('header');
      header.className = 'oling-lab-menu-header';
      const title = Object.assign(document.createElement('h2'), {
        id: 'shop-hatch-preview-title',
        textContent: 'Preview Hatch'
      });
      header.appendChild(title);
      const content = document.createElement('div');
      content.className = 'oling-lab-menu-content';
      const footer = document.createElement('footer');
      footer.className = 'oling-lab-menu-footer';
      menu.append(tabs, header, content, footer);
      backdrop.appendChild(menu);

      const close = () => closeSharedPopup(backdrop);
      backdrop.addEventListener('click', (event) => {
        if (event.target === backdrop) {
          close();
          return;
        }
        event.stopPropagation();
      });

      return { backdrop, title, content, footer, tabs, close };
    }

    function openShopHatchMenu(titleText, children, config = {}) {
      const existingPreview = document.querySelector('.shop-hatch-preview-backdrop');
      if (existingPreview) closeSharedPopup(existingPreview);
      const shell = createShopHatchMenuShell();
      shell.title.textContent = titleText;
      shell.content.replaceChildren(...children);
      const tabMenu = shell.content.querySelector('.oling-lab-tab-menu');
      const tabList = tabMenu?.querySelector(':scope > .oling-lab-tab-list');
      const tabActions = tabMenu?.querySelector(':scope > .oling-lab-container-action-area');
      if (tabList) {
        tabMenu.classList.add('has-external-tabs');
        shell.tabs.replaceChildren(tabList);
        shell.tabs.hidden = false;
      }
      const footerChildren = tabActions?.children.length
        ? [tabActions]
        : [];
      shell.footer.replaceChildren(...footerChildren);
      if (config.theme) shell.backdrop.dataset.theme = config.theme;
      document.body.appendChild(shell.backdrop);
      openSharedPopup(shell.backdrop);
    }

    Object.assign(shop, {
      applyShopRarityTheme,
      canUseSharedOverlay,
      closeSharedPopup,
      closeShopHatchStagePanel,
      createShopHatchDetailRow,
      createShopHatchImage,
      createShopHatchInlineAction,
      createShopHatchMenuShell,
      createShopHatchPanelBackButton,
      createShopHatchStatsToggleButton,
      createShopHatchTabMenu,
      formatShopHatchTitle,
      openSharedPopup,
      openShopHatchMenu,
      openShopHatchStagePanel,
      setShopHatchPanelInteractivity
    });
  }
})();
