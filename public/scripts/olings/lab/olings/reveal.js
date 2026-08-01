(function () {
  function createOlingLabRevealTools({ state, helpers, previewTools = {}, buildTools = {} }) {
    const {
      closeMenu,
      closeStagePanel,
      applyRarityTheme,
      createDetailRow,
      createImage,
      createInlineAction,
      createPanelBackButton,
      createStatsToggleButton,
      createTabMenu,
      formatTitle,
      openStagePanel,
      openMenu
    } = helpers;

    const { createPreview } = previewTools;
    const {
      createBuildPresentation,
      createReceiptBuildTab,
      formatReceiptDate,
      formatReceiptChance
    } = buildTools;

    const receiptInfluenceSlots = [
      { key: 'hatch', label: 'Hatch Speed' },
      { key: 'rarity', label: 'Rarity' },
      { key: 'personality', label: 'Personality' },
      { key: 'matching-set', label: 'Matching Set' }
    ];

    function createReceiptRevealTab(oling, receipt) {
      const section = document.createElement('section');
      section.className = 'oling-lab-menu-section oling-lab-hatch-reveal-summary';
      const stage = document.createElement('section');
      stage.className = 'oling-lab-egg-insertion-stage oling-lab-hatch-reveal-stage';

      const hero = document.createElement('div');
      hero.className = 'oling-lab-hatch-reveal-hero';
      let viewingInfo = false;
      const syncInfoButton = () => {
        const label = viewingInfo
          ? 'Close hatch receipt details'
          : 'View hatch receipt details';
        hero.setAttribute('aria-label', label);
        hero.querySelector('.oling-lab-stats-toggle')?.setAttribute('aria-label', label);
      };
      const closeInfo = () => {
        viewingInfo = false;
        syncInfoButton();
        closeStagePanel(stage, panel, 'is-viewing-hatch-receipt-info');
      };
      hero.append(
        createPreview(oling),
        Object.assign(document.createElement('h3'), {
          textContent: oling?.name || 'New Oling'
        })
      );
      hero.appendChild(
        createStatsToggleButton('View hatch receipt details', (event) => {
          event.stopPropagation();
          if (viewingInfo) {
            closeInfo();
            return;
          }
          viewingInfo = true;
          syncInfoButton();
          openStagePanel(stage, panel, 'is-viewing-hatch-receipt-info');
        })
      );

      const panel = document.createElement('aside');
      panel.className = 'oling-lab-side-panel oling-lab-hatch-reveal-panel';
      panel.appendChild(
        createPanelBackButton('Back from hatch receipt details', closeInfo)
      );
      panel.appendChild(
        Object.assign(document.createElement('h3'), {
          textContent: 'Receipt'
        })
      );
      const details = document.createElement('div');
      details.className = 'oling-lab-detail-list';
      details.append(
        createDetailRow('Set', oling?.matchingSet?.name || receipt?.matchingSet || 'Mixed'),
        createDetailRow(
          'Personality',
          oling?.personality?.name ||
            formatTitle(oling?.personalityKey || 'Unknown')
        ),
        createDetailRow(
          'Egg',
          formatTitle(receipt?.eggKey || oling?.eggKey || 'Egg')
        )
      );
      if (receipt?.hatchedAt || receipt?.createdAt) {
        details.appendChild(
          createDetailRow(
            'Hatched',
            formatReceiptDate(receipt.hatchedAt || receipt.createdAt)
          )
        );
      }
      panel.appendChild(details);
      syncInfoButton();
      stage.append(hero, panel);
      section.appendChild(stage);
      return [section];
    }

    function getReceiptInfluence(receipt, slotKey) {
      const recordedInfluences = receipt?.influences || receipt?.influenceSlots || [];
      const influence = Array.isArray(recordedInfluences)
        ? recordedInfluences.find(
            (entry) => (entry?.slotKey || entry?.slot || entry?.key) === slotKey
          )
        : recordedInfluences?.[slotKey];
      if (influence) return influence;
      if (slotKey === 'personality') return receipt?.rolls?.personality?.influence || null;
      return null;
    }

    function formatReceiptInfluenceEffect(slotKey, influence, consumable) {
      if (influence?.effectLabel) return influence.effectLabel;
      const effect = influence?.effect || consumable?.effect || {};
      const amount = Number(effect.amount ?? influence?.amount);
      const chance = Number(influence?.chance);
      const percentage = Number.isFinite(amount)
        ? amount
        : Number.isFinite(chance)
          ? Math.round(chance * 100)
          : null;
      if (percentage === null) return '';
      if (slotKey === 'hatch') return `+${percentage}% speed`;
      if (slotKey === 'rarity') return `+${percentage}% rarity`;
      if (slotKey === 'matching-set') return `+${percentage}% match`;
      const personalityKey =
        influence?.personalityKey || effect.personalityKey || consumable?.metadata?.personalityKey;
      return personalityKey
        ? `+${percentage}% ${formatTitle(personalityKey)}`
        : `+${percentage}% personality`;
    }

    function createReceiptInfluenceCard(slot, receipt) {
      const influence = getReceiptInfluence(receipt, slot.key);
      const itemKey = influence?.itemKey || influence?.consumableKey || '';
      const consumable = itemKey ? state.consumables?.get(itemKey) : null;
      const itemName = influence?.itemName || consumable?.name || formatTitle(itemKey);
      const itemRarity =
        influence?.itemRarity || influence?.rarity || consumable?.metadata?.rarity || '';
      const image =
        influence?.image ||
        influence?.assets?.icon ||
        influence?.assets?.image ||
        consumable?.assets?.icon ||
        consumable?.assets?.image ||
        '';
      const card = document.createElement('article');
      card.className = 'oling-lab-hatch-influence-card';
      card.classList.toggle('is-empty', !influence);
      if (itemRarity) applyRarityTheme(card, itemRarity);
      card.appendChild(
        Object.assign(document.createElement('strong'), {
          className: 'oling-lab-hatch-influence-slot-label',
          textContent: slot.label
        })
      );
      const visual = document.createElement('div');
      visual.className = 'oling-lab-hatch-influence-visual';
      if (image) {
        visual.appendChild(createImage(image, itemName || slot.label));
      } else {
        visual.appendChild(
          Object.assign(document.createElement('span'), {
            className: 'oling-lab-hatch-influence-marker',
            textContent: influence ? String(itemName || '?').charAt(0).toUpperCase() : '-'
          })
        );
      }
      card.appendChild(visual);
      card.appendChild(
        Object.assign(document.createElement('span'), {
          className: 'oling-lab-hatch-influence-item-name',
          textContent: influence ? itemName || 'Item' : 'None'
        })
      );
      const effect = formatReceiptInfluenceEffect(slot.key, influence, consumable);
      card.appendChild(
        Object.assign(document.createElement('span'), {
          className: 'oling-lab-hatch-influence-effect',
          textContent: influence ? effect || 'Applied' : 'No influence'
        })
      );
      card.appendChild(
        Object.assign(document.createElement('span'), {
          className: 'oling-lab-hatch-influence-rarity',
          textContent: influence && itemRarity ? formatTitle(itemRarity) : ''
        })
      );
      return card;
    }

    function createReceiptInfluencesTab(receipt) {
      const section = document.createElement('section');
      section.className = 'oling-lab-menu-section oling-lab-hatch-influences';
      const grid = document.createElement('div');
      grid.className = 'oling-lab-hatch-influence-grid';
      receiptInfluenceSlots.forEach((slot) => {
        grid.appendChild(createReceiptInfluenceCard(slot, receipt));
      });
      section.appendChild(grid);
      return [section];
    }

    function createRevealMenu(oling, receipt, options = {}) {
      const section = document.createElement('section');
      section.className = 'oling-lab-menu-section oling-lab-hatch-reveal';
      if (options.pinned) section.classList.add('is-pinned-preview');

      section.appendChild(
        createTabMenu(
          [
            { label: 'Reveal', content: () => createReceiptRevealTab(oling, receipt) },
            { label: 'Build', content: () => createReceiptBuildTab(oling, receipt) },
            { label: 'Influences', content: () => createReceiptInfluencesTab(receipt) }
          ],
          {
            actionContent: options.pinned || options.hideCloseAction
              ? undefined
              : () => [
                  helpers.createInlineAction('Close', helpers.closeMenu, {
                    className: 'is-hatch-action'
                  })
                ]
          }
        )
      );

      return section;
    }

    return { createRevealMenu };
  }

  window.createOlingLabRevealTools = createOlingLabRevealTools;
})();
