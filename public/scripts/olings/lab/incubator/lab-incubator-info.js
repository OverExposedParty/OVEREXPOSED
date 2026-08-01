(function () {
  function createOlingLabIncubatorInfo(dependencies) {
    const {
      state,
      elements,
      itemInfluenceSlots,
      labEndpoint,
      setStatus,
      startIncubatorCountdown,
      parsePayload,
      getItem,
      getEgg,
      getConsumable,
      applyRarityTheme,
      getAvailableEggQuantity,
      createImage,
      getEggImage,
      createItemButton,
      createInlineAction,
      createHatchEggAction,
      syncIncubatorHatchActions,
      createStatsToggleButton,
      createPanelBackButton,
      createSquareMarker,
      createEmptyMessage,
      createConstrainedEmptyTab,
      createDetailRow,
      createCompactDetailPair,
      formatTitle,
      formatOdds,
      formatInfluenceEffect,
      formatDuration,
      getHatchProgress,
      createTabMenu,
      openMenu,
      closeMenu,
      closeSelectedTarget,
      renderLab,
      saveLab
    } = dependencies;
    const {
      applyInitialStagePanel,
      closeStagePanel,
      getIncubatorEggSlot,
      getIncubatorSelectionKey,
      isViewingIncubatorEggInfo,
      isViewingIncubatorInfo,
      openStagePanel,
      setIncubatorEggInfo,
      setIncubatorInfo
    } = dependencies;

    function createIncubatorHero(context) {
      const eggSlot = getIncubatorEggSlot(context);
      const egg = eggSlot?.itemKey ? getEgg(eggSlot.itemKey) : null;
      const hero = document.createElement('section');
      hero.className = 'oling-lab-incubator-hero';

      const incubatorCard = document.createElement('div');
      incubatorCard.className = 'oling-lab-incubator-card';
      incubatorCard.append(
        createImage(context.incubator.image, context.incubator.name),
        Object.assign(document.createElement('strong'), {
          textContent: context.incubator.name
        })
      );

      const eggCard = document.createElement('div');
      eggCard.className = 'oling-lab-incubator-card is-egg';
      const eggImage = getEggImage(egg);
      if (eggImage) {
        eggCard.appendChild(createImage(eggImage, egg.name));
      } else {
        const placeholder = document.createElement('span');
        placeholder.className = 'oling-lab-menu-placeholder';
        placeholder.textContent = egg ? String(egg.name).charAt(0) : '?';
        eggCard.appendChild(placeholder);
      }
      eggCard.appendChild(
        Object.assign(document.createElement('strong'), {
          textContent: egg?.name || 'No Egg Inserted'
        })
      );

      hero.append(incubatorCard, eggCard);
      return hero;
    }

    function createIncubatorOnlyHero(context, isViewingInfo, onToggleInfo) {
      const hero = document.createElement('div');
      hero.className = 'oling-lab-incubator-used';
      hero.setAttribute(
        'aria-label',
        isViewingInfo ? 'Close incubator details' : 'View incubator details'
      );
      hero.append(
        createImage(context.incubator.image, context.incubator.name),
        Object.assign(document.createElement('strong'), {
          textContent: context.incubator.name || 'Incubator'
        })
      );
      hero.appendChild(
        createStatsToggleButton(
          isViewingInfo ? 'Close incubator details' : 'View incubator details',
          onToggleInfo
        )
      );
      return hero;
    }

    function createIncubatorInfoStage(context) {
      const selectionKey = getIncubatorSelectionKey(context);
      const isViewingInfo = isViewingIncubatorInfo(context);
      const shouldAnimatePanel =
        state.animatingIncubatorPanelTarget === selectionKey;
      if (shouldAnimatePanel) state.animatingIncubatorPanelTarget = null;
      const stage = document.createElement('section');
      stage.className =
        'oling-lab-egg-insertion-stage oling-lab-incubator-info-stage';
      let viewingInfo = isViewingInfo;

      const panel = document.createElement('aside');
      panel.className = 'oling-lab-side-panel oling-lab-incubator-info-panel';
      let incubatorHero = null;
      const syncHeroLabel = () => {
        if (!incubatorHero) return;
        const label = viewingInfo
          ? 'Close incubator details'
          : 'View incubator details';
        incubatorHero.setAttribute('aria-label', label);
        incubatorHero
          .querySelector('.oling-lab-stats-toggle')
          ?.setAttribute('aria-label', label);
      };
      const closeInfo = () => {
        viewingInfo = false;
        syncHeroLabel();
        closeStagePanel(stage, panel, 'is-viewing-incubator-info', () =>
          setIncubatorInfo(context, false)
        );
      };
      incubatorHero = createIncubatorOnlyHero(context, viewingInfo, () => {
        if (viewingInfo) {
          closeInfo();
          return;
        }
        viewingInfo = true;
        syncHeroLabel();
        setIncubatorInfo(context, true);
        openStagePanel(stage, panel, 'is-viewing-incubator-info');
      });
      stage.appendChild(incubatorHero);
      panel.appendChild(
        createPanelBackButton('Back from incubator details', closeInfo)
      );
      panel.appendChild(
        Object.assign(document.createElement('h3'), {
          textContent: 'Incubator'
        })
      );
      panel.appendChild(
        Object.assign(document.createElement('p'), {
          className: 'oling-lab-incubator-copy',
          textContent:
            context.incubator.description || 'A worn but reliable incubator.'
        })
      );

      const details = document.createElement('div');
      details.className = 'oling-lab-detail-list';
      details.append(
        createDetailRow(
          'Rarity',
          formatTitle(context.incubator.rarity || 'basic'),
          {
            rarity: context.incubator.rarity || 'basic'
          }
        ),
        createDetailRow(
          'Hatch Speed',
          context.incubator.hatchSpeed || 'Normal'
        ),
        createDetailRow(
          'Special Effect',
          context.incubator.specialEffect || 'None'
        ),
        createDetailRow(
          'Passive Bonuses',
          context.incubator.passiveBonus || 'None'
        )
      );
      panel.appendChild(details);
      stage.appendChild(panel);
      applyInitialStagePanel(
        stage,
        panel,
        'is-viewing-incubator-info',
        isViewingInfo,
        shouldAnimatePanel
      );
      return stage;
    }

    function createEggOnlyHero(egg, isViewingInfo, onToggleInfo) {
      const eggCard = document.createElement('div');
      eggCard.className = 'oling-lab-egg-used';
      eggCard.setAttribute(
        'aria-label',
        isViewingInfo ? 'Close egg details' : 'View egg details'
      );
      const eggImage = getEggImage(egg);
      if (eggImage) {
        eggCard.appendChild(createImage(eggImage, egg.name));
      } else {
        const placeholder = document.createElement('span');
        placeholder.className = 'oling-lab-menu-placeholder';
        placeholder.textContent = egg ? String(egg.name).charAt(0) : '?';
        eggCard.appendChild(placeholder);
      }
      eggCard.appendChild(
        Object.assign(document.createElement('strong'), {
          textContent: egg?.name || 'No Egg Inserted'
        })
      );
      eggCard.appendChild(
        createStatsToggleButton(
          isViewingInfo ? 'Close egg details' : 'View egg details',
          onToggleInfo
        )
      );

      return eggCard;
    }

    function createEggInfoPanel(egg, onClose) {
      const panel = document.createElement('aside');
      panel.className = 'oling-lab-side-panel oling-lab-egg-info-panel';
      if (typeof onClose === 'function') {
        panel.appendChild(
          createPanelBackButton('Back from egg details', onClose)
        );
      }
      panel.appendChild(
        Object.assign(document.createElement('h3'), {
          textContent: 'Egg'
        })
      );
      panel.appendChild(
        Object.assign(document.createElement('p'), {
          className: 'oling-lab-incubator-copy',
          textContent:
            egg.description ||
            `A ${formatTitle(egg.collection || 'base')} egg with a few possible Olings waiting inside.`
        })
      );

      const sets = document.createElement('div');
      sets.className = 'oling-lab-set-preview-grid';
      (egg.sets || []).forEach((set) => {
        const card = document.createElement('article');
        card.className = 'oling-lab-set-preview';
        applyRarityTheme(card, set.rarity);
        const image =
          set.metadata?.layers?.body ||
          Object.values(set.metadata?.layers || {})[0];
        if (image) card.appendChild(createImage(image, set.name));
        const meta = document.createElement('div');
        meta.className = 'oling-lab-set-preview-meta';
        meta.append(
          Object.assign(document.createElement('strong'), {
            textContent: set.name || formatTitle(set.key)
          }),
          Object.assign(document.createElement('span'), {
            textContent: formatTitle(set.rarity)
          })
        );
        card.appendChild(meta);
        sets.appendChild(card);
      });
      panel.appendChild(
        sets.children.length
          ? sets
          : createEmptyMessage('No Oling previews yet.')
      );

      const odds = document.createElement('div');
      odds.className = 'oling-lab-detail-list';
      Object.entries(egg.rarityOdds || {}).forEach(([rarity, chance]) => {
        odds.appendChild(
          createDetailRow(formatTitle(rarity), formatOdds(chance), { rarity })
        );
      });
      panel.appendChild(
        odds.children.length
          ? odds
          : createEmptyMessage('No hatch odds available.')
      );
      return panel;
    }

    function createEggInfoStage(context, egg) {
      const selectionKey = getIncubatorSelectionKey(context);
      const isViewingInfo = isViewingIncubatorEggInfo(context);
      const shouldAnimatePanel =
        state.animatingIncubatorPanelTarget === selectionKey;
      if (shouldAnimatePanel) state.animatingIncubatorPanelTarget = null;
      const stage = document.createElement('section');
      stage.className =
        'oling-lab-egg-insertion-stage oling-lab-egg-info-stage';
      let viewingInfo = isViewingInfo;

      let panel = null;
      let eggHero = null;
      const syncHeroLabel = () => {
        if (!eggHero) return;
        const label = viewingInfo ? 'Close egg details' : 'View egg details';
        eggHero.setAttribute('aria-label', label);
        eggHero
          .querySelector('.oling-lab-stats-toggle')
          ?.setAttribute('aria-label', label);
      };
      const closeInfo = () => {
        viewingInfo = false;
        syncHeroLabel();
        closeStagePanel(stage, panel, 'is-viewing-egg-info', () =>
          setIncubatorEggInfo(context, false)
        );
      };

      panel = createEggInfoPanel(egg, closeInfo);
      eggHero = createEggOnlyHero(egg, viewingInfo, () => {
        if (viewingInfo) {
          closeInfo();
          return;
        }
        viewingInfo = true;
        syncHeroLabel();
        setIncubatorEggInfo(context, true);
        openStagePanel(stage, panel, 'is-viewing-egg-info');
      });
      stage.append(eggHero, panel);
      applyInitialStagePanel(
        stage,
        panel,
        'is-viewing-egg-info',
        isViewingInfo,
        shouldAnimatePanel
      );
      return stage;
    }


    return {
      createEggInfoStage,
      createIncubatorInfoStage
    };
  }

  window.createOlingLabIncubatorInfo = createOlingLabIncubatorInfo;
})();
