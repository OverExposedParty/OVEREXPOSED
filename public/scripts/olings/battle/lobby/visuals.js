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
        const text = String(value || '')
          .replaceAll('-', ' ')
          .replaceAll('_', ' ')
          .trim();
        if (!text) return fallback;
        return text.replace(/\b\w/g, (letter) => letter.toUpperCase());
      }

      function getTraitImage(trait) {
        return (
          trait?.assets?.image ||
          trait?.assets?.icon ||
          trait?.assets?.layer ||
          trait?.metadata?.image ||
          ''
        );
      }

      function getTraitHealth(trait) {
        const health = Number(trait?.body?.health || trait?.metadata?.health);
        return Number.isFinite(health) && health > 0 ? Math.round(health) : 100;
      }

      function normalizePlayerOling(oling) {
        if (!oling) return null;

        const traits = oling.traits || {};
        const body = traits.body || {};
        const eyes = traits.eyes || {};
        const mouth = traits.mouth || {};
        const flight = traits.flight || {};
        const maxEnergy = Math.max(1, Number(oling.care?.maxEnergy) || 100);
        const energy = Math.max(
          0,
          Math.min(maxEnergy, Number(oling.care?.energy ?? maxEnergy))
        );

        return {
          id: String(oling.id || oling._id || ''),
          name: oling.name || 'Oling',
          energy: Math.round((energy / maxEnergy) * 100),
          level: oling.level || 1,
          maxHealth: getTraitHealth(body),
          type: formatKey(oling.eggKey, 'Base'),
          rarity: formatKey(
            oling.matchingSet?.rarity || oling.buildRarities?.body,
            'Base'
          ),
          personality:
            oling.personality?.name || formatKey(oling.personalityKey, 'Ready'),
          matchingSet: oling.matchingSet?.name || '-',
          style: formatKey(oling.battleStats?.style, 'Balanced'),
          trait: formatKey(oling.personality?.key || oling.personalityKey, '-'),
          layers: {
            flight: flight.name || formatKey(oling.build?.flight, '-'),
            body: body.name || formatKey(oling.build?.body, '-'),
            eyes: eyes.name || formatKey(oling.build?.eyes, '-'),
            mouth: mouth.name || formatKey(oling.build?.mouth, '-')
          },
          flightType: flight.flightType || '',
          flightMotion: flight.flightMotion || '',
          flightSpeed: flight.flightSpeed || 1,
          flight: getTraitImage(flight),
          body: getTraitImage(body),
          eyes: getTraitImage(eyes),
          mouth: getTraitImage(mouth),
          source: oling
        };
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
        const image = document.createElement('img');
        image.className = `oling-battle-layer is-${layerName}`;
        image.src =
          src ||
          (layerName === 'flight'
            ? '/images/olings/builds/flight/base/moss-wings.svg'
            : `/images/olings/builds/${layerName}/base/moss-${layerName}.svg`);
        image.alt = '';
        return image;
      }

      function renderOlingArt(container, oling) {
        if (!container || !oling) return;

        container.replaceChildren(
          createOlingLayer(oling.flight, 'flight'),
          createOlingLayer(oling.body, 'body'),
          createOlingLayer(oling.eyes, 'eyes'),
          createOlingLayer(oling.mouth, 'mouth')
        );
        configureBattleOlingFlight(container, oling);
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
        const energy = Math.max(0, Math.min(100, Number(oling?.energy) || 0));
        energyMeter?.setAttribute('aria-valuenow', String(energy));
        if (energyFill) {
          energyFill.style.setProperty(
            '--oling-lobby-energy-level',
            `${energy}%`
          );
        }
        if (energyValue) {
          energyValue.textContent = String(energy);
        }
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
        if (!panel || !oling) return;

        if (!stats) return;

        const detailRows = [
          ['Name', oling.name || 'Oling', 'is-wide is-name'],
          ['Type', oling.type || 'Base', 'is-third'],
          ['Level', oling.level || '-', 'is-third'],
          ['Max Health', oling.maxHealth || '-', 'is-third'],
          ['Rarity', oling.rarity || 'Base', 'is-half'],
          ['Personality', oling.personality || 'Ready', 'is-half'],
          ['Body Layer', oling.layers?.body || '-', 'is-half is-layer'],
          ['Eyes Layer', oling.layers?.eyes || '-', 'is-half is-layer'],
          ['Mouth Layer', oling.layers?.mouth || '-', 'is-half is-layer'],
          ['Flight Layer', oling.layers?.flight || '-', 'is-half is-layer'],
          ['Trait', oling.trait || '-', 'is-half'],
          ['Matching Set', oling.matchingSet || '-', 'is-half'],
          ['Style', oling.style || 'Balanced', 'is-wide']
        ];

        stats.replaceChildren(
          ...detailRows.map(([label, value, extraClass = '']) => {
            const row = document.createElement('div');
            if (extraClass) {
              row.className = extraClass;
            }
            const term = document.createElement('dt');
            term.textContent = label;
            const definition = document.createElement('dd');
            definition.textContent = String(value);
            row.append(term, definition);
            return row;
          })
        );
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
