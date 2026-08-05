(function () {
  const DEFAULT_OE_ICON = '0000:0100:0200:0300';

  function formatLabel(value) {
    return String(value || '')
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .replace(/[-_]+/g, ' ')
      .replace(/\b\w/g, (character) => character.toUpperCase());
  }

  function formatValue(value) {
    if (value === true) return 'On';
    if (value === false) return 'Off';
    if (value == null || value === '') return '-';
    if (Array.isArray(value)) return value.join(', ') || '-';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  }

  function createElement(tagName, className, text) {
    const element = document.createElement(tagName);
    if (className) element.className = className;
    if (text != null) element.textContent = text;
    return element;
  }

  function createOeStack(userIcon) {
    const resolvedIcon =
      typeof userIcon === 'string' && userIcon.split(':').length === 4
        ? userIcon
        : DEFAULT_OE_ICON;

    try {
      const parsed = window.parseCustomisationString(resolvedIcon);
      return window.CreateImageStack({
        colour: window.getFilePathByCustomisationId(parsed.colour, 'colour'),
        headSlot: window.getFilePathByCustomisationId(parsed.head, 'headSlot'),
        eyesSlot: window.getFilePathByCustomisationId(parsed.eyes, 'eyesSlot'),
        mouthSlot: window.getFilePathByCustomisationId(
          parsed.mouth,
          'mouthSlot'
        )
      });
    } catch (error) {
      return createElement('div', 'oe-panel-room-avatar-fallback', 'OE');
    }
  }

  function createSection(title) {
    const section = createElement('section', 'oe-panel-room-section');
    section.appendChild(
      createElement('h4', 'oe-panel-room-section-title', title)
    );
    return section;
  }

  function createEmptyState(message) {
    return createElement('p', 'oe-panel-room-empty', message);
  }

  function createPlayerSection(players) {
    const section = createSection('Players');
    section.classList.add('oe-panel-room-section-wide');
    const grid = createElement('div', 'oe-panel-room-player-grid');

    if (!players.length) {
      section.appendChild(createEmptyState('No players were recorded.'));
      return section;
    }

    players.forEach((player) => {
      const card = createElement('article', 'oe-panel-room-player-card');
      if (player.isHost) card.classList.add('is-host');

      const avatar = createElement('div', 'oe-panel-room-player-avatar');
      avatar.appendChild(createOeStack(player.userIcon));

      const nameRow = createElement('div', 'oe-panel-room-player-name-row');
      nameRow.appendChild(
        createElement(
          'strong',
          'oe-panel-room-player-name',
          player.username || 'Unknown player'
        )
      );
      if (player.isHost) {
        nameRow.appendChild(
          createElement('span', 'oe-panel-room-host-badge', 'Host')
        );
      }

      const badges = createElement('div', 'oe-panel-room-player-badges');
      [
        player.accountType,
        player.connectionStatus,
        player.isReady ? 'Ready' : '',
        player.score != null ? `Score ${player.score}` : ''
      ]
        .filter(Boolean)
        .forEach((label) =>
          badges.appendChild(
            createElement('span', 'oe-panel-room-player-badge', label)
          )
        );

      card.append(avatar, nameRow, badges);
      grid.appendChild(card);
    });

    section.appendChild(grid);
    return section;
  }

  function createPackSection(visual) {
    const section = createSection('Selected Packs');
    const selectedPacks = Array.isArray(visual.selectedPacks)
      ? visual.selectedPacks
      : [];
    const suppliedDetails = Array.isArray(visual.selectedPackDetails)
      ? visual.selectedPackDetails
      : [];
    const detailsByKey = new Map(
      suppliedDetails.map((pack) => [String(pack.key || ''), pack])
    );
    const packs = selectedPacks.map(
      (key) => detailsByKey.get(String(key)) || { key, title: key }
    );

    if (!packs.length) {
      section.appendChild(createEmptyState('No packs were selected.'));
      return section;
    }

    const buttonContainer = createElement(
      'div',
      'oe-panel-room-pack-button-container'
    );
    packs.forEach((pack) => {
      const button = createElement('button', 'oe-panel-room-pack-button');
      button.type = 'button';
      button.disabled = true;
      button.appendChild(
        createElement(
          'span',
          'oe-panel-room-pack-label',
          formatLabel(pack.title || pack.key)
        )
      );

      const difficultyIcons = String(pack.difficulty || '')
        .split(',')
        .map((difficulty) => difficulty.trim().toLowerCase())
        .filter((difficulty) => difficulty && difficulty !== '-');
      if (
        String(pack.restriction || '').toLowerCase() === 'nsfw' &&
        !difficultyIcons.includes('nsfw')
      ) {
        difficultyIcons.push('nsfw');
      }
      difficultyIcons.forEach((difficulty) => {
        const image = document.createElement('img');
        image.className = 'oe-panel-room-pack-difficulty-icon';
        image.src = `/images/icons/difficulty/${encodeURIComponent(difficulty)}.svg`;
        image.alt = formatLabel(difficulty);
        button.appendChild(image);
      });

      if (pack.colour && pack.colour !== '-') {
        button.style.setProperty('--oe-panel-room-pack-colour', pack.colour);
      }
      if (pack.secondaryColour && pack.secondaryColour !== '-') {
        button.style.setProperty(
          '--oe-panel-room-pack-secondary-colour',
          pack.secondaryColour
        );
      }
      buttonContainer.appendChild(button);
    });
    section.appendChild(buttonContainer);
    return section;
  }

  function createRecordSection(title, record, emptyMessage) {
    const section = createSection(title);
    const entries = Object.entries(record || {});
    if (!entries.length) {
      section.appendChild(createEmptyState(emptyMessage));
      return section;
    }

    const list = createElement('dl', 'oe-panel-room-record-list');
    entries.forEach(([key, value]) => {
      const item = createElement('div', 'oe-panel-room-record-item');
      item.append(
        createElement('dt', '', formatLabel(key)),
        createElement('dd', '', formatValue(value))
      );
      list.appendChild(item);
    });
    section.appendChild(list);
    return section;
  }

  function applyRuleColours(element, rule) {
    const isPageColour = (value) =>
      /^var\(--(?:primary|secondary)pagecolour\)/i.test(
        String(value || '').trim()
      );

    if (rule.colour && rule.colour !== '-' && !isPageColour(rule.colour)) {
      element.style.setProperty('--oe-panel-room-rule-colour', rule.colour);
    }
    if (
      rule.secondaryColour &&
      rule.secondaryColour !== '-' &&
      !isPageColour(rule.secondaryColour)
    ) {
      element.style.setProperty(
        '--oe-panel-room-rule-secondary-colour',
        rule.secondaryColour
      );
    }
  }

  function createGameRulesSection(visual) {
    const section = createSection('Game Rules');
    const entries = Object.entries(visual.gameRules || {});
    if (!entries.length) {
      section.appendChild(createEmptyState('No game rules were recorded.'));
      return section;
    }

    const suppliedDetails = Array.isArray(visual.gameRuleDetails)
      ? visual.gameRuleDetails
      : [];
    const detailsByKey = new Map(
      suppliedDetails.map((rule) => [String(rule.key || ''), rule])
    );
    const controls = createElement('div', 'oe-panel-room-rule-controls');

    entries.forEach(([key, value]) => {
      const rule = detailsByKey.get(String(key)) || {
        key,
        title: key,
        buttonType: typeof value === 'number' ? 'Increment' : 'Toggle'
      };
      const title = formatLabel(rule.title || key);
      const isIncrement =
        String(rule.buttonType || '').toLowerCase() === 'increment' ||
        typeof value === 'number';

      if (isIncrement) {
        const container = createElement('div', 'oe-panel-room-rule-increment');
        applyRuleColours(container, rule);
        const countWrapper = createElement(
          'div',
          'oe-panel-room-rule-count-wrapper'
        );
        const decrement = createElement(
          'button',
          'oe-panel-room-rule-count-button',
          '-'
        );
        const increment = createElement(
          'button',
          'oe-panel-room-rule-count-button',
          '+'
        );
        decrement.type = 'button';
        decrement.disabled = true;
        increment.type = 'button';
        increment.disabled = true;
        countWrapper.append(
          decrement,
          createElement(
            'span',
            'oe-panel-room-rule-count-value',
            formatValue(value)
          ),
          increment
        );
        container.append(
          createElement('span', 'oe-panel-room-rule-label', title),
          countWrapper
        );
        controls.appendChild(container);
        return;
      }

      const button = createElement(
        'button',
        'oe-panel-room-rule-toggle',
        title
      );
      button.type = 'button';
      button.disabled = true;
      button.classList.toggle('is-active', Boolean(value));
      button.setAttribute('aria-label', `${title}: ${formatValue(value)}`);
      applyRuleColours(button, rule);
      controls.appendChild(button);
    });

    section.appendChild(controls);
    return section;
  }

  function createStateSection(row) {
    return createRecordSection(
      'Room State',
      {
        Status: row.roomStatus,
        Phase: row.phase,
        'Current Round': row.currentRound,
        'Player Turn': row.playerTurn,
        Outcome: row.outcome,
        Instructions: row.instruction
      },
      'No room state was recorded.'
    );
  }

  function createErrorsSection(errors) {
    const section = createSection('Errors');
    if (!errors.length) {
      section.appendChild(createEmptyState('No errors were recorded.'));
      return section;
    }

    const list = createElement('div', 'oe-panel-room-error-list');
    errors.forEach((error) => {
      const card = createElement('article', 'oe-panel-room-error');
      card.append(
        createElement(
          'strong',
          'oe-panel-room-error-title',
          error.message || 'Unknown room error'
        ),
        createElement(
          'span',
          'oe-panel-room-error-meta',
          [error.source, error.code, error.phase, error.occurredAt]
            .filter(Boolean)
            .join(' · ') || 'No additional details'
        )
      );
      list.appendChild(card);
    });
    section.appendChild(list);
    return section;
  }

  function createRoomVisualizer(row, onBack) {
    const visual = row.roomVisual || {};
    const view = createElement(
      'div',
      'oe-panel-widget oe-panel-room-visualizer'
    );

    const header = createElement('header', 'oe-panel-room-visualizer-header');
    const backButton = createElement(
      'button',
      'oe-panel-alert-detail-back oe-panel-room-back-button'
    );
    backButton.type = 'button';
    backButton.setAttribute('aria-label', 'Back to Rooms');
    backButton.addEventListener('click', onBack);

    const heading = createElement('div', 'oe-panel-room-heading');
    heading.append(
      createElement(
        'span',
        'oe-panel-room-eyebrow',
        formatLabel(row.gamemode || 'Party Game')
      ),
      createElement('h3', 'oe-panel-room-title', `Room ${row.roomCode || '-'}`),
      createElement('span', 'oe-panel-room-status', row.roomStatus || 'Unknown')
    );
    header.append(backButton, heading);

    const meta = createElement('div', 'oe-panel-room-meta-grid');
    [
      ['Game ID', row.gameId],
      ['Players', row.playerCount],
      ['Host', row.hostUser],
      ['Duration', row.timeLapsed],
      ['Created', row.createdAt],
      ['Last Updated', row.lastUpdated],
      ['Server Region', row.serverRegion],
      ['Source', row.sourceCollection]
    ].forEach(([label, value]) => {
      const item = createElement('div', 'oe-panel-room-meta-item');
      item.append(
        createElement('span', 'oe-panel-room-meta-label', label),
        createElement('strong', 'oe-panel-room-meta-value', value || '-')
      );
      meta.appendChild(item);
    });
    const detailsSection = createSection('Room Details');
    detailsSection.classList.add('oe-panel-room-section-wide');
    detailsSection.appendChild(meta);

    const content = createElement('div', 'oe-panel-room-visualizer-content');
    const roleCountEntries = Object.entries(visual.roleCounts || {});
    const errorsSection = createErrorsSection(
      Array.isArray(row.errors) ? row.errors : []
    );
    if (roleCountEntries.length) {
      errorsSection.classList.add('oe-panel-room-section-wide');
    }
    content.append(
      detailsSection,
      createPlayerSection(Array.isArray(visual.players) ? visual.players : []),
      createPackSection(visual),
      createGameRulesSection(visual),
      ...(roleCountEntries.length
        ? [createRecordSection('Role Counts', visual.roleCounts, '')]
        : []),
      createStateSection(row),
      errorsSection
    );

    view.append(
      header,
      createElement('div', 'oe-panel-room-heading-divider'),
      content
    );
    return view;
  }

  function render(container, row) {
    if (!container || !row) return null;

    const expandButton = container.querySelector(
      ':scope > .oe-panel-grid-expand-button'
    );
    const previousNodes = [...container.childNodes].filter(
      (node) => node !== expandButton
    );
    const previousLabel = container.getAttribute('aria-label');
    const primaryColourProperty = '--oe-panel-widget-primary-colour';
    const secondaryColourProperty = '--oe-panel-widget-secondary-colour';
    const previousPrimaryColour = container.style.getPropertyValue(
      primaryColourProperty
    );
    const previousSecondaryColour = container.style.getPropertyValue(
      secondaryColourProperty
    );
    const gamemodePalette = window.OE_PANEL_PALETTES?.get?.(
      'gamemode',
      row.gamemode
    );

    if (gamemodePalette?.primary) {
      container.style.setProperty(
        primaryColourProperty,
        gamemodePalette.primary
      );
    }
    if (gamemodePalette?.secondary) {
      container.style.setProperty(
        secondaryColourProperty,
        gamemodePalette.secondary
      );
    }

    const restore = () => {
      view.remove();
      previousNodes.forEach((node) =>
        container.insertBefore(node, expandButton)
      );
      if (previousLabel) container.setAttribute('aria-label', previousLabel);
      if (previousPrimaryColour) {
        container.style.setProperty(
          primaryColourProperty,
          previousPrimaryColour
        );
      } else {
        container.style.removeProperty(primaryColourProperty);
      }
      if (previousSecondaryColour) {
        container.style.setProperty(
          secondaryColourProperty,
          previousSecondaryColour
        );
      } else {
        container.style.removeProperty(secondaryColourProperty);
      }
    };
    const view = createRoomVisualizer(row, restore);

    previousNodes.forEach((node) => node.remove());
    container.insertBefore(view, expandButton);
    container.setAttribute('aria-label', `Room ${row.roomCode || ''}`.trim());
    container.dispatchEvent(
      new CustomEvent('oe-panel-request-expand', { bubbles: true })
    );
    view.querySelector('.oe-panel-room-back-button')?.focus();
    return view;
  }

  window.addEventListener('oe-panel-table-row-action', (event) => {
    if (
      event.detail?.action !== 'view-room' ||
      event.detail?.gridId !== 'party-games-grid-1'
    ) {
      return;
    }

    const container = event.target.closest?.(
      '[data-oe-panel-grid="party-games-grid-1"]'
    );
    render(container, event.detail.row);
  });

  window.OE_PANEL_ROOM_VISUALIZER = { render };
})();
