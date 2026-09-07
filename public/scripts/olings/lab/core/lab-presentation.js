(function () {
  function createOlingLabPresentation({ state, constants }) {
    const interactionModes = constants.LAB_INTERACTION_MODES || {};
    const contexts = constants.OLING_VISIBILITY_CONTEXTS || {};

    function getMode() {
      return state.editMode && state.customiseCategory
        ? state.customiseCategory
        : 'default';
    }

    function canUseLabInteraction(interaction) {
      if (state.visitorMode) return interaction === 'camera';
      const mode =
        interactionModes[getMode()] || interactionModes.default || {};
      return mode[interaction] !== false;
    }

    function setOlingsHidden(context, hidden = true) {
      if (!context) return;
      if (!(state.hiddenOlingContexts instanceof Set)) {
        state.hiddenOlingContexts = new Set();
      }
      if (hidden) state.hiddenOlingContexts.add(context);
      else state.hiddenOlingContexts.delete(context);
    }

    function shouldRenderOlings() {
      return (
        !(state.hiddenOlingContexts instanceof Set) ||
        state.hiddenOlingContexts.size === 0
      );
    }

    function syncCustomisePresentation() {
      setOlingsHidden(
        contexts.CUSTOMISE || 'customise',
        Boolean(state.editMode)
      );
    }

    return {
      getMode,
      canUseLabInteraction,
      setOlingsHidden,
      shouldRenderOlings,
      syncCustomisePresentation
    };
  }

  window.createOlingLabPresentation = createOlingLabPresentation;
})();
