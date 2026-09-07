(function () {
  const BUILD_PART_DESCRIPTIONS = Object.freeze({
    flight: 'Flight parts define how an Oling moves through the air.',
    body: 'Body parts define an Oling’s central shape and structure.',
    eyes: 'Eye parts define how an Oling sees and expresses itself.',
    mouth: 'Mouth parts define an Oling’s smile and expressions.'
  });

  function createOlingLabBuildTools({ state, helpers, previewTools = {} }) {
    const { applyRarityTheme, createImage, formatTitle } = helpers;
    const { createPreview } = previewTools;

    const getTraitImage =
      typeof previewTools.getTraitImage === 'function'
        ? previewTools.getTraitImage
        : (trait) =>
            trait?.assets?.image ||
            trait?.assets?.icon ||
            trait?.assets?.layer ||
            trait?.metadata?.image ||
            '';

    function getTraitSetName(trait) {
      return formatTitle(
        trait?.set?.name ||
          trait?.setKey ||
          trait?.theme ||
          trait?.collection ||
          'Unknown'
      );
    }

    function describeTrait(layer, trait) {
      const typeDescription =
        BUILD_PART_DESCRIPTIONS[layer] ||
        `${formatTitle(layer)} is one of this Oling’s build parts.`;
      const setDescription = `This part comes from the ${getTraitSetName(trait)} set.`;
      return [typeDescription, setDescription, trait?.flavor]
        .filter(Boolean)
        .join(' ');
    }

    function createPartButton(layer, trait) {
      const rarity = trait?.rarity || layer;
      const button = document.createElement('button');
      button.className =
        'oling-lab-set-preview oling-lab-hatch-build-part-button';
      button.dataset.olingBuildLayer = layer;
      button.dataset.soundIntent = 'select';
      button.type = 'button';
      button.setAttribute('aria-pressed', 'false');
      applyRarityTheme(button, rarity);

      button.appendChild(
        Object.assign(document.createElement('strong'), {
          className: 'oling-lab-hatch-build-part-label',
          textContent: formatTitle(layer)
        })
      );

      const image = getTraitImage(trait);
      if (image) button.appendChild(createImage(image, trait?.name || layer));

      const meta = document.createElement('div');
      meta.className = 'oling-lab-set-preview-meta';
      meta.appendChild(
        Object.assign(document.createElement('strong'), {
          textContent: trait?.name || formatTitle(layer)
        })
      );
      button.appendChild(meta);
      return button;
    }

    function createBuildPreview(oling) {
      const preview = document.createElement('div');
      preview.className =
        'oling-lab-hatch-build-preview oling-lab-egg-insertion-stage oling-lab-oling-info-stage';
      const hero = document.createElement('div');
      hero.className = 'oling-lab-oling-hero';
      if (typeof createPreview === 'function') {
        hero.appendChild(createPreview(oling));
      }
      preview.appendChild(hero);
      return preview;
    }

    function createBuildPresentation(oling, options = {}) {
      const section = document.createElement('section');
      section.className = 'oling-lab-menu-section oling-lab-hatch-build';
      const stage = document.createElement('section');
      stage.className = 'oling-lab-hatch-build-stage';
      const buttons = document.createElement('div');
      buttons.className =
        'oling-lab-set-preview-grid oling-lab-hatch-build-grid';
      buttons.setAttribute('role', 'group');
      buttons.setAttribute('aria-label', 'Oling build parts');
      const details = document.createElement('section');
      details.className = 'oling-lab-hatch-build-part-details';
      details.setAttribute('aria-live', 'polite');

      const parts = state.layers
        .map((layer) => ({ layer, trait: oling?.traits?.[layer] }))
        .filter(({ trait }) => Boolean(trait));

      const selectPart = (selectedLayer) => {
        [...buttons.children].forEach((button) => {
          button.setAttribute(
            'aria-pressed',
            String(button.dataset.olingBuildLayer === selectedLayer)
          );
        });
        const selected = parts.find(({ layer }) => layer === selectedLayer);
        if (!selected) return;
        options.onSelectPart?.(selectedLayer);
        details.replaceChildren(
          Object.assign(document.createElement('h3'), {
            textContent: selected.trait.name || formatTitle(selected.layer)
          }),
          Object.assign(document.createElement('p'), {
            textContent: describeTrait(selected.layer, selected.trait)
          })
        );
      };

      parts.forEach(({ layer, trait }) => {
        const button = createPartButton(layer, trait);
        button.addEventListener('click', () => selectPart(layer));
        buttons.appendChild(button);
      });

      stage.append(createBuildPreview(oling), buttons, details);
      section.appendChild(stage);
      const initialPart =
        parts.find(({ layer }) => layer === options.selectedLayer) || parts[0];
      if (initialPart) selectPart(initialPart.layer);
      return [section];
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

    function createReceiptBuildTab(oling) {
      return createBuildPresentation(oling);
    }

    return {
      createBuildPresentation,
      createReceiptBuildTab,
      formatReceiptDate,
      formatReceiptChance
    };
  }

  window.createOlingLabBuildTools = createOlingLabBuildTools;
})();
