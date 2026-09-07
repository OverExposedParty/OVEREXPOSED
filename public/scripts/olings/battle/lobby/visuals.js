(function () {
  function createOlingBattleLobbyVisuals(context) {
    with (context) {
      function getSelectedOling() {
        return playerOlings[selectedOlingIndex] || playerOlings[0];
      }

      function showNoOlingState() {
        battleShell.hidden = true;
        noOlingState?.removeAttribute('hidden');
        noOlingState?.focus();
      }

      function showBattleState() {
        noOlingState?.setAttribute('hidden', '');
        battleShell.hidden = false;
      }

      function showKickedFromBattleState() {
        battleSocket?.emit?.('oling-battle:leave-room', battleMatch?.matchCode);
        battleSocket?.disconnect?.();
        battleSocket = null;

        if (window.OESessionStatusPrompts?.showKicked) {
          window.OESessionStatusPrompts.showKicked({
            title: "You've been kicked",
            description: 'The host removed you from this Oling battle.'
          });
          return;
        }

        battleShell.hidden = true;
        noOlingState?.setAttribute('hidden', '');
      }

      function formatKey(value, fallback = '-') {
        return window.OlingSelector.formatKey(value, fallback);
      }

      function getTraitImage(trait) {
        return window.OlingSelector.getTraitImage(trait);
      }

      function getTraitHealth(trait) {
        return window.OlingSelector.getTraitHealth(trait);
      }

      function normalizePlayerOling(oling) {
        return window.OlingSelector.normalizeOling(oling);
      }

      function parseOeIcon(oeIcon) {
        const [colour, headSlot, eyesSlot, mouthSlot] = String(
          oeIcon || ''
        ).split(':');
        if (!colour || !headSlot || !eyesSlot || !mouthSlot) return null;
        return { colour, headSlot, eyesSlot, mouthSlot };
      }

      async function getOeLibraryLookup() {
        if (!oeLibraryLookupPromise) {
          oeLibraryLookupPromise = fetch('/api/oe-library', {
            headers: { Accept: 'application/json' }
          })
            .then(readJsonResponse)
            .then((payload) => {
              const library = payload.data || payload;
              const lookup = new Map();
              (library.packs || []).forEach((pack) => {
                (pack.items || []).forEach((item) => {
                  const id = item.id ?? item.oeId;
                  const filePath = item.filePath ?? item['file-path'];
                  if (id != null && filePath) lookup.set(String(id), filePath);
                });
              });
              return lookup;
            });
        }
        return oeLibraryLookupPromise;
      }

      async function renderAccountOe(container, oeIcon) {
        const selectedIds = parseOeIcon(oeIcon);
        if (!container || !selectedIds) return;
        const lookup = await getOeLibraryLookup();

        const layers = [
          ['colour', selectedIds.colour],
          ['head-slot', selectedIds.headSlot],
          ['eyes-slot', selectedIds.eyesSlot],
          ['mouth-slot', selectedIds.mouthSlot]
        ];
        const images = layers
          .map(([slot, id]) => {
            const src = lookup.get(String(id));
            if (!src) return null;
            const image = document.createElement('img');
            image.className = 'oling-battle-lobby-oe-layer';
            image.dataset.slot = slot;
            image.src = src;
            image.alt = '';
            return image;
          })
          .filter(Boolean);

        if (images.length) container.replaceChildren(...images);
      }

      function createOlingLayer(src, layerName) {
        return window.OlingSelector.createLayer(
          src,
          layerName,
          'oling-battle-layer'
        );
      }

      function renderOlingArt(container, oling) {
        window.OlingSelector.renderArt(container, oling, {
          layerClass: 'oling-battle-layer',
          configureFlight: configureBattleOlingFlight
        });
      }

      function getOlingMarkerColour(oling) {
        const text = [
          oling?.type,
          oling?.matchingSet,
          oling?.layers?.flight,
          oling?.layers?.body,
          oling?.body
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        if (text.includes('moss')) return '#5f9f4c';
        if (text.includes('stone')) return '#747474';
        if (text.includes('magma')) return '#ff6a3d';
        if (text.includes('trash')) return '#2f3740';
        if (text.includes('vampire')) return '#303041';
        return '#3d4248';
      }

      function renderOlingMarkerArt(oling) {
        if (!playerMarkerArt || !oling) return;

        playerMarkerArt.replaceChildren(
          createOlingLayer(oling.flight, 'flight'),
          createOlingLayer(oling.body, 'body'),
          createOlingLayer(oling.eyes, 'eyes'),
          createOlingLayer(oling.mouth, 'mouth')
        );
        configureBattleOlingFlight(playerMarkerArt, oling);
        if (playerMarkerStem) {
          playerMarkerStem.style.setProperty(
            '--oling-battle-marker-colour',
            getOlingMarkerColour(oling)
          );
        }
      }

      function updateBattleHealth(container, oling) {
        if (!container || !oling) return;

        const maxHealth = Math.max(1, Number(oling.maxHealth) || 100);
        container.dataset.currentHealth = String(maxHealth);
        container.dataset.maxHealth = String(maxHealth);
        container.setAttribute('aria-valuemax', String(maxHealth));
        container.setAttribute('aria-valuenow', String(maxHealth));
        container
          .querySelector('span')
          ?.style.setProperty('--health-level', '100%');
        const value = container.querySelector('strong');
        if (value) value.textContent = `${maxHealth}/${maxHealth}`;
      }

      function renderBattleSetup() {
        const selectedOling = getSelectedOling();
        renderOlingArt(playerBattleOling, selectedOling);
        renderOlingMarkerArt(selectedOling);
        updateBattleHealth(playerBattleHealth, selectedOling);
        if (playerBattleTitle) {
          playerBattleTitle.textContent = selectedOling?.name || 'OLING';
        }
        if (opponentOling) {
          renderOlingArt(enemyBattleOling, opponentOling);
          updateBattleHealth(enemyBattleHealth, opponentOling);
          if (enemyBattleTitle)
            enemyBattleTitle.textContent = opponentOling.name || 'OLING';
        }
        initializeFlightMotion();
      }

      function updateEnergyMeter(oling) {
        window.OlingSelector.updateEnergy(energyMeter, oling);
      }

      function renderOlingPicker() {
        const selectedOling = getSelectedOling();
        renderOlingArt(pickerPreview, selectedOling);
        renderOlingDescription(selectedOling, {
          panel: playerDescriptionPanel,
          stats: playerDescriptionStats,
          mode: 'player'
        });
        updateEnergyMeter(selectedOling);
      }

      function renderOlingDescription(
        oling,
        {
          panel = descriptionPanel,
          stats = descriptionStats,
          mode = lobbyDetailMode
        } = {}
      ) {
        if (!panel || !oling || !stats) return;
        window.OlingSelector.renderStats(stats, oling);
      }

      return {
        getSelectedOling,
        showNoOlingState,
        showBattleState,
        showKickedFromBattleState,
        formatKey,
        getTraitImage,
        getTraitHealth,
        normalizePlayerOling,
        parseOeIcon,
        getOeLibraryLookup,
        renderAccountOe,
        createOlingLayer,
        renderOlingArt,
        getOlingMarkerColour,
        renderOlingMarkerArt,
        updateBattleHealth,
        renderBattleSetup,
        updateEnergyMeter,
        renderOlingPicker,
        renderOlingDescription
      };
    }
  }

  window.createOlingBattleLobbyVisuals = createOlingBattleLobbyVisuals;
})();
