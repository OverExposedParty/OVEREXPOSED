(function () {
  function createOlingLabUi(dependencies) {
    const {
      createImage,
      applyRarityTheme,
      clearHatchTimer,
      clearAdventureTimer
    } = dependencies;

    function createItemButton(item, options = {}) {
      const button = document.createElement('button');
      button.className = 'oling-lab-menu-action';
      button.type = 'button';
      button.disabled = Boolean(options.disabled);
      if (options.badge) button.dataset.badge = options.badge;
      if (item.image) {
        button.appendChild(createImage(item.image, item.name));
      } else {
        const placeholder = document.createElement('span');
        placeholder.className = 'oling-lab-menu-placeholder';
        placeholder.textContent = String(item.name || '?')
          .charAt(0)
          .toUpperCase();
        button.appendChild(placeholder);
      }
      button.appendChild(
        Object.assign(document.createElement('span'), {
          textContent: item.name
        })
      );
      if (options.onClick) button.addEventListener('click', options.onClick);
      return button;
    }

    function createInlineAction(label, onClick, options = {}) {
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

    function createStatsToggleButton(label, onClick) {
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

    function createPanelBackButton(label, onClick) {
      const button = document.createElement('button');
      button.className = 'oling-lab-panel-back';
      button.type = 'button';
      button.setAttribute('aria-label', label);
      button.addEventListener('click', onClick);
      return button;
    }

    function createSquareMarker(text, className = '') {
      const marker = document.createElement('span');
      marker.className = ['oling-lab-square-marker', className]
        .filter(Boolean)
        .join(' ');
      marker.textContent = text;
      return marker;
    }

    function createEmptyMessage(message) {
      const empty = document.createElement('p');
      empty.className = 'oling-lab-menu-empty';
      empty.textContent = message;
      return empty;
    }

    function createConstrainedEmptyTab(message) {
      const section = document.createElement('section');
      section.className = 'oling-lab-menu-section';
      const stage = document.createElement('div');
      stage.className = 'oling-lab-content-stage';
      stage.appendChild(createEmptyMessage(message));
      section.appendChild(stage);
      return [section];
    }

    function createDetailRow(label, value, options = {}) {
      const row = document.createElement('div');
      row.className = 'oling-lab-detail-row';
      if (options.rarity) {
        row.classList.add('is-rarity-detail');
        applyRarityTheme(row, options.rarity);
      }
      row.append(
        Object.assign(document.createElement('span'), { textContent: label }),
        Object.assign(document.createElement('strong'), { textContent: value })
      );
      return row;
    }

    function createCompactDetailPair(
      leftLabel,
      leftValue,
      rightLabel,
      rightValue,
      hooks = {}
    ) {
      const row = document.createElement('div');
      row.className = 'oling-lab-detail-pair';
      [
        [leftLabel, leftValue],
        [rightLabel, rightValue]
      ].forEach(([label, value]) => {
        const item = document.createElement('div');
        const valueElement = Object.assign(document.createElement('strong'), {
          textContent: value
        });
        item.className = 'oling-lab-detail-pair-item';
        if (hooks[label]) valueElement.dataset[hooks[label]] = '';
        item.append(
          Object.assign(document.createElement('span'), { textContent: label }),
          valueElement
        );
        row.appendChild(item);
      });
      return row;
    }

    function formatTitle(value) {
      return String(value || '')
        .replace(/[-_]+/g, ' ')
        .replace(/\b\w/g, (letter) => letter.toUpperCase());
    }

    function formatOdds(value) {
      const number = Number(value);
      if (!Number.isFinite(number) || number <= 0) return '0%';
      return `${Math.round(number * 100)}%`;
    }

    function formatInfluenceEffect(consumable) {
      const amount = Number(consumable?.effect?.amount || 0);
      const effectType = consumable?.effect?.type || '';
      if (!Number.isFinite(amount) || amount === 0) return '';
      if (effectType === 'hatch_speed') return `+${amount}% speed`;
      if (effectType === 'rarity_chance') return `+${amount}% rarity`;
      if (effectType === 'matching_set' || effectType === 'set_match') {
        return `+${amount}% match`;
      }
      return `+${amount}%`;
    }

    function formatDuration(milliseconds) {
      const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;

      if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
      if (minutes > 0) return `${minutes}m ${seconds}s`;
      return `${seconds}s`;
    }

    function createTabMenu(tabs, options = {}) {
      const shell = document.createElement('div');
      shell.className = 'oling-lab-tab-menu';
      const tabList = document.createElement('div');
      tabList.className = 'oling-lab-tab-list';
      tabList.setAttribute('role', 'tablist');
      const panel = document.createElement('div');
      panel.className = 'oling-lab-tab-panel';
      const actionArea = document.createElement('div');
      actionArea.className = 'oling-lab-container-action-area';

      function normalizeContent(content) {
        if (!content) return [];
        if (typeof content[Symbol.iterator] === 'function') return [...content];
        return [content];
      }

      function activateTab(index) {
        clearHatchTimer();
        clearAdventureTimer();
        [...tabList.children].forEach((button, buttonIndex) => {
          button.setAttribute('aria-selected', String(buttonIndex === index));
        });
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
    }

    return {
      createItemButton,
      createInlineAction,
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
      createTabMenu
    };
  }

  window.createOlingLabUi = createOlingLabUi;
})();
