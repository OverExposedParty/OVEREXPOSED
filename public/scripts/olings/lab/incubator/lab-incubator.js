(function () {
  function createOlingLabIncubator(dependencies) {
    let openIncubatorMenu = () => {};
    const core = window.createOlingLabIncubatorCore({
      ...dependencies,
      openIncubatorMenu: (...args) => openIncubatorMenu(...args)
    });
    const info = window.createOlingLabIncubatorInfo({
      ...dependencies,
      ...core
    });
    const incubation = window.createOlingLabIncubatorIncubation({
      ...dependencies,
      ...core
    });
    const influences = window.createOlingLabIncubatorInfluences({
      ...dependencies,
      ...core
    });
    const { startIncubatorCountdown, createTabMenu, openMenu } = dependencies;
    const { createIncubatorInfoStage } = info;
    const {
      createEggTab,
      createIncubateTab,
      createIncubatorFooterActions
    } = incubation;
    const { createItemsTab } = influences;

    openIncubatorMenu = (context) => {
      openMenu(
        `${context.incubator.name || 'Incubator'} Check-In`,
        [
          createTabMenu(
            [
              { label: 'Incubate', content: () => createIncubateTab(context) },
              { label: 'Egg', content: () => createEggTab(context) },
              { label: 'Items', content: () => createItemsTab(context) },
              {
                label: 'Incubator',
                content: () => createIncubatorInfoStage(context)
              }
            ],
            {
              actionContent: (tab) => createIncubatorFooterActions(context, tab)
            }
          )
        ],
        { theme: 'incubation' }
      );
      startIncubatorCountdown(context);
    };

    return {
      getIncubatorContext: core.getIncubatorContext,
      getIncubatorEggSlot: core.getIncubatorEggSlot,
      setPanelInteractivity: core.setPanelInteractivity,
      openStagePanel: core.openStagePanel,
      closeStagePanel: core.closeStagePanel,
      removeEggFromIncubator: core.removeEggFromIncubator,
      hatchEggFromIncubator: core.hatchEggFromIncubator,
      openIncubatorMenu
    };
  }

  window.createOlingLabIncubator = createOlingLabIncubator;
})();
