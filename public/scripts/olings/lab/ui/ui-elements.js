(function () {
  function createOlingLabUiElements({ createImage, applyRarityTheme }) {
    function applyControlSound(button, options = {}, fallbackIntent = '') {
      if (options.sound === false) {
        button.dataset.sound = 'none';
        return;
      }
      if (typeof options.sound === 'string' && options.sound.trim()) {
        button.dataset.sound = options.sound.trim();
        return;
      }
      const intent = options.soundIntent || fallbackIntent;
      if (intent) button.dataset.soundIntent = intent;
    }

    function createItemButton(item, options = {}) {
      const button = document.createElement('button');
      button.className = 'oling-lab-menu-action';
      button.type = 'button';
      button.disabled = Boolean(options.disabled);
      applyControlSound(button, options, 'select');
      if (options.badge) button.dataset.badge = options.badge;
      if (item.image) button.appendChild(createImage(item.image, item.name));
      else {
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
      applyControlSound(button, options, 'select');
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
      button.dataset.soundIntent = 'open';
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
      button.dataset.soundIntent = 'previous';
      button.setAttribute('aria-label', label);
      button.textContent = 'Back';
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
    return {
      createItemButton,
      createInlineAction,
      createStatsToggleButton,
      createPanelBackButton,
      createSquareMarker,
      createEmptyMessage,
      createConstrainedEmptyTab,
      createDetailRow,
      createCompactDetailPair
    };
  }
  window.createOlingLabUiElements = createOlingLabUiElements;
})();
