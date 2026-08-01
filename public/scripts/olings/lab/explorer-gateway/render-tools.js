(function () {
  function createOlingLabExplorerRenderTools(dependencies) {
    const {
      state,
      createDetailRow,
      createImage,
      createInlineAction,
      formatTitle
    } = dependencies;

    function formatTime(ms) {
      const total = Math.max(0, Math.ceil(ms / 1000));
      return `${Math.floor(total / 60)}m ${total % 60}s`;
    }

    function section(...children) {
      const node = document.createElement('section');
      node.className = 'oling-lab-menu-section oling-lab-explorer-panel';
      node.append(...children);
      return [node];
    }

    function details(rows) {
      const node = document.createElement('div');
      node.className = 'oling-lab-detail-list';
      rows.forEach(([a, b]) => node.appendChild(createDetailRow(a, b)));
      return node;
    }

    function createOlingPreview(oling, className) {
      const preview = document.createElement('div');
      preview.className = className;

      state.layers.forEach((layer) => {
        const trait = oling?.traits?.[layer];
        const source =
          trait?.assets?.image ||
          trait?.assets?.icon ||
          trait?.assets?.layer ||
          trait?.metadata?.image;
        if (!source) return;
        const image = createImage(source, trait.name || layer);
        image.className = `oling-lab-oling-layer is-${layer}`;
        preview.appendChild(image);
      });

      return preview;
    }

    function getPersonalityBonus(oling) {
      if (oling.personalityKey === 'adventurous') {
        return '+10% exploration rewards';
      }
      if (oling.personalityKey === 'lucky') {
        return 'Higher rare-find chance';
      }
      if (oling.personalityKey === 'energetic') {
        return 'Shorter adventure times';
      }
      return 'None yet';
    }

    function createSelectionSection(olings, selectedId, onSelect) {
      return section(
        ...olings.map((oling) => {
          const id = oling.id || oling._id;
          const energy = Math.floor(Number(oling.care?.energy ?? 100));
          const maxEnergy = Math.floor(Number(oling.care?.maxEnergy ?? 100));
          const card = details([
            ['Oling', oling.name || 'Oling'],
            ['Energy', `${energy}/${maxEnergy}`],
            [
              'Personality',
              oling.personality?.name || formatTitle(oling.personalityKey)
            ],
            ['Level', String(oling.level || 1)],
            ['Bonus', getPersonalityBonus(oling)]
          ]);

          card.appendChild(
            createInlineAction(
              id === selectedId ? 'Selected' : 'Choose Oling',
              () => onSelect(id)
            )
          );
          return card;
        })
      );
    }

    return {
      createOlingPreview,
      createSelectionSection,
      details,
      formatTime,
      section
    };
  }

  window.createOlingLabExplorerRenderTools =
    createOlingLabExplorerRenderTools;
})();
