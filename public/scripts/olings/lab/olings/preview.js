(function () {
  function createOlingLabPreviewTools({ state, helpers, previewTools = {}, buildTools = {} }) {
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

    function getOlingId(oling) {
      return String(oling?.id || oling?._id || '');
    }

    function getDisplayedEnergy(value, fallback = 100) {
      const energy = Number(value);
      return Math.floor(Number.isFinite(energy) ? energy : fallback);
    }

    function getTraitImage(trait) {
      if (!trait) return '';
      return (
        trait.assets?.image ||
        trait.assets?.icon ||
        trait.assets?.layer ||
        trait.metadata?.image ||
        ''
      );
    }

    function createPreview(oling) {
      const preview = document.createElement('div');
      preview.className = 'oling-lab-oling-preview';

      state.layers.forEach((layer) => {
        const trait = oling?.traits?.[layer];
        const image = getTraitImage(trait);
        if (!image) return;
        const layerImage = createImage(image, trait.name || layer);
        layerImage.className = `oling-lab-oling-layer is-${layer}`;
        preview.appendChild(layerImage);
      });

      if (!preview.children.length) {
        const placeholder = document.createElement('span');
        placeholder.className = 'oling-lab-menu-placeholder';
        placeholder.textContent = String(oling?.name || 'O')
          .charAt(0)
          .toUpperCase();
        preview.appendChild(placeholder);
      }

      return preview;
    }

    function createEnergyMeter(oling) {
      const maxEnergy = Math.max(1, Number(oling?.care?.maxEnergy) || 100);
      const energy = Math.max(0, Math.min(maxEnergy, Number(oling?.care?.energy ?? maxEnergy)));
      const displayedEnergy = getDisplayedEnergy(energy, maxEnergy);
      const displayedMaxEnergy = getDisplayedEnergy(maxEnergy, 100);
      const percentage = Math.round((energy / maxEnergy) * 100);
      const state = percentage === 0 ? 'empty' : percentage <= 25 ? 'low' : 'ready';
      const meter = document.createElement('div');
      meter.className = `oling-lab-oling-energy is-${state}`;
      meter.setAttribute('role', 'progressbar');
      meter.setAttribute('aria-label', `Energy: ${displayedEnergy} out of ${displayedMaxEnergy}`);
      meter.setAttribute('aria-valuemin', '0');
      meter.setAttribute('aria-valuemax', String(displayedMaxEnergy));
      meter.setAttribute('aria-valuenow', String(displayedEnergy));
      meter.title = `Energy: ${displayedEnergy}/${displayedMaxEnergy}`;

      const icon = createImage('/images/olings/gui/icons/general/energy.svg', 'Energy');
      icon.className = 'oling-lab-oling-energy-icon';
      const track = document.createElement('div');
      track.className = 'oling-lab-oling-energy-track';
      const fill = document.createElement('div');
      fill.className = 'oling-lab-oling-energy-fill';
      fill.style.setProperty('--oling-energy-level', `${percentage}%`);
      track.appendChild(fill);
      const value = Object.assign(document.createElement('strong'), {
        className: 'oling-lab-oling-energy-value',
        textContent: String(displayedEnergy)
      });
      meter.append(icon, track, value);
      return meter;
    }

    return { getOlingId, getDisplayedEnergy, getTraitImage, createPreview, createEnergyMeter };
  }

  window.createOlingLabPreviewTools = createOlingLabPreviewTools;
})();
