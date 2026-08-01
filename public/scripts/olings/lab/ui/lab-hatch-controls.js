(function () {
  function createOlingLabHatchControls(dependencies) {
    const {
      elements,
      getIncubatorContext,
      getIncubatorEggSlot,
      getEgg,
      getHatchProgress,
      formatDuration,
      actions,
      clearHatchTimer,
      state,
      createInlineAction,
      hatchEggFromIncubator,
      removeEggFromIncubator
    } = dependencies;

    function updateIncubatorCountdown(context, root = elements.menuContent) {
      if (!context || !root) return;
      const liveContext =
        getIncubatorContext(context.parentPlacedId) || context;
      const eggSlot = getIncubatorEggSlot(liveContext);
      const egg = eggSlot?.itemKey ? getEgg(eggSlot.itemKey) : null;
      const hatchProgress = getHatchProgress(liveContext, eggSlot, egg);
      const statusText = egg
        ? hatchProgress.isReady
          ? 'Ready'
          : 'Incubating'
        : 'Waiting';
      const timeText = egg
        ? hatchProgress.isReady
          ? 'Ready'
          : formatDuration(hatchProgress.remainingMs)
        : '-';

      root
        .querySelectorAll('[data-oling-hatch-countdown]')
        .forEach((element) => {
          const readyAt = Number(element.dataset.olingHatchReadyAt || 0);
          const remainingMs = readyAt
            ? Math.max(0, readyAt - Date.now())
            : hatchProgress.remainingMs;
          element.textContent =
            remainingMs <= 0 ? 'Ready to hatch' : formatDuration(remainingMs);
        });
      root.querySelectorAll('[data-oling-hatch-status]').forEach((element) => {
        element.textContent = statusText;
      });
      root.querySelectorAll('[data-oling-hatch-time]').forEach((element) => {
        const readyAt = Number(element.dataset.olingHatchReadyAt || 0);
        const remainingMs = readyAt
          ? Math.max(0, readyAt - Date.now())
          : hatchProgress.remainingMs;
        element.textContent =
          egg && remainingMs <= 0
            ? 'Ready'
            : readyAt
              ? formatDuration(remainingMs)
              : timeText;
      });

      root
        .querySelectorAll('.oling-lab-hatch-details-panel')
        .forEach((panel) => {
          panel.classList.toggle(
            'is-ready',
            Boolean(egg && hatchProgress.isReady)
          );
          const note = panel.querySelector('[data-oling-hatch-note]');
          if (note) {
            note.textContent = egg
              ? hatchProgress.isReady
                ? 'This egg is ready to hatch.'
                : 'Hatch unlocks when the timer reaches zero.'
              : 'Choose an egg from your inventory.';
          }

          const actions = panel.querySelector('[data-oling-hatch-actions]');
          syncIncubatorHatchActions(actions, liveContext, egg, hatchProgress, {
            fallback: 'remove'
          });
        });

      elements.menuFooter
        ?.querySelectorAll(
          '.oling-lab-container-action-area[data-oling-active-tab="Incubate"]'
        )
        .forEach((actions) => {
          syncIncubatorHatchActions(actions, liveContext, egg, hatchProgress);
        });

      if (!egg) clearHatchTimer();
    }

    function startIncubatorCountdown(context) {
      clearHatchTimer();
      const eggSlot = getIncubatorEggSlot(context);
      if (!eggSlot?.itemKey) return;

      updateIncubatorCountdown(context);
      state.hatchTimerInterval = window.setInterval(() => {
        const nextContext = getIncubatorContext(context.parentPlacedId);
        const liveContext = nextContext || context;
        const liveEggSlot = getIncubatorEggSlot(liveContext);
        if (!liveEggSlot?.itemKey) {
          clearHatchTimer();
          return;
        }
        updateIncubatorCountdown(liveContext);
      }, 1000);
    }

    function createHatchEggAction(context) {
      return createInlineAction(
        'Hatch Egg',
        () => hatchEggFromIncubator(context),
        {
          className: 'is-hatch-action',
          disabled: state.hatching
        }
      );
    }

    function syncIncubatorHatchActions(
      actions,
      context,
      egg,
      hatchProgress,
      options = {}
    ) {
      if (!actions) return;
      const isReady = Boolean(egg && hatchProgress.isReady);
      const signature = [
        isReady ? 'ready' : 'waiting',
        options.fallback || 'none',
        egg?.key || '',
        state.hatching ? 'hatching' : ''
      ].join(':');
      if (actions.dataset.ready === signature) return;
      actions.dataset.ready = signature;
      actions.replaceChildren();

      if (isReady) {
        actions.appendChild(createHatchEggAction(context));
      } else if (options.fallback === 'remove') {
        actions.appendChild(
          createInlineAction(
            'Remove Egg',
            () => removeEggFromIncubator(context),
            {
              className: 'is-remove-action',
              disabled: !egg
            }
          )
        );
      }
    }

    function getSampleHatchReceiptPreview() {
      const hatchedAt = new Date().toISOString();
      const oling = {
        id: 'preview-hatch-receipt-oling',
        name: 'Receipt Preview',
        eggKey: 'base',
        rarity: 'rare',
        collection: 'base',
        personalityKey: 'curious',
        personality: {
          key: 'curious',
          name: 'Curious'
        },
        matchingSet: {
          key: 'moss',
          name: 'Moss Set'
        },
        build: {
          flight: 'moss-wings',
          body: 'moss-body',
          eyes: 'moss-eyes',
          mouth: 'moss-mouth'
        },
        buildRarities: {
          flight: 'rare',
          body: 'uncommon',
          eyes: 'rare',
          mouth: 'common'
        },
        traits: {
          flight: {
            key: 'moss-wings',
            name: 'Moss Wings',
            rarity: 'rare',
            flightType: 'wings',
            flightMotion: 'flutter',
            flightSpeed: 1,
            assets: {
              image: '/images/olings/builds/flight/base/moss-wings.svg'
            }
          },
          body: {
            key: 'moss-body',
            name: 'Moss Body',
            rarity: 'uncommon',
            assets: {
              image: '/images/olings/builds/body/base/moss-body.svg'
            }
          },
          eyes: {
            key: 'moss-eyes',
            name: 'Moss Eyes',
            rarity: 'rare',
            assets: {
              image: '/images/olings/builds/eyes/base/moss-eyes.svg'
            }
          },
          mouth: {
            key: 'moss-mouth',
            name: 'Moss Mouth',
            rarity: 'common',
            assets: {
              image: '/images/olings/builds/mouth/base/moss-mouth.svg'
            }
          }
        }
      };
      const receipt = {
        id: 'preview-hatch-receipt',
        eggKey: 'base',
        hatchedAt,
        createdAt: hatchedAt,
        source: 'Incubeta',
        matchingSet: 'Moss Set',
        rarity: 'Rare',
        influences: [
          {
            slotKey: 'hatch',
            itemKey: 'oling-blanket',
            itemName: 'Oling Blanket',
            itemRarity: 'uncommon',
            effect: { type: 'hatch_speed', amount: 25 },
            image: '/images/olings/consumables/hatching/speed/oling-blanket.svg'
          },
          {
            slotKey: 'rarity',
            itemKey: 'lucky-clover',
            itemName: 'Lucky Clover',
            itemRarity: 'epic',
            effect: { type: 'rarity_chance', amount: 20 },
            image: '/images/olings/consumables/hatching/rarity/lucky-clover.svg'
          },
          {
            slotKey: 'personality',
            itemKey: 'magnifying-glass',
            itemName: 'Magnifying Glass',
            itemRarity: 'common',
            personalityKey: 'curious',
            chance: 0.35,
            image:
              '/images/olings/consumables/hatching/personality/curious/magnifying-glass/magnifying-glass.svg'
          }
        ],
        rolls: {
          flight: {
            rarityRolled: 'rare',
            traitKey: 'moss-wings'
          },
          body: {
            rarityRolled: 'uncommon',
            traitKey: 'moss-body'
          },
          eyes: {
            rarityRolled: 'rare',
            traitKey: 'moss-eyes'
          },
          mouth: {
            rarityRolled: 'common',
            traitKey: 'moss-mouth'
          },
          personality: {
            personalityKey: 'curious',
            influence: {
              itemKey: 'magnifying-glass',
              personalityKey: 'curious',
              chance: 0.35
            }
          }
        },
        eggOddsSnapshot: {
          common: 0.56,
          uncommon: 0.28,
          rare: 0.13,
          legendary: 0.03
        },
        inventoryChange: {
          eggKey: 'base',
          quantityBefore: 4,
          quantityAfter: 3
        }
      };
      return { oling, receipt };
    }

    return {
      updateIncubatorCountdown,
      startIncubatorCountdown,
      createHatchEggAction,
      syncIncubatorHatchActions,
      getSampleHatchReceiptPreview
    };
  }

  window.createOlingLabHatchControls = createOlingLabHatchControls;
})();
