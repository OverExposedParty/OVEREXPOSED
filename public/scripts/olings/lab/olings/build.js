(function () {
  function createOlingLabBuildTools({ state, helpers, previewTools = {}, buildTools = {} }) {
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

    const getTraitImage =
      typeof previewTools.getTraitImage === 'function'
        ? previewTools.getTraitImage
        : (trait) =>
            trait?.assets?.image ||
            trait?.assets?.icon ||
            trait?.assets?.layer ||
            trait?.metadata?.image ||
            '';

    function createTraitGrid(oling) {
      const traits = document.createElement('div');
      traits.className = 'oling-lab-set-preview-grid';
      state.layers.forEach((layer) => {
        const trait = oling?.traits?.[layer];
        if (!trait) return;
        const rarity = trait.rarity || oling?.buildRarities?.[layer] || layer;
        const card = document.createElement('article');
        card.className = 'oling-lab-set-preview';
        card.dataset.olingBuildLayer = layer;
        applyRarityTheme(card, rarity);
        const image = getTraitImage(trait);
        if (image) card.appendChild(createImage(image, trait.name || layer));
        const meta = document.createElement('div');
        meta.className = 'oling-lab-set-preview-meta';
        meta.append(
          Object.assign(document.createElement('strong'), {
            textContent: trait.name || formatTitle(oling?.build?.[layer] || layer)
          }),
          Object.assign(document.createElement('span'), {
            textContent: formatTitle(rarity)
          })
        );
        card.appendChild(meta);
        traits.appendChild(card);
      });
      return traits;
    }

    function createEmptyReceiptMessage(message) {
      return Object.assign(document.createElement('p'), {
        className: 'oling-lab-menu-empty',
        textContent: message
      });
    }

    function formatReceiptDate(value) {
      const date = value ? new Date(value) : null;
      if (!date || Number.isNaN(date.getTime())) return 'Unknown';
      return date.toLocaleString([], {
        dateStyle: 'medium',
        timeStyle: 'short'
      });
    }

    function formatReceiptChance(value) {
      const number = Number(value);
      if (!Number.isFinite(number)) return String(value || '0%');
      if (number <= 1) return `${Math.round(number * 100)}%`;
      return `${Math.round(number)}%`;
    }

    function createBuildPresentation(oling, options = {}) {
      const receipt = options.receipt || null;
      const section = document.createElement('section');
      section.className = 'oling-lab-menu-section oling-lab-hatch-build';
      const stage = document.createElement('section');
      stage.className = 'oling-lab-egg-insertion-stage oling-lab-hatch-build-stage';
      let viewingInfo = false;
      const syncInfoButton = () => {
        const label = viewingInfo ? 'Close build details' : 'View build details';
        stage.querySelector('.oling-lab-stats-toggle')?.setAttribute('aria-label', label);
      };
      const closeInfo = () => {
        viewingInfo = false;
        syncInfoButton();
        closeStagePanel(stage, panel, 'is-viewing-hatch-build-info');
      };

      const traits = createTraitGrid(oling);
      traits.classList.add('oling-lab-hatch-build-grid');
      Array.from(traits.children).forEach((traitCard) => {
        const cell = document.createElement('div');
        cell.className = 'oling-lab-hatch-build-cell';
        traitCard.prepend(
          Object.assign(document.createElement('strong'), {
            className: 'oling-lab-hatch-build-part-label',
            textContent: formatTitle(traitCard.dataset.olingBuildLayer || 'Part')
          })
        );
        cell.appendChild(traitCard);
        traits.appendChild(cell);
      });
      if (traits.children.length) stage.appendChild(traits);
      stage.appendChild(
        createStatsToggleButton('View build details', (event) => {
          event.stopPropagation();
          if (viewingInfo) {
            closeInfo();
            return;
          }
          viewingInfo = true;
          syncInfoButton();
          openStagePanel(stage, panel, 'is-viewing-hatch-build-info');
        })
      );

      const panel = document.createElement('aside');
      panel.className = 'oling-lab-side-panel oling-lab-hatch-build-panel';
      panel.appendChild(createPanelBackButton('Back from build details', closeInfo));
      panel.appendChild(
        Object.assign(document.createElement('h3'), {
          textContent: 'Build'
        })
      );
      const details = document.createElement('div');
      details.className = 'oling-lab-detail-list';
      details.append(
        createDetailRow('Set', oling?.matchingSet?.name || 'Mixed'),
        createDetailRow('Egg', formatTitle(receipt?.eggKey || oling?.eggKey || 'Egg')),
        createDetailRow('Rarity', formatTitle(oling?.rarity || receipt?.rarity || 'Mixed'), {
          rarity: oling?.rarity || receipt?.rarity || 'mixed'
        }),
        createDetailRow('Collection', formatTitle(oling?.collection || 'Base'))
      );
      if (options.showEggOdds) {
        Object.entries(receipt?.eggOddsSnapshot || {})
          .filter(([, value]) => value !== undefined)
          .forEach(([rarity, chance]) => {
            details.appendChild(
              createDetailRow(`${formatTitle(rarity)} Odds`, formatReceiptChance(chance), {
                rarity
              })
            );
          });
      }
      panel.appendChild(details);
      syncInfoButton();
      stage.appendChild(panel);
      section.appendChild(stage);
      return [section];
    }

    function createReceiptBuildTab(oling, receipt) {
      return createBuildPresentation(oling, {
        receipt,
        showEggOdds: true
      });
    }

    return { createBuildPresentation, createReceiptBuildTab, formatReceiptDate, formatReceiptChance };
  }

  window.createOlingLabBuildTools = createOlingLabBuildTools;
})();
