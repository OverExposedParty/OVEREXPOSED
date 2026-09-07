(function () {
  function createOlingLabTabMenuFactory({
    clearHatchTimer,
    clearAdventureTimer
  }) {
    return function createTabMenu(tabs, options = {}) {
      const shell = document.createElement('div');
      shell.className = 'oling-lab-tab-menu';
      const tabList = document.createElement('div');
      tabList.className = 'oling-lab-tab-list';
      tabList.setAttribute('role', 'tablist');
      const panel = document.createElement('div');
      panel.className = 'oling-lab-tab-panel';
      const actionArea = document.createElement('div');
      actionArea.className = 'oling-lab-container-action-area';
      const normalizeContent = (content) => {
        if (!content) return [];
        return typeof content[Symbol.iterator] === 'function'
          ? [...content]
          : [content];
      };
      function activateTab(index) {
        clearHatchTimer();
        clearAdventureTimer();
        [...tabList.children].forEach((button, buttonIndex) =>
          button.setAttribute('aria-selected', String(buttonIndex === index))
        );
        panel.replaceChildren(...normalizeContent(tabs[index].content()));
        actionArea.dataset.olingActiveTab = tabs[index].label;
        actionArea.replaceChildren(
          ...normalizeContent(options.actionContent?.(tabs[index], index))
        );
        options.onActivate?.(tabs[index], index);
      }
      tabs.forEach((tab, index) => {
        const button = document.createElement('button');
        button.className = 'oling-lab-tab';
        button.dataset.olingLabTab = tab.label;
        button.type = 'button';
        button.setAttribute('role', 'tab');
        button.setAttribute('aria-selected', String(index === 0));
        button.textContent = tab.label;
        button.addEventListener('click', () => activateTab(index));
        tabList.appendChild(button);
      });
      shell.append(tabList, panel, actionArea);
      activateTab(
        Math.max(
          0,
          tabs.findIndex((tab) => tab.label === options.initialLabel)
        )
      );
      return shell;
    };
  }
  window.createOlingLabTabMenuFactory = createOlingLabTabMenuFactory;
})();
