(function () {
  function createOlingLabPurchases(dependencies) {
    const accountState = window.createOlingLabAccountState(dependencies);
    const dialogUi = window.createOlingLabPurchaseDialogUi(dependencies);
    const shared = { ...dependencies, ...accountState, dialogUi };
    return {
      ...accountState,
      ...window.createOlingLabQuickSell(shared),
      ...window.createOlingLabFurnitureSale(shared),
      ...window.createOlingLabExpansionPurchase(shared)
    };
  }
  window.createOlingLabPurchases = createOlingLabPurchases;
})();
