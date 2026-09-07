(function () {
  function createOlingLabSelection({ state, elements }) {
    let onCloseSelectedTarget = () => {};
    const getTargetKey = (target) =>
      target ? `${target.type}:${target.id}` : '';
    const isTargetSelected = (type, id) =>
      getTargetKey(state.selectedTarget) === `${type}:${id}`;
    const closeSelectedTarget = () => {
      onCloseSelectedTarget();
      state.selectedTarget = null;
      state.sellConfirmTarget = null;
      if (elements.actionPanel) {
        elements.actionPanel.remove();
        elements.actionPanel = null;
      }
    };
    const createSelectionTools = ({
      renderLab,
      onCloseSelection = () => {}
    }) => {
      onCloseSelectedTarget = onCloseSelection;
      return {
        toggleSelectedTarget(type, id) {
          if (isTargetSelected(type, id)) closeSelectedTarget();
          else {
            closeSelectedTarget();
            state.selectedTarget = { type, id };
            state.sellConfirmTarget = null;
          }
          renderLab();
        }
      };
    };
    return {
      getTargetKey,
      isTargetSelected,
      closeSelectedTarget,
      createSelectionTools
    };
  }
  window.createOlingLabSelection = createOlingLabSelection;
})();
